import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { bootFixture, clickTarget, snapshot } from "./helpers";

type LeaderControlState = {
  role: string;
  stunTime: number;
  receivedHits: number;
  primaryHits: number;
  castSkill: string | null;
  telegraph: number;
  initialPatternCooldown: number;
};
declare global {
  interface Window {
    __V2_CC_STATE__?: () => LeaderControlState[];
    __V2_CC_HIT__?: () => void;
  }
}

// Browser plugin not available. Exercise real World actions in the rendered
// Playwright fixture, with the clock stopped between observations.
const mainEncounter = `
  world.stageIndex = 4;
  world.stageSupplies = world.endlessRules.supplies;
  world.encounterStageIndex = world.stageIndex;
  world.encounterState = {
    plan: [{ id: "main", type: "main", kind: "boss" }],
    index: 0, spentBudget: 0, admittedLeaders: 1, initialEscortsRemaining: 0, breakRemaining: 0,
  };
  world.supportCooldown = 1000;
`;

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

test("endless leaders warn promptly and secondary frost respects hostile recovery", async ({
  page,
}, info) => {
  if (info.project.name === "mobile-chromium")
    await page.setViewportSize({ width: 320, height: 720 });
  await bootFixture(
    page,
    `${mainEncounter}
    world.player.cooldown = 1000;
    world.player.shield = 1000000;
    for (const id of ["chill", "chill", "chill", "chill", "frostbite", "frostbite"])
      if (!applyCard(id, world.player, world.stacks)) throw new Error("Illegal frost fixture");
    const leaders = [["boss", "boss", 100], ["tank", "elite", 350]].map(([kind, role, x]) => {
      const target = world.spawnEnemy(kind, x, false, { role, stars: 1 });
      if (!target) throw new Error("Missing native leader");
      const initialPatternCooldown = target.patternCooldown;
      Object.assign(target, { x, y: 300, defenseX: x, defenseY: 300, speed: 0,
        arrived: true, formation: false, hp: 1000000, maxHp: 1000000,
        trainingCredit: 0, attackPolicy: { type: "anywhere" }, shotCooldown: 1000 });
      return { target, initialPatternCooldown };
    });
    window.__V2_CC_STATE__ = () => leaders.map(({target, initialPatternCooldown}) => ({
      role: target.role, stunTime: target.stunTime, receivedHits: target.receivedHits,
      primaryHits: target.primaryHits, castSkill: target.castSkill,
      telegraph: target.telegraph, initialPatternCooldown,
    }));
    window.__V2_CC_HIT__ = () => {
      for (const {target} of leaders) for (let hit = 0; hit < 4; hit++) {
        const shot = world.shots.acquire();
        if (!shot) throw new Error("Missing secondary projectile");
        Object.assign(shot, { x: target.x, y: target.y, previousX: target.x,
          previousY: target.y, vx: 0, vy: 0, damage: 1, radius: 4,
          lifetime: 1, hitsLeft: 1, targetId: target.id, primary: false, critical: false });
        shot.hitIds.clear();
      }
    };
  `,
  );
  const read = () =>
    page.evaluate(() => {
      if (!window.__V2_CC_STATE__) throw new Error("Missing leader observation");
      return window.__V2_CC_STATE__();
    });
  const hit = async () => {
    await page.evaluate(() => window.__V2_CC_HIT__?.());
    await page.clock.runFor(50);
  };
  expect((await read()).map((leader) => leader.initialPatternCooldown)).toEqual([0, 0]);
  await page.clock.runFor(2900);
  for (const leader of await read()) {
    expect(leader.castSkill).not.toBeNull();
    expect(leader.telegraph).toBeGreaterThan(0);
  }
  await expect(page.locator("#boss-health")).toContainText("蓄力");
  await hit();
  const frozen = await read();
  expect(frozen.map((leader) => leader.receivedHits)).toEqual([4, 4]);
  expect(frozen.map((leader) => leader.primaryHits)).toEqual([0, 0]);
  expect(frozen.every((leader) => leader.stunTime > 0)).toBe(true);
  expect((await snapshot(page)).metrics.controlProcs).toBe(2);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-leader-frost.png`) });
  await hit();
  expect((await snapshot(page)).metrics.controlProcs).toBe(2);
  const blocked = await read();
  expect(blocked.every((leader, index) => leader.stunTime < (frozen[index]?.stunTime ?? 0))).toBe(
    true,
  );
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  const paused = await snapshot(page);
  const pausedLeaders = await read();
  await page.clock.runFor(500);
  expect(await snapshot(page)).toEqual(paused);
  expect(await read()).toEqual(pausedLeaders);
  await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  await page.clock.runFor(650);
  await hit();
  expect((await snapshot(page)).metrics.controlProcs).toBe(3);
  const bossReady = await read();
  expect(bossReady[0]?.stunTime).toBeGreaterThan(0);
  expect(bossReady[1]?.stunTime).toBe(0);
  await page.clock.runFor(350);
  await hit();
  expect((await snapshot(page)).metrics.controlProcs).toBe(4);
  const eliteReady = await read();
  expect(eliteReady[0]?.stunTime).toBe(0);
  expect(eliteReady[1]?.stunTime).toBeGreaterThan(0);
  expect(eliteReady.map((leader) => leader.receivedHits)).toEqual([16, 16]);
  expect(eliteReady.map((leader) => leader.primaryHits)).toEqual([0, 0]);
});

test("sub-boss charge becomes a visible weak-point window after focused fire", async ({
  page,
}, info) => {
  const touch = info.project.name === "mobile-chromium";
  const width = touch ? 450 : 1600;
  if (touch) await page.setViewportSize({ width: 320, height: 720 });
  await bootFixture(
    page,
    `${mainEncounter}
    world.player.stats.damage = 2000;
    world.player.cooldown = 0.5;
    enemy({ kind: "tank", role: "elite", x: ${width / 2}, defenseX: ${width / 2}, y: 540, speed: 0,
      stage: "Attacking", hp: 20000, maxHp: 20000, shotCooldown: 1000,
      castSkill: "ward", pendingSkills: [], vulnerableTime: 0, wardTime: 0,
      telegraph: 2.8, interruptRequired: 100, skillCooldown: 1000 });
    `,
    width,
  );
  await expect(page).toHaveTitle("命运残响 · Echoes of Destiny");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#boss-health")).toContainText("小首领");
  await expect(page.locator("#boss-health")).toContainText("打断窗口");
  const enemy = (await snapshot(page)).enemies.find((item) => item.role === "elite");
  if (!enemy) throw new Error("Missing sub-boss fixture");
  await clickTarget(page, enemy.x, enemy.y, touch);
  await page.clock.runFor(800);
  const exposed = (await snapshot(page)).enemies.find((item) => item.id === enemy.id);
  expect(exposed?.telegraph).toBe(0);
  expect(exposed?.vulnerableTime).toBeGreaterThan(0);
  await expect(page.locator("#boss-health")).toContainText("弱点暴露");
  await expect(page.locator("#target-label")).toContainText("小首领");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-elite-exposed.png`) });
});

test("reduced-motion slam keeps its warning and resolves against shields", async ({
  page,
}, info) => {
  const width = info.project.name === "mobile-chromium" ? 450 : 1600;
  if (info.project.name === "mobile-chromium")
    await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await bootFixture(
    page,
    `${mainEncounter}
    world.player.cooldown = 1000;
    world.player.shield = 500;
    enemy({ kind: "boss", role: "boss", x: ${width / 2}, defenseX: ${width / 2}, y: 300, speed: 0,
      stage: "Attacking", hp: 100000, maxHp: 100000, shotCooldown: 1000,
      skillsUsed: 3, castSkill: "slam", pendingSkills: [], vulnerableTime: 0, wardTime: 0,
      telegraph: 1.2, interruptRequired: 10000, patternCooldown: 1000 });
    `,
    width,
  );
  await expect(page.locator("#boss-health")).toContainText("重击蓄力");
  expect((await snapshot(page)).player.hp).toBe(100);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-slam-warning.png`) });
  await page.clock.runFor(1200);
  const released = await snapshot(page);
  expect(released.player.hp).toBe(100);
  expect(released.player.shield).toBeLessThan(500);
  expect(released.effects.some((effect) => effect.kind === "impact")).toBe(true);
  await expect(page.locator("#boss-health")).not.toContainText("重击蓄力");
});

test("last-enemy death lingers before rewards and pauses without advancing combat", async ({
  page,
}, info) => {
  const width = info.project.name === "mobile-chromium" ? 450 : 1600;
  if (info.project.name === "mobile-chromium")
    await page.setViewportSize({ width: 320, height: 720 });
  await bootFixture(
    page,
    `${mainEncounter}
    world.player.stats.damage = 100;
    world.player.cooldown = 0;
    enemy({ kind: "boss", role: "boss", x: ${width / 2}, defenseX: ${width / 2}, y: 600, speed: 0,
      stage: "Attacking", hp: 1, maxHp: 1, shotCooldown: 1000,
      skillsUsed: 3, castSkill: null, pendingSkills: [], vulnerableTime: 0, wardTime: 0 });
    `,
    width,
  );
  await page.clock.runFor(200);
  const aftermath = await snapshot(page);
  expect(aftermath.enemies).toHaveLength(0);
  expect(aftermath.deathEchoes).toHaveLength(1);
  expect(aftermath.clearPresentationRemaining).toBeGreaterThan(0);
  expect(aftermath.phase).toBe("Playing");
  await expect(page.locator("#overlay")).toBeHidden();
  await expect(page.locator("#wave-label")).toContainText("余响消散");
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-death-echo.png`) });
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  const paused = await snapshot(page);
  await page.clock.runFor(1000);
  expect(await snapshot(page)).toEqual(paused);
  await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  await page.clock.runFor(100);
  const resumed = await snapshot(page);
  expect(resumed.elapsed).toBe(aftermath.elapsed);
  expect(resumed.stageElapsed).toBe(aftermath.stageElapsed);
  await page.clock.runFor(900);
  expect((await snapshot(page)).phase).toBe("StageClear");
  await expect(page.locator(".reward-card")).toHaveCount(3);
  await page.locator(".reward-card").first().click();
  await page.clock.runFor(100);
  expect((await snapshot(page)).deathEchoes).toHaveLength(0);
});

test("total score and training credit stay distinct through a language change", async ({
  page,
}, info) => {
  const width = info.project.name === "mobile-chromium" ? 450 : 1600;
  if (info.project.name === "mobile-chromium")
    await page.setViewportSize({ width: 320, height: 720 });
  await bootFixture(
    page,
    `${mainEncounter}
    const { initShell } = await import("/src/i18n/shell.ts");
    initShell();
    world.score = 12345;
    world.trainingScore = 4321;
    world.player.cooldown = 1000;
    enemy({ x: ${width / 2}, defenseX: ${width / 2}, y: 300, speed: 0, hp: 100000, maxHp: 100000, shotCooldown: 1000 });
    `,
    width,
  );
  await expect(page.locator("#score-value")).toHaveText("总分 12,345 分");
  await page.getByRole("button", { name: "本局构筑", exact: true }).click();
  await page.clock.runFor(100);
  await expect(page.locator("#score-progress")).toContainText("锻体阅历 4,321");
  const before = await snapshot(page);
  await page.getByRole("button", { name: "返回战场", exact: true }).click();
  await page.locator("#language-button").click();
  await expect(page.locator("#score-value")).toHaveText("Total 12,345 pts");
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(page.locator("#score-progress")).toContainText("Training XP 4,321");
  expect((await snapshot(page)).trainingScore).toBe(before.trainingScore);
  expect((await snapshot(page)).score).toBe(before.score);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-training-credit-en.png`),
  });
});
