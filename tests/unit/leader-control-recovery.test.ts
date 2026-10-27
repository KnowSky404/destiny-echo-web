import { describe, expect, test } from "bun:test";
import { defaultProfile } from "../../src/data/balance/profile";
import { applyCard, eligibleCards } from "../../src/data/cards";
import { CONFIG } from "../../src/game/config";
import type { WorldObservation } from "../../src/game/observation";
import type { Enemy, EnemyKind, EnemyRole } from "../../src/game/types";
import { World } from "../../src/game/world";
import { enemy, enterBossEncounter, isolateEndless, tick } from "./helpers";

function arena(endless = true, frost = 6): World {
  const world = new World(CONFIG.width, defaultProfile());
  world.start(31);
  if (endless) {
    world.stageIndex = 4;
    isolateEndless(world);
  }
  world.bossSpawned = true;
  world.player.cooldown = 1000;
  for (let index = 0; index < frost; index++) {
    const card = eligibleCards(world.player, world.stacks).find((item) => item.synergy === "frost");
    if (!card || !applyCard(card.id, world.player, world.stacks))
      throw new Error("Missing legal frost fixture card");
  }
  return world;
}

function stationary(world: World, kind: EnemyKind, role: EnemyRole): Enemy {
  return enemy(world, {
    kind,
    role,
    x: 100,
    defenseX: 100,
    y: 300,
    speed: 0,
    hp: 1000000,
    maxHp: 1000000,
    trainingCredit: 0,
    arrived: true,
    stage: "Attacking",
    attackPolicy: { type: "anywhere" },
    shotCooldown: 1000,
    patternCooldown: 1000,
  });
}

/** Real projectile collision, including secondary hits that still count for frost. */
function strike(world: World, target: Enemy, primary = false, damage = 1): void {
  const shot = world.shots.acquire();
  if (!shot) throw new Error("Missing shot fixture");
  Object.assign(shot, {
    x: target.x,
    y: target.y,
    previousX: target.x,
    previousY: target.y,
    vx: 0,
    vy: 0,
    damage,
    radius: 4,
    lifetime: 1,
    hitsLeft: 1,
    targetId: target.id,
    primary,
    critical: false,
  });
  shot.hitIds.clear();
  world.update(CONFIG.fixedStep);
}

function burst(world: World, target: Enemy, hits = 4, primary = false): void {
  for (let index = 0; index < hits; index++) strike(world, target, primary);
}

const LEADERS = [
  { kind: "boss", role: "boss", duration: 0.15 },
  { kind: "tank", role: "elite", duration: 0.6 },
  { kind: "wizard", role: "elite", duration: 0.6 },
] as const;

function recoveryTable(world: World): Map<number, number> {
  const table: unknown = Reflect.get(world, "leaderStunRecoveryTimes");
  if (!(table instanceof Map)) throw new Error("Leader control lifecycle table missing");
  return table;
}

describe("endless leader control recovery", () => {
  test.each(["boss", "elite"] as const)(
    "a native %s starts its first visible charge promptly after preparation",
    (role) => {
      const profile = defaultProfile();
      profile.payload.endless.supplies = 0;
      profile.payload.stageRules = [
        {
          from: 5,
          to: null,
          stage: { enemyCount: 0, supportCount: 0 },
          kindWeights: null,
          rewards: {},
        },
      ];
      const observations: WorldObservation[] = [];
      const world = new World(CONFIG.width, profile, (event) => observations.push(event));
      world.start(41);
      world.stageIndex = 4;
      world.player.cooldown = 1000;
      if (role === "boss") enterBossEncounter(world);
      tick(world, 3.5);
      const leader = world.enemies.items.find((item) => item.active && item.role === role);
      expect(leader).toBeDefined();
      const opening = observations.find(
        (event) =>
          event.type === "mechanic" && event.source === "cast_start" && event.role === role,
      );
      expect(opening).toBeDefined();
      expect(opening?.elapsed).toBeLessThan(3.5);
      expect(leader?.telegraph).toBeGreaterThan(0);
      expect(leader?.castSkill).not.toBeNull();
    },
  );

  test.each(LEADERS)(
    "$kind preserves secondary-hit frost but cannot refresh it until duration plus recovery ends",
    ({ kind, role, duration }) => {
      const world = arena();
      const target = stationary(world, kind, role);
      burst(world, target);
      expect(target.receivedHits).toBe(4);
      expect(target.primaryHits).toBe(0);
      expect(world.controlProcs).toBe(1);
      const first = target.stunTime;
      expect(first).toBeCloseTo(duration - CONFIG.fixedStep, 8);
      burst(world, target);
      expect(target.stunTime).toBeCloseTo(first - 4 * CONFIG.fixedStep, 8);
      expect(world.controlProcs).toBe(1);

      // This is after the accepted stun, but still inside its extra 0.4s grace.
      tick(world, duration + 0.25);
      expect(target.stunTime).toBe(0);
      burst(world, target);
      expect(target.stunTime).toBe(0);
      expect(world.controlProcs).toBe(1);
      tick(world, 0.2);
      burst(world, target);
      expect(target.stunTime).toBeGreaterThan(0);
      expect(world.controlProcs).toBe(2);
    },
  );

  test("nine-layer frost keeps its three-hit, one-second freeze on an elite", () => {
    const world = arena(true, 9);
    const target = stationary(world, "tank", "elite");
    burst(world, target, 3);
    expect(target.primaryHits).toBe(0);
    expect(target.stunTime).toBeCloseTo(1 - CONFIG.fixedStep, 8);
    burst(world, target, 3);
    expect(target.stunTime).toBeCloseTo(1 - 4 * CONFIG.fixedStep, 8);
    expect(world.controlProcs).toBe(1);
  });

  test.each([
    { endless: true, kind: "wisp", role: "minion", duration: 0.6 },
    { endless: false, kind: "boss", role: "boss", duration: 0.15 },
  ] as const)(
    "ordinary refresh rules remain intact for endless=$endless, role=$role",
    ({ endless, kind, role, duration }) => {
      const world = arena(endless);
      const target = stationary(world, kind, role);
      burst(world, target);
      burst(world, target);
      expect(target.stunTime).toBeCloseTo(duration - CONFIG.fixedStep, 8);
      expect(world.controlProcs).toBe(2);
    },
  );

  test.each(LEADERS)(
    "pause and sanctuary freeze $kind control recovery",
    ({ kind, role, duration }) => {
      const world = arena();
      const target = stationary(world, kind, role);
      burst(world, target);
      expect(world.pause()).toBe(true);
      const paused = world.snapshot();
      tick(world, 2);
      expect(world.snapshot()).toEqual(paused);
      expect(world.resume()).toBe(true);
      const frozenStun = target.stunTime;
      world.sanctuaryRemaining = 0.8;
      tick(world, 0.6);
      burst(world, target);
      expect(target.stunTime).toBe(frozenStun);
      expect(world.controlProcs).toBe(1);
      tick(world, 0.2);
      tick(world, duration + 0.25);
      burst(world, target);
      expect(target.stunTime).toBe(0);
      expect(world.controlProcs).toBe(1);
      tick(world, 0.2);
      burst(world, target);
      expect(target.stunTime).toBeGreaterThan(0);
      expect(world.controlProcs).toBe(2);
    },
  );

  test.each(LEADERS)(
    "$kind recovery still allows damage, slow and four-primary-hit cast interruption",
    ({ kind, role, duration }) => {
      const world = arena();
      const target = stationary(world, kind, role);
      burst(world, target);
      tick(world, duration + 0.1);
      expect(target.stunTime).toBe(0);
      target.castSkill = role === "boss" ? "slam" : "ward";
      target.telegraph = 2.4;
      target.interruptRequired = 1000000000;
      target.interruptDamage = 0;
      target.interruptHits = 0;
      const hp = target.hp;
      burst(world, target, 4, true);
      expect(target.hp).toBeLessThan(hp);
      expect(target.slow).toBeGreaterThan(0);
      expect(target.slowTime).toBeGreaterThan(0);
      expect(target.telegraph).toBe(0);
      expect(target.castSkill).toBeNull();
      expect(target.vulnerableTime).toBeGreaterThan(0);
      expect(world.bossInterrupts).toBe(1);
      expect(target.stunTime).toBe(0);
      expect(world.controlProcs).toBe(1);
    },
  );

  test("defeat and restart release leader recovery entries without affecting another body", () => {
    const world = arena();
    const target = stationary(world, "boss", "boss");
    const survivor = enemy(world, {
      x: 350,
      defenseX: 350,
      y: 300,
      hp: 1000000,
      maxHp: 1000000,
      speed: 0,
      shotCooldown: 1000,
    });
    burst(world, target);
    expect(recoveryTable(world).has(target.id)).toBe(true);
    const defeatedId = target.id;
    strike(world, target, true, 2000000);
    expect(target.active).toBe(false);
    expect(survivor.active).toBe(true);
    expect(world.clearPresentationRemaining).toBe(0);
    expect(recoveryTable(world).has(defeatedId)).toBe(false);
    const next = stationary(world, "tank", "elite");
    burst(world, next);
    expect(next.stunTime).toBeGreaterThan(0);
    expect(recoveryTable(world).has(next.id)).toBe(true);
    expect(world.pause()).toBe(true);
    expect(world.toMenu()).toBe(true);
    expect(recoveryTable(world).size).toBe(0);
    expect(world.start(32)).toBe(true);
    expect(recoveryTable(world).size).toBe(0);
  });
});
