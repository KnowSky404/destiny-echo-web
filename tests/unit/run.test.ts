import { describe, expect, test } from "bun:test";
import { runNatural } from "../../src/balance-sim/runner";
import { resolveStrategy } from "../../src/balance-sim/strategies";
import { SYNERGIES } from "../../src/data/synergies";
import { CONFIG } from "../../src/game/config";
import { synergyCount } from "../../src/game/synergies";

import { naturalRun as run } from "./helpers";

describe("natural unmodified multi-stage runs", () => {
  test("a growing build clears four bosses under observable defense pressure", () => {
    // A real legacy-policy control in the calibrated 8–12 minute campaign band.
    const world = run(5);
    expect(world.phase).toBe("Victory");
    expect(world.clearedStages).toBe(4);
    expect(world.stageIndex).toBe(3);
    expect(world.elapsed).toBeGreaterThanOrEqual(480);
    expect(world.elapsed).toBeLessThanOrEqual(720);
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

  test("target decisions change a natural trajectory under the same reward policy", () => {
    const simulate = (name: "build-auto" | "build-active") =>
      runNatural({
        seed: 2516358403,
        width: CONFIG.width,
        strategy: { name },
        mode: "campaign",
        maxSteps: 108_000,
        maxSeconds: 900,
        endlessTarget: 2,
      });
    expect(resolveStrategy({ name: "build-auto" }).reward).toEqual(
      resolveStrategy({ name: "build-active" }).reward,
    );
    const automatic = simulate("build-auto");
    const active = simulate("build-active");
    // Active targeting is a different deterministic trajectory, not a promise
    // of a particular win/death split against the same reward policy.
    expect(automatic.termination).toBe("campaign_victory");
    for (const result of [automatic, active]) {
      expect(["campaign_victory", "death"]).toContain(result.termination);
      expect(result.validMetrics).toBe(true);
      expect(result.invalidValues).toEqual([]);
    }
    expect(automatic.strategy.reward).toEqual(active.strategy.reward);
    expect(automatic.strategy.seed).toBe(active.strategy.seed);
    expect({
      final: automatic.final,
      playerSeconds: automatic.playerSeconds,
      metrics: automatic.metrics,
    }).not.toEqual({
      final: active.final,
      playerSeconds: active.playerSeconds,
      metrics: active.metrics,
    });
    expect(automatic.stages.some((stage) => stage.enemyAttacks > 0)).toBe(true);
    expect(automatic.coverage.targetDecisions).toBe(0);
    expect(active.coverage.targetDecisions).toBeGreaterThan(0);
  }, 60_000);

  test("a winning campaign build enters harder endless combat with real minion and boss pressure", () => {
    const world = run(5, "active", true);
    expect(world.clearedStages).toBeGreaterThanOrEqual(5);
    expect(world.endless).toBe(true);
    expect(world.stageIndex).toBeGreaterThanOrEqual(5);
    // The natural-run helper stops after two endless clears even if still alive.
    // Lifetime skill counts retain pressure evidence after per-stage spawn counts reset.
    expect(["Playing", "GameOver"]).toContain(world.phase);
    expect(world.tauntCasts).toBeGreaterThan(0);
    // This control cancels every cast through normal targeting. Successful
    // interruption is the observed boss interaction, rather than a forced hit.
    expect(world.bossInterrupts).toBeGreaterThan(0);
    expect(SYNERGIES.some((family) => synergyCount(world.stacks, family.id) >= 9)).toBe(true);
    expect(world.poisonCasts).toBeGreaterThan(0);
    expect(world.damageTaken).toBeGreaterThan(100);
    expect(world.echoVolleys).toBeGreaterThan(0);
  }, 60_000);

  test("a formal build-auto campaign naturally carries its build through two desktop endless stages", () => {
    // The legacy policy is retained above. This separate formal-policy control
    // starts from a fresh character and crosses every campaign/reward boundary.
    const result = runNatural({
      seed: 3600668854,
      width: 1600,
      mode: "endless",
      strategy: { name: "build-auto" },
      maxSeconds: 900,
      maxSteps: 108_000,
      endlessTarget: 2,
    });
    expect(result.termination).toBe("endless_target_reached");
    expect(result.validMetrics).toBe(true);
    expect(result.invalidValues).toEqual([]);
    expect(result.clearedStages).toBe(6);
    expect(result.endlessCleared).toBe(2);
    expect(result.stages.filter((stage) => stage.cleared).map((stage) => stage.stageIndex)).toEqual(
      [0, 1, 2, 3, 4, 5],
    );
    const finale = result.stages.find((stage) => stage.stageIndex === 3);
    const first = result.stages.find((stage) => stage.stageIndex === 4);
    const second = result.stages.find((stage) => stage.stageIndex === 5);
    expect(first?.entry.cards).toEqual(finale?.postReward?.cards);
    expect(first?.entry.trainings).toEqual(finale?.postReward?.trainings);
    expect(second?.entry.cards).toEqual(first?.postReward?.cards);
    expect(second?.entry.trainings).toEqual(first?.postReward?.trainings);
    for (const stage of [first, second]) {
      expect(stage).toBeDefined();
      expect(stage?.enemyAttacks).toBeGreaterThan(0);
      expect(stage?.evolution.spawnedByRole.elite).toBe(1);
      expect(stage?.evolution.spawnedByRole.boss).toBe(1);
      expect(stage?.peakEnemies).toBeLessThanOrEqual(result.layout.capacity);
    }
    expect(result.metrics.hpLoss + result.metrics.shieldAbsorbed).toBeGreaterThan(0);
    expect(result.stages.at(-1)?.stageIndex).toBe(6);
    expect(result.stages.at(-1)?.playerSeconds).toBe(0);
    expect(
      Object.keys(result.final.cards).length + Object.keys(result.final.trainings).length,
    ).toBeGreaterThan(0);
  }, 60_000);
});
