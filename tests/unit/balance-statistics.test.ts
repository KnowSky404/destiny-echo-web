import { describe, expect, test } from "bun:test";
import { parseExperiment } from "../../scripts/balance-sim/config";
import {
  csvCell,
  groupSummary,
  pairedComparison,
  quantile,
  type RecordedRun,
  summarize,
  wilson,
} from "../../scripts/balance-sim/statistics";
import { stableStringify } from "../../src/balance-sim/encoding";
import { runNatural } from "../../src/balance-sim/runner";
import { resolveStrategy } from "../../src/balance-sim/strategies";
import type { StrategyConfig, Termination } from "../../src/balance-sim/types";
import { CONFIG } from "../../src/game/config";

const controls = {
  maxSteps: 1,
  maxSeconds: CONFIG.fixedStep,
  endlessTarget: 1,
  trace: false,
  sampleIntervalSeconds: 1,
  traceCapacity: 1000,
  deathWindowSeconds: 8,
  eventCapacity: 400,
};
const template = runNatural({
  seed: 1,
  width: CONFIG.width,
  mode: "campaign",
  strategy: { name: "build-auto" },
  ...controls,
});
function record(
  seed: number,
  termination: Termination,
  strategy: StrategyConfig = { name: "build-auto" },
): RecordedRun {
  const result = structuredClone(template);
  result.config.seed = seed;
  result.config.strategy = strategy;
  result.strategy = resolveStrategy(strategy);
  result.termination = termination;
  result.deathStage = termination === "death" ? 0 : null;
  return {
    id: `run-${seed}-${strategy.name}`,
    cohort: "selection",
    profileHash: "a".repeat(64),
    profileId: "baseline",
    profileName: "baseline",
    layoutId: "portrait",
    wallTimeMs: 1,
    result,
  };
}

describe("balance statistics boundaries and evidence integrity", () => {
  test("Wilson intervals handle no sample, zero wins, all wins and invalid counts", () => {
    expect(wilson(0, 0)).toBeNull();
    expect(wilson(0, 1)?.[0]).toBe(0);
    expect(wilson(0, 1)?.[1]).toBeCloseTo(0.7934506856, 9);
    expect(wilson(1, 1)?.[0]).toBeCloseTo(0.2065493144, 9);
    expect(wilson(1, 1)?.[1]).toBe(1);
    expect(wilson(50, 100)?.[0]).toBeCloseTo(0.4038315304, 9);
    expect(() => wilson(2, 1)).toThrow();
    expect(() => wilson(0.5, 1)).toThrow();
  });

  test("percentiles use defined linear interpolation for empty and small samples", () => {
    expect(quantile([], 0.1)).toBeNull();
    expect(quantile([7], 0.9)).toBe(7);
    expect(quantile([3, 1], 0.25)).toBe(1.5);
    expect(quantile([3, 1], 0.9)).toBe(2.8);
    expect(() => quantile([1, 2], -0.1)).toThrow();
  });

  test("non-finite samples and quantile probabilities fail instead of disappearing", () => {
    expect(() => quantile([1, Number.NaN], 0.5)).toThrow();
    expect(() => quantile([Number.POSITIVE_INFINITY], 0.5)).toThrow();
    expect(() => quantile([1], Number.NaN)).toThrow();
  });

  test("canonical evidence cannot alias non-finite numeric values to null", () => {
    expect(() => stableStringify({ metrics: { damage: Number.NaN } })).toThrow();
    expect(() => stableStringify([Number.POSITIVE_INFINITY])).toThrow();
    expect(stableStringify({ a: null, b: 0 })).toBe('{"a":null,"b":0}');
  });

  test("budget, error, cancellation and missing samples remain unknown, not deaths", () => {
    const runs = ["campaign_victory", "death", "budget_exhausted", "error", "cancelled"].map(
      (termination, index) => record(index + 1, termination as Termination),
    );
    const summary = groupSummary(runs, 7);
    expect(summary.completed).toBe(5);
    expect(summary.missing).toBe(2);
    expect(summary.resolved).toBe(2);
    expect(summary.wins).toBe(1);
    expect(summary.counts.death).toBe(1);
    expect(summary.counts.error).toBe(1);
    expect(summary.counts.cancelled).toBe(1);
    expect(summary.winRate).toBe(0.5);
    expect(summary.unresolvedRatio).toBe(5 / 7);
    expect(summary.winRateBounds).toEqual([1 / 7, 6 / 7]);
  });

  test("stage denominators distinguish entry, conditional clears and cumulative clears", () => {
    const runs = [record(1, "campaign_victory"), record(2, "death"), record(3, "death")];
    const later = structuredClone(template.stages[0]);
    if (!later) throw new Error("Expected entered fixture stage");
    later.stageIndex = 1;
    later.cleared = true;
    runs[0]?.result.stages.push(later);
    const failedLater = structuredClone(later);
    failedLater.cleared = false;
    runs[1]?.result.stages.push(failedLater);
    if (runs[1]) runs[1].result.deathStage = 1;
    const summary = groupSummary(runs, 3);
    const stage = summary.stages.find((item) => item.stageIndex === 1);
    expect(stage).toMatchObject({
      entered: 2,
      cleared: 1,
      deaths: 1,
      conditionalClearRate: 0.5,
      cumulativeClearRate: 1 / 3,
    });
  });

  test("unstarted strategy/layout groups remain visible after interruption", () => {
    const config = parseExperiment({
      ...controls,
      seeds: [1, 2],
      validationSeeds: [],
      strategies: [{ name: "build-auto" }, { name: "build-active" }],
      layouts: [
        { id: "portrait", width: CONFIG.width },
        { id: "desktop", width: 1600 },
      ],
    });
    const summary = summarize([record(1, "cancelled")], config, [
      { hash: "a".repeat(64), name: "baseline" },
    ]);
    expect(summary.planned).toBe(8);
    expect(summary.completed).toBe(1);
    expect(summary.groups).toHaveLength(4);
    expect(summary.groups.filter((group) => group.completed === 0)).toHaveLength(3);
    expect(summary.groups.reduce((sum, group) => sum + group.missing, 0)).toBe(7);
  });

  test("paired results retain discordant and unresolved outcomes, and reject duplicate seeds", () => {
    const left = [
      record(1, "campaign_victory"),
      record(2, "death"),
      record(3, "campaign_victory"),
      record(4, "death"),
      record(5, "error"),
    ];
    const right = [
      record(1, "campaign_victory"),
      record(2, "death"),
      record(3, "death"),
      record(4, "campaign_victory"),
      record(5, "campaign_victory"),
    ];
    expect(pairedComparison(left, right)).toMatchObject({
      matched: 5,
      resolvedPairs: 4,
      unresolvedPairs: 1,
      bothWin: 1,
      bothLoss: 1,
      onlyA: 1,
      onlyB: 1,
      deltaPercentagePoints: 0,
      unmatchedA: [],
      unmatchedB: [],
    });
    expect(() => pairedComparison([left[0] as RecordedRun, left[0] as RecordedRun], right)).toThrow(
      "Duplicate",
    );
  });

  test("different budgets or seeds cannot be silently paired", () => {
    const left = record(1, "campaign_victory");
    const right = record(1, "death");
    right.id = "right";
    right.result.config.maxSteps++;
    const result = pairedComparison([left], [right]);
    expect(result.matched).toBe(0);
    expect(result.resolvedPairs).toBe(0);
    expect(result.deltaPercentagePoints).toBeNull();
    expect(result.unmatchedA).toEqual([left.id]);
    expect(result.unmatchedB).toEqual([right.id]);
    right.result.config.maxSteps = left.result.config.maxSteps;
    right.result.config.seed = 2;
    expect(pairedComparison([left], [right]).matched).toBe(0);
  });

  test("different reward RNG seeds do not claim isolated target strategy comparison", () => {
    const left = record(1, "death", { name: "random-auto", seed: 1 });
    const right = record(1, "death", { name: "build-active", seed: 2, reward: { kind: "random" } });
    expect(pairedComparison([left], [right], "strategy").rewardRulesIdentical).toBe(false);
  });

  test("paired continuous deltas use B minus A among resolved valid pairs", () => {
    const left = [record(1, "campaign_victory"), record(2, "death"), record(3, "error")];
    const right = [record(1, "campaign_victory"), record(2, "death"), record(3, "death")];
    const a = left[0] as RecordedRun;
    const b = right[0] as RecordedRun;
    a.result.playerSeconds = 10;
    b.result.playerSeconds = 12;
    a.result.enemySeconds = 8;
    b.result.enemySeconds = 9;
    a.result.metrics.hpLoss = 80;
    b.result.metrics.hpLoss = 40;
    a.result.final.hp = 30;
    b.result.final.hp = 20;
    a.result.metrics.effectiveDps = 100;
    b.result.metrics.effectiveDps = 120;
    const aa = left[1] as RecordedRun;
    const bb = right[1] as RecordedRun;
    aa.result.playerSeconds = 8;
    bb.result.playerSeconds = 5;
    aa.result.enemySeconds = 7;
    bb.result.enemySeconds = 4;
    aa.result.metrics.hpLoss = 20;
    bb.result.metrics.hpLoss = 30;
    aa.result.final.hp = 0;
    bb.result.final.hp = 0;
    aa.result.metrics.effectiveDps = null;
    bb.result.metrics.effectiveDps = 30;
    const deltas = pairedComparison(left, right).continuousDeltasResolvedPairs;
    expect(deltas.playerSeconds).toMatchObject({ n: 2, mean: -0.5, p50: -0.5 });
    expect(deltas.enemySeconds).toMatchObject({ n: 2, mean: -1 });
    expect(deltas.hpLoss).toMatchObject({ n: 2, mean: -15 });
    expect(deltas.finalHp).toMatchObject({ n: 2, mean: -5 });
    expect(deltas.effectiveDps).toMatchObject({ n: 1, mean: 20 });
  });

  test("unplanned conditions and mismatched actual layout fail report integrity", () => {
    const config = parseExperiment({
      ...controls,
      seeds: [1, 2],
      validationSeeds: [],
      strategies: [{ name: "build-auto" }],
      layouts: [{ id: "portrait", width: CONFIG.width }],
    });
    const profile = [{ hash: "a".repeat(64), name: "baseline" }];
    const mutations: Array<(run: RecordedRun) => void> = [
      (run) => {
        run.result.config.maxSteps++;
      },
      (run) => {
        run.result.config.maxSeconds++;
      },
      (run) => {
        run.result.config.mode = "endless";
      },
      (run) => {
        run.result.config.endlessTarget++;
      },
      (run) => {
        run.result.config.trace = true;
      },
      (run) => {
        run.result.config.sampleIntervalSeconds = 2;
      },
      (run) => {
        run.result.config.traceCapacity = 10;
      },
      (run) => {
        run.result.config.deathWindowSeconds = 1;
      },
      (run) => {
        run.result.config.eventCapacity = 10;
      },
      (run) => {
        run.result.fixedStep = CONFIG.fixedStep * 2;
      },
      (run) => {
        run.result.layout.width = 1600;
      },
      (run) => {
        run.result.layout.capacity++;
      },
      (run) => {
        run.result.strategy.seed++;
      },
      (run) => {
        run.result.termination = "invalid" as Termination;
      },
    ];
    for (const mutate of mutations) {
      const item = record(1, "budget_exhausted");
      mutate(item);
      expect(() => summarize([item], config, profile)).toThrow();
    }
    const first = record(1, "budget_exhausted");
    const second = record(1, "budget_exhausted");
    second.id = "different-budget-same-seed";
    second.result.config.maxSteps++;
    expect(() => summarize([first, second], config, profile)).toThrow("Duplicate");
  });

  test("reserved validation cohorts cannot silently count an unselected profile", () => {
    const config = parseExperiment({
      ...controls,
      seeds: [1],
      validationSeeds: [2],
      strategies: [{ name: "build-auto" }],
      layouts: [{ id: "portrait", width: CONFIG.width }],
    });
    const profiles = [
      { hash: "a".repeat(64), name: "baseline" },
      { hash: "b".repeat(64), name: "candidate" },
    ];
    const unexpected = record(2, "budget_exhausted");
    unexpected.cohort = "validation";
    unexpected.profileHash = "b".repeat(64);
    expect(() =>
      summarize([unexpected], config, profiles, ["selection", "validation"], {
        validation: ["a".repeat(64)],
      }),
    ).toThrow("Unplanned");
    const summary = summarize(
      [record(1, "budget_exhausted")],
      config,
      profiles,
      ["selection", "validation"],
      { validation: ["a".repeat(64)] },
    );
    expect(summary.planned).toBe(3);
    expect(summary.groups).toHaveLength(3);
    expect(summary.completed).toBe(summary.groups.reduce((sum, group) => sum + group.completed, 0));
    expect(summary.completed).toBe(
      Object.values(summary.counts).reduce((sum, count) => sum + count, 0),
    );
  });

  test("CSV preserves delimiters and neutralizes imported spreadsheet formulas", () => {
    expect(csvCell('first,"second"\nthird')).toBe('"first,""second""\nthird"');
    expect(csvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(csvCell(-12)).toBe("-12");
    expect(csvCell(null)).toBe("");
  });
});
