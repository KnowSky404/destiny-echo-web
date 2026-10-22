import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { chooseReward } from "../policy";
import { cleanupAndRegionsFlow, endlessSpawnFlow, healthScalingCardsFlow } from "./arena-mechanics";
import { crowdFusionFlow, trainingRewardFlow } from "./crowd-rewards";
import {
  boot,
  bootFixture,
  clickTarget,
  dragTo,
  expectPlayerAt,
  firstReward,
  resizeAndFit,
  snapshot,
  start,
} from "./helpers";
import {
  attackAreaFlow,
  epicRewardFlow,
  sanctuaryFlow,
  sanctuaryTauntFlow,
  woundsFlow,
} from "./player-power";

const runtimeErrors = new WeakMap<Page, string[]>();
test("endless waves keep random positions and guarantee attack-region admissions", async ({
  page,
}, info) => {
  await endlessSpawnFlow(page, info.project.name);
});
test("sanctuary disables tank and attack-area taunts until time resumes", async ({
  page,
}, info) => {
  await sanctuaryTauntFlow(page, info.project.name);
});
test("grievous wounds reduce healing and show the current endless slam damage", async ({
  page,
}, info) => {
  await woundsFlow(page, info.project.name);
});
test("cleansing sanctuary freezes enemy action and the deadline while shots keep dealing damage", async ({
  page,
}, info) => {
  await sanctuaryFlow(page, info.project.name);
});
test("stage rewards offer an epic and keyboard selection carries its power into the next stage", async ({
  page,
}, info) => {
  await epicRewardFlow(page, info.project.name);
});
test("endless attack-area taunt overrides a manual tank lock", async ({ page }, info) => {
  await attackAreaFlow(page, info.project.name);
});
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
});
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
});

test("desktop Firefox fills the wide screen and keeps target coordinates correct after resizing", async ({
  page,
}, info) => {
  await boot(page);
  // Keep this coordinate check outside a seed-dependent chest reward overlay.
  await page.clock.setSystemTime(new Date(2));
  await start(page);
  await page.clock.runFor(4500);
  const state = await snapshot(page);
  expect(state.arena.width).toBeGreaterThan(800);
  expect(state.arena.laneCount).toBe(6);
  expect(state.player.x).toBe(state.arena.width / 2);
  const viewport = page.viewportSize();
  const box = await page.locator("canvas").boundingBox();
  if (!box || !viewport) throw new Error("Missing viewport");
  expect((box.width * box.height) / (viewport.width * viewport.height)).toBeGreaterThan(0.8);
  expect(box.width / box.height).toBeCloseTo(state.arena.width / 800, 2);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  await expect(page.locator("#build-dialog")).not.toBeVisible();
  await expect(page.locator("#help-dialog")).not.toBeVisible();
  const target = state.enemies.find((item) => item.x > state.arena.width / 2);
  if (!target) throw new Error("No target on the right side of the wide arena");
  await clickTarget(page, target.x, target.y);
  expect((await snapshot(page)).manualTargetId).toBe(target.id);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-wide-1920.png`) });
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  await resizeAndFit(page, 1366, 768);
  await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  const current = (await snapshot(page)).enemies.find((item) => item.id === target.id);
  if (!current) throw new Error("Target disappeared while paused");
  await clickTarget(page, current.x, current.y);
  expect((await snapshot(page)).manualTargetId).toBe(target.id);
  expect((await snapshot(page)).player.x).toBe(state.arena.width / 2);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-wide-1366.png`) });
});

test("top build and help dialogs pause battle, scroll independently and return keyboard focus", async ({
  page,
}, info) => {
  await boot(page);
  await start(page);
  await page.getByRole("button", { name: "本局构筑", exact: true }).click();
  await page.clock.runFor(150);
  const build = page.getByRole("dialog", { name: "本局构筑", exact: true });
  await expect(build).toBeVisible();
  const title = await build.locator("h2").boundingBox();
  const close = await build.locator("#close-build").boundingBox();
  if (!title || !close) throw new Error("Missing dialog header");
  expect(title.height).toBeLessThan(48);
  expect(close.width).toBeLessThan(220);
  await expect(build.locator("#stats")).toContainText("普攻吸血");
  await expect(build.locator("#synergies details")).toHaveCount(12);
  await expect(build).toContainText("下一张 5000 分");
  const before = await snapshot(page);
  await page.clock.runFor(600);
  expect(await snapshot(page)).toEqual(before);
  await build.locator("summary").first().click();
  await expect(build.locator("details").first()).toHaveAttribute("open", "");
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-build-dialog.png`) });
  await page.keyboard.press("Escape");
  await expect(build).not.toBeVisible();
  await expect(page.locator("#build-trigger")).toBeFocused();
  expect((await snapshot(page)).phase).toBe("Paused");
  let reachedResume = false;
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    reachedResume ||= await page
      .locator('#overlay [data-action="resume"]')
      .evaluate((button) => button === document.activeElement);
  }
  expect(reachedResume).toBe(true);
  await page.getByRole("button", { name: "玩法说明", exact: true }).click();
  const help = page.locator("#help-dialog");
  await expect(help).toBeVisible();
  await expect(help).toContainText("玩家生命归零才失败");
  await expect(help).toContainText("累计每 5,000 分");
  await page.getByRole("button", { name: "明白了", exact: true }).click();
  await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  await page.clock.runFor(200);
  expect((await snapshot(page)).phase).toBe("Playing");
  await expect(page.locator("#overlay")).not.toBeVisible();
});

test("score training is awarded automatically in the wide battlefield without opening choices", async ({
  page,
}, info) => {
  await bootFixture(
    page,
    `
    world.score = 4900;
    world.player.stats.damage = 100;
    world.player.cooldown = 0;
    enemy({ x: 800, y: 600, defenseX: 800, defenseY: 600, hp: 1, speed: 0 });
  `,
    1600,
  );
  await page.clock.runFor(500);
  const state = await snapshot(page);
  expect(state.score).toBe(5000);
  expect(state.scoreTrainings).toBe(1);
  expect(state.phase).toBe("Playing");
  expect(state.reward).toBeNull();
  expect(state.trainingStacks["training-leech"]).toBeUndefined();
  await expect(page.locator("#score-value")).toHaveText("5,000 分");
  await expect(page.locator("#arena-notice")).toContainText("分数锻体");
  await page.getByRole("button", { name: "本局构筑", exact: true }).click();
  await page.clock.runFor(100);
  await expect(page.locator("#build-dialog")).toContainText("分数锻体已发 1 张 · 下一张 10000 分");
  await expect(page.locator(".collected-card.training")).toHaveCount(1);
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-score-training.png`),
  });
});

test("pause intent remains paused when window blur happens immediately before the click", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await expect(page.getByRole("button", { name: "暂停游戏", exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>("#pause-button");
    if (button?.dataset.action !== "pause") throw new Error("Pause intent missing");
    window.dispatchEvent(new Event("blur"));
    button.click();
  });
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Paused");
  await expect(page.getByRole("button", { name: "继续共鸣", exact: true })).toBeVisible();
});

test("pause click survives HUD refresh while the pointer is held", async ({ page }) => {
  await boot(page);
  await start(page);
  const button = page.getByRole("button", { name: "暂停游戏", exact: true });
  const box = await button.boundingBox();
  if (!box) throw new Error("Pause button missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(250);
  await page.mouse.up();
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Paused");
  await expect(page.getByRole("button", { name: "继续共鸣", exact: true })).toBeVisible();
});

test("fixed position survives old movement keys immediately after resume", async ({ page }) => {
  await boot(page);
  await start(page);
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  const before = await snapshot(page);
  await page.keyboard.down("d");
  await page.clock.runFor(400);
  await page.keyboard.up("d");
  expect((await snapshot(page)).player.x).toBe(before.player.x);
});

test("loads real WebGL, old movement inputs keep the ship fixed and pause blocks all combat", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await boot(page);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-menu.png`) });
  await start(page);
  const initial = await snapshot(page);
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor(1400);
  await page.keyboard.up("ArrowRight");
  const moved = await snapshot(page);
  expect(moved.player.x).toBe(initial.player.x);
  expect(moved.shots.length).toBeGreaterThan(0);
  await page.keyboard.down("w");
  await page.clock.runFor(1000);
  await page.keyboard.up("w");
  expect((await snapshot(page)).player.y).toBe(736);
  await dragTo(page, 100, 720);
  await expectPlayerAt(page, initial.player.x, 736);
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  const paused = await snapshot(page);
  expect(paused.phase).toBe("Paused");
  await page.keyboard.down("d");
  await page.clock.runFor(500);
  await page.keyboard.up("d");
  expect(await snapshot(page)).toEqual(paused);
  await resizeAndFit(page, 1080, 780);
  await page.keyboard.press("p");
  await page.clock.runFor(100);
  await dragTo(page, 310, 740);
  await expectPlayerAt(page, initial.player.x, 736);
  // A natural chest may have opened during the input exercise. Claim its real
  // offer before testing blur from Playing; reward selection correctly stays frozen.
  if ((await snapshot(page)).phase === "RewardSelection") {
    await page.locator(".reward-card").first().click();
    await page.clock.runFor(100);
  }
  expect((await snapshot(page)).phase).toBe("Playing");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Paused");
  await page.getByRole("button", { name: "玩法说明" }).click();
  await expect(page.getByRole("dialog", { name: "在残响中，改写命运。" })).toBeVisible();
  await page.getByRole("button", { name: "明白了" }).click();
  expect(errors).toEqual([]);
});

test("shoots a real chest, offers three unique cards, freezes the run and applies exactly one upgrade", async ({
  page,
}, info) => {
  await boot(page);
  await start(page);
  await firstReward(page);
  await expect(page.getByRole("heading", { name: "选择一道残响" })).toBeVisible();
  const before = await snapshot(page);
  expect(before.phase).toBe("RewardSelection");
  expect(before.openedChests).toBe(1);
  const cards = page.locator(".reward-card");
  await expect(cards).toHaveCount(3);
  expect(
    new Set(
      await cards.evaluateAll((buttons) =>
        buttons.map((button) => (button as HTMLElement).dataset.card),
      ),
    ).size,
  ).toBe(3);
  await page.keyboard.down("d");
  await page.clock.runFor(500);
  await page.keyboard.up("d");
  expect(await snapshot(page)).toEqual(before);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-reward.png`) });
  await cards.first().click();
  await page.clock.runFor(100);
  const after = await snapshot(page);
  expect(after.phase).toBe("Playing");
  expect(after.reward).toBeNull();
  expect(Object.values(after.stacks).reduce((sum, count) => sum + count, 0)).toBe(1);
  expect(after.player).not.toEqual(before.player);
  await expect(page.locator(".collected-card")).toHaveCount(1);
});

for (const strategy of ["offense", "defensive"] as const) {
  test(`a natural ${strategy} run reaches ${strategy === "offense" ? "stage two" : "failure"} and restarts cleanly`, async ({
    page,
    browserName,
  }, info) => {
    test.skip(
      browserName !== "chromium" && browserName !== "firefox",
      "Natural desktop runs execute in Chromium and Firefox.",
    );
    test.setTimeout(browserName === "firefox" ? 600_000 : 300_000);
    await boot(page);
    await page.clock.setSystemTime(new Date(strategy === "offense" ? 4 : 1));
    await start(page);
    for (let second = 0; second < 95; second++) {
      const state = await snapshot(page);
      if (["GameOver", "Victory", "StageClear"].includes(state.phase)) break;
      if (state.phase === "RewardSelection" && state.reward) {
        const id = chooseReward(
          state.reward.choices,
          new Map(Object.entries(state.stacks)),
          state.player.hp,
          strategy === "defensive" ? "defensive" : "active",
        );
        if (!id) throw new Error("Missing reward");
        await page.locator(`[data-card="${id}"]`).click();
      }
      const chest = state.chests[0];
      if (chest && !state.enemies.some((enemy) => enemy.kind === "boss"))
        await clickTarget(page, chest.x, chest.y);
      await page.clock.runFor(1000);
    }
    const result = await snapshot(page);
    expect(result.phase).toBe(strategy === "offense" ? "StageClear" : "GameOver");
    expect(result.metrics.regularAttacks).toBeGreaterThan(0);
    expect(result.metrics.damageTaken).toBeGreaterThan(0);
    expect(result.kills).toBeGreaterThan(0);
    if (strategy === "offense") {
      expect(result.elapsed).toBeGreaterThanOrEqual(52);
      expect(result.openedChests).toBeGreaterThanOrEqual(6);
      expect(result.metrics.damageTaken).toBeGreaterThan(0);
      expect(result.enemies).toEqual([]);
      expect(result.hostileShots).toEqual([]);
    }
    await page.screenshot({
      path: join(tmpdir(), `destiny-${info.project.name}-${strategy}-result.png`),
    });
    if (strategy === "offense") {
      const frozen = await snapshot(page);
      await page.clock.runFor(1000);
      expect(await snapshot(page)).toEqual(frozen);
      await page.locator(".reward-card").first().click();
      await page.clock.runFor(100);
      const carried = await snapshot(page);
      expect(carried.stageIndex).toBe(1);
      for (const [id, count] of Object.entries(frozen.stacks))
        expect(carried.stacks[id]).toBeGreaterThanOrEqual(count);
      expect(
        [...Object.values(carried.stacks), ...Object.values(carried.trainingStacks)].reduce(
          (sum, count) => sum + count,
          0,
        ),
      ).toBe(
        [...Object.values(frozen.stacks), ...Object.values(frozen.trainingStacks)].reduce(
          (sum, count) => sum + count,
          0,
        ) + 1,
      );
      await expect(page.locator("#stage-label")).toContainText("棱镜回廊");
      await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
      await page.clock.runFor(100);
      await page.getByRole("button", { name: "返回开始界面", exact: true }).click();
      await page.clock.runFor(100);
      await page.getByRole("button", { name: "开始共鸣", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "再次共鸣" }).click();
    }
    await page.clock.runFor(100);
    const fresh = await snapshot(page);
    expect(fresh.phase).toBe("Playing");
    expect(fresh.elapsed).toBeLessThan(0.3);
    expect(fresh.player.hp).toBe(100);
    expect(fresh.player.stats.damage).toBe((12 * fresh.arena.laneCount) / 4);
    expect(fresh.player.stats.projectiles).toBe(1);
    expect(fresh.stacks).toEqual({});
    expect(fresh.manualTargetId).toBeNull();
    expect(fresh.targetId).toBeNull();
    expect(fresh.openedChests + fresh.kills + fresh.score).toBe(0);
  });
}

test("WebGL unavailable is a readable recovery screen", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).includes("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "未能唤醒图形引擎" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  await expect(page.locator("#overlay")).toContainText("硬件加速");
});

test("production static build loads without diagnostics or missing assets", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.goto("http://127.0.0.1:4187/");
  await expect(page).toHaveTitle("命运残响 · Echoes of Destiny");
  await expect(page.getByRole("button", { name: "开始共鸣", exact: true })).toBeEnabled();
  await expect(page.locator("canvas")).toBeVisible();
  expect(await page.evaluate(() => window.__ECHOES__)).toBeUndefined();
  await expect(page.locator("#debug-trigger")).toHaveCount(0);
  await page.getByRole("button", { name: "玩法说明", exact: true }).click();
  const help = page.getByRole("dialog", { name: "在残响中，改写命运。" });
  await expect(help).toContainText("51 张残响");
  await expect(help).toContainText("两项不同锻体与一张随机残响三选一");
  await expect(help).toContainText("手机最多 24 只小怪加首领");
  await expect(help).toContainText("遗世庇护");
  await expect(help).toContainText("首层 0.75 秒");
  await expect(help).toContainText("减少 90% 治疗");
  await expect(help).toContainText("之后每关 +9");
  await expect(help).toContainText("首关只开放");
  await expect(
    help.getByRole("link", { name: "完整游戏 Wiki：卡牌、怪物、羁绊与机制" }),
  ).toHaveAttribute("href", "https://github.com/KnowSky404/destiny-echo-web/wiki");
  await expect(help).toContainText("没有有效嘲讽时不强制锁定坦克");
  await page.getByRole("button", { name: "明白了", exact: true }).click();
  expect(failures).toEqual([]);
});

test("a near-defeated boss resolves through real homing fire to victory and restart", async ({
  page,
}, info) => {
  await bootFixture(
    page,
    `world.elapsed = 250; world.stageIndex = 3; world.clearedStages = 3; enemy({ kind: "boss", hp: 12 });`,
  );
  await page.clock.runFor(2000);
  await expect(page.locator(".reward-card.training")).toHaveCount(2);
  await page.locator(".reward-card.training").first().click();
  await page.clock.runFor(100);
  await expect(page.getByRole("heading", { name: "终局，由你改写" })).toBeVisible();
  const victory = await snapshot(page);
  expect(victory.phase).toBe("Victory");
  expect(victory.kills).toBe(1);
  expect(victory.score).toBe(4000);
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-victory-fixture.png`),
  });
  await page.getByRole("button", { name: "再次共鸣", exact: true }).click();
  await page.clock.runFor(100);
  const fresh = await snapshot(page);
  expect(fresh.phase).toBe("Playing");
  expect(fresh.targetId).toBeNull();
  expect(fresh.manualTargetId).toBeNull();
  expect(fresh.player.x).toBe(225);
  expect(fresh.player.y).toBe(736);
  expect(fresh.kills + fresh.score).toBe(0);
  expect(fresh.player.hp).toBe(100);
  expect(fresh.elapsed).toBeLessThan(0.3);
});

test("mouse selects lateral targets, empty click cancels and keyboard targeting preserves pause", async ({
  page,
}, info) => {
  await bootFixture(
    page,
    `
    enemy({ x: 57, defenseX: 57, y: 300, arrived: false, hp: 36 });
    enemy({ x: 393, defenseX: 393, y: 350, arrived: false, hp: 500 });
  `,
  );
  const state = await snapshot(page);
  const chosen = state.enemies[0];
  if (!chosen) throw new Error("Missing target");
  await clickTarget(page, chosen.x, chosen.y);
  await page.clock.runFor(100);
  expect((await snapshot(page)).manualTargetId).toBe(chosen.id);
  await expect(page.locator("#target-label")).toContainText("手动优先");
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-target.png`) });
  await clickTarget(page, 225, 450);
  expect((await snapshot(page)).manualTargetId).toBeNull();
  await page.locator("canvas").focus();
  await page.keyboard.press("t");
  expect((await snapshot(page)).manualTargetId).not.toBeNull();
  await page.keyboard.press("c");
  expect((await snapshot(page)).manualTargetId).toBeNull();
  await clickTarget(page, chosen.x, chosen.y);
  await page.clock.runFor(2000);
  const after = await snapshot(page);
  expect(after.enemies.some((enemy) => enemy.id === chosen.id)).toBe(false);
  expect(after.manualTargetId).toBeNull();
  expect(after.targetId).not.toBeNull();
  await expectPlayerAt(page, after.player.x, 736);
  await page.keyboard.press("p");
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Paused");
});

test("preparation, dense defense and boss special render and produce real damage", async ({
  page,
}, info) => {
  await bootFixture(
    page,
    `
    world.elapsed = 35;
    world.player.cooldown = 100;
    for (let slot = 0; slot < 14; slot++) enemy({
      kind: slot % 2 ? "sentinel" : "wisp",
      x: 57 + (slot % 7) * 56, defenseX: 57 + (slot % 7) * 56, slot,
      y: 620 - Math.floor(slot / 7) * 54, defenseY: 620 - Math.floor(slot / 7) * 54,
      stage: slot % 2 ? "Attacking" : "Preparing", preparation: 1.4,
    });
  `,
  );
  const state = await snapshot(page);
  expect(state.enemies.some((enemy) => enemy.stage === "Preparing")).toBe(true);
  expect(state.metrics.regularAttacks).toBeGreaterThan(0);
  await expect(page.locator("#threat-label")).toContainText("14");
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-defense.png`) });
  await page.clock.runFor(2000);
  expect((await snapshot(page)).player.hp).toBeLessThan(100);
});

test("boss charge releases a damaging special in the rendered game", async ({ page }, info) => {
  await bootFixture(
    page,
    `
    world.elapsed = 63;
    const boss = enemy({ kind: "boss", stage: "Attacking", telegraph: 2, interruptRequired: 90 });
  `,
  );
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-boss-charge.png`) });
  await page.clock.runFor(3000);
  const state = await snapshot(page);
  expect(state.metrics.bossSpecials).toBe(1);
  expect(state.player.hp).toBeLessThan(100);
  expect(state.enemies[0]?.hp).toBeLessThan(2000);
});

test("focused fire interrupts an enraged boss and shows the second phase", async ({
  page,
}, info) => {
  await bootFixture(
    page,
    `
    world.elapsed = 68;
    world.player.stats.damage = 50;
    enemy({ kind: "boss", hp: 900, stage: "Attacking", telegraph: 1.7, interruptRequired: 120 });
  `,
  );
  await expect(page.locator("#boss-health")).toContainText("狂乱阶段");
  await page.clock.runFor(1000);
  const state = await snapshot(page);
  expect(state.metrics.bossInterrupts).toBe(1);
  expect(state.metrics.bossSpecials).toBe(0);
  expect(state.player.hp).toBe(100);
  await expect(page.locator("#arena-notice")).toContainText("蓄力已打断");
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-boss-interrupt.png`),
  });
});

test("six-layer synergy preview accepts a repeat upgrade and triggers a real explosion chain", async ({
  page,
}, info) => {
  await bootFixture(
    page,
    `
    world.player.cooldown = 100;
    for (let index = 0; index < 4; index++) applyCard("overload", world.player, world.stacks);
    applyCard("fuse", world.player, world.stacks);
    const chest = world.chests.acquire();
    Object.assign(chest, { id: 900000, x: 100, y: 250, hp: 0, maxHp: 36, radius: 26, age: 0, active: false });
    world.reward = { token: 100, choices: ["bloodpact", "overload", "vitality"], source: "chest" };
    world.state.transition("RewardSelection");
    enemy({ x: 100, defenseX: 100, y: 400, speed: 0, hp: 1 });
    enemy({ x: 240, defenseX: 240, y: 400, speed: 0, hp: 20 });
    enemy({ x: 380, defenseX: 380, y: 400, speed: 0, hp: 20 });
    const shot = world.shots.acquire();
    Object.assign(shot, { x: 100, y: 400, previousX: 100, previousY: 400,
      vx: 0, vy: 0, damage: 1, lifetime: 1, hitsLeft: 1, targetId: world.enemies.items[0].id });
  `,
  );
  await expect(page.locator('[data-card="bloodpact"]')).toContainText("5 → 6/6 · 中质变");
  await expect(page.locator('[data-card="overload"]')).toContainText("5 → 6/6 · 中质变");
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-synergy-reward.png`),
  });
  await page.locator('[data-card="bloodpact"]').click();
  await page.clock.runFor(100);
  const state = await snapshot(page);
  expect(state.kills).toBe(3);
  expect(state.metrics.chainKills).toBe(2);
  expect(state.metrics.explosionCount).toBe(3);
  await expect(page.locator('[data-synergy="blast"]')).toContainText("6/9 · 中质变");
  await page.getByRole("button", { name: "本局构筑", exact: true }).click();
  await page.clock.runFor(100);
  await page.locator('[data-synergy="blast"] summary').click();
  await expect(page.locator('[data-synergy="blast"] .synergy-details')).toBeVisible();
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-synergy-chain.png`) });
});

test("final victory offers endless continuation with the existing build and fresh stage time", async ({
  page,
}, info) => {
  await bootFixture(
    page,
    `
    world.stageIndex = 3;
    world.clearedStages = 3;
    world.elapsed = 250;
    world.player.hp = 50;
    world.player.shield = 24;
    for (const id of ["haste", "multishot", "piercing"]) applyCard(id, world.player, world.stacks);
    enemy({ kind: "boss", hp: 12 });
  `,
  );
  await page.clock.runFor(1000);
  await expect(page.locator(".reward-card.training")).toHaveCount(2);
  await page.locator(".reward-card.training").first().click();
  await page.clock.runFor(100);
  await expect(page.getByRole("heading", { name: "终局，由你改写" })).toBeVisible();
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-campaign-victory.png`),
  });
  const before = await snapshot(page);
  await page.getByRole("button", { name: "继续无尽 · 保留构筑", exact: true }).click();
  await page.clock.runFor(100);
  const after = await snapshot(page);
  expect(after.phase).toBe("Playing");
  expect(after.stageIndex).toBe(4);
  expect(after.endless).toBe(true);
  expect(after.stacks).toEqual(before.stacks);
  expect(after.player.hp).toBe(85);
  expect(after.player.shield).toBe(24);
  expect(after.score).toBe(before.score);
  expect(after.elapsed).toBeGreaterThanOrEqual(250);
  expect(after.stageElapsed).toBeLessThan(0.3);
  await expect(page.locator("#stage-label")).toContainText("无尽");
});

for (const layers of [3, 9]) {
  test(`repeated cards unlock the ${layers}-layer tier through a native reward action`, async ({
    page,
  }, info) => {
    await bootFixture(
      page,
      `
      world.player.cooldown = 100;
      for (let index = 0; index < ${layers - 1}; index++) applyCard("overload", world.player, world.stacks);
      world.reward = {token: 100, choices: ["overload", "haste", "ward"], source: "chest"};
      world.state.transition("RewardSelection");
    `,
    );
    await expect(page.locator("#synergies details")).toHaveCount(12);
    await expect(page.locator('[data-card="overload"]')).toContainText(
      `${layers - 1} → ${layers}/${layers}`,
    );
    await page.locator('[data-card="overload"]').click();
    await page.clock.runFor(100);
    const state = await snapshot(page);
    expect(state.stacks.overload).toBe(layers);
    expect(state.synergies.find((item) => item.id === "blast")?.tier).toBe(layers);
    await page.getByRole("button", { name: "本局构筑", exact: true }).click();
    await page.clock.runFor(100);
    await expect(page.locator('[data-synergy="blast"]')).toContainText(
      `${layers}/9 · ${layers === 3 ? "小" : "大"}质变`,
    );
    await page.screenshot({
      path: join(tmpdir(), `destiny-${info.project.name}-tier-${layers}.png`),
    });
  });
}

test("endless wave renders tanks and poison wizards in equal three-species composition", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await bootFixture(
    page,
    `world.stageIndex = 4; world.stageSupplies = 3; world.bossSpawned = false; world.player.cooldown = 100; world.player.shield = 2000;`,
  );
  await page.clock.runFor(7000);
  const state = await snapshot(page);
  expect(state.endless).toBe(true);
  expect(state.metrics.rangedSpawns).toBeGreaterThan(0);
  expect(
    state.enemies.some(
      (item) => item.kind === "wizard" && item.stage === "Attacking" && item.y < 500,
    ),
  ).toBe(true);
  expect(state.hostileShots.length).toBeGreaterThan(0);
  const counts = [
    state.stageKindSpawns.wisp,
    state.stageKindSpawns.tank,
    state.stageKindSpawns.wizard,
  ];
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  expect(state.player.poisonTime).toBeGreaterThan(0);
  await expect(page.locator("#target-label")).toContainText("攻击区优先");
  await expect(page.locator("#status-effects")).toContainText("中毒");
  await expect(page.locator("#stage-route")).toContainText("出怪预算 270");
  expect(errors).toEqual([]);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-ranged-wave.png`) });
});

test("endless poison and taunt feedback survive manual priority input and pausing", async ({
  page,
}, info) => {
  await bootFixture(
    page,
    `
    world.stageIndex = 4;
    world.stageSupplies = 3;
    world.player.cooldown = 100;
    world.player.poisonTime = 3;
    enemy({ kind: "tank", x: 80, defenseX: 80, y: 280, arrived: false, speed: 0, hp: 500 });
    enemy({ kind: "wizard", x: 365, defenseX: 365, y: 240, speed: 0, hp: 250 });
  `,
  );
  await page.clock.runFor(300);
  const wizard = (await snapshot(page)).enemies.find((item) => item.kind === "wizard");
  if (!wizard) throw new Error("No wizard");
  await clickTarget(page, wizard.x, wizard.y);
  await page.clock.runFor(100);
  const state = await snapshot(page);
  expect(state.manualTargetId).toBe(wizard.id);
  expect(state.enemies.find((item) => item.id === state.targetId)?.kind).toBe("wizard");
  await expect(page.locator("#target-label")).toContainText("攻击区优先");
  await expect(page.locator("#status-effects")).toContainText("攻速 -30%");
  expect(state.combat.interval).toBeGreaterThan(0.34);
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-endless-status.png`),
  });
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  const frozen = await snapshot(page);
  await page.clock.runFor(1000);
  expect(await snapshot(page)).toEqual(frozen);
});

test("endless boss guard renders reduction, skill count and arrival damage bonus", async ({
  page,
}, info) => {
  await bootFixture(
    page,
    `
    world.stageIndex = 4;
    world.stageSupplies = 3;
    world.player.cooldown = 100;
    world.player.shield = 2000;
    const boss = enemy({ kind: "boss", hp: 1000, maxHp: 1000, damageReductionTime: 3,
      skillsUsed: 1, lastSkill: "guard", stage: "Attacking", attackPolicy: { type: "anywhere" } });
  `,
  );
  await expect(page.locator("#boss-health")).toContainText("减伤 90%");
  await expect(page.locator("#boss-health")).toContainText("技能 1/3");
  await expect(page.locator("#boss-health")).toContainText("攻击 ×2");
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-endless-guard.png`) });
});

test("random endless supply freezes and accepts exactly one native card choice", async ({
  page,
}) => {
  await bootFixture(
    page,
    `
    world.stageIndex = 4;
    world.stageElapsed = 43;
    world.player.cooldown = 100;
    world.player.shield = 2000;
  `,
  );
  await expect(page.getByRole("heading", { name: "无尽随机补给 1 / 3" })).toBeVisible();
  await expect(page.locator(".reward-card")).toHaveCount(3);
  const frozen = await snapshot(page);
  await page.clock.runFor(1000);
  expect(await snapshot(page)).toEqual(frozen);
  const token = frozen.reward?.token;
  await page.locator(".reward-card").first().click();
  await page.clock.runFor(100);
  const next = await snapshot(page);
  expect(Object.values(next.stacks).reduce((a, b) => a + b, 0)).toBe(1);
  expect(next.reward?.token).not.toBe(token);
});

test("a naturally scheduled gold-charge boss retains ranged and melee escort threats", async ({
  page,
}, info) => {
  await bootFixture(
    page,
    `world.bossSpawned = false; world.stageElapsed = world.stage.bossAt; world.player.cooldown = 100; world.player.shield = 2000;`,
  );
  const before = await snapshot(page);
  const initialSpawns = before.metrics.rangedSpawns + before.metrics.meleeSpawns;
  await page.clock.runFor(2100);
  const replenished = await snapshot(page);
  expect(replenished.metrics.rangedSpawns + replenished.metrics.meleeSpawns).toBeGreaterThan(
    initialSpawns,
  );
  await page.clock.runFor(9900);
  const state = await snapshot(page);
  expect(state.enemies.some((item) => item.kind === "boss" && item.telegraph > 0)).toBe(true);
  expect(state.enemies.some((item) => item.kind === "hexer")).toBe(true);
  expect(state.enemies.some((item) => ["wisp", "sentinel"].includes(item.kind))).toBe(true);
  expect(state.metrics.regularAttacks).toBeGreaterThan(0);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-mixed-boss.png`) });
});

test("mixed boss training reward settles before victory and survives endless", async ({
  page,
}, info) => {
  await trainingRewardFlow(page, info.project.name, false);
});

test("full endless formation shows capacity and fusion star upgrades", async ({ page }, info) => {
  await crowdFusionFlow(page, info.project.name, false);
});

test("boss cleanup preserves minions and clearance expands two visible attack regions", async ({
  page,
}, info) => {
  await cleanupAndRegionsFlow(page, info.project.name);
});

test("health-scaling card groups preview real coefficients and selection applies once", async ({
  page,
}, info) => {
  await healthScalingCardsFlow(page, info.project.name);
});
