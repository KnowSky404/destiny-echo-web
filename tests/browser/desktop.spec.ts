import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
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

const runtimeErrors = new WeakMap<Page, string[]>();
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
  await expectPlayerAt(page, 225, 736);
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
  await expectPlayerAt(page, 225, 736);
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
  test(`a natural ${strategy} run reaches ${strategy === "offense" ? "victory" : "failure"} and restarts cleanly`, async ({
    page,
    browserName,
  }, info) => {
    test.skip(
      browserName !== "chromium",
      "Full natural runs execute once; every engine verifies combat, input, rewards and endings.",
    );
    test.setTimeout(180_000);
    await boot(page);
    await page.clock.setSystemTime(new Date(strategy === "offense" ? 3 : 1));
    await start(page);
    for (let second = 0; second < 95; second++) {
      const state = await snapshot(page);
      if (state.phase === "GameOver" || state.phase === "Victory") break;
      if (state.phase === "RewardSelection" && state.reward) {
        const priorities =
          strategy === "defensive"
            ? ["vitality", "ward", "piercing", "execution", "haste", "overload", "multishot"]
            : state.player.hp < 35
              ? ["vitality", "ward", "multishot", "overload", "haste", "execution", "piercing"]
              : ["multishot", "overload", "haste", "execution", "piercing", "vitality", "ward"];
        const id = priorities.find((id) => state.reward?.choices.includes(id));
        if (!id) throw new Error("Missing reward");
        await page.locator(`[data-card="${id}"]`).click();
      }
      await page.clock.runFor(1000);
    }
    const result = await snapshot(page);
    expect(result.phase).toBe(strategy === "offense" ? "Victory" : "GameOver");
    expect(result.metrics.regularAttacks).toBeGreaterThan(0);
    expect(result.player.hp).toBeLessThan(100);
    expect(result.kills).toBeGreaterThan(0);
    if (strategy === "offense") {
      expect(result.elapsed).toBeGreaterThanOrEqual(60);
      expect(result.openedChests).toBe(5);
      expect(result.metrics.bossInterrupts).toBeGreaterThan(0);
    }
    await expect(page.getByRole("button", { name: "再次共鸣" })).toBeVisible();
    await page.screenshot({
      path: join(tmpdir(), `destiny-${info.project.name}-${strategy}-result.png`),
    });
    await page.getByRole("button", { name: "再次共鸣" }).click();
    await page.clock.runFor(100);
    const fresh = await snapshot(page);
    expect(fresh.phase).toBe("Playing");
    expect(fresh.elapsed).toBeLessThan(0.3);
    expect(fresh.player.hp).toBe(100);
    expect(fresh.player.stats.damage).toBe(12);
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
  expect(failures).toEqual([]);
});

test("a near-defeated boss resolves through real homing fire to victory and restart", async ({
  page,
}, info) => {
  await bootFixture(page, `world.elapsed = 68; enemy({ kind: "boss", hp: 12 });`);
  await page.clock.runFor(2000);
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
  await expectPlayerAt(page, 225, 736);
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
  expect(state.hostileShots.length).toBeGreaterThan(0);
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
