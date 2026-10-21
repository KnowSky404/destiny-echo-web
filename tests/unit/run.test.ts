import { describe, expect, test } from "bun:test";
import { SYNERGIES } from "../../src/data/synergies";
import { CONFIG } from "../../src/game/config";
import { synergyCount } from "../../src/game/synergies";

import { naturalRun as run } from "./helpers";

describe("natural unmodified multi-stage runs", () => {
  test("a growing build clears four bosses under observable defense pressure", () => {
    // The restricted first-stage pool changes the seeded reward sequence.
    const world = run(3);
    expect(world.phase).toBe("Victory");
    expect(world.clearedStages).toBe(4);
    expect(world.stageIndex).toBe(3);
    expect(world.elapsed).toBeGreaterThan(200);
    expect(world.elapsed).toBeLessThan(364);
    expect(world.regularAttacks).toBeGreaterThan(0);
    expect(world.arrivals).toBeGreaterThan(1);
    expect(world.damageTaken).toBeGreaterThan(0);
    expect(world.openedChests).toBeGreaterThanOrEqual(15);
    expect([...world.stacks.values()].reduce((a, b) => a + b, 0)).toBe(world.openedChests + 4);
    expect(world.kills).toBeGreaterThan(100);
  });

  test("20 seeds resolve with actual threats, rewards and bounded pools", () => {
    const worlds = Array.from({ length: 20 }, (_, index) => run(index + 1));
    expect(worlds.some((world) => world.phase === "Victory")).toBe(true);
    expect(worlds.some((world) => world.phase === "GameOver")).toBe(true);
    for (const world of worlds) {
      expect(["Victory", "GameOver"]).toContain(world.phase);
      expect(world.openedChests).toBeGreaterThan(0);
      expect(world.shots.items.length).toBeLessThanOrEqual(CONFIG.limits.playerShots);
      expect(world.hostileShots.items.length).toBeLessThanOrEqual(CONFIG.limits.enemyShots);
      expect(world.enemies.items.length).toBeLessThanOrEqual(CONFIG.limits.enemies);
      expect(world.blasts.items.length).toBeLessThanOrEqual(CONFIG.limits.blasts);
      expect({ x: world.player.x, y: world.player.y }).toEqual(CONFIG.player);
    }
  }, 30_000);

  test("target decisions change an outcome; incomplete growth can still fail", () => {
    expect(run(3, "auto").phase).toBe("GameOver");
    expect(run(3, "active").phase).toBe("Victory");
    const poorBuild = run(3, "defensive");
    expect(poorBuild.phase).toBe("GameOver");
    expect(poorBuild.regularAttacks).toBeGreaterThan(0);
  });

  test("a winning campaign build enters harder endless combat with real minion and boss pressure", () => {
    const world = run(3, "active", true);
    expect(world.clearedStages).toBe(4);
    expect(world.endless).toBe(true);
    expect(world.stageIndex).toBe(4);
    expect(world.phase).toBe("GameOver");
    expect(world.stageKindSpawns.tank).toBeGreaterThan(0);
    expect(world.stageKindSpawns.wizard).toBeGreaterThan(0);
    expect(SYNERGIES.some((family) => synergyCount(world.stacks, family.id) >= 9)).toBe(true);
    expect(world.explosionCount).toBeGreaterThan(100);
    expect(world.chainKills).toBeGreaterThan(0);
    expect(world.echoVolleys).toBeGreaterThan(0);
  }, 30_000);

  test("a natural campaign build can continue through two endless stages", () => {
    const world = run(5, "active", true);
    expect(world.clearedStages).toBe(6);
    expect(world.stageIndex).toBe(6);
    expect(world.phase).toBe("Playing");
    expect(world.peakEnemies).toBeLessThanOrEqual(25);
    expect(world.damageTaken).toBeGreaterThan(0);
    expect(world.stacks.size + world.trainingStacks.size).toBeGreaterThan(0);
  }, 30_000);
});
