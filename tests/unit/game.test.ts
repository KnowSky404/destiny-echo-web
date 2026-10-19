import { describe, expect, test } from "bun:test";
import { applyCard, CARDS, drawCards } from "../../src/data/cards";
import { CONFIG } from "../../src/game/config";
import { Pool } from "../../src/game/pool";
import { seededRandom } from "../../src/game/random";
import { RunState } from "../../src/game/state";
import { damagePlayer } from "../../src/game/systems/damage";
import { movePlayer, segmentHitsCircle } from "../../src/game/systems/movement";
import { createPlayer, World } from "../../src/game/world";

function tick(world: World, seconds: number): void {
  for (let index = 0; index < Math.round(seconds * 120); index++) world.update(1 / 120);
}

function chestInFiringLane(world: World) {
  const chest = world.chests.acquire();
  if (!chest) throw new Error("Chest pool exhausted");
  Object.assign(chest, { id: 9999, x: 225, y: 400, hp: 12, maxHp: 12, radius: 26, age: 0 });
  return chest;
}

describe("movement and timing", () => {
  test("clamps all four configurable player boundaries", () => {
    const player = createPlayer();
    movePlayer(player, { x: -1, y: -1 }, 100);
    expect(player.x).toBe(CONFIG.movement.left);
    expect(player.y).toBe(CONFIG.movement.top);
    movePlayer(player, { x: 1, y: 1 }, 100);
    expect(player.x).toBe(CONFIG.movement.right);
    expect(player.y).toBe(CONFIG.movement.bottom);
  });

  test("diagonal movement has the same speed and drag never overshoots", () => {
    const player = createPlayer();
    const initial = { x: player.x, y: player.y };
    movePlayer(player, { x: 1, y: -1 }, 0.1);
    expect(Math.hypot(player.x - initial.x, player.y - initial.y)).toBeCloseTo(26, 8);
    movePlayer(player, { x: 0, y: 0, target: { x: 250, y: 700 } }, 1);
    expect(player.x).toBe(250);
    expect(player.y).toBe(700);
  });

  test("30, 60 and 144 Hz produce the same simulation, movement and shooting", () => {
    const worlds = [30, 60, 144].map((rate) => {
      const world = new World();
      world.start(7);
      for (let frame = 0; frame < rate / 2; frame++) world.update(1 / rate, { x: 1, y: 0 });
      return world.snapshot();
    });
    for (const world of worlds) {
      expect(world.player.x).toBeCloseTo(355, 6);
      expect(world.elapsed).toBeCloseTo(0.5, 6);
      expect(world.shots.length).toBe(2);
    }
  });

  test("paused, reward, menu and terminal states cannot advance time or move", () => {
    const world = new World();
    world.update(1, { x: 1, y: 0 });
    expect(world.elapsed).toBe(0);
    world.start(1);
    world.pause();
    const before = world.snapshot();
    tick(world, 1);
    expect(world.snapshot()).toEqual(before);
    world.resume();
    chestInFiringLane(world);
    tick(world, 1);
    expect(world.phase).toBe("RewardSelection");
    const rewardBefore = world.snapshot();
    world.update(0.1, { x: 1, y: 1 });
    expect(world.snapshot()).toEqual(rewardBefore);
    expect(world.resume()).toBe(false);
  });

  test("caps long frames and rejects invalid delta rather than fast-forwarding a hidden page", () => {
    const world = new World();
    world.start(1);
    world.update(30);
    expect(world.elapsed).toBeCloseTo(0.1, 6);
    world.update(Number.NaN);
    world.update(-1);
    world.update(Number.POSITIVE_INFINITY);
    expect(world.elapsed).toBeCloseTo(0.1, 6);
  });
});

describe("damage and collision", () => {
  test("damage consumes shield first, respects invulnerability and never goes below zero", () => {
    const player = createPlayer();
    player.shield = 10;
    expect(damagePlayer(player, 25)).toBe(15);
    expect(player.hp).toBe(85);
    expect(player.shield).toBe(0);
    expect(damagePlayer(player, 1000)).toBe(0);
    player.invulnerable = 0;
    expect(damagePlayer(player, 1000)).toBe(85);
    expect(player.hp).toBe(0);
    expect(damagePlayer(player, -10)).toBe(0);
  });

  test("swept collision catches fast projectiles between frames", () => {
    expect(segmentHitsCircle({ x: 20, y: 700 }, { x: 20, y: 400 }, { x: 20, y: 550 }, 5)).toBe(
      true,
    );
    expect(segmentHitsCircle({ x: 20, y: 700 }, { x: 20, y: 400 }, { x: 35, y: 550 }, 5)).toBe(
      false,
    );
    expect(segmentHitsCircle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 5)).toBe(true);
  });

  test("real enemy projectile collision hurts the player and can end the run", () => {
    const world = new World();
    world.start(1);
    world.player.hp = 12;
    const shot = world.hostileShots.acquire();
    if (!shot) throw new Error("No shot");
    Object.assign(shot, {
      id: 100,
      x: 225,
      y: 720,
      previousX: 225,
      previousY: 720,
      vx: 0,
      vy: 240,
      radius: 6,
      damage: 16,
    });
    tick(world, 0.1);
    expect(world.player.hp).toBe(0);
    expect(world.phase).toBe("GameOver");
    const elapsed = world.elapsed;
    tick(world, 1);
    expect(world.elapsed).toBe(elapsed);
  });

  test("a piercing projectile damages a target only once across overlapping frames", () => {
    const world = new World();
    world.start(1);
    world.player.stats.piercing = 3;
    const enemy = world.enemies.acquire();
    if (!enemy) throw new Error("No enemy");
    Object.assign(enemy, {
      id: 500,
      kind: "sentinel",
      x: 225,
      originX: 225,
      y: 680,
      hp: 100,
      maxHp: 100,
      radius: 30,
      speed: 0,
      age: 0,
      shotCooldown: 100,
      patternCooldown: 100,
    });
    tick(world, 0.2);
    expect(enemy.hp).toBe(88);
  });

  test("defeating a boss through normal shooting produces victory", () => {
    const world = new World();
    world.start(1);
    world.bossSpawned = true;
    const boss = world.enemies.acquire();
    if (!boss) throw new Error("No boss");
    Object.assign(boss, {
      id: 500,
      kind: "boss",
      x: 225,
      originX: 225,
      y: 110,
      hp: 12,
      maxHp: 12,
      radius: 48,
      speed: 0,
      age: 0,
      shotCooldown: 100,
      patternCooldown: 100,
      telegraph: 0,
    });
    tick(world, 5);
    expect(world.phase).toBe("Victory");
    expect(world.kills).toBe(1);
    const before = world.snapshot();
    tick(world, 1);
    expect(world.snapshot()).toEqual(before);
  });
});

describe("cards and one-time rewards", () => {
  test("all seven cards change actual player data and have full definitions", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(CARDS.length);
    for (const card of CARDS) {
      const player = createPlayer();
      const before = structuredClone(player);
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.description.length).toBeGreaterThan(0);
      expect(card.preview(player).length).toBeGreaterThan(0);
      expect(applyCard(card.id, player, new Map())).toBe(true);
      expect(player).not.toEqual(before);
    }
  });

  test("cards stack, capped effects stop applying, health gain heals within the new maximum", () => {
    const player = createPlayer();
    const stacks = new Map<string, number>();
    applyCard("overload", player, stacks);
    applyCard("overload", player, stacks);
    expect(player.stats.damage).toBe(20);
    expect(stacks.get("overload")).toBe(2);
    for (let i = 0; i < 20; i++)
      for (const id of ["haste", "multishot", "piercing", "drift"]) applyCard(id, player, stacks);
    expect(player.stats.interval).toBeGreaterThanOrEqual(0.13);
    expect(player.stats.projectiles).toBe(5);
    expect(player.stats.piercing).toBe(3);
    expect(player.stats.speed).toBe(380);
    expect(stacks.get("haste")).toBe(6);
    player.hp = 95;
    applyCard("vitality", player, stacks);
    expect(player.stats.maxHp).toBe(120);
    expect(player.hp).toBe(120);
    expect(applyCard("unknown", player, stacks)).toBe(false);
  });

  test("offers always contain three unique eligible cards, including after every bounded effect caps", () => {
    const player = createPlayer();
    const stacks = new Map<string, number>();
    for (let i = 0; i < 20; i++)
      for (const id of ["haste", "multishot", "piercing", "drift"]) applyCard(id, player, stacks);
    const cards = drawCards(player, stacks, seededRandom(8));
    expect(cards.length).toBe(3);
    expect(new Set(cards).size).toBe(3);
    expect(new Set(cards)).toEqual(new Set(["overload", "vitality", "ward"]));
  });

  test("destroying a chest pauses combat and can grant exactly one offered reward", () => {
    const world = new World();
    world.start(3);
    chestInFiringLane(world);
    tick(world, 1);
    expect(world.phase).toBe("RewardSelection");
    expect(world.openedChests).toBe(1);
    const reward = world.reward;
    if (!reward) throw new Error("Missing reward");
    const id = reward.choices[0];
    if (!id) throw new Error("Missing card");
    expect(new Set(reward.choices).size).toBe(3);
    expect(world.chooseCard("unknown", reward.token)).toBe(false);
    expect(world.chooseCard(id, reward.token + 1)).toBe(false);
    expect(world.chooseCard(id, reward.token)).toBe(true);
    expect(world.chooseCard(id, reward.token)).toBe(false);
    expect([...world.stacks.values()].reduce((a, b) => a + b, 0)).toBe(1);
    expect(world.phase).toBe("Playing");
    expect(world.reward).toBeNull();
  });

  test("card effects change actual firing damage, cooldown, count and penetration", () => {
    const world = new World();
    world.start(1);
    for (const id of ["overload", "haste", "multishot", "piercing"])
      applyCard(id, world.player, world.stacks);
    world.update(1 / 120);
    const shots = world.shots.items.filter((shot) => shot.active);
    expect(shots.length).toBe(2);
    expect(shots.every((shot) => shot.damage === 16 && shot.hitsLeft === 2)).toBe(true);
    expect(world.player.cooldown).toBeLessThan(0.28);
  });
});

describe("state and resource lifetime", () => {
  test("state observers run synchronously only for valid transitions and can unsubscribe", () => {
    const state = new RunState();
    const observed: string[] = [];
    const unsubscribe = state.subscribe((phase) => {
      observed.push(phase);
    });
    expect(state.transition("Victory")).toBe(false);
    expect(observed).toEqual([]);
    state.transition("Playing");
    expect(observed).toEqual(["Playing"]);
    state.transition("Paused");
    expect(observed).toEqual(["Playing", "Paused"]);
    unsubscribe();
    state.transition("Playing");
    expect(observed).toEqual(["Playing", "Paused"]);
  });

  test("only declared state transitions are allowed", () => {
    const state = new RunState();
    expect(state.transition("Victory")).toBe(false);
    for (const phase of [
      "Playing",
      "Paused",
      "Playing",
      "RewardSelection",
      "Playing",
      "Victory",
      "Playing",
      "GameOver",
      "Menu",
    ] as const)
      expect(state.transition(phase)).toBe(true);
    expect(state.phase).toBe("Menu");
    const world = new World();
    expect(world.resume()).toBe(false);
  });

  test("restart clears all run growth, entities, timers, pending rewards, damage and score", () => {
    const world = new World();
    world.start(4);
    chestInFiringLane(world);
    tick(world, 1);
    const reward = world.reward;
    if (!reward) throw new Error("No reward");
    world.chooseCard(reward.choices[0] ?? "", reward.token);
    world.player.hp = 40;
    world.player.invulnerable = 2;
    world.player.shield = 80;
    world.score = 1500;
    world.kills = 8;
    world.pause();
    expect(world.start(4)).toBe(true);
    expect(world.player).toEqual(createPlayer());
    expect(world.stacks.size).toBe(0);
    expect(world.elapsed).toBe(0);
    expect(world.score).toBe(0);
    expect(world.kills).toBe(0);
    expect(world.openedChests).toBe(0);
    expect(world.reward).toBeNull();
    expect(world.bossSpawned).toBe(false);
    expect(world.snapshot().shots.length).toBe(0);
    expect(world.snapshot().enemies.length).toBe(0);
    expect(world.snapshot().chests.length).toBe(0);
    expect(world.snapshot().hostileShots.length).toBe(0);
    expect(world.chooseCard(reward.choices[0] ?? "", reward.token)).toBe(false);
  });

  test("pools enforce capacity, reuse released objects and reset active entities", () => {
    const pool = new Pool(2, () => ({ active: false, value: 0 }));
    const first = pool.acquire();
    expect(first).toBeDefined();
    pool.acquire();
    expect(pool.acquire()).toBeUndefined();
    if (first) first.active = false;
    expect(pool.acquire()).toBe(first);
    expect(pool.items.length).toBe(2);
    pool.clear();
    expect(pool.items.every((item) => !item.active)).toBe(true);
  });

  test("same run seed reproduces spawns and card offers", () => {
    const run = () => {
      const world = new World();
      world.start(1234);
      tick(world, 8);
      return world.snapshot();
    };
    expect(run()).toEqual(run());
  });
});
