import { describe, expect, test } from "bun:test";
import { BASE_STATS } from "../../src/data/balance/model";
import { STAGES } from "../../src/data/stages";
import { CONFIG } from "../../src/game/config";
import type { WorldObservation } from "../../src/game/observation";
import type { BossPercentLimiter } from "../../src/game/systems/boss-damage";
import type { Enemy, EnemyKind, EnemyRole } from "../../src/game/types";
import { World } from "../../src/game/world";
import { enemy, hit, isolateEndless, tick } from "./helpers";

class BudgetWorld extends World {
  clearForTest(): void {
    this.clearCombat();
  }

  resetStageForTest(): void {
    this.resetStage();
  }

  spawnForTest(kind: EnemyKind): Enemy {
    const spawned = this.spawnEnemy(kind, this.arena.player.x);
    if (!spawned) throw new Error("Fixture spawn refused");
    return spawned;
  }
}

function fixture(depth = 7, endless = true): BudgetWorld {
  const world = new BudgetWorld();
  world.start(4);
  world.stageIndex = endless ? STAGES.length + depth - 1 : 1;
  if (endless) isolateEndless(world);
  Object.assign(world.player.stats, BASE_STATS);
  world.player.cooldown = 1000;
  return world;
}

function target(world: World, overrides: Partial<Enemy> = {}): Enemy {
  return enemy(world, {
    x: world.arena.player.x,
    y: 200,
    spawnX: world.arena.player.x,
    spawnY: 200,
    defenseX: world.arena.player.x,
    speed: 0,
    hp: 1000,
    maxHp: 1000,
    shotCooldown: 1000,
    ...overrides,
  });
}

// Only the entry to the normal damage pipeline is exposed. No limiter is replaced.
function damage(
  world: World,
  victim: Enemy,
  raw: number,
  source: "shot" | "arc" | "blast" | "counter" = "shot",
  primary = false,
  percent = 0,
): number {
  const before = victim.hp;
  const apply: (
    enemy: Enemy,
    raw: number,
    source: string,
    primary: boolean,
    percent: number,
  ) => void = Reflect.get(world, "damageEnemy").bind(world);
  apply(victim, raw, source, primary, percent);
  return before - victim.hp;
}

function limiters(world: World): Map<number, BossPercentLimiter> {
  return Reflect.get(world, "percentLimiters") as Map<number, BossPercentLimiter>;
}

describe("late endless minion percentage damage budget", () => {
  test("real primary projectiles retain raw damage after the burst is spent", () => {
    const world = fixture();
    world.player.stats.maxHealthDamage = 0.05;
    world.player.stats.currentHealthDamage = 0.1;
    const victim = target(world);

    hit(world, victim, 10);
    expect(victim.hp).toBeCloseTo(940, 8);
    hit(world, victim, 10);
    expect(940 - victim.hp).toBeCloseTo(10 + (1000 * 0.2) / 120, 8);
    expect(victim.primaryHits).toBe(2);
    expect(victim.active).toBe(true);
  });

  test("native primary, bloodpact blast and erosion pulse spend one same-step allowance", () => {
    const world = fixture();
    const events: WorldObservation[] = [];
    world.setObserver((event) => events.push(event));
    Object.assign(world.player.stats, {
      maxHealthDamage: 0.05,
      erosionPulse: 0.05,
      bloodpact: 1,
      maxHp: 1000,
    });
    Reflect.set(world, "bloodCooldown", 0);
    Reflect.set(world, "erosionCooldown", 0);
    const victim = target(world);

    hit(world, victim, 10);

    const amounts = (source: string) =>
      events
        .filter((event) => event.type === "enemy_damage" && event.source === source)
        .reduce((sum, event) => sum + (event.amount ?? 0), 0);
    expect(amounts("shot")).toBeCloseTo(60, 8);
    // Bloodpact's 20 fixed + 15% player max HP survives the spent percentage budget.
    expect(amounts("blast")).toBeCloseTo(170, 8);
    expect(amounts("arc")).toBe(0);
    expect(victim.hp).toBeCloseTo(770, 8);
    expect(world.explosionCount).toBe(1);
  });

  test("lazy damage and per-step refill share the bucket without starving a different enemy", () => {
    const world = fixture();
    const first = target(world);
    const second = target(world, { x: 400, spawnX: 400, defenseX: 400 });
    expect(damage(world, first, 0, "arc", false, 1000)).toBeCloseTo(50, 8);
    expect(damage(world, first, 7, "blast", false, 1000)).toBeCloseTo(7, 8);
    expect(damage(world, second, 0, "arc", false, 1000)).toBeCloseTo(50, 8);

    tick(world, 0.1);
    expect(damage(world, first, 0, "blast", false, 1000)).toBeCloseTo(20, 8);
    expect(damage(world, first, 0, "arc", false, 1000)).toBe(0);
    expect(damage(world, second, 0, "arc", false, 1000)).toBeCloseTo(20, 8);
    tick(world, 1);
    expect(damage(world, first, 0, "arc", false, 1000)).toBeCloseTo(50, 8);
    expect(damage(world, first, 0, "arc", false, 1000)).toBe(0);
  });

  test("star resistance and control modifiers resolve before spending the budget", () => {
    const world = fixture();
    world.player.stats.maxHealthDamage = 0.05;
    world.player.stats.control = 0.5;
    const victim = target(world, { stars: 3, stunTime: 5 });
    hit(world, victim, 10);
    // 10 * 1.5 raw + (1000 * .05 * 1.5) / 3 percentage.
    expect(victim.hp).toBeCloseTo(960, 8);
    expect(limiters(world).get(victim.id)?.snapshot().available).toBeCloseTo(25, 8);
  });

  test("campaign and all first six endless depths keep their previous percentage behavior", () => {
    for (const depth of [0, 1, 2, 3, 4, 5, 6]) {
      const world = fixture(depth || 1, depth !== 0);
      world.player.stats.maxHealthDamage = 0.05;
      world.player.stats.currentHealthDamage = 0.1;
      const victim = target(world);
      expect(damage(world, victim, 1, "shot", true)).toBeCloseTo(151, 8);
      expect(damage(world, victim, 1, "shot", true)).toBeCloseTo(135.9, 8);
      expect(limiters(world).has(victim.id)).toBe(false);
    }
  });

  test("boss and elite original rates and vulnerability still bound percentages and weak points", () => {
    for (const role of ["boss", "elite"] as const satisfies readonly EnemyRole[]) {
      const world = fixture();
      const rate = role === "boss" ? 0.025 : 0.05;
      const ordinary = target(world, { role });
      expect(damage(world, ordinary, 0, "arc", false, 1000)).toBeCloseTo(1000 * rate * 0.25, 8);
      const exposed = target(world, { role, vulnerableTime: 2 });
      // The weak point uses the remaining allowance after the percentage request.
      const weakPoint = Math.min(13.5, 1000 * rate * 2 * 0.25);
      expect(damage(world, exposed, 1, "shot", true)).toBeCloseTo(1.35 + weakPoint, 8);
      const remaining = 1000 * rate * 2 * 0.25 - weakPoint;
      expect(damage(world, exposed, 0, "arc", false, 1000)).toBeCloseTo(remaining, 8);
    }
  });

  test("raw giant amplification and execution do not spend or obey the percentage allowance", () => {
    const world = fixture();
    const victim = target(world);
    damage(world, victim, 0, "arc", false, 1000);
    world.player.stats.giantPower = 1;
    expect(damage(world, victim, 10)).toBeCloseTo(10 * (1 + Math.log2(11)), 8);
    world.stacks.set("execution", 9);
    victim.hp = 101;
    expect(damage(world, victim, 1, "counter")).toBe(101);
    expect(world.executions).toBe(1);
    expect(victim.active).toBe(false);
  });

  test("pause and reward selection never refill a spent bucket", () => {
    const world = fixture();
    const victim = target(world);
    damage(world, victim, 0, "arc", false, 1000);
    const elapsed = world.elapsed;
    expect(world.pause()).toBe(true);
    tick(world, 1);
    expect(limiters(world).get(victim.id)?.snapshot().available).toBe(0);
    expect(world.resume()).toBe(true);
    expect(world.state.transition("RewardSelection")).toBe(true);
    tick(world, 1);
    expect(limiters(world).get(victim.id)?.snapshot().available).toBe(0);
    expect(world.elapsed).toBe(elapsed);
    expect(world.state.transition("Playing")).toBe(true);
    world.update(CONFIG.fixedStep);
    expect(damage(world, victim, 0, "arc", false, 1000)).toBeCloseTo(200 / 120, 8);
  });

  test("Sanctuary freezes hostile time while player time refills the percentage allowance", () => {
    const world = fixture();
    const victim = target(world);
    damage(world, victim, 0, "arc", false, 1000);
    world.sanctuaryRemaining = 1;
    const hostileBefore = world.stageElapsed;
    const playerBefore = world.elapsed;
    tick(world, 0.1);
    expect(world.stageElapsed).toBe(hostileBefore);
    expect(world.elapsed - playerBefore).toBeCloseTo(0.1, 8);
    expect(damage(world, victim, 0, "arc", false, 1000)).toBeCloseTo(20, 8);
  });

  test("native fusion preserves the anchor's spent allowance and removes donor buckets", () => {
    const world = fixture();
    const group = [0, 1, 2].map((index) =>
      target(world, {
        x: 190 + index * 10,
        spawnX: 190 + index * 10,
        defenseX: 190 + index * 10,
        age: CONFIG.fusion.grace,
      }),
    );
    const [anchor, ...donors] = group;
    if (!anchor) throw new Error("Missing fusion anchor");
    for (const member of group) damage(world, member, 0, "arc", false, 1000);
    anchor.fusionPeers = group.map((member) => member.id).join(":");
    anchor.fusionTime = CONFIG.fusion.duration - CONFIG.fixedStep;
    world.update(CONFIG.fixedStep);

    expect(world.fusions).toBe(1);
    expect(anchor.stars).toBe(2);
    expect(anchor.hp).toBe(anchor.maxHp);
    expect(anchor.maxHp).toBe(3500);
    for (const donor of donors) {
      expect(donor.active).toBe(false);
      expect(limiters(world).has(donor.id)).toBe(false);
    }
    expect(damage(world, anchor, 0, "arc", false, 1000)).toBeCloseTo(200 / 120, 8);
    expect(limiters(world).get(anchor.id)?.snapshot().capacity).toBeCloseTo(175, 8);
  });

  test("death and native pool reuse cannot carry a spent budget into a new enemy", () => {
    const world = fixture();
    const first = world.spawnForTest("wisp");
    const oldId = first.id;
    damage(world, first, 0, "arc", false, first.maxHp);
    expect(limiters(world).has(oldId)).toBe(true);
    damage(world, first, first.maxHp, "counter");
    expect(limiters(world).has(oldId)).toBe(false);
    const recycled = world.spawnForTest("wisp");
    expect(recycled).toBe(first);
    expect(recycled.id).not.toBe(oldId);
    expect(damage(world, recycled, 0, "arc", false, recycled.maxHp)).toBeCloseTo(
      recycled.maxHp * 0.05,
      8,
    );
  });

  test("combat clearing and stage reset discard all target allowances", () => {
    const world = fixture();
    const first = target(world);
    damage(world, first, 0, "arc", false, 1000);
    expect(limiters(world).size).toBe(1);
    world.clearForTest();
    expect(limiters(world).size).toBe(0);
    const second = target(world);
    damage(world, second, 0, "arc", false, 1000);
    expect(limiters(world).size).toBe(1);
    world.resetStageForTest();
    expect(limiters(world).size).toBe(0);
    expect(world.enemies.items.some((member) => member.active)).toBe(false);
  });
});
