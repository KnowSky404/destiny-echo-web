import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { crowdFusionFlow, trainingRewardFlow } from "./crowd-rewards";
import { boot, bootFixture, clickTarget, firstReward, snapshot, start } from "./helpers";
import {
  attackAreaFlow,
  epicRewardFlow,
  sanctuaryFlow,
  sanctuaryTauntFlow,
  woundsFlow,
} from "./player-power";

const runtimeErrors = new WeakMap<Page, string[]>();
test("320px touch sanctuary releases a native manual lock from tank taunt", async ({
  page,
}, info) => {
  await sanctuaryTauntFlow(page, info.project.name, true);
});
test("320px grievous wounds and growing slam remain readable and pause with combat", async ({
  page,
}, info) => {
  await woundsFlow(page, info.project.name, true);
});
test("touch sanctuary cleanses poison, freezes the deadline and survives pause", async ({
  page,
}, info) => {
  await sanctuaryFlow(page, info.project.name);
});
test("320px epic rewards fit and a native tap grants the chosen upgrade", async ({
  page,
}, info) => {
  await epicRewardFlow(page, info.project.name, true);
});
test("320px attack-area taunt overrides a native touch tank lock", async ({ page }, info) => {
  await attackAreaFlow(page, info.project.name, true);
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

test("native touch taps select targets at high DPR while swipes cannot move or retarget", async ({
  page,
  context,
}) => {
  await bootFixture(
    page,
    `
    enemy({ x: 393, defenseX: 393, y: 300, arrived: false, hp: 500 });
    enemy({ x: 57, defenseX: 57, y: 400, arrived: false, hp: 500 });
  `,
  );
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("No canvas");
  expect(
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      return [canvas?.width, canvas?.height];
    }),
  ).toEqual([450, 800]);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBeGreaterThan(1);
  const target = (await snapshot(page)).enemies[0];
  if (!target) throw new Error("No target");
  // Tap slightly outside the visible body, exercising small-screen tolerance.
  await clickTarget(page, target.x + target.radius + 10, target.y, true);
  await page.clock.runFor(100);
  expect((await snapshot(page)).manualTargetId).toBe(target.id);
  await expect(page.locator("#target-label")).toContainText("手动优先");
  const client = await context.newCDPSession(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.4;
  const scroll = await page.evaluate(() => window.scrollY);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x - 60, y: y + 80 }],
  });
  await page.clock.runFor(200);
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const after = await snapshot(page);
  expect(after.player.x).toBe(225);
  expect(after.player.y).toBe(736);
  expect(after.manualTargetId).toBe(target.id);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await clickTarget(page, 225, 450, true);
  expect((await snapshot(page)).manualTargetId).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-touch.png") });
});

test("320px reward cards fit, freeze combat and accept a native tap without targeting behind them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await boot(page);
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-menu.png") });
  await start(page);
  await firstReward(page);
  await expect(page.locator(".reward-card")).toHaveCount(3);
  const before = await snapshot(page);
  await page.clock.runFor(1000);
  expect(await snapshot(page)).toEqual(before);
  const frame = await page.locator(".arena-frame").boundingBox();
  const modal = await page.locator(".reward-modal").boundingBox();
  if (!frame || !modal) throw new Error("Missing reward bounds");
  expect(modal.y).toBeGreaterThanOrEqual(frame.y);
  expect(modal.y + modal.height).toBeLessThanOrEqual(frame.y + frame.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-reward.png") });
  await page.locator(".reward-card").last().tap();
  await page.clock.runFor(100);
  const after = await snapshot(page);
  expect(after.phase).toBe("Playing");
  expect(after.manualTargetId).toBeNull();
  expect(after.player.x).toBe(225);
  expect(after.player.y).toBe(736);
});

test("320px touch selects distinct enemies near the defense after scaling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await bootFixture(
    page,
    `
    world.player.cooldown = 100;
    for (let slot = 0; slot < 14; slot++) enemy({ x: 57 + (slot % 7) * 56, defenseX: 57 + (slot % 7) * 56,
      y: 620 - Math.floor(slot / 7) * 54, defenseY: 620 - Math.floor(slot / 7) * 54,
      stage: "Preparing", preparation: 1.4, slot });
  `,
  );
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const enemies = (await snapshot(page)).enemies;
  for (const target of [enemies[0], enemies[10], enemies[6]]) {
    if (!target) throw new Error("Missing target");
    await clickTarget(page, target.x, target.y, true);
    await page.clock.runFor(100);
    expect((await snapshot(page)).manualTargetId).toBe(target.id);
    await expect(page.locator("#target-label")).toContainText("手动优先");
  }
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-defense.png") });
});

test("320px stage supply shows synergy progress and preserves the build on a native tap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await bootFixture(
    page,
    `
    world.player.hp = 40;
    world.player.shield = 24;
    world.elapsed = 65;
    world.stageElapsed = 65;
    applyCard("overload", world.player, world.stacks);
    applyCard("fuse", world.player, world.stacks);
    world.clearedStages = 1;
    world.reward = { token: 100, choices: ["bloodpact", "overload", "vitality"], source: "stage" };
    world.state.transition("StageClear");
  `,
  );
  await expect(page.getByRole("heading", { name: "第 1 关突破" })).toBeVisible();
  await expect(page.locator('[data-card="bloodpact"]')).toContainText("小质变");
  const frame = await page.locator(".arena-frame").boundingBox();
  const modal = await page.locator(".reward-modal").boundingBox();
  if (!frame || !modal) throw new Error("Missing supply bounds");
  expect(modal.y).toBeGreaterThanOrEqual(frame.y);
  expect(modal.y + modal.height).toBeLessThanOrEqual(frame.y + frame.height);
  const frozen = await snapshot(page);
  await page.clock.runFor(1000);
  expect(await snapshot(page)).toEqual(frozen);
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-stage-supply.png") });
  await page.locator(".reward-card").last().scrollIntoViewIfNeeded();
  const lastCard = await page.locator(".reward-card").last().boundingBox();
  if (!lastCard) throw new Error("Missing last supply card");
  expect(lastCard.y).toBeGreaterThanOrEqual(modal.y);
  expect(lastCard.y + lastCard.height).toBeLessThanOrEqual(modal.y + modal.height);
  await page.locator('[data-card="bloodpact"]').tap();
  await page.clock.runFor(100);
  const next = await snapshot(page);
  expect(next.stageIndex).toBe(1);
  expect(next.player.hp).toBe(75);
  expect(next.player.shield).toBe(24);
  expect(next.stacks).toEqual({ overload: 1, fuse: 1, bloodpact: 1 });
  expect(next.manualTargetId).toBeNull();
  await expect(page.locator("#stage-label")).toContainText("棱镜回廊");
  await page.locator('[data-synergy="blast"] summary').tap();
  await expect(page.locator('[data-synergy="blast"] .synergy-details')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-synergy.png") });
});

test("320px final victory keeps the endless action visible and accepts a native tap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await bootFixture(
    page,
    `
    world.stageIndex = 3;
    world.clearedStages = 3;
    world.elapsed = 250;
    for (const id of ["overload", "fuse", "bloodpact"]) applyCard(id, world.player, world.stacks);
    enemy({ kind: "boss", hp: 1 });
  `,
  );
  await page.clock.runFor(1000);
  await expect(page.locator(".reward-card.training")).toHaveCount(2);
  await page.locator(".reward-card.training").first().tap();
  await page.clock.runFor(100);
  await expect(page.getByRole("heading", { name: "终局，由你改写" })).toBeVisible();
  const frame = await page.locator(".arena-frame").boundingBox();
  const modal = await page.locator(".victory-modal").boundingBox();
  if (!frame || !modal) throw new Error("Missing ending bounds");
  expect(modal.y).toBeGreaterThanOrEqual(frame.y);
  expect(modal.y + modal.height).toBeLessThanOrEqual(frame.y + frame.height);
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-campaign-victory.png") });
  await page.getByRole("button", { name: "继续无尽 · 保留构筑", exact: true }).tap();
  await page.clock.runFor(100);
  const state = await snapshot(page);
  expect(state.endless).toBe(true);
  expect(state.stageIndex).toBe(4);
  expect(state.stacks).toEqual({ overload: 1, fuse: 1, bloodpact: 1 });
  expect(state.stageElapsed).toBeLessThan(0.3);
});

test("320px touch can inspect all ten families and select a nine-layer critical upgrade", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await bootFixture(
    page,
    `
    world.player.cooldown = 100;
    for (let index = 0; index < 6; index++) applyCard("keen", world.player, world.stacks);
    for (let index = 0; index < 2; index++) applyCard("lethal", world.player, world.stacks);
    world.reward = {token: 100, choices: ["lethal", "chill", "edict"], source: "chest"};
    world.state.transition("RewardSelection");
  `,
  );
  await expect(page.locator('[data-card="lethal"]')).toContainText("8 → 9/9 · 大质变");
  await page.locator('[data-card="lethal"]').tap();
  await page.clock.runFor(100);
  await expect(page.locator("#synergies details")).toHaveCount(10);
  await expect(page.locator('[data-synergy="precision"]')).toContainText("9/9 · 大质变");
  await page.locator('[data-synergy="dominion"] summary').tap();
  await expect(page.locator('[data-synergy="dominion"] .synergy-details')).toContainText("9 层");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-ten-families.png") });
});

test("320px endless random supplies fit and grant three cards followed by the boss card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await bootFixture(
    page,
    `
    world.stageIndex = 4;
    // A living 1-HP boss has already consumed its health-threshold skills.
    enemy({ kind: "boss", hp: 1, skillsUsed: 3 });
  `,
  );
  await page.clock.runFor(1000);
  for (let supply = 1; supply <= 3; supply++) {
    await expect(page.getByRole("heading", { name: `无尽随机补给 ${supply} / 3` })).toBeVisible();
    const frame = await page.locator(".arena-frame").boundingBox();
    const modal = await page.locator(".reward-modal").boundingBox();
    if (!frame || !modal) throw new Error("Missing random supply bounds");
    expect(modal.y).toBeGreaterThanOrEqual(frame.y);
    expect(modal.y + modal.height).toBeLessThanOrEqual(frame.y + frame.height);
    const frozen = await snapshot(page);
    await page.clock.runFor(500);
    expect(await snapshot(page)).toEqual(frozen);
    if (supply === 1)
      await page.screenshot({ path: join(tmpdir(), "destiny-mobile-endless-supply.png") });
    await page.locator(".reward-card").first().tap();
    await page.clock.runFor(100);
  }
  await expect(page.getByRole("heading", { name: "第 5 关突破" })).toBeVisible();
  await expect(page.locator(".reward-modal")).toContainText("两项锻体与一张残响三选一");
  await page.locator(".reward-card").first().tap();
  await page.clock.runFor(100);
  const next = await snapshot(page);
  expect(next.stageIndex).toBe(5);
  expect(
    [...Object.values(next.stacks), ...Object.values(next.trainingStacks)].reduce(
      (a, b) => a + b,
      0,
    ),
  ).toBe(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("320px poison and taunt labels remain readable and override native touch priority", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await bootFixture(
    page,
    `
    world.stageIndex = 4;
    world.stageSupplies = 3;
    world.player.cooldown = 100;
    world.player.poisonTime = 3;
    enemy({ kind: "tank", x: 80, defenseX: 80, y: 280, arrived: false, speed: 0 });
    enemy({ kind: "wizard", x: 360, defenseX: 360, y: 240, speed: 0 });
  `,
  );
  const wizard = (await snapshot(page)).enemies.find((item) => item.kind === "wizard");
  if (!wizard) throw new Error("No wizard");
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await clickTarget(page, wizard.x, wizard.y, true);
  await page.clock.runFor(200);
  const state = await snapshot(page);
  expect(state.manualTargetId).toBe(wizard.id);
  expect(state.enemies.find((item) => item.id === state.targetId)?.kind).toBe("wizard");
  await expect(page.locator("#status-effects")).toContainText("中毒");
  await expect(page.locator("#status-effects")).toContainText("攻速 -30%");
  await expect(page.locator("#target-label")).toContainText("攻击区优先");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-endless-status.png") });
});

test("mixed boss training reward settles before victory and survives endless", async ({
  page,
}, info) => {
  await trainingRewardFlow(page, info.project.name, true);
});

test("full endless formation shows capacity and fusion star upgrades", async ({ page }, info) => {
  await crowdFusionFlow(page, info.project.name, true);
});
