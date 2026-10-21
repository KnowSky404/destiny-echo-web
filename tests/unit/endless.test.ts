import { describe, expect, test } from "bun:test";
import { ENEMIES } from "../../src/data/enemies";
import { STAGES, stageAt } from "../../src/data/stages";
import { CONFIG } from "../../src/game/config";
import { World } from "../../src/game/world";
import { enemy, tick } from "./helpers";

function passive(index = 0) {
  const world = new World();
  world.start(8);
  world.stageIndex = index;
  world.player.cooldown = 1000;
  world.player.shield = 1000000;
  return world;
}

describe("ranged enemies and mixed boss encounters", () => {
  test("hexers release real projectiles before reaching their stopping point", () => {
    const world = passive();
    world.bossSpawned = true;
    const caster = enemy(world, { kind: "hexer", defenseY: 340 });
    tick(world, 3);
    expect(caster.arrived).toBe(false);
    expect(caster.stage).toBe("Attacking");
    expect(world.regularAttacks).toBeGreaterThan(0);
    expect(world.hostileShots.items.some((shot) => shot.active)).toBe(true);
    tick(world, 3);
    expect(world.player.shield).toBeLessThan(1000000);
  });

  test("melee attacks wait for arrival, then directly damage the defense", () => {
    const world = passive();
    world.bossSpawned = true;
    const melee = enemy(world, { x: 225, defenseX: 225 });
    tick(world, 3);
    expect(world.regularAttacks).toBe(0);
    tick(world, 4.5);
    expect(melee.arrived).toBe(true);
    expect(world.regularAttacks).toBe(1);
    expect(world.hostileShots.items.some((shot) => shot.active)).toBe(false);
    expect(world.player.shield).toBe(1000000 - ENEMIES.wisp.damage);
  });

  test("all authored and endless bosses enter with both roles and replenish casualties", () => {
    for (let index = 0; index < 8; index++) {
      const world = passive(index);
      world.stageElapsed = world.stage.bossAt;
      tick(world, 0.02);
      expect(world.boss).toBeDefined();
      const entourage = () =>
        world.enemies.items.filter((item) => item.active && item.kind !== "boss");
      expect(entourage().some((item) => item.kind === "hexer")).toBe(true);
      expect(entourage().some((item) => ENEMIES[item.kind].attackStyle === "melee")).toBe(true);
      expect(entourage()).toHaveLength(index >= STAGES.length ? 4 : 2);
      for (const item of entourage()) item.active = false;
      tick(world, world.stage.supportInterval + 0.1);
      expect(entourage().some((item) => item.kind === "hexer")).toBe(true);
      expect(entourage().some((item) => ENEMIES[item.kind].attackStyle === "melee")).toBe(true);
    }
  });

  test("boss gold charges coexist with genuine escort attacks", () => {
    const world = passive();
    world.stageElapsed = world.stage.bossAt;
    for (let index = 0; index < 1600 && !(world.boss && world.boss.telegraph > 0); index++)
      world.update(CONFIG.fixedStep);
    expect(world.boss?.telegraph).toBeGreaterThan(0);
    const before = world.regularAttacks;
    tick(world, 1.6);
    expect(world.boss?.telegraph).toBeGreaterThan(0);
    expect(world.regularAttacks).toBeGreaterThan(before);
    expect(world.bossSpecials).toBe(0);
  });

  test("endless successful regular spawns follow one ranged to three melee", () => {
    const world = passive(4);
    tick(world, 23);
    expect(world.stageSpawned).toBe(CONFIG.limits.enemies);
    expect(world.rangedSpawns).toBe(CONFIG.limits.enemies / 4);
    expect(world.meleeSpawns).toBe(world.rangedSpawns * 3);
    expect(
      new Set(world.enemies.items.filter((item) => item.active).map((item) => item.slot)).size,
    ).toBe(CONFIG.limits.enemies);
  });
});

describe("compounding endless population and health", () => {
  test("first three endless stages grow 30%, then 10%, without theme resets", () => {
    const finale = stageAt(3);
    let previous = finale;
    for (let depth = 1; depth <= 40; depth++) {
      const stage = stageAt(3 + depth);
      const rate = depth <= 3 ? 1.3 : 1.1;
      expect(stage.health / previous.health).toBeCloseTo(rate, 9);
      expect(stage.bossHp / previous.bossHp).toBeCloseTo(rate, 3);
      expect(stage.enemyCount).toBeGreaterThan(previous.enemyCount);
      expect(stage.enemyCount).toBe(Math.ceil(finale.enemyCount * stage.growth));
      expect(stage.spawnInterval).toBeLessThan(previous.spawnInterval);
      expect(stage.spawnInterval).toBeGreaterThan(0);
      expect(stage.damage).toBeLessThanOrEqual(4);
      expect(stage.rangedEvery).toBe(4);
      expect(stage.sentinelChance).toBe(finale.sentinelChance);
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
    for (let index = 4; index < 9; index++) {
      const world = passive(index);
      // Fixture clears targets to observe admission throughput independently of DPS.
      for (let frame = 0; frame < 120 * (world.stage.bossAt - 0.1); frame++) {
        for (const item of world.enemies.items) item.active = false;
        world.update(CONFIG.fixedStep);
      }
      expect(world.stageSpawned).toBe(world.stage.enemyCount);
      expect(world.stageSpawned).toBeGreaterThan(previous);
      expect(Math.abs(world.meleeSpawns - world.rangedSpawns * 3)).toBeLessThanOrEqual(3);
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
