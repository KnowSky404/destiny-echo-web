import { describe, expect, test } from "bun:test";
import { parseExperiment, seedSet } from "../../scripts/balance-sim/config";
import type { CodeIdentity } from "../../scripts/balance-sim/evidence";
import type { RecordedRun } from "../../scripts/balance-sim/statistics";
import {
  type CalibrationCell,
  calibrationCells,
  validateCalibrationCell,
} from "../../scripts/calibration-evidence";
import { contentHash } from "../../src/balance-sim/encoding";
import { runNatural } from "../../src/balance-sim/runner";
import type { RunConfig } from "../../src/balance-sim/types";
import { defaultProfile } from "../../src/data/balance/profile";
import { CONFIG } from "../../src/game/config";

const controls = {
  maxSteps: 78000,
  maxSeconds: 650,
  endlessTarget: 2,
  trace: false,
  sampleIntervalSeconds: 1,
  traceCapacity: 1000,
  deathWindowSeconds: 8,
  eventCapacity: 400,
};

const fixturePromise = (async () => {
  const profile = defaultProfile();
  const hash = await contentHash(profile);
  const config = parseExperiment({
    ...controls,
    mode: "campaign",
    seeds: [2401570752],
    validationSeeds: [],
    strategies: [{ name: "random-auto" }],
    layouts: [{ id: "portrait", width: 450 }],
  });
  const raw = structuredClone(config);
  const cell: CalibrationCell & { raw: typeof config } = {
    id: "fixture",
    phase: "selection",
    raw,
    config,
  };
  const run: RunConfig = {
    ...controls,
    seed: config.seeds[0] as number,
    width: 450,
    strategy: { name: "random-auto" },
    mode: "campaign",
  };
  // One naturally resolved run supplies a realistic structural fixture for all tests.
  const result = runNatural(run, profile);
  if (result.termination !== "death") throw new Error("Expected a naturally resolved fixture");
  const files = { "src/game/world.ts": "a".repeat(64) };
  const code: CodeIdentity = {
    commit: "fixture",
    dirty: false,
    fingerprint: await contentHash(files),
    bunVersion: Bun.version,
    fixedStep: CONFIG.fixedStep,
    files,
  };
  const record: RecordedRun = {
    id: "run-1",
    cohort: "selection",
    profileHash: hash,
    profileId: profile.id,
    profileName: profile.name,
    layoutId: "portrait",
    wallTimeMs: 1,
    result,
  };
  return {
    cell,
    runs: [record],
    profiles: [{ hash, profile }],
    currentCode: code,
    manifest: {
      schemaVersion: 1,
      simulatorVersion: "1",
      command: ["scripts/balance-simulator.ts", "simulate", "--profile", "fixture"],
      config: structuredClone(config),
      code: structuredClone(code),
      profiles: [{ hash, profile: structuredClone(profile), source: "fixture" }],
      planned: 1,
      completed: 1,
      status: "complete",
      startedAt: "2026-10-22T00:00:00.000Z",
      finishedAt: "2026-10-22T00:00:01.000Z",
      selectedCandidate: null,
    },
  };
})();

type Fixture = Awaited<typeof fixturePromise>;
function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing fixture value");
  return value;
}
async function fixture(): Promise<Fixture> {
  return structuredClone(await fixturePromise);
}
function validate(input: Fixture) {
  return validateCalibrationCell(
    input.cell,
    input.manifest,
    input.runs,
    input.profiles,
    input.currentCode,
  );
}
async function rejects(change: (input: Fixture) => void): Promise<void> {
  const input = await fixture();
  change(input);
  await expect(validate(input)).rejects.toThrow();
}
function budgets(input: Fixture, maxSteps: number, maxSeconds: number): void {
  for (const config of [
    input.cell.config,
    input.cell.raw,
    input.manifest.config,
    present(input.runs[0]).result.config,
  ]) {
    config.maxSteps = maxSteps;
    config.maxSeconds = maxSeconds;
  }
}

async function endlessFixture(): Promise<Fixture> {
  const input = await fixture();
  const profile = present(input.profiles[0]).profile;
  // A short, explicitly configured fixture still uses native boss kills,
  // rewards and recovery to exercise the target's zero-time next-stage entry.
  profile.id = "collector-endless-fixture";
  profile.payload.player.hp = 10;
  profile.payload.stageRules = [
    {
      from: 1,
      to: 7,
      stage: { bossAt: 0, bossHp: 1, enemyCount: 0, supportCount: 0, damage: 0 },
      kindWeights: null,
      rewards: {},
    },
  ];
  const hash = await contentHash(profile);
  const record = present(input.runs[0]);
  const run: RunConfig = {
    ...record.result.config,
    mode: "endless",
    seed: 3,
    maxSeconds: 60,
    maxSteps: 7200,
  };
  record.result = runNatural(run, profile);
  if (record.result.termination !== "endless_target_reached")
    throw new Error("Expected a naturally completed short endless fixture");
  record.profileHash = hash;
  record.profileId = profile.id;
  const { seed, strategy, width, ...settings } = run;
  const config = parseExperiment({
    ...settings,
    seeds: [seed],
    validationSeeds: [],
    strategies: [strategy],
    layouts: [{ id: record.layoutId, width }],
  });
  input.cell = { ...input.cell, phase: "endless", raw: structuredClone(config), config };
  input.manifest.config = structuredClone(config);
  input.profiles = [{ hash, profile }];
  input.manifest.profiles = [{ hash, profile: structuredClone(profile), source: "fixture" }];
  return input;
}

describe("calibration evidence adoption gates", () => {
  test("canonical protocols enumerate every strategy, layout and independent seed cell", async () => {
    const phases = ["selection", "validation", "endless", "sensitivity"] as const;
    const expectedCells = [6, 6, 6, 18];
    const expectedSeeds = [100, 300, 60, 16];
    const masterSeeds = [20261022, 20261028, 20261024, 20261025];
    const allSeeds: number[][] = [];
    for (const [index, phase] of phases.entries()) {
      const raw = await Bun.file(`experiments/balance/calibration/${phase}.json`).json();
      const cells = calibrationCells(phase, raw);
      expect(cells).toHaveLength(expectedCells[index] as number);
      expect(new Set(cells.map((cell) => cell.id)).size).toBe(cells.length);
      const seeds = seedSet(masterSeeds[index] as number, expectedSeeds[index] as number);
      allSeeds.push(seeds);
      for (const cell of cells) {
        expect(cell.phase).toBe(phase);
        expect(cell.config.strategies).toHaveLength(1);
        expect(cell.config.layouts).toHaveLength(1);
        expect(cell.config.seeds).toEqual(seeds);
      }
    }
    expect(new Set(allSeeds.flat()).size).toBe(allSeeds.flat().length);
    const rejectedValidationSeeds = [
      ...seedSet(20261023, 100),
      ...seedSet(20261026, 100),
      ...seedSet(20261027, 300),
    ];
    expect(new Set([...allSeeds.flat(), ...rejectedValidationSeeds]).size).toBe(
      allSeeds.flat().length + rejectedValidationSeeds.length,
    );
  });

  test("canonical expansion rejects a missing strategy or altered sensitivity layout", async () => {
    const selection = await Bun.file("experiments/balance/calibration/selection.json").json();
    selection.strategies.pop();
    expect(() => calibrationCells("selection", selection)).toThrow();
    const sensitivity = await Bun.file("experiments/balance/calibration/sensitivity.json").json();
    sensitivity.layouts[0].width = 450;
    expect(() => calibrationCells("sensitivity", sensitivity)).toThrow();
    const validation = await Bun.file("experiments/balance/calibration/validation.json").json();
    for (const [rejectedMaster, count] of [
      [20261023, 100],
      [20261026, 100],
      [20261027, 300],
    ]) {
      validation.masterSeed = rejectedMaster;
      validation.seedCount = count;
      expect(() => calibrationCells("validation", validation)).toThrow();
    }
    validation.masterSeed = 20261028;
    validation.seedCount = 100;
    expect(() => calibrationCells("validation", validation)).toThrow();
  });

  test("a complete same-version natural cell produces recomputed group evidence", async () => {
    const output = await validate(await fixture());
    expect(output.groups).toHaveLength(1);
    expect(output.groups[0]?.summary).toMatchObject({ completed: 1, planned: 1, wins: 0 });
    expect(output.groups[0]?.summary.winRateCI95).toEqual([0, expect.any(Number)]);
    expect(output.groups[0]?.stages.find((stage) => stage.stageIndex === 0)).toMatchObject({
      entered: 1,
      cleared: 0,
      attackedRuns: 1,
    });
  });

  test("the holdout cell role accepts the CLI's unchanged raw selection cohort", async () => {
    const input = await fixture();
    const cell = { ...input.cell, phase: "validation" as const };
    await expect(
      validateCalibrationCell(cell, input.manifest, input.runs, input.profiles, input.currentCode),
    ).resolves.toBeDefined();
  });

  test("a running or incomplete batch cannot pass by retaining a successful report", async () => {
    await rejects((input) => {
      input.manifest.status = "running";
    });
    await rejects((input) => {
      input.manifest.completed = 0;
    });
    await rejects((input) => {
      input.runs = [];
    });
  });

  test("an unexpected game seed, strategy or logical layout cannot replace a missing run", async () => {
    await rejects((input) => {
      present(input.runs[0]).result.config.seed++;
    });
    await rejects((input) => {
      present(input.runs[0]).result.config.strategy = { name: "build-auto" };
    });
    await rejects((input) => {
      present(input.runs[0]).result.layout.width = 1600;
    });
  });

  test("resolved strategy tampering fails even when its name and raw configuration agree", async () => {
    await rejects((input) => {
      present(input.runs[0]).result.strategy.seed++;
    });
    await rejects((input) => {
      present(input.runs[0]).result.strategy.target.intervalSeconds = 2;
    });
  });

  test("profile identity is verified against both the manifest and each raw run", async () => {
    await rejects((input) => {
      present(input.manifest.profiles[0]).profile.payload.player.stats.damage++;
    });
    await rejects((input) => {
      present(input.runs[0]).profileHash = "b".repeat(64);
    });
    await rejects((input) => {
      present(input.runs[0]).profileId = "another-profile";
    });
  });

  test("a mismatched or internally inconsistent code fingerprint fails adoption", async () => {
    await rejects((input) => {
      input.manifest.code.fingerprint = "b".repeat(64);
    });
    await rejects((input) => {
      input.manifest.code.files["src/game/world.ts"] = "b".repeat(64);
    });
    await rejects((input) => {
      input.manifest.code.bunVersion = "different-runtime";
    });
  });

  test("null numeric placeholders and explicitly invalid metrics cannot enter statistics", async () => {
    await rejects((input) => {
      Reflect.set(present(input.runs[0]).result.metrics, "hpLoss", null);
    });
    await rejects((input) => {
      Reflect.set(present(present(input.runs[0]).result.stages[0]).metrics, "hpLoss", null);
    });
    await rejects((input) => {
      present(input.runs[0]).result.validMetrics = false;
      present(input.runs[0]).result.invalidValues = [{ path: "metrics.hpLoss", value: "NaN" }];
    });
  });

  test("budget exhaustion, error and cancellation remain failed adoption evidence", async () => {
    for (const termination of ["budget_exhausted", "error", "cancelled"] as const)
      await rejects((input) => {
        present(input.runs[0]).result.termination = termination;
      });
  });

  test("a resolved natural result cannot fit a smaller budget by relabeling its config", async () => {
    const overSteps = await fixture();
    const originalSteps = structuredClone(present(overSteps.runs[0]).result);
    budgets(overSteps, originalSteps.steps - 1, controls.maxSeconds);
    expect(present(overSteps.runs[0]).result).toEqual({
      ...originalSteps,
      config: { ...originalSteps.config, maxSteps: originalSteps.steps - 1 },
    });
    await expect(validate(overSteps)).rejects.toThrow("Actual fixed steps exceed cell budget");

    const overSeconds = await fixture();
    const originalSeconds = structuredClone(present(overSeconds.runs[0]).result);
    const maxSeconds = originalSeconds.playerSeconds - 2e-7;
    budgets(overSeconds, controls.maxSteps, maxSeconds);
    expect(present(overSeconds.runs[0]).result).toEqual({
      ...originalSeconds,
      config: { ...originalSeconds.config, maxSeconds },
    });
    await expect(validate(overSeconds)).rejects.toThrow("Actual player seconds exceed cell budget");
  });

  test("actual steps must be integral and agree with the combat clock", async () => {
    await rejects((input) => {
      present(input.runs[0]).result.steps += 0.5;
    });
    const input = await fixture();
    present(input.runs[0]).result.steps++;
    await expect(validate(input)).rejects.toThrow("Actual player clock differs from fixed steps");
  });

  test("sub-tolerance clock roundoff at both budget boundaries is retained", async () => {
    const input = await fixture();
    const result = present(input.runs[0]).result;
    const exactSeconds = result.steps * result.fixedStep;
    budgets(input, result.steps, exactSeconds);
    const adjustment = exactSeconds + 5e-8 - result.playerSeconds;
    result.playerSeconds += adjustment;
    present(result.stages.at(-1)).playerSeconds += adjustment;
    await expect(validate(input)).resolves.toBeDefined();

    // A larger discrepancy remains invalid even when both declared budgets allow it.
    budgets(input, result.steps, controls.maxSeconds);
    result.playerSeconds += 2e-7;
    present(result.stages.at(-1)).playerSeconds += 2e-7;
    await expect(validate(input)).rejects.toThrow("Actual player clock differs from fixed steps");
  });

  test("an endless success label cannot replace missing campaign and target clears", async () => {
    const input = await fixture();
    input.cell.phase = "endless";
    input.cell.config.mode = "endless";
    input.cell.raw.mode = "endless";
    input.manifest.config.mode = "endless";
    const result = present(input.runs[0]).result;
    result.config.mode = "endless";
    result.termination = "endless_target_reached";
    result.phase = "Playing";
    result.final.hp = 1;
    result.endlessCleared = input.cell.config.endlessTarget;
    expect(result.clearedStages).toBe(0);
    await expect(validate(input)).rejects.toThrow("Inconsistent termination");
  });

  test("native endless rewards and recovery retain a right-censored target boundary", async () => {
    const input = await endlessFixture();
    const result = present(input.runs[0]).result;
    expect(result.clearedStages).toBe(6);
    expect(result.metrics.healingBySource.stage_recovery).toBeGreaterThan(0);
    const output = await validate(input);
    expect(output.groups[0]?.summary.wins).toBe(1);
    expect(output.groups[0]?.stages.find((stage) => stage.stageIndex === 5)).toMatchObject({
      entered: 1,
      observedEntries: 1,
      rightCensoredAtTarget: 0,
      cleared: 1,
      conditionalClearRate: 1,
    });
    expect(output.groups[0]?.stages.find((stage) => stage.stageIndex === 6)).toMatchObject({
      entered: 1,
      observedEntries: 0,
      rightCensoredAtTarget: 1,
      cleared: 0,
      conditionalClearRate: null,
      clearRateCI95: null,
    });
  });

  test("an already observed next stage cannot be censored as an immediate target stop", async () => {
    const input = await endlessFixture();
    const result = present(input.runs[0]).result;
    present(result.stages.at(-1)).playerSeconds += CONFIG.fixedStep;
    result.playerSeconds += CONFIG.fixedStep;
    result.steps++;
    await expect(validate(input)).rejects.toThrow("Inconsistent endless target boundary");
  });

  test("stage durations and additive metrics must reconcile with the whole run", async () => {
    for (const key of ["playerSeconds", "enemySeconds"] as const) {
      const input = await fixture();
      present(present(input.runs[0]).result.stages[0])[key] += 1;
      await expect(validate(input)).rejects.toThrow("stage totals differ");
    }
    for (const [key, source] of [
      ["enemyDamage", "damageBySource"],
      ["chestDamage", null],
      ["hpLoss", "hpLossBySource"],
      ["shieldAbsorbed", "shieldAbsorbedBySource"],
      ["healing", "healingBySource"],
      ["shieldGained", "shieldBySource"],
      ["poisonSeconds", null],
      ["woundSeconds", null],
      ["slowSeconds", null],
      ["sanctuarySeconds", null],
    ] as const) {
      const input = await fixture();
      const stage = present(present(input.runs[0]).result.stages[0]);
      stage.metrics[key] += 1;
      if (source) stage.metrics[source].extra = (stage.metrics[source].extra ?? 0) + 1;
      await expect(validate(input)).rejects.toThrow("stage totals differ");
    }
  });

  test("forged enemy-action counts fail even when all mechanic totals remain unchanged", async () => {
    const natural = await fixture();
    const original = present(natural.runs[0]).result;
    const nativeStage = present(original.stages.find((stage) => stage.enemyAttacks > 0));
    expect(nativeStage.enemyAttacks).toBe(present(nativeStage.metrics.mechanics.enemy_attack));
    await expect(validate(natural)).resolves.toBeDefined();

    for (const forgedCount of [0, nativeStage.enemyAttacks + 1]) {
      const input = await fixture();
      const result = present(input.runs[0]).result;
      const stage = present(result.stages[nativeStage.stageIndex]);
      const originalMetrics = structuredClone(result.metrics);
      const originalStageMetrics = result.stages.map((stage) => structuredClone(stage.metrics));
      stage.enemyAttacks = forgedCount;
      expect(result.metrics).toEqual(originalMetrics);
      expect(result.stages.map((stage) => stage.metrics)).toEqual(originalStageMetrics);
      expect(
        result.stages.reduce((sum, stage) => sum + (stage.metrics.mechanics.enemy_attack ?? 0), 0),
      ).toBe(present(result.metrics.mechanics.enemy_attack));
      await expect(validate(input)).rejects.toThrow("Inconsistent enemy attack counters");
    }
  });

  test("native zero-attack evidence accepts an absent or explicit zero mechanic count", async () => {
    const input = await endlessFixture();
    const next = present(present(input.runs[0]).result.stages.at(-1));
    expect(next.enemyAttacks).toBe(0);
    expect(Object.hasOwn(next.metrics.mechanics, "enemy_attack")).toBe(false);
    await expect(validate(input)).resolves.toBeDefined();
    next.metrics.mechanics.enemy_attack = 0;
    await expect(validate(input)).resolves.toBeDefined();
    Reflect.set(next.metrics.mechanics, "enemy_attack", null);
    await expect(validate(input)).rejects.toThrow();
  });

  test("source and mechanic totals must agree even when scalar totals match", async () => {
    for (const [key, scalar] of [
      ["damageBySource", "enemyDamage"],
      ["hpLossBySource", "hpLoss"],
      ["shieldAbsorbedBySource", "shieldAbsorbed"],
      ["healingBySource", "healing"],
      ["shieldBySource", "shieldGained"],
      ["mechanics", null],
    ] as const) {
      const input = await fixture();
      const result = present(input.runs[0]).result;
      const stage = present(result.stages[0]);
      result.metrics[key]["run-only"] = 1;
      stage.metrics[key]["stage-only"] = 1;
      if (scalar) {
        result.metrics[scalar] += 1;
        stage.metrics[scalar] += 1;
      }
      await expect(validate(input)).rejects.toThrow("stage totals differ");
    }
  });

  test("missing, duplicate or noncontiguous stages and null coverage counts are rejected", async () => {
    await rejects((input) => {
      present(input.runs[0]).result.stages = [];
    });
    await rejects((input) => {
      const stages = present(input.runs[0]).result.stages;
      stages.push(structuredClone(present(stages[0])));
    });
    await rejects((input) => {
      present(present(input.runs[0]).result.stages[0]).stageIndex = 2;
    });
    await rejects((input) => {
      Reflect.set(present(input.runs[0]).result.coverage.cardOffers, "force", null);
    });
  });

  test("duplicating one seed cannot satisfy a complete two-seed matrix", async () => {
    const input = await fixture();
    const seeds = [input.cell.config.seeds[0] as number, 57];
    input.cell.config.seeds = seeds;
    input.cell.raw.seeds = seeds;
    input.manifest.config.seeds = seeds;
    input.manifest.planned = 2;
    input.manifest.completed = 2;
    const duplicate = structuredClone(present(input.runs[0]));
    duplicate.id = "run-2";
    input.runs.push(duplicate);
    await expect(validate(input)).rejects.toThrow();
  });

  test("stage pressure excludes sacrifice damage from hostile HP loss", async () => {
    const input = await fixture();
    const run = present(input.runs[0]);
    const first = present(run.result.stages[0]);
    const hpLoss = first.metrics.hpLoss;
    first.metrics.hpLossBySource = { bloodpact: 4, "projectile:hexer": hpLoss - 4 };
    run.result.metrics.hpLossBySource = structuredClone(first.metrics.hpLossBySource);
    const output = await validate(input);
    const stage = output.groups[0]?.stages.find((value) => value.stageIndex === 0);
    expect(stage?.hostileHpLoss).toBeCloseTo(hpLoss - 4, 10);
    expect(stage?.bloodpactHpLoss).toBe(4);
    expect(stage?.shieldAbsorbed).toBe(first.metrics.shieldAbsorbed);
  });
});
