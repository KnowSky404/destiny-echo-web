import { describe, expect, test } from "bun:test";
import { applyCard, CARDS, drawCards } from "../../src/data/cards";
import { SYNERGIES } from "../../src/data/synergies";
import { CONFIG } from "../../src/game/config";
import { seededRandom } from "../../src/game/random";
import { synergyCount, synergyPreview, synergyTier } from "../../src/game/synergies";
import type { Enemy } from "../../src/game/types";
import { World } from "../../src/game/world";
import { enemy, tick } from "./helpers";

function arena(ids: string[] = []): World {
  const world = new World();
  world.start(9);
  world.bossSpawned = true;
  world.player.cooldown = 100;
  for (const id of ids) expect(applyCard(id, world.player, world.stacks)).toBe(true);
  return world;
}

function hit(world: World, target: Enemy, damage = 1) {
  const shot = world.shots.acquire();
  if (!shot) throw new Error("Missing projectile");
  Object.assign(shot, {
    x: target.x,
    y: target.y,
    previousX: target.x,
    previousY: target.y,
    vx: 0,
    vy: 0,
    damage,
    hitsLeft: 1,
    lifetime: 1,
    targetId: target.id,
  });
  shot.hitIds.clear();
  world.update(CONFIG.fixedStep);
}

function incoming(world: World, damage = 10) {
  const shot = world.hostileShots.acquire();
  if (!shot) throw new Error("Missing hostile projectile");
  Object.assign(shot, {
    x: 225,
    y: 736,
    previousX: 225,
    previousY: 736,
    vx: 0,
    vy: 0,
    damage,
    lifetime: 1,
  });
  world.update(CONFIG.fixedStep);
}

describe("distinct-card families and buildable rewards", () => {
  test.each(SYNERGIES)(
    "$name activates at two different cards and transforms at three",
    (family) => {
      const world = arena();
      const ids = CARDS.filter((card) => card.synergy === family.id).map((card) => card.id);
      expect(ids).toHaveLength(3);
      const [first, second, third] = ids;
      if (!first || !second || !third) throw new Error("Incomplete family");
      applyCard(first, world.player, world.stacks);
      applyCard(first, world.player, world.stacks);
      expect(synergyCount(world.stacks, family.id)).toBe(1);
      expect(synergyTier(world.stacks, family.id)).toBe(0);
      expect(synergyPreview(world.stacks, first)).toContain("升级不重复计数");
      expect(synergyPreview(world.stacks, second)).toContain("激活联动");
      applyCard(second, world.player, world.stacks);
      expect(synergyTier(world.stacks, family.id)).toBe(2);
      expect(synergyPreview(world.stacks, third)).toContain("流派质变");
      applyCard(third, world.player, world.stacks);
      expect(synergyTier(world.stacks, family.id)).toBe(3);
    },
  );

  test("offers include a missing family piece and a direct offense option without duplicates", () => {
    const world = arena(["ward"]);
    for (let seed = 0; seed < 30; seed++) {
      const choices = drawCards(world.player, world.stacks, seededRandom(seed));
      expect(choices).toHaveLength(3);
      expect(new Set(choices).size).toBe(3);
      expect(choices.some((id) => ["vitality", "thorns"].includes(id))).toBe(true);
      expect(
        choices.some((id) => ["overload", "haste", "multishot", "fuse", "bloodpact"].includes(id)),
      ).toBe(true);
    }
  });
});

describe("explosions, sacrifice and bounded chain resolution", () => {
  test.each([false, true])("only the full set propagates explosion kills: full=%s", (full) => {
    const world = arena(["overload", "fuse", ...(full ? ["bloodpact"] : [])]);
    const first = enemy(world, { x: 100, y: 400, defenseX: 100, hp: 1, speed: 0 });
    const second = enemy(world, { x: 240, y: 400, defenseX: 240, hp: 20, speed: 0 });
    const third = enemy(world, { x: 380, y: 400, defenseX: 380, hp: 20, speed: 0 });
    const chest = world.chests.acquire();
    if (!chest) throw new Error("No chest");
    Object.assign(chest, { id: 9999, x: 100, y: 450, hp: 36, maxHp: 36, age: 0 });
    hit(world, first);
    expect(first.active).toBe(false);
    expect(second.active).toBe(false);
    expect(third.active).toBe(!full);
    expect(world.kills).toBe(full ? 3 : 2);
    expect(world.score).toBe(full ? 300 : 200);
    expect(world.explosionCount).toBe(full ? 3 : 1);
    expect(world.chainKills).toBe(full ? 2 : 1);
    expect(chest.hp).toBe(36);
    expect(world.reward).toBeNull();
  });

  test("full-pool chains kill once, heal once and stay inside all effect budgets", () => {
    const world = arena(["overload", "fuse", "bloodpact", "harvest"]);
    world.player.hp = 40;
    const targets = Array.from({ length: CONFIG.limits.enemies }, (_, index) =>
      enemy(world, { x: 100 + index * 10, defenseX: 100 + index * 10, y: 400, hp: 1, speed: 0 }),
    );
    const first = targets[0];
    if (!first) throw new Error("No target");
    hit(world, first);
    expect(world.kills).toBe(14);
    expect(world.player.hp).toBe(68);
    expect(world.explosionCount).toBe(14);
    expect(world.blasts.items.length).toBeLessThanOrEqual(CONFIG.limits.blasts);
    expect(world.particles.items.length).toBeLessThanOrEqual(CONFIG.limits.particles);
    tick(world, 1);
    expect(world.kills).toBe(14);
    expect(world.blasts.items.some((blast) => blast.active)).toBe(false);
  });

  test("sacrifice deals max-health-scaled damage, is nonlethal, and freezes during pause", () => {
    const world = arena(["overload", "fuse", "bloodpact", "vitality"]);
    world.player.hp = 1;
    const target = enemy(world, { x: 225, defenseX: 225, y: 300, hp: 1000, maxHp: 1000, speed: 0 });
    tick(world, 3.1);
    expect(world.explosionCount).toBe(1);
    expect(target.hp).toBeCloseTo(1000 - (20 + 120 * 0.45) * 1.8, 6);
    expect(world.player.hp).toBe(1);
    world.pause();
    const before = world.snapshot();
    tick(world, 10);
    expect(world.snapshot()).toEqual(before);
    world.resume();
    tick(world, 3);
    expect(world.explosionCount).toBe(2);
    expect(world.player.hp).toBe(1);
  });
});

describe("barrage, shield retaliation and judgment affect actual combat", () => {
  test("two pieces empower secondary damage; three add a real fourth-volley echo", () => {
    const world = arena(["haste", "multishot"]);
    world.player.cooldown = 0;
    enemy(world, { x: 225, defenseX: 225, y: 250, hp: 10000, maxHp: 10000, speed: 0 });
    world.update(CONFIG.fixedStep);
    expect(world.shots.items.filter((shot) => shot.active).map((shot) => shot.damage)).toEqual([
      12, 12,
    ]);
    expect(world.player.cooldown).toBeCloseTo(0.34 * 0.88 * 0.85, 6);
    applyCard("piercing", world.player, world.stacks);
    tick(world, 0.8);
    expect(world.echoVolleys).toBe(1);
  });

  test("shield regeneration never removes excess ward, and full-set retaliation hits the field", () => {
    const world = arena(["vitality", "ward"]);
    world.player.shield = 100;
    tick(world, 3.1);
    expect(world.player.shield).toBe(100);
    expect(world.shieldRestored).toBe(0);
    world.player.shield = 0;
    tick(world, 3);
    expect(world.player.shield).toBe(10);
    expect(world.shieldRestored).toBe(10);
    applyCard("thorns", world.player, world.stacks);
    const target = enemy(world, { x: 225, defenseX: 225, y: 300, hp: 1000, maxHp: 1000, speed: 0 });
    const other = enemy(world, { x: 57, defenseX: 57, y: 300, hp: 1000, maxHp: 1000, speed: 0 });
    world.selectTargetAt(target);
    incoming(world);
    expect(world.player.hp).toBe(120);
    expect(target.hp).toBe(904); // 36 thorns + 60 global retaliation.
    expect(other.hp).toBe(940);
    incoming(world);
    expect(target.hp).toBe(904); // Invulnerability blocks both damage and retaliation.
  });

  test("full judgment doubles charged-boss damage, interrupts and executes at low health", () => {
    const world = arena(["execution", "focus", "harvest"]);
    const boss = enemy(world, {
      kind: "boss",
      x: 225,
      defenseX: 225,
      y: 400,
      hp: 1000,
      maxHp: 1000,
      speed: 0,
      stage: "Attacking",
      arrived: true,
      telegraph: 2,
      interruptRequired: 90,
    });
    hit(world, boss, 30);
    expect(boss.hp).toBe(895); // 30 × (1 + .2 + .2 + .35) × 2.
    expect(world.bossInterrupts).toBe(1);
    boss.hp = 151;
    hit(world, boss, 1);
    expect(boss.active).toBe(false);
    expect(world.executions).toBe(1);
    expect(world.phase).toBe("StageClear");
    expect(world.clearedStages).toBe(1);
  });

  test("restart clears synergy tiers, timers, chain queues, effects and proc counters", () => {
    const world = arena(CARDS.map((card) => card.id));
    world.player.hp = 40;
    const target = enemy(world, { x: 225, defenseX: 225, y: 300, hp: 1, speed: 0 });
    hit(world, target);
    expect(world.explosionCount).toBeGreaterThan(0);
    world.pause();
    expect(world.start(9)).toBe(true);
    for (const family of SYNERGIES) expect(synergyTier(world.stacks, family.id)).toBe(0);
    expect(
      world.explosionCount +
        world.chainKills +
        world.echoVolleys +
        world.shieldRestored +
        world.executions,
    ).toBe(0);
    expect(world.blasts.items.some((blast) => blast.active)).toBe(false);
    tick(world, 4);
    expect(world.explosionCount).toBe(0);
  });
});
