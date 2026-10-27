import { describe, expect, test } from "bun:test";
import { defaultProfile } from "../../src/data/balance/profile";
import { applyCard, eligibleCards } from "../../src/data/cards";
import { CONFIG } from "../../src/game/config";
import { DebugWorld } from "../../src/game/debug/DebugWorld";
import type { Enemy, EnemyKind, EnemyRole } from "../../src/game/types";
import { World } from "../../src/game/world";
import { enemy, isolateEndless, tick } from "./helpers";

const STEP = CONFIG.fixedStep;
function profile(recovery = 0, hp = 10) {
  const value = defaultProfile();
  Object.assign(value.payload.player.stats, {
    maxHp: 100,
    lifesteal: 0.4,
    recovery,
    overheal: 1,
    shieldCapacity: 1,
    regeneration: 0,
    harvest: 0,
  });
  value.payload.player.hp = hp;
  value.payload.player.shield = 0;
  return value;
}
function isolate(world: World): void {
  if (world.endless) isolateEndless(world);
  world.bossSpawned = true;
  world.player.cooldown = 1000;
}
function fixture(stageIndex = 7, recovery = 0, hp = 10): World {
  const world = new World(CONFIG.width, profile(recovery, hp));
  expect(world.start(4)).toBe(true);
  world.stageIndex = stageIndex;
  isolate(world);
  return world;
}
function target(world: World, overrides: Partial<Enemy> = {}): Enemy {
  return enemy(world, {
    x: 100,
    defenseX: 100,
    y: 300,
    speed: 0,
    hp: 1_000_000_000,
    maxHp: 1_000_000_000,
    trainingCredit: 0,
    arrived: true,
    stage: "Attacking",
    attackPolicy: { type: "anywhere" },
    shotCooldown: 1000,
    patternCooldown: 1000,
    ...overrides,
  });
}
function queueShot(world: World, entity: Enemy, damage = 1_000_000, primary = true): void {
  const shot = world.shots.acquire();
  if (!shot) throw new Error("Shot pool exhausted");
  Object.assign(shot, {
    x: entity.x,
    y: entity.y,
    previousX: entity.x,
    previousY: entity.y,
    vx: 0,
    vy: 0,
    damage,
    radius: 4,
    lifetime: 1,
    hitsLeft: 1,
    targetId: entity.id,
    primary,
    critical: false,
  });
  shot.hitIds.clear();
}
function shoot(world: World, entity: Enemy, damage = 1_000_000, primary = true): void {
  queueShot(world, entity, damage, primary);
  world.update(STEP);
}
function budget(world: World): { available: number; capacity: number } {
  const limiter = Reflect.get(world, "lifestealLimiter") as {
    snapshot(): { available: number; capacity: number };
  };
  return limiter.snapshot();
}
function heal(world: World, amount: number, source: string): void {
  const action = Reflect.get(world, "heal") as (amount: number, source: string) => void;
  action.call(world, amount, source);
}
function frost(world: World): void {
  for (let index = 0; index < 6; index++) {
    const card = eligibleCards(world.player, world.stacks).find((item) => item.synergy === "frost");
    if (!card || !applyCard(card.id, world.player, world.stacks)) throw new Error("Frost fixture");
  }
}
function secondaryFrost(stageIndex: number, kind: EnemyKind, role: EnemyRole, stars: 1 | 3) {
  const world = fixture(stageIndex);
  frost(world);
  const entity = target(world, { kind, role, stars });
  for (let index = 0; index < 4; index++) shoot(world, entity, 1, false);
  return { world, entity };
}

describe("endless lifesteal budget and star control", () => {
  test("real huge shots share the late lifesteal budget without instantly filling HP/shield", () => {
    const world = fixture();
    const entity = target(world);
    for (let index = 0; index < 3; index++) queueShot(world, entity);
    world.update(STEP);
    expect(world.damageDealt).toBeGreaterThanOrEqual(3_000_000);
    expect(world.player.hp).toBeCloseTo(12.125, 8);
    expect(world.player.shield).toBe(0);
    expect(budget(world).available).toBeCloseTo(0, 10);
    heal(world, 25, "harvest");
    expect(world.player.hp).toBeCloseTo(37.125, 8);
    expect(budget(world).available).toBeCloseTo(0, 10);
  });

  test("recovery and wounds act after token consumption, including overheal only once", () => {
    const boosted = fixture(7, 1);
    shoot(boosted, target(boosted));
    expect(boosted.player.hp).toBeCloseTo(14.25, 8);
    const wounded = fixture(7, 1);
    wounded.player.woundTime = 10;
    shoot(wounded, target(wounded));
    expect(wounded.player.hp).toBeCloseTo(10.425, 8);
    const overflow = fixture(7, 1, 100);
    overflow.player.woundTime = 10;
    shoot(overflow, target(overflow));
    expect(overflow.player.hp).toBe(100);
    expect(overflow.player.shield).toBeCloseTo(0.425, 8);
  });

  test("pause, reward selection and clear presentation do not replenish spent tokens", () => {
    const world = fixture();
    shoot(world, target(world));
    const playerTime = world.elapsed;
    expect(world.pause()).toBe(true);
    tick(world, 0.5);
    expect(budget(world).available).toBeCloseTo(0, 10);
    expect(world.resume()).toBe(true);
    world.reward = { token: 101, source: "chest", choices: ["overload"] };
    expect(world.state.transition("RewardSelection")).toBe(true);
    tick(world, 0.5);
    expect(budget(world).available).toBeCloseTo(0, 10);
    world.reward = null;
    expect(world.state.transition("Playing")).toBe(true);
    world.clearPresentationRemaining = 0.5;
    tick(world, 0.25);
    expect(world.clearPresentationRemaining).toBeCloseTo(0.25, 8);
    expect(world.elapsed).toBeCloseTo(playerTime, 10);
    expect(budget(world).available).toBeCloseTo(0, 10);
  });

  test("sanctuary refills on player time and a leech upgrade does not remint a full bucket", () => {
    const world = fixture();
    shoot(world, target(world));
    world.sanctuaryRemaining = 0.5;
    const hostileTime = world.stageElapsed;
    const playerTime = world.elapsed;
    tick(world, 0.125);
    expect(world.stageElapsed).toBeCloseTo(hostileTime, 10);
    expect(world.elapsed - playerTime).toBeCloseTo(0.125, 10);
    expect(budget(world).available).toBeCloseTo(1.0625, 8);
    world.player.stats.lifesteal = 0.5;
    const hp = world.player.hp;
    heal(world, 1_000_000, "lifesteal");
    expect(world.player.hp - hp).toBeCloseTo(1.0625, 8);
    expect(budget(world).capacity).toBeCloseTo(2.65625, 8);
    expect(budget(world).available).toBeCloseTo(0, 10);
    tick(world, 0.25);
    expect(budget(world).available).toBeCloseTo(2.65625, 8);
  });

  test("real entry restore and retained restart create one fresh bounded initial burst", () => {
    const world = new DebugWorld(CONFIG.width, profile());
    expect(world.start(4)).toBe(true);
    world.execute({ type: "jump", stage: 8, fresh: true });
    expect(world.resume()).toBe(true);
    isolate(world);
    shoot(world, target(world));
    expect(world.player.hp).toBeCloseTo(12.125, 8);
    const spent = Reflect.get(world, "lifestealLimiter");
    world.execute({ type: "restart", restoreEntry: true });
    expect(Reflect.get(world, "lifestealLimiter")).not.toBe(spent);
    expect(world.player.hp).toBe(10);
    tick(world, 0.5);
    expect(world.player.hp).toBe(10);
    expect(world.resume()).toBe(true);
    isolate(world);
    const entity = target(world);
    for (let index = 0; index < 3; index++) queueShot(world, entity);
    world.update(STEP);
    expect(world.player.hp).toBeCloseTo(12.125, 8);
    world.execute({ type: "restart", restoreEntry: false });
    expect(world.resume()).toBe(true);
    isolate(world);
    const before = world.player.hp;
    shoot(world, target(world));
    expect(world.player.hp - before).toBeCloseTo(2.125, 8);
  });

  test("campaign and endless depths1–3 retain unrestricted lifesteal and overheal", () => {
    for (const stageIndex of [0, 4, 5, 6]) {
      const world = fixture(stageIndex);
      shoot(world, target(world));
      expect(world.player.hp).toBe(100);
      // Existing overheal capacity is capped at one own maxHP.
      expect(world.player.shield).toBe(100);
    }
  });

  test("real secondary hits still proc Frost and three-star minions receive shorter control", () => {
    const one = secondaryFrost(7, "wisp", "minion", 1);
    const three = secondaryFrost(7, "wisp", "minion", 3);
    for (const entry of [one, three]) {
      expect(entry.entity.receivedHits).toBe(4);
      expect(entry.entity.primaryHits).toBe(0);
      expect(entry.world.controlProcs).toBe(1);
      expect(entry.entity.stunTime).toBeGreaterThan(0);
    }
    expect(one.entity.stunTime + STEP).toBeCloseTo(0.6, 8);
    expect(three.entity.stunTime + STEP).toBeCloseTo(0.2, 8);
    expect(three.entity.slow).toBeCloseTo(one.entity.slow / 3, 8);
    expect(three.entity.slowTime).toBeCloseTo(one.entity.slowTime, 8);
  });

  test("campaign high stars and endless elite/boss retain their existing Frost effects", () => {
    const campaign = secondaryFrost(0, "wisp", "minion", 3);
    const elite = secondaryFrost(7, "tank", "elite", 3);
    const boss = secondaryFrost(7, "boss", "boss", 1);
    expect(campaign.entity.stunTime + STEP).toBeCloseTo(0.6, 8);
    expect(elite.entity.stunTime + STEP).toBeCloseTo(0.6, 8);
    expect(boss.entity.stunTime + STEP).toBeCloseTo(0.15, 8);
    expect(campaign.entity.slow).toBeCloseTo(elite.entity.slow, 8);
    expect(boss.entity.slow).toBeCloseTo(campaign.entity.slow * 0.5, 8);
    expect(campaign.world.controlProcs).toBe(1);
    expect(elite.world.controlProcs).toBe(1);
    expect(boss.world.controlProcs).toBe(1);
  });
});
