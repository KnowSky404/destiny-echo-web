import { describe, expect, test } from "bun:test";
import { CAMPAIGN_KINDS, ENDLESS_KINDS, ENEMIES } from "../../src/data/enemies";
import { stageAt } from "../../src/data/stages";
import { CONFIG } from "../../src/game/config";
import { World } from "../../src/game/world";
import { enemy, hit } from "./helpers";

function passive(index = 0) {
  const world = new World();
  world.start(8);
  world.stageIndex = index;
  world.player.cooldown = 1000;
  world.player.shield = 1000000;
  return world;
}

function advance(world: World, seconds: number) {
  for (let frame = 0; frame < Math.round(seconds * 120); frame++) {
    while (world.reward?.source === "supply") {
      const reward = world.reward;
      world.chooseCard(reward.choices[0] ?? "", reward.token);
    }
    world.update(CONFIG.fixedStep);
  }
}

function expectBalanced(world: World) {
  const kinds = world.endless ? ENDLESS_KINDS : CAMPAIGN_KINDS;
  const counts = kinds.map((kind) => world.stageKindSpawns[kind]);
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
}

describe("ranged enemies and mixed boss encounters", () => {
  test("hexers release real projectiles before reaching their stopping point", () => {
    const world = passive();
    world.bossSpawned = true;
    const caster = enemy(world, { kind: "hexer", defenseY: 340 });
    advance(world, 3);
    expect(caster.arrived).toBe(false);
    expect(caster.stage).toBe("Attacking");
    expect(world.regularAttacks).toBeGreaterThan(0);
    expect(world.hostileShots.items.some((shot) => shot.active)).toBe(true);
    advance(world, 3);
    expect(world.player.shield).toBeLessThan(1000000);
  });

  test("melee attacks wait for arrival, then directly damage the defense", () => {
    const world = passive();
    world.bossSpawned = true;
    const melee = enemy(world, { x: 225, defenseX: 225 });
    advance(world, 3);
    expect(world.regularAttacks).toBe(0);
    advance(world, 4.5);
    expect(melee.arrived).toBe(true);
    expect(world.regularAttacks).toBe(1);
    expect(world.hostileShots.items.some((shot) => shot.active)).toBe(false);
    expect(world.player.shield).toBe(1000000 - ENEMIES.wisp.damage);
  });

  test("all authored and endless bosses enter with both roles and replenish casualties", () => {
    for (let index = 0; index < 8; index++) {
      const world = passive(index);
      world.stageElapsed = world.stage.bossAt;
      advance(world, 0.1);
      expect(world.boss).toBeDefined();
      const entourage = () =>
        world.enemies.items.filter((item) => item.active && item.kind !== "boss");
      expect(entourage().some((item) => item.kind === (world.endless ? "wizard" : "hexer"))).toBe(
        true,
      );
      expect(entourage().some((item) => ENEMIES[item.kind].attackStyle === "melee")).toBe(true);
      expect(entourage().length).toBeGreaterThanOrEqual(3);
      expect(entourage().length).toBeLessThanOrEqual(
        Math.min(world.stage.supportCount, world.stage.maxEnemies - 1),
      );
      for (const item of entourage()) item.active = false;
      advance(world, world.stage.supportInterval + 0.1);
      expect(entourage().some((item) => item.kind === (world.endless ? "wizard" : "hexer"))).toBe(
        true,
      );
      expect(entourage().some((item) => ENEMIES[item.kind].attackStyle === "melee")).toBe(true);
    }
  });

  test("boss reinforcements keep exceeding the ordinary quota while the boss lives", () => {
    for (const index of [0, 3, 4, 6]) {
      const world = passive(index);
      world.stageElapsed = world.stage.bossAt;
      world.stageSpawned = world.stage.enemyCount;
      advance(world, 0.1);
      const bossId = world.boss?.id;
      for (let batch = 0; batch < 15; batch++) {
        for (const item of world.enemies.items) if (item.kind !== "boss") item.active = false;
        const before = world.rangedSpawns + world.meleeSpawns;
        advance(world, world.stage.supportInterval + 0.01);
        expect(world.phase).toBe("Playing");
        expect(world.boss?.id).toBe(bossId);
        expect(world.rangedSpawns + world.meleeSpawns).toBeGreaterThan(before);
      }
      expect(world.stageSpawned + world.rangedSpawns + world.meleeSpawns).toBeGreaterThan(
        world.stage.enemyCount,
      );
      expectBalanced(world);
      expect(world.enemies.items.length).toBeLessThanOrEqual(CONFIG.limits.enemies);
    }
  });

  test("boss death clears living escorts immediately and stops every combat schedule", () => {
    for (const index of [0, 3, 4]) {
      const world = passive(index);
      world.stageElapsed = world.stage.bossAt;
      advance(world, 10);
      expect(world.enemies.items.some((item) => item.active && item.kind !== "boss")).toBe(true);
      expect(world.hostileShots.items.some((item) => item.active)).toBe(true);
      const boss = world.boss;
      if (!boss) throw new Error("No boss");
      hit(world, boss, boss.maxHp + 1);
      advance(world, 0.1);
      expect(world.phase).toBe("StageClear");
      expect(world.snapshot().enemies).toEqual([]);
      expect(world.snapshot().hostileShots).toEqual([]);
      expect(world.snapshot().shots).toEqual([]);
      expect(world.clearedStages).toBe(1);
      const cleared = world.snapshot();
      advance(world, 30);
      expect(world.snapshot()).toEqual(cleared);
    }
  });

  test("boss gold charges coexist with genuine escort attacks", () => {
    const world = passive();
    world.stageElapsed = world.stage.bossAt;
    for (let index = 0; index < 1600 && !(world.boss && world.boss.telegraph > 0); index++)
      world.update(CONFIG.fixedStep);
    expect(world.boss?.telegraph).toBeGreaterThan(0);
    const before = world.regularAttacks;
    advance(world, 1.6);
    expect(world.boss?.telegraph).toBeGreaterThan(0);
    expect(world.regularAttacks).toBeGreaterThan(before);
    expect(world.bossSpecials).toBe(0);
  });

  test("endless successful admissions balance wisp, tank and wizard equally", () => {
    const world = passive(4);
    advance(world, 23);
    expect(world.stageSpawned).toBeGreaterThanOrEqual(24);
    expect(world.enemies.items.filter((item) => item.active).length).toBeLessThanOrEqual(24);
    expectBalanced(world);
    expect(world.stageKindSpawns.tank).toBeGreaterThan(0);
    expect(world.stageKindSpawns.wizard).toBeGreaterThan(0);
    expect(
      new Set(world.enemies.items.filter((item) => item.active).map((item) => item.slot)).size,
    ).toBe(world.enemies.items.filter((item) => item.active).length);
  });
});

describe("bounded endless population and growing attributes", () => {
  test("endless health grows while population and escorts plateau without theme resets", () => {
    const finale = stageAt(3);
    let previous = finale;
    for (let depth = 1; depth <= 40; depth++) {
      const stage = stageAt(3 + depth);
      expect(stage.health / previous.health).toBeCloseTo(2, 9);
      expect(stage.bossHp / previous.bossHp).toBeCloseTo(2, 3);
      expect(stage.enemyCount).toBeGreaterThanOrEqual(previous.enemyCount);
      expect(stage.enemyCount).toBe(Math.min(360, Math.ceil(finale.enemyCount * stage.growth)));
      expect(stage.supportCount).toBe(12);
      expect(stage.populationScale).toBeGreaterThan(previous.populationScale);
      expect(stage.supportCount).toBeLessThanOrEqual(CONFIG.endless.escortCap);
      expect(stage.supportInterval).toBe(2);
      expect(stage.spawnInterval).toBeLessThanOrEqual(previous.spawnInterval);
      expect(stage.spawnInterval).toBeGreaterThan(0);
      expect(stage.damage).toBeLessThanOrEqual(4);
      expect(stage.attackPolicy).toEqual(finale.attackPolicy);
      expect(stage.bossFan).toBe(finale.bossFan);
      expect(stage.bossInterval).toBe(finale.bossInterval);
      expect(stage.specialDamage).toBe(finale.specialDamage);
      expect(stage.chargeTime).toBe(finale.chargeTime);
      expect(stage.name).toContain("无尽");
      previous = stage;
    }
  });

  test("the larger configured populations are actually admitted when enemies are cleared", () => {
    let previous = 0;
    for (let index = 0; index < 9; index++) {
      const world = passive(index);
      // Fixture clears targets to observe admission throughput independently of DPS.
      for (let frame = 0; frame < 120 * (world.stage.bossAt - CONFIG.fixedStep); frame++) {
        for (const item of world.enemies.items) item.active = false;
        advance(world, CONFIG.fixedStep);
      }
      expect(world.stageSpawned).toBe(world.stage.enemyCount);
      expect(world.stageSpawned).toBeGreaterThanOrEqual(previous);
      if (world.endless) expectBalanced(world);
      previous = world.stageSpawned;
    }
  });

  test("invalid stage indices are rejected and extreme depths keep finite budgets", () => {
    for (const index of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => stageAt(index)).toThrow();
    const deep = stageAt(10000);
    expect(Number.isFinite(deep.health)).toBe(true);
    expect(Number.isFinite(deep.bossHp)).toBe(true);
    expect(Number.isFinite(deep.enemyCount)).toBe(true);
  });
});
