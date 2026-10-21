import { describe, expect, test } from "bun:test";
import { CONFIG } from "../../src/game/config";
import { synergyCount } from "../../src/game/synergies";

import { naturalRun as run } from "./helpers";

describe("natural unmodified multi-stage runs", () => {
  test("a growing build clears four bosses under observable defense pressure", () => {
    const world = run(8);
    expect(world.phase).toBe("Victory");
    expect(world.clearedStages).toBe(4);
    expect(world.stageIndex).toBe(3);
    expect(world.elapsed).toBeGreaterThan(200);
    expect(world.elapsed).toBeLessThan(364);
    expect(world.regularAttacks).toBeGreaterThan(0);
    expect(world.arrivals).toBeGreaterThan(1);
    expect(world.bossInterrupts + world.bossSpecials).toBeGreaterThan(0);
    expect(world.openedChests).toBeGreaterThanOrEqual(15);
    expect([...world.stacks.values()].reduce((a, b) => a + b, 0)).toBe(world.openedChests + 3);
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
  }, 15_000);

  test("target decisions change an outcome; incomplete growth can still fail", () => {
    expect(run(10, "auto").phase).toBe("GameOver");
    expect(run(10, "active").phase).toBe("Victory");
    const poorBuild = run(3, "defensive");
    expect(poorBuild.phase).toBe("GameOver");
    expect(poorBuild.regularAttacks).toBeGreaterThan(0);
  });

  test("a complete explosion build continues through two real endless bosses", () => {
    const world = run(10, "families", true);
    expect(world.clearedStages).toBeGreaterThanOrEqual(6);
    expect(world.endless).toBe(true);
    expect(world.stageIndex).toBeGreaterThanOrEqual(5);
    expect(synergyCount(world.stacks, "blast")).toBeGreaterThanOrEqual(9);
    expect(world.explosionCount).toBeGreaterThan(100);
    expect(world.chainKills).toBeGreaterThan(0);
    expect(world.echoVolleys).toBeGreaterThan(0);
  });
});
