import { describe, expect, test } from "bun:test";
import { runNatural } from "../../src/balance-sim/runner";
import { resolveStrategy } from "../../src/balance-sim/strategies";
import { SYNERGIES } from "../../src/data/synergies";
import { CONFIG } from "../../src/game/config";
import { synergyCount } from "../../src/game/synergies";

import { naturalRun as run } from "./helpers";

describe("natural unmodified multi-stage runs", () => {
  test("a growing build clears four bosses under observable defense pressure", () => {
    // The restricted first-stage pool changes the seeded reward sequence.
    const world = run(4);
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
  }, 60_000);

  test("20 seeds resolve with actual threats, rewards and bounded pools", () => {
    const worlds = Array.from({ length: 20 }, (_, index) => run(index + 1));
    expect(worlds.some((world) => world.phase === "Victory")).toBe(true);
    for (const world of worlds) {
      expect(["Victory", "GameOver"]).toContain(world.phase);
      expect(world.openedChests).toBeGreaterThan(0);
      expect(world.shots.items.length).toBeLessThanOrEqual(CONFIG.limits.playerShots);
      expect(world.hostileShots.items.length).toBeLessThanOrEqual(CONFIG.limits.enemyShots);
      expect(world.enemies.items.length).toBeLessThanOrEqual(CONFIG.limits.enemies);
      expect(world.blasts.items.length).toBeLessThanOrEqual(CONFIG.limits.blasts);
      expect({ x: world.player.x, y: world.player.y }).toEqual(CONFIG.player);
    }
  }, 180_000);

  test("target decisions change a natural outcome under the same reward policy", () => {
    const simulate = (name: "build-auto" | "build-active") =>
      runNatural({
        seed: 3176762491,
        width: CONFIG.width,
        strategy: { name },
        mode: "campaign",
        maxSteps: 78_000,
        maxSeconds: 650,
        endlessTarget: 2,
      });
    expect(resolveStrategy({ name: "build-auto" }).reward).toEqual(
      resolveStrategy({ name: "build-active" }).reward,
    );
    const automatic = simulate("build-auto");
    const active = simulate("build-active");
    expect(automatic.termination).toBe("death");
    expect(active.termination).toBe("campaign_victory");
    expect(automatic.stages.some((stage) => stage.enemyAttacks > 0)).toBe(true);
    expect(active.coverage.targetDecisions).toBeGreaterThan(0);
  }, 60_000);

  test("a winning campaign build enters harder endless combat with real minion and boss pressure", () => {
    const world = run(4, "active", true);
    expect(world.clearedStages).toBeGreaterThanOrEqual(5);
    expect(world.endless).toBe(true);
    expect(world.stageIndex).toBeGreaterThanOrEqual(5);
    // The natural-run helper stops after two endless clears even if still alive.
    // Lifetime skill counts retain pressure evidence after per-stage spawn counts reset.
    expect(["Playing", "GameOver"]).toContain(world.phase);
    expect(world.tauntCasts).toBeGreaterThan(0);
    expect(world.bossSpecials).toBeGreaterThan(0);
    expect(SYNERGIES.some((family) => synergyCount(world.stacks, family.id) >= 9)).toBe(true);
    expect(world.poisonCasts).toBeGreaterThan(0);
    expect(world.damageTaken).toBeGreaterThan(100);
    expect(world.echoVolleys).toBeGreaterThan(0);
  }, 60_000);

  test("a natural campaign build can continue through two endless stages", () => {
    const world = run(4, "active", true, 1600);
    expect(world.clearedStages).toBe(6);
    expect(world.stageIndex).toBe(6);
    expect(world.phase).toBe("Playing");
    expect(world.peakEnemies).toBeLessThanOrEqual(world.arena.encounterCapacity);
    expect(world.damageTaken).toBeGreaterThan(0);
    expect(world.stacks.size + world.trainingStacks.size).toBeGreaterThan(0);
  }, 60_000);
});
