import { describe, expect, test } from "bun:test";
import { defaultProfile } from "../../src/data/balance/profile";
import { CONFIG } from "../../src/game/config";
import { World } from "../../src/game/world";
import { enemy, isolateEndless } from "./helpers";

function arena(stageIndex: number, hp = 100, shield = 0, authoredDamage?: number): World {
  const profile = defaultProfile();
  Object.assign(profile.payload.player.stats, {
    maxHp: 100,
    regeneration: 0,
    lifesteal: 0,
  });
  if (authoredDamage !== undefined)
    Object.assign(profile.payload.endless, {
      slamDamage: authoredDamage,
      slamDamagePerStage: 0,
      damageMultiplier: 1,
    });
  profile.payload.player.hp = hp;
  profile.payload.player.shield = shield;
  const world = new World(CONFIG.width, profile);
  expect(world.start(51)).toBe(true);
  world.stageIndex = stageIndex;
  if (world.endless) isolateEndless(world);
  world.bossSpawned = true;
  world.player.cooldown = 1000;
  return world;
}

function releaseSlam(world: World): void {
  enemy(world, {
    kind: "boss",
    role: "boss",
    hp: 1_000_000,
    maxHp: 1_000_000,
    x: 100,
    y: 300,
    speed: 0,
    arrived: true,
    stage: "Attacking",
    attackPolicy: { type: "anywhere" },
    shotCooldown: 1000,
    patternCooldown: 1000,
    skillsUsed: 3,
    castId: 1,
    castSkill: "slam",
    telegraph: CONFIG.fixedStep / 2,
  });
  world.update(CONFIG.fixedStep);
  expect(world.bossSpecials).toBe(1);
}

describe("deep endless Boss slam damage", () => {
  test("campaign and introductory endless depths retain authored damage", () => {
    for (const stageIndex of [0, 3, 4, 5, 6]) {
      const world = arena(stageIndex, 10, 0, 240);
      expect(world.bossSlamDamage).toBe(240);
    }
  });

  test("from depth four the cap scales with maximum HP, including fractional damage", () => {
    const world = arena(7, 10);
    expect(world.bossSlamDamage).toBe(45);
    world.player.stats.maxHp = 210;
    world.stageIndex = 16;
    expect(world.bossSlamDamage).toBe(94.5);
    world.player.stats.maxHp = 101;
    world.stageIndex = 23;
    expect(world.bossSlamDamage).toBeCloseTo(45.45, 10);
    world.player.hp = 1;
    expect(world.bossSlamDamage).toBeCloseTo(45.45, 10);
  });

  test("a smaller authored slam stays smaller than the cap", () => {
    const world = arena(23, 100, 0, 12);
    expect(world.bossSlamDamage).toBe(12);
  });

  test("a real released slam retains shield absorption and invulnerability", () => {
    const shielded = arena(16, 100, 20);
    releaseSlam(shielded);
    expect(shielded.player.shield).toBe(0);
    expect(shielded.player.hp).toBe(75);
    expect(shielded.damageTaken).toBe(45);
    expect(shielded.phase).toBe("Playing");

    const immune = arena(16, 100, 20);
    immune.player.invulnerable = 1;
    releaseSlam(immune);
    expect(immune.player.shield).toBe(20);
    expect(immune.player.hp).toBe(100);
    expect(immune.damageTaken).toBe(0);
  });

  test("the maximum-HP cap still permits a lethal hit at low current HP", () => {
    const world = arena(16, 20);
    expect(world.bossSlamDamage).toBe(45);
    releaseSlam(world);
    expect(world.player.hp).toBe(0);
    expect(world.phase).toBe("GameOver");
  });
});
