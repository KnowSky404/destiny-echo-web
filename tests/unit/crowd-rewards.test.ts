import { describe, expect, test } from "bun:test";
import { applyCard, CARD_BY_ID, drawCards } from "../../src/data/cards";
import { ENDLESS_KINDS, ENEMIES } from "../../src/data/enemies";
import { stageAt } from "../../src/data/stages";
import { drawBossRewards, TRAINING_BY_ID, TRAININGS } from "../../src/data/training";
import { CONFIG } from "../../src/game/config";
import { seededRandom } from "../../src/game/random";
import { combatStats, overhealStats } from "../../src/game/stats";
import { synergyCount } from "../../src/game/synergies";
import { CROWD_LANES, ENCOUNTER_CAPACITY, MINION_CAPACITY } from "../../src/game/systems/crowd";
import { applyPoison } from "../../src/game/systems/damage";
import { World } from "../../src/game/world";
import { enemy, hit, tick } from "./helpers";

function arena(seed = 4): World {
  const world = new World();
  world.start(seed);
  world.stageIndex = 4;
  world.bossSpawned = true;
  world.stageSupplies = 3;
  world.player.cooldown = 1000;
  world.player.shield = 1e100;
  return world;
}

function formation(world: World): void {
  for (const [lane, x] of CROWD_LANES.entries()) {
    for (let row = 0; row < 6; row++) {
      const y = CONFIG.defense.y - row * CONFIG.crowd.cellHeight;
      enemy(world, {
        kind: ENDLESS_KINDS[(lane + row) % 3],
        x,
        y,
        defenseX: x,
        defenseY: y,
        slot: row * 4 + lane,
        formation: true,
        arrived: true,
        speed: 0,
      });
    }
  }
}

describe("readable capacity and non-destructive summons", () => {
  test("geometry admits 24 minions and a separate boss corridor at every fixed step", () => {
    expect(MINION_CAPACITY).toBe(24);
    expect(ENCOUNTER_CAPACITY).toBe(25);
    for (const seed of [1, 4, 19]) {
      const world = arena(seed);
      world.bossSpawned = false;
      for (let frame = 0; frame < 120 * 65; frame++) {
        world.update(CONFIG.fixedStep);
        const living = world.enemies.items.filter((item) => item.active);
        expect(living.length).toBeLessThanOrEqual(ENCOUNTER_CAPACITY);
        for (const [index, a] of living.entries())
          for (const b of living.slice(index + 1)) {
            // Bounding boxes include rings, bars and stars, not just collision bodies.
            const horizontal = a.kind === "boss" || b.kind === "boss" ? 94 : 68;
            const vertical = a.kind === "boss" || b.kind === "boss" ? 106 : 80;
            expect(
              Math.abs(a.x - b.x) >= horizontal - 1e-6 || Math.abs(a.y - b.y) >= vertical - 1e-6,
            ).toBe(true);
          }
      }
      expect(world.boss).toBeDefined();
      expect(world.fusions).toBeGreaterThan(0);
    }
  }, 20000);

  test("boss entrance preserves ordinary IDs, damage, debuffs and flying hostile shots", () => {
    const world = arena();
    formation(world);
    const minions = world.enemies.items.filter((item) => item.active);
    const original = minions[0];
    if (!original) throw new Error("No minion");
    original.hp = 7;
    original.slowTime = 10;
    const ids = minions.map((item) => item.id);
    const shot = world.hostileShots.acquire();
    if (!shot) throw new Error("No shot");
    Object.assign(shot, { x: 10, y: 10, vx: 0, vy: 10, lifetime: 6, damage: 1 });
    world.bossSpawned = false;
    world.stageElapsed = world.stage.bossAt;
    world.update(CONFIG.fixedStep);
    expect(world.boss).toBeDefined();
    expect(minions.every((item, index) => item.active && item.id === ids[index])).toBe(true);
    expect(original.hp).toBe(7);
    expect(original.slowTime).toBeGreaterThan(9.9);
    expect(shot.active).toBe(true);
    expect(world.enemies.items.filter((item) => item.active)).toHaveLength(25);
  });

  test("saturated summons queue six per threshold, preserve escorts and admit enhanced replacements only into vacancies", () => {
    const world = arena(4);
    formation(world);
    const boss = enemy(world, {
      kind: "boss",
      x: 225,
      y: 180,
      defenseX: 225,
      hp: 1000,
      maxHp: 1000,
      speed: 0,
      attackPolicy: { type: "anywhere" },
    });
    const escorts = world.enemies.items.filter((item) => item.active && item !== boss);
    const originalIds = escorts.map((item) => item.id);
    hit(world, boss, 300);
    expect(boss.lastSkill).toBe("summon");
    expect(world.pendingSummons).toBe(6);
    expect(escorts.map((item) => item.id)).toEqual(originalIds);
    expect(escorts.every((item) => item.active)).toBe(true);
    const casualty = escorts[0];
    if (!casualty) throw new Error("No casualty");
    casualty.active = false;
    const vacatedId = casualty.id;
    world.update(CONFIG.fixedStep);
    expect(world.pendingSummons).toBe(5);
    const summoned = world.enemies.items.find((item) => item.active && item.enhanced);
    expect(summoned?.id).not.toBe(vacatedId);
    expect(summoned?.damageScale).toBeCloseTo(Math.sqrt(world.stage.populationScale) * 1.5);
    expect(summoned?.maxHp).toBe(
      Math.round(
        ENEMIES[summoned?.kind ?? "wisp"].hp *
          world.stage.health *
          world.stage.populationScale *
          (1 + (world.wave - 1) * 0.12) *
          1.5,
      ),
    );
    world.pause();
    const frozen = world.snapshot();
    tick(world, 10);
    expect(world.snapshot()).toEqual(frozen);
    world.resume();
    hit(world, boss, 10000);
    expect(world.pendingSummons).toBe(0);
    expect(world.phase).toBe("StageClear");
  });

  test("endless quotas plateau while all lost population becomes documented minion stats", () => {
    expect([4, 5, 6].map((index) => stageAt(index).enemyCount)).toEqual([270, 360, 360]);
    for (const index of [4, 5, 10, 10000]) {
      const stage = stageAt(index);
      expect(stage.maxEnemies).toBe(25);
      expect(stage.supportCount).toBe(12);
      expect(stage.populationScale).toBeCloseTo(
        (135 * stage.growth) / stage.enemyCount +
          Math.ceil(14 * stage.growth) / stage.supportCount -
          1,
        3,
      );
      const world = arena();
      world.stageIndex = index;
      world.bossSpawned = false;
      tick(world, 0.81);
      const minion = world.enemies.items.find((item) => item.active);
      expect(Number.isFinite(minion?.maxHp)).toBe(true);
      expect(minion?.maxHp).toBe(
        Math.round(ENEMIES[minion?.kind ?? "wisp"].hp * stage.health * stage.populationScale),
      );
      expect(minion?.damageScale).toBeCloseTo(Math.sqrt(stage.populationScale), 3);
    }
  });
});

describe("continuous triple fusion", () => {
  test.each(["wisp", "tank", "wizard"] as const)(
    "three nearby %s upgrade, refill HP and do not trigger deaths",
    (kind) => {
      const world = arena();
      const group = [55, 123, 55].map((x, index) =>
        enemy(world, {
          kind,
          x,
          defenseX: x,
          y: index === 2 ? 384 : 300,
          hp: 3,
          maxHp: 100,
          age: 4,
          speed: 0,
          arrived: true,
          stage: "Attacking",
          shotCooldown: 100,
        }),
      );
      const survivor = group[0];
      if (!survivor) throw new Error("No anchor");
      tick(world, 2);
      expect(survivor.stars).toBe(1);
      world.pause();
      tick(world, 5);
      world.resume();
      tick(world, 1);
      expect(survivor.stars).toBe(2);
      expect(survivor.hp).toBe(350);
      expect(survivor.maxHp).toBe(350);
      expect(survivor.damageScale).toBe(2.5);
      expect(world.enemies.items.filter((item) => item.active)).toHaveLength(1);
      expect(world.kills + world.score + world.explosionCount).toBe(0);
      expect(world.player.poisonTime).toBe(0);
      expect(world.fusions).toBe(1);
    },
  );

  test("proximity must be continuous; different species/stars and bosses cannot fuse", () => {
    const world = arena();
    const a = enemy(world, { x: 55, y: 300, age: 4, speed: 0, arrived: true });
    const b = enemy(world, { x: 123, y: 300, age: 4, speed: 0, arrived: true });
    const c = enemy(world, { x: 55, y: 384, age: 4, speed: 0, arrived: true });
    tick(world, 2);
    c.y = 100;
    tick(world, 0.1);
    c.y = 384;
    tick(world, 1.5);
    expect(a.stars).toBe(1);
    b.stars = 2;
    tick(world, 4);
    expect(world.fusions).toBe(0);
    b.stars = 1;
    c.kind = "tank";
    tick(world, 4);
    expect(world.fusions).toBe(0);
    for (const item of [a, b, c]) {
      item.kind = "boss";
      item.stars = 1;
    }
    tick(world, 4);
    expect(world.fusions).toBe(0);
  });

  test("second promotion reaches three stars and no promotion exceeds the ceiling", () => {
    const world = arena();
    const group = [55, 123, 55].map((x, index) =>
      enemy(world, {
        x,
        defenseX: x,
        y: index === 2 ? 384 : 300,
        stars: 2,
        damageScale: 2.5,
        maxHp: 350,
        hp: 1,
        age: 4,
        speed: 0,
        arrived: true,
        stage: "Attacking",
        shotCooldown: 100,
      }),
    );
    tick(world, 3);
    expect(group[0]?.stars).toBe(3);
    expect(group[0]?.maxHp).toBe(1225);
    expect(group[0]?.damageScale).toBe(6.25);
    for (let index = 1; index < 3; index++)
      enemy(world, { stars: 3, x: 55 + index * 34, y: 300, age: 4, speed: 0, arrived: true });
    tick(world, 4);
    expect(world.fusions).toBe(1);
  });
});

describe("active enemy decisions", () => {
  test("approaching tanks can cast finite taunts, but do not taunt passively or deal melee damage", () => {
    const world = arena(1);
    const tank = enemy(world, { kind: "tank", x: 55, y: 250, speed: 0, skillCooldown: 0 });
    const preferred = enemy(world, { x: 395, y: 100, speed: 0 });
    world.selectTargetAt(preferred);
    expect(world.targetId).toBe(preferred.id);
    let casts = 0;
    for (let index = 0; index < 40; index++) {
      tank.skillCooldown = 0;
      world.update(CONFIG.fixedStep);
      if (tank.tauntRemaining > 0) {
        casts++;
        expect(world.targetId).toBe(tank.id);
        tank.skillCooldown = 100;
        tick(world, CONFIG.skills.tauntDuration + 0.02);
        expect(world.targetId).toBe(preferred.id);
      }
    }
    expect(casts).toBeGreaterThan(0);
    expect(world.regularAttacks).toBe(0);
  });

  test("ready tanks choose one action; wizards choose shots or poison, never both on the same action", () => {
    for (const kind of ["tank", "wizard"] as const) {
      const world = arena(1);
      const unit = enemy(world, { kind, y: 620, arrived: true, stage: "Attacking", speed: 0 });
      const actions = new Set<string>();
      for (let action = 0; action < 40; action++) {
        world.hostileShots.clear();
        world.player.poisonTime = 0;
        unit.shotCooldown = 0;
        const before = world.regularAttacks;
        world.update(CONFIG.fixedStep);
        actions.add(unit.lastAction ?? "none");
        expect(world.regularAttacks - before).toBe(unit.lastAction === "attack" ? 1 : 0);
        expect(world.hostileShots.items.some((shot) => shot.active)).toBe(
          kind === "wizard" && unit.lastAction === "attack",
        );
        expect(world.player.poisonTime > 0).toBe(unit.lastAction === "poison");
      }
      expect(actions).toEqual(
        new Set(kind === "tank" ? ["taunt", "attack"] : ["poison", "attack"]),
      );
    }
  });
});

describe("low-value shield engine", () => {
  test("one overflow card enables capped lifesteal conversion before six blood layers", () => {
    const world = arena();
    world.player.shield = 0;
    for (const id of ["overflow", "leech"]) applyCard(id, world.player, world.stacks);
    expect(synergyCount(world.stacks, "blood")).toBe(2);
    const target = enemy(world, { y: 300, speed: 0, hp: 10000, maxHp: 10000 });
    hit(world, target, 100);
    expect(world.player.shield).toBeCloseTo(0.4, 6);
    world.player.hp = 50;
    hit(world, target, 100);
    expect(world.player.hp).toBe(54);
    expect(world.player.shield).toBeCloseTo(0.4, 6);
    world.player.hp = 100;
    hit(world, target, 5000);
    expect(world.player.shield).toBe(20);
    applyCard("reservoir", world.player, world.stacks);
    expect(overhealStats(world.player, world.stacks).capacity).toBeCloseTo(30, 6);
    world.player.shield = 100;
    hit(world, target, 1);
    expect(world.player.shield).toBe(100);
  });

  test("shield leech is conditional and poison reduces conversion before the cap", () => {
    const world = arena();
    world.player.shield = 0;
    for (const id of ["reservoir", "shield-leech", "leech"])
      applyCard(id, world.player, world.stacks);
    expect(combatStats(world.player, world.stacks).lifesteal).toBeCloseTo(0.04);
    world.player.shield = 1;
    expect(combatStats(world.player, world.stacks).lifesteal).toBeCloseTo(0.06);
    applyPoison(world.player);
    const target = enemy(world, { y: 300, speed: 0, hp: 10000, maxHp: 10000 });
    hit(world, target, 100);
    expect(world.player.shield).toBeCloseTo(1 - 6 / 120 + 6 * 0.1 * 0.05, 6);
  });
});

describe("boss-only mixed training rewards", () => {
  test("every boss offers two distinct trainings and one augment; other sources never offer training", () => {
    const world = arena();
    for (let seed = 0; seed < 30; seed++) {
      for (const index of [0, 3, 4]) {
        const choices = drawBossRewards(world.player, world.stacks, seededRandom(seed), index);
        expect(choices).toHaveLength(3);
        expect(new Set(choices).size).toBe(3);
        expect(choices.filter((id) => TRAINING_BY_ID.has(id))).toHaveLength(2);
        expect(choices.filter((id) => CARD_BY_ID.has(id))).toHaveLength(1);
      }
      for (const source of ["chest", "supply"] as const)
        expect(
          drawCards(world.player, world.stacks, seededRandom(seed), source, 4).every(
            (id) => !TRAINING_BY_ID.has(id),
          ),
        ).toBe(true);
    }
  });

  test("training uses the same one-use token, persists separately from synergies, and the finale pays before victory", () => {
    const world = arena();
    world.stageIndex = 3;
    world.clearedStages = 3;
    const boss = enemy(world, { kind: "boss", x: 225, y: 300, hp: 1, speed: 0 });
    hit(world, boss, 1);
    expect(world.phase).toBe("StageClear");
    expect(world.continueEndless()).toBe(false);
    const reward = world.reward;
    const id = reward?.choices[0];
    if (!reward || !id) throw new Error("No reward");
    const before = world.snapshot();
    tick(world, 5);
    expect(world.snapshot()).toEqual(before);
    expect(world.chooseCard(id, reward.token + 1)).toBe(false);
    expect(world.chooseCard(id, reward.token)).toBe(true);
    expect(world.phase).toBe("Victory");
    expect(world.stacks.size).toBe(0);
    expect(world.trainingStacks.get(id)).toBe(1);
    expect(world.chooseCard(id, reward.token)).toBe(false);
    expect(world.continueEndless()).toBe(true);
    expect(world.trainingStacks.get(id)).toBe(1);
    world.pause();
    world.start(8);
    expect(world.trainingStacks.size).toBe(0);
    expect(world.fusions + world.pendingSummons).toBe(0);
  });

  test("capped training stats are ineligible but two unlimited numeric choices always remain", () => {
    const world = arena();
    world.player.stats.critChance = 0.85;
    world.player.stats.lifesteal = 0.5;
    world.player.stats.interval = 0.08;
    const capped = ["training-critical", "training-leech", "training-haste"];
    for (const id of capped) expect(TRAINING_BY_ID.get(id)?.eligible(world.player)).toBe(false);
    for (const item of TRAININGS)
      if (!capped.includes(item.id)) expect(item.eligible(world.player)).toBe(true);
    const reward = drawBossRewards(world.player, world.stacks, seededRandom(4), 4);
    expect(reward).toHaveLength(3);
    expect(reward.some((id) => capped.includes(id))).toBe(false);
    // Synergy-derived caps must also exclude numeric upgrades with no combat effect.
    for (const id of [
      "keen",
      "keen",
      "keen",
      "leech",
      "leech",
      "leech",
      "piercing",
      "piercing",
      "piercing",
    ])
      applyCard(id, world.player, world.stacks);
    world.player.stats.critChance = 0.8;
    world.player.stats.lifesteal = 0.45;
    world.player.stats.interval = 0.085;
    for (let seed = 0; seed < 50; seed++)
      expect(
        drawBossRewards(world.player, world.stacks, seededRandom(seed), 4).some((id) =>
          capped.includes(id),
        ),
      ).toBe(false);
  });
});
