import { describe, expect, test } from "bun:test";
import { applyCard, CARDS, drawCards, eligibleCards } from "../../src/data/cards";
import { SYNERGIES } from "../../src/data/synergies";
import { CONFIG } from "../../src/game/config";
import { seededRandom } from "../../src/game/random";
import { combatStats } from "../../src/game/stats";
import { synergyCount, synergyPreview, synergyTier } from "../../src/game/synergies";
import type { Enemy, SynergyId } from "../../src/game/types";
import { createPlayer, World } from "../../src/game/world";
import { enemy, tick } from "./helpers";

function arena(ids: string[] = []): World {
  const world = new World();
  world.start(9);
  world.bossSpawned = true;
  world.player.cooldown = 100;
  for (const id of ids) expect(applyCard(id, world.player, world.stacks)).toBe(true);
  return world;
}

function grant(world: World, family: SynergyId, count: number) {
  for (let index = 0; index < count; index++) {
    const card = eligibleCards(world.player, world.stacks).find((item) => item.synergy === family);
    if (!card || !applyCard(card.id, world.player, world.stacks))
      throw new Error("Missing family card");
  }
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
    primary: true,
    critical: false,
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

function stationary(world: World, overrides: Partial<Enemy> = {}) {
  return enemy(world, {
    x: 225,
    defenseX: 225,
    y: 300,
    hp: 1000,
    maxHp: 1000,
    speed: 0,
    ...overrides,
  });
}

describe("ten families and cumulative 3/6/9 breakpoints", () => {
  test("forty unique cards provide four real effects in each of ten families", () => {
    expect(CARDS).toHaveLength(40);
    expect(SYNERGIES).toHaveLength(10);
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(40);
    for (const card of CARDS) {
      const player = createPlayer();
      const before = structuredClone(player);
      expect(card.preview(player)).not.toBe("");
      expect(applyCard(card.id, player, new Map())).toBe(true);
      expect(player).not.toEqual(before);
    }
  });

  test.each(SYNERGIES)("$name reaches all three tiers, including repeated upgrades", (family) => {
    const world = arena();
    expect(CARDS.filter((card) => card.synergy === family.id)).toHaveLength(4);
    for (let count = 1; count <= 9; count++) {
      const offered = eligibleCards(world.player, world.stacks).find(
        (card) => card.synergy === family.id,
      );
      if (!offered) throw new Error("Unreachable nine-piece build");
      if ([3, 6, 9].includes(count))
        expect(synergyPreview(world.stacks, offered.id)).toContain("质变");
      grant(world, family.id, 1);
      expect(synergyCount(world.stacks, family.id)).toBe(count);
      expect(synergyTier(world.stacks, family.id)).toBe(
        count >= 9 ? 9 : count >= 6 ? 6 : count >= 3 ? 3 : 0,
      );
    }
    expect(world.stacks.size).toBeLessThanOrEqual(3);
  });

  test("repeat upgrades cross a breakpoint and tiers remain capped while base cards keep growing", () => {
    const world = arena(["overload", "overload"]);
    expect(synergyPreview(world.stacks, "overload")).toContain("2 → 3/3 · 小质变");
    grant(world, "blast", 10);
    expect(synergyCount(world.stacks, "blast")).toBe(12);
    expect(synergyTier(world.stacks, "blast")).toBe(9);
    expect(world.player.stats.damage).toBe(60);
  });

  test("offers preserve two build choices and one useful offense option without duplicates", () => {
    const world = arena(["ward"]);
    for (let seed = 0; seed < 40; seed++) {
      const choices = drawCards(world.player, world.stacks, seededRandom(seed));
      expect(new Set(choices).size).toBe(3);
      const cards = choices.map((id) => CARDS.find((card) => card.id === id));
      expect(cards.filter((card) => card?.synergy === "bastion")).toHaveLength(2);
      expect(cards.some((card) => card?.offense)).toBe(true);
    }
  });
});

describe("explosions, sacrifice and bounded chain resolution", () => {
  test.each([3, 6])("chains unlock at six layers, tested at %s", (layers) => {
    const world = arena(["fuse", ...Array<string>(layers - 1).fill("overload")]);
    const first = stationary(world, { x: 100, defenseX: 100, y: 400, hp: 1 });
    const second = stationary(world, { x: 240, defenseX: 240, y: 400, hp: 20 });
    const third = stationary(world, { x: 380, defenseX: 380, y: 400, hp: 20 });
    const chest = world.chests.acquire();
    if (!chest) throw new Error("No chest");
    Object.assign(chest, { id: 9999, x: 100, y: 450, hp: 36, maxHp: 36, age: 0 });
    hit(world, first);
    expect(first.active).toBe(false);
    expect(second.active).toBe(false);
    expect(third.active).toBe(layers < 6);
    expect(world.kills).toBe(layers >= 6 ? 3 : 2);
    expect(world.explosionCount).toBe(layers >= 6 ? 3 : 1);
    expect(chest.hp).toBe(36);
    expect(world.reward).toBeNull();
  });

  test("a full-pool chain kills and heals each victim only once", () => {
    const world = arena(["fuse", ...Array<string>(5).fill("overload"), "harvest"]);
    world.player.hp = 10;
    const targets = Array.from({ length: CONFIG.limits.enemies }, (_, index) =>
      stationary(world, { x: 100 + index * 5, defenseX: 100 + index * 5, y: 400, hp: 1 }),
    );
    const first = targets[0];
    if (!first) throw new Error("No target");
    hit(world, first);
    expect(world.kills).toBe(CONFIG.limits.enemies);
    expect(world.player.hp).toBe(10 + CONFIG.limits.enemies * 2);
    expect(world.explosionCount).toBe(CONFIG.limits.enemies);
    expect(world.blasts.items.length).toBeLessThanOrEqual(CONFIG.limits.blasts);
    expect(world.particles.items.length).toBeLessThanOrEqual(CONFIG.limits.particles);
    tick(world, 1);
    expect(world.kills).toBe(CONFIG.limits.enemies);
  });

  test("nine layers produce max-health sacrifice every three seconds without killing the player", () => {
    const world = arena(["bloodpact", ...Array<string>(8).fill("overload"), "vitality"]);
    world.player.hp = 1;
    const target = stationary(world);
    tick(world, 3.1);
    expect(world.explosionCount).toBe(1);
    expect(target.hp).toBeCloseTo(1000 - (20 + 120 * 0.45) * 2, 6);
    expect(world.player.hp).toBe(1);
    world.pause();
    const before = world.snapshot();
    tick(world, 10);
    expect(world.snapshot()).toEqual(before);
    world.resume();
    tick(world, 3);
    expect(world.explosionCount).toBe(2);
  });
});

describe("barrage, shields, judgment and heavy attacks", () => {
  test("barrage changes actual shots at three, six and nine", () => {
    for (const layers of [3, 6, 9]) {
      const world = arena();
      grant(world, "barrage", layers);
      stationary(world, { hp: 100000, maxHp: 100000 });
      world.player.cooldown = 0;
      world.update(CONFIG.fixedStep);
      const stats = combatStats(world.player, world.stacks);
      expect(world.shots.items.filter((shot) => shot.active)).toHaveLength(stats.projectiles);
      expect(world.player.cooldown).toBeCloseTo(stats.interval, 6);
      tick(world, stats.interval * 4 + 0.01);
      expect(world.echoVolleys).toBe(layers >= 6 ? 1 : 0);
      if (layers === 9) expect(stats.projectiles).toBe(world.player.stats.projectiles + 1);
    }
  });

  test("regeneration preserves excess ward and six-layer retaliation damages the entire field", () => {
    const world = arena([...Array<string>(6).fill("ward"), "thorns"]);
    world.player.shield = 100;
    tick(world, 3.1);
    expect(world.player.shield).toBe(100);
    world.player.shield = 0;
    tick(world, 3);
    expect(world.player.shield).toBe(10);
    const target = stationary(world);
    const other = stationary(world, { x: 57, defenseX: 57 });
    world.selectTargetAt(target);
    incoming(world);
    expect(world.player.hp).toBe(100);
    expect(target.hp).toBe(939); // 36 thorns + 25 retaliation.
    expect(other.hp).toBe(975);
    incoming(world);
    expect(target.hp).toBe(939);
  });

  test("nine-layer judgment doubles charge damage, interrupts and executes a boss", () => {
    const world = arena();
    grant(world, "judgment", 9);
    const boss = stationary(world, {
      kind: "boss",
      stage: "Attacking",
      arrived: true,
      telegraph: 2,
      interruptRequired: 90,
    });
    hit(world, boss, 30);
    expect(boss.hp).toBeCloseTo(856, 6);
    expect(world.bossInterrupts).toBe(1);
    boss.hp = 151;
    hit(world, boss, 1);
    expect(boss.active).toBe(false);
    expect(world.executions).toBe(1);
    expect(world.phase).toBe("StageClear");
  });

  test("power scales firing and a fifth-volley heavy strike deals actual additional damage", () => {
    const world = arena(["momentum", "crush"]);
    world.player.cooldown = 0;
    const target = stationary(world, { y: 620 });
    tick(world, 1.6);
    expect(target.hp).toBeCloseTo(1000 - 12 * 1.12 * (4 + 1.25), 5);
    expect(world.damageDealt).toBeCloseTo(70.56, 5);
  });
});

describe("critical hits, real lifesteal and overheal", () => {
  test("the ninth precision layer guarantees every third volley and applies the crit multiplier", () => {
    const world = arena();
    grant(world, "precision", 9);
    const target = stationary(world);
    for (let index = 0; index < 3; index++) {
      world.player.cooldown = 0;
      world.update(CONFIG.fixedStep);
    }
    const shots = world.shots.items.filter((shot) => shot.active);
    const last = shots[shots.length - 1];
    if (!last) throw new Error("No critical projectile");
    expect(last.critical).toBe(true);
    expect(last.damage).toBeCloseTo(12 * combatStats(world.player, world.stacks).critDamage, 6);
    for (const shot of shots) if (shot !== last) shot.active = false;
    Object.assign(last, { x: target.x, y: target.y, previousX: target.x, previousY: target.y });
    world.player.cooldown = 100;
    world.update(CONFIG.fixedStep);
    expect(target.hp).toBeCloseTo(1000 - last.damage, 6);
    expect(world.criticalHits).toBe(1);
  });

  test("lifesteal uses actual damage instead of overkill and never drains a chest", () => {
    const world = arena(["leech"]);
    world.player.hp = 40;
    const target = stationary(world, { hp: 2 });
    hit(world, target, 100);
    expect(world.player.hp).toBeCloseTo(40.08, 6);
    expect(world.healingDone).toBeCloseTo(0.08, 6);
    const chest = world.chests.acquire();
    if (!chest) throw new Error("No chest");
    Object.assign(chest, { id: 9999, x: 225, y: 400, hp: 36, maxHp: 36, age: 0 });
    world.player.cooldown = 0;
    tick(world, 1);
    expect(world.player.hp).toBeCloseTo(40.08, 6);
  });

  test("six-layer overheal becomes a capped shield; excess card shields are preserved", () => {
    const world = arena();
    grant(world, "blood", 6);
    world.player.hp = 99;
    const target = stationary(world, { hp: 10000, maxHp: 10000 });
    hit(world, target, 100);
    expect(world.player.hp).toBe(100);
    expect(world.player.shield).toBeCloseTo(14, 6);
    for (let index = 0; index < 10; index++) hit(world, target, 100);
    expect(world.player.shield).toBeCloseTo(40, 6);
    world.player.shield = 100;
    hit(world, target, 100);
    expect(world.player.shield).toBe(100);
  });

  test("regeneration and healing amplification advance only in combat", () => {
    const world = arena(["renewal", "recovery"]);
    world.player.hp = 40;
    tick(world, 1);
    expect(world.player.hp).toBeCloseTo(41.38, 6);
    world.pause();
    const frozen = world.snapshot();
    tick(world, 5);
    expect(world.snapshot()).toEqual(frozen);
  });
});

describe("AOE, slowing and crowd control", () => {
  test("lightning hits a distinct neighbor once and never loops back to the primary victim", () => {
    const world = arena(["chain"]);
    const primary = stationary(world, { x: 100, defenseX: 100 });
    const near = stationary(world, { x: 200, defenseX: 200 });
    const far = stationary(world, { x: 300, defenseX: 300 });
    hit(world, primary, 10);
    expect(primary.hp).toBe(990);
    expect(near.hp).toBe(997);
    expect(far.hp).toBe(1000);
  });

  test("splash excludes its primary target and periodic storms cause real area damage", () => {
    const world = arena(["splash", "stormcall"]);
    const primary = stationary(world, { x: 200, defenseX: 200 });
    const near = stationary(world, { x: 270, defenseX: 270 });
    hit(world, primary, 10);
    expect(primary.hp).toBe(990);
    expect(near.hp).toBe(998.5);
    tick(world, 6);
    expect(primary.hp).toBe(972);
    expect(near.hp).toBe(980.5);
  });

  test("slowing changes movement and attack timers, then expires", () => {
    const world = arena(["chill"]);
    const mover = stationary(world, { y: 100, speed: 100 });
    hit(world, mover);
    const start = mover.y;
    tick(world, 0.5);
    expect(mover.y - start).toBeCloseTo(45, 5);
    const caster = stationary(world, {
      kind: "hexer",
      arrived: true,
      stage: "Attacking",
      shotCooldown: 1,
    });
    hit(world, caster);
    tick(world, 0.5);
    expect(caster.shotCooldown).toBeGreaterThan(0.53);
    tick(world, 2);
    expect(mover.slowTime).toBe(0);
    expect(mover.slow).toBe(0);
  });

  test.each([false, true])(
    "freeze pauses attacks and bosses resist its duration: boss=%s",
    (boss) => {
      const world = arena();
      grant(world, "frost", 6);
      const target = stationary(world, {
        kind: boss ? "boss" : "wisp",
        arrived: true,
        stage: "Attacking",
        shotCooldown: 20,
      });
      for (let index = 0; index < 4; index++) hit(world, target);
      expect(target.stunTime).toBeCloseTo((boss ? 0.15 : 0.6) - CONFIG.fixedStep, 6);
      const cooldown = target.shotCooldown;
      tick(world, 0.1);
      expect(target.shotCooldown).toBe(cooldown);
      expect(world.controlProcs).toBe(1);
    },
  );

  test("six-layer control creates bullet time and clears enemy bullets", () => {
    const world = arena();
    grant(world, "dominion", 6);
    stationary(world);
    const shot = world.hostileShots.acquire();
    if (!shot) throw new Error("No shot");
    Object.assign(shot, { x: 10, y: 10, vx: 0, vy: 0, lifetime: 60, damage: 10 });
    tick(world, 6);
    expect(shot.active).toBe(false);
    expect(world.bulletTimeRemaining).toBeGreaterThan(0.6);
    expect(world.controlProcs).toBeGreaterThan(0);
  });

  test("restart clears every tier, combat metric, status and periodic effect", () => {
    const world = arena(CARDS.map((card) => card.id));
    world.player.hp = 40;
    hit(world, stationary(world, { hp: 1 }));
    expect(world.explosionCount).toBeGreaterThan(0);
    world.pause();
    expect(world.start(9)).toBe(true);
    for (const family of SYNERGIES) expect(synergyTier(world.stacks, family.id)).toBe(0);
    expect(world.player).toEqual(createPlayer());
    expect(
      world.damageDealt +
        world.damageTaken +
        world.healingDone +
        world.controlProcs +
        world.criticalHits,
    ).toBe(0);
    expect(world.blasts.items.some((blast) => blast.active)).toBe(false);
    tick(world, 2);
    expect(world.explosionCount).toBe(0);
  });
});
