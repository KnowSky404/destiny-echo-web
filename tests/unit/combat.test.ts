import { describe, expect, test } from "bun:test";
import { applyCard } from "../../src/data/cards";
import { ENEMIES } from "../../src/data/enemies";
import { CONFIG } from "../../src/game/config";
import { attackPermitted } from "../../src/game/systems/enemy";
import { chooseTarget } from "../../src/game/systems/targeting";
import type { EnemyStage } from "../../src/game/types";
import { World } from "../../src/game/world";
import { enemy, tick } from "./helpers";

function arena(): World {
  const world = new World();
  world.start(7);
  // Isolate mechanics from the wave schedule, without changing combat rules.
  world.bossSpawned = true;
  return world;
}

describe("targeting and real projectile coverage", () => {
  test.each([57, 393])("kills a moving target at lateral x=%s", (x) => {
    const world = arena();
    const target = enemy(world, { x, defenseX: x, y: 280, hp: 12 });
    tick(world, 1.5);
    expect(target.active).toBe(false);
    expect(world.kills).toBe(1);
    expect(world.player.x).toBe(CONFIG.player.x);
  });

  test("an off-center chest opens through homing fire and freezes every combat subsystem", () => {
    const world = arena();
    const chest = world.chests.acquire();
    if (!chest) throw new Error("No chest");
    Object.assign(chest, { id: 8000, x: 400, y: 240, hp: 36, maxHp: 36, radius: 26, age: 0 });
    world.selectTargetAt(chest);
    tick(world, 2);
    expect(world.phase).toBe("RewardSelection");
    expect(world.manualTargetId).toBeNull();
    expect(world.openedChests).toBe(1);
    const before = world.snapshot();
    const allEntities = structuredClone([
      world.enemies.items,
      world.shots.items,
      world.hostileShots.items,
      world.particles.items,
    ]);
    tick(world, 4);
    expect(world.snapshot()).toEqual(before);
    expect([
      world.enemies.items,
      world.shots.items,
      world.hostileShots.items,
      world.particles.items,
    ]).toEqual(allEntities);
  });

  test("threat bands preempt lower priorities but retain the lock within the same band", () => {
    const world = arena();
    const left = enemy(world, { x: 57, y: 200 });
    const right = enemy(world, { x: 393, defenseX: 393, y: 210 });
    expect(chooseTarget(world.targets, left.id, null)?.id).toBe(left.id);
    right.y = CONFIG.defense.dangerY;
    expect(chooseTarget(world.targets, left.id, null)?.id).toBe(right.id);
    left.stage = "Preparing";
    expect(chooseTarget(world.targets, right.id, null)?.id).toBe(left.id);
    right.stage = "Attacking";
    expect(chooseTarget(world.targets, left.id, null)?.id).toBe(left.id);
    expect(chooseTarget(world.targets, left.id, right.id)?.id).toBe(right.id);
    const boss = enemy(world, { kind: "boss", y: 120 });
    const chest = world.chests.acquire();
    if (!chest) throw new Error("No chest");
    Object.assign(chest, { id: 8000, x: 100, y: 240, hp: 36 });
    expect(chooseTarget([boss, chest], chest.id, null)?.id).toBe(boss.id);
  });

  test("manual priority changes actual fire, empty clicks cancel, and dead locks recover", () => {
    const world = arena();
    const left = enemy(world, { x: 57, defenseX: 57, y: 350, hp: 100 });
    const right = enemy(world, { x: 393, defenseX: 393, y: 350, hp: 12, speed: 0 });
    world.selectTargetAt(right);
    expect(world.manualTargetId).toBe(right.id);
    world.update(CONFIG.fixedStep);
    expect(world.shots.items[0]?.targetId).toBe(right.id);
    tick(world, 0.9);
    expect(right.active).toBe(false);
    expect(world.manualTargetId).toBeNull();
    expect(world.targetId).toBe(left.id);
    tick(world, 0.5);
    expect(left.hp).toBeLessThan(100);
    world.selectTargetAt(left);
    world.selectTargetAt({ x: 225, y: 780 });
    expect(world.manualTargetId).toBeNull();
    world.pause();
    expect(world.selectTargetAt(left)).toBe(false);
  });

  test("overlapping hits prefer the actual body, then distance, with deterministic ties", () => {
    const world = arena();
    const first = enemy(world, { x: 200, y: 300 });
    const second = enemy(world, { x: 220, y: 300 });
    world.selectTargetAt({ x: 220, y: 300 }, 36);
    expect(world.manualTargetId).toBe(second.id);
    second.x = first.x;
    world.selectTargetAt(first);
    expect(world.manualTargetId).toBe(first.id);
  });

  test("extra projectiles split damage across targets and piercing reaches a second enemy", () => {
    const split = arena();
    split.player.stats.projectiles = 2;
    const left = enemy(split, { x: 57, defenseX: 57, y: 400, hp: 100 });
    const right = enemy(split, { x: 393, defenseX: 393, y: 400, hp: 100 });
    split.update(CONFIG.fixedStep);
    expect(new Set(split.shots.items.map((shot) => shot.targetId)).size).toBe(2);
    tick(split, 0.7);
    expect(left.hp).toBeLessThan(100);
    expect(right.hp).toBeLessThan(100);
    const pierce = arena();
    pierce.player.stats.piercing = 1;
    const near = enemy(pierce, {
      x: 225,
      defenseX: 225,
      y: 620,
      arrived: true,
      hp: 1000,
      maxHp: 1000,
    });
    const far = enemy(pierce, {
      x: 225,
      defenseX: 225,
      y: 540,
      defenseY: 540,
      arrived: true,
      hp: 1000,
      maxHp: 1000,
    });
    tick(pierce, 0.3);
    expect(near.hp).toBe(988);
    expect(far.hp).toBe(988);
  });

  test("lost-target shots expire and pool reuse cannot preserve a stale manual lock", () => {
    const world = new World();
    world.start(2);
    tick(world, 1);
    const old = world.enemies.items.find((item) => item.active);
    if (!old) throw new Error("No scheduled enemy");
    old.y = 300;
    world.selectTargetAt(old);
    const oldId = old.id;
    old.active = false;
    old.stage = "Attacking";
    old.arrived = true;
    old.telegraph = 2;
    old.interruptDamage = 999;
    tick(world, 1.3);
    expect(old.id).not.toBe(oldId);
    expect(old.active).toBe(true);
    expect(world.enemies.items.find((item) => item.active)?.stage).toBe("Approaching");
    expect(old.arrived).toBe(false);
    expect(old.telegraph + old.preparation + old.interruptDamage).toBe(0);
    expect(world.manualTargetId).toBeNull();
    for (const item of world.enemies.items) item.active = false;
    world.bossSpawned = true;
    tick(world, CONFIG.friendlyShot.lifetime + 0.1);
    expect(world.shots.items.every((shot) => !shot.active)).toBe(true);
    expect(world.targetId).toBeNull();
  });
});

describe("approach, defense and attack permission", () => {
  test("approach emits nothing, arrival happens once, preparation delays the first attack", () => {
    const world = arena();
    world.player.cooldown = 100;
    const target = enemy(world, { y: 600 });
    tick(world, 0.16);
    expect(target.stage).toBe("Approaching");
    expect(target.y).toBeGreaterThan(600);
    expect(world.enemyAttacks).toBe(0);
    tick(world, 0.025);
    expect(target.y).toBe(CONFIG.defense.y);
    expect(target.stage).toBe("Preparing");
    expect(world.arrivals).toBe(1);
    tick(world, ENEMIES.wisp.preparation - 0.03);
    expect(world.enemyAttacks).toBe(0);
    tick(world, 0.05);
    expect(target.stage).toBe("Attacking");
    expect(world.enemyAttacks).toBe(1);
    expect(world.arrivals).toBe(1);
    tick(world, ENEMIES.wisp.interval + 0.01);
    expect(world.enemyAttacks).toBe(2);
    expect(target.y).toBe(CONFIG.defense.y);
  });

  test("several enemies attack independently; a last-step kill cancels an unreleased attack", () => {
    const world = arena();
    world.player.cooldown = 100;
    world.player.shield = 100;
    const first = enemy(world, { y: 620, arrived: true, stage: "Attacking" });
    enemy(world, {
      kind: "sentinel",
      x: 393,
      defenseX: 393,
      y: 620,
      arrived: true,
      stage: "Attacking",
    });
    tick(world, 0.1);
    expect(world.enemyAttacks).toBe(2);
    first.active = false;
    tick(world, 4);
    expect(world.enemyAttacks).toBe(3);
    const cancel = arena();
    const preparing = enemy(cancel, {
      x: 225,
      defenseX: 225,
      y: 620,
      arrived: true,
      stage: "Preparing",
      preparation: 0.001,
      hp: 12,
    });
    const shot = cancel.shots.acquire();
    if (!shot) throw new Error("No shot");
    Object.assign(shot, {
      x: 225,
      y: 620,
      vx: 0,
      vy: 0,
      damage: 12,
      lifetime: 1,
      targetId: preparing.id,
    });
    cancel.update(CONFIG.fixedStep);
    expect(preparing.active).toBe(false);
    tick(cancel, 2);
    expect(cancel.enemyAttacks).toBe(0);
  });

  test("a released attack remains dangerous after its source dies", () => {
    const world = arena();
    world.player.cooldown = 100;
    const target = enemy(world, {
      kind: "hexer",
      x: 225,
      defenseX: 225,
      y: 620,
      arrived: true,
      stage: "Attacking",
    });
    world.update(CONFIG.fixedStep);
    expect(world.enemyAttacks).toBe(1);
    target.active = false;
    tick(world, 1);
    expect(world.player.hp).toBe(100 - ENEMIES.hexer.damage);
    expect(world.enemyAttacks).toBe(1);
  });

  test("melee enemies require the defense and ranged policies can attack earlier", () => {
    for (const kind of ["wisp", "sentinel", "boss"] as const)
      expect(ENEMIES[kind].attackPolicy).toEqual({ type: "defense" });
    expect(ENEMIES.hexer.attackPolicy).toEqual({ type: "region", y: 120 });
    const world = arena();
    world.player.cooldown = 100;
    const target = enemy(world, {
      kind: "hexer",
      y: 200,
      attackPolicy: { type: "region", y: 220 },
    });
    expect(attackPermitted(target)).toBe(false);
    tick(world, 1.8);
    expect(target.y).toBeLessThan(CONFIG.defense.y);
    expect(world.enemyAttacks).toBe(1);
    target.attackPolicy = { type: "defense" };
    world.update(CONFIG.fixedStep);
    expect(target.stage).toBe("Approaching");
    expect(target.telegraph).toBe(0);
    target.attackPolicy = { type: "anywhere" };
    tick(world, ENEMIES.hexer.preparation + 0.05);
    expect(world.enemyAttacks).toBe(2);
  });

  test("defense slots stay distinct and bounded, and a full pool cannot block the boss", () => {
    const world = new World();
    world.start(1);
    world.player.cooldown = 100;
    world.player.shield = 10000;
    tick(world, 40);
    const active = world.enemies.items.filter((item) => item.active);
    expect(active.length).toBe(world.stage.maxEnemies);
    expect(new Set(active.map((item) => item.slot)).size).toBe(active.length);
    const stopped = active.filter((item) => item.arrived);
    expect(stopped.length).toBeGreaterThan(7);
    for (let a = 0; a < stopped.length; a++) {
      for (let b = a + 1; b < stopped.length; b++) {
        const first = stopped[a];
        const second = stopped[b];
        if (!first || !second) throw new Error("Missing slot");
        expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThan(
          first.radius + second.radius,
        );
      }
    }
    tick(world, 12.1);
    expect(world.boss?.stage).toBe("Approaching");
    expect(world.enemies.items.filter((item) => item.active).length).toBe(3);
    expect(world.enemies.items.some((item) => item.active && item.kind === "hexer")).toBe(true);
  });
});

describe("boss counterplay, execution and endings", () => {
  test("a charge expiry releases exactly once despite floating-point timer residue", () => {
    const world = arena();
    world.player.cooldown = 100;
    const boss = enemy(world, {
      kind: "boss",
      x: 225,
      defenseX: 225,
      y: 620,
      arrived: true,
      stage: "Attacking",
      telegraph: 2,
      interruptRequired: 90,
    });
    tick(world, 2.1);
    expect(world.bossSpecials).toBe(1);
    expect(world.enemyAttacks).toBe(1);
    expect(boss.telegraph).toBe(0);
    tick(world, 0.3);
    expect(world.bossSpecials).toBe(1);
  });
  test("the scheduled boss moves to the defense and releases a damaging special", () => {
    const world = new World();
    world.start(8);
    world.stageElapsed = world.stage.bossAt - 0.01;
    world.player.cooldown = 100;
    world.player.shield = 100;
    tick(world, 0.1);
    expect(world.boss?.y).toBeLessThan(0);
    expect(world.enemyAttacks).toBe(0);
    tick(world, 13.5);
    expect(world.boss?.arrived).toBe(true);
    expect(world.boss?.stage).toBe("Attacking");
    expect(world.bossSpecials).toBeGreaterThan(0);
    expect(world.player.shield).toBeLessThan(100);
  });

  test("concentrated normal fire interrupts a charged special; phase two raises its threshold", () => {
    const world = arena();
    const boss = enemy(world, {
      kind: "boss",
      x: 225,
      defenseX: 225,
      y: 620,
      arrived: true,
      stage: "Attacking",
      telegraph: 2,
      interruptRequired: 90,
    });
    world.player.stats.damage = 50;
    tick(world, 0.7);
    expect(world.bossInterrupts).toBe(1);
    expect(world.bossSpecials).toBe(0);
    expect(boss.telegraph).toBe(0);
    boss.hp = boss.maxHp / 2 - 1;
    boss.patternCooldown = 0;
    world.player.cooldown = 100;
    world.update(CONFIG.fixedStep);
    expect(boss.interruptRequired).toBe(120);
    expect(boss.telegraph).toBe(1.7);
  });

  test.each(["Approaching", "Preparing", "Attacking"] as EnemyStage[])(
    "execution only adds damage during Attacking, tested at %s",
    (stage) => {
      const world = arena();
      applyCard("execution", world.player, world.stacks);
      const target = enemy(world, {
        x: 225,
        defenseX: 225,
        y: 620,
        arrived: true,
        stage,
        preparation: 5,
        hp: 100,
        maxHp: 100,
      });
      const shot = world.shots.acquire();
      if (!shot) throw new Error("No shot");
      Object.assign(shot, {
        x: 225,
        y: 620,
        vx: 0,
        vy: 0,
        damage: 10,
        lifetime: 1,
        targetId: target.id,
      });
      world.update(CONFIG.fixedStep);
      expect(target.hp).toBeCloseTo(stage === "Attacking" ? 88 : 90, 6);
    },
  );

  test("timeout ends the run and terminal state freezes coordinates and attacks", () => {
    const world = arena();
    world.stageElapsed = world.stage.deadline - 0.01;
    tick(world, 0.02);
    expect(world.phase).toBe("GameOver");
    expect(world.endingReason).toBe("timeout");
    const before = world.snapshot();
    tick(world, 1);
    expect(world.snapshot()).toEqual(before);
    expect({ x: world.player.x, y: world.player.y }).toEqual(CONFIG.player);
  });
});
