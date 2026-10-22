import { readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { groupSummary } from "../../scripts/balance-sim/statistics";
import { contentHash } from "../../src/balance-sim/encoding";
import { REVIEW_CASE_KEY, type ReviewCase } from "../../src/balance-sim/review";
import { runNatural } from "../../src/balance-sim/runner";
import type { RunConfig } from "../../src/balance-sim/types";
import { officialProfile } from "../../src/data/balance/profile";
import { boot, snapshot, start } from "./helpers";

async function open(page: Page, tab = "实验/复核") {
  await page.locator("#debug-trigger").click();
  await page.getByRole("tab", { name: tab, exact: true }).click();
}
async function upload(page: Page, document: unknown) {
  await page.getByLabel("载入实验摘要或 case JSON", { exact: true }).setInputFiles({
    name: "case.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(document)),
  });
}
async function reviewCase(): Promise<ReviewCase> {
  const profile = officialProfile();
  profile.name = "CLI 候选人工复核";
  profile.payload.player.stats.damage = 37;
  const run: RunConfig = {
    seed: 78451,
    width: 1600,
    mode: "campaign",
    strategy: { name: "build-active" },
    maxSteps: 120,
    maxSeconds: 2,
    endlessTarget: 1,
  };
  const expected = runNatural(run, profile);
  return {
    schemaVersion: 1,
    kind: "balance-simulator-case",
    simulatorVersion: "1",
    profile,
    profileHash: await contentHash(profile),
    code: { commit: "browser-fixture", dirty: true, fingerprint: "fixture-only" },
    run,
    expected,
    expectedHash: await contentHash(expected),
  };
}

test("PRE experiment export, validated case import and manual preparation preserve draft and selected versions", async ({
  page,
  context,
}, info) => {
  if (info.project.name.includes("touch")) await page.setViewportSize({ width: 320, height: 740 });
  await boot(page);
  await open(page, "方案版本");
  await page.getByLabel("方案名称", { exact: true }).fill("已选固定方案");
  await page.getByRole("button", { name: "保存为新版本", exact: true }).click();
  await page.getByRole("button", { name: "启用此版本测试", exact: true }).click();
  await expect(page.locator("#debug-dialog")).toHaveAttribute("aria-busy", "false");
  await page.getByLabel("方案名称", { exact: true }).fill("正在编辑的草稿");
  await page.getByLabel("方案名称", { exact: true }).press("Tab");
  let saved = await page.evaluate(() => localStorage.getItem("echoes:pre:balance:v1"));
  await page.getByRole("tab", { name: "实验/复核", exact: true }).click();
  await expect(page.locator(".debug-profile-state")).toContainText("草稿：正在编辑的草稿");
  await expect(page.locator(".debug-profile-state")).toContainText("选中版本：已选固定方案");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出选中方案用于实验", exact: true }).click();
  const file = await (await downloadPromise).path();
  if (!file) throw new Error("Missing selected profile export");
  expect(JSON.parse(await readFile(file, "utf8")).name).toBe("已选固定方案");
  const previous = JSON.parse(saved ?? "{}");
  const peer = await context.newPage();
  try {
    await peer.goto("/");
    // page.clock belongs to the whole context. Render the new peer's menu while
    // the first page remains paused, before testing shared-storage protections.
    await page.clock.runFor(100);
    await expect(peer.locator("canvas")).toBeVisible();
    await open(peer);
    const candidate = officialProfile();
    candidate.name = "CLI 独立候选";
    candidate.payload.player.stats.damage = 63;
    const input = {
      name: "candidate.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(candidate)),
    };
    await page.getByLabel("导入候选为独立版本（保留草稿）", { exact: true }).setInputFiles(input);
    await expect(page.locator(".debug-status")).toContainText("已导入候选");
    saved = await page.evaluate(() => localStorage.getItem("echoes:pre:balance:v1"));
    const next = JSON.parse(saved ?? "{}");
    expect(JSON.stringify(next.draft)).toBe(JSON.stringify(previous.draft));
    expect(JSON.stringify(next.selected)).toBe(JSON.stringify(previous.selected));
    expect(next.versions).toHaveLength(previous.versions.length + 1);
    expect(next.versions.slice(0, -1)).toEqual(previous.versions);
    expect(next.versions.at(-1).payload).toEqual(candidate.payload);
    expect(next.versions.at(-1).revision).toBe(1);
    expect(next.versions.at(-1).id).not.toBe(candidate.id);
    await peer.getByLabel("导入候选为独立版本（保留草稿）", { exact: true }).setInputFiles(input);
    await expect(peer.locator(".debug-status")).toContainText("其他 PRE 标签页");
    expect(await page.evaluate(() => localStorage.getItem("echoes:pre:balance:v1"))).toBe(saved);
  } finally {
    await peer.close();
  }
  const sample = await reviewCase();
  await upload(page, sample);
  await expect(page.getByText("单局人工复核", { exact: true })).toBeVisible();
  await expect(page.locator("#debug-content")).toContainText("种子：78451 · 策略：build-active");
  expect(await page.evaluate(() => localStorage.getItem("echoes:pre:balance:v1"))).toBe(saved);
  await page.getByRole("button", { name: "按案例准备人工开局（重新载入）", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "PRE 数值实验室" })).toBeVisible();
  await expect(page.locator(".debug-status")).toContainText("未自动执行策略");
  const prepared = await snapshot(page);
  expect(prepared.seed).toBe(sample.run.seed);
  expect(prepared.arena.width).toBe(sample.run.width);
  expect(prepared.player.stats.damage).toBe((37 * prepared.arena.laneCount) / 4);
  expect(prepared.elapsed).toBe(0);
  expect(prepared.stageIndex).toBe(0);
  expect(prepared.phase).toBe("Paused");
  expect(await page.evaluate(() => localStorage.getItem("echoes:pre:balance:v1"))).toBe(saved);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), REVIEW_CASE_KEY)).toBeNull();
  await expect(page.locator(".debug-profile-state")).toContainText("草稿：正在编辑的草稿");
  await expect(page.locator(".debug-profile-state")).toContainText("选中版本：已选固定方案");
  await expect(page.locator(".debug-profile-state")).toContainText("正在运行：CLI 候选人工复核");
  const dialog = page.locator("#debug-dialog");
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole("tab", { name: "实验/复核", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "玩家与构筑", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "实验/复核", exact: true })).toBeFocused();
  await page.screenshot({
    path: join(tmpdir(), `destiny-balance-manual-${info.project.name}.png`),
  });
  await page.getByText("单局人工复核", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(tmpdir(), `destiny-balance-case-${info.project.name}.png`) });
  await page.getByRole("button", { name: "返回战场", exact: true }).click();
  expect((await snapshot(page)).phase).toBe("Paused");
});

test("PRE experiment files reject mismatched hashes and invalid run conditions, and render summary names as text", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await open(page);
  const initial = await snapshot(page);
  const sample = await reviewCase();
  sample.profile.payload.player.stats.damage++;
  await upload(page, sample);
  await expect(page.locator(".debug-status")).toContainText("profileHash 不一致");
  sample.profileHash = await contentHash(sample.profile);
  sample.run.seed = -1;
  await upload(page, sample);
  await expect(page.locator(".debug-status")).toContainText("run.seed");
  await expect(
    page.getByRole("button", { name: "按案例准备人工开局（重新载入）", exact: true }),
  ).toHaveCount(0);
  const group = groupSummary(
    [
      {
        id: "browser",
        cohort: "selection",
        profileHash: sample.profileHash,
        profileId: sample.profile.id,
        profileName: '<img src=x onerror="alert(1)">',
        layoutId: "desktop",
        wallTimeMs: 0,
        result: sample.expected,
      },
    ],
    1,
  );
  await upload(page, {
    schemaVersion: 1,
    simulatorVersion: "1",
    kind: "balance-simulator-summary",
    planned: 1,
    completed: 1,
    counts: group.counts,
    groups: [group],
  });
  await expect(page.getByText("实验摘要", { exact: true })).toBeVisible();
  await expect(page.locator(".debug-review-json")).toContainText("<img src=x");
  await expect(page.locator("#debug-dialog img")).toHaveCount(0);
  sample.run.seed = sample.expected.config.seed;
  sample.expected.termination = "error";
  sample.expected.reason = "numeric error fixture; state unavailable";
  sample.expected.validMetrics = false;
  sample.expected.invalidValues = [{ path: "final.hp", value: "NaN" }];
  sample.expected.final.hp = 0;
  sample.expectedHash = await contentHash(sample.expected);
  await upload(page, sample);
  await expect(page.locator("#debug-content")).toContainText("数值失效，状态不可用");
  const after = await snapshot(page);
  expect(after.seed).toBe(initial.seed);
  expect(after.elapsed).toBe(initial.elapsed);
  expect(after.phase).toBe("Paused");
});

test("PRO output excludes experimental strategy, review and trace modules", async ({ page }) => {
  await page.goto("http://127.0.0.1:4187/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("tab", { name: "实验/复核", exact: true })).toHaveCount(0);
  const output = join(process.cwd(), "dist");
  const bundlePaths = (await readdir(output, { recursive: true })).filter((path) =>
    path.endsWith(".js"),
  );
  expect(bundlePaths.length).toBeGreaterThan(0);
  for (const path of bundlePaths) {
    const code = await readFile(join(output, path), "utf8");
    for (const marker of [
      "balance-simulator-case",
      "按案例准备人工开局",
      "build-active",
      "debug-review-json",
      REVIEW_CASE_KEY,
    ])
      expect(code).not.toContain(marker);
  }
});

test("actual CLI case prepares the matching PRE seed and arena for manual review", async ({
  page,
}, info) => {
  const path = process.env.BALANCE_REVIEW_CASE;
  test.skip(!path, "Set BALANCE_REVIEW_CASE to an experiment cases/*.json artifact");
  if (!path) return;
  const document = JSON.parse(await readFile(path, "utf8")) as ReviewCase;
  await boot(page);
  await open(page);
  const saved = await page.evaluate(() => localStorage.getItem("echoes:pre:balance:v1"));
  await upload(page, document);
  await expect(page.getByText("单局人工复核", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "按案例准备人工开局（重新载入）", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".debug-status")).toContainText("未自动执行策略");
  const state = await snapshot(page);
  expect(state.seed).toBe(document.run.seed);
  expect(state.arena.width).toBe(document.run.width);
  expect(state.phase).toBe("Paused");
  expect(state.elapsed).toBe(0);
  expect(state.stageIndex).toBe(0);
  expect(state.player.hp).toBe(document.profile.payload.player.hp);
  expect(state.player.stats.damage).toBe(
    (document.profile.payload.player.stats.damage * state.arena.laneCount) / 4,
  );
  expect(await page.evaluate(() => localStorage.getItem("echoes:pre:balance:v1"))).toBe(saved);
  await page.getByText("单局人工复核", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(tmpdir(), `destiny-balance-cli-case-${info.project.name}.png`),
  });
});
