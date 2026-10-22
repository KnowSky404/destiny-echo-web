import { describe, expect, test } from "bun:test";
import { defaultProfile } from "../../src/data/balance/profile";
import { CARD_BY_ID, drawCards, isFirstStageExcluded } from "../../src/data/cards";
import { ENEMIES } from "../../src/data/enemies";
import { stageAt } from "../../src/data/stages";
import { drawBossRewards, TRAINING_BY_ID } from "../../src/data/training";
import { DESKTOP_WIDTH } from "../../src/game/arena";
import { CONFIG } from "../../src/game/config";
import { seededRandom } from "../../src/game/random";
import { combatStats } from "../../src/game/stats";
import { World } from "../../src/game/world";
import { enemy, hit, tick } from "./helpers";

function arena(width: number = CONFIG.width) {
  // Keep fixed mechanic expectations independent of the calibrated release profile.
  const world = new World(width, defaultProfile());
  world.start(13);
  world.bossSpawned = true;
  world.player.cooldown = 1000;
  return world;
}

describe("first-stage survival restrictions", () => {
  test("every reward source filters all excluded families before epic promotion", () => {
    const world = arena();
    world.stacks.set("overload", 9);
    const later = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      for (const source of ["chest", "supply", "stage"] as const) {
        for (const id of drawCards(world.player, world.stacks, seededRandom(seed), source, 0)) {
          const card = CARD_BY_ID.get(id);
          if (!card) throw new Error("Unknown offered card");
          expect(isFirstStageExcluded(card)).toBe(false);
        }
      }
      const rewards = drawBossRewards(world.player, world.stacks, seededRandom(seed), 0);
      expect(rewards).not.toContain("training-leech");
      for (const id of rewards.filter((id) => CARD_BY_ID.has(id))) {
        const card = CARD_BY_ID.get(id);
        if (!card) throw new Error("Unknown boss card");
        expect(isFirstStageExcluded(card)).toBe(false);
      }
      for (const id of drawCards(world.player, world.stacks, seededRandom(seed), "stage", 1)) {
        const card = CARD_BY_ID.get(id);
        if (!card) throw new Error("Unknown later card");
        later.add(card.synergy);
      }
    }
    for (const family of ["blood", "bastion", "frost", "dominion"])
      expect(later.has(family)).toBe(true);
  });
});

describe("automatic score training", () => {
  test("crossing the boundary grants once without opening or consuming a reward", () => {
    const world = arena();
    world.score = 4899;
    hit(world, enemy(world, { x: 225, y: 300, speed: 0, hp: 1 }), 1);
    expect(world.score).toBe(4999);
    expect(world.scoreTrainings).toBe(0);
    hit(world, enemy(world, { x: 225, y: 300, speed: 0, hp: 1 }), 1);
    expect(world.score).toBe(5099);
    expect(world.scoreTrainings).toBe(1);
    expect([...world.trainingStacks.values()].reduce((a, b) => a + b, 0)).toBe(1);
    expect(world.trainingStacks.has("training-leech")).toBe(false);
    expect(world.phase).toBe("Playing");
    expect(world.reward).toBeNull();
    expect(world.lastScoreTraining).not.toBeNull();
    const before = [...world.trainingStacks];
    tick(world, 1);
    expect([...world.trainingStacks]).toEqual(before);
  });

  test("a boss score bonus crossing several milestones grants each before its normal reward", () => {
    const world = arena();
    world.player.stats.maxHp = 1200;
    world.player.hp = 1200;
    hit(world, enemy(world, { kind: "boss", x: 225, y: 300, speed: 0, hp: 1 }), 1);
    expect(world.score).toBe(15000);
    expect(world.scoreTrainings).toBe(3);
    expect([...world.trainingStacks.values()].reduce((a, b) => a + b, 0)).toBe(3);
    expect(world.phase).toBe("StageClear");
    expect(world.reward?.source).toBe("stage");
    expect(world.stacks.size).toBe(0);
    const reward = world.reward;
    const first = reward?.choices[0];
    if (!reward || !first) throw new Error("Missing boss reward");
    expect(world.chooseCard(first, reward.token)).toBe(true);
    expect(world.scoreTrainings).toBe(3);
    expect(world.stageIndex).toBe(1);
    world.pause();
    world.start(13);
    expect(world.scoreTrainings).toBe(0);
    expect(world.lastScoreTraining).toBeNull();
    expect(world.trainingStacks.size).toBe(0);
  });

  test("capped options are skipped, repeats are allowed, and rewards are deterministic", () => {
    const worlds = [arena(), arena()] as const;
    for (const world of worlds) {
      world.stageIndex = 1;
      world.player.stats.critChance = 0.85;
      world.player.stats.lifesteal = 0.5;
      world.player.stats.interval = 0.08;
      world.score = 99999;
      hit(world, enemy(world, { x: 225, y: 300, speed: 0, hp: 1 }), 1);
      expect(world.scoreTrainings).toBe(20);
      expect(world.trainingStacks.size).toBeLessThanOrEqual(5);
      for (const [id] of world.trainingStacks) expect(TRAINING_BY_ID.has(id)).toBe(true);
      expect(world.trainingStacks.has("training-critical")).toBe(false);
      expect(world.trainingStacks.has("training-leech")).toBe(false);
      expect(world.trainingStacks.has("training-haste")).toBe(false);
    }
    expect([...worlds[0].trainingStacks]).toEqual([...worlds[1].trainingStacks]);
  });
});

test("living campaign and endless runs continue beyond every former deadline", () => {
  for (const index of [0, 1, 2, 3, 4, 9]) {
    const world = arena();
    world.stageIndex = index;
    world.stageSupplies = CONFIG.endless.supplies;
    world.stageElapsed = 10000;
    tick(world, 1);
    expect(world.phase).toBe("Playing");
    expect(world.stageElapsed).toBeGreaterThan(10000);
    world.player.hp = 0;
    tick(world, 0.1);
    expect(world.phase).toBe("GameOver");
  }
});

test("endless damage and preparation/cadence use the agreed multipliers", () => {
  expect(stageAt(4).damage).toBeCloseTo(1.35 * 1.08 * 1.8, 8);
  const world = arena();
  world.stageIndex = 4;
  world.stageSupplies = 3;
  const target = enemy(world, { kind: "wisp", y: 620, arrived: true, speed: 0 });
  tick(world, CONFIG.fixedStep);
  expect(target.preparation).toBeCloseTo(ENEMIES.wisp.preparation * 0.6);
  tick(world, Math.ceil((ENEMIES.wisp.preparation * 0.6) / CONFIG.fixedStep) * CONFIG.fixedStep);
  expect(world.regularAttacks).toBe(1);
  expect(world.damageTaken).toBeCloseTo(ENEMIES.wisp.damage * world.stage.damage);
  expect(target.shotCooldown).toBeCloseTo(ENEMIES.wisp.interval * 0.6, 1);
  expect(world.bossSlamDamage).toBe(180);
});

test("all lifesteal sources and its cap are reduced by 15 percent", () => {
  const world = arena();
  world.player.stats.lifesteal = 0.04;
  world.player.stats.shieldLeech = 0.02;
  world.stacks.set("leech", 3);
  expect(combatStats(world.player, world.stacks).lifesteal).toBeCloseTo((0.04 + 0.05) * 0.85);
  world.player.shield = 1;
  expect(combatStats(world.player, world.stacks).lifesteal).toBeCloseTo(
    (0.04 + 0.05 + 0.02) * 0.85,
  );
  world.player.stats.lifesteal = 1;
  expect(combatStats(world.player, world.stacks).lifesteal).toBeCloseTo(0.425);
});

test("wide worlds spawn across the field and keep fixed position through pause and restart", () => {
  const world = new World(DESKTOP_WIDTH);
  world.start(3);
  tick(world, 4);
  expect(world.player.x).toBe(800);
  expect(world.enemies.items.some((item) => item.active && item.x > 800)).toBe(true);
  const isolated = world.snapshot();
  isolated.arena.width = 450;
  isolated.arena.crowdLanes[0] = -999;
  expect(world.arena.width).toBe(1600);
  expect(world.arena.crowdLanes[0]).toBeGreaterThan(0);
  const before = world.snapshot();
  world.pause();
  tick(world, 1);
  expect(world.elapsed).toBe(before.elapsed);
  world.start(4);
  expect(world.player.x).toBe(800);
  expect(world.arena.width).toBe(1600);
});
