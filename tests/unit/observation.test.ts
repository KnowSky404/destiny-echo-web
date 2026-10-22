import { describe, expect, test } from "bun:test";
import { officialProfile } from "../../src/data/balance/profile";
import { CONFIG } from "../../src/game/config";
import type { WorldObservation } from "../../src/game/observation";
import { applyPoison } from "../../src/game/systems/damage";
import { World } from "../../src/game/world";
import { chooseReward } from "../policy";
import { enemy, hit, tick } from "./helpers";

class FixtureWorld extends World {
  clearStage(): void {
    this.bossDefeated = true;
    this.completeStageIfReady();
  }
}

function setup() {
  const events: WorldObservation[] = [];
  const world = new FixtureWorld(CONFIG.width, officialProfile(), (event) => events.push(event));
  world.start(4);
  return { world, events };
}

function incoming(world: World, damage: number): void {
  const shot = world.hostileShots.acquire();
  if (!shot) throw new Error("Hostile shot pool exhausted");
  Object.assign(shot, {
    ...world.player,
    previousX: world.player.x,
    previousY: world.player.y,
    vx: 0,
    vy: 0,
    damage,
    radius: 6,
    lifetime: 1,
  });
  world.update(CONFIG.fixedStep);
}

function natural(observer?: (event: WorldObservation) => void) {
  const world = new World(CONFIG.width, officialProfile(), observer);
  world.start(4);
  for (let step = 0; step < 120 * 650; step++) {
    if (["StageClear", "RewardSelection"].includes(world.phase) && world.reward) {
      const choice = chooseReward(world.reward.choices, world.stacks, world.player.hp);
      if (choice) world.chooseCard(choice, world.reward.token);
      else world.skipUnavailableReward(world.reward.token);
    }
    if (world.phase !== "Playing") break;
    if (step % 60 === 0) {
      const chest = world.chests.items.find((item) => item.active);
      if (chest && !world.boss) world.selectTargetAt(chest);
      else world.clearTarget();
    }
    world.update(CONFIG.fixedStep);
  }
  return world;
}

describe("read-only battle settlement observations", () => {
  test("enabling observation preserves complete natural-run results and RNG decisions", () => {
    const unobserved = natural();
    const events: WorldObservation[] = [];
    const observed = natural((event) => events.push(event));
    expect(observed.snapshot()).toEqual(unobserved.snapshot());
    expect(observed.phase).toBe("Victory");
    expect(
      events.filter((event) => event.type === "stage_enter").map((event) => event.stageIndex),
    ).toEqual([0, 1, 2, 3]);
    expect(events.filter((event) => event.type === "stage_clear")).toHaveLength(4);
    expect(events.filter((event) => event.type === "stage_ready")).toHaveLength(4);
    expect(events.filter((event) => event.type === "boss_spawn")).toHaveLength(4);
    expect(events.filter((event) => event.type === "boss_death")).toHaveLength(4);
    expect(
      events
        .filter((event) => event.type === "reward_choice")
        .every((event) => event.choices?.includes(event.choice ?? "")),
    ).toBe(true);
    expect(events.filter((event) => event.type === "auto_training")).toHaveLength(
      observed.scoreTrainings,
    );
    const enemyDamage = events
      .filter((event) => event.type === "enemy_damage")
      .reduce((sum, event) => sum + (event.amount ?? 0), 0);
    expect(enemyDamage).toBeCloseTo(observed.damageDealt, 7);
    const incomingDamage = events
      .filter((event) => event.type === "player_damage" && event.source !== "bloodpact")
      .reduce((sum, event) => sum + (event.amount ?? 0), 0);
    expect(incomingDamage).toBeCloseTo(observed.damageTaken, 7);
    expect(
      events.some((event) => event.type === "mechanic" && event.source === "enemy_attack"),
    ).toBe(true);
    expect(
      Math.max(
        ...events.filter((event) => event.type === "enemy_spawn").map((event) => event.amount ?? 0),
      ),
    ).toBe(observed.peakEnemies);
  }, 60_000);

  test("effective damage excludes overkill and chest damage; execution HP is included", () => {
    const { world, events } = setup();
    const target = enemy(world, { hp: 7, maxHp: 7, x: 200, y: 200, speed: 0 });
    hit(world, target, 1000);
    expect(events.find((event) => event.type === "enemy_damage")?.amount).toBe(7);
    expect(world.damageDealt).toBe(7);
    const chest = world.chests.acquire();
    if (!chest) throw new Error("Chest pool exhausted");
    Object.assign(chest, { id: 999, x: 200, y: 200, hp: 5, maxHp: 5, age: 0 });
    const shot = world.shots.acquire();
    if (!shot) throw new Error("Shot pool exhausted");
    Object.assign(shot, {
      x: 200,
      y: 200,
      previousX: 200,
      previousY: 200,
      vx: 0,
      vy: 0,
      radius: 4,
      damage: 1000,
      lifetime: 1,
      hitsLeft: 1,
    });
    shot.hitIds.clear();
    world.update(CONFIG.fixedStep);
    expect(events.find((event) => event.type === "chest_damage")?.amount).toBe(5);
    expect(world.damageDealt).toBe(7);

    const execution = setup();
    execution.world.stacks.set("execution", 3);
    execution.world.stacks.set("focus", 3);
    const victim = enemy(execution.world, { hp: 20, maxHp: 100, x: 200, y: 200, speed: 0 });
    hit(execution.world, victim, 13);
    expect(victim.hp).toBe(0);
    expect(execution.world.executions).toBe(1);
    expect(execution.events.find((event) => event.type === "enemy_damage")?.amount).toBe(20);
  });

  test("HP loss, shield absorption and fatal source come from the settlement", () => {
    const { world, events } = setup();
    world.player.hp = 10;
    world.player.shield = 6;
    incoming(world, 12);
    expect(events.find((event) => event.type === "player_damage")).toMatchObject({
      source: "unknown",
      hpLoss: 6,
      shieldAbsorbed: 6,
      amount: 12,
    });
    expect(world.damageTaken).toBe(12);
    world.player.invulnerable = 0;
    incoming(world, 1000);
    expect(events.filter((event) => event.type === "player_damage").at(-1)).toMatchObject({
      hpLoss: 4,
      shieldAbsorbed: 0,
      amount: 4,
    });
    expect(events.find((event) => event.type === "death")).toMatchObject({
      source: "unknown",
      hp: 0,
    });
    expect(world.phase).toBe("GameOver");
  });

  test("poison bypasses hit immunity and reports its own fatal source", () => {
    const { world, events } = setup();
    world.player.hp = 0.01;
    world.player.shield = 0.01;
    world.player.invulnerable = 10;
    applyPoison(world.player);
    world.update(CONFIG.fixedStep);
    expect(events.find((event) => event.type === "player_damage")).toMatchObject({
      source: "poison",
      hpLoss: 0.01,
      shieldAbsorbed: 0.01,
    });
    expect(events.find((event) => event.type === "death")?.source).toBe("poison");
  });

  test("real melee and projectile fatalities retain the source kind", () => {
    for (const kind of ["wisp", "hexer"] as const) {
      const { world, events } = setup();
      world.player.hp = 1;
      world.player.shield = 0;
      world.player.cooldown = 1000;
      enemy(world, {
        kind,
        x: world.player.x,
        defenseX: world.player.x,
        y: world.player.y - 13,
        speed: 0,
        arrived: true,
        stage: "Attacking",
      });
      tick(world, 0.1);
      const source = kind === "wisp" ? "melee:wisp" : "projectile:hexer";
      expect(events.find((event) => event.type === "death")?.source).toBe(source);
      expect(events.find((event) => event.type === "player_damage")).toMatchObject({
        source,
        hpLoss: 1,
        shieldAbsorbed: 0,
      });
    }
  });

  test("boss slam has a distinct fatal source and ignores shields", () => {
    const { world, events } = setup();
    world.pause();
    world.toMenu();
    world.start(11);
    world.stageIndex = 4;
    world.stageSupplies = 3;
    world.bossSpawned = true;
    world.player.cooldown = 1000;
    world.player.hp = 80;
    world.player.shield = 100;
    world.player.invulnerable = 10;
    const target = enemy(world, {
      kind: "boss",
      x: 225,
      defenseX: 225,
      y: 200,
      speed: 0,
      hp: 1000,
      maxHp: 1000,
      attackPolicy: { type: "anywhere" },
    });
    hit(world, target, 300);
    expect(events.find((event) => event.type === "death")?.source).toBe("boss_slam");
    expect(events.find((event) => event.type === "player_damage")).toMatchObject({
      source: "boss_slam",
      hpLoss: 80,
      shieldAbsorbed: 0,
    });
    expect(world.player.shield).toBe(100);
  });

  test("bloodpact self-cost is observed separately from legacy incoming damage", () => {
    const { world, events } = setup();
    world.player.cooldown = 1000;
    world.player.stats.bloodpact = 1;
    world.player.hp = 10;
    world.player.shield = 100;
    enemy(world, { hp: 10000, maxHp: 10000, y: 200, speed: 0 });
    tick(world, 5.01);
    expect(
      events.find((event) => event.type === "player_damage" && event.source === "bloodpact"),
    ).toMatchObject({ hpLoss: 3, shieldAbsorbed: 0 });
    expect(world.damageTaken).toBe(0);
    expect(events.filter((event) => event.type === "death")).toHaveLength(0);
  });

  test("card resource grants are observed while legacy recovery counters keep their narrower scope", () => {
    const { world, events } = setup();
    world.player.hp = 10;
    world.player.shield = 0;
    world.reward = { token: 99, source: "chest", choices: ["aegis-core"] };
    world.state.transition("RewardSelection");
    expect(world.chooseCard("aegis-core", 99)).toBe(true);
    expect(events.find((event) => event.type === "heal")).toMatchObject({
      source: "reward:aegis-core",
      amount: 80,
    });
    expect(events.find((event) => event.type === "shield")).toMatchObject({
      source: "reward:aegis-core",
      amount: 60,
    });
    expect(world.healingDone).toBe(0);
    expect(world.shieldRestored).toBe(0);
    expect(world.chooseCard("aegis-core", 99)).toBe(false);
    expect(events.filter((event) => event.type === "reward_choice")).toHaveLength(1);
  });

  test("clear state precedes reward and recovery, and the next stage has an independent clock", () => {
    const { world, events } = setup();
    world.player.hp = 25;
    world.stageElapsed = 15;
    world.elapsed = 20;
    world.clearStage();
    const clear = events.find((event) => event.type === "stage_clear");
    expect(clear).toMatchObject({ stageIndex: 0, hp: 25, stageElapsed: 15, elapsed: 20 });
    const reward = world.reward;
    if (!reward) throw new Error("Missing stage reward");
    expect(
      world.chooseCard("training-damage", reward.token) ||
        world.chooseCard(reward.choices[0] ?? "", reward.token),
    ).toBe(true);
    const ready = events.find((event) => event.type === "stage_ready");
    expect(ready).toMatchObject({ stageIndex: 0, stageElapsed: 15, elapsed: 20, hp: 60 });
    expect(events.filter((event) => event.type === "stage_enter").at(-1)).toMatchObject({
      stageIndex: 1,
      stageElapsed: 0,
      elapsed: 20,
      hp: 60,
    });
    expect(world.healingDone).toBe(0);
    expect(events.find((event) => event.source === "stage_recovery")).toMatchObject({
      amount: 35,
      stageIndex: 0,
    });
    expect(events.indexOf(clear as WorldObservation)).toBeLessThan(
      events.findIndex((event) => event.type === "reward_offer"),
    );
  });

  test("clocks pause during selection and diverge only during sanctuary", () => {
    const { world, events } = setup();
    world.sanctuaryRemaining = 1;
    world.player.hp -= 5;
    world.player.stats.regeneration = 1;
    world.update(CONFIG.fixedStep);
    expect(world.elapsed).toBe(CONFIG.fixedStep);
    expect(world.stageElapsed).toBe(0);
    expect(events.find((event) => event.type === "heal")).toMatchObject({
      source: "regeneration",
      elapsed: CONFIG.fixedStep,
      stageElapsed: 0,
    });
    world.state.transition("RewardSelection");
    world.update(1);
    expect(world.elapsed).toBe(CONFIG.fixedStep);
    expect(world.stageElapsed).toBe(0);
  });

  test("observations and candidate lists are frozen detached values; detaching stops emission", () => {
    const { world, events } = setup();
    world.clearStage();
    const offered = events.find((event) => event.type === "reward_offer");
    expect(offered && Object.isFrozen(offered)).toBe(true);
    expect(offered?.choices && Object.isFrozen(offered.choices)).toBe(true);
    expect(offered?.choices).not.toBe(world.reward?.choices);
    world.setObserver();
    const count = events.length;
    const reward = world.reward;
    if (!reward) throw new Error("Missing reward");
    world.chooseCard(reward.choices[0] ?? "", reward.token);
    world.update(CONFIG.fixedStep);
    expect(events).toHaveLength(count);
  });
});
