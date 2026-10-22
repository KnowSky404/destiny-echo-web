import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { MINION_KINDS } from "../../src/data/balance/model";
import { defaultProfile } from "../../src/data/balance/profile";
import { CARDS } from "../../src/data/cards";
import { ENEMIES } from "../../src/data/enemies";
import { boot, firstReward, snapshot, start } from "./helpers";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", (error) => messages.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") messages.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) messages.push(response.url());
  });
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

async function open(page: Page, tab?: string) {
  await page.locator("#debug-trigger").click();
  await expect(page.getByRole("dialog", { name: "PRE 数值实验室" })).toBeVisible();
  if (tab) await page.getByRole("tab", { name: tab, exact: true }).click();
}

test("real PRE build edits a battle, preserves temporary builds across jumps, and restores an entry", async ({
  page,
}, info) => {
  if (info.project.name.includes("touch")) await page.setViewportSize({ width: 320, height: 740 });
  await boot(page);
  await start(page);
  await open(page);
  await page.getByLabel("覆盖 基础伤害", { exact: true }).check();
  await page.getByRole("spinbutton", { name: "基础伤害", exact: true }).fill("88");
  await page.getByLabel("当前生命", { exact: true }).fill("72");
  await page.getByRole("button", { name: "应用玩家修改", exact: true }).click();
  expect((await snapshot(page)).player.stats.damage).toBe(88);
  expect((await snapshot(page)).player.hp).toBe(72);
  expect((await snapshot(page)).phase).toBe("Paused");
  await page.getByText("卡组与锻体：增删、设置层数", { exact: true }).click();
  await page.getByLabel("巨力刻印", { exact: true }).fill("2");
  await page.getByRole("button", { name: "应用卡组修改", exact: true }).click();
  expect((await snapshot(page)).stacks.force).toBe(2);
  expect((await snapshot(page)).player.stats.damage).toBe(88);
  await page.getByRole("tab", { name: "关卡控制", exact: true }).click();
  await page.getByLabel("目标关卡（1–4 战役，5 起为无尽）", { exact: true }).fill("6");
  await page.getByRole("button", { name: "跳转关卡", exact: true }).click();
  expect((await snapshot(page)).stageIndex).toBe(5);
  expect((await snapshot(page)).stacks.force).toBe(2);
  await page.getByRole("tab", { name: "敌人与出怪", exact: true }).click();
  await page.getByLabel("补怪数量", { exact: true }).fill("2");
  await page.getByRole("button", { name: "补入战场", exact: true }).click();
  expect((await snapshot(page)).enemies).toHaveLength(2);
  await page.getByLabel("指定当前生命（应用时生效）", { exact: true }).fill("12");
  await page.getByRole("button", { name: "应用到所选敌人", exact: true }).click();
  expect((await snapshot(page)).enemies.every((enemy) => enemy.hp === 12)).toBe(true);
  await page.getByRole("tab", { name: "关卡控制", exact: true }).click();
  await page.getByRole("button", { name: "保留当前构筑重开本关", exact: true }).click();
  expect((await snapshot(page)).enemies).toHaveLength(0);
  expect((await snapshot(page)).stacks.force).toBe(2);
  await page.getByRole("tab", { name: "玩家与构筑", exact: true }).click();
  await page.getByLabel("当前生命", { exact: true }).fill("10");
  await page.getByRole("button", { name: "应用玩家修改", exact: true }).click();
  await page.getByRole("tab", { name: "关卡控制", exact: true }).click();
  await page.getByRole("button", { name: "恢复入关快照", exact: true }).click();
  expect((await snapshot(page)).player.hp).toBe(72);
  expect((await snapshot(page)).stageElapsed).toBe(0);
  await page.screenshot({ path: join(tmpdir(), `destiny-pre-${info.project.name}.png`) });
  const dialog = page.getByRole("dialog", { name: "PRE 数值实验室" });
  const bounds = await dialog.boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "返回战场", exact: true }).click();
  expect((await snapshot(page)).phase).toBe("Paused");
});

test("saved versions survive refresh and JSON export/import without affecting a separate browser context", async ({
  page,
  browser,
}) => {
  await boot(page);
  await open(page, "方案版本");
  await page.getByLabel("方案名称", { exact: true }).fill("本机试验 A");
  await page.getByText("方案：玩家初始数值", { exact: true }).click();
  await page.getByRole("spinbutton", { name: "基础伤害", exact: true }).fill("42");
  await page.getByLabel("版本测试种子", { exact: true }).fill("123");
  await page.getByRole("button", { name: "保存为新版本", exact: true }).click();
  await page.getByRole("button", { name: "启用此版本测试", exact: true }).click();
  expect((await snapshot(page)).player.stats.damage).toBeGreaterThanOrEqual(42);
  expect((await snapshot(page)).seed).toBe(123);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出此版本", exact: true }).click();
  const download = await downloadPromise;
  const file = await download.path();
  if (!file) throw new Error("Missing downloaded configuration");
  const text = await readFile(file, "utf8");
  const profile = JSON.parse(text);
  expect(profile.payload.player.stats.damage).toBe(42);
  expect(profile).not.toHaveProperty("player");
  expect(profile).not.toHaveProperty("snapshot");
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect
    .poll(async () => (await snapshot(page)).player.stats.damage)
    .toBeGreaterThanOrEqual(42);
  await open(page, "方案版本");
  await expect(page.getByText("本机试验 A v1 · 下次打开时沿用", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "保存为新版本", exact: true }).click();
  const second = page.locator(".debug-version").filter({ hasText: "本机试验 A v2" });
  await second.getByRole("button", { name: "删除本地版本", exact: true }).click();
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await open(page, "方案版本");
  await page
    .locator(".debug-version")
    .filter({ hasText: "本机试验 A v1" })
    .getByRole("button", { name: "载入为草稿", exact: true })
    .click();
  await page.getByRole("button", { name: "保存为新版本", exact: true }).click();
  await expect(page.getByText("本机试验 A v3", { exact: true })).toBeVisible();
  await expect(page.getByText("本机试验 A v2", { exact: true })).toHaveCount(0);
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await other.goto("http://127.0.0.1:4188/");
    await expect(other.locator("#debug-trigger")).toBeVisible();
    await expect(other.locator("canvas")).toBeVisible();
    expect((await snapshot(other)).player.stats.damage).toBeLessThan(
      (await snapshot(page)).player.stats.damage,
    );
    expect(await other.evaluate(() => localStorage.getItem("echoes:pre:balance:v1"))).toBeNull();
    await other.locator("#debug-trigger").click();
    await other.getByRole("tab", { name: "方案版本", exact: true }).click();
    await other.getByLabel("导入配置 JSON", { exact: true }).setInputFiles({
      name: "profile.json",
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
    await expect(other.getByLabel("方案名称", { exact: true })).toHaveValue("本机试验 A");
    await other.getByRole("button", { name: "保存为新版本", exact: true }).click();
    await other.getByRole("button", { name: "启用此版本测试", exact: true }).click();
    expect((await snapshot(other)).player.stats.damage).toBeGreaterThanOrEqual(42);
  } finally {
    await context.close();
  }
});

test("invalid imports preserve the draft, escaped profile names stay text, and keyboard focus stays in the dialog", async ({
  page,
}) => {
  await boot(page);
  await open(page, "方案版本");
  await page.getByLabel("方案名称", { exact: true }).fill("保持此草稿");
  await page.getByLabel("方案名称", { exact: true }).press("Tab");
  await page.getByLabel("导入配置 JSON", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.locator(".debug-status")).toContainText("不兼容");
  await expect(page.getByLabel("方案名称", { exact: true })).toHaveValue("保持此草稿");
  const profile = defaultProfile();
  profile.name = '<img src=x onerror="alert(1)">';
  await page.getByLabel("导入配置 JSON", { exact: true }).setInputFiles({
    name: "safe.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(profile)),
  });
  await page.getByRole("button", { name: "保存为新版本", exact: true }).click();
  await expect(page.locator(".debug-version strong")).toContainText(profile.name);
  await expect(page.locator(".debug-dialog img")).toHaveCount(0);
  await page.getByLabel("方案名称", { exact: true }).focus();
  await page.keyboard.type("p");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("#debug-dialog")))).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#debug-dialog")).not.toBeVisible();
});

test("visual stage-range and card-pool editors control actual subsequent rewards", async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  await boot(page);
  await open(page, "方案版本");
  await page.getByLabel("方案名称", { exact: true }).fill("第二至三关的单卡试验");
  await page.getByText("方案：关卡范围与覆盖", { exact: true }).click();
  await page.getByRole("button", { name: "新增关卡规则", exact: true }).click();
  await page.getByLabel("起始关（含）", { exact: true }).fill("2");
  await page.getByLabel("结束关（含，留空为无限）", { exact: true }).fill("3");
  await page.getByLabel("覆盖 出怪预算（四车道基准）", { exact: true }).check();
  await page.getByRole("spinbutton", { name: "出怪预算（四车道基准）", exact: true }).fill("11");
  await page
    .getByLabel("自定义小怪种类权重（关闭时继承配置，默认均衡轮换）", { exact: true })
    .check();
  for (const kind of MINION_KINDS)
    await page
      .getByRole("spinbutton", { name: ENEMIES[kind].name, exact: true })
      .fill(kind === "wisp" ? "1" : "0");
  await page.getByText("方案：卡池、权重与抽卡规则", { exact: true }).click();
  await page.getByLabel("卡池作用范围", { exact: true }).selectOption("0");
  await page.getByLabel("抽卡模式", { exact: true }).selectOption("weighted");
  for (const card of CARDS)
    await page
      .getByRole("spinbutton", { name: `${card.name} · ${card.rarity}`, exact: true })
      .fill(card.id === "force" ? "5" : "0");
  await page.getByRole("button", { name: "保存为新版本", exact: true }).click();
  await page.getByRole("button", { name: "启用此版本测试", exact: true }).click();
  await page.locator("#debug-dialog").evaluate((dialog) => {
    dialog.scrollTop = 0;
  });
  await page.screenshot({ path: join(tmpdir(), `destiny-pre-profiles-${info.project.name}.png`) });
  await page.getByRole("tab", { name: "关卡控制", exact: true }).click();
  await page.getByLabel("目标关卡（1–4 战役，5 起为无尽）", { exact: true }).fill("2");
  await page.getByRole("button", { name: "跳转关卡", exact: true }).click();
  const selected = await snapshot(page);
  expect(selected.stageQuota).toBe(Math.ceil((11 * selected.arena.laneCount) / 4));
  await page.getByRole("button", { name: "返回战场", exact: true }).click();
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  await firstReward(page);
  expect((await snapshot(page)).reward?.choices).toEqual(["force"]);
  expect((await snapshot(page)).enemies.every((enemy) => enemy.kind === "wisp")).toBe(true);
  await expect(page.locator(".reward-card")).toHaveCount(1);
  await page.locator(".reward-card").click();
  expect((await snapshot(page)).stacks.force).toBe(1);
});

test("PRO artifact has no debugger, ignores profile-like storage, and ordinary development stays without an entry", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4187/");
  await page.evaluate(() => localStorage.setItem("echoes:pre:balance:v1", '{"draft":"fake"}'));
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#debug-trigger")).toHaveCount(0);
  expect(await page.evaluate(() => window.__ECHOES__)).toBeUndefined();
  await expect(page.locator("#health-value")).toHaveText("100 / 100");
  await page.goto("http://127.0.0.1:5187/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#debug-trigger")).toHaveCount(0);
});
