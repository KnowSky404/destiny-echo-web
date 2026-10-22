import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { contentHash, stableStringify } from "../src/balance-sim/encoding";
import { parseReviewCase } from "../src/balance-sim/review";
import { resolveStrategy } from "../src/balance-sim/strategies";
import type { CombatMetrics, RunResult, StageSummary } from "../src/balance-sim/types";
import type { BalanceProfile } from "../src/data/balance/model";
import { parseProfile } from "../src/data/balance/profile";
import { STAGES } from "../src/data/stages";
import { CONFIG } from "../src/game/config";
import { type ExperimentConfig, object, parseExperiment, seedSet } from "./balance-sim/config";
import { type CodeIdentity, codeIdentity, SIMULATOR_VERSION } from "./balance-sim/evidence";
import { assertFiniteData, type RecordedRun, summarize, wilson } from "./balance-sim/statistics";

export const CALIBRATION_PHASES = ["selection", "validation", "endless", "sensitivity"] as const;
export type CalibrationPhase = (typeof CALIBRATION_PHASES)[number];
export interface CalibrationCell {
  id: string;
  phase: CalibrationPhase;
  raw: unknown;
  config: ExperimentConfig;
}
export interface ExpectedProfile {
  hash: string;
  profile: BalanceProfile;
}
interface Manifest {
  schemaVersion: number;
  simulatorVersion: string;
  status: string;
  planned: number;
  completed: number;
  startedAt: string;
  finishedAt: string | null;
  config: unknown;
  profiles: ExpectedProfile[];
  code: CodeIdentity;
  command: string[];
}
const PROTOCOL = "experiments/balance/calibration";
const CELLS = "artifacts/balance/calibration-cells";
const sha = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
function nonnegative(value: unknown, label: string, integer = false): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    (integer && !Number.isSafeInteger(value))
  )
    throw new Error(`${label}: invalid metric`);
  return value;
}

// Splitting a canonical experiment cannot silently reduce its declared matrix.
export function calibrationCells(phase: CalibrationPhase, input: unknown): CalibrationCell[] {
  const raw = object(input, phase),
    config = parseExperiment(raw),
    sensitivity = phase === "sensitivity";
  const master = {
    selection: 20261022,
    validation: 20261028,
    endless: 20261024,
    sensitivity: 20261025,
  }[phase];
  const names = ["random-auto", "build-auto", "build-active"] as const;
  const strategies = sensitivity
    ? [1, 17, 97].flatMap((seed) => names.map((name) => ({ name, seed })))
    : names.map((name) => ({ name }));
  const layouts = sensitivity
    ? [
        { id: "narrow-desktop", width: 800 },
        { id: "wide-desktop", width: 2400 },
      ]
    : [
        { id: "portrait", width: 450 },
        { id: "desktop", width: 1600 },
      ];
  if (
    !same(
      config.seeds,
      seedSet(
        master,
        phase === "endless" ? 60 : sensitivity ? 16 : phase === "validation" ? 300 : 100,
      ),
    ) ||
    config.validationSeeds.length ||
    !same(config.strategies, strategies) ||
    !same(config.layouts, layouts) ||
    config.mode !== (phase === "endless" ? "endless" : "campaign") ||
    config.maxSeconds !== (phase === "endless" ? 1200 : 650) ||
    config.maxSteps !== (phase === "endless" ? 144000 : 78000) ||
    config.endlessTarget !== 2
  )
    throw new Error(`${phase}: canonical calibration matrix changed`);
  const cells = config.strategies.flatMap((strategy) =>
    config.layouts.map((layout) => {
      const id = `${phase}-${strategy.name}${strategy.seed === undefined ? "" : `-${strategy.seed}`}-${layout.id}`;
      const cellRaw = { ...raw, strategies: [strategy], layouts: [layout] };
      return { id, phase, raw: cellRaw, config: parseExperiment(cellRaw) };
    }),
  );
  if (new Set(cells.map((cell) => cell.id)).size !== cells.length)
    throw new Error("Duplicate cells");
  return cells;
}

async function validateCode(actual: CodeIdentity, expected: CodeIdentity) {
  const files = object(actual.files, "code.files");
  if (
    !Object.keys(files).length ||
    Object.values(files).some((hash) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) ||
    (await contentHash(files)) !== actual.fingerprint ||
    actual.fingerprint !== expected.fingerprint ||
    !same(files, expected.files) ||
    actual.bunVersion !== expected.bunVersion ||
    actual.fixedStep !== expected.fixedStep ||
    actual.fixedStep !== CONFIG.fixedStep ||
    typeof actual.commit !== "string" ||
    !actual.commit ||
    typeof actual.dirty !== "boolean"
  )
    throw new Error("Simulation code identity mismatch");
}
const METRIC_TOTALS = [
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
const METRIC_SOURCES = [
  "damageBySource",
  "hpLossBySource",
  "shieldAbsorbedBySource",
  "healingBySource",
  "shieldBySource",
  "mechanics",
] as const;
function equalTotals(actual: number, expected: number, label: string, message: string) {
  if (
    !Number.isFinite(actual) ||
    !Number.isFinite(expected) ||
    Math.abs(actual - expected) > 1e-7 * Math.max(1, actual, expected)
  )
    throw new Error(`${label}: ${message}`);
}
function validateMetrics(metrics: CombatMetrics, label: string) {
  for (const key of METRIC_TOTALS) nonnegative(metrics[key], `${label}.${key}`);
  for (const key of METRIC_SOURCES)
    for (const [source, value] of Object.entries(object(metrics[key], `${label}.${key}`)))
      nonnegative(value, `${label}.${key}.${source}`);
  for (const [key, sources] of [
    ["enemyDamage", "damageBySource"],
    ["hpLoss", "hpLossBySource"],
    ["shieldAbsorbed", "shieldAbsorbedBySource"],
    ["healing", "healingBySource"],
    ["shieldGained", "shieldBySource"],
  ] as const) {
    const total = Object.values(metrics[sources]).reduce((sum, value) => sum + value, 0);
    equalTotals(metrics[key], total, `${label}.${key}`, "source totals differ");
  }
}
function validateStageTotals(result: RunResult) {
  for (const key of ["playerSeconds", "enemySeconds"] as const)
    equalTotals(
      result[key],
      result.stages.reduce((sum, stage) => sum + stage[key], 0),
      `result.${key}`,
      "stage totals differ",
    );
  for (const key of METRIC_TOTALS)
    equalTotals(
      result.metrics[key],
      result.stages.reduce((sum, stage) => sum + stage.metrics[key], 0),
      `result.metrics.${key}`,
      "stage totals differ",
    );
  for (const key of METRIC_SOURCES) {
    const sources = new Set([
      ...Object.keys(result.metrics[key]),
      ...result.stages.flatMap((stage) => Object.keys(stage.metrics[key])),
    ]);
    for (const source of sources)
      equalTotals(
        result.metrics[key][source] ?? 0,
        result.stages.reduce((sum, stage) => sum + (stage.metrics[key][source] ?? 0), 0),
        `result.metrics.${key}.${source}`,
        "stage totals differ",
      );
  }
  // effectiveDps is a ratio, not an additive metric. Native stage rewards and
  // transition recovery belong to the stage recorded on each observation.
}
const selfDamage = (stage: StageSummary) => stage.metrics.hpLossBySource.bloodpact ?? 0;
const hostileDamage = (stage: StageSummary) =>
  Object.entries(stage.metrics.hpLossBySource).reduce(
    (total, [source, value]) => total + (source === "bloodpact" ? 0 : value),
    0,
  );
function stagePressure(runs: RecordedRun[]) {
  return [...new Set(runs.flatMap((run) => run.result.stages.map((s) => s.stageIndex)))]
    .sort((a, b) => a - b)
    .map((stageIndex) => {
      const entries = runs.flatMap((run) =>
        run.result.stages
          .filter((s) => s.stageIndex === stageIndex)
          .map((stage) => ({ run, stage })),
      );
      const observed = entries.filter(
        ({ run, stage }) =>
          !(
            run.result.termination === "endless_target_reached" &&
            !stage.cleared &&
            stage.playerSeconds === 0
          ),
      );
      const cleared = entries.filter(({ stage }) => stage.cleared).length;
      return {
        stageIndex,
        entered: entries.length,
        observedEntries: observed.length,
        rightCensoredAtTarget: entries.length - observed.length,
        cleared,
        conditionalClearRate: observed.length ? cleared / observed.length : null,
        clearRateCI95: wilson(cleared, observed.length),
        attackedRuns: observed.filter(({ stage }) => stage.enemyAttacks > 0).length,
        enemyAttacks: observed.reduce((sum, { stage }) => sum + stage.enemyAttacks, 0),
        hostileHpDamagedRuns: observed.filter(({ stage }) => hostileDamage(stage) > 0).length,
        shieldDamagedRuns: observed.filter(({ stage }) => stage.metrics.shieldAbsorbed > 0).length,
        hostileHpLoss: observed.reduce((sum, { stage }) => sum + hostileDamage(stage), 0),
        bloodpactHpLoss: observed.reduce((sum, { stage }) => sum + selfDamage(stage), 0),
        shieldAbsorbed: observed.reduce((sum, { stage }) => sum + stage.metrics.shieldAbsorbed, 0),
      };
    });
}

export async function validateCalibrationCell(
  cell: CalibrationCell,
  input: unknown,
  runs: RecordedRun[],
  profiles: ExpectedProfile[],
  currentCode: CodeIdentity,
) {
  const manifest = object(input, "manifest") as unknown as Manifest;
  const expectedRuns = cell.config.seeds.length * profiles.length;
  if (cell.config.strategies.length !== 1 || cell.config.layouts.length !== 1)
    throw new Error("Expected one strategy and layout per cell");
  if (
    manifest.schemaVersion !== 1 ||
    manifest.simulatorVersion !== SIMULATOR_VERSION ||
    manifest.status !== "complete" ||
    !manifest.finishedAt ||
    !Number.isFinite(Date.parse(manifest.startedAt)) ||
    !Number.isFinite(Date.parse(manifest.finishedAt)) ||
    Date.parse(manifest.finishedAt) < Date.parse(manifest.startedAt) ||
    manifest.planned !== expectedRuns ||
    manifest.completed !== expectedRuns ||
    runs.length !== expectedRuns
  )
    throw new Error(`${cell.id}: incomplete cell`);
  if (!same(parseExperiment(manifest.config), cell.config))
    throw new Error("Experiment configuration mismatch");
  if (
    !Array.isArray(manifest.profiles) ||
    manifest.profiles.length !== profiles.length ||
    new Set(manifest.profiles.map((p) => p.hash)).size !== profiles.length
  )
    throw new Error("Profile matrix mismatch");
  for (const [index, entry] of manifest.profiles.entries()) {
    const expected = profiles[index],
      profile = parseProfile(entry.profile);
    if (
      !expected ||
      entry.hash !== expected.hash ||
      (await contentHash(profile)) !== entry.hash ||
      !same(profile, expected.profile)
    )
      throw new Error("Profile fingerprint mismatch");
  }
  await validateCode(object(manifest.code, "code") as unknown as CodeIdentity, currentCode);
  if (
    !Array.isArray(manifest.command) ||
    manifest.command[1] !== (profiles.length === 2 ? "compare" : "simulate")
  )
    throw new Error("Wrong simulator command");
  const ids = new Set<string>(),
    seen = new Set<string>();
  for (const run of runs) {
    object(run, "record");
    const profile = profiles.find((p) => p.hash === run.profileHash);
    if (
      !profile ||
      run.profileId !== profile.profile.id ||
      run.profileName !== profile.profile.name ||
      typeof run.id !== "string" ||
      !run.id ||
      ids.has(run.id)
    )
      throw new Error("Invalid record identity");
    ids.add(run.id);
    nonnegative(run.wallTimeMs, "wallTimeMs");
    parseReviewCase({
      schemaVersion: 1,
      kind: "balance-simulator-case",
      simulatorVersion: SIMULATOR_VERSION,
      profile: profile.profile,
      profileHash: profile.hash,
      code: manifest.code,
      run: run.result.config,
      expected: run.result,
      expectedHash: "0".repeat(64),
    });
    const steps = nonnegative(run.result.steps, "result.steps", true),
      playerSeconds = nonnegative(run.result.playerSeconds, "result.playerSeconds");
    if (steps > cell.config.maxSteps) throw new Error("Actual fixed steps exceed cell budget");
    if (playerSeconds > cell.config.maxSeconds + 1e-7)
      throw new Error("Actual player seconds exceed cell budget");
    // Native reward actions do not advance combat time; every counted update
    // advances World.elapsed by exactly the validated fixed step, modulo roundoff.
    if (Math.abs(playerSeconds - steps * run.result.fixedStep) > 1e-7)
      throw new Error("Actual player clock differs from fixed steps");
    if (
      !run.result.validMetrics ||
      run.result.invalidValues.length ||
      ![
        "death",
        cell.config.mode === "campaign" ? "campaign_victory" : "endless_target_reached",
      ].includes(run.result.termination)
    )
      throw new Error("Unresolved or invalid run");
    if (!same(resolveStrategy(run.result.config.strategy), run.result.strategy))
      throw new Error("Resolved strategy mismatch");
    const key = stableStringify([
      run.profileHash,
      run.result.config.strategy,
      run.result.config.width,
      run.result.config.seed,
    ]);
    if (seen.has(key)) throw new Error("Duplicate sample");
    seen.add(key);
    validateMetrics(run.result.metrics, "result.metrics");
    for (const field of [
      "cardOffers",
      "cardSelections",
      "trainingOffers",
      "trainingSelections",
      "automaticTrainings",
      "fallbackOffers",
    ] as const)
      for (const [key, value] of Object.entries(
        object(run.result.coverage[field], `coverage.${field}`),
      ))
        nonnegative(value, `coverage.${field}.${key}`, true);
    for (const field of ["emptyRewards", "targetDecisions"] as const)
      nonnegative(run.result.coverage[field], `coverage.${field}`, true);
    if (
      (run.result.termination === "death" &&
        (run.result.phase !== "GameOver" || run.result.final.hp !== 0)) ||
      (run.result.termination === "campaign_victory" &&
        (run.result.phase !== "Victory" || run.result.clearedStages !== STAGES.length)) ||
      (run.result.termination === "endless_target_reached" &&
        (run.result.endlessCleared !== cell.config.endlessTarget ||
          run.result.clearedStages !== STAGES.length + cell.config.endlessTarget ||
          run.result.phase !== "Playing")) ||
      (run.result.termination !== "death" && run.result.final.hp <= 0)
    )
      throw new Error("Inconsistent termination");
    const stageIds = new Set<number>();
    if (!run.result.stages.length) throw new Error("Missing stage evidence");
    for (const [index, stage] of run.result.stages.entries()) {
      if (stageIds.has(stage.stageIndex)) throw new Error("Duplicate stage");
      if (
        stage.stageIndex !== index ||
        stage.endless !== index >= 4 ||
        (index > 0 && !run.result.stages[index - 1]?.cleared) ||
        (stage.cleared && (!stage.clear || !stage.postReward))
      )
        throw new Error("Inconsistent stage progression");
      stageIds.add(stage.stageIndex);
      for (const key of [
        "playerSeconds",
        "enemySeconds",
        "arrivals",
        "enemyAttacks",
        "peakEnemies",
        "pendingSummonsPeak",
        "spawned",
      ] as const)
        nonnegative(stage[key], `stage.${key}`, !key.endsWith("Seconds"));
      validateMetrics(stage.metrics, `stage[${stage.stageIndex}].metrics`);
    }
    if (
      run.result.stages.filter((stage) => stage.cleared).length !== run.result.clearedStages ||
      (run.result.termination === "death" &&
        run.result.deathStage !== run.result.stages.at(-1)?.stageIndex)
    )
      throw new Error("Stage outcomes differ from termination");
    if (run.result.termination === "endless_target_reached") {
      const next = run.result.stages.at(-1);
      if (
        !next ||
        run.result.stages.length !== run.result.clearedStages + 1 ||
        next.stageIndex !== run.result.clearedStages ||
        next.cleared ||
        next.playerSeconds !== 0 ||
        next.enemySeconds !== 0
      )
        throw new Error("Inconsistent endless target boundary");
    }
    validateStageTotals(run.result);
  }
  // Reuse full config/seed/cohort/strategy/arena checks; never trust summary.json.
  const summary = summarize(
    runs,
    cell.config,
    profiles.map(({ hash, profile }) => ({ hash, name: profile.name })),
  );
  assertFiniteData(summary);
  if (
    summary.integrityErrors.length ||
    summary.completed !== expectedRuns ||
    summary.groups.some((g) => g.completed !== g.planned || g.unresolvedRatio !== 0)
  )
    throw new Error("Invalid group matrix");
  return {
    id: cell.id,
    phase: cell.phase,
    planned: expectedRuns,
    completed: runs.length,
    groups: summary.groups.map((g) => ({
      profileHash: g.profileHash,
      profile: g.profile,
      strategy: g.strategy,
      layoutId: g.layoutId,
      width: g.width,
      rawCohort: g.cohort,
      summary: {
        planned: g.planned,
        completed: g.completed,
        wins: g.wins,
        counts: g.counts,
        winRate: g.winRate,
        winRateCI95: g.winRateCI95,
        playerSeconds: g.playerSeconds,
        finalHpWinners: g.finalHpWinners,
        combatTotals: g.combatTotals,
      },
      stages: stagePressure(runs.filter((run) => run.profileHash === g.profileHash)),
    })),
  };
}

const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
export async function prepareCalibrationInputs(
  directory = "artifacts/balance/calibration-inputs",
  protocolRoot = PROTOCOL,
  cellsRoot = CELLS,
) {
  const cells: CalibrationCell[] = [];
  for (const phase of CALIBRATION_PHASES)
    cells.push(
      ...calibrationCells(
        phase,
        JSON.parse(await readFile(join(protocolRoot, `${phase}.json`), "utf8")),
      ),
    );
  await mkdir(dirname(resolve(directory)), { recursive: true });
  await mkdir(directory);
  const commands = [];
  for (const cell of cells) {
    const file = join(directory, `${cell.id}.json`);
    await writeFile(file, `${JSON.stringify(cell.raw, null, 2)}\n`, { flag: "wx" });
    const args =
      cell.phase === "selection" || cell.phase === "validation"
        ? `balance:compare --baseline ${quote(join(protocolRoot, "baseline.json"))} --candidate ${quote("src/data/balance/official.json")}`
        : "balance:simulate --profile official";
    commands.push({
      id: cell.id,
      phase: cell.phase,
      file,
      command: `bun run ${args} --experiment ${quote(file)} --out ${quote(join(cellsRoot, cell.id))}`,
    });
  }
  return { schemaVersion: 1, inputs: directory, cells: commands };
}

export async function collectCalibrationPhase(options: {
  phase: CalibrationPhase;
  cellsRoot?: string;
  protocolRoot?: string;
  baselinePath?: string;
  candidatePath?: string;
}) {
  const { phase, cellsRoot = CELLS, protocolRoot = PROTOCOL } = options,
    canonicalPath = join(protocolRoot, `${phase}.json`);
  const canonicalBytes = await readFile(canonicalPath);
  const cells = calibrationCells(phase, JSON.parse(canonicalBytes.toString())),
    currentCode = await codeIdentity();
  const paths =
    phase === "selection" || phase === "validation"
      ? [
          options.baselinePath ?? join(protocolRoot, "baseline.json"),
          options.candidatePath ?? "src/data/balance/official.json",
        ]
      : [options.candidatePath ?? "src/data/balance/official.json"];
  const profiles = await Promise.all(
    paths.map(async (path) => {
      const bytes = await readFile(path),
        profile = parseProfile(JSON.parse(bytes.toString()));
      return { path, profile, hash: await contentHash(profile), fileSha256: sha(bytes) };
    }),
  );
  const actual = (await readdir(cellsRoot, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && e.name.startsWith(`${phase}-`))
    .map((e) => e.name)
    .sort();
  if (!same(actual, cells.map((c) => c.id).sort()))
    throw new Error(`${phase}: missing or unexpected cell directories`);
  const evidence = [];
  for (const cell of cells) {
    const directory = join(cellsRoot, cell.id),
      manifestBytes = await readFile(join(directory, "manifest.json"));
    const manifest = JSON.parse(manifestBytes.toString()) as Manifest,
      runsBytes = await readFile(join(directory, "runs.jsonl")),
      text = runsBytes.toString();
    if (!text.endsWith("\n")) throw new Error(`${cell.id}: truncated runs.jsonl`);
    const lines = text.trimEnd().split("\n");
    if (lines.some((line) => !line.trim())) throw new Error("Blank run record");
    const runs = lines.map((line) => JSON.parse(line) as RecordedRun),
      profileFileHashes: Record<string, string> = {};
    for (const profile of profiles) {
      const bytes = await readFile(join(directory, "profiles", `${profile.hash}.json`));
      if (!same(parseProfile(JSON.parse(bytes.toString())), profile.profile))
        throw new Error("Saved profile mismatch");
      profileFileHashes[profile.hash] = sha(bytes);
    }
    const result = await validateCalibrationCell(cell, manifest, runs, profiles, currentCode);
    evidence.push({
      ...result,
      provenance: {
        directory,
        manifestSha256: sha(manifestBytes),
        runsSha256: sha(runsBytes),
        profileFileHashes,
        commit: manifest.code.commit,
        dirty: manifest.code.dirty,
        finishedAt: manifest.finishedAt,
      },
    });
  }
  if ((await codeIdentity()).fingerprint !== currentCode.fingerprint)
    throw new Error("Simulation code changed during collection");
  const report = {
    schemaVersion: 1,
    kind: "calibration-cell-evidence",
    phase,
    simulatorVersion: SIMULATOR_VERSION,
    collectorSha256: sha(await readFile(import.meta.path)),
    canonical: { path: canonicalPath, sha256: sha(canonicalBytes) },
    code: currentCode,
    profiles: profiles.map(({ path, hash, fileSha256 }) => ({ path, hash, fileSha256 })),
    planned: evidence.reduce((n, c) => n + c.planned, 0),
    completed: evidence.reduce((n, c) => n + c.completed, 0),
    cells: evidence,
  };
  assertFiniteData(report);
  return report;
}

if (import.meta.main) {
  const [command, ...args] = Bun.argv.slice(2),
    values: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i],
      value = args[i + 1];
    if (
      !key ||
      !["--inputs", "--protocol", "--cells", "--phase", "--out"].includes(key) ||
      !value ||
      value.startsWith("--") ||
      values[key] !== undefined
    )
      throw new Error("Expected distinct option/value pairs");
    values[key] = value;
  }
  const phase = values["--phase"];
  if (command !== "prepare" && command !== "collect")
    throw new Error("Use prepare [--inputs NEW_DIR] or collect --phase PHASE");
  if (command === "collect" && !CALIBRATION_PHASES.includes(phase as CalibrationPhase))
    throw new Error("Valid --phase required");
  const result =
    command === "prepare"
      ? await prepareCalibrationInputs(values["--inputs"], values["--protocol"], values["--cells"])
      : await collectCalibrationPhase({
          phase: phase as CalibrationPhase,
          cellsRoot: values["--cells"],
          protocolRoot: values["--protocol"],
        });
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (values["--out"]) await writeFile(values["--out"], text, { flag: "wx" });
  else console.log(text.trimEnd());
}
