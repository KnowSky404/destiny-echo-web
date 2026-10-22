import { describe, expect, test } from "bun:test";
import { applyCard, CARD_BY_ID, drawCards } from "../../src/data/cards";
import { ENEMIES } from "../../src/data/enemies";
import { stageAt } from "../../src/data/stages";
import { drawBossRewards } from "../../src/data/training";
import { arenaLayout, arenaWidthForViewport } from "../../src/game/arena";
import { CONFIG } from "../../src/game/config";
import { seededRandom } from "../../src/game/random";
import { combatStats } from "../../src/game/stats";
import {
  advancePoison,
  applyPoison,
  applyWounds,
  cleansePlayer,
  grantShield,
  healingMultiplier,
  healPlayer,
} from "../../src/game/systems/damage";
import { attackPermitted } from "../../src/game/systems/enemy";
import { createPlayer, World } from "../../src/game/world";
import { enemy, hit, tick } from "./helpers";

function passive(width: number = CONFIG.width, seed = 71) {
  const world = new World(width);
  world.start(seed);
  world.stageIndex = 4;
  world.stageSupplies = 3;
  world.bossSpawned = true;
  world.player.cooldown = 1000;
  world.player.shield = 100000;
  return world;
}

function clearAndAdvance(world: World) {
  hit(
    world,
    enemy(world, {
      kind: "boss",
      x: world.player.x,
      defenseX: world.player.x,
      y: 100,
      hp: 1,
      maxHp: 1,
      speed: 0,
    }),
    1,
  );
  expect(world.phase).toBe("StageClear");
  const reward = world.reward;
  if (!reward) throw new Error("Missing stage reward");
  world.chooseCard(reward.choices[0] ?? "", reward.token);
  world.stageSupplies = 3;
  world.bossSpawned = true;
  world.player.cooldown = 1000;
}

describe("arena geometry and expanding attack regions", () => {
  test("1080p gets six lanes and 36 minions while portrait keeps four lanes and 24", () => {
    const mobile = arenaLayout(arenaWidthForViewport(393, 851));
    const desktop = arenaLayout(arenaWidthForViewport(1920, 1080));
    expect(mobile.laneCount).toBe(4);
    expect(mobile.minionCapacity).toBe(24);
    expect(desktop.laneCount).toBe(6);
    expect(desktop.minionCapacity).toBe(36);
    expect(arenaLayout(arenaWidthForViewport(2560, 1080)).laneCount).toBeGreaterThan(6);
    expect(stageAt(0, desktop.width).enemyCount).toBe(60);
    expect(stageAt(4, desktop.width).maxEnemies).toBe(37);
    for (const arena of [mobile, desktop]) {
      expect(new Set(arena.crowdLanes).size).toBe(arena.laneCount);
      for (const x of arena.crowdLanes) {
        expect(x).toBeGreaterThan(ENEMIES.tank.radius);
        expect(x).toBeLessThan(arena.width - ENEMIES.tank.radius);
        expect(Math.abs(x - arena.player.x)).toBeGreaterThan(94);
      }
    }
  });

  test("campaign ranged and melee stopping points share visible, distinct slots in every layout", () => {
    for (const width of [450, 1600])
      for (let index = 0; index < 4; index++) {
        const world = passive(width);
        world.stageIndex = index;
        world.bossSpawned = false;
        world.player.shield = 1e8;
        tick(world, world.stage.bossAt - 1);
        const minions = world.enemies.items.filter((item) => item.active && item.kind !== "boss");
        expect(minions.length).toBeGreaterThan(10);
        expect(new Set(minions.map((item) => `${item.defenseX}:${item.defenseY}`)).size).toBe(
          minions.length,
        );
        for (const minion of minions) {
          expect(minion.defenseY).toBeGreaterThanOrEqual(200);
          expect(minion.defenseY).toBeLessThanOrEqual(CONFIG.defense.y);
        }
      }
  });

  test.each([450, 800, 1600, 2400])(
    "endless clearances add unique regions until the field above the aircraft row is covered: %s",
    (width) => {
      const a = passive(width, 0);
      const b = passive(width, 0);
      const baseline = a.attackRegions.length;
      expect(a.arena.attackRegions).toHaveLength(a.arena.laneCount * 7);
      expect(new Set(a.arena.attackRegions.map((region) => region.y))).toEqual(
        new Set([0, 100, 200, 300, 400, 500, 600]),
      );
      for (const region of a.arena.attackRegions) {
        expect(region.y).toBeLessThan(700);
        expect(region.height).toBe(100);
        expect(region.y + region.height).toBeLessThanOrEqual(700);
      }
      expect(baseline).toBe(a.arena.laneCount * 2);
      expect(new Set(a.attackRegions.map((region) => region.y))).toEqual(new Set([500, 600]));
      expect(
        a.attackRegions.reduce((area, region) => area + region.width * region.height, 0),
      ).toBeCloseTo(width * 200, 6);
      for (let stage = 0; stage < 30; stage++) {
        const previous = [...a.attackRegions];
        clearAndAdvance(a);
        clearAndAdvance(b);
        if (stage === 0) {
          const previousIds = new Set(previous.map((region) => region.id));
          const added = a.attackRegions.filter((region) => !previousIds.has(region.id));
          expect(added).toHaveLength(2);
          expect(added.every((region) => region.y < 500)).toBe(true);
        }
        expect(a.attackRegions).toEqual(b.attackRegions);
        expect(a.attackRegions.length).toBe(
          Math.min(baseline + (stage + 1) * 2, a.arena.attackRegions.length),
        );
        expect(new Set(a.attackRegions.map((region) => region.id)).size).toBe(
          a.attackRegions.length,
        );
        for (const region of previous) expect(a.attackRegions).toContainEqual(region);
        for (const [index, region] of a.attackRegions.entries()) {
          expect(region.x).toBeGreaterThanOrEqual(0);
          expect(region.y).toBeGreaterThanOrEqual(0);
          expect(region.x + region.width).toBeLessThanOrEqual(width + 1e-9);
          expect(region.y + region.height).toBeLessThanOrEqual(700);
          for (const other of a.attackRegions.slice(index + 1)) {
            const overlapWidth =
              Math.min(region.x + region.width, other.x + other.width) -
              Math.max(region.x, other.x);
            const overlapHeight =
              Math.min(region.y + region.height, other.y + other.height) -
              Math.max(region.y, other.y);
            expect(overlapWidth <= 1e-9 || overlapHeight <= 1e-9).toBe(true);
          }
        }
      }
      expect(
        a.attackRegions.reduce((area, region) => area + region.width * region.height, 0),
      ).toBeCloseTo(width * 700, 6);
      a.pause();
      const saved = a.snapshot();
      tick(a, 10);
      expect(a.snapshot()).toEqual(saved);
      a.start(71);
      expect(a.attackRegions).toEqual(a.arena.baseAttackRegions);
    },
  );

  test("new regions grant real melee damage before arrival and preserve target priority", () => {
    const world = passive();
    clearAndAdvance(world);
    const baseline = new Set(world.arena.baseAttackRegions.map((region) => region.id));
    const region = world.attackRegions.find((region) => !baseline.has(region.id));
    if (!region) throw new Error("No added region");
    const attacker = enemy(world, {
      x: region.x + region.width / 2,
      y: region.y + region.height / 2,
      defenseX: region.x + region.width / 2,
      speed: 0,
      arrived: false,
      attackPolicy: { type: "zones", regions: world.attackRegions },
    });
    expect(attackPermitted(attacker)).toBe(true);
    const before = world.player.shield;
    tick(world, ENEMIES.wisp.preparation * world.stage.attackTiming + 0.05);
    expect(attacker.arrived).toBe(false);
    expect(world.regularAttacks).toBe(1);
    expect(world.player.shield).toBeLessThan(before);
    expect(world.targetId).toBe(attacker.id);
  });
});

describe("boss cleanup and rewards", () => {
  test.each([0, 3, 4])(
    "boss death preserves escorts, their hazards and danger; final escort unlocks one reward: %s",
    (stage) => {
      const world = passive();
      world.stageIndex = stage;
      const escort = enemy(world, { x: 100, y: 620, speed: 0, arrived: true, hp: 1000 });
      const boss = enemy(world, {
        kind: "boss",
        x: 225,
        defenseX: 225,
        y: 100,
        hp: 1,
        maxHp: 1,
        speed: 0,
      });
      world.sanctuaryRemaining = CONFIG.fixedStep;
      world.pendingSummons = 6;
      hit(world, boss, 1);
      expect(world.phase).toBe("Playing");
      expect(world.bossDefeated).toBe(true);
      expect(world.clearedStages).toBe(0);
      expect(escort.active).toBe(true);
      expect(world.pendingSummons).toBe(0);
      const count = world.enemies.items.filter((item) => item.active).length;
      tick(world, 3);
      expect(world.enemies.items.filter((item) => item.active)).toHaveLength(count);
      expect(world.regularAttacks).toBeGreaterThan(0);
      hit(world, escort, 1001);
      expect(world.clearedStages).toBe(1);
      expect(world.phase).toBe("StageClear");
      const cleared = world.snapshot();
      tick(world, 2);
      expect(world.snapshot()).toEqual(cleared);
    },
  );

  test("surviving minions can defeat the player after boss death", () => {
    const world = passive();
    world.player.shield = 0;
    world.player.hp = 1;
    enemy(world, { x: 80, y: 620, arrived: true, speed: 0, stage: "Attacking", shotCooldown: 1 });
    hit(
      world,
      enemy(world, { kind: "boss", x: 225, defenseX: 225, y: 100, hp: 1, maxHp: 1, speed: 0 }),
      1,
    );
    tick(world, 1.1);
    expect(world.phase).toBe("GameOver");
    expect(world.clearedStages).toBe(0);
  });

  test("boss augment is random across all rarities and the first-stage allowlist applies before promotion", () => {
    const player = createPlayer();
    const stacks = new Map([["force", 3]]);
    const rarities = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const rewards = drawBossRewards(player, stacks, seededRandom(seed), 1);
      const card = CARD_BY_ID.get(rewards[2] ?? "");
      if (!card) throw new Error("Missing augment");
      rarities.add(card.rarity);
      for (const source of ["chest", "supply", "stage"] as const)
        for (const id of drawCards(player, stacks, seededRandom(seed), source, 0)) {
          const offered = CARD_BY_ID.get(id);
          if (!offered) throw new Error("Unknown card");
          expect(["barrage", "might", "precision", "storm"]).toContain(offered.synergy);
        }
    }
    expect([...rarities].sort()).toEqual(["common", "epic", "rare"]);
  });

  test("every endless boss exceeds the strongest same-stage enhanced three-star tank", () => {
    for (const width of [450, 1600])
      for (let index = 4; index < 44; index++) {
        const stage = stageAt(index, width);
        const tank =
          Math.round(ENEMIES.tank.hp * stage.health * stage.populationScale * 1.48 * 1.5) *
          3.5 ** 2;
        expect(stage.bossHp).toBeGreaterThan(tank);
        expect(stage.damage).toBeGreaterThan(stageAt(3, width).damage * 1.2);
        expect(stage.attackTiming).toBeLessThan(0.8);
      }
  });
});

describe("wounds and escalating poison", () => {
  test("wounds reduce all health and shield grants by a fixed 90%, only duration stacks", () => {
    const player = createPlayer();
    player.hp = 10;
    applyWounds(player, 3);
    applyWounds(player, 3);
    expect(player.woundTime).toBe(6);
    expect(healingMultiplier(player)).toBeCloseTo(0.1);
    expect(healPlayer(player, 30)).toBeCloseTo(3);
    expect(grantShield(player, 24)).toBeCloseTo(2.4);
    applyCard("aegis-core", player, new Map());
    expect(player.hp).toBeCloseTo(21);
    expect(player.shield).toBeCloseTo(8.4);
    advancePoison(player, 6);
    expect(grantShield(player, 24)).toBe(24);
  });

  test("wounded timed shields apply the recovery penalty before clamping to available capacity", () => {
    const world = passive();
    for (let i = 0; i < 3; i++) applyCard("ward", world.player, world.stacks);
    world.player.shield = 59.9;
    applyWounds(world.player, 10);
    tick(world, 3);
    expect(world.player.shield).toBe(60);
    expect(world.shieldRestored).toBeCloseTo(0.1);
  });

  test("reapplication adds exactly one random stat and three seconds, shield gates the final speed penalty", () => {
    const player = createPlayer();
    player.shield = 15;
    applyPoison(player);
    advancePoison(player, 1);
    expect(player.shield).toBe(5);
    expect(player.hp).toBe(100);
    applyPoison(player, () => 0);
    expect(player.poisonDamageBonus).toBe(1);
    expect(player.poisonSlowBonus).toBe(0);
    expect(player.poisonTime).toBe(5);
    applyPoison(player, () => 0.99);
    expect(player.poisonDamageBonus).toBe(1);
    expect(player.poisonSlowBonus).toBeCloseTo(0.01);
    expect(player.poisonTime).toBe(8);
    expect(player.woundTime).toBe(8);
    advancePoison(player, 1);
    expect(player.hp).toBe(94);
    expect(combatStats(player, new Map()).interval).toBeCloseTo(0.34 / 0.69);
    grantShield(player, 100);
    expect(combatStats(player, new Map()).interval).toBe(0.34);
    cleansePlayer(player);
    expect(player.poisonDamageBonus + player.poisonSlowBonus + player.woundTime).toBe(0);
  });

  test("many repetitions keep a finite interval, and expiry removes bonuses and slow", () => {
    const player = createPlayer();
    player.hp = player.stats.maxHp = 10000;
    for (let i = 0; i < 100; i++) applyPoison(player, () => 0.99);
    expect(combatStats(player, new Map()).interval).toBeCloseTo(3.4);
    advancePoison(player, player.poisonTime);
    expect(
      player.poisonTime + player.woundTime + player.poisonDamageBonus + player.poisonSlowBonus,
    ).toBe(0);
    expect(combatStats(player, new Map()).interval).toBe(0.34);
  });
});

describe("health scaling builds and global retaliation", () => {
  test.each([1000, 100000])(
    "giant slayer and erosion deal the documented max/current HP damage: %s",
    (hp) => {
      const world = passive();
      applyCard("giant-slayer", world.player, world.stacks);
      applyCard("life-rend", world.player, world.stacks);
      applyCard("decay", world.player, world.stacks);
      const victim = enemy(world, { x: 225, y: 300, hp, maxHp: hp, speed: 0 });
      hit(world, victim, 12);
      expect(hp - victim.hp).toBeCloseTo(12 + hp * (0.0025 + 0.002 + 0.01));
    },
  );

  test("body-size bonus grows with enemy max HP and percent triggers do not recurse through splash", () => {
    const world = passive();
    applyCard("titan-breaker", world.player, world.stacks);
    applyCard("giant-slayer", world.player, world.stacks);
    applyCard("splash", world.player, world.stacks);
    const victim = enemy(world, { x: 225, y: 300, hp: 10000, maxHp: 10000, speed: 0 });
    const neighbor = enemy(world, { x: 260, y: 300, hp: 10000, maxHp: 10000, speed: 0 });
    hit(world, victim, 12);
    expect(10000 - victim.hp).toBeCloseTo(12 * (1 + 0.04 * Math.log2(101)) + 25);
    expect(10000 - neighbor.hp).toBeCloseTo(12 * 0.15);
  });

  test("global erosion uses each victim's max HP and never hits a chest", () => {
    const world = passive();
    applyCard("entropy", world.player, world.stacks);
    const small = enemy(world, { x: 55, y: 100, hp: 1000, maxHp: 1000, speed: 0 });
    const large = enemy(world, { x: 395, y: 100, hp: 100000, maxHp: 100000, speed: 0 });
    tick(world, 4);
    expect(small.hp).toBe(995);
    expect(large.hp).toBe(99500);
  });

  test("kill explosions include the source monster's max HP", () => {
    const world = passive();
    applyCard("fuse", world.player, world.stacks);
    const source = enemy(world, { x: 200, y: 300, hp: 1, maxHp: 10000, speed: 0 });
    const victim = enemy(world, { x: 270, y: 300, hp: 1000, maxHp: 1000, speed: 0 });
    hit(world, source, 1);
    expect(victim.hp).toBe(1000 - 16 - 10000 * 0.03);
  });

  test.each([450, 1600])(
    "one shielded hit retaliates against every enemy, including a dying boss's escorts: %s",
    (width) => {
      const world = passive(width);
      applyCard("thorns", world.player, world.stacks);
      const targets = [
        enemy(world, { x: 50, y: 200, hp: 1000, speed: 0 }),
        enemy(world, {
          kind: "boss",
          x: world.player.x,
          defenseX: world.player.x,
          y: 100,
          hp: 1,
          maxHp: 1,
          speed: 0,
        }),
        enemy(world, { x: width - 50, y: 200, hp: 1000, speed: 0 }),
      ];
      const attacker = enemy(world, {
        x: width / 2 - 100,
        y: 620,
        arrived: true,
        speed: 0,
        stage: "Attacking",
        hp: 1000,
      });
      world.update(CONFIG.fixedStep);
      expect(world.bossDefeated).toBe(true);
      expect(targets[0]?.hp).toBe(982);
      expect(targets[2]?.hp).toBe(982);
      expect(attacker.hp).toBe(982);
      expect(world.phase).toBe("Playing");
      expect(world.player.hp).toBe(100);
    },
  );
});
