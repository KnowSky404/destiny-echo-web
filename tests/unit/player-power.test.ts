import { describe, expect, test } from "bun:test";
import { applyCard, CARD_BY_ID, CARDS, drawCards, EPIC_CARDS } from "../../src/data/cards";
import { CONFIG } from "../../src/game/config";
import { seededRandom } from "../../src/game/random";
import { combatStats } from "../../src/game/stats";
import { createPlayer, World } from "../../src/game/world";
import { enemy, hit, tick } from "./helpers";

function ready(ids = ["edict"]): World {
  const world = new World();
  world.start(30);
  world.bossSpawned = true;
  world.player.cooldown = 1000;
  for (const id of ids) expect(applyCard(id, world.player, world.stacks)).toBe(true);
  tick(world, 8 - CONFIG.fixedStep);
  return world;
}

describe("cleansing sanctuary has separate player and hostile clocks", () => {
  test("cleanses lethal poison and attack slow before the activation step can hurt the player", () => {
    const world = ready();
    world.player.hp = 0.01;
    world.player.poisonTime = 3;
    world.player.poisonSlowTime = 3;
    world.update(CONFIG.fixedStep);
    expect(world.phase).toBe("Playing");
    expect(world.player.hp).toBe(0.01);
    expect(world.player.poisonTime).toBe(0);
    expect(world.player.poisonSlowTime).toBe(0);
    expect(combatStats(world.player, world.stacks).interval).toBe(0.34);
    expect(world.sanctuaryRemaining).toBeCloseTo(0.75 - CONFIG.fixedStep, 6);
  });

  test("freezes movement, boss charge, status timers, hostile projectiles and chests while firing continues", () => {
    const world = ready();
    const mover = enemy(world, { x: 80, y: 100, speed: 80, slowTime: 2, slow: 0.2 });
    const boss = enemy(world, {
      kind: "boss",
      x: 225,
      y: 520,
      arrived: true,
      stage: "Attacking",
      hp: 10000,
      maxHp: 10000,
      telegraph: 2,
      interruptRequired: 10000,
      shotCooldown: 1,
      damageReductionTime: 2,
    });
    const hostile = world.hostileShots.acquire();
    const chest = world.chests.acquire();
    if (!hostile || !chest) throw new Error("Missing fixture pool slot");
    Object.assign(hostile, { x: 10, y: 10, vx: 30, vy: 60, lifetime: 6, damage: 10 });
    Object.assign(chest, { id: 99999, x: 400, y: 240, hp: 36, maxHp: 36, age: 0 });
    world.player.cooldown = 0;
    const stageTime = world.stageElapsed;
    world.update(CONFIG.fixedStep);
    tick(world, 0.5);
    expect(world.stageElapsed).toBe(stageTime);
    expect(world.elapsed).toBeGreaterThan(8.4);
    expect([mover.x, mover.y, mover.slowTime]).toEqual([80, 100, 2]);
    expect([boss.telegraph, boss.shotCooldown, boss.damageReductionTime]).toEqual([2, 1, 2]);
    expect([hostile.x, hostile.y, hostile.lifetime]).toEqual([10, 10, 6]);
    expect([chest.y, chest.age]).toEqual([240, 0]);
    expect(boss.hp).toBeLessThan(10000);
    expect(world.enemyAttacks).toBe(0);
    tick(world, 0.6);
    expect(world.stageElapsed).toBeGreaterThan(stageTime);
    expect(mover.y).toBeGreaterThan(100);
    expect(hostile.y).toBeGreaterThan(10);
  });

  test("frozen bullets cannot collide, remain intact, and become dangerous again after time resumes", () => {
    const world = ready();
    const hostile = world.hostileShots.acquire();
    if (!hostile) throw new Error("No hostile fixture");
    Object.assign(hostile, { x: 225, y: 736, vx: 0, vy: 0, lifetime: 6, damage: 10 });
    world.update(CONFIG.fixedStep);
    tick(world, 0.6);
    expect(world.player.hp).toBe(100);
    expect(hostile.active).toBe(true);
    tick(world, 0.2);
    expect(world.player.hp).toBe(90);
    expect(hostile.active).toBe(false);
  });

  test("bosses get the full duration and their damage-triggered skills wait for hostile time", () => {
    const world = ready();
    world.stageIndex = 4;
    world.stageSupplies = 3;
    const boss = enemy(world, {
      kind: "boss",
      x: 225,
      y: 200,
      hp: 1000,
      maxHp: 1000,
      attackPolicy: { type: "anywhere" },
      speed: 0,
    });
    world.update(CONFIG.fixedStep);
    hit(world, boss, 500);
    expect(boss.hp).toBe(500);
    expect(boss.skillsUsed).toBe(0);
    tick(world, 0.3);
    expect(world.sanctuaryRemaining).toBeGreaterThan(0.4);
    expect(boss.skillsUsed).toBe(0);
    tick(world, 0.5);
    expect(boss.skillsUsed).toBe(1);
    expect(world.bossSpecials).toBe(1);
  });

  test("killing a wizard during sanctuary cannot reapply poison", () => {
    const world = ready();
    world.update(CONFIG.fixedStep);
    const wizard = enemy(world, { kind: "wizard", x: 225, y: 300, hp: 1, speed: 0 });
    hit(world, wizard, 1);
    expect(wizard.active).toBe(false);
    expect(world.player.poisonTime).toBe(0);
    expect(world.player.poisonSlowTime).toBe(0);
  });

  test("scheduled spawning waits, and the pulse cooldown cannot recharge inside itself", () => {
    const world = ready();
    world.stageElapsed = 96 - 0.2;
    world.bossSpawned = false;
    const before = world.stageElapsed;
    world.update(CONFIG.fixedStep);
    tick(world, 0.6);
    expect(world.phase).toBe("Playing");
    expect(world.stageElapsed).toBe(before);
    expect(world.bossSpawned).toBe(false);
    tick(world, 0.4);
    expect(world.phase).toBe("Playing");
    expect(world.bossSpawned).toBe(true);
    expect(world.controlProcs).toBe(1);

    const cooldown = ready();
    cooldown.update(CONFIG.fixedStep);
    tick(cooldown, 7.9);
    expect(cooldown.controlProcs).toBe(1);
    tick(cooldown, 0.9);
    expect(cooldown.controlProcs).toBe(2);
  });

  test("pause and reward choices preserve the remaining duration; stage advance and restart clear it", () => {
    const world = ready();
    world.update(CONFIG.fixedStep);
    world.pause();
    const paused = world.snapshot();
    tick(world, 5);
    expect(world.snapshot()).toEqual(paused);
    world.resume();
    const chest = world.chests.acquire();
    if (!chest) throw new Error("No chest fixture");
    Object.assign(chest, { id: 99999, x: 225, y: 500, hp: 1, maxHp: 1, age: 0 });
    world.player.cooldown = 0;
    tick(world, 0.5);
    expect(world.phase).toBe("RewardSelection");
    const frozen = world.snapshot();
    tick(world, 5);
    expect(world.snapshot()).toEqual(frozen);
    const reward = world.reward;
    if (!reward) throw new Error("No reward");
    expect(world.chooseCard(reward.choices[0] ?? "", reward.token)).toBe(true);
    expect(world.sanctuaryRemaining).toBe(frozen.sanctuaryRemaining);
    const boss = enemy(world, { kind: "boss", x: 225, y: 500, hp: 1 });
    hit(world, boss, 1);
    expect(world.phase).toBe("StageClear");
    expect(world.sanctuaryRemaining).toBe(0);
    const stageReward = world.reward;
    if (!stageReward) throw new Error("No stage reward");
    world.chooseCard(stageReward.choices[0] ?? "", stageReward.token);
    expect(world.stageElapsed).toBe(0);
    world.pause();
    world.start(30);
    expect(world.sanctuaryRemaining).toBe(0);
    expect(world.player).toEqual(createPlayer());
  });

  test("sanctuary and epic builds are deterministic at 30, 60 and 144 Hz", () => {
    const snapshots = [30, 60, 144].map((rate) => {
      const world = new World();
      world.start(99);
      world.bossSpawned = true;
      applyCard("chronocrown", world.player, world.stacks);
      applyCard("titan-heart", world.player, world.stacks);
      enemy(world, { id: 9000, x: 225, y: 300, speed: 0, hp: 100000, maxHp: 100000 });
      for (let frame = 0; frame < rate * 20; frame++) world.update(1 / rate);
      return world.snapshot();
    });
    expect(snapshots[0]).toEqual(snapshots[1]);
    expect(snapshots[0]).toEqual(snapshots[2]);
    expect(snapshots[0]?.metrics.controlProcs).toBeGreaterThanOrEqual(2);
    expect(snapshots[0]?.stageElapsed).toBeCloseTo(18, 6);
  });
});

describe("epic progression and actual power", () => {
  test.each(EPIC_CARDS)(
    "$name preserves a reachable nine-point build when acquired first",
    (epic) => {
      const player = createPlayer();
      const stacks = new Map<string, number>();
      applyCard(epic.id, player, stacks);
      for (let points = 1; points < 9; points++) {
        const card = CARDS.find(
          (candidate) =>
            candidate.synergy === epic.synergy &&
            (candidate.maxStacks === null ||
              (stacks.get(candidate.id) ?? 0) < candidate.maxStacks) &&
            candidate.eligible(player),
        );
        if (!card) throw new Error(`Epic blocked family progression: ${epic.id}`);
        expect(applyCard(card.id, player, stacks)).toBe(true);
      }
      expect([...stacks.values()].reduce((sum, n) => sum + n, 0)).toBe(9);
    },
  );
  test("every family has a once-per-run epic that still contributes one family point", () => {
    expect(EPIC_CARDS).toHaveLength(10);
    expect(new Set(EPIC_CARDS.map((card) => card.synergy)).size).toBe(10);
    for (const card of EPIC_CARDS) {
      const player = createPlayer();
      const stacks = new Map<string, number>();
      expect(applyCard(card.id, player, stacks)).toBe(true);
      const after = structuredClone(player);
      expect(applyCard(card.id, player, stacks)).toBe(false);
      expect(player).toEqual(after);
      expect([...stacks.values()]).toEqual([1]);
    }
  });

  test("early rewards keep foundations, later rewards can promote an epic, stage rewards guarantee one", () => {
    const player = createPlayer();
    const stacks = new Map<string, number>();
    for (let seed = 0; seed < 100; seed++)
      expect(
        drawCards(player, stacks, seededRandom(seed)).some(
          (id) => CARD_BY_ID.get(id)?.rarity === "epic",
        ),
      ).toBe(false);
    for (let index = 0; index < 3; index++) applyCard("ward", player, stacks);
    let promotions = 0;
    for (let seed = 0; seed < 100; seed++) {
      for (const source of ["chest", "supply", "stage"] as const) {
        const cards = drawCards(player, stacks, seededRandom(seed), source).map((id) =>
          CARD_BY_ID.get(id),
        );
        expect(new Set(cards).size).toBe(3);
        expect(cards.some((card) => card?.offense)).toBe(true);
        const epics = cards.filter((card) => card?.rarity === "epic");
        if (source === "stage") expect(epics).toHaveLength(1);
        else promotions += epics.length;
      }
    }
    expect(promotions).toBeGreaterThan(0);
    expect(promotions).toBeLessThan(200);
    for (const card of EPIC_CARDS) applyCard(card.id, player, stacks);
    expect(
      drawCards(player, stacks, seededRandom(1), "stage").some(
        (id) => CARD_BY_ID.get(id)?.rarity === "epic",
      ),
    ).toBe(false);
  });

  test("power, barrage and survival epics change real shots and absorb incoming damage", () => {
    const world = new World();
    world.start(3);
    world.bossSpawned = true;
    for (const id of ["titan-heart", "heavenly-barrage", "aegis-core"])
      applyCard(id, world.player, world.stacks);
    const target = enemy(world, { x: 225, y: 500, speed: 0, hp: 10000, maxHp: 10000 });
    tick(world, 0.6);
    expect(target.hp).toBeLessThan(10000 - 39);
    expect(combatStats(world.player, world.stacks).damage).toBe(39);
    expect(combatStats(world.player, world.stacks).projectiles).toBe(3);
    expect(world.player.hp).toBe(160);
    const hostile = world.hostileShots.acquire();
    if (!hostile) throw new Error("No hostile fixture");
    Object.assign(hostile, { x: 225, y: 736, vx: 0, vy: 0, damage: 40, lifetime: 6 });
    world.update(CONFIG.fixedStep);
    expect(world.player.hp).toBe(160);
    expect(world.player.shield).toBe(20);
  });
});
