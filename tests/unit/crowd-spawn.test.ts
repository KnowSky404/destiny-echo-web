import { describe, expect, test } from "bun:test";
import { CONFIG } from "../../src/game/config";
import { seededRandom } from "../../src/game/random";
import { advanceFormation, crowdSpawn } from "../../src/game/systems/crowd";
import type { Enemy } from "../../src/game/types";
import { World } from "../../src/game/world";
import { enemy } from "./helpers";

function minion(world: World, x: number, y: number, overrides: Partial<Enemy> = {}) {
  return enemy(world, { x, y, defenseX: x, formation: true, speed: 0, ...overrides });
}

describe("endless spawning into vacant formation gaps", () => {
  test.each([450, 1600])(
    "later spawns still sample several rows below existing upper units: %s",
    (width) => {
      const world = new World(width);
      for (const x of world.arena.crowdLanes) minion(world, x, 200);
      const positions = Array.from({ length: 100 }, (_, seed) =>
        crowdSpawn(world.enemies.items, seededRandom(seed), world.arena.crowdLanes),
      );
      expect(positions.every((position) => position !== undefined)).toBe(true);
      const heights = new Set(positions.map((position) => position?.y));
      expect(heights).toEqual(new Set([32, 116, 284, 368]));
      expect(positions.some((position) => position && position.y > 200)).toBe(true);
      expect(positions.every((position) => position && position.y <= 400)).toBe(true);
    },
  );

  test("a unit at the top does not prevent a later spawn in an open lower gap", () => {
    const world = new World();
    const x = world.arena.crowdLanes[0];
    if (x === undefined) throw new Error("Missing lane");
    minion(world, x, 32);
    expect(crowdSpawn(world.enemies.items, () => 0, [x])).toEqual({ x, y: 368 });
  });

  test("every vacant position has equal probability even when lanes have different space", () => {
    const world = new World();
    const lanes = world.arena.crowdLanes.slice(0, 2);
    const x = lanes[0];
    if (x === undefined) throw new Error("Missing lane");
    for (const y of [32, 116, 200, 284]) minion(world, x, y);
    const positions = Array.from({ length: 6 }, (_, index) =>
      crowdSpawn(world.enemies.items, () => (index + 0.5) / 6, lanes),
    );
    expect(new Set(positions.map((position) => `${position?.x}:${position?.y}`)).size).toBe(6);
    expect(positions.filter((position) => position?.x === lanes[0])).toHaveLength(1);
    expect(positions.filter((position) => position?.x === lanes[1])).toHaveLength(5);
  });

  test("bosses and inactive units do not reserve minion spawn positions", () => {
    const world = new World();
    const x = world.arena.crowdLanes[0];
    if (x === undefined) throw new Error("Missing lane");
    minion(world, x, 200, { kind: "boss" });
    minion(world, x, 368, { active: false });
    const heights = Array.from(
      { length: 5 },
      (_, index) => crowdSpawn(world.enemies.items, () => (index + 0.5) / 5, [x])?.y,
    );
    expect(new Set(heights)).toEqual(new Set([32, 116, 200, 284, 368]));
  });

  test("attack regions strictly constrain spawn centers and include the fixed bottom area", () => {
    const world = new World();
    const x = world.arena.crowdLanes[0];
    if (x === undefined) throw new Error("Missing lane");
    expect(
      crowdSpawn(
        world.enemies.items,
        seededRandom(1),
        [x],
        [{ id: 0, x: 0, y: 600, width: world.arena.width, height: 100 }],
      ),
    ).toEqual({ x, y: 620 });
    const region = { id: 1, x, y: 536, width: 1, height: 84 };
    expect(crowdSpawn(world.enemies.items, seededRandom(2), [x], [region])).toEqual({ x, y: 536 });
    expect(crowdSpawn(world.enemies.items, seededRandom(3), [x], [])).toBeUndefined();
    expect(
      crowdSpawn(world.enemies.items, seededRandom(4), [x], [{ ...region, x: x + 1 }]),
    ).toBeUndefined();
  });

  test("a blocked attack area waits for a vacancy without falling back outside it", () => {
    const world = new World();
    for (const x of world.arena.crowdLanes) {
      minion(world, x, 620);
      minion(world, x, 536);
    }
    expect(
      crowdSpawn(
        world.enemies.items,
        seededRandom(5),
        world.arena.crowdLanes,
        world.arena.baseAttackRegions,
      ),
    ).toBeUndefined();
    const casualty = world.enemies.items[0];
    if (!casualty) throw new Error("Missing minion");
    casualty.active = false;
    expect(
      crowdSpawn(
        world.enemies.items,
        seededRandom(5),
        world.arena.crowdLanes,
        world.arena.baseAttackRegions,
      ),
    ).toEqual({ x: casualty.x, y: 620 });
  });

  test("spawning cannot exceed six minions in a lane or push an existing unit upward", () => {
    const full = new World();
    const x = full.arena.crowdLanes[0];
    if (x === undefined) throw new Error("Missing lane");
    for (const y of [200, 284, 368, 452, 536, 620]) minion(full, x, y);
    expect(crowdSpawn(full.enemies.items, seededRandom(6), [x])).toBeUndefined();
    const compressed = new World();
    minion(compressed, x, 620);
    minion(compressed, x, 550);
    expect(crowdSpawn(compressed.enemies.items, seededRandom(7), [x])).toBeUndefined();
  });

  test.each([450, 1600])(
    "random admissions preserve full capacity, spacing and forward-only formation: %s",
    (width) => {
      const world = new World(width);
      const random = seededRandom(8);
      for (let index = 0; index < world.arena.minionCapacity; index++) {
        const position = crowdSpawn(
          world.enemies.items,
          random,
          world.arena.crowdLanes,
          world.arena.attackRegions,
        );
        if (!position) throw new Error(`No vacancy for minion ${index}`);
        minion(world, position.x, position.y, { speed: 72 + (index % 3) * 20 });
        const previous = world.enemies.items.map((item) => item.y);
        advanceFormation(
          world.enemies.items,
          0,
          1,
          (_item, delta) => delta,
          world.arena.crowdLanes,
        );
        expect(world.enemies.items.map((item) => item.y)).toEqual(previous);
      }
      expect(
        crowdSpawn(world.enemies.items, random, world.arena.crowdLanes, world.arena.attackRegions),
      ).toBeUndefined();
      for (let frame = 0; frame < 120; frame++) {
        const previous = world.enemies.items.map((item) => item.y);
        advanceFormation(
          world.enemies.items,
          CONFIG.fixedStep,
          1,
          (_item, delta) => delta,
          world.arena.crowdLanes,
        );
        for (const [index, item] of world.enemies.items.entries())
          expect(item.y).toBeGreaterThanOrEqual(previous[index] ?? 0);
        for (const x of world.arena.crowdLanes) {
          const lane = world.enemies.items.filter((item) => item.defenseX === x);
          expect(lane).toHaveLength(6);
          for (const [index, item] of lane.entries())
            for (const other of lane.slice(index + 1))
              expect(Math.abs(item.y - other.y)).toBeGreaterThanOrEqual(
                CONFIG.crowd.cellHeight - 1e-9,
              );
        }
      }
    },
  );
});
