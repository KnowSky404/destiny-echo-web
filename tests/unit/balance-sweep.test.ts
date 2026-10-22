import { describe, expect, test } from "bun:test";
import { parseExperiment, plannedRuns, preset, seedSet } from "../../scripts/balance-sim/config";
import { parameterDiff, parseSweep, sweepCandidates } from "../../scripts/balance-sim/sweep";
import { stableStringify } from "../../src/balance-sim/encoding";
import {
  defaultProfile,
  officialProfile,
  parseProfile,
  resolvedStage,
} from "../../src/data/balance/profile";

function stageBase() {
  const profile = defaultProfile();
  profile.payload.stageRules = [
    { from: 1, to: 4, stage: { health: 1, enemyCount: 10 }, kindWeights: null, rewards: {} },
  ];
  return parseProfile(profile);
}

describe("controlled one-factor parameter scans", () => {
  test("deduplicates unchanged and integer-rounded candidates without changing the base", () => {
    const profile = defaultProfile();
    const original = stableStringify(profile);
    const official = stableStringify(officialProfile());
    const candidates = sweepCandidates(
      profile,
      parseSweep({
        label: "弹数",
        paths: ["player.stats.projectiles"],
        values: [1, 1.1, 1.6, 2, 2.4, 3],
      }),
    );
    expect(
      candidates.map((candidate) => candidate.profile.payload.player.stats.projectiles),
    ).toEqual([2, 3]);
    expect(candidates[0]?.changes).toEqual([
      { path: "payload.player.stats.projectiles", before: 1, after: 2 },
    ]);
    expect(candidates[1]?.profile.id).not.toBe(candidates[0]?.profile.id);
    expect(stableStringify(profile)).toBe(original);
    expect(stableStringify(officialProfile())).toBe(official);
  });

  test("named related parameters change together and each full profile validates", () => {
    const profile = defaultProfile();
    const candidates = sweepCandidates(
      profile,
      parseSweep({
        label: "基础敌人生命",
        paths: ["enemies.wisp.hp", "enemies.sentinel.hp", "enemies.hexer.hp"],
        multipliers: [0.9, 1.1],
      }),
    );
    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      expect(parseProfile(candidate.profile)).toEqual(candidate.profile);
      expect(candidate.changes).toHaveLength(3);
      expect(parameterDiff(profile.payload, candidate.profile.payload)).toEqual(candidate.changes);
      expect(candidate.profile.payload.player).toEqual(profile.payload.player);
    }
  });

  test("explicit stage changes defer population and layout derivation to the shared resolver", () => {
    const profile = stageBase();
    const candidates = sweepCandidates(
      profile,
      parseSweep({ label: "战役预算", paths: ["stageRules.0.stage.enemyCount"], values: [20] }),
    );
    const candidate = candidates[0]?.profile;
    if (!candidate) throw new Error("Expected generated candidate");
    expect(candidate.payload.stageRules[0]?.stage.enemyCount).toBe(20);
    expect(resolvedStage(candidate, 0, 450).enemyCount).toBe(20);
    expect(resolvedStage(candidate, 0, 1600).enemyCount).toBeGreaterThan(20);
    expect(profile.payload.stageRules[0]?.stage.enemyCount).toBe(10);
  });

  test("missing explicit stage values, unsafe paths and invalid ranges fail", () => {
    for (const path of [
      "__proto__.polluted",
      "player.hp",
      "enemies.wisp.unknown",
      "stageRules.0.stage.health",
    ]) {
      expect(() =>
        sweepCandidates(
          defaultProfile(),
          parseSweep({ label: "invalid", paths: [path], values: [2] }),
        ),
      ).toThrow();
    }
    expect(() =>
      sweepCandidates(
        defaultProfile(),
        parseSweep({ label: "invalid", paths: ["player.stats.projectiles"], values: [7] }),
      ),
    ).toThrow();
    expect(() =>
      sweepCandidates(
        defaultProfile(),
        parseSweep({ label: "invalid", paths: ["enemies.wisp.interval"], values: [0] }),
      ),
    ).toThrow();
  });

  test("scan specifications require one bounded factor and reject unknown options", () => {
    for (const invalid of [
      { label: "x", paths: ["player.stats.damage"], values: [1], multipliers: [2] },
      { label: "x", paths: ["player.stats.damage"] },
      { label: "x", paths: ["player.stats.damage", "player.stats.damage"], values: [1] },
      { label: "x", paths: ["player.stats.damage"], values: [Number.POSITIVE_INFINITY] },
      { label: "x", paths: ["player.stats.damage"], values: [1], code: "evil()" },
      { label: "", paths: ["player.stats.damage"], values: [1] },
    ])
      expect(() => parseSweep(invalid)).toThrow();
  });
});

describe("experiment budgets and seed cohorts", () => {
  test("fixed masters produce deterministic unique seeds and presets cover the required matrix", () => {
    expect(seedSet(42, 100)).toEqual(seedSet(42, 100));
    expect(new Set(seedSet(42, 100)).size).toBe(100);
    const standard = preset("standard");
    expect(standard.seeds).toHaveLength(100);
    expect(standard.strategies).toHaveLength(3);
    expect(standard.layouts).toHaveLength(2);
    expect(plannedRuns(standard)).toBe(600);
    expect(standard.validationSeeds.some((seed) => standard.seeds.includes(seed))).toBe(false);
  });

  test("invalid seeds, duplicate layouts and total run overflow fail before execution", () => {
    expect(() => parseExperiment({ seeds: [1, 1] })).toThrow("duplicate");
    expect(() => parseExperiment({ seeds: [1], validationSeeds: [1] })).toThrow("disjoint");
    expect(() =>
      parseExperiment({
        seeds: [1],
        validationSeeds: [],
        layouts: [
          { id: "one", width: 450 },
          { id: "two", width: 450 },
        ],
      }),
    ).toThrow("Duplicate layouts");
    expect(() => plannedRuns({ ...preset("standard"), maxRuns: 599 })).toThrow("maxRuns");
    expect(() => seedSet(Number.NaN, 1)).toThrow();
  });

  test("config parsing clones nested values rather than sharing state between experiments", () => {
    const source = {
      seeds: [1],
      validationSeeds: [],
      strategies: [{ name: "build-auto" as const, reward: { preferences: { blood: 1 } } }],
    };
    const parsed = parseExperiment(source);
    const preferences = parsed.strategies[0]?.reward?.preferences;
    if (!preferences) throw new Error("Expected copied preferences");
    preferences.blood = 99;
    expect(source.strategies[0]?.reward.preferences.blood).toBe(1);
    parsed.seeds.push(2);
    expect(source.seeds).toEqual([1]);
  });
});
