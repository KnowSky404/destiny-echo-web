import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { contentHash, stableStringify } from "../src/balance-sim/encoding";
import { evolutionMetrics } from "../src/balance-sim/evolution-metrics";
import type { CombatMetrics, EvolutionMetrics } from "../src/balance-sim/types";
import { CONFIG } from "../src/game/config";
import { type ExperimentConfig, object, parseExperiment } from "./balance-sim/config";
import { type CodeIdentity, codeIdentity } from "./balance-sim/evidence";
import {
  assertFiniteData,
  pairedComparison,
  quantile,
  type RecordedRun,
  summarize,
  won,
} from "./balance-sim/statistics";

const ROLES = ["minion", "elite", "boss"] as const;
const TOTALS = [
  "enemyDamage",
  "chestDamage",
  "hpLoss",
  "shieldAbsorbed",
  "healing",
  "shieldGained",
  "poisonSeconds",
  "woundSeconds",
  "slowSeconds",
  "sanctuarySeconds",
] as const;
const SOURCES = [
  "damageBySource",
  "hpLossBySource",
  "shieldAbsorbedBySource",
  "healingBySource",
  "shieldBySource",
  "mechanics",
] as const;
function nonnegative(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error(`${label}: missing or invalid numeric metric`);
  return value;
}
function equal(actual: number, expected: number, label: string): void {
  if (Math.abs(actual - expected) > 1e-7 * Math.max(1, actual, expected))
    throw new Error(`${label}: totals differ`);
}
function validateMetrics(metrics: CombatMetrics, label: string): void {
  for (const key of TOTALS) nonnegative(metrics[key], `${label}.${key}`);
  for (const key of SOURCES)
    for (const [source, value] of Object.entries(object(metrics[key], `${label}.${key}`)))
      nonnegative(value, `${label}.${key}.${source}`);
  for (const [total, source] of [
    ["enemyDamage", "damageBySource"],
    ["hpLoss", "hpLossBySource"],
    ["shieldAbsorbed", "shieldAbsorbedBySource"],
    ["healing", "healingBySource"],
    ["shieldGained", "shieldBySource"],
  ] as const)
    equal(
      metrics[total],
      Object.values(metrics[source]).reduce((sum, value) => sum + value, 0),
      `${label}.${total}`,
    );
}

function validateEvolution(metric: EvolutionMetrics, label: string): void {
  object(metric, label);
  for (const [key, value] of Object.entries(evolutionMetrics()))
    if (typeof value === "number")
      nonnegative(metric[key as keyof EvolutionMetrics], `${label}.${key}`);
  for (const role of ROLES) {
    nonnegative(metric.spawnedByRole[role], `${label}.spawnedByRole.${role}`);
    nonnegative(metric.deathsByRole[role], `${label}.deathsByRole.${role}`);
    nonnegative(metric.deathCreditByRole[role], `${label}.deathCreditByRole.${role}`);
    const ttk = metric.ttk[role];
    nonnegative(ttk.count, `${label}.ttk.${role}.count`);
    nonnegative(ttk.sum, `${label}.ttk.${role}.sum`);
    equal(ttk.count, metric.deathsByRole[role], `${label}.ttk.${role}.deaths`);
    if (!Number.isSafeInteger(ttk.count) || !Number.isSafeInteger(metric.spawnedByRole[role]))
      throw new Error(`${label}: invalid entity counts`);
    const expected = evolutionMetrics().ttk[role].buckets;
    if (!Array.isArray(ttk.buckets) || ttk.buckets.length !== expected.length)
      throw new Error(`${label}: missing TTK histogram`);
    ttk.buckets.forEach((bucket, index) => {
      if (bucket.upperSeconds !== expected[index]?.upperSeconds)
        throw new Error(`${label}: TTK histogram boundaries differ`);
      nonnegative(bucket.count, `${label}.ttk.${role}.bucket`);
      if (!Number.isSafeInteger(bucket.count)) throw new Error(`${label}: invalid histogram count`);
    });
    equal(
      ttk.count,
      ttk.buckets.reduce((sum, bucket) => sum + bucket.count, 0),
      `${label}.ttk.${role}.histogram`,
    );
    if (ttk.count) {
      nonnegative(ttk.min, `${label}.ttk.${role}.min`);
      nonnegative(ttk.max, `${label}.ttk.${role}.max`);
    } else if (ttk.min !== null || ttk.max !== null)
      throw new Error(`${label}: empty TTK bounds must be null`);
  }
  for (const [stars, count] of Object.entries(
    object(metric.spawnedByStars, `${label}.spawnedByStars`),
  ))
    if (!["1", "2", "3"].includes(stars) || !Number.isSafeInteger(count) || (count as number) < 0)
      throw new Error(`${label}: invalid native star counts`);
  equal(
    Object.values(metric.spawnedByStars).reduce((sum, count) => sum + count, 0),
    ROLES.reduce((sum, role) => sum + metric.spawnedByRole[role], 0),
    `${label}.spawnedByStars`,
  );
  for (const value of Object.values(
    object(metric.trainingScoreBySource, `${label}.trainingScoreBySource`),
  ))
    nonnegative(value, `${label}.trainingScoreBySource`);
  equal(
    metric.trainingScore,
    Object.values(metric.trainingScoreBySource).reduce((sum, value) => sum + value, 0),
    `${label}.trainingScore`,
  );
  if (metric.missingLifecycleEvents || metric.unwarnedReleases || metric.prematureReleases)
    throw new Error(`${label}: missing lifecycle or unsafe cast observations`);
}

/** Reject every unresolved sample; a natural death is a resolved gameplay outcome. */
export function auditEvolutionRuns(
  runs: RecordedRun[],
  config: ExperimentConfig,
  profile: { hash: string; name: string },
  requireTelemetry: boolean,
): ReturnType<typeof summarize> {
  assertFiniteData(runs);
  const summary = summarize(runs, config, [profile]);
  if (summary.completed !== summary.planned || summary.groups.some((group) => group.missing))
    throw new Error("Missing experiment samples");
  for (const run of runs) {
    const result = run.result;
    if (
      !result.validMetrics ||
      result.invalidValues.length ||
      !["campaign_victory", "endless_target_reached", "death"].includes(result.termination)
    )
      throw new Error(`${run.id}: invalid, cancelled, error or budget-exhausted run`);
    if (result.termination !== "death") {
      const expected = config.mode === "campaign" ? "campaign_victory" : "endless_target_reached";
      if (result.termination !== expected)
        throw new Error(`${run.id}: successful outcome does not match experiment mode`);
      if (
        typeof result.final.hp !== "number" ||
        !Number.isFinite(result.final.hp) ||
        result.final.hp <= 0
      )
        throw new Error(`${run.id}: non-death outcome requires positive final HP`);
    }
    nonnegative(result.playerSeconds, `${run.id}.playerSeconds`);
    nonnegative(result.enemySeconds, `${run.id}.enemySeconds`);
    nonnegative(result.steps, `${run.id}.steps`);
    if (!Number.isSafeInteger(result.steps)) throw new Error(`${run.id}: nonintegral fixed steps`);
    if (result.steps > config.maxSteps || result.playerSeconds > config.maxSeconds + 1e-7)
      throw new Error(`${run.id}: actual duration exceeds declared budget`);
    equal(
      result.steps * result.fixedStep,
      result.playerSeconds +
        (requireTelemetry
          ? nonnegative(result.evolution?.presentationSeconds, `${run.id}.presentationSeconds`)
          : 0),
      `${run.id}.fixedStepClock`,
    );
    if (
      result.stages.some(
        (stage, index) =>
          stage.stageIndex !== index ||
          !stage.entered ||
          (stage.cleared && (!stage.clear || !stage.postReward)),
      ) ||
      result.stages.filter((stage) => stage.cleared).length !== result.clearedStages
    )
      throw new Error(`${run.id}: inconsistent stage lifecycle`);
    if (result.termination === "death" && (result.phase !== "GameOver" || result.final.hp !== 0))
      throw new Error(`${run.id}: inconsistent death outcome`);
    if (
      result.termination === "campaign_victory" &&
      (result.phase !== "Victory" || result.clearedStages !== 4 || result.stages.length !== 4)
    )
      throw new Error(`${run.id}: inconsistent campaign outcome`);
    if (result.termination === "endless_target_reached") {
      const final = result.stages.at(-1);
      if (
        result.phase !== "Playing" ||
        result.clearedStages !== 4 + config.endlessTarget ||
        result.endlessCleared !== config.endlessTarget ||
        final?.stageIndex !== 4 + config.endlessTarget ||
        final.playerSeconds !== 0 ||
        final.enemySeconds !== 0 ||
        final.cleared
      )
        throw new Error(`${run.id}: inconsistent endless reward boundary`);
    }
    validateMetrics(result.metrics, `${run.id}.metrics`);
    for (const key of TOTALS) {
      for (const stage of result.stages) nonnegative(stage.metrics[key], `${run.id}.stage.${key}`);
      equal(
        result.metrics[key],
        result.stages.reduce((sum, stage) => sum + stage.metrics[key], 0),
        `${run.id}.${key}`,
      );
    }
    for (const key of ["playerSeconds", "enemySeconds"] as const)
      equal(
        result[key],
        result.stages.reduce(
          (sum, stage) => sum + nonnegative(stage[key], `${run.id}.stage.${key}`),
          0,
        ),
        `${run.id}.${key}`,
      );
    for (const stage of result.stages) {
      validateMetrics(stage.metrics, `${run.id}.stage.${stage.stageIndex}`);
      const enemyAttacks = nonnegative(stage.enemyAttacks, `${run.id}.enemyAttacks`);
      const mechanicAttacks =
        stage.metrics.mechanics.enemy_attack === undefined
          ? 0
          : nonnegative(stage.metrics.mechanics.enemy_attack, `${run.id}.enemy_attack`);
      if (
        !Number.isSafeInteger(enemyAttacks) ||
        !Number.isSafeInteger(mechanicAttacks) ||
        enemyAttacks !== mechanicAttacks
      )
        throw new Error(`${run.id}: enemyAttacks must exactly match nonnegative safe integers`);
    }
    if (requireTelemetry) {
      validateEvolution(result.evolution, `${run.id}.evolution`);
      for (const stage of result.stages)
        validateEvolution(stage.evolution, `${run.id}.stage.evolution`);
      equal(
        result.evolution.trainingScore,
        nonnegative(result.final.trainingScore, `${run.id}.final.trainingScore`),
        `${run.id}.trainingScore`,
      );
      for (const role of ROLES) {
        equal(
          result.evolution.spawnedByRole[role],
          result.stages.reduce((sum, stage) => sum + stage.evolution.spawnedByRole[role], 0),
          `${run.id}.spawned.${role}`,
        );
        equal(
          result.evolution.deathsByRole[role],
          result.stages.reduce((sum, stage) => sum + stage.evolution.deathsByRole[role], 0),
          `${run.id}.deaths.${role}`,
        );
        equal(
          result.evolution.deathCreditByRole[role],
          result.stages.reduce((sum, stage) => sum + stage.evolution.deathCreditByRole[role], 0),
          `${run.id}.deathCredit.${role}`,
        );
        for (const key of ["count", "sum"] as const)
          equal(
            result.evolution.ttk[role][key],
            result.stages.reduce((sum, stage) => sum + stage.evolution.ttk[role][key], 0),
            `${run.id}.ttk.${role}.${key}`,
          );
      }
      for (const key of [
        "trainingScore",
        "idleSeconds",
        "presentationSeconds",
        "castStarts",
        "castInterrupts",
        "castReleases",
      ] as const)
        equal(
          result.evolution[key],
          result.stages.reduce((sum, stage) => sum + stage.evolution[key], 0),
          `${run.id}.evolution.${key}`,
        );
      const sources = new Set([
        ...Object.keys(result.evolution.trainingScoreBySource),
        ...result.stages.flatMap((stage) => Object.keys(stage.evolution.trainingScoreBySource)),
      ]);
      for (const source of sources)
        equal(
          result.evolution.trainingScoreBySource[source] ?? 0,
          result.stages.reduce(
            (sum, stage) => sum + (stage.evolution.trainingScoreBySource[source] ?? 0),
            0,
          ),
          `${run.id}.trainingScore.${source}`,
        );
    }
  }
  return summary;
}

function mergeEvolution(target: EvolutionMetrics, source: EvolutionMetrics): void {
  for (const key of [
    "trainingScore",
    "idleSeconds",
    "presentationSeconds",
    "castStarts",
    "castInterrupts",
    "castReleases",
    "unwarnedReleases",
    "prematureReleases",
    "missingLifecycleEvents",
  ] as const)
    target[key] += source[key];
  for (const key of [
    "longestIdleSeconds",
    "maxOneSecondHpLoss",
    "maxOneSecondDamage",
    "maxOneSecondHpLossRatio",
  ] as const)
    target[key] = Math.max(target[key], source[key]);
  for (const key of ["trainingScoreBySource", "spawnedByStars"] as const)
    for (const [name, value] of Object.entries(source[key]))
      target[key][name] = (target[key][name] ?? 0) + value;
  for (const role of ROLES) {
    for (const key of ["spawnedByRole", "deathsByRole", "deathCreditByRole"] as const)
      target[key][role] += source[key][role];
    const a = target.ttk[role],
      b = source.ttk[role];
    a.count += b.count;
    a.sum += b.sum;
    if (b.min !== null) a.min = a.min === null ? b.min : Math.min(a.min, b.min);
    if (b.max !== null) a.max = a.max === null ? b.max : Math.max(a.max, b.max);
    a.buckets.forEach((bucket, index) => {
      bucket.count += b.buckets[index]?.count ?? 0;
    });
  }
}
const percentiles = (values: number[]) => ({
  n: values.length,
  p10: quantile(values, 0.1),
  p50: quantile(values, 0.5),
  p90: quantile(values, 0.9),
});
function reportGroups(runs: RecordedRun[], config: ExperimentConfig, telemetry: boolean) {
  return config.strategies.flatMap((strategy) =>
    config.layouts.map((layout) => {
      const members = runs.filter(
        (run) =>
          run.result.config.width === layout.width &&
          stableStringify(run.result.config.strategy) === stableStringify(strategy),
      );
      const successful = members.filter(won).map((run) => run.result.playerSeconds);
      const median = quantile(successful, 0.5);
      const stages = new Map<number, EvolutionMetrics>();
      if (telemetry)
        for (const run of members)
          for (const stage of run.result.stages) {
            const metric = stages.get(stage.stageIndex) ?? evolutionMetrics();
            mergeEvolution(metric, stage.evolution);
            stages.set(stage.stageIndex, metric);
          }
      return {
        strategy: strategy.name,
        width: layout.width,
        runs: members.length,
        successes: successful.length,
        deaths: members.filter((run) => run.result.termination === "death").length,
        successfulPlayerSeconds: percentiles(successful),
        durationTargetMet:
          config.mode === "campaign" && strategy.name !== "random-auto" && median !== null
            ? median >= 480 && median <= 720
            : null,
        idleSeconds: telemetry
          ? percentiles(members.map((run) => run.result.evolution.idleSeconds))
          : null,
        oneSecondHpLossRatio: telemetry
          ? percentiles(members.map((run) => run.result.evolution.maxOneSecondHpLossRatio))
          : null,
        stages: telemetry
          ? [...stages]
              .sort(([a], [b]) => a - b)
              .map(([stageIndex, evolution]) => ({ stageIndex, evolution }))
          : null,
      };
    }),
  );
}

async function fileHash(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function readEvidence(directory: string, config: ExperimentConfig, telemetry: boolean) {
  const manifestPath = join(directory, "manifest.json");
  const manifest = object(JSON.parse(await readFile(manifestPath, "utf8")), "manifest");
  if (
    manifest.status !== "complete" ||
    !manifest.finishedAt ||
    manifest.planned !== manifest.completed
  )
    throw new Error(`${directory}: evidence is incomplete`);
  const startedAt = Date.parse(String(manifest.startedAt)),
    finishedAt = Date.parse(String(manifest.finishedAt));
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt)
    throw new Error(`${directory}: invalid manifest timestamps`);
  if (stableStringify(parseExperiment(manifest.config)) !== stableStringify(config))
    throw new Error(`${directory}: experiment inputs differ`);
  if (!Array.isArray(manifest.profiles) || manifest.profiles.length !== 1)
    throw new Error(`${directory}: expected one explicit profile`);
  const entry = object(manifest.profiles[0], "profile");
  const profile = object(entry.profile, "profile snapshot");
  if ((await contentHash(profile)) !== entry.hash) throw new Error("Profile content hash differs");
  const snapshot = JSON.parse(
    await readFile(join(directory, "profiles", `${entry.hash}.json`), "utf8"),
  );
  if ((await contentHash(snapshot)) !== entry.hash)
    throw new Error("Archived profile hash differs");
  const code = manifest.code as CodeIdentity;
  if (
    !code ||
    code.fixedStep !== CONFIG.fixedStep ||
    code.bunVersion !== Bun.version ||
    !code.commit ||
    typeof code.dirty !== "boolean" ||
    !Object.keys(code.files).length ||
    Object.values(code.files).some((value) => !/^[a-f0-9]{64}$/.test(value)) ||
    (await contentHash(code.files)) !== code.fingerprint
  )
    throw new Error("Code identity is invalid");
  const runs: RecordedRun[] = [];
  const ids = new Set<string>();
  const rawPath = join(directory, "runs.jsonl");
  const lines = createInterface({
    input: createReadStream(rawPath),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const run = JSON.parse(line) as RecordedRun;
    if (
      typeof run.id !== "string" ||
      !run.id ||
      ids.has(run.id) ||
      run.profileHash !== entry.hash ||
      run.profileId !== profile.id ||
      run.profileName !== profile.name
    )
      throw new Error("Raw record identity differs from manifest");
    ids.add(run.id);
    // Preserve all measured summaries while discarding verbose arrays after each line is checked.
    assertFiniteData(run);
    runs.push({
      ...run,
      result: { ...run.result, rewards: [], events: [], deathWindow: [], trace: [] },
    });
    if (runs.length > config.maxRuns) throw new Error("Raw evidence exceeds declared run cap");
  }
  if (runs.length !== manifest.completed) throw new Error("Raw run count differs from manifest");
  const summary = auditEvolutionRuns(
    runs,
    config,
    { hash: String(entry.hash), name: String(profile.name) },
    telemetry,
  );
  return {
    directory,
    code,
    profileHash: entry.hash,
    rawHash: await fileHash(rawPath),
    manifestHash: await fileHash(manifestPath),
    summary,
    groups: reportGroups(runs, config, telemetry),
    runs,
  };
}

export async function collectEvolutionEvidence(
  candidateDirectory: string,
  config: ExperimentConfig,
) {
  const candidate = await readEvidence(resolve(candidateDirectory), config, true);
  if (candidate.code.fingerprint !== (await codeIdentity()).fingerprint)
    throw new Error("Candidate evidence does not match the current simulation code");
  const { runs: _candidateRuns, ...candidateEvidence } = candidate;
  return {
    schemaVersion: 1,
    kind: "endless-evolution-candidate-evidence",
    collectedAt: new Date().toISOString(),
    experiment: config,
    candidate: candidateEvidence,
    limitations: [
      "This report validates the declared candidate matrix only; no baseline or paired comparison is included.",
      "Historical results with different seeds or strategy versions do not constitute a paired comparison.",
      "Deterministic strategy results are not human completion rates.",
      "TTK histograms contain exact bounded bucket counts; reported buckets are not exact median TTK values. Fusion donor removals are not kills.",
      "Idle time means no living enemy or chest at the start of a Playing step; it includes designed breaks and death animations.",
      "The 480-720 second successful-campaign median is a calibration target for build strategies in each layout, not a guaranteed session duration.",
    ],
  };
}

export async function collectEvolutionComparison(
  baselineDirectory: string,
  candidateDirectory: string,
  config: ExperimentConfig,
) {
  const baseline = await readEvidence(resolve(baselineDirectory), config, false);
  const candidate = await readEvidence(resolve(candidateDirectory), config, true);
  if (candidate.code.fingerprint !== (await codeIdentity()).fingerprint)
    throw new Error("Candidate evidence does not match the current simulation code");
  const paired = pairedComparison(baseline.runs, candidate.runs, "profile");
  const { runs: _baselineRuns, ...baselineEvidence } = baseline;
  const { runs: _candidateRuns, ...candidateEvidence } = candidate;
  return {
    schemaVersion: 1,
    kind: "endless-evolution-comparison",
    collectedAt: new Date().toISOString(),
    experiment: config,
    baseline: baselineEvidence,
    candidate: candidateEvidence,
    paired,
    limitations: [
      "Deterministic strategy results are not human completion rates.",
      "Baseline and candidate have separate code/profile fingerprints; paired seeds do not imply identical later RNG histories.",
      "Baseline has no new lifecycle/cast telemetry; unavailable measurements are null, never zero.",
      "TTK histograms contain exact bounded bucket counts; reported buckets are not exact median TTK values. Fusion donor removals are not kills.",
      "Idle time means no living enemy or chest at the start of a Playing step; it includes designed breaks and death animations.",
      "The 480-720 second successful-campaign median is a calibration target for build strategies in each layout, not a guaranteed session duration.",
    ],
  };
}

async function main() {
  const args = process.argv.slice(2),
    options = new Map<string, string>();
  while (args.length) {
    const key = args.shift() as string,
      value = args.shift();
    if (
      !["--baseline", "--candidate", "--experiment", "--out"].includes(key) ||
      !value ||
      value.startsWith("--") ||
      options.has(key)
    )
      throw new Error(
        "Usage: bun scripts/endless-evolution-evidence.ts [--baseline DIR] --candidate DIR --experiment FILE --out NEW.json",
      );
    options.set(key, value);
  }
  for (const key of ["--candidate", "--experiment", "--out"])
    if (!options.has(key)) throw new Error(`Missing ${key}`);
  const config = parseExperiment(
    JSON.parse(await readFile(options.get("--experiment") as string, "utf8")),
  );
  const baselineDirectory = options.get("--baseline");
  const comparison = baselineDirectory
    ? await collectEvolutionComparison(
        baselineDirectory,
        options.get("--candidate") as string,
        config,
      )
    : undefined;
  const report =
    comparison ?? (await collectEvolutionEvidence(options.get("--candidate") as string, config));
  const out = options.get("--out") as string;
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  console.log(
    `Strict evidence accepted: ${report.candidate.summary.completed} candidate${comparison ? ` / ${comparison.baseline.summary.completed} baseline` : ""} runs; ${out}`,
  );
}
if (import.meta.main)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
