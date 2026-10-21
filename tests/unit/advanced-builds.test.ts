import { describe, expect, test } from "bun:test";
import { applyCard } from "../../src/data/cards";
import { CONFIG } from "../../src/game/config";
import type { Enemy } from "../../src/game/types";
import { World } from "../../src/game/world";
import { enemy, tick } from "./helpers";

function build(ids: string[]): World {
  const world = new World();
  world.start(123);
  world.bossSpawned = true;
  world.player.cooldown = 100;
  for (const id of ids) expect(applyCard(id, world.player, world.stacks)).toBe(true);
  return world;
}
function hit(world: World, target: Enemy, damage: number) {
  const shot = world.shots.acquire();
  if (!shot) throw new Error("No projectile");
  Object.assign(shot, {
    x: target.x,
    y: target.y,
    previousX: target.x,
    previousY: target.y,
    vx: 0,
    vy: 0,
    damage,
    lifetime: 1,
    hitsLeft: 1,
    primary: true,
    critical: false,
    targetId: target.id,
  });
  shot.hitIds.clear();
  world.update(CONFIG.fixedStep);
}
function target(world: World, overrides: Partial<Enemy> = {}) {
  return enemy(world, {
    x: 225,
    defenseX: 225,
    y: 300,
    hp: 1000,
    maxHp: 1000,
    speed: 0,
    ...overrides,
  });
}

describe("large transformations and combined deterministic combat", () => {
  test("crit, lifesteal, slowing, control and lightning remain identical at 30/60/144 Hz", () => {
    const runs = [30, 60, 144].map((rate) => {
      const world = build([
        "keen",
        "keen",
        "keen",
        "leech",
        "leech",
        "leech",
        "chill",
        "chill",
        "chill",
        "impact",
        "impact",
        "impact",
        "chain",
        "stormcall",
      ]);
      world.player.hp = 50;
      world.player.cooldown = 0;
      target(world, { id: 9000, y: 200, hp: 10000, maxHp: 10000, speed: 25 });
      target(world, {
        id: 9001,
        x: 320,
        defenseX: 320,
        y: 200,
        hp: 10000,
        maxHp: 10000,
        speed: 25,
      });
      for (let frame = 0; frame < rate * 12; frame++) world.update(1 / rate);
      return world.snapshot();
    });
    expect(runs[0]).toEqual(runs[1]);
    expect(runs[0]).toEqual(runs[2]);
    expect(runs[0]?.metrics.criticalHits).toBeGreaterThan(0);
    expect(runs[0]?.metrics.controlProcs).toBeGreaterThan(0);
    expect(runs[0]?.metrics.healingDone).toBeGreaterThan(0);
  });

  test("nine-layer bastion regenerates 20 shield and reflects half max HP globally", () => {
    const world = build([...Array<string>(9).fill("ward"), "thorns"]);
    world.player.shield = 0;
    const first = target(world);
    const second = target(world, { x: 57, defenseX: 57 });
    tick(world, 3);
    expect(world.player.shield).toBe(20);
    const shot = world.hostileShots.acquire();
    if (!shot) throw new Error("No hostile projectile");
    Object.assign(shot, {
      x: 225,
      y: 736,
      previousX: 225,
      previousY: 736,
      vx: 0,
      vy: 0,
      damage: 8,
      lifetime: 1,
    });
    world.update(CONFIG.fixedStep);
    expect(world.player.hp).toBe(100);
    expect(first.hp).toBe(914);
    expect(second.hp).toBe(950);
    tick(world, 30);
    expect(world.player.shield).toBe(100);
  });

  test("nine-layer might empowers the third real volley by 80%", () => {
    const world = build(Array<string>(9).fill("force"));
    target(world);
    for (let index = 0; index < 3; index++) {
      world.player.cooldown = 0;
      world.update(CONFIG.fixedStep);
    }
    const shots = world.shots.items.filter((shot) => shot.active);
    expect(shots.map((shot) => Number(shot.damage.toFixed(2)))).toEqual([68.4, 68.4, 123.12]);
  });

  test("nine-layer blood doubles regeneration and converts full overheal up to 80% max HP", () => {
    const world = build([...Array<string>(6).fill("leech"), ...Array<string>(3).fill("renewal")]);
    world.player.hp = 50;
    tick(world, 1);
    expect(world.player.hp).toBeCloseTo(57.2, 6);
    world.player.hp = 100;
    const victim = target(world, { hp: 10000, maxHp: 10000 });
    hit(world, victim, 100);
    expect(world.player.shield).toBeCloseTo(34.06, 5);
    for (let index = 0; index < 5; index++) hit(world, victim, 100);
    expect(world.player.shield).toBe(80);
  });

  test("nine-layer storm doubles distinct lightning damage and delivers a three-second storm", () => {
    const world = build([
      ...Array<string>(4).fill("chain"),
      ...Array<string>(4).fill("splash"),
      "stormcall",
    ]);
    const first = target(world);
    const second = target(world, { x: 300, defenseX: 300 });
    const third = target(world, { x: 400, defenseX: 400 });
    hit(world, first, 10);
    expect([first.hp, second.hp, third.hp]).toEqual([990, 988, 994]);
    tick(world, 3);
    expect([first.hp, second.hp, third.hp]).toEqual([954, 952, 994]);
  });

  test("nine-layer frost freezes on the third hit and amplifies damage against chilled targets", () => {
    const world = build([
      ...Array<string>(4).fill("chill"),
      ...Array<string>(4).fill("frostbite"),
      "icefield",
    ]);
    const victim = target(world);
    for (let index = 0; index < 3; index++) hit(world, victim, 10);
    expect(victim.hp).toBeCloseTo(954.4, 6);
    expect(victim.stunTime).toBeCloseTo(1 - CONFIG.fixedStep, 6);
    expect(world.controlProcs).toBe(1);
  });

  test("nine-layer control amplifies interrupt contribution and rewards a stunned kill", () => {
    const world = build([
      ...Array<string>(4).fill("impact"),
      ...Array<string>(4).fill("suppression"),
      "edict",
    ]);
    const boss = target(world, {
      kind: "boss",
      stage: "Attacking",
      arrived: true,
      telegraph: 2,
      interruptRequired: 90,
    });
    for (let index = 0; index < 4; index++) hit(world, boss, 10);
    expect(boss.hp).toBeCloseTo(932.8, 6);
    expect(world.bossInterrupts).toBe(1);
    expect(boss.stunTime).toBeCloseTo(0.24 - CONFIG.fixedStep, 6);
    const stunned = target(world, { x: 57, defenseX: 57, hp: 1, stunTime: 0.5 });
    hit(world, stunned, 1);
    expect(stunned.active).toBe(false);
    expect(world.player.shield).toBe(8);
  });
});
