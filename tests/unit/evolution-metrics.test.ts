import { describe, expect, spyOn, test } from "bun:test";
import { EvolutionMetricsCollector } from "../../src/balance-sim/evolution-metrics";
import { runNatural } from "../../src/balance-sim/runner";
import { createStrategy, resolveStrategy } from "../../src/balance-sim/strategies";
import { defaultProfile } from "../../src/data/balance/profile";
import type { WorldObservation } from "../../src/game/observation";
import { World } from "../../src/game/world";
import { enemy } from "./helpers";

const event = (details: Partial<WorldObservation>): WorldObservation => ({
  type: "mechanic",
  stageIndex: 4,
  elapsed: 0,
  stageElapsed: 0,
  hp: 100,
  maxHp: 100,
  shield: 0,
  ...details,
});

describe("bounded encounter observations", () => {
  test("ordinary, elite and boss lifetimes are paired with exact death counts and bounded histograms", () => {
    const collector = new EvolutionMetricsCollector();
    for (const [entityId, role, duration] of [
      [1, "minion", 0.2],
      [2, "elite", 5.2],
      [3, "boss", 21],
    ] as const) {
      collector.observe(
        event({ type: "enemy_spawn", entityId, role, stars: role === "minion" ? 3 : 1 }),
      );
      collector.observe(
        event({ type: "enemy_death", entityId, role, elapsed: duration, trainingCredit: 900 }),
      );
      const metric = collector.stage(4).ttk[role];
      expect(metric.count).toBe(1);
      expect(metric.sum).toBe(duration);
      expect(metric.min).toBe(duration);
      expect(metric.max).toBe(duration);
      expect(metric.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
      expect(collector.total.deathCreditByRole[role]).toBe(900);
    }
    expect(collector.total.spawnedByStars).toEqual({ "1": 2, "3": 1 });
    expect(collector.total.missingLifecycleEvents).toBe(0);
    collector.observe(event({ type: "training_score", source: "kill:minion", amount: 120 }));
    collector.observe(event({ type: "training_score", source: "kill:elite", amount: 60 }));
    expect(collector.total.trainingScore).toBe(180);
    expect(collector.total.trainingScoreBySource).toEqual({ "kill:minion": 120, "kill:elite": 60 });
  });

  test("fusion removals are pruned without recording donor deaths or poison kills", () => {
    const collector = new EvolutionMetricsCollector();
    for (let id = 1; id <= 3; id++) collector.observe(event({ type: "enemy_spawn", entityId: id }));
    collector.step(4, 1 / 120, new Set([1]), false);
    collector.observe(
      event({ type: "enemy_death", entityId: 1, elapsed: 8, stars: 2, trainingCredit: 300 }),
    );
    expect(collector.total.deathsByRole.minion).toBe(1);
    expect(collector.total.ttk.minion.sum).toBe(8);
    collector.observe(event({ type: "enemy_spawn", entityId: 2 }));
    expect(collector.total.missingLifecycleEvents).toBe(0);
  });

  test("each released cast needs its own complete warning; interrupts and death cancel a pending cast", () => {
    const collector = new EvolutionMetricsCollector();
    const cast = { entityId: 1, role: "elite" as const };
    collector.observe(event({ ...cast, source: "cast_start", castId: 1, duration: 2.4 }));
    collector.observe(event({ ...cast, source: "cast_release", castId: 1, elapsed: 2.4 }));
    collector.observe(
      event({ ...cast, source: "cast_start", castId: 2, elapsed: 3, duration: 2.4 }),
    );
    collector.observe(event({ ...cast, source: "cast_interrupt", castId: 2, elapsed: 4 }));
    expect(collector.total.castStarts).toBe(2);
    expect(collector.total.castReleases).toBe(1);
    expect(collector.total.castInterrupts).toBe(1);
    expect(collector.total.unwarnedReleases).toBe(0);
    expect(collector.total.prematureReleases).toBe(0);
    collector.observe(event({ ...cast, source: "cast_release", castId: 2, elapsed: 5 }));
    collector.observe(
      event({ ...cast, source: "cast_start", castId: 3, elapsed: 6, duration: 2.4 }),
    );
    collector.observe(event({ ...cast, source: "cast_release", castId: 3, elapsed: 7 }));
    expect(collector.total.unwarnedReleases).toBe(1);
    expect(collector.total.prematureReleases).toBe(1);
  });

  test("one-second incoming damage windows combine simultaneous hits, expire old hits and exclude self costs", () => {
    const collector = new EvolutionMetricsCollector();
    collector.observe(event({ type: "player_damage", elapsed: 1, hpLoss: 10, shieldAbsorbed: 20 }));
    collector.observe(event({ type: "player_damage", elapsed: 1.5, hpLoss: 20 }));
    collector.observe(event({ type: "player_damage", elapsed: 1.5, hpLoss: 10 }));
    collector.observe(event({ type: "player_damage", elapsed: 2, hpLoss: 80 }));
    collector.observe(
      event({ type: "player_damage", source: "bloodpact", elapsed: 2, hpLoss: 10000 }),
    );
    expect(collector.total.maxOneSecondHpLoss).toBe(110);
    expect(collector.total.maxOneSecondDamage).toBe(110);
    expect(collector.total.maxOneSecondHpLossRatio).toBe(1.1);
    for (let index = 0; index < 500; index++)
      collector.observe(event({ type: "player_damage", elapsed: 3, hpLoss: 0.1 }));
    expect(collector.total.maxOneSecondHpLoss).toBe(110);
  });

  test("no-target combat time and frozen death presentation are separate measurements", () => {
    const collector = new EvolutionMetricsCollector();
    collector.step(4, 0.5, new Set(), true);
    collector.step(4, 1, new Set([1]), false);
    collector.step(4, 0.25, new Set(), true);
    collector.presentationStep(4, 0.8);
    expect(collector.total.idleSeconds).toBe(0.75);
    expect(collector.total.longestIdleSeconds).toBe(0.5);
    expect(collector.total.presentationSeconds).toBe(0.8);
  });
});

describe("simulation integration", () => {
  test("a dropped death event cannot masquerade as an uncounted fusion removal", () => {
    const profile = defaultProfile();
    profile.payload.player.stats.damage = 100000;
    profile.payload.stageRules = [
      {
        from: 1,
        to: null,
        stage: { enemyCount: 0, supportCount: 0, bossAt: 0, bossHp: 1 },
        kindWeights: null,
        rewards: {},
      },
    ];
    const original = EvolutionMetricsCollector.prototype.observe;
    const dropped = spyOn(EvolutionMetricsCollector.prototype, "observe").mockImplementation(
      function (this: EvolutionMetricsCollector, observation: WorldObservation) {
        if (observation.type !== "enemy_death") original.call(this, observation);
      },
    );
    try {
      const result = runNatural(
        {
          seed: 4,
          width: 450,
          mode: "campaign",
          strategy: { name: "build-auto" },
          maxSteps: 3600,
          maxSeconds: 30,
          endlessTarget: 2,
        },
        profile,
      );
      expect(result.clearedStages).toBe(4);
      expect(result.termination).toBe("error");
      expect(result.reason).toContain("World kills=4, observed deaths=0");
      expect(result.evolution.missingLifecycleEvents).toBe(4);
      expect(
        result.events.some(
          (event) =>
            event.type === "runner_error" && event.detail?.includes("death observation mismatch"),
        ),
      ).toBe(true);
    } finally {
      dropped.mockRestore();
    }
  });
  test("an endless target waits for the final death presentation and natural stage reward", () => {
    const profile = defaultProfile();
    profile.payload.player.stats.damage = 100000;
    profile.payload.stageRules = [
      {
        from: 1,
        to: null,
        stage: { enemyCount: 0, supportCount: 0, bossAt: 0, bossHp: 1 },
        kindWeights: null,
        rewards: {},
      },
    ];
    const result = runNatural(
      {
        seed: 4,
        width: 450,
        mode: "endless",
        strategy: { name: "build-auto" },
        maxSteps: 10800,
        maxSeconds: 90,
        endlessTarget: 1,
      },
      profile,
    );
    expect(result.termination).toBe("endless_target_reached");
    expect(result.phase).toBe("Playing");
    expect(result.rewards.filter((reward) => reward.source === "stage")).toHaveLength(5);
    expect(result.rewards.at(-1)?.source).toBe("stage");
    const endless = result.stages.find((stage) => stage.stageIndex === 4);
    expect(endless?.postReward).not.toBeNull();
    expect(endless?.postReward?.trainings).toEqual(result.final.trainings);
    expect(result.stages.at(-1)?.stageIndex).toBe(5);
    expect(result.evolution.presentationSeconds).toBeGreaterThan(3.9);
  });
  test("the active strategy notices an imminent remote elite cast before ordinary preparation", () => {
    const world = new World();
    world.start(7);
    world.stageIndex = 4;
    enemy(world, { kind: "boss", y: 250, preparation: 1, telegraph: 0 });
    const elite = enemy(world, { kind: "wizard", role: "elite", y: 250, telegraph: 1.4 });
    const strategy = createStrategy(resolveStrategy({ name: "build-active" }));
    expect(strategy.target(world)).toBe(true);
    expect(world.targetId).toBe(elite.id);
  });

  test("death presentation freezes clocks without causing a runner error or hiding its step budget", () => {
    const profile = defaultProfile();
    profile.payload.player.stats.damage = 100000;
    profile.payload.stageRules = [
      {
        from: 1,
        to: null,
        stage: { enemyCount: 0, supportCount: 0, bossAt: 0, bossHp: 1 },
        kindWeights: null,
        rewards: {},
      },
    ];
    const result = runNatural(
      {
        seed: 4,
        width: 450,
        mode: "campaign",
        strategy: { name: "build-auto" },
        maxSteps: 3600,
        maxSeconds: 30,
        endlessTarget: 2,
      },
      profile,
    );
    expect(result.termination).toBe("campaign_victory");
    expect(result.evolution.presentationSeconds).toBeGreaterThan(3);
    expect(result.playerSeconds + result.evolution.presentationSeconds).toBeCloseTo(
      result.steps * result.fixedStep,
      7,
    );
    expect(result.evolution.missingLifecycleEvents).toBe(0);
    expect(result.evolution.ttk.boss.count).toBe(4);
  });
});
