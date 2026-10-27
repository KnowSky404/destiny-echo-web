import { describe, expect, test } from "bun:test";
import { defaultProfile } from "../../src/data/balance/profile";
import { CONFIG } from "../../src/game/config";
import { World } from "../../src/game/world";
import { enemy, enterBossEncounter, hit, isolateEndless, tick } from "./helpers";

function fixture(index = 4) {
  const world = new World(CONFIG.width, defaultProfile());
  world.start(43);
  world.stageIndex = index;
  isolateEndless(world);
  world.bossSpawned = true;
  world.stageSupplies = 3;
  world.player.cooldown = 1000;
  world.player.shield = 100000;
  return world;
}

function skillBoss(world: World) {
  return enemy(world, {
    kind: "boss",
    x: 225,
    defenseX: 225,
    y: 200,
    speed: 0,
    attackPolicy: { type: "anywhere" },
    stage: "Attacking",
    preparation: 0,
    hp: 10000,
    maxHp: 10000,
    patternCooldown: 0,
    shotCooldown: 1000,
  });
}

describe("endless evolution integration", () => {
  test("waiting cannot skip an uncleared wave to the main boss", () => {
    const world = fixture();
    Reflect.set(world, "encounterStageIndex", -1);
    world.bossSpawned = false;
    world.stageElapsed = 300;
    tick(world, 1);
    expect(world.boss).toBeUndefined();
    expect(world.stageSpawned).toBeGreaterThan(0);
    expect(world.encounterLabel).toContain("怪群");
  });

  test("main entrance preserves living escorts and extra reinforcements award no training XP", () => {
    const world = fixture();
    const survivor = enemy(world, { y: 300, hp: 123, maxHp: 500, speed: 0 });
    enterBossEncounter(world);
    world.bossSpawned = false;
    world.update(CONFIG.fixedStep);
    expect(world.boss).toBeDefined();
    expect(survivor.active).toBe(true);
    expect(survivor.hp).toBe(123);
    for (const entity of world.enemies.items) if (entity.kind !== "boss") entity.active = false;
    tick(world, 5.1);
    const adds = world.enemies.items.filter((entity) => entity.active && entity.role === "minion");
    expect(adds.length).toBeGreaterThan(0);
    expect(adds.every((entity) => entity.trainingCredit === 0)).toBe(true);
  });

  test("a single hit crossing three health lines queues skills instead of dealing instant damage", () => {
    const world = fixture();
    const target = skillBoss(world);
    const hp = world.player.hp,
      shield = world.player.shield;
    hit(world, target, 9100);
    expect(world.player.hp).toBe(hp);
    expect(world.player.shield).toBe(shield);
    expect(target.skillsUsed).toBe(3);
    expect(target.pendingSkills.length + Number(target.castSkill !== null)).toBe(3);
    expect(target.telegraph).toBeGreaterThan(2);
    expect(world.bossSpecials).toBe(0);
  });

  test("a warned slam uses shields and ordinary hit protection", () => {
    const world = fixture();
    const target = skillBoss(world);
    target.pendingSkills = ["slam"];
    world.update(CONFIG.fixedStep);
    const initialShield = world.player.shield;
    tick(world, 2);
    expect(world.player.shield).toBe(initialShield);
    tick(world, 0.5);
    expect(world.player.hp).toBe(100);
    expect(world.player.shield).toBe(initialShield - world.bossSlamDamage);
    expect(world.bossSpecials).toBe(1);
  });

  test("interrupt consumes the warned skill and opens a weakness window", () => {
    const world = fixture();
    const target = skillBoss(world);
    target.pendingSkills = ["slam", "summon"];
    world.update(CONFIG.fixedStep);
    hit(world, target, target.interruptRequired + 1);
    expect(target.castSkill).toBeNull();
    expect(target.pendingSkills).toEqual(["summon"]);
    expect(target.vulnerableTime).toBeGreaterThan(1.9);
    expect(world.bossInterrupts).toBe(1);
    const shield = world.player.shield;
    tick(world, 1);
    expect(world.player.shield).toBe(shield);
    expect(target.castSkill).toBeNull();
  });

  test("boss percentage allowance is shared by primary hits and erosion pulses", () => {
    const world = fixture();
    const target = skillBoss(world);
    target.patternCooldown = 1000;
    target.skillsUsed = 3;
    world.player.stats.maxHealthDamage = 0.05;
    world.player.stats.erosionPulse = 0.05;
    Reflect.set(world, "erosionCooldown", 0);
    hit(world, target, 1);
    // The first quarter-second allowance is 62.5 HP; fixed damage is separate.
    expect(10000 - target.hp).toBeCloseTo(63.5, 5);
    expect(world.player.hp).toBe(100);
  });

  test("ordinary minions retain full percentage damage", () => {
    const world = fixture();
    const target = enemy(world, { hp: 10000, maxHp: 10000, x: 225, y: 200, speed: 0 });
    world.player.stats.maxHealthDamage = 0.05;
    hit(world, target, 1);
    expect(target.hp).toBe(9499);
  });

  test("clear-score HP rewards cannot generate training and death echoes finish before rewards", () => {
    const world = fixture(0);
    world.player.stats.maxHp = world.player.hp = 1200;
    const target = skillBoss(world);
    target.hp = target.maxHp = 100;
    target.trainingCredit = 3000;
    hit(world, target, 1000);
    expect(world.score).toBe(15000);
    expect(world.trainingScore).toBe(3000);
    expect(world.scoreTrainings).toBe(0);
    expect(world.reward).toBeNull();
    expect(world.clearPresentationRemaining).toBeGreaterThan(0.7);
    expect(world.deathEchoes).toHaveLength(1);
    const elapsed = world.elapsed;
    world.pause();
    tick(world, 1);
    expect(world.deathEchoes[0]?.life).toBe(0.8);
    world.resume();
    tick(world, 0.9);
    expect(world.elapsed).toBe(elapsed);
    expect(world.phase).toBe("StageClear");
    expect(world.deathEchoes).toHaveLength(0);
  });

  test("fusion preserves only actually funded training credit", () => {
    const world = fixture();
    for (const [index, credit] of [100, 0, 0].entries())
      enemy(world, {
        x: 100 + index * 20,
        y: 300,
        speed: 0,
        age: 4,
        hp: 50,
        maxHp: 50,
        trainingCredit: credit,
      });
    tick(world, 3.1);
    const merged = world.enemies.items.filter((entity) => entity.active);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.stars).toBe(2);
    expect(merged[0]?.trainingCredit).toBe(100);
    if (!merged[0]) throw new Error("Missing merged enemy");
    hit(world, merged[0], 1000000);
    expect(world.trainingScore).toBe(100);
    expect(world.score).toBe(300);
  });
});

describe("configured segment supply totals", () => {
  test.each([0, 1, 4, 12])(
    "earns exactly %s offers across the first three boundaries",
    (supplies) => {
      const profile = defaultProfile();
      profile.payload.endless.supplies = supplies;
      profile.payload.endless.populationCap = 6;
      profile.payload.player.stats.damage = 1e9;
      const world = new World(CONFIG.width, profile);
      world.start(4);
      world.stageIndex = 4;
      world.player.shield = 1e6;
      let offers = 0;
      for (let step = 0; step < 120 * 120 && world.stageIndex < 5; step++) {
        if (world.reward) {
          if (world.reward.source === "supply") offers++;
          const reward = world.reward;
          if (reward.choices[0]) world.chooseCard(reward.choices[0], reward.token);
          else world.skipUnavailableReward(reward.token);
        }
        world.update(CONFIG.fixedStep);
      }
      expect(world.stageIndex).toBe(5);
      expect(offers).toBe(supplies);
    },
  );

  test("enhanced skill reinforcements have no training credit", () => {
    const world = fixture();
    const target = skillBoss(world);
    target.skillsUsed = 3;
    target.pendingSkills = ["summon"];
    enterBossEncounter(world, true);
    tick(world, 2.5);
    const summoned = world.enemies.items.filter((unit) => unit.active && unit.enhanced);
    expect(summoned).toHaveLength(world.endlessRules.summonCount);
    expect(summoned.every((unit) => unit.trainingCredit === 0)).toBe(true);
  });
});

describe("weak-point counterplay for every build", () => {
  test("four primary hits interrupt a charge without a high damage stat", () => {
    const world = fixture();
    const target = skillBoss(world);
    target.skillsUsed = 3;
    target.pendingSkills = ["slam"];
    world.update(CONFIG.fixedStep);
    target.interruptRequired = 100000;
    for (let i = 0; i < 3; i++) hit(world, target, 1);
    expect(target.telegraph).toBeGreaterThan(0);
    expect(target.interruptHits).toBe(3);
    hit(world, target, 1);
    expect(target.telegraph).toBe(0);
    expect(target.vulnerableTime).toBeGreaterThan(1.9);
    expect(world.bossInterrupts).toBe(1);
  });

  test("weak-point HP damage respects the shared allowance and cannot amplify lifesteal", () => {
    const world = fixture();
    const target = skillBoss(world);
    target.skillsUsed = 3;
    target.patternCooldown = 1000;
    target.vulnerableTime = 2;
    world.player.hp = 50;
    world.player.stats.lifesteal = 0.1;
    hit(world, target, 1);
    // Weakness doubles the 2.5%/s boss allowance: quarter-second burst=125HP.
    expect(10000 - target.hp).toBeCloseTo(126.35, 5);
    // Only the ordinary 1.35 damage pays lifesteal, not the 125HP weak-point chip.
    expect(world.player.hp).toBeCloseTo(50 + 1.35 * 0.085, 5);
  });

  test("a main boss offers regular readable charges before any health threshold is crossed", () => {
    const world = fixture();
    const target = skillBoss(world);
    world.update(CONFIG.fixedStep);
    expect(target.castSkill).toBe("volley");
    expect(target.telegraph).toBeGreaterThan(2);
    expect(target.skillsUsed).toBe(0);
    expect(target.pendingSkills).toEqual([]);
  });
});
