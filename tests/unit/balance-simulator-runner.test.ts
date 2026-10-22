import { describe, expect, spyOn, test } from "bun:test";
import { contentHash } from "../../src/balance-sim/encoding";
import { parseReviewDocument } from "../../src/balance-sim/review";
import { runNatural, validateRunConfig } from "../../src/balance-sim/runner";
import { createStrategy, resolveStrategy } from "../../src/balance-sim/strategies";
import type { RunConfig, StrategyConfig } from "../../src/balance-sim/types";
import { defaultProfile, officialProfile, parseProfile } from "../../src/data/balance/profile";
import { CARDS } from "../../src/data/cards";
import { SYNERGIES } from "../../src/data/synergies";
import { TRAININGS } from "../../src/data/training";
import { CONFIG } from "../../src/game/config";
import { World } from "../../src/game/world";

const base: RunConfig = {
  seed: 4,
  width: CONFIG.width,
  mode: "campaign",
  strategy: { name: "build-auto" },
  maxSteps: 3600,
  maxSeconds: 30,
  endlessTarget: 2,
};

/** Deliberately trivial candidate profile used to exercise native transitions quickly. */
function quickProfile() {
  const profile = defaultProfile();
  profile.payload.player.stats.damage = 100_000;
  profile.payload.stageRules = [
    {
      from: 1,
      to: null,
      stage: { enemyCount: 0, supportCount: 0, bossAt: 0, bossHp: 1 },
      kindWeights: null,
      rewards: {},
    },
  ];
  return parseProfile(profile);
}

describe("environment-independent natural balance runner", () => {
  test("same profile, seed, layout and strategy reproduce all deterministic summaries and events", () => {
    const config = { ...base, trace: true, strategy: { name: "random-auto" as const, seed: 17 } };
    expect(runNatural(config, quickProfile())).toEqual(runNatural(config, quickProfile()));
  });

  test("default profile is the current resolved official profile", () => {
    expect(runNatural({ ...base, maxSteps: 20 })).toEqual(
      runNatural({ ...base, maxSteps: 20 }, officialProfile()),
    );
  });

  test("separate runs and profile snapshots cannot contaminate each other", () => {
    const profile = quickProfile();
    const original = structuredClone(profile);
    const first = runNatural(base, profile);
    const different = quickProfile();
    different.payload.player.stats.controlPulse = 2;
    runNatural(base, different);
    expect(profile).toEqual(original);
    expect(runNatural(base, profile)).toEqual(first);
  });

  test("trace sampling and bounds do not alter combat or choices", () => {
    const plain = runNatural(base, quickProfile());
    const traced = runNatural(
      { ...base, trace: true, traceCapacity: 2, eventCapacity: 3 },
      quickProfile(),
    );
    expect(traced.final).toEqual(plain.final);
    expect(traced.rewards).toEqual(plain.rewards);
    expect(traced.stages).toEqual(plain.stages);
    expect(traced.trace).toHaveLength(2);
    expect(traced.droppedTraceSamples).toBeGreaterThan(0);
    expect(traced.events).toHaveLength(3);
    expect(traced.droppedEvents).toBeGreaterThan(0);
    expect(plain.trace).toEqual([]);
  });

  test("campaign victory requires all four real final rewards", () => {
    const result = runNatural(base, quickProfile());
    expect(result.termination).toBe("campaign_victory");
    expect(result.clearedStages).toBe(4);
    expect(result.rewards.filter((reward) => reward.source === "stage")).toHaveLength(4);
    expect(result.stages.every((stage) => stage.clear !== null && stage.postReward !== null)).toBe(
      true,
    );
    expect(result.stages.map((stage) => stage.peakEnemies)).toEqual([1, 1, 1, 1]);
    expect(result.deathStage).toBeNull();
  });

  test("a real long legacy victory records no phantom freezing and round-trips through portable case validation", async () => {
    // Preserve the original no-sanctuary reward history behind this clock regression.
    const profile = defaultProfile();
    const run: RunConfig = {
      ...base,
      strategy: { name: "legacy" },
      maxSteps: 78_000,
      maxSeconds: 650,
    };
    const expected = runNatural(run, profile);
    expect(expected.termination).toBe("campaign_victory");
    expect(expected.playerSeconds).toBeGreaterThan(200);
    expect(expected.metrics.mechanics.sanctuary ?? 0).toBe(0);
    for (const metrics of [expected.metrics, ...expected.stages.map((stage) => stage.metrics)]) {
      expect(metrics.sanctuarySeconds).toBe(0);
      for (const field of ["poisonSeconds", "woundSeconds", "slowSeconds"] as const)
        expect(metrics[field]).toBeGreaterThanOrEqual(0);
    }
    const portableCase = {
      schemaVersion: 1,
      kind: "balance-simulator-case",
      simulatorVersion: "1",
      profile,
      profileHash: await contentHash(profile),
      code: { commit: "fixture", dirty: false, fingerprint: "fixture" },
      run,
      expected,
      expectedHash: await contentHash(expected),
    };
    const parsed = await parseReviewDocument(JSON.parse(JSON.stringify(portableCase)));
    expect(parsed.kind).toBe("balance-simulator-case");
    if (parsed.kind !== "balance-simulator-case") throw new Error("Expected portable case");
    expect(parsed.expected).toEqual(expected);
  }, 30_000);

  test("budget exhaustion, cancellation, health death and error remain different outcomes", () => {
    expect(runNatural({ ...base, maxSteps: 1 }, quickProfile()).termination).toBe(
      "budget_exhausted",
    );
    expect(runNatural(base, quickProfile(), { isCancelled: () => true }).termination).toBe(
      "cancelled",
    );
    const dead = officialProfile();
    dead.payload.player.hp = 1;
    expect(runNatural(base, dead).termination).toBe("death");
    const original = World.prototype.update;
    const brokenStep = spyOn(World.prototype, "update").mockImplementation(function (
      this: World,
      delta: number,
    ) {
      original.call(this, delta);
      this.player.hp = Number.NaN;
    });
    try {
      const error = runNatural(base, quickProfile());
      expect(error.termination).toBe("error");
      expect(error.reason).toContain("Non-finite");
      expect(error.validMetrics).toBe(false);
      expect(error.invalidValues).toContainEqual({ path: "world.player.hp", value: "NaN" });
      expect(error.invalidValues).toContainEqual({ path: "result.final.hp", value: "NaN" });
      expect(error.final.hp).toBe(0);
      expect(JSON.parse(JSON.stringify(error))).toEqual(error);
    } finally {
      brokenStep.mockRestore();
    }
  });

  test("endless target means completed endless stages and rewards, not permanent victory", () => {
    const result = runNatural({ ...base, mode: "endless", endlessTarget: 1 }, quickProfile());
    expect(result.termination).toBe("endless_target_reached");
    expect(result.endlessCleared).toBe(1);
    expect(result.clearedStages).toBe(5);
    expect(result.phase).toBe("Playing");
    expect(result.stages.find((stage) => stage.stageIndex === 4)?.postReward).not.toBeNull();
  });

  test("final entity integrity is checked even between sparse trace samples", () => {
    const original = World.prototype.update;
    let steps = 0;
    const brokenStep = spyOn(World.prototype, "update").mockImplementation(function (
      this: World,
      delta: number,
    ) {
      original.call(this, delta);
      if (++steps === 10 && this.boss) this.boss.hp = Infinity;
    });
    try {
      const result = runNatural(
        { ...base, maxSteps: 10, sampleIntervalSeconds: 3600 },
        quickProfile(),
      );
      expect(result.termination).toBe("error");
      expect(result.validMetrics).toBe(false);
      expect(result.invalidValues).toContainEqual({
        path: "world.enemies.items[0].hp",
        value: "Infinity",
      });
    } finally {
      brokenStep.mockRestore();
    }
  });

  test("empty native rewards are skipped without granting excluded cards", () => {
    const profile = quickProfile();
    profile.payload.rewards.stage.cardWeights = Object.fromEntries(
      CARDS.map((card) => [card.id, 0]),
    );
    profile.payload.rewards.stage.trainingWeights = Object.fromEntries(
      TRAININGS.map((item) => [item.id, 0]),
    );
    const result = runNatural(base, profile);
    expect(result.termination).toBe("campaign_victory");
    expect(result.coverage.emptyRewards).toBe(4);
    expect(
      result.rewards
        .filter((reward) => reward.source === "stage")
        .every((reward) => reward.kind === "empty"),
    ).toBe(true);
    expect(result.final.cards).toEqual({});
  });

  test("manual boss training and score auto training are recorded separately", () => {
    const profile = quickProfile();
    profile.payload.rewards.stage.cardWeights = Object.fromEntries(
      CARDS.map((card) => [card.id, 0]),
    );
    const result = runNatural(base, profile);
    expect(result.termination).toBe("campaign_victory");
    expect(
      result.rewards
        .filter((reward) => reward.source === "stage")
        .every((reward) => reward.kind === "training" && !reward.automatic),
    ).toBe(true);
    expect(result.rewards.some((reward) => reward.source === "score" && reward.automatic)).toBe(
      true,
    );
    expect(
      Object.values(result.coverage.trainingSelections).reduce((sum, value) => sum + value, 0),
    ).toBe(4);
  });

  test("legal extreme score conversion is interrupted inside its synchronous native action", () => {
    const profile = quickProfile();
    profile.payload.player.hp = 1e12;
    profile.payload.player.stats.maxHp = 1e12;
    const result = runNatural(base, parseProfile(profile));
    expect(result.termination).toBe("error");
    expect(result.reason).toContain("Automatic training loop guard");
    expect(result.reason).toContain("4096");
    expect(result.rewardCount).toBe(4096);
    expect(result.steps).toBeLessThan(base.maxSteps);
    expect(result.validMetrics).toBe(true);
    expect(result.invalidValues).toEqual([]);
  });

  test("stale reward capability does not become a silently repeated choice", () => {
    const claim = spyOn(World.prototype, "chooseCard").mockReturnValue(true);
    try {
      const result = runNatural(base, quickProfile());
      expect(result.termination).toBe("error");
      expect(result.reason).toContain("reward token");
    } finally {
      claim.mockRestore();
    }
  });

  test("sanctuary freezes enemy clock while player time continues and choices consume no time", () => {
    const profile = quickProfile();
    const rule = profile.payload.stageRules[0];
    if (!rule) throw new Error("Missing fixture rule");
    rule.stage.bossAt = 10;
    profile.payload.player.stats.controlPulse = 1;
    const result = runNatural({ ...base, maxSeconds: 100, maxSteps: 12_000 }, profile);
    expect(result.termination).toBe("campaign_victory");
    expect(result.playerSeconds).toBeGreaterThan(result.enemySeconds);
    expect(result.metrics.sanctuarySeconds).toBeCloseTo(
      result.playerSeconds - result.enemySeconds,
      8,
    );
    expect(result.playerSeconds).toBeCloseTo(result.steps * CONFIG.fixedStep, 7);
    for (const stage of result.stages) {
      expect(stage.entryTime.stageSeconds).toBe(0);
      expect(stage.bossSpawnTime?.stageSeconds).toBeGreaterThanOrEqual(10);
      expect(stage.bossDeathTime).toEqual(stage.clearTime);
      expect(stage.metrics.enemyDamage).toBe(1);
    }
  });

  test("clear state precedes score training, rewards and stage recovery", () => {
    const profile = quickProfile();
    profile.payload.player.hp = 10;
    const result = runNatural(base, profile);
    const first = result.stages[0];
    if (!first) throw new Error("Missing first stage");
    expect(first.entry.hp).toBe(10);
    expect(first.clear?.hp).toBe(10);
    expect(first.postReward?.hp).toBeGreaterThanOrEqual(45);
    if (!first.postReward) throw new Error("Missing post-reward snapshot");
    expect(result.stages[1]?.entry).toEqual(first.postReward);
    expect(result.stages.reduce((sum, stage) => sum + stage.playerSeconds, 0)).toBeCloseTo(
      result.playerSeconds,
      8,
    );
    expect(result.stages.reduce((sum, stage) => sum + stage.metrics.enemyDamage, 0)).toBe(
      result.metrics.enemyDamage,
    );
  });

  test("enemy stuns do not erase simultaneous player poison, wounds or slow occupancy", () => {
    const profile = quickProfile();
    profile.payload.player.stats.damage = 12;
    profile.payload.player.stats.stun = 1;
    profile.payload.player.stats.maxHp = 1000;
    profile.payload.player.hp = 1000;
    const rule = profile.payload.stageRules[0];
    if (!rule) throw new Error("Missing fixture rule");
    rule.stage.bossHp = 1e8;
    let observedWorld: World | undefined;
    const original = World.prototype.start;
    const statusFixture = spyOn(World.prototype, "start").mockImplementation(function (
      this: World,
      seed?: number,
    ) {
      const started = original.call(this, seed);
      this.player.poisonTime = 10;
      this.player.woundTime = 10;
      this.player.poisonSlowTime = 10;
      observedWorld = this;
      return started;
    });
    try {
      const result = runNatural({ ...base, maxSeconds: 4 }, profile);
      expect(result.termination).toBe("budget_exhausted");
      expect(observedWorld?.controlProcs).toBeGreaterThan(0);
      expect(observedWorld?.player.poisonTime).toBeGreaterThan(0);
      expect(result.metrics.mechanics.sanctuary ?? 0).toBe(0);
      expect(result.metrics.poisonSeconds).toBeCloseTo(result.playerSeconds, 10);
      expect(result.metrics.woundSeconds).toBeCloseTo(result.playerSeconds, 10);
      expect(result.metrics.slowSeconds).toBeCloseTo(result.playerSeconds, 10);
    } finally {
      statusFixture.mockRestore();
    }
  });

  test("real death attribution and bounded preceding event window are retained", () => {
    const result = runNatural(
      { ...base, maxSeconds: 100, maxSteps: 12_000, eventCapacity: 30 },
      defaultProfile(),
    );
    expect(result.termination).toBe("death");
    expect(result.fatalSource).not.toBe("unknown");
    expect(result.deathWindow.length).toBeLessThanOrEqual(30);
    expect(result.deathWindow.at(-1)?.type).toBe("death");
    expect(
      result.deathWindow.every((event) => event.playerSeconds >= result.playerSeconds - 8),
    ).toBe(true);
    expect(result.metrics.enemyDamage).toBeGreaterThan(0);
    expect(result.metrics.effectiveDps).toBeCloseTo(
      result.metrics.enemyDamage / result.playerSeconds,
      8,
    );
  });

  test("unbounded or invalid natural experiment budgets are rejected", () => {
    expect(() => validateRunConfig({ ...base, maxSteps: Infinity })).toThrow();
    expect(() => validateRunConfig({ ...base, mode: "endless", endlessTarget: 0 })).toThrow();
    expect(() => validateRunConfig({ ...base, eventCapacity: 0 })).toThrow();
    const broken = quickProfile();
    broken.payload.player.stats.damage = Number.NaN;
    expect(() => runNatural(base, broken)).toThrow();
  });
});

describe("composable reward and target strategy policies", () => {
  test("families come from actual definitions and unknown parameters fail explicitly", () => {
    for (const family of SYNERGIES)
      expect(
        resolveStrategy({ name: "build-auto", reward: { preferences: { [family.id]: 1 } } }).reward
          .preferences[family.id],
      ).toBe(1);
    expect(() =>
      resolveStrategy({ name: "build-auto", reward: { preferences: { invented: 1 } } }),
    ).toThrow();
    expect(() =>
      resolveStrategy({ name: "build-auto", bad: true } as unknown as StrategyConfig),
    ).toThrow();
    expect(() => resolveStrategy({ name: "build-auto", target: { intervalSeconds: 0 } })).toThrow();
  });

  test("build-auto and build-active share selection config and independent target policy", () => {
    const auto = resolveStrategy({ name: "build-auto", seed: 8 });
    const active = resolveStrategy({ name: "build-active", seed: 8 });
    expect(active.reward).toEqual(auto.reward);
    expect(active.target.kind).toBe("active");
    expect(auto.target.kind).toBe("auto");
    expect(resolveStrategy({ name: "build-auto", target: { kind: "active" } }).target.kind).toBe(
      "active",
    );
  });

  test("random choices are deterministic and strategy scoring never mutates current state", () => {
    const world = new World();
    world.start(7);
    world.reward = { token: 1, source: "stage", choices: ["training-damage", "haste", "force"] };
    const player = structuredClone(world.player);
    const first = createStrategy(resolveStrategy({ name: "random-auto", seed: 44 }));
    const second = createStrategy(resolveStrategy({ name: "random-auto", seed: 44 }));
    expect(Array.from({ length: 10 }, () => first.chooseReward(world))).toEqual(
      Array.from({ length: 10 }, () => second.chooseReward(world)),
    );
    createStrategy(resolveStrategy({ name: "build-auto" })).chooseReward(world);
    expect(world.player).toEqual(player);
    expect(world.stacks.size).toBe(0);
  });

  test("training receives marginal scoring and unmodeled rewards have recorded fallback", () => {
    const world = new World();
    world.start(3);
    world.reward = {
      token: 1,
      source: "stage",
      choices: ["training-damage", "training-critical-power", "unmodeled-future-reward"],
    };
    const choice = createStrategy(resolveStrategy({ name: "build-auto" })).chooseReward(world);
    expect(choice.choice).toBe("training-damage");
    expect(choice.scores["training-damage"]).toBeGreaterThan(2);
    expect(choice.fallback).toContain("training-critical-power");
    expect(choice.fallback).toContain("unmodeled-future-reward");
  });

  test("effective caps remove training output utility and active targeting is rate limited", () => {
    const world = new World();
    world.start(1);
    world.player.stats.critChance = 0.85;
    world.reward = { token: 1, source: "stage", choices: ["training-critical", "training-damage"] };
    const strategy = createStrategy(resolveStrategy({ name: "build-active" }));
    expect(strategy.chooseReward(world).fallback).toContain("training-critical");
    expect(strategy.target(world)).toBe(true);
    expect(strategy.target(world)).toBe(false);
    world.update(CONFIG.fixedStep);
    expect(strategy.target(world)).toBe(false);
  });
});
