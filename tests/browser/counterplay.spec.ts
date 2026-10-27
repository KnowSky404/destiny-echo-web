import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootFixture, clickTarget, snapshot } from "./helpers";

type CounterplayState = {
  threshold: number;
  lifestealCeiling: number | null;
  admissionCount: number;
  fallbackHelp: string[];
  descriptions: string[];
  leaders: {
    id: number;
    kind: string;
    x: number;
    y: number;
    castId: number;
    telegraph: number;
    opening: number;
    confirmed: boolean;
    hits: number;
    damage: number;
    hp: number;
  }[];
};

declare global {
  interface Window {
    __COUNTERPLAY_READ__?: () => CounterplayState;
    __COUNTERPLAY_HIT__?: (id: number, count: number, primary: boolean) => void;
    __COUNTERPLAY_SANCTUARY__?: (seconds: number) => void;
    __COUNTERPLAY_CARD__?: (id: string) => void;
  }
}

// Browser plugin not available. The flow under test is native depth-4 paired
// leaders -> a fresh pointer/touch/F selection during each warning -> accurate
// forming, armed-hit and exposed UI, including paused and narrow layouts.
// Only encounter entry/positions and collision probes are fixtures. Admissions,
// first preparation, warnings, cast IDs, target input, interruption and recovery
// all run through the production World and scene.
async function pairedLeaders(page: Page, width: number) {
  await bootFixture(
    page,
    `
    const { createEncounterPlan, createEncounterState } =
      await import("/src/game/systems/encounter.ts");
    const { initShell } = await import("/src/i18n/shell.ts");
    const { rewardDescription } = await import("/src/i18n/content.ts");
    const fallbackHelp = ["targetingHelp", "rewardsHelp"].map(key =>
      document.querySelector('[data-i18n="' + key + '"]').textContent);
    initShell();
    world.stageIndex = 7;
    world.bossSpawned = false;
    world.stageSupplies = 0;
    world.encounterStageIndex = world.stageIndex;
    world.encounterState = {
      ...createEncounterState(createEncounterPlan(4, world.stage.enemyCount)), index: 1,
    };
    world.player.cooldown = 1000;
    world.player.shield = 1000000;
    world.supportCooldown = 1000;
    world.spawnCooldown = 0;
    world.update(1 / 60);
    const leaders = world.enemies.items.filter(enemy => enemy.active && enemy.role === "elite");
    if (leaders.length !== 2) throw new Error("Native depth-4 pair was not admitted");
    for (const [index, target] of leaders.entries()) {
      const x = world.arena.width * (index ? 0.65 : 0.35);
      Object.assign(target, { x, y: 320, defenseX: x, defenseY: 320,
        spawnX: x, spawnY: 320, speed: 0, arrived: true, formation: false,
        shotCooldown: 1000 });
    }
    for (const target of world.enemies.items.filter(enemy => enemy.active && enemy.role === "minion"))
      Object.assign(target, { speed: 0, shotCooldown: 1000, skillCooldown: 1000 });
    window.__COUNTERPLAY_READ__ = () => ({
      threshold: world.interruptHitTarget,
      lifestealCeiling: world.lifestealRecoveryPerSecond,
      admissionCount: world.encounterState.admittedLeaders,
      fallbackHelp,
      descriptions: ["chill", "impact", "leech", "giant-slayer"].map(id => rewardDescription(id)),
      leaders: leaders.map(target => ({ id: target.id, kind: target.kind,
        x: target.x, y: target.y, castId: target.castId, telegraph: target.telegraph,
        opening: world.interruptOpeningRemaining(target),
        confirmed: world.counterFocusConfirmed(target), hits: target.interruptHits,
        damage: target.interruptDamage, hp: target.hp,
      })),
    });
    window.__COUNTERPLAY_HIT__ = (id, count, primary) => {
      const target = leaders.find(enemy => enemy.id === id);
      if (!target) throw new Error("Unknown counterplay leader");
      for (let index = 0; index < count; index++) {
        const shot = world.shots.acquire();
        if (!shot) throw new Error("Counterplay projectile pool exhausted");
        Object.assign(shot, { x: target.x, y: target.y, previousX: target.x,
          previousY: target.y, vx: 0, vy: 0, damage: 1, radius: 4,
          lifetime: 1, hitsLeft: 1, targetId: target.id, primary, critical: false });
        shot.hitIds.clear();
      }
    };
    window.__COUNTERPLAY_SANCTUARY__ = seconds => { world.sanctuaryRemaining = seconds; };
    window.__COUNTERPLAY_CARD__ = id => {
      if (!applyCard(id, world.player, world.stacks)) throw new Error("Illegal counterplay card");
    };
    `,
    width,
  );
}

async function read(page: Page) {
  return page.evaluate(() => {
    if (!window.__COUNTERPLAY_READ__) throw new Error("Missing counterplay diagnostics");
    return window.__COUNTERPLAY_READ__();
  });
}

async function leader(page: Page, id: number) {
  const result = (await read(page)).leaders.find((enemy) => enemy.id === id);
  if (!result) throw new Error("Missing paired leader");
  return result;
}

async function waitForCast(page: Page, id: number, afterCast = 0) {
  for (let step = 0; step < 100; step++) {
    const state = await leader(page, id);
    if (state.castId > afterCast && state.telegraph > 0) return state;
    await page.clock.runFor(100);
  }
  throw new Error("Native leader did not begin its next warning");
}

async function hit(page: Page, id: number, count = 1, primary = true) {
  await page.evaluate(
    ({ id, count, primary }) => window.__COUNTERPLAY_HIT__?.(id, count, primary),
    { id, count, primary },
  );
  await page.clock.runFor(100);
}

async function openWindow(page: Page, id: number) {
  const state = await leader(page, id);
  await page.clock.runFor(Math.ceil(state.opening * 1000) + 100);
  expect((await leader(page, id)).opening).toBe(0);
}

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("native depth-4 pair needs a fresh F or touch confirmation for every warning", async ({
  page,
}, info) => {
  const touch = info.project.name === "mobile-chromium";
  if (touch) await page.setViewportSize({ width: 320, height: 720 });
  await pairedLeaders(page, touch ? 450 : 1600);
  const initial = await read(page);
  expect(initial.admissionCount).toBe(2);
  expect(initial.leaders.map((enemy) => enemy.kind).sort()).toEqual(["tank", "wizard"]);
  expect((await snapshot(page)).stageSupplies).toBe(0);
  // Select the second admission before its warning: the sticky lock must not
  // silently confirm the first cast, and its health must own the top HUD.
  const target = initial.leaders[1];
  if (!target) throw new Error("Missing second native leader");
  await clickTarget(page, target.x, target.y, touch);
  await page.clock.runFor(100);
  await expect(page.locator("#boss-health")).toHaveAttribute("data-enemy-id", String(target.id));
  const firstCast = await waitForCast(page, target.id);
  expect(firstCast.opening).toBeGreaterThan(0);
  expect(firstCast.confirmed).toBe(false);
  await expect(page.locator("#boss-health")).toHaveAttribute("data-counterplay", "forming");
  await expect(page.locator("#boss-health")).toContainText("起势");
  await hit(page, target.id, 2);
  expect((await leader(page, target.id)).hits).toBe(0);
  expect((await leader(page, target.id)).damage).toBe(0);
  if (touch) await clickTarget(page, target.x, target.y, true);
  else await page.locator("canvas").press("f");
  expect((await leader(page, target.id)).confirmed).toBe(true);
  await hit(page, target.id, 2);
  expect((await leader(page, target.id)).hits).toBe(0);
  await openWindow(page, target.id);
  await hit(page, target.id);
  expect((await leader(page, target.id)).hits).toBe(1);
  await expect(page.locator("#boss-health")).toHaveAttribute("data-counterplay", "confirmed");
  await expect(page.locator("#target-label")).toContainText(`主弹 1/${initial.threshold}`);
  await expect(page.locator("#boss-health")).toContainText("本次已确认");
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-counterplay-armed.png`),
  });

  const next = await waitForCast(page, target.id, firstCast.castId);
  expect(next.confirmed).toBe(false);
  expect(next.hits).toBe(0);
  expect((await snapshot(page)).manualTargetId).toBe(target.id);
  await openWindow(page, target.id);
  await expect(page.locator("#boss-health")).toHaveAttribute("data-counterplay", "needs-focus");
  await expect(page.locator("#boss-health")).toContainText("重选 / F确认");
  const before = await leader(page, target.id);
  await hit(page, target.id, 2);
  const unconfirmed = await leader(page, target.id);
  expect(unconfirmed.hp).toBeLessThan(before.hp);
  expect(unconfirmed.damage).toBeGreaterThan(0);
  expect(unconfirmed.hits).toBe(0);
  if (touch) await clickTarget(page, target.x, target.y, true);
  else await page.locator("canvas").press("f");
  await hit(page, target.id, initial.threshold);
  const interrupted = await leader(page, target.id);
  expect(interrupted.telegraph).toBe(0);
  expect((await snapshot(page)).metrics.bossInterrupts).toBeGreaterThan(0);
  await expect(page.locator("#boss-health")).toContainText("弱点暴露");
  await expect(page.locator("#boss-health")).toHaveAttribute("data-counterplay", "exposed");
});

test("F obeys keyboard filtering and pause while Sanctuary freezes a visible forming window", async ({
  page,
}, info) => {
  await pairedLeaders(page, info.project.name === "mobile-chromium" ? 450 : 1600);
  const target = (await read(page)).leaders[0];
  if (!target) throw new Error("Missing native leader");
  await clickTarget(page, target.x, target.y, info.project.name === "mobile-chromium");
  await waitForCast(page, target.id);
  const canvas = page.locator("canvas");
  for (const extra of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }])
    await canvas.dispatchEvent("keydown", { key: "f", ...extra });
  expect((await leader(page, target.id)).confirmed).toBe(false);
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  const paused = await snapshot(page);
  await canvas.dispatchEvent("keydown", { key: "f" });
  await page.clock.runFor(500);
  expect(await snapshot(page)).toEqual(paused);
  expect((await leader(page, target.id)).confirmed).toBe(false);
  await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  await page.evaluate(() => window.__COUNTERPLAY_SANCTUARY__?.(0.8));
  const frozen = await leader(page, target.id);
  await page.clock.runFor(400);
  expect((await leader(page, target.id)).telegraph).toBe(frozen.telegraph);
  expect((await leader(page, target.id)).opening).toBe(frozen.opening);
  await expect(page.locator("#status-effects")).toContainText("遗世庇护");
  await canvas.focus();
  await canvas.press("f");
  expect((await leader(page, target.id)).confirmed).toBe(true);
  await hit(page, target.id, 2);
  expect((await leader(page, target.id)).hits).toBe(0);
  await page.clock.runFor(900);
  expect((await leader(page, target.id)).telegraph).toBeLessThan(frozen.telegraph);
  // Existing auto and cycle shortcuts remain available after adding F.
  await canvas.press("c");
  expect((await snapshot(page)).manualTargetId).toBeNull();
  await canvas.press("t");
  expect((await snapshot(page)).manualTargetId).not.toBeNull();
});

test("320px reduced-motion warnings and bilingual help expose the same rules and live recovery ceiling", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await pairedLeaders(page, 450);
  const target = (await read(page)).leaders[1];
  if (!target) throw new Error("Missing native leader");
  await clickTarget(page, target.x, target.y, info.project.name === "mobile-chromium");
  await waitForCast(page, target.id);
  await expect(page.locator("canvas")).toHaveAttribute("aria-keyshortcuts", "T C F");
  await expect(page.locator("#boss-health")).toHaveAttribute("data-counterplay", "forming");
  await expect(page.locator("#boss-health")).toContainText("起势");
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-counterplay-forming-320.png`),
  });
  await openWindow(page, target.id);
  await expect(page.locator("#boss-health")).toHaveAttribute("data-counterplay", "needs-focus");
  await expect(page.locator("#boss-health")).toContainText("重选 / F确认");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const visibleText = await page.locator("#boss-health > span").evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const text = range.getBoundingClientRect();
    const canvas = document.querySelector("canvas")?.getBoundingClientRect();
    return (
      !!canvas &&
      text.left >= canvas.left &&
      text.right <= canvas.right &&
      text.top >= canvas.top &&
      text.bottom < canvas.bottom
    );
  });
  expect(visibleText).toBe(true);
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-counterplay-open-320.png`),
  });
  await page.locator("#build-trigger").click();
  await page.clock.runFor(100);
  const ceilingRow = page.locator("#stats > div").filter({ hasText: "吸血回复上限" });
  await expect(ceilingRow).toContainText(
    `${Number(((await read(page)).lifestealCeiling ?? 0).toFixed(2))} HP/s`,
  );
  for (const id of ["leech", "vitality", "recovery"]) {
    const before = (await read(page)).lifestealCeiling ?? 0;
    await page.evaluate((card) => window.__COUNTERPLAY_CARD__?.(card), id);
    await page.clock.runFor(100);
    const ceiling = (await read(page)).lifestealCeiling ?? 0;
    expect(ceiling).toBeGreaterThan(before);
    await expect(ceilingRow).toContainText(`${Number(ceiling.toFixed(2))} HP/s`);
  }
  await page.getByRole("button", { name: "返回战场", exact: true }).click();
  await page.getByRole("button", { name: "玩法说明", exact: true }).click();
  const targeting = page.locator('[data-i18n="targetingHelp"]');
  const rewards = page.locator('[data-i18n="rewardsHelp"]');
  const fallback = (await read(page)).fallbackHelp;
  await expect(targeting).toHaveText(fallback[0] ?? "");
  await expect(rewards).toHaveText(fallback[1] ?? "");
  await expect(targeting).toContainText("F 重新确认当前目标");
  await expect(targeting).toContainText("每次大小首领预警都需重新点选");
  await expect(targeting).toContainText("自动射击照常");
  await expect(rewards).toContainText("HP/s");
  const chineseCards = (await read(page)).descriptions;
  expect(chineseCards[0]).toContain("所有普攻弹");
  expect(chineseCards[1]).toContain("高星普通怪时长按星级减弱");
  expect(chineseCards[2]).toContain("回复上限随自身生命上限和吸血成长");
  expect(chineseCards[3]).toContain("对高星普通怪，该项按星级减弱");
  await page.getByRole("button", { name: "明白了", exact: true }).click();
  await page.getByRole("button", { name: "Switch to English", exact: true }).click();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(targeting).toContainText("F reconfirms the current target");
  await expect(targeting).toContainText("reselect a leader for each warning");
  await expect(targeting).toContainText("Automatic fire continues");
  await expect(rewards).toContainText("two sub-bosses");
  const englishCards = (await read(page)).descriptions;
  expect(englishCards[0]).toContain("All basic projectiles");
  expect(englishCards[1]).toContain("Endless minions");
  expect(englishCards[1]).toContain("divide stun duration by their star count");
  expect(englishCards[2]).toContain("recovery ceiling scales with your maximum HP and lifesteal");
  expect(englishCards[3]).toContain("scales down with a minion's stars");
  await page.getByRole("button", { name: "Got It", exact: true }).click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.clock.runFor(100);
  await expect(page.locator("#stats")).toContainText("Lifesteal recovery ceiling");
  await expect(page.locator('[data-synergy="frost"]')).toContainText("including secondary shots");
  await page.getByRole("button", { name: "Return to Battle", exact: true }).click();
  await page.getByRole("button", { name: "Resume resonance", exact: true }).click();
  await page.clock.runFor(100);
  await expect(page.locator("#boss-health")).toContainText("Reselect / F to confirm");
  await expect(page.locator("#boss-health")).toContainText(
    `Primary 0/${(await read(page)).threshold}`,
  );
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-counterplay-open-en-320.png`),
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
