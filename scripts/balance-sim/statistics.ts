import { stableStringify } from "../../src/balance-sim/encoding";
import { resolveStrategy } from "../../src/balance-sim/strategies";
import type { RunResult, StrategyConfig, Termination } from "../../src/balance-sim/types";
import { arenaLayout } from "../../src/game/arena";
import { CONFIG } from "../../src/game/config";
import type { ExperimentConfig } from "./config";

export interface RecordedRun {
  id: string;
  cohort: "selection" | "validation";
  profileHash: string;
  profileId: string;
  profileName: string;
  layoutId: string;
  wallTimeMs: number;
  result: RunResult;
}
export const TERMINATIONS: Termination[] = [
  "campaign_victory",
  "death",
  "endless_target_reached",
  "budget_exhausted",
  "error",
  "cancelled",
];
export function won(run: RecordedRun): boolean {
  return (
    run.result.termination === "campaign_victory" ||
    run.result.termination === "endless_target_reached"
  );
}
export function resolved(run: RecordedRun): boolean {
  return won(run) || run.result.termination === "death";
}
export function wilson(wins: number, count: number): [number, number] | null {
  if (!Number.isSafeInteger(wins) || !Number.isSafeInteger(count) || wins < 0 || count < wins)
    throw new Error("Invalid binomial counts");
  if (!count) return null;
  const z = 1.959963984540054,
    p = wins / count,
    d = 1 + (z * z) / count;
  const center = (p + (z * z) / (2 * count)) / d;
  const spread = (z * Math.sqrt((p * (1 - p)) / count + (z * z) / (4 * count * count))) / d;
  return [Math.max(0, center - spread), Math.min(1, center + spread)];
}
export function quantile(values: number[], p: number): number | null {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error("Invalid quantile");
  if (values.some((value) => !Number.isFinite(value))) throw new Error("Non-finite metric");
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * p,
    lower = Math.floor(position),
    upper = Math.ceil(position);
  return (
    (sorted[lower] as number) +
    ((sorted[upper] as number) - (sorted[lower] as number)) * (position - lower)
  );
}
const percentiles = (values: number[]) => ({
  n: values.length,
  p10: quantile(values, 0.1),
  p50: quantile(values, 0.5),
  p90: quantile(values, 0.9),
});
function totals(records: Record<string, number>[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const record of records)
    for (const [key, value] of Object.entries(record)) result[key] = (result[key] ?? 0) + value;
  return result;
}
export function groupKey(run: RecordedRun): string {
  return stableStringify([
    run.cohort,
    run.profileHash,
    run.result.strategy,
    run.result.layout.width,
  ]);
}
export function assertFiniteData(value: unknown): void {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("Non-finite report data");
  if (value && typeof value === "object")
    for (const item of Object.values(value)) assertFiniteData(item);
}
interface EmptyGroup {
  cohort: "selection" | "validation";
  profileHash: string;
  profileName: string;
  strategy: StrategyConfig;
  width: number;
  layoutId: string;
}
export function groupSummary(runs: RecordedRun[], planned: number, empty?: EmptyGroup) {
  assertFiniteData(runs);
  if (!Number.isSafeInteger(planned) || planned < 0)
    throw new Error("Invalid planned sample count");
  if (runs.some((run) => !TERMINATIONS.includes(run.result.termination)))
    throw new Error("Unknown run termination");
  const sample = runs[0];
  const arena = empty ? arenaLayout(empty.width) : null;
  const first =
    sample ??
    (empty && arena
      ? {
          ...empty,
          result: {
            strategy: resolveStrategy(empty.strategy),
            layout: {
              width: arena.width,
              height: arena.height,
              laneCount: arena.laneCount,
              capacity: arena.encounterCapacity,
            },
          },
        }
      : null);
  if (!first) throw new Error("Cannot summarize absent group without identity");
  if (runs.length > planned) throw new Error("Completed exceeds planned");
  const counts = Object.fromEntries(
    TERMINATIONS.map((key) => [key, runs.filter((run) => run.result.termination === key).length]),
  ) as Record<Termination, number>;
  const victories = runs.filter(won).length,
    finished = runs.filter(resolved).length;
  const measured = runs.filter(
    (run) => run.result.termination !== "error" && run.result.validMetrics,
  );
  const stageIds = [
    ...new Set(measured.flatMap((run) => run.result.stages.map((stage) => stage.stageIndex))),
  ].sort((a, b) => a - b);
  const stageStats = stageIds.map((index) => {
    const entries = measured.flatMap((run) =>
      run.result.stages.filter((stage) => stage.stageIndex === index),
    );
    const clears = entries.filter((stage) => stage.cleared);
    return {
      stageIndex: index,
      entered: entries.length,
      cleared: clears.length,
      conditionalClearRate: clears.length / entries.length,
      cumulativeClearRate: clears.length / runs.length,
      deaths: measured.filter((run) => run.result.deathStage === index).length,
      clearRateCI95: wilson(clears.length, entries.length),
      playerSeconds: percentiles(entries.map((stage) => stage.playerSeconds)),
      enemySeconds: percentiles(entries.map((stage) => stage.enemySeconds)),
      clearHp: percentiles(clears.flatMap((stage) => (stage.clear ? [stage.clear.hp] : []))),
      postRewardHp: percentiles(
        clears.flatMap((stage) => (stage.postReward ? [stage.postReward.hp] : [])),
      ),
      peakEnemies: percentiles(entries.map((stage) => stage.peakEnemies)),
      arrivals: entries.reduce((sum, stage) => sum + stage.arrivals, 0),
      enemyAttacks: entries.reduce((sum, stage) => sum + stage.enemyAttacks, 0),
      hpLoss: entries.reduce((sum, stage) => sum + stage.metrics.hpLoss, 0),
      shieldAbsorbed: entries.reduce((sum, stage) => sum + stage.metrics.shieldAbsorbed, 0),
      mechanics: totals(entries.map((stage) => stage.metrics.mechanics)),
    };
  });
  const offers = totals(measured.map((run) => run.result.coverage.cardOffers));
  const selections = totals(measured.map((run) => run.result.coverage.cardSelections));
  const cards = Object.keys(offers)
    .sort()
    .map((id) => ({
      id,
      offers: offers[id] ?? 0,
      selections: selections[id] ?? 0,
      selectionRate: (selections[id] ?? 0) / (offers[id] as number),
      acquiredLayers: measured.reduce((sum, run) => sum + (run.result.final.cards[id] ?? 0), 0),
      runsOffered: measured.filter((run) => (run.result.coverage.cardOffers[id] ?? 0) > 0).length,
      runsSelected: measured.filter((run) => (run.result.final.cards[id] ?? 0) > 0).length,
    }));
  const builds = totals(
    measured.map((run) =>
      Object.fromEntries(
        Object.entries(run.result.final.synergies).map(([id, count]) => [id, count >= 3 ? 1 : 0]),
      ),
    ),
  );
  return {
    cohort: first.cohort,
    profileHash: first.profileHash,
    profile: first.profileName,
    strategy: first.result.strategy,
    layoutId: first.layoutId,
    width: first.result.layout.width,
    layout: first.result.layout,
    planned,
    completed: runs.length,
    missing: Math.max(0, planned - runs.length),
    counts,
    measuredRuns: measured.length,
    resolved: finished,
    wins: victories,
    winRate: finished ? victories / finished : null,
    winRateCI95: wilson(victories, finished),
    unresolvedRatio: planned ? (planned - finished) / planned : null,
    winRateBounds: planned
      ? [victories / planned, (victories + planned - finished) / planned]
      : null,
    playerSeconds: percentiles(measured.map((run) => run.result.playerSeconds)),
    enemySeconds: percentiles(measured.map((run) => run.result.enemySeconds)),
    wallTimeMs: percentiles(measured.map((run) => run.wallTimeMs)),
    finalHpAll: percentiles(measured.map((run) => run.result.final.hp)),
    finalHpWinners: percentiles(measured.filter(won).map((run) => run.result.final.hp)),
    effectiveDps: percentiles(
      measured.flatMap((run) =>
        run.result.metrics.effectiveDps === null ? [] : [run.result.metrics.effectiveDps],
      ),
    ),
    damageBySource: totals(measured.map((run) => run.result.metrics.damageBySource)),
    hpLossBySource: totals(measured.map((run) => run.result.metrics.hpLossBySource)),
    combatTotals: Object.fromEntries(
      [
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
      ].map((key) => [
        key,
        measured.reduce(
          (sum, run) => sum + (run.result.metrics[key as keyof RunResult["metrics"]] as number),
          0,
        ),
      ]),
    ),
    mechanics: totals(measured.map((run) => run.result.metrics.mechanics)),
    healingBySource: totals(measured.map((run) => run.result.metrics.healingBySource)),
    shieldBySource: totals(measured.map((run) => run.result.metrics.shieldBySource)),
    fatalSources: totals(
      runs
        .filter((run) => run.result.termination === "death")
        .map((run) => ({ [run.result.fatalSource ?? "unknown"]: 1 })),
    ),
    stages: stageStats,
    cards,
    trainingOffers: totals(measured.map((run) => run.result.coverage.trainingOffers)),
    trainingSelections: totals(measured.map((run) => run.result.coverage.trainingSelections)),
    automaticTrainings: totals(measured.map((run) => run.result.coverage.automaticTrainings)),
    fallbackOffers: totals(measured.map((run) => run.result.coverage.fallbackOffers)),
    synergyRunsAtTier3: builds,
    synergyMilestones: measured.flatMap((run) =>
      run.result.coverage.synergyMilestones.map((item) => ({
        seed: run.result.config.seed,
        ...item,
      })),
    ),
  };
}
export type GroupSummary = ReturnType<typeof groupSummary>;
function pairKey(run: RecordedRun, kind: "profile" | "strategy"): string {
  const { config, strategy } = run.result;
  return stableStringify({
    cohort: run.cohort,
    seed: config.seed,
    width: config.width,
    mode: config.mode,
    maxSteps: config.maxSteps,
    maxSeconds: config.maxSeconds,
    endlessTarget: config.endlessTarget,
    fixedStep: run.result.fixedStep,
    ...(kind === "profile" ? { strategy } : { profileHash: run.profileHash }),
  });
}
export function pairedComparison(
  a: RecordedRun[],
  b: RecordedRun[],
  kind: "profile" | "strategy" = "profile",
) {
  function index(runs: RecordedRun[]) {
    const map = new Map<string, RecordedRun>();
    for (const run of runs) {
      const key = pairKey(run, kind);
      if (map.has(key)) throw new Error(`Duplicate paired sample ${run.id}`);
      map.set(key, run);
    }
    return map;
  }
  const aa = index(a),
    bb = index(b),
    unmatchedA: string[] = [],
    unmatchedB: string[] = [];
  let bothWin = 0,
    bothLoss = 0,
    onlyA = 0,
    onlyB = 0,
    unresolvedPairs = 0;
  const differences: number[] = [];
  const metricDifferences: {
    playerSeconds: number[];
    hpLoss: number[];
    effectiveDps: number[];
    enemySeconds: number[];
    finalHp: number[];
  } = { playerSeconds: [], hpLoss: [], effectiveDps: [], enemySeconds: [], finalHp: [] };
  const divergences: { seed: number; width: number; a: string; b: string }[] = [];
  for (const [key, left] of aa) {
    const right = bb.get(key);
    if (!right) {
      unmatchedA.push(left.id);
      continue;
    }
    if (!resolved(left) || !resolved(right)) {
      unresolvedPairs++;
      continue;
    }
    const av = won(left),
      bv = won(right);
    if (av && bv) bothWin++;
    else if (!av && !bv) bothLoss++;
    else if (av) onlyA++;
    else onlyB++;
    if (av !== bv)
      divergences.push({
        seed: left.result.config.seed,
        width: left.result.config.width,
        a: left.id,
        b: right.id,
      });
    differences.push(Number(bv) - Number(av));
    if (left.result.validMetrics && right.result.validMetrics) {
      metricDifferences.playerSeconds.push(right.result.playerSeconds - left.result.playerSeconds);
      metricDifferences.enemySeconds.push(right.result.enemySeconds - left.result.enemySeconds);
      metricDifferences.hpLoss.push(right.result.metrics.hpLoss - left.result.metrics.hpLoss);
      metricDifferences.finalHp.push(right.result.final.hp - left.result.final.hp);
      if (left.result.metrics.effectiveDps !== null && right.result.metrics.effectiveDps !== null)
        metricDifferences.effectiveDps.push(
          right.result.metrics.effectiveDps - left.result.metrics.effectiveDps,
        );
    }
  }
  for (const [key, right] of bb) if (!aa.has(key)) unmatchedB.push(right.id);
  const n = differences.length,
    delta = n ? differences.reduce((sum, v) => sum + v, 0) / n : null;
  // Independent paired seeds, bounded differences [-1,1]: two-sided 95% Hoeffding interval.
  const radius = n ? Math.sqrt((2 * Math.log(40)) / n) : null;
  const deltaCI95 =
    delta === null || radius === null
      ? null
      : [Math.max(-1, delta - radius) * 100, Math.min(1, delta + radius) * 100];
  const sameRewards =
    kind === "strategy" && a[0] && b[0]
      ? stableStringify([a[0].result.strategy.reward, a[0].result.strategy.seed]) ===
        stableStringify([b[0].result.strategy.reward, b[0].result.strategy.seed])
      : null;
  return {
    kind,
    matched: aa.size - unmatchedA.length,
    resolvedPairs: n,
    unresolvedPairs,
    bothWin,
    bothLoss,
    onlyA,
    onlyB,
    deltaPercentagePoints: delta === null ? null : delta * 100,
    deltaCI95PercentagePoints: deltaCI95,
    intervalMethod: "paired Hoeffding; wide for small n",
    unmatchedA,
    unmatchedB,
    continuousDeltasResolvedPairs: Object.fromEntries(
      Object.entries(metricDifferences).map(([key, values]) => [
        key,
        {
          ...percentiles(values),
          mean: values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null,
        },
      ]),
    ),
    rewardRulesIdentical: sameRewards,
    divergences,
  };
}
export function summarize(
  runs: RecordedRun[],
  config: ExperimentConfig,
  profiles: { hash: string; name: string }[],
  cohorts: ("selection" | "validation")[] = ["selection"],
  cohortProfiles?: Partial<Record<"selection" | "validation", string[]>>,
) {
  assertFiniteData(runs);
  const seen = new Set<string>();
  for (const run of runs) {
    const actual = run.result.config;
    const strategy = resolveStrategy(actual.strategy);
    const key = stableStringify([run.cohort, run.profileHash, actual.seed, actual.width, strategy]);
    if (seen.has(key)) throw new Error("Duplicate experiment sample");
    seen.add(key);
    const layout = config.layouts.find((item) => item.width === actual.width);
    const allowedProfiles = cohortProfiles?.[run.cohort];
    if (
      !profiles.some((p) => p.hash === run.profileHash) ||
      !cohorts.includes(run.cohort) ||
      (allowedProfiles !== undefined && !allowedProfiles.includes(run.profileHash)) ||
      !layout ||
      run.layoutId !== layout.id ||
      !config.strategies.some(
        (plannedStrategy) => stableStringify(plannedStrategy) === stableStringify(actual.strategy),
      ) ||
      !(run.cohort === "selection" ? config.seeds : config.validationSeeds).includes(actual.seed) ||
      actual.mode !== config.mode ||
      actual.maxSteps !== config.maxSteps ||
      actual.maxSeconds !== config.maxSeconds ||
      actual.endlessTarget !== config.endlessTarget ||
      (actual.trace ?? false) !== config.trace ||
      (actual.sampleIntervalSeconds ?? 1) !== config.sampleIntervalSeconds ||
      (actual.traceCapacity ?? 2048) !== config.traceCapacity ||
      (actual.deathWindowSeconds ?? 8) !== config.deathWindowSeconds ||
      (actual.eventCapacity ?? 512) !== config.eventCapacity ||
      run.result.fixedStep !== CONFIG.fixedStep ||
      run.result.mode !== "natural" ||
      run.result.schemaVersion !== 1 ||
      stableStringify(strategy) !== stableStringify(run.result.strategy)
    )
      throw new Error(`Unplanned experiment sample ${run.id}`);
    const arena = arenaLayout(layout.width);
    if (
      run.result.layout.width !== arena.width ||
      run.result.layout.height !== arena.height ||
      run.result.layout.laneCount !== arena.laneCount ||
      run.result.layout.capacity !== arena.encounterCapacity
    )
      throw new Error(`Actual layout differs from experiment sample ${run.id}`);
    if (!TERMINATIONS.includes(run.result.termination))
      throw new Error(`Unknown run termination ${run.id}`);
  }
  const groups: GroupSummary[] = [];
  for (const cohort of cohorts)
    for (const profile of profiles)
      for (const strategy of config.strategies)
        for (const layout of config.layouts) {
          if (cohortProfiles?.[cohort] && !cohortProfiles[cohort]?.includes(profile.hash)) continue;
          const members = runs.filter(
            (run) =>
              run.cohort === cohort &&
              run.profileHash === profile.hash &&
              run.result.config.width === layout.width &&
              stableStringify(run.result.config.strategy) === stableStringify(strategy),
          );
          groups.push(
            groupSummary(
              members,
              cohort === "selection" ? config.seeds.length : config.validationSeeds.length,
              {
                cohort,
                profileHash: profile.hash,
                profileName: profile.name,
                strategy,
                width: layout.width,
                layoutId: layout.id,
              },
            ),
          );
        }
  const groupedCompleted = groups.reduce((sum, group) => sum + group.completed, 0);
  const groupedCounts = groups.reduce(
    (sum, group) => sum + Object.values(group.counts).reduce((count, value) => count + value, 0),
    0,
  );
  if (groupedCompleted !== runs.length || groupedCounts !== runs.length)
    throw new Error("Report sample accounting mismatch");
  const warnings: { code: string; message: string; group?: string }[] = [];
  for (const group of groups) {
    const label = `${group.cohort}/${group.profile}/${group.strategy.name}/${group.width}`;
    if (group.completed < 30)
      warnings.push({
        code: "small_sample",
        group: label,
        message: "小样本只用于诊断，不据此采用正式配置",
      });
    if (group.counts.error || group.counts.cancelled || group.missing)
      warnings.push({
        code: "incomplete",
        group: label,
        message: "存在错误、取消或缺失；不算游戏失败",
      });
    if ((group.unresolvedRatio ?? 0) > config.observations.unresolvedRatio)
      warnings.push({ code: "unresolved", group: label, message: "未决比例超过设计参考" });
    if (
      group.winRate !== null &&
      config.observations.winRate &&
      (group.winRate < config.observations.winRate[0] ||
        group.winRate > config.observations.winRate[1])
    )
      warnings.push({
        code: "win_reference",
        group: label,
        message: "通关率超出 provisional 参考区间",
      });
    if (
      config.observations.durationP90 !== undefined &&
      (group.playerSeconds.p90 ?? 0) > config.observations.durationP90
    )
      warnings.push({ code: "duration", group: label, message: "全体模拟时长 P90 超出设计参考" });
    if (
      group.stages.some((stage) => 1 - stage.conditionalClearRate > config.observations.stageDrop)
    )
      warnings.push({ code: "stage_drop", group: label, message: "存在进入后的关卡清关断崖" });
    const concentration = group.completed
      ? Math.max(0, ...Object.values(group.synergyRunsAtTier3)) / group.completed
      : 0;
    if (concentration > config.observations.buildConcentration)
      warnings.push({
        code: "build_concentration",
        group: label,
        message: "至少一种流派在多数终局构筑中达到3层；受策略与存活时间偏差影响",
      });
  }
  const strategyPairs = [];
  for (const cohort of cohorts)
    for (const profile of profiles)
      for (const layout of config.layouts) {
        const base = runs.filter(
          (run) =>
            run.cohort === cohort &&
            run.profileHash === profile.hash &&
            run.result.config.width === layout.width,
        );
        const names = [...new Set(base.map((run) => stableStringify(run.result.config.strategy)))];
        for (let i = 0; i < names.length; i++)
          for (let j = i + 1; j < names.length; j++) {
            const a = base.filter(
                (run) => stableStringify(run.result.config.strategy) === names[i],
              ),
              b = base.filter((run) => stableStringify(run.result.config.strategy) === names[j]);
            const pair = {
              cohort,
              profile: profile.name,
              width: layout.width,
              a: a[0]?.result.strategy,
              b: b[0]?.result.strategy,
              ...pairedComparison(a, b, "strategy"),
            };
            strategyPairs.push(pair);
            if (
              pair.rewardRulesIdentical &&
              Math.abs(pair.deltaPercentagePoints ?? 0) > config.observations.strategyGain * 100
            )
              warnings.push({
                code: "target_gain",
                message: `${profile.name}/${layout.width}: 相同选牌规则的目标策略差异值得复核`,
              });
          }
      }
  for (const left of groups)
    for (const right of groups)
      if (
        left.cohort === right.cohort &&
        left.profileHash === right.profileHash &&
        stableStringify(left.strategy) === stableStringify(right.strategy) &&
        left.width < right.width &&
        left.winRate !== null &&
        right.winRate !== null &&
        Math.abs(left.winRate - right.winRate) > config.observations.layoutGap
      )
        warnings.push({
          code: "layout_gap",
          message: `${left.profile}/${left.strategy.name}: 布局通关率差超过 provisional 参考`,
        });
  return {
    schemaVersion: 1 as const,
    kind: "balance-simulator-summary" as const,
    simulatorVersion: "1" as const,
    planned: groups.reduce((sum, group) => sum + group.planned, 0),
    completed: runs.length,
    counts: Object.fromEntries(
      TERMINATIONS.map((key) => [key, runs.filter((run) => run.result.termination === key).length]),
    ),
    provisional: true,
    groups,
    strategyPairs,
    warnings,
    integrityErrors: runs
      .filter((run) => run.result.termination === "error")
      .map((run) => ({ id: run.id, reason: run.result.reason })),
    limitations: [
      "自然策略表现不等于真人通关率",
      "配对种子不保证不同决策后的随机事件相同",
      "卡牌选择/流派与结果有存活时间和策略偏差，不证明因果",
      "P10/P50/P90 线性插值；零样本为null；单样本等于自身；非有限值拒收；error或validMetrics=false不参与连续/构筑统计，错误数量完整保留",
      "胜率分母仅真实胜负；上下界将预算、错误、取消及缺失视作未知，error/cancelled不算死亡",
      "effective DPS = 对敌实际扣血 / 玩家侧Playing时间；宝箱排除；只获胜者生命分布单列",
    ],
  };
}
export type Summary = ReturnType<typeof summarize>;
export function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  // Neutralize spreadsheet formulas in imported text; quote CSV delimiters correctly.
  const safe = /^[=+@-]/.test(text) && typeof value !== "number" ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
export function stagesCsv(runs: RecordedRun[]): string {
  const headers = [
    "run",
    "cohort",
    "profile",
    "profileHash",
    "strategy",
    "width",
    "stage",
    "cleared",
    "entryHp",
    "clearHp",
    "postRewardHp",
    "playerSeconds",
    "enemySeconds",
    "hpLoss",
    "shieldAbsorbed",
    "enemyDamage",
    "dps",
    "arrivals",
    "enemyAttacks",
    "peakEnemies",
    "mechanics",
  ];
  return `${[
    headers.join(","),
    ...runs.flatMap((run) =>
      run.result.stages.map((stage) =>
        [
          run.id,
          run.cohort,
          run.profileName,
          run.profileHash,
          run.result.strategy.name,
          run.result.layout.width,
          stage.stageIndex + 1,
          stage.cleared,
          stage.entry.hp,
          stage.clear?.hp,
          stage.postReward?.hp,
          stage.playerSeconds,
          stage.enemySeconds,
          stage.metrics.hpLoss,
          stage.metrics.shieldAbsorbed,
          stage.metrics.enemyDamage,
          stage.metrics.effectiveDps,
          stage.arrivals,
          stage.enemyAttacks,
          stage.peakEnemies,
          stage.metrics.mechanics,
        ]
          .map(csvCell)
          .join(","),
      ),
    ),
  ].join("\n")}\n`;
}
const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
const dec = (n: number | null) => (n === null ? "—" : n.toFixed(2));
const safeMd = (s: string) => s.replace(/[|<>\r\n`]/g, " ");
export function markdownReport(summary: Summary, comparisons: unknown[] = []): string {
  const lines = [
    "# Balance Simulator V1 实验报告",
    "",
    `计划 ${summary.planned} 局，已完成 ${summary.completed} 局。`,
    "策略是可解释测试代理，数据不等于真人通关率；阈值为 provisional 设计参考，不是行业标准。",
    "",
    "| 队列 / 方案 | 策略 | 逻辑宽度 / 车道 / 容量 | 完成/计划 | 胜/死/预算/错/取消 | 已决胜率 [Wilson 95%] | 未决 | 胜率界 | 玩家时长 P10/P50/P90 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const g of summary.groups) {
    const c = g.counts;
    lines.push(
      `| ${g.cohort} / ${safeMd(g.profile)} | ${g.strategy.name} | ${g.width}/${g.layout.laneCount}/${g.layout.capacity} | ${g.completed}/${g.planned} | ${g.wins}/${c.death}/${c.budget_exhausted}/${c.error}/${c.cancelled} | ${pct(g.winRate)} [${g.winRateCI95?.map(pct).join(", ") ?? "—"}] | ${pct(g.unresolvedRatio)} | ${g.winRateBounds?.map(pct).join("–") ?? "—"} | ${dec(g.playerSeconds.p10)}/${dec(g.playerSeconds.p50)}/${dec(g.playerSeconds.p90)} |`,
    );
  }
  lines.push(
    "",
    "## 分关卡",
    "清场生命为加分奖励/过关恢复前；领奖后生命单列。累计通过率分母为该组实际开局数。",
    "| 队列 / 方案 / 策略 / 宽度 | 关 | 进入/清关/死亡 | 条件清关率 | 累计通过率 | 清场HP P50 | 领奖后HP P50 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const g of summary.groups)
    for (const s of g.stages)
      lines.push(
        `| ${g.cohort}/${safeMd(g.profile)}/${g.strategy.name}/${g.width} | ${s.stageIndex + 1} | ${s.entered}/${s.cleared}/${s.deaths} | ${pct(s.conditionalClearRate)} | ${pct(s.cumulativeClearRate)} | ${dec(s.clearHp.p50)} | ${dec(s.postRewardHp.p50)} |`,
      );
  lines.push("", "## 压力与诊断");
  for (const g of summary.groups) {
    const sources = Object.entries(g.hpLossBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    lines.push(
      `- ${g.cohort}/${safeMd(g.profile)}/${g.strategy.name}/${g.width}：生命损失主要来源 ${sources.map(([s, v]) => `${safeMd(s)}=${v.toFixed(1)}`).join("，") || "无"}；敌方有效DPS P50 ${dec(g.effectiveDps.p50)}；致死来源 ${safeMd(JSON.stringify(g.fatalSources))}。`,
    );
  }
  lines.push(
    "",
    "## 策略配对",
    "双方均已决的配对才进入百分点差异；未决数单列，保守 Hoeffding 区间小样本会很宽。",
  );
  for (const p of summary.strategyPairs)
    lines.push(
      `- ${p.cohort}/${safeMd(p.profile)}/${p.width} ${p.a?.name}→${p.b?.name}：均胜${p.bothWin}、均败${p.bothLoss}、仅A胜${p.onlyA}、仅B胜${p.onlyB}、未决${p.unresolvedPairs}；差异 ${dec(p.deltaPercentagePoints)} 个百分点，95%区间 ${p.deltaCI95PercentagePoints?.map(dec).join("..") ?? "—"}；选牌规则相同=${p.rewardRulesIdentical}。`,
    );
  if (comparisons.length)
    lines.push(
      "",
      "## 方案配对",
      "详见 comparison.json：实际参数差异、配对输赢、百分点差异及不匹配样本均保留。",
      "```json",
      JSON.stringify(comparisons, null, 2),
      "```",
    );
  lines.push(
    "",
    "## 观察项（不阻断构建）",
    ...summary.warnings.map((w) => `- ${w.code}: ${safeMd(w.group ?? "")} ${w.message}`),
    "",
    "## 统计口径与局限",
    ...summary.limitations.map((s) => `- ${s}`),
    "- 卡牌机会、选择率、锻体与各档位达成见 summary.json；完整逐局依据见 runs.jsonl，分关见 stages.csv。",
    "- 选牌/暂停不推进战斗；遗世庇护推进玩家时钟但冻结敌方/关卡时钟。实际执行耗时单列，不能混作战斗时长。",
    "- 致死最后一击不能单独证明长期失败原因，需结合 deathWindow、分关压力与人工试玩。",
    "- 本工具不会修改 official.json、执行 balance:apply、推送或部署。",
    "",
  );
  return lines.join("\n");
}
