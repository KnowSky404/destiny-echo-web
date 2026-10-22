import type { BalanceProfile } from "../data/balance/model";
import { parseProfile, validateNumber } from "../data/balance/profile";
import { arenaLayout } from "../game/arena";
import { CONFIG } from "../game/config";
import { contentHash, stableStringify } from "./encoding";
import type { RunConfig, RunResult } from "./types";

export const REVIEW_CASE_KEY = "echoes:pre:balance-simulator:manual-review:v1";
export const TERMINATIONS = [
  "campaign_victory",
  "death",
  "endless_target_reached",
  "budget_exhausted",
  "error",
  "cancelled",
] as const;
export interface ReviewCase {
  schemaVersion: 1;
  kind: "balance-simulator-case";
  simulatorVersion: "1";
  profile: BalanceProfile;
  profileHash: string;
  code: Record<string, unknown> & { commit: string; dirty: boolean; fingerprint: string };
  run: RunConfig;
  expected: RunResult;
  expectedHash: string;
}
export interface ReviewSummary {
  schemaVersion: 1;
  kind: "balance-simulator-summary";
  simulatorVersion: "1";
  groups: Record<string, unknown>[];
  [key: string]: unknown;
}
export type ReviewDocument = ReviewCase | ReviewSummary;

function object(input: unknown, path: string): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  )
    throw new Error(`${path}: 需要 JSON 对象`);
  return input as Record<string, unknown>;
}
function string(input: unknown, path: string): string {
  if (typeof input !== "string" || !input.trim() || input.length > 5000)
    throw new Error(`${path}: 需要非空文本，最多 5000 字符`);
  return input;
}
function hash(input: unknown, path: string): string {
  if (typeof input !== "string" || !/^[a-f0-9]{64}$/.test(input))
    throw new Error(`${path}: 需要 SHA-256 内容指纹`);
  return input;
}
function count(input: unknown, path: string): number {
  return validateNumber(input, [path, 0, Number.MAX_SAFE_INTEGER, true], path);
}
function positiveNumbers(input: unknown, path: string): void {
  for (const [key, value] of Object.entries(object(input, path)))
    validateNumber(value, [key, 0, Number.MAX_VALUE], `${path}.${key}`);
}
function player(input: unknown, path: string): void {
  const data = object(input, path);
  for (const field of ["hp", "maxHp", "shield"])
    validateNumber(data[field], [field, 0, Number.MAX_VALUE], `${path}.${field}`);
  for (const field of ["cards", "trainings", "synergies"])
    positiveNumbers(data[field], `${path}.${field}`);
}
function combat(input: unknown, path: string): void {
  const data = object(input, path);
  for (const field of [
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
  ])
    validateNumber(data[field], [field, 0, Number.MAX_VALUE], `${path}.${field}`);
  for (const field of [
    "damageBySource",
    "hpLossBySource",
    "shieldAbsorbedBySource",
    "healingBySource",
    "shieldBySource",
    "mechanics",
  ])
    positiveNumbers(data[field], `${path}.${field}`);
  if (data.effectiveDps !== null)
    validateNumber(data.effectiveDps, ["DPS", 0, Number.MAX_VALUE], `${path}.effectiveDps`);
}
function strategyName(input: unknown, path: string): void {
  if (!["random-auto", "build-auto", "build-active", "legacy"].includes(string(input, path)))
    throw new Error(`${path}: 未知策略`);
}
function time(input: unknown, path: string): void {
  const data = object(input, path);
  for (const field of ["playerSeconds", "stageSeconds"])
    validateNumber(data[field], [field, 0, Number.MAX_VALUE], `${path}.${field}`);
}
function layout(input: unknown, width: number, path: string): void {
  const data = object(input, path);
  const arena = arenaLayout(width);
  if (
    data.width !== width ||
    data.height !== arena.height ||
    data.laneCount !== arena.laneCount ||
    data.capacity !== arena.encounterCapacity
  )
    throw new Error(`${path}: 场地宽度、车道或容量不一致`);
}
function terminationCounts(
  input: unknown,
  completed: number,
  path: string,
): Record<string, number> {
  const counts = object(input, path);
  if (
    Object.keys(counts).some((key) => !TERMINATIONS.includes(key as (typeof TERMINATIONS)[number]))
  )
    throw new Error(`${path}: 未知终止字段`);
  const total = TERMINATIONS.reduce((sum, name) => sum + count(counts[name], `${path}.${name}`), 0);
  if (total !== completed) throw new Error(`${path}: 各终止数量与已完成局数不一致`);
  return counts as Record<string, number>;
}
function ratio(input: unknown, path: string): void {
  if (input !== null) validateNumber(input, [path, 0, 1], path);
}
function interval(input: unknown, path: string): void {
  if (input === null) return;
  if (!Array.isArray(input) || input.length !== 2) throw new Error(`${path}: 需要两端区间或 null`);
  ratio(input[0], `${path}[0]`);
  ratio(input[1], `${path}[1]`);
  if (typeof input[0] !== "number" || typeof input[1] !== "number" || input[0] > input[1])
    throw new Error(`${path}: 区间无效`);
}
function expectedRatio(input: unknown, expected: number | null, path: string): void {
  ratio(input, path);
  if (
    expected === null
      ? input !== null
      : typeof input !== "number" || Math.abs(input - expected) > 1e-12
  )
    throw new Error(`${path}: 与样本数量计算结果不一致`);
}
function finiteJson(input: unknown, depth = 0): void {
  if (depth > 40) throw new Error("实验文件结构过深");
  if (input === null || typeof input === "boolean" || typeof input === "string") return;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("实验文件包含非有限数值");
    return;
  }
  if (Array.isArray(input)) {
    if (input.length > 100_000) throw new Error("实验文件数组过长");
    for (const value of input) finiteJson(value, depth + 1);
    return;
  }
  for (const value of Object.values(object(input, "实验文件"))) finiteJson(value, depth + 1);
}
function envelope(input: unknown): Record<string, unknown> {
  const root = object(input, "实验文件");
  if (root.schemaVersion !== 1 || root.simulatorVersion !== "1")
    throw new Error("实验文件版本不兼容；需要 schemaVersion 1 / simulatorVersion 1");
  finiteJson(root);
  return root;
}

/** Validates portable fields only; does not import the runner, DOM or Bun APIs. */
export function parseReviewCase(input: unknown): ReviewCase {
  const root = envelope(input);
  if (root.kind !== "balance-simulator-case")
    throw new Error("需要 balance-simulator-case 单局文件");
  const profile = parseProfile(root.profile);
  hash(root.profileHash, "profileHash");
  hash(root.expectedHash, "expectedHash");
  const code = object(root.code, "code");
  string(code.commit, "code.commit");
  string(code.fingerprint, "code.fingerprint");
  if (typeof code.dirty !== "boolean") throw new Error("code.dirty: 需要布尔值");
  const run = object(root.run, "run");
  validateNumber(run.seed, ["种子", 0, 0xffffffff, true], "run.seed");
  arenaLayout(validateNumber(run.width, ["逻辑宽度", 450, 2400], "run.width"));
  if (run.mode !== "campaign" && run.mode !== "endless") throw new Error("run.mode: 未知实验模式");
  validateNumber(run.maxSteps, ["最大步数", 1, 100_000_000, true], "run.maxSteps");
  validateNumber(run.maxSeconds, ["模拟时长预算", CONFIG.fixedStep, 1_000_000], "run.maxSeconds");
  validateNumber(
    run.endlessTarget,
    ["无尽目标", run.mode === "endless" ? 1 : 0, 251, true],
    "run.endlessTarget",
  );
  const strategy = object(run.strategy, "run.strategy");
  strategyName(strategy.name, "run.strategy.name");
  const expected = object(root.expected, "expected");
  if (!TERMINATIONS.includes(expected.termination as (typeof TERMINATIONS)[number]))
    throw new Error("expected.termination: 未知终止结果");
  string(expected.reason, "expected.reason");
  if (typeof expected.validMetrics !== "boolean" || !Array.isArray(expected.invalidValues))
    throw new Error("expected: 缺少数值有效性标记");
  for (const item of expected.invalidValues) {
    const invalid = object(item, "expected.invalidValues");
    string(invalid.path, "expected.invalidValues.path");
    string(invalid.value, "expected.invalidValues.value");
  }
  if (
    (!expected.validMetrics &&
      (expected.termination !== "error" || !expected.invalidValues.length)) ||
    (expected.validMetrics && expected.invalidValues.length)
  )
    throw new Error("expected: 数值有效性与异常信息不一致");
  if (expected.schemaVersion !== 1 || expected.mode !== "natural")
    throw new Error("expected: 需要版本 1 的自然实验结果");
  if (stableStringify(expected.config) !== stableStringify(run))
    throw new Error("expected.config 与案例 run 不一致");
  const resolvedStrategy = object(expected.strategy, "expected.strategy");
  if (resolvedStrategy.name !== strategy.name || resolvedStrategy.version !== "1")
    throw new Error("expected.strategy: 策略或版本不一致");
  if (expected.fixedStep !== CONFIG.fixedStep)
    throw new Error("expected.fixedStep: 固定步长不一致");
  layout(expected.layout, run.width as number, "expected.layout");
  player(expected.final, "expected.final");
  combat(expected.metrics, "expected.metrics");
  for (const field of [
    "steps",
    "clearedStages",
    "endlessReached",
    "endlessCleared",
    "rewardCount",
    "droppedEvents",
    "droppedRewards",
    "droppedTraceSamples",
  ])
    count(expected[field], `expected.${field}`);
  for (const field of ["playerSeconds", "enemySeconds"])
    validateNumber(expected[field], [field, 0, Number.MAX_VALUE], `expected.${field}`);
  for (const field of ["rewards", "events", "deathWindow", "trace"])
    if (!Array.isArray(expected[field])) throw new Error(`expected.${field}: 需要数组`);
  object(expected.coverage, "expected.coverage");
  if (
    !Array.isArray(expected.stages) ||
    !expected.stages.every((stage) => object(stage, "expected.stages"))
  )
    throw new Error("expected.stages: 需要关卡摘要数组");
  for (const [index, inputStage] of expected.stages.entries()) {
    const stage = object(inputStage, `expected.stages[${index}]`);
    const path = `expected.stages[${index}]`;
    count(stage.stageIndex, `${path}.stageIndex`);
    if (stage.entered !== true || typeof stage.cleared !== "boolean")
      throw new Error(`${path}: 进入/清关状态无效`);
    player(stage.entry, `${path}.entry`);
    if (stage.clear !== null) player(stage.clear, `${path}.clear`);
    if (stage.postReward !== null) player(stage.postReward, `${path}.postReward`);
    combat(stage.metrics, `${path}.metrics`);
    time(stage.entryTime, `${path}.entryTime`);
    for (const field of ["bossSpawnTime", "bossDeathTime", "clearTime"])
      if (stage[field] !== null) time(stage[field], `${path}.${field}`);
  }
  return structuredClone({ ...root, profile }) as unknown as ReviewCase;
}

/** Hash verification protects against truncated or mixed profile/result evidence. */
export async function parseReviewDocument(input: unknown): Promise<ReviewDocument> {
  const root = envelope(input);
  if (root.kind === "balance-simulator-case") {
    const parsed = parseReviewCase(root);
    if ((await contentHash(parsed.profile)) !== parsed.profileHash)
      throw new Error("profileHash 不一致；方案内容已改变");
    if ((await contentHash(parsed.expected)) !== parsed.expectedHash)
      throw new Error("expectedHash 不一致；结果内容已改变");
    return parsed;
  }
  if (
    root.kind !== "balance-simulator-summary" ||
    !Array.isArray(root.groups) ||
    root.groups.length > 10_000
  )
    throw new Error("需要经过校验的实验摘要或单局 case 文件");
  const planned = count(root.planned, "summary.planned");
  const completed = count(root.completed, "summary.completed");
  if (completed > planned) throw new Error("summary: 已完成局数超过计划");
  const rootCounts = terminationCounts(root.counts, completed, "summary.counts");
  let groupedPlanned = 0;
  let groupedCompleted = 0;
  const groupedCounts = Object.fromEntries(TERMINATIONS.map((name) => [name, 0]));
  const identities = new Set<string>();
  for (const [index, inputGroup] of root.groups.entries()) {
    const group = object(inputGroup, `summary.groups[${index}]`);
    const path = `summary.groups[${index}]`;
    string(group.profile, `${path}.profile`);
    hash(group.profileHash, `${path}.profileHash`);
    if (group.cohort !== "selection" && group.cohort !== "validation")
      throw new Error(`${path}.cohort: 未知样本队列`);
    const strategy = object(group.strategy, `${path}.strategy`);
    strategyName(strategy.name, `${path}.strategy.name`);
    if (strategy.version !== "1") throw new Error(`${path}.strategy.version: 策略版本不兼容`);
    const width = validateNumber(group.width, ["逻辑宽度", CONFIG.width, 2400], `${path}.width`);
    const identity = stableStringify([group.cohort, group.profileHash, strategy, width]);
    if (identities.has(identity)) throw new Error(`${path}: 重复实验分组`);
    identities.add(identity);
    layout(group.layout, width, `${path}.layout`);
    const groupPlanned = count(group.planned, `${path}.planned`);
    const groupCompleted = count(group.completed, `${path}.completed`);
    const missing = count(group.missing, `${path}.missing`);
    if (groupCompleted > groupPlanned || missing !== groupPlanned - groupCompleted)
      throw new Error(`${path}: 计划、完成和缺失数量不一致`);
    const counts = terminationCounts(group.counts, groupCompleted, `${path}.counts`);
    groupedPlanned += groupPlanned;
    groupedCompleted += groupCompleted;
    for (const name of TERMINATIONS)
      groupedCounts[name] = (groupedCounts[name] ?? 0) + (counts[name] ?? 0);
    const wins = count(group.wins, `${path}.wins`);
    const resolved = count(group.resolved, `${path}.resolved`);
    if (
      wins !== (counts.campaign_victory ?? 0) + (counts.endless_target_reached ?? 0) ||
      resolved !== wins + (counts.death ?? 0)
    )
      throw new Error(`${path}: 已决或胜利数量不一致`);
    expectedRatio(group.winRate, resolved ? wins / resolved : null, `${path}.winRate`);
    expectedRatio(
      group.unresolvedRatio,
      groupPlanned ? (groupPlanned - resolved) / groupPlanned : null,
      `${path}.unresolvedRatio`,
    );
    interval(group.winRateCI95, `${path}.winRateCI95`);
    if ((resolved === 0) !== (group.winRateCI95 === null))
      throw new Error(`${path}.winRateCI95: 已决分母与区间空值不一致`);
    if (resolved && Array.isArray(group.winRateCI95)) {
      const point = wins / resolved;
      if (
        (group.winRateCI95[0] as number) > point + 1e-12 ||
        (group.winRateCI95[1] as number) < point - 1e-12
      )
        throw new Error(`${path}.winRateCI95: 区间未覆盖点估计`);
    }
    interval(group.winRateBounds, `${path}.winRateBounds`);
    if (groupPlanned === 0) {
      if (group.winRateBounds !== null)
        throw new Error(`${path}.winRateBounds: 零计划样本需要 null`);
    } else {
      if (!Array.isArray(group.winRateBounds))
        throw new Error(`${path}.winRateBounds: 缺少未决上下界`);
      expectedRatio(group.winRateBounds[0], wins / groupPlanned, `${path}.winRateBounds[0]`);
      expectedRatio(
        group.winRateBounds[1],
        (wins + groupPlanned - resolved) / groupPlanned,
        `${path}.winRateBounds[1]`,
      );
    }
  }
  if (
    groupedPlanned !== planned ||
    groupedCompleted !== completed ||
    TERMINATIONS.some((name) => groupedCounts[name] !== rootCounts[name])
  )
    throw new Error("summary: 总计与分组样本数量不一致");
  return structuredClone(root) as ReviewSummary;
}
