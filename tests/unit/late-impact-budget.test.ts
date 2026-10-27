import { describe, expect, test } from "bun:test";
import { BASE_STATS } from "../../src/data/balance/model";
import { ENEMIES } from "../../src/data/enemies";
import { STAGES } from "../../src/data/stages";
import { CONFIG } from "../../src/game/config";
import type { WorldObservation } from "../../src/game/observation";
import type { BossPercentLimiter } from "../../src/game/systems/boss-damage";
import type { Enemy } from "../../src/game/types";
import { World } from "../../src/game/world";
import { enemy, hit, isolateEndless, tick } from "./helpers";

function fixture(depth: number | "campaign" = 7, events?: WorldObservation[]): World {
  const world = new World(
    CONFIG.width,
    undefined,
    events ? (event) => events.push(event) : undefined,
  );
  expect(world.start(4)).toBe(true);
  world.stageIndex = depth === "campaign" ? 0 : STAGES.length + depth - 1;
  if (world.endless) isolateEndless(world);
  world.bossSpawned = true;
  Object.assign(world.player.stats, BASE_STATS, { maxHp: 100, regeneration: 0 });
  world.player.hp = 100;
  world.player.shield = 0;
  world.player.cooldown = 1000;
  return world;
}

function victim(world: World, overrides: Partial<Enemy> = {}): Enemy {
  return enemy(world, {
    x: world.player.x,
    y: 200,
    defenseX: world.player.x,
    speed: 0,
    hp: 1000,
    maxHp: 1000,
    trainingCredit: 0,
    shotCooldown: 1000,
    ...overrides,
  });
}

function damage(world: World, target: Enemy, raw = 0, percentage = 1000): number {
  const before = target.hp;
  Reflect.apply(Reflect.get(world, "damageEnemy"), world, [target, raw, "arc", false, percentage]);
  return before - target.hp;
}

function limiter(world: World, target: Enemy): BossPercentLimiter {
  const bucket = (Reflect.get(world, "percentLimiters") as Map<number, BossPercentLimiter>).get(
    target.id,
  );
  if (!bucket) throw new Error("No real percentage budget");
  return bucket;
}

function melee(world: World, scale = 1000): Enemy {
  return victim(world, {
    kind: "wisp",
    arrived: true,
    stage: "Attacking",
    attackPolicy: { type: "anywhere" },
    shotCooldown: 0,
    damageScale: scale,
  });
}

function launch(world: World, special = false): Enemy {
  const target = victim(world, {
    kind: special ? "boss" : "hexer",
    role: special ? "boss" : "minion",
    y: world.player.y - 70,
    arrived: true,
    stage: "Attacking",
    attackPolicy: { type: "anywhere" },
    shotCooldown: special ? 1000 : 0,
    patternCooldown: 1000,
    damageScale: 1000,
    telegraph: special ? CONFIG.fixedStep / 2 : 0,
    castSkill: special ? "volley" : null,
    castId: special ? 1 : 0,
  });
  world.update(CONFIG.fixedStep);
  target.shotCooldown = 1000;
  expect(world.hostileShots.items.filter((shot) => shot.active)).toHaveLength(1);
  expect(world.player.hp).toBe(100);
  return target;
}

describe("late endless percentage budgets and discrete impacts", () => {
  test("depth seven retains the original quarter burst and deeper natural shots use smaller bursts", () => {
    for (const [depth, perSecond] of [
      [7, 0.2],
      [8, 5 / 27],
      [10, 5 / 31],
      [20, 5 / 51],
    ] as const) {
      const world = fixture(depth);
      world.player.stats.maxHealthDamage = 1;
      const target = victim(world);
      hit(world, target, 9);
      expect(1000 - target.hp).toBeCloseTo(9 + (1000 * perSecond) / 4, 8);
      expect(limiter(world, target).snapshot().available).toBeCloseTo(0, 8);
      hit(world, target, 9);
      expect(1000 - target.hp).toBeCloseTo(18 + 1000 * perSecond * (0.25 + CONFIG.fixedStep), 8);
    }
  });

  test("deep lazy consumption, player-clock refill and all sources share the same rate", () => {
    const world = fixture(20);
    const first = victim(world);
    const second = victim(world, { x: 300, defenseX: 300 });
    expect(damage(world, first)).toBeCloseTo((1000 * (5 / 51)) / 4, 8);
    expect(damage(world, first, 11)).toBeCloseTo(11, 8);
    expect(damage(world, second)).toBeCloseTo((1000 * (5 / 51)) / 4, 8);
    world.sanctuaryRemaining = 1;
    const hostileTime = world.stageElapsed;
    tick(world, 0.1);
    expect(world.stageElapsed).toBe(hostileTime);
    expect(damage(world, first)).toBeCloseTo(1000 * (5 / 51) * 0.1, 8);
    expect(damage(world, first)).toBe(0);
    expect(world.pause()).toBe(true);
    tick(world, 0.5);
    expect(limiter(world, first).snapshot().available).toBe(0);
    expect(world.resume()).toBe(true);
    tick(world, 0.5);
    expect(damage(world, first)).toBeCloseTo((1000 * (5 / 51)) / 4, 8);
  });

  test("deep fusion updates reduced capacity without minting a new percentage burst", () => {
    const world = fixture(20);
    const group = [0, 1, 2].map((index) =>
      victim(world, {
        x: 190 + index * 10,
        spawnX: 190 + index * 10,
        defenseX: 190 + index * 10,
        age: CONFIG.fusion.grace,
      }),
    );
    const anchor = group[0];
    if (!anchor) throw new Error("Missing anchor");
    for (const target of group) damage(world, target);
    anchor.fusionPeers = group.map((target) => target.id).join(":");
    anchor.fusionTime = CONFIG.fusion.duration - CONFIG.fixedStep;
    world.update(CONFIG.fixedStep);
    expect(world.fusions).toBe(1);
    expect(anchor.maxHp).toBe(3500);
    expect(damage(world, anchor)).toBeCloseTo(1000 * (5 / 51) * CONFIG.fixedStep, 8);
    expect(limiter(world, anchor).snapshot().capacity).toBeCloseTo((3500 * (5 / 51)) / 4, 8);
    const buckets = Reflect.get(world, "percentLimiters") as Map<number, BossPercentLimiter>;
    for (const donor of group.slice(1)) expect(buckets.has(donor.id)).toBe(false);
  });

  test("ordinary melee requests cap before shield absorption and retain hit immunity", () => {
    const events: WorldObservation[] = [];
    const world = fixture(20, events);
    world.player.shield = 20;
    const target = melee(world);
    world.update(CONFIG.fixedStep);
    expect(world.player.hp).toBe(85);
    expect(world.player.shield).toBe(0);
    expect(world.damageTaken).toBe(35);
    expect(events.find((event) => event.type === "player_damage")).toMatchObject({
      source: "melee:wisp",
      hpLoss: 15,
      shieldAbsorbed: 20,
      amount: 35,
    });
    target.shotCooldown = 0;
    world.update(CONFIG.fixedStep);
    expect(world.damageTaken).toBe(35);
    expect(world.regularAttacks).toBe(2);
  });

  test("maximum HP rather than current HP sets the cap and low HP can still die", () => {
    const world = fixture();
    world.player.stats.maxHp = 210;
    world.player.hp = 210;
    melee(world);
    world.update(CONFIG.fixedStep);
    expect(world.player.hp).toBeCloseTo(136.5, 10);
    const fatal = fixture();
    fatal.player.hp = 20;
    melee(fatal);
    fatal.update(CONFIG.fixedStep);
    expect(fatal.player.hp).toBe(0);
    expect(fatal.phase).toBe("GameOver");
  });

  test("small authored melee attacks retain their actual damage", () => {
    const world = fixture();
    const target = melee(world, 0.01);
    const expected = ENEMIES.wisp.damage * world.enemyStage(target).damage * 0.01;
    world.update(CONFIG.fixedStep);
    expect(expected).toBeLessThan(35);
    expect(100 - world.player.hp).toBeCloseTo(expected, 10);
  });

  test("campaign and every introductory depth retain uncapped melee and percentages", () => {
    for (const depth of ["campaign", 1, 2, 3, 4, 5, 6] as const) {
      const world = fixture(depth);
      const target = victim(world);
      expect(damage(world, target)).toBe(1000);
      melee(world);
      world.update(CONFIG.fixedStep);
      expect(world.player.hp).toBe(0);
      expect(world.phase).toBe("GameOver");
    }
  });

  test("real ordinary projectile damage is identical with observer absent, present or switched midflight", () => {
    for (const mode of ["none", "on", "attach", "detach", "reattach"] as const) {
      const events: WorldObservation[] = [];
      const world = fixture(
        20,
        mode === "on" || mode === "detach" || mode === "reattach" ? events : undefined,
      );
      launch(world);
      if (mode === "attach" || mode === "reattach")
        world.setObserver((event) => events.push(event));
      if (mode === "detach" || mode === "reattach") world.setObserver();
      if (mode === "reattach") world.setObserver((event) => events.push(event));
      tick(world, 0.6);
      expect(world.player.hp).toBe(65);
      expect(world.damageTaken).toBe(35);
      if (mode !== "none" && mode !== "detach")
        expect(events.find((event) => event.type === "player_damage")?.source).toBe(
          "projectile:hexer",
        );
    }
  });

  test("projectiles at depth six remain lethal while late charged volleys obey the discrete cap", () => {
    const early = fixture(6);
    launch(early);
    tick(early, 0.6);
    expect(early.phase).toBe("GameOver");
    const late = fixture(20);
    launch(late, true);
    tick(late, 0.6);
    expect(late.player.hp).toBe(65);
    expect(late.bossSpecials).toBe(1);
  });

  test("continuous poison bypasses the impact cap and immunity while self bloodpact stays unchanged", () => {
    const poisoned = fixture(20);
    poisoned.player.invulnerable = 10;
    poisoned.player.poisonTime = 1;
    poisoned.player.poisonDamageBonus = 6000;
    poisoned.update(CONFIG.fixedStep);
    expect(100 - poisoned.player.hp).toBeGreaterThan(35);
    const blood = fixture(20);
    blood.player.stats.bloodpact = 1;
    blood.player.stats.maxHp = 1;
    blood.player.hp = 4;
    blood.player.shield = 10;
    victim(blood, { hp: 1_000_000, maxHp: 1_000_000 });
    Reflect.set(blood, "bloodCooldown", 0);
    blood.update(CONFIG.fixedStep);
    expect(blood.player.hp).toBe(1);
    expect(blood.player.shield).toBe(10);
  });
});
