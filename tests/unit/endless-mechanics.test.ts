import { describe, expect, test } from "bun:test";
import { CAMPAIGN_KINDS, ENDLESS_KINDS, ENEMIES } from "../../src/data/enemies";
import { CONFIG } from "../../src/game/config";
import { combatStats } from "../../src/game/stats";
import { applyPoison } from "../../src/game/systems/damage";
import { chooseTarget } from "../../src/game/systems/targeting";
import { createPlayer, World } from "../../src/game/world";
import { enemy, hit, tick } from "./helpers";

function arena(seed = 30): World {
  const world = new World();
  world.start(seed);
  world.stageIndex = 4;
  world.bossSpawned = true;
  // Isolate combat mechanics from random reward interrupts and survival limits.
  world.stageSupplies = 3;
  world.player.cooldown = 1000;
  world.player.hp = 1000;
  world.player.stats.maxHp = 1000;
  world.player.shield = 1000000;
  return world;
}

function boss(world: World) {
  return enemy(world, {
    kind: "boss",
    x: 225,
    defenseX: 225,
    y: 200,
    speed: 0,
    hp: 1000,
    maxHp: 1000,
    attackPolicy: { type: "anywhere" },
  });
}

function claim(world: World): void {
  const reward = world.reward;
  if (!reward || !world.chooseCard(reward.choices[0] ?? "", reward.token))
    throw new Error("Missing or invalid reward");
}

describe("balanced species and upper-half spawning", () => {
  test("each stage and every reinforcement stream use the same balanced three-species bag", () => {
    for (let index = 0; index < 8; index++) {
      const world = arena();
      world.stageIndex = index;
      world.bossSpawned = false;
      const kinds = world.endless ? ENDLESS_KINDS : CAMPAIGN_KINDS;
      for (let frame = 0; frame < 120 * 20; frame++) {
        for (const item of world.enemies.items) item.active = false;
        world.update(CONFIG.fixedStep);
        const counts = kinds.map((kind) => world.stageKindSpawns[kind]);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      }
      for (const item of world.enemies.items) item.active = false;
      world.stageElapsed = world.stage.bossAt;
      tick(world, 0.1);
      for (let batch = 0; batch < 6; batch++) {
        const counts = kinds.map((kind) => world.stageKindSpawns[kind]);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        for (const item of world.enemies.items) if (item.kind !== "boss") item.active = false;
        tick(world, 2.01);
      }
      const excluded = world.endless ? CAMPAIGN_KINDS.slice(1) : ENDLESS_KINDS.slice(1);
      for (const kind of excluded) expect(world.stageKindSpawns[kind]).toBe(0);
    }
  });

  test("endless ordinary waves and escorts spawn throughout y=0..400, bosses stay at the top", () => {
    const world = arena();
    world.bossSpawned = false;
    tick(world, 6);
    const minions = world.enemies.items.filter((item) => item.active);
    expect(minions.length).toBeGreaterThan(4);
    expect(minions.length).toBeLessThanOrEqual(24);
    for (const item of minions) {
      expect(item.spawnY).toBeGreaterThanOrEqual(0);
      expect(item.spawnY).toBeLessThanOrEqual(400);
      expect(item.spawnX).toBeGreaterThanOrEqual(item.radius);
      expect(item.spawnX).toBeLessThanOrEqual(CONFIG.width - item.radius);
      expect(item.y).toBeGreaterThanOrEqual(item.spawnY);
    }
    expect(minions.some((item) => item.spawnY < 100)).toBe(true);
    expect(new Set(minions.map((item) => item.spawnY)).size).toBeGreaterThan(1);
    expect(new Set(minions.map((item) => item.spawnX)).size).toBe(4 + world.scoreTrainings);
    world.stageElapsed = world.stage.bossAt;
    tick(world, 0.1);
    expect(world.boss?.spawnY).toBe(-55);
    expect(
      world.enemies.items
        .filter((item) => item.active && item.kind !== "boss")
        .every((item) => item.spawnY >= 0 && item.spawnY <= 400),
    ).toBe(true);
  });
});

describe("tank taunts actual fire", () => {
  test("base tank and wizard HP are ten and five times ordinary HP", () => {
    expect(ENEMIES.tank.hp).toBe(ENEMIES.wisp.hp * 10);
    expect(ENEMIES.wizard.hp).toBe(ENEMIES.wisp.hp * 5);
  });

  test("tank taunt controls manual, secondary and in-flight locks when the attack area is empty", () => {
    const world = arena();
    const target = boss(world);
    target.attackPolicy = { type: "defense" };
    world.selectTargetAt(target);
    world.player.cooldown = 0;
    world.update(CONFIG.fixedStep);
    const oldShot = world.shots.items.find((shot) => shot.active);
    if (!oldShot) throw new Error("No homing projectile");
    for (const item of world.enemies.items) if (item !== target) item.active = false;
    const tank = enemy(world, { kind: "tank", x: 57, y: 300, speed: 0, tauntRemaining: 10 });
    world.player.stats.projectiles = 3;
    world.player.cooldown = 0;
    world.update(CONFIG.fixedStep);
    expect(world.manualTargetId).toBe(target.id);
    expect(world.targetId).toBe(tank.id);
    expect(oldShot.targetId).toBe(tank.id);
    expect(
      world.shots.items.filter((shot) => shot.active).every((shot) => shot.targetId === tank.id),
    ).toBe(true);
    expect(chooseTarget(world.targets, target.id, target.id, undefined, true)?.id).toBe(tank.id);
    tank.active = false;
    world.update(CONFIG.fixedStep);
    expect(world.targetId).toBe(target.id);
  });

  test("off-screen, dead and recycled tanks cannot leave a stale taunt", () => {
    const world = arena();
    const target = enemy(world, { y: 300 });
    const tank = enemy(world, { kind: "tank", y: -100, tauntRemaining: 10 });
    expect(chooseTarget(world.targets, null, target.id)?.id).toBe(target.id);
    tank.y = 200;
    expect(chooseTarget(world.targets, null, target.id)?.id).toBe(tank.id);
    tank.hp = 0;
    expect(chooseTarget(world.targets, null, target.id)?.id).toBe(target.id);
    tank.active = false;
    const reused = enemy(world, { kind: "wisp", y: 200 });
    expect(reused).toBe(tank);
    expect(chooseTarget(world.targets, target.id, target.id)?.id).toBe(target.id);
  });

  test("attack-area taunt preempts tanks for manual locks, secondary shots and flying projectiles, then hands back", () => {
    const world = arena();
    const preferred = enemy(world, { x: 390, y: 200, speed: 0 });
    const tank = enemy(world, { kind: "tank", x: 57, y: 250, speed: 0, tauntRemaining: 10 });
    world.selectTargetAt(preferred);
    world.player.cooldown = 0;
    world.player.stats.projectiles = 3;
    world.update(CONFIG.fixedStep);
    const oldShot = world.shots.items.find((shot) => shot.active);
    if (!oldShot) throw new Error("No projectile");
    expect(oldShot.targetId).toBe(tank.id);
    const threat = enemy(world, { x: 225, y: 620, arrived: true, speed: 0, hp: 10000 });
    world.player.cooldown = 0;
    world.update(CONFIG.fixedStep);
    expect(world.targetId).toBe(threat.id);
    expect(world.manualTargetId).toBe(preferred.id);
    expect(oldShot.targetId).toBe(threat.id);
    expect(
      world.shots.items.filter((shot) => shot.active).every((shot) => shot.targetId === threat.id),
    ).toBe(true);
    threat.active = false;
    world.update(CONFIG.fixedStep);
    expect(world.targetId).toBe(tank.id);
    tank.active = false;
    world.update(CONFIG.fixedStep);
    expect(world.targetId).toBe(preferred.id);
  });

  test("ranged entry boundaries and boss anywhere permission grant priority only in endless", () => {
    const world = arena();
    const tank = enemy(world, { kind: "tank", y: 250, tauntRemaining: 10 });
    const wizard = enemy(world, { kind: "wizard", y: 119, arrived: false, speed: 0 });
    expect(chooseTarget(world.targets, null, tank.id, undefined, true)?.id).toBe(tank.id);
    wizard.y = 120;
    expect(chooseTarget(world.targets, tank.id, tank.id, undefined, true)?.id).toBe(wizard.id);
    expect(chooseTarget(world.targets, tank.id, tank.id)?.id).toBe(tank.id);
    wizard.active = false;
    const target = boss(world);
    expect(chooseTarget(world.targets, tank.id, tank.id, undefined, true)?.id).toBe(target.id);
    target.y = -1;
    expect(chooseTarget(world.targets, null, target.id, undefined, true)?.id).toBe(tank.id);
  });

  test("a tank inside the attack area shares its threat band instead of stealing an existing attacker lock", () => {
    const world = arena();
    const attacker = enemy(world, { x: 225, y: 620, arrived: true, stage: "Attacking" });
    enemy(world, { kind: "tank", y: 620, arrived: true, stage: "Attacking" });
    expect(chooseTarget(world.targets, attacker.id, null, undefined, true)?.id).toBe(attacker.id);
  });
});

describe("single poison effect and conditional attack slow", () => {
  test("a normal wizard shot and wizard death do not apply the poison skill", () => {
    const world = arena();
    const wizard = enemy(world, { kind: "wizard", y: 200, stage: "Attacking", speed: 0 });
    world.update(CONFIG.fixedStep);
    expect(wizard.lastAction).toBe("attack");
    expect(world.regularAttacks).toBe(1);
    expect(world.player.poisonTime).toBe(0);
    hit(world, wizard, 10000);
    expect(wizard.active).toBe(false);
    expect(world.player.poisonTime).toBe(0);
  });

  test("poison drains shields first and only HP damage adds a three-second 30% attack slow", () => {
    const world = arena();
    world.player.shield = 9;
    world.player.invulnerable = 10;
    applyPoison(world.player);
    tick(world, 1);
    expect(world.player.shield).toBeCloseTo(3, 6);
    expect(world.player.hp).toBe(1000);
    expect(world.player.poisonSlowTime).toBe(0);
    tick(world, 1);
    expect(world.player.shield).toBe(0);
    expect(world.player.hp).toBeCloseTo(997, 6);
    expect(world.player.poisonSlowTime).toBe(3);
    expect(combatStats(world.player, world.stacks).interval).toBeCloseTo(0.34 / 0.7, 6);
    tick(world, 1.01);
    expect(world.player.hp).toBeCloseTo(991, 6);
    expect(world.player.poisonTime).toBe(0);
    expect(world.player.poisonSlowTime).toBeGreaterThan(2.9);
    tick(world, 3);
    expect(world.player.poisonSlowTime).toBe(0);
    expect(combatStats(world.player, world.stacks).interval).toBe(0.34);
  });

  test("simultaneous and repeated poison refresh duration without stacking tick damage", () => {
    const world = arena();
    const first = enemy(world, { kind: "wizard", y: 200, stage: "Attacking", speed: 0 });
    const second = enemy(world, { kind: "wizard", y: 200, stage: "Attacking", speed: 0 });
    world.update(CONFIG.fixedStep);
    first.active = false;
    second.active = false;
    applyPoison(world.player);
    applyPoison(world.player);
    const before = world.player.shield;
    tick(world, 1);
    expect(before - world.player.shield).toBeCloseTo(7.2, 5);
    applyPoison(world.player);
    expect(world.player.poisonTime).toBe(3);
    tick(world, 1);
    expect(before - world.player.shield).toBeCloseTo(14.4, 5);
  });

  test("poison can end the run, and pause, rewards, endings and restart freeze or clear it", () => {
    const world = arena();
    world.player.shield = 0;
    applyPoison(world.player);
    tick(world, 0.2);
    world.pause();
    const frozen = world.snapshot();
    tick(world, 10);
    expect(world.snapshot()).toEqual(frozen);
    world.resume();
    world.reward = { token: 100, source: "supply", choices: ["overload", "ward", "vitality"] };
    world.state.transition("RewardSelection");
    const rewardFrozen = world.snapshot();
    tick(world, 10);
    expect(world.snapshot()).toEqual(rewardFrozen);
    world.chooseCard("overload", 100);
    world.player.hp = 0.01;
    world.update(CONFIG.fixedStep);
    expect(world.phase).toBe("GameOver");
    const ended = world.snapshot();
    tick(world, 10);
    expect(world.snapshot()).toEqual(ended);
    world.start(1);
    expect(world.player).toEqual(createPlayer());
  });

  test("poison, taunt and real firing stay identical at 30, 60 and 144 Hz", () => {
    const run = (rate: number) => {
      const world = arena();
      world.player.shield = 3;
      world.player.cooldown = 0;
      world.player.stats.projectiles = 3;
      enemy(world, {
        id: 101,
        kind: "tank",
        x: 80,
        y: 300,
        arrived: true,
        hp: 100000,
        maxHp: 100000,
      });
      enemy(world, {
        id: 102,
        kind: "wizard",
        x: 360,
        y: 220,
        arrived: true,
        hp: 100000,
        maxHp: 100000,
      });
      applyPoison(world.player);
      for (let frame = 0; frame < rate * 6; frame++) world.update(1 / rate);
      return world.snapshot();
    };
    expect(run(30)).toEqual(run(60));
    expect(run(144)).toEqual(run(60));
  });
});

describe("endless boss health thresholds and independent skills", () => {
  test("scheduled endless boss attacks while approaching and doubles only its regular damage on arrival", () => {
    const world = arena();
    world.bossSpawned = false;
    world.stageElapsed = world.stage.bossAt;
    tick(world, 0.1);
    const target = world.boss;
    if (!target) throw new Error("Missing boss");
    for (const item of world.enemies.items) if (item !== target) item.active = false;
    tick(world, 2.9);
    expect(target.attackPolicy).toEqual({ type: "anywhere" });
    expect(target.arrived).toBe(false);
    expect(target.stage).toBe("Attacking");
    const distant = world.hostileShots.items.find((shot) => shot.active && shot.damage > 10);
    expect(distant?.damage).toBeCloseTo(ENEMIES.boss.damage * world.stage.damage, 6);
    world.hostileShots.clear();
    for (const item of world.enemies.items) if (item !== target) item.active = false;
    target.y = target.defenseY;
    target.shotCooldown = 0;
    world.update(CONFIG.fixedStep);
    expect(target.arrived).toBe(true);
    expect(
      world.hostileShots.items
        .filter((shot) => shot.active)
        .every(
          (shot) => Math.abs(shot.damage - ENEMIES.boss.damage * world.stage.damage * 2) < 1e-6,
        ),
    ).toBe(true);
    expect(world.bossSpecials).toBe(0);
    expect(target.telegraph).toBe(0);
  });

  test("70/40/10 percent thresholds allow three consecutive guards and never repeat a threshold", () => {
    const world = arena(30); // Independent boss RNG draws guard three times.
    const target = boss(world);
    hit(world, target, 299);
    expect(target.skillsUsed).toBe(0);
    hit(world, target, 1);
    expect(target.skillsUsed).toBe(1);
    expect(target.lastSkill).toBe("guard");
    expect(target.damageReductionTime).toBe(3);
    hit(world, target, 100);
    expect(target.hp).toBeCloseTo(690, 6);
    expect(target.skillsUsed).toBe(1);
    hit(world, target, 2900);
    expect(target.skillsUsed).toBe(2);
    expect(target.lastSkill).toBe("guard");
    hit(world, target, 3000);
    expect(target.skillsUsed).toBe(3);
    expect(target.lastSkill).toBe("guard");
    hit(world, target, 10);
    expect(target.skillsUsed).toBe(3);
    expect(world.bossSpecials).toBe(3);
  });

  test("one nonlethal hit crossing all thresholds releases three skills; death cancels further casting", () => {
    const world = arena(30);
    const target = boss(world);
    hit(world, target, 950);
    expect(target.skillsUsed).toBe(3);
    expect(world.bossSpecials).toBe(3);
    hit(world, target, 1000);
    expect(target.active).toBe(false);
    expect(world.bossSpecials).toBe(3);
    expect(world.phase).toBe("StageClear");
  });

  test("90 percent reduction expires after three combat seconds and freezes during pause", () => {
    const world = arena(30);
    const target = boss(world);
    hit(world, target, 300);
    target.stunTime = 10;
    world.pause();
    tick(world, 5);
    expect(target.damageReductionTime).toBe(3);
    world.resume();
    tick(world, 3.01);
    expect(target.damageReductionTime).toBe(0);
    const before = target.hp;
    hit(world, target, 100);
    expect(before - target.hp).toBeCloseTo(100, 6);
  });

  test("slam removes exactly 120 HP through shields and invulnerability and can be lethal", () => {
    const world = arena(11);
    const target = boss(world);
    world.player.invulnerable = 10;
    const shield = world.player.shield;
    hit(world, target, 300);
    expect(target.lastSkill).toBe("slam");
    expect(world.player.hp).toBe(880);
    expect(world.player.shield).toBe(shield);
    world.player.hp = 80;
    hit(world, target, 300);
    expect(world.player.hp).toBe(0);
    expect(world.player.shield).toBe(shield);
    expect(world.phase).toBe("GameOver");
  });
});

describe("three random supplies plus one mixed boss reward", () => {
  test("different seeds have different schedules, fixed three awards, and frozen one-use choices", () => {
    const schedules: number[][] = [];
    for (const seed of [4, 5]) {
      const world = arena(seed);
      world.stageSupplies = 0;
      world.update(CONFIG.fixedStep);
      schedules.push(world.snapshot().endlessRewardTimes);
      expect(schedules.at(-1)).toHaveLength(3);
      let offers = 0;
      for (let frame = 0; frame < 120 * 47; frame++) {
        if (world.reward) {
          expect(world.reward.source).toBe("supply");
          const frozen = world.snapshot();
          tick(world, 5);
          expect(world.snapshot()).toEqual(frozen);
          expect(world.resume()).toBe(false);
          const reward = world.reward;
          expect(world.chooseCard(reward.choices[0] ?? "", reward.token + 1)).toBe(false);
          claim(world);
          expect(world.chooseCard(reward.choices[0] ?? "", reward.token)).toBe(false);
          offers++;
        }
        world.update(CONFIG.fixedStep);
      }
      expect(offers).toBe(3);
      expect(world.openedChests).toBe(0);
      expect(world.chests.items.some((item) => item.active)).toBe(false);
      expect([...world.stacks.values()].reduce((a, b) => a + b, 0)).toBe(3);
      const target = boss(world);
      hit(world, target, target.maxHp + 1);
      expect(world.phase).toBe("StageClear");
      expect(world.reward?.source).toBe("stage");
      claim(world);
      expect(world.stageIndex).toBe(5);
      expect(
        [...world.stacks.values(), ...world.trainingStacks.values()].reduce((a, b) => a + b, 0),
      ).toBe(4 + world.scoreTrainings);
      expect(world.stageSupplies).toBe(0);
      expect(world.player.poisonTime + world.player.poisonSlowTime).toBe(0);
    }
    expect(schedules[0]).not.toEqual(schedules[1]);
  });

  test("an early boss kill settles missing supplies before its extra card, across two endless stages", () => {
    const world = arena();
    world.stageSupplies = 0;
    for (const stage of [4, 5]) {
      const trainingBefore = world.scoreTrainings;
      const countBefore = [...world.stacks.values(), ...world.trainingStacks.values()].reduce(
        (a, b) => a + b,
        0,
      );
      const target = boss(world);
      hit(world, target, 1001);
      for (let supply = 1; supply <= 3; supply++) {
        expect(world.phase).toBe("RewardSelection");
        expect(world.stageSupplies).toBe(supply);
        expect(world.reward?.source).toBe("supply");
        const frozen = world.snapshot();
        tick(world, 2);
        expect(world.snapshot()).toEqual(frozen);
        claim(world);
      }
      expect(world.phase).toBe("StageClear");
      expect(world.reward?.source).toBe("stage");
      claim(world);
      expect(world.stageIndex).toBe(stage + 1);
      expect(
        [...world.stacks.values(), ...world.trainingStacks.values()].reduce((a, b) => a + b, 0),
      ).toBe(countBefore + 4 + world.scoreTrainings - trainingBefore);
      expect(world.enemies.items.every((item) => !item.active)).toBe(true);
    }
  });
});
