import { describe, expect, test } from "bun:test";
import { defaultProfile } from "../../src/data/balance/profile";
import { applyCard, eligibleCards } from "../../src/data/cards";
import { CONFIG } from "../../src/game/config";
import { DebugWorld } from "../../src/game/debug/DebugWorld";
import type { Enemy, EnemyKind } from "../../src/game/types";
import { World } from "../../src/game/world";
import { enemy, isolateEndless, tick } from "./helpers";

const STEP = CONFIG.fixedStep;
function isolate(world: World): void {
  if (world.endless) isolateEndless(world);
  world.bossSpawned = true;
  world.player.cooldown = 1000;
  world.player.shield = 100000;
}
function fixture(stageIndex = 7): World {
  const world = new World(CONFIG.width, defaultProfile());
  expect(world.start(4)).toBe(true);
  world.stageIndex = stageIndex;
  isolate(world);
  return world;
}
function leader(world: World, overrides: Partial<Enemy> = {}): Enemy {
  return enemy(world, {
    kind: "boss",
    role: "boss",
    x: 100,
    defenseX: 100,
    y: 300,
    hp: 1_000_000_000,
    maxHp: 1_000_000_000,
    trainingCredit: 0,
    speed: 0,
    arrived: true,
    stage: "Attacking",
    attackPolicy: { type: "anywhere" },
    preparation: 0,
    shotCooldown: 1000,
    patternCooldown: 1000,
    skillsUsed: 3,
    ...overrides,
  });
}
function startCast(world: World, entity: Enemy): void {
  entity.patternCooldown = 0;
  world.update(STEP);
  expect(entity.telegraph).toBeGreaterThan(0);
}
function shoot(world: World, entity: Enemy, damage = 1, primary = true): void {
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
  world.update(STEP);
}
function confirmations(world: World): Map<number, number> {
  const map: unknown = Reflect.get(world, "counterFocusConfirmations");
  if (!(map instanceof Map)) throw new Error("Missing confirmation map");
  return map as Map<number, number>;
}
function frost(world: World): void {
  for (let index = 0; index < 6; index++) {
    const card = eligibleCards(world.player, world.stacks).find((item) => item.synergy === "frost");
    if (!card || !applyCard(card.id, world.player, world.stacks)) throw new Error("Frost fixture");
  }
}

describe("visible leader cast confirmation and entry preparation", () => {
  test("same-target input and T confirm only the current visible cast; sticky/auto/C do not", () => {
    const world = fixture();
    const entity = leader(world);
    expect(world.selectTargetAt(entity)).toBe(true);
    expect(world.counterFocusConfirmed(entity)).toBe(false);
    startCast(world, entity);
    expect(world.manualTargetId).toBe(entity.id);
    expect(world.counterFocusConfirmed(entity)).toBe(false);
    world.update(STEP);
    expect(world.counterFocusConfirmed(entity)).toBe(false);
    world.clearTarget();
    expect(world.targetId).toBe(entity.id);
    expect(world.counterFocusConfirmed(entity)).toBe(false);
    expect(world.selectTargetAt(entity)).toBe(true);
    expect(world.counterFocusConfirmed(entity)).toBe(true);
    const firstCast = entity.castId;
    tick(world, 2.4);
    expect(entity.telegraph).toBe(0);
    expect(world.counterFocusConfirmed(entity)).toBe(false);
    expect(confirmations(world).has(entity.id)).toBe(false);
    startCast(world, entity);
    expect(entity.castId).toBe(firstCast + 1);
    expect(world.manualTargetId).toBe(entity.id);
    expect(world.counterFocusConfirmed(entity)).toBe(false);
    world.cycleTarget();
    expect(world.counterFocusConfirmed(entity)).toBe(true);
    expect(confirmations(world).get(entity.id)).toBe(entity.castId);
  });

  test("forming input confirms immediately but a real primary cannot gain early interrupt credit", () => {
    const world = fixture();
    const entity = leader(world);
    startCast(world, entity);
    expect(world.selectTargetAt(entity)).toBe(true);
    expect(world.counterFocusConfirmed(entity)).toBe(true);
    const hp = entity.hp;
    shoot(world, entity);
    expect(entity.hp).toBeLessThan(hp);
    expect(entity.primaryHits).toBe(1);
    expect(entity.interruptHits).toBe(0);
    expect(entity.telegraph).toBeGreaterThan(2.3);
  });

  test("unconfirmed primaries still damage and proc Frost; only confirmed current targets gain hits", () => {
    const world = fixture();
    frost(world);
    const entity = leader(world);
    startCast(world, entity);
    tick(world, 0.85);
    const hp = entity.hp;
    for (let index = 0; index < 4; index++) shoot(world, entity);
    expect(entity.hp).toBeLessThan(hp);
    expect(entity.primaryHits).toBe(4);
    expect(entity.receivedHits).toBe(4);
    expect(world.controlProcs).toBe(1);
    expect(entity.stunTime).toBeGreaterThan(0);
    expect(world.counterFocusConfirmed(entity)).toBe(false);
    expect(entity.interruptHits).toBe(0);
    world.selectTargetAt(entity);
    shoot(world, entity);
    expect(entity.interruptHits).toBe(1);
    const other = leader(world, { x: 350, defenseX: 350 });
    world.selectTargetAt(other);
    shoot(world, entity);
    expect(entity.interruptHits).toBe(1);
  });

  test("the damage-only route interrupts without confirmation or counted primaries", () => {
    const world = fixture();
    const entity = leader(world);
    startCast(world, entity);
    tick(world, 0.85);
    expect(world.counterFocusConfirmed(entity)).toBe(false);
    shoot(world, entity, 120_000_000, false);
    expect(entity.active).toBe(true);
    expect(entity.interruptHits).toBe(0);
    expect(entity.telegraph).toBe(0);
    expect(entity.vulnerableTime).toBeGreaterThan(1.9);
    expect(world.bossInterrupts).toBe(1);
  });

  test("first preparation uses hostile time through CC; pause/sanctuary freeze and later recovery does not", () => {
    const world = fixture();
    const entity = leader(world, {
      kind: "tank",
      role: "elite",
      stage: "Preparing",
      preparation: 0.05,
      castId: 0,
      patternCooldown: 0,
      stunTime: 10,
      slow: 0.7,
      slowTime: 10,
    });
    expect(world.pause()).toBe(true);
    tick(world, 0.1);
    expect(entity.preparation).toBe(0.05);
    expect(world.resume()).toBe(true);
    world.sanctuaryRemaining = 0.5;
    tick(world, 0.1);
    expect(entity.preparation).toBe(0.05);
    expect(entity.castId).toBe(0);
    world.sanctuaryRemaining = 0;
    tick(world, 0.05);
    expect(entity.preparation).toBe(0);
    expect(entity.castId).toBe(1);
    expect(entity.telegraph).toBeCloseTo(2.4, 8);
    expect(entity.stunTime).toBeGreaterThan(9);
    tick(world, 2.4);
    expect(entity.lastSkill).toBe("ward");
    expect(entity.telegraph).toBe(0);
    expect(world.bossSpecials).toBe(1);
    const recovery = entity.patternCooldown;
    tick(world, 0.5);
    expect(entity.patternCooldown).toBe(recovery);
    expect(entity.castId).toBe(1);
  });

  test("approaching still needs permission and a positive debug cooldown falls back without hanging", () => {
    const world = fixture();
    const approaching = leader(world, {
      kind: "tank",
      role: "elite",
      stage: "Approaching",
      y: -30,
      preparation: 0,
      castId: 0,
      patternCooldown: 0,
      stunTime: 10,
    });
    tick(world, 0.1);
    expect(approaching.stage).toBe("Approaching");
    expect(approaching.castId).toBe(0);
    approaching.y = 100;
    world.update(STEP);
    expect(approaching.stage).toBe("Preparing");
    expect(approaching.preparation).toBeGreaterThan(0);
    const debugWorld = fixture();
    const delayed = leader(debugWorld, {
      kind: "tank",
      role: "elite",
      stage: "Preparing",
      preparation: STEP,
      castId: 0,
      patternCooldown: 1,
      stunTime: 10,
    });
    debugWorld.update(STEP);
    expect(delayed.stage).toBe("Attacking");
    expect(delayed.patternCooldown).toBe(1);
    expect(delayed.castId).toBe(0);
    tick(debugWorld, 0.1);
    expect(delayed.patternCooldown).toBe(1);
    delayed.stunTime = 0;
    tick(debugWorld, 0.5);
    expect(delayed.patternCooldown).toBeCloseTo(0.5, 8);
    tick(debugWorld, 0.6);
    expect(delayed.castId).toBe(1);
    expect(delayed.telegraph).toBeGreaterThan(0);
  });

  test("death/pool reuse and PRE direct removal/explicit-input prune/reset keep confirmation bounded", () => {
    const world = fixture();
    const dead = leader(world, { kind: "tank", role: "elite" });
    startCast(world, dead);
    world.selectTargetAt(dead);
    const deadId = dead.id;
    expect(confirmations(world).has(deadId)).toBe(true);
    shoot(world, dead, dead.maxHp * 2);
    expect(confirmations(world).has(deadId)).toBe(false);
    const spawn = Reflect.get(world, "spawnEnemy") as (
      kind: EnemyKind,
      x: number,
      enhanced: boolean,
      options: { role: "elite" },
    ) => Enemy | undefined;
    const reused = spawn.call(world, "wizard", 100, false, { role: "elite" });
    expect(reused).toBe(dead);
    expect(reused?.id).not.toBe(deadId);
    if (!reused) throw new Error("Expected the freed enemy slot to be reusable");
    expect(world.counterFocusConfirmed(reused)).toBe(false);
    const debug = new DebugWorld(CONFIG.width, defaultProfile());
    expect(debug.start(4)).toBe(true);
    debug.execute({ type: "jump", stage: 8, fresh: true });
    expect(debug.resume()).toBe(true);
    isolate(debug);
    const a = leader(debug, { kind: "tank", role: "elite", patternCooldown: 0 });
    const b = leader(debug, {
      kind: "wizard",
      role: "elite",
      x: 350,
      defenseX: 350,
      patternCooldown: 0,
    });
    debug.update(STEP);
    debug.selectTargetAt(a);
    debug.selectTargetAt(b);
    const map = confirmations(debug);
    expect(map.size).toBe(2);
    debug.execute({ type: "remove", ids: [a.id] });
    expect(map.has(a.id)).toBe(true);
    expect(debug.resume()).toBe(true);
    debug.selectTargetAt(b);
    expect(map.size).toBe(1);
    expect(map.has(a.id)).toBe(false);
    const clear = Reflect.get(debug, "clearCombat") as () => void;
    clear.call(debug);
    expect(map.size).toBe(0);
    const c = leader(debug, { kind: "tank", role: "elite" });
    startCast(debug, c);
    debug.selectTargetAt(c);
    expect(map.size).toBe(1);
    debug.execute({ type: "restart", restoreEntry: false });
    expect(map.size).toBe(0);
  });

  test("campaign and depths1–3 preserve automatic hit interruption and stun-frozen preparation", () => {
    for (const stageIndex of [0, 4, 5, 6]) {
      const world = fixture(stageIndex);
      const entity = leader(world);
      startCast(world, entity);
      for (let index = 0; index < 4; index++) shoot(world, entity);
      expect(world.counterFocusConfirmed(entity)).toBe(false);
      expect(entity.interruptHits).toBe(4);
      expect(entity.telegraph).toBe(0);
      expect(world.bossInterrupts).toBe(1);
      const preparing = leader(world, {
        kind: "tank",
        role: "elite",
        stage: "Preparing",
        preparation: STEP,
        castId: 0,
        patternCooldown: 0,
        stunTime: 10,
      });
      tick(world, 0.1);
      expect(preparing.preparation).toBe(STEP);
      expect(preparing.telegraph).toBe(0);
      expect(preparing.castId).toBe(0);
    }
  });
});
