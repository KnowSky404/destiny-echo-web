import { describe, expect, test } from "bun:test";
import { applyCard } from "../../src/data/cards";
import { STAGES, stageAt } from "../../src/data/stages";
import { CONFIG } from "../../src/game/config";
import { createPlayer, World } from "../../src/game/world";
import { enemy, tick } from "./helpers";

function finishBoss(world: World): void {
  world.bossSpawned = true;
  enemy(world, {
    kind: "boss",
    x: 225,
    defenseX: 225,
    y: 620,
    hp: 1,
    maxHp: world.stage.bossHp,
    arrived: true,
    speed: 0,
  });
  tick(world, 1);
}

describe("continuous campaign and stage-reward lifetime", () => {
  test("first boss grants a frozen supply choice; claiming carries the build into stage two", () => {
    const world = new World();
    world.start(4);
    applyCard("overload", world.player, world.stacks);
    world.player.hp = 40;
    world.player.shield = 17;
    world.elapsed = 65;
    world.stageElapsed = 65;
    finishBoss(world);
    expect(world.phase).toBe("StageClear");
    expect(world.clearedStages).toBe(1);
    expect(world.stageIndex).toBe(0);
    expect(world.reward?.source).toBe("stage");
    expect(world.snapshot().hostileShots).toEqual([]);
    expect(world.snapshot().enemies).toEqual([]);
    expect(world.snapshot().shots).toEqual([]);
    const frozen = world.snapshot();
    tick(world, 10);
    expect(world.snapshot()).toEqual(frozen);
    expect(world.resume()).toBe(false);
    expect(world.start(5)).toBe(false);
    expect(world.continueEndless()).toBe(false);
    const reward = world.reward;
    const id = reward?.choices.find((id) => id !== "vitality");
    if (!reward || !id) throw new Error("Missing stage supply");
    expect(world.chooseCard(id, reward.token + 1)).toBe(false);
    expect(world.chooseCard(id, reward.token)).toBe(true);
    expect(world.phase).toBe("Playing");
    expect(world.stageIndex).toBe(1);
    expect(world.stageElapsed).toBe(0);
    expect(world.elapsed).toBe(frozen.elapsed);
    expect(world.player.hp).toBe(75);
    expect(world.player.shield).toBeGreaterThanOrEqual(17);
    expect(world.stacks.get("overload")).toBeGreaterThanOrEqual(1);
    expect(
      [...world.stacks.values(), ...world.trainingStacks.values()].reduce((sum, n) => sum + n, 0),
    ).toBe(2);
    expect(world.score).toBe(frozen.score);
    expect(world.kills).toBe(1);
    expect(world.openedChests).toBe(0);
    expect(world.targetId).toBeNull();
    expect(world.manualTargetId).toBeNull();
    expect(world.bossSpawned).toBe(false);
    expect(world.chooseCard(id, reward.token)).toBe(false);
    finishBoss(world);
    expect(world.phase).toBe("StageClear");
    expect(world.reward?.token).toBeGreaterThan(reward.token);
    expect(world.chooseCard(id, reward.token)).toBe(false);
    expect(world.stageIndex).toBe(1);
  });

  test("fourth boss grants victory; endless preserves progress and grows difficulty", () => {
    const world = new World();
    world.start(4);
    world.stageIndex = 3;
    world.clearedStages = 3;
    world.elapsed = 250;
    applyCard("multishot", world.player, world.stacks);
    world.player.shield = 40;
    world.player.hp = 50;
    finishBoss(world);
    expect(world.phase).toBe("StageClear");
    const finale = world.reward;
    if (!finale) throw new Error("No finale reward");
    world.chooseCard(finale.choices[0] ?? "", finale.token);
    expect(world.phase).toBe("Victory");
    expect(world.clearedStages).toBe(4);
    const victory = world.snapshot();
    tick(world, 10);
    expect(world.snapshot()).toEqual(victory);
    expect(world.continueEndless()).toBe(true);
    expect(world.stageIndex).toBe(4);
    expect(world.endless).toBe(true);
    expect(world.stageElapsed).toBe(0);
    expect(world.elapsed).toBe(victory.elapsed);
    expect(world.player.hp).toBe(85);
    expect(world.player.shield).toBe(40);
    expect(world.stacks.get("multishot")).toBe(1);
    expect(world.continueEndless()).toBe(false);
    finishBoss(world);
    while (world.reward?.source === "supply") {
      const supply = world.reward;
      world.chooseCard(supply.choices[0] ?? "", supply.token);
    }
    expect(world.phase).toBe("StageClear");
    expect(world.clearedStages).toBe(5);
    const reward = world.reward;
    if (!reward) throw new Error("No endless supply");
    world.chooseCard(reward.choices[0] ?? "", reward.token);
    expect(world.stageIndex).toBe(5);
    expect(world.stage.bossHp).toBeGreaterThan(stageAt(4).bossHp);
  });

  test("restart clears stage clocks, endless mode and carried growth", () => {
    const world = new World();
    world.start(4);
    world.stageIndex = 3;
    world.clearedStages = 3;
    applyCard("bloodpact", world.player, world.stacks);
    finishBoss(world);
    const finale = world.reward;
    if (!finale) throw new Error("No finale reward");
    world.chooseCard(finale.choices[0] ?? "", finale.token);
    world.continueEndless();
    world.pause();
    expect(world.start(5)).toBe(true);
    expect(world.stageIndex + world.stageElapsed + world.clearedStages + world.elapsed).toBe(0);
    expect(world.endless).toBe(false);
    expect(world.player).toEqual(createPlayer());
    expect(world.stacks.size).toBe(0);
    expect(world.reward).toBeNull();
  });
});

describe("authored encounters and independent schedules", () => {
  test("campaign health, population and escort packs compound 50% through all four stages", () => {
    const first = stageAt(0);
    for (let index = 0; index < STAGES.length; index++) {
      const stage = stageAt(index);
      const growth = 1.5 ** index;
      expect(stage.health).toBeCloseTo(first.health * growth, 10);
      expect(stage.enemyCount).toBe(Math.ceil(first.enemyCount * growth));
      expect(stage.supportCount).toBe(Math.ceil(first.supportCount * growth));
      expect(stage.supportInterval).toBe(2);
      if (index > 0) {
        const previous = stageAt(index - 1);
        expect(stage.health / previous.health).toBeCloseTo(1.5, 10);
        expect(stage.spawnInterval).toBeLessThan(previous.spawnInterval);
        expect(stage.bossHp).toBeGreaterThanOrEqual(previous.bossHp * 1.5);
      }
    }
    expect(STAGES.map((stage) => stage.enemyCount)).toEqual([40, 60, 90, 135]);
    expect(STAGES.map((stage) => stage.supportCount)).toEqual([4, 6, 9, 14]);
  });

  test("four distinct encounters spawn the correct bosses", () => {
    expect(STAGES).toHaveLength(4);
    expect(new Set(STAGES.map((stage) => stage.name)).size).toBe(4);
    expect(new Set(STAGES.map((stage) => stage.bossName)).size).toBe(4);
    expect(new Set(STAGES.map((stage) => stage.color)).size).toBe(4);
    for (let index = 0; index < STAGES.length; index++) {
      const world = new World();
      world.start(5);
      world.stageIndex = index;
      world.player.cooldown = 100;
      world.stageElapsed = world.stage.bossAt - 0.01;
      tick(world, 0.1);
      expect(world.boss?.maxHp).toBe(world.stage.bossHp);
      expect(world.boss?.stage).toBe("Approaching");
      expect(world.stage.bossAt).toBeGreaterThan(0);
      if (index > 0) expect(world.stage.bossHp).toBeGreaterThan(stageAt(index - 1).bossHp);
    }
  });

  test("furnace enemies prepare before arrival; prism boss summons actual support", () => {
    const furnace = new World();
    furnace.start(1);
    furnace.stageIndex = 2;
    furnace.player.cooldown = 100;
    furnace.player.shield = 10000;
    tick(furnace, 4.5);
    expect(
      furnace.enemies.items.some(
        (item) => item.active && !item.arrived && item.stage !== "Approaching",
      ),
    ).toBe(true);
    const prism = new World();
    prism.start(1);
    prism.stageIndex = 1;
    prism.player.cooldown = 100;
    prism.player.shield = 10000;
    prism.stageElapsed = prism.stage.bossAt;
    tick(prism, 9.2);
    expect(prism.boss).toBeDefined();
    expect(prism.enemies.items.some((item) => item.active && item.kind === "sentinel")).toBe(true);
    expect(prism.enemies.items.length).toBeLessThanOrEqual(CONFIG.limits.enemies);
  });

  test("neither total nor stage time can end a living run", () => {
    const world = new World();
    world.start(3);
    world.stageIndex = 2;
    world.elapsed = 1000;
    tick(world, 1);
    expect(world.phase).toBe("Playing");
    world.stageElapsed = 10000;
    tick(world, 0.02);
    expect(world.phase).toBe("Playing");
  });

  test("endless cycles themes with finite escalating difficulty and bounded cadence", () => {
    let previous = stageAt(3).bossHp;
    for (let index = 4; index < 40; index++) {
      const stage = stageAt(index);
      expect(stage.bossHp).toBeGreaterThan(previous);
      expect(Number.isFinite(stage.bossHp)).toBe(true);
      expect(stage.spawnInterval).toBeGreaterThan(0);
      expect(stage.damage).toBeLessThanOrEqual(4.8);
      expect(stage.name).toContain("无尽");
      previous = stage.bossHp;
    }
  });
});
