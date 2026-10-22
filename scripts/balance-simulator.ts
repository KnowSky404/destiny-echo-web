import { appendFile, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { contentHash, stableStringify } from "../src/balance-sim/encoding";
import { runNatural, validateRunConfig } from "../src/balance-sim/runner";
import { resolveStrategy } from "../src/balance-sim/strategies";
import type { RunConfig } from "../src/balance-sim/types";
import type { BalanceProfile } from "../src/data/balance/model";
import { officialProfile, parseProfile } from "../src/data/balance/profile";
import { CONFIG } from "../src/game/config";
import {
  type ExperimentConfig,
  integer,
  keys,
  object,
  parseExperiment,
  preset,
  seedSet,
} from "./balance-sim/config";
import {
  caseDocument,
  codeIdentity,
  readCase,
  readJson,
  SIMULATOR_VERSION,
} from "./balance-sim/evidence";
import {
  markdownReport,
  pairedComparison,
  type RecordedRun,
  stagesCsv,
  summarize,
  won,
} from "./balance-sim/statistics";
import { parameterDiff, parseSweep, sweepCandidates } from "./balance-sim/sweep";

const HELP = `Balance Simulator V1 — 开发专用自然对局实验，永不应用正式数值。
bun run balance:simulate --profile official --preset smoke --out artifacts/balance/smoke
bun run balance:simulate --profile official --preset standard --out artifacts/balance/baseline
bun run balance:compare --baseline official --candidate experiments/balance/example-candidate.json --preset smoke --out artifacts/balance/compare
bun run balance:sweep --experiment experiments/balance/sweep.json --out artifacts/balance/sweep
bun run balance:replay --case artifacts/balance/smoke/cases/campaign_victory.json

simulate | compare | sweep | replay
--help                          显示本帮助
--profile FILE|official          默认 officialProfile() 完整正式快照
--baseline FILE|official         比较/扫描基线，默认 official
--candidate FILE                比较候选，原样使用 PRE 导出格式
--experiment FILE               配置；sweep 文件含 {profile,experiment,sweep}
--preset smoke|standard|deep     每策略×布局 2/100/500 种子；默认smoke
--out DIR                       必须为尚不存在的输出目录（防止覆盖）
--seeds 1,2,3                   明确去重uint32种子列表
--seed-count N --master-seed N   固定主种子产生去重种子，需同时提供
--max-runs N                    总局数硬上限，含扫描验证集
--max-seconds N --max-steps N    单局玩家侧模拟时长/固定步数预算
--mode campaign|endless          默认campaign；endless先自然完成四关
--endless-target N              已清无尽层数目标，默认2，不是永久通关
--trace                         为每局记录有采样/容量上限的详细轨迹
--case FILE                     精确复现完整case，校验代码/方案/结果指纹

SIGINT/SIGTERM：当前同步对局完成后保存，下一局记cancelled，其余记缺失；manifest标记interrupted。
正常死亡/预算耗尽/统计告警退出0；运行/数据完整性错误退出1；中断退出130。
输出manifest.json、profiles/、runs.jsonl、stages.csv、summary.json、report.md、cases/。
策略和逻辑布局分组；standard默认每方案600局，不代表真人胜率。`;
interface Options {
  [key: string]: string | boolean;
}
function options(argv: string[]): { command: string; options: Options } {
  const command = argv.shift() ?? "help",
    result: Options = {};
  const valued = [
    "profile",
    "baseline",
    "candidate",
    "experiment",
    "preset",
    "out",
    "seeds",
    "seed-count",
    "master-seed",
    "max-runs",
    "max-seconds",
    "max-steps",
    "mode",
    "endless-target",
    "case",
  ];
  while (argv.length) {
    const arg = argv.shift() as string;
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument ${arg}`);
    const key = arg.slice(2);
    if (Object.hasOwn(result, key)) throw new Error(`Duplicate --${key}`);
    if (key === "help" || key === "trace") {
      result[key] = true;
      continue;
    }
    if (!valued.includes(key)) throw new Error(`Unknown --${key}`);
    const value = argv.shift();
    if (!value || value.startsWith("--")) throw new Error(`--${key} requires a value`);
    result[key] = value;
  }
  return { command, options: result };
}
function textOption(opts: Options, key: string, fallback?: string): string | undefined {
  return typeof opts[key] === "string" ? (opts[key] as string) : fallback;
}
async function loadProfile(source: string): Promise<BalanceProfile> {
  return source === "official" ? officialProfile() : parseProfile(await readJson(source));
}
async function json(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
async function atomicJson(path: string, value: unknown) {
  await json(`${path}.tmp`, value);
  await rename(`${path}.tmp`, path);
}
function configFrom(opts: Options, input: unknown): ExperimentConfig {
  let config = parseExperiment(input, preset(textOption(opts, "preset", "smoke") as string));
  const update: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    "max-runs": "maxRuns",
    "max-seconds": "maxSeconds",
    "max-steps": "maxSteps",
    "endless-target": "endlessTarget",
  };
  for (const [option, field] of Object.entries(mapping))
    if (opts[option] !== undefined) update[field] = Number(opts[option]);
  if (opts.seeds !== undefined)
    update.seeds = String(opts.seeds)
      .split(",")
      .map((s) => {
        if (!s.trim()) throw new Error("Empty seed");
        return Number(s);
      });
  if (opts["seed-count"] !== undefined || opts["master-seed"] !== undefined) {
    if (opts.seeds !== undefined) throw new Error("Use --seeds OR --seed-count/--master-seed");
    update.seeds = seedSet(
      integer(Number(opts["master-seed"]), "masterSeed", 0, 0xffffffff),
      integer(Number(opts["seed-count"]), "seedCount", 1, 10000),
    );
  }
  if (opts.mode !== undefined) update.mode = opts.mode;
  if (opts.trace === true) update.trace = true;
  config = parseExperiment({ ...config, ...update });
  for (const strategy of config.strategies) resolveStrategy(strategy);
  if (
    new Set(config.strategies.map((strategy) => stableStringify(resolveStrategy(strategy))))
      .size !== config.strategies.length
  )
    throw new Error("Duplicate resolved strategies");
  return config;
}
function runConfig(
  config: ExperimentConfig,
  seed: number,
  width: number,
  strategy: RunConfig["strategy"],
): RunConfig {
  return {
    seed,
    width,
    strategy,
    mode: config.mode,
    maxSteps: config.maxSteps,
    maxSeconds: config.maxSeconds,
    endlessTarget: config.endlessTarget,
    trace: config.trace,
    sampleIntervalSeconds: config.sampleIntervalSeconds,
    traceCapacity: config.traceCapacity,
    deathWindowSeconds: config.deathWindowSeconds,
    eventCapacity: config.eventCapacity,
  };
}
async function replay(path: string) {
  const doc = await readCase(path);
  if (doc.kind !== "balance-simulator-case") throw new Error("Replay needs a case, not a summary");
  const code = await codeIdentity();
  if (
    code.fingerprint !== doc.code.fingerprint ||
    code.bunVersion !== doc.code.bunVersion ||
    code.fixedStep !== doc.code.fixedStep
  )
    throw new Error("Code fingerprint, Bun version or fixed step differs; exact replay refused");
  const result = runNatural(doc.run as unknown as RunConfig, doc.profile);
  if ((await contentHash(result)) !== doc.expectedHash)
    throw new Error(
      `Replay mismatch: expected ${doc.expected.termination}, got ${result.termination}`,
    );
  console.log(
    `精确复现通过：seed=${doc.run.seed} width=${doc.run.width} ${doc.run.strategy.name} ${result.termination}，关键事件与完整确定性摘要一致。`,
  );
  if (code.commit !== doc.code.commit || code.dirty !== doc.code.dirty)
    console.log("Git提交/dirty元数据不同；模拟代码内容指纹一致。");
}
interface ProfileEntry {
  profile: BalanceProfile;
  hash: string;
  source: string;
}
interface Job {
  entry: ProfileEntry;
  cohort: "selection" | "validation";
  seed: number;
  width: number;
  layoutId: string;
  strategy: RunConfig["strategy"];
}
async function main() {
  const { command, options: opts } = options(process.argv.slice(2));
  if (opts.help || command === "help" || command === "--help") {
    console.log(HELP);
    return;
  }
  if (!["simulate", "compare", "sweep", "replay"].includes(command))
    throw new Error(`Unknown command ${command}`);
  if (command === "replay") {
    if (Object.keys(opts).some((key) => key !== "case"))
      throw new Error("replay accepts only --case");
    const file = textOption(opts, "case");
    if (!file) throw new Error("--case is required");
    await replay(file);
    return;
  }
  if (opts.case !== undefined) throw new Error("--case only applies to replay");
  if (command !== "compare" && opts.candidate !== undefined)
    throw new Error("--candidate only applies to compare");
  if (command === "simulate" && opts.baseline !== undefined)
    throw new Error("--baseline only applies to compare/sweep");
  const out = textOption(opts, "out") ?? "";
  if (!out) throw new Error("--out is required");
  const input = textOption(opts, "experiment")
    ? await readJson(textOption(opts, "experiment") as string)
    : {};
  let experimentInput = input;
  let sweepInput: unknown;
  let profileSource = textOption(
    opts,
    command === "simulate" ? "profile" : "baseline",
    "official",
  ) as string;
  if (command === "sweep") {
    const envelope = object(input, "sweep experiment");
    keys(envelope, ["profile", "experiment", "sweep"], "sweep experiment");
    if (envelope.profile !== undefined) {
      if (opts.baseline !== undefined && opts.baseline !== envelope.profile)
        throw new Error("Conflicting --baseline and sweep profile; specify one source");
      if (typeof envelope.profile !== "string")
        throw new Error("sweep profile: expected path or official");
      profileSource = envelope.profile;
    }
    experimentInput = envelope.experiment ?? {};
    sweepInput = envelope.sweep;
  }
  const config = configFrom(opts, experimentInput);
  const baseline = await loadProfile(profileSource),
    entries: ProfileEntry[] = [
      { profile: baseline, hash: await contentHash(baseline), source: profileSource },
    ];
  let changes: unknown[] = [];
  if (command === "compare") {
    const file = textOption(opts, "candidate");
    if (!file) throw new Error("--candidate is required");
    const profile = await loadProfile(file);
    entries.push({ profile, hash: await contentHash(profile), source: file });
    changes = parameterDiff(baseline.payload, profile.payload);
  }
  if (command === "sweep") {
    const candidates = sweepCandidates(baseline, parseSweep(sweepInput));
    if (!candidates.length)
      throw new Error("All sweep candidates were unchanged after validation/rounding");
    for (const candidate of candidates) {
      entries.push({
        profile: candidate.profile,
        hash: await contentHash(candidate.profile),
        source: "generated-one-factor",
      });
      changes.push({ profile: candidate.profile.id, changes: candidate.changes });
    }
    if (!config.validationSeeds.length) throw new Error("sweep needs independent validationSeeds");
  }
  if (new Set(entries.map((entry) => entry.hash)).size !== entries.length)
    throw new Error("Duplicate profile content");
  if (command !== "simulate" && opts.profile !== undefined)
    throw new Error("--profile applies only to simulate; use --baseline for compare/sweep");
  for (const strategy of config.strategies)
    for (const layout of config.layouts)
      validateRunConfig(runConfig(config, config.seeds[0] as number, layout.width, strategy));
  const selectionCount =
    entries.length * config.seeds.length * config.strategies.length * config.layouts.length;
  const validationCount =
    command === "sweep"
      ? 2 * config.validationSeeds.length * config.strategies.length * config.layouts.length
      : 0;
  const planned = selectionCount + validationCount;
  if (planned > config.maxRuns)
    throw new Error(`Planned ${planned} exceeds maxRuns=${config.maxRuns}; nothing executed`);
  console.log(
    `计划：方案${entries.length}（候选${entries.length - 1}） × 种子${config.seeds.length} × 策略${config.strategies.length} × 布局${config.layouts.length}；验证队列${validationCount}；总${planned}，硬上限${config.maxRuns}。`,
  );
  console.log(
    `单局固定步长${CONFIG.fixedStep}s，预算${config.maxSeconds}s/${config.maxSteps}步；输出${out}`,
  );
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out);
  await mkdir(join(out, "profiles"));
  await mkdir(join(out, "cases"));
  const code = await codeIdentity();
  const manifest = {
    schemaVersion: 1,
    simulatorVersion: SIMULATOR_VERSION,
    command: process.argv.slice(1),
    code,
    config,
    profiles: entries,
    changes,
    planned,
    completed: 0,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null as string | null,
    selectedCandidate: null as string | null,
  };
  const manifestFile = join(out, "manifest.json");
  await atomicJson(manifestFile, manifest);
  for (const entry of entries)
    await json(join(out, "profiles", `${entry.hash}.json`), entry.profile);
  await writeFile(join(out, "runs.jsonl"), "");
  const runs: RecordedRun[] = [];
  let interrupted = false;
  const onSignal = () => {
    interrupted = true;
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  const caseKinds = new Set<string>();
  function jobs(profiles: ProfileEntry[], cohort: "selection" | "validation"): Job[] {
    const seeds = cohort === "selection" ? config.seeds : config.validationSeeds;
    return profiles.flatMap((entry) =>
      config.strategies.flatMap((strategy) =>
        config.layouts.flatMap((layout) =>
          seeds.map((seed) => ({
            entry,
            cohort,
            seed,
            width: layout.width,
            layoutId: layout.id,
            strategy,
          })),
        ),
      ),
    );
  }
  async function execute(list: Job[]) {
    for (const job of list) {
      await Bun.sleep(0);
      const cfg = runConfig(config, job.seed, job.width, job.strategy),
        start = performance.now();
      const result = runNatural(cfg, job.entry.profile, { isCancelled: () => interrupted });
      const record: RecordedRun = {
        id: `run-${runs.length + 1}`,
        cohort: job.cohort,
        profileHash: job.entry.hash,
        profileId: job.entry.profile.id,
        profileName: job.entry.profile.name,
        layoutId: job.layoutId,
        wallTimeMs: performance.now() - start,
        result,
      };
      await appendFile(join(out, "runs.jsonl"), `${JSON.stringify(record)}\n`);
      if (!caseKinds.has(result.termination) && caseKinds.size < 6) {
        await json(
          join(out, "cases", `${result.termination}.json`),
          await caseDocument(job.entry.profile, job.entry.hash, code, cfg, result),
        );
        caseKinds.add(result.termination);
      }
      // Keep bounded summaries; only one live World and at most six full case files. Raw decisions/events are on disk.
      runs.push({
        ...record,
        result: { ...result, rewards: [], events: [], deathWindow: [], trace: [] },
      });
      manifest.completed = runs.length;
      await atomicJson(manifestFile, manifest);
      if (runs.length === 1 || runs.length % 10 === 0 || runs.length === planned)
        console.log(
          `[${runs.length}/${planned}] ${job.cohort} ${job.entry.profile.id} ${result.strategy.name} ${job.width} seed=${job.seed} ${result.termination} ${(record.wallTimeMs / 1000).toFixed(2)}s`,
        );
      if (interrupted && result.termination === "cancelled") break;
    }
  }
  let selected: ProfileEntry | undefined;
  try {
    await execute(jobs(entries, "selection"));
    if (command === "sweep" && !interrupted) {
      selected = entries
        .slice(1)
        .map((entry) => ({
          entry,
          wins: runs.filter((run) => run.profileHash === entry.hash && won(run)).length,
        }))
        .sort((a, b) => b.wins - a.wins)[0]?.entry;
      if (!selected) throw new Error("No sweep candidate");
      manifest.selectedCandidate = selected.hash;
      console.log(
        `独立验证：候选 ${selected.profile.name}（按选择集达成目标局数排序，同分按候选顺序；非全局最优结论）`,
      );
      await execute(jobs([entries[0] as ProfileEntry, selected], "validation"));
    }
    const comparisons: unknown[] = [];
    for (const entry of entries.slice(1))
      for (const cohort of (command === "sweep" ? ["selection", "validation"] : ["selection"]) as (
        | "selection"
        | "validation"
      )[]) {
        if (cohort === "validation" && entry !== selected) continue;
        const a = runs.filter(
            (run) => run.cohort === cohort && run.profileHash === entries[0]?.hash,
          ),
          b = runs.filter((run) => run.cohort === cohort && run.profileHash === entry.hash);
        const pairs = [];
        for (const strategy of config.strategies)
          for (const layout of config.layouts) {
            const filter = (run: RecordedRun) =>
              run.result.config.width === layout.width &&
              stableStringify(run.result.config.strategy) === stableStringify(strategy);
            pairs.push({
              strategy,
              width: layout.width,
              ...pairedComparison(a.filter(filter), b.filter(filter)),
            });
          }
        comparisons.push({
          cohort,
          baseline: entries[0]?.hash,
          candidate: entry.hash,
          parameterChanges: parameterDiff(baseline.payload, entry.profile.payload),
          pairs,
        });
      }
    const summary = summarize(
      runs,
      config,
      entries.map((entry) => ({ hash: entry.hash, name: entry.profile.name })),
      command === "sweep" ? ["selection", "validation"] : ["selection"],
      command === "sweep"
        ? {
            validation: selected
              ? [(entries[0] as ProfileEntry).hash, selected.hash]
              : [(entries[0] as ProfileEntry).hash, (entries[1] as ProfileEntry).hash],
          }
        : undefined,
    );
    // Validation is reserved only for the baseline and the selected candidate.
    summary.planned = planned;
    await json(join(out, "summary.json"), summary);
    await json(join(out, "comparison.json"), comparisons);
    await writeFile(join(out, "stages.csv"), stagesCsv(runs));
    await writeFile(join(out, "report.md"), markdownReport(summary, comparisons));
    const current = await codeIdentity();
    if (current.fingerprint !== code.fingerprint)
      throw new Error(
        "Simulation code changed during experiment; reports cannot be accepted as one version",
      );
    manifest.status = interrupted
      ? "interrupted"
      : summary.integrityErrors.length
        ? "failed"
        : "complete";
    manifest.finishedAt = new Date().toISOString();
    await atomicJson(manifestFile, manifest);
    console.log(
      `已保存 ${runs.length}/${planned} 局；状态 ${manifest.status}；程序错误 ${summary.integrityErrors.length}；观察告警 ${summary.warnings.length}。`,
    );
    if (interrupted) process.exitCode = 130;
    else if (summary.integrityErrors.length) process.exitCode = 1;
  } catch (error) {
    manifest.status = "failed";
    manifest.finishedAt = new Date().toISOString();
    await atomicJson(manifestFile, manifest);
    throw error;
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
}
try {
  await main();
} catch (error) {
  console.error(
    `Balance Simulator error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
