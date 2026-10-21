import { describe, expect, test } from "bun:test";
import { applyCard, CARD_BY_ID, drawCards, isControlCard } from "../../src/data/cards";
import { STAGES } from "../../src/data/stages";
import { TRAINING_BY_ID } from "../../src/data/training";
import { CONFIG } from "../../src/game/config";
import { seededRandom } from "../../src/game/random";
import { applyPoison, cleansePlayer, healingMultiplier } from "../../src/game/systems/damage";
import { createPlayer, World } from "../../src/game/world";
import { enemy, hit, tick } from "./helpers";

function arena(): World {
  const world = new World();
  world.start(11);
  world.stageIndex = STAGES.length;
  world.stageSupplies = CONFIG.endless.supplies;
  world.bossSpawned = true;
  world.player.cooldown = 1000;
  return world;
}

describe("sanctuary releases taunts for the entire stopped interval", () => {
  test("manual, keyboard, secondary and flying locks ignore tanks until hostile time resumes", () => {
    const world = arena();
    world.player.stats.projectiles = 3;
    const preferred = enemy(world, { x: 390, y: 100, speed: 0, hp: 10000 });
    const tank = enemy(world, { kind: "tank", x: 80, y: 250, speed: 0, tauntRemaining: 10 });
    world.selectTargetAt(preferred);
    expect(world.targetId).toBe(tank.id);
    world.sanctuaryRemaining = 0.5;
    world.player.cooldown = 0;
    world.update(CONFIG.fixedStep);
    expect(world.targetId).toBe(preferred.id);
    expect(world.manualTargetId).toBe(preferred.id);
    const shots = world.shots.items.filter((shot) => shot.active);
    expect(shots[0]?.targetId).toBe(preferred.id);
    expect(new Set(shots.map((shot) => shot.targetId)).size).toBe(2);
    world.update(CONFIG.fixedStep);
    expect(shots[0]?.targetId).toBe(preferred.id);
    world.cycleTarget();
    expect(world.manualTargetId).toBe(tank.id);
    world.cycleTarget();
    expect(world.manualTargetId).toBe(preferred.id);
    tick(world, 0.51);
    expect(world.sanctuaryRemaining).toBe(0);
    expect(world.targetId).toBe(tank.id);
    expect(shots.every((shot) => !shot.active || shot.targetId === tank.id)).toBe(true);
  });

  test("a tank already inside the attack area cannot force a manual lock during sanctuary", () => {
    const world = arena();
    enemy(world, { kind: "tank", y: 620, arrived: true, stage: "Attacking", speed: 0 });
    const preferred = enemy(world, { x: 390, y: 100, speed: 0 });
    world.sanctuaryRemaining = 0.5;
    world.selectTargetAt(preferred);
    world.update(CONFIG.fixedStep);
    expect(world.targetId).toBe(preferred.id);
    expect(world.enemyAttacks).toBe(0);
  });

  test("maximum edict and crown bonuses still give a brief 3.2-second sanctuary", () => {
    const world = arena();
    for (const id of [
      "edict",
      "edict",
      "edict",
      "edict",
      "chronocrown",
      "impact",
      "impact",
      "impact",
      "impact",
    ])
      expect(applyCard(id, world.player, world.stacks)).toBe(true);
    tick(world, 6 - CONFIG.fixedStep);
    applyPoison(world.player);
    world.update(CONFIG.fixedStep);
    expect(world.sanctuaryRemaining).toBeCloseTo(3.2 - CONFIG.fixedStep, 6);
    expect(healingMultiplier(world.player)).toBe(1);
  });
});

describe("poison's grievous wounds reduce every health recovery source by 90 percent", () => {
  test.each([false, true])(
    "lifesteal, kill healing and regeneration share amplification and wounds: %s",
    (poisoned) => {
      const world = arena();
      world.player.hp = 20;
      world.player.shield = 100;
      world.player.stats.lifesteal = 0.1;
      world.player.stats.harvest = 1;
      world.player.stats.regeneration = 10;
      world.player.stats.recovery = 0.5;
      if (poisoned) applyPoison(world.player);
      const target = enemy(world, { y: 300, hp: 10, speed: 0 });
      hit(world, target, 10);
      tick(world, 1 - CONFIG.fixedStep);
      const multiplier = poisoned ? 0.1 : 1;
      expect(world.player.hp - 20).toBeCloseTo((1 + 2 + 10) * 1.5 * multiplier, 6);
      expect(world.healingDone).toBeCloseTo((1 + 2 + 10) * 1.5 * multiplier, 6);
      expect(world.player.poisonSlowTime).toBe(0);
    },
  );

  test("ordinary and epic card heals are reduced during frozen reward selection; shields retain their value", () => {
    const world = arena();
    world.player.hp = 20;
    applyPoison(world.player);
    world.reward = { token: 1, source: "supply", choices: ["vitality"] };
    world.state.transition("RewardSelection");
    tick(world, 10);
    expect(world.chooseCard("vitality", 1)).toBe(true);
    expect(world.player.hp).toBeCloseTo(23, 6);
    expect(world.player.stats.maxHp).toBe(120);
    expect(applyCard("aegis-core", world.player, world.stacks)).toBe(true);
    expect(world.player.hp).toBeCloseTo(31, 6);
    expect(world.player.shield).toBe(60);
    expect(world.player.stats.maxHp).toBe(180);
  });

  test("wounds also reduce overheal conversion; cleanse and natural expiry restore full healing", () => {
    const world = arena();
    for (let i = 0; i < 6; i++) applyCard("leech", world.player, world.stacks);
    world.player.stats.regeneration = 10;
    applyPoison(world.player);
    world.player.shield = 10;
    tick(world, 1);
    expect(world.player.shield).toBeCloseTo(10 - 6 + 0.5, 6);
    cleansePlayer(world.player);
    world.player.hp = 50;
    tick(world, 1);
    expect(world.player.hp).toBeCloseTo(60, 6);
    applyPoison(world.player);
    world.player.shield = 100;
    tick(world, 3);
    expect(world.player.poisonTime).toBe(0);
    world.player.hp = 50;
    tick(world, 1);
    expect(world.player.hp).toBeCloseTo(60, 6);
  });
});

describe("endless slam grows once per completed endless stage", () => {
  test.each([0, 1, 2, 20])(
    "depth offset %s scales only the HP loss, bypassing shields and invulnerability",
    (offset) => {
      const world = arena();
      world.stageIndex += offset;
      world.player.hp = 1000;
      world.player.stats.maxHp = 1000;
      world.player.shield = 500;
      world.player.invulnerable = 100;
      const target = enemy(world, { kind: "boss", y: 200, hp: 1000, maxHp: 1000, speed: 0 });
      hit(world, target, 300);
      expect(target.lastSkill).toBe("slam");
      expect(world.player.hp).toBe(1000 - (100 + 5 * offset));
      expect(world.player.shield).toBe(500);
      expect(world.notice).toContain(String(100 + 5 * offset));
    },
  );
});

describe("first-stage reward pool", () => {
  test("chests, supplies and the first boss reward exclude both control families and their epics", () => {
    const player = createPlayer();
    const stacks = new Map([
      ["edict", 3],
      ["chill", 3],
    ]);
    for (let seed = 0; seed < 100; seed++) {
      for (const source of ["chest", "supply", "stage"] as const) {
        const cards = drawCards(player, stacks, seededRandom(seed), source, 0);
        expect(new Set(cards).size).toBe(3);
        for (const id of cards) {
          const card = CARD_BY_ID.get(id);
          expect(card && !isControlCard(card)).toBe(true);
        }
      }
    }
  });

  test("stage two and endless reopen all eight control cards, including epics", () => {
    const player = createPlayer();
    for (const stageIndex of [1, STAGES.length]) {
      const seen = new Set<string>();
      for (const focus of ["impact", "chill"]) {
        const stacks = new Map([[focus, 3]]);
        for (let seed = 0; seed < 200; seed++) {
          for (const source of ["chest", "stage"] as const)
            for (const id of drawCards(player, stacks, seededRandom(seed), source, stageIndex))
              seen.add(id);
        }
      }
      for (const card of CARD_BY_ID.values())
        if (isControlCard(card)) expect(seen.has(card.id)).toBe(true);
    }
  });

  test("real first-stage chests and boss offers use the restricted pool", () => {
    const world = new World();
    world.start(10);
    world.bossSpawned = true;
    for (const id of ["edict", "edict", "edict"]) applyCard(id, world.player, world.stacks);
    const chest = world.chests.acquire();
    if (!chest) throw new Error("Missing chest slot");
    Object.assign(chest, { id: 999, x: 225, y: 500, hp: 1, maxHp: 1 });
    world.selectTargetAt(chest);
    tick(world, 1);
    expect(world.phase).toBe("RewardSelection");
    const reward = world.reward;
    if (!reward) throw new Error("Missing chest reward");
    expect(
      reward.choices.every((id) => {
        const card = CARD_BY_ID.get(id);
        return TRAINING_BY_ID.has(id) || (card !== undefined && !isControlCard(card));
      }),
    ).toBe(true);
    world.chooseCard(reward.choices[0] ?? "", reward.token);
    const boss = enemy(world, { kind: "boss", y: 500, hp: 1, speed: 0 });
    hit(world, boss, 1);
    expect(world.phase).toBe("StageClear");
    expect(
      world.reward?.choices.every((id) => {
        const card = CARD_BY_ID.get(id);
        return TRAINING_BY_ID.has(id) || (card !== undefined && !isControlCard(card));
      }),
    ).toBe(true);
  });
});
