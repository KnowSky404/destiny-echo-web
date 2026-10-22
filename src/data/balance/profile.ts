import { arenaLayout } from "../../game/arena";
import { CONFIG } from "../../game/config";
import type { Stats } from "../../game/types";
import { CARDS } from "../cards";
import { ENEMIES } from "../enemies";
import { type Stage, stageAt } from "../stages";
import { TRAININGS } from "../training";
import {
  BASE_STATS,
  type BalanceProfile,
  DEFAULT_ENDLESS,
  ENDLESS_FIELDS,
  ENEMY_FIELDS,
  type EnemyNumbers,
  type KindWeights,
  MINION_KINDS,
  type NumericField,
  REWARD_SOURCES,
  type RewardPolicy,
  type RewardSource,
  STAGE_FIELDS,
  STAT_FIELDS,
  type StagePatch,
  type StageRule,
} from "./model";
import official from "./official.json";

export function defaultRewardPolicy(): RewardPolicy {
  return {
    mode: "guided",
    epicChance: 0.25,
    firstStageRestriction: true,
    cardWeights: {},
    trainingWeights: {},
  };
}

export function defaultProfile(): BalanceProfile {
  const enemies = Object.fromEntries(
    Object.entries(ENEMIES).map(([kind, data]) => [
      kind,
      Object.fromEntries(
        Object.keys(ENEMY_FIELDS).map((key) => [key, data[key as keyof EnemyNumbers]]),
      ),
    ]),
  ) as BalanceProfile["payload"]["enemies"];
  return {
    schemaVersion: 1,
    baseline: "balance-v1",
    id: "default",
    revision: 1,
    name: "当前正式数值",
    payload: {
      player: { hp: 100, shield: 0, stats: { ...BASE_STATS } },
      enemies,
      endless: { ...DEFAULT_ENDLESS },
      rewards: {
        chest: defaultRewardPolicy(),
        supply: defaultRewardPolicy(),
        stage: defaultRewardPolicy(),
      },
      stageRules: [],
    },
  };
}

function object(input: unknown, path: string): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  )
    throw new Error(`${path}: 必须是普通对象`);
  return input as Record<string, unknown>;
}
function keys(input: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(input))
    if (!allowed.includes(key)) throw new Error(`${path}.${key}: 未知字段`);
}
export function validateNumber(input: unknown, field: NumericField, path: string): number {
  const [, min, max, integer] = field;
  if (
    typeof input !== "number" ||
    !Number.isFinite(input) ||
    input < min ||
    input > max ||
    (integer && !Number.isSafeInteger(input))
  )
    throw new Error(`${path}: 需要 ${min}–${max} 之间的${integer ? "整数" : "有限数值"}`);
  return input;
}
export function validateNumbers<K extends string>(
  input: unknown,
  fields: Record<K, NumericField>,
  path: string,
  partial = false,
): Record<K, number> {
  const data = object(input, path);
  keys(data, Object.keys(fields), path);
  for (const key of partial ? Object.keys(data) : Object.keys(fields))
    validateNumber(data[key], fields[key as K], `${path}.${key}`);
  return { ...data } as Record<K, number>;
}
function weights(input: unknown, ids: readonly string[], path: string): Record<string, number> {
  const data = object(input, path);
  keys(data, ids, path);
  for (const [key, value] of Object.entries(data))
    validateNumber(value, [key, 0, 1e6], `${path}.${key}`);
  return { ...data } as Record<string, number>;
}
export function validateKindWeights(input: unknown, path = "kindWeights"): KindWeights | null {
  if (input === null) return null;
  const data = weights(input, MINION_KINDS, path);
  if (
    MINION_KINDS.some((kind) => data[kind] === undefined) ||
    !Object.values(data).some((n) => n > 0)
  )
    throw new Error(`${path}: 需要全部五类小怪的权重，且至少一个大于零`);
  return data as KindWeights;
}
function policy(input: unknown, path: string): RewardPolicy {
  const data = object(input, path);
  keys(
    data,
    ["mode", "epicChance", "firstStageRestriction", "cardWeights", "trainingWeights"],
    path,
  );
  if (data.mode !== "guided" && data.mode !== "weighted")
    throw new Error(`${path}.mode: 未知抽卡模式`);
  if (typeof data.firstStageRestriction !== "boolean")
    throw new Error(`${path}.firstStageRestriction: 需要布尔值`);
  return {
    mode: data.mode,
    firstStageRestriction: data.firstStageRestriction,
    epicChance: validateNumber(data.epicChance, ["史诗概率", 0, 1], `${path}.epicChance`),
    cardWeights: weights(
      data.cardWeights,
      CARDS.map((card) => card.id),
      `${path}.cardWeights`,
    ),
    trainingWeights: weights(
      data.trainingWeights,
      TRAININGS.map((card) => card.id),
      `${path}.trainingWeights`,
    ),
  };
}
function policies(
  input: unknown,
  path: string,
  partial = false,
): Partial<Record<RewardSource, RewardPolicy>> {
  const data = object(input, path);
  keys(data, REWARD_SOURCES, path);
  return Object.fromEntries(
    (partial ? Object.keys(data) : REWARD_SOURCES).map((source) => [
      source,
      policy(data[source], `${path}.${source}`),
    ]),
  );
}
export function validateStagePatch(input: unknown, path = "stage"): StagePatch {
  return validateNumbers(input, STAGE_FIELDS, path, true);
}
export function parseProfile(input: unknown): BalanceProfile {
  const root = object(input, "方案");
  keys(root, ["schemaVersion", "baseline", "id", "revision", "name", "payload"], "方案");
  if (root.schemaVersion !== 1 || root.baseline !== "balance-v1")
    throw new Error("方案版本或规则基线不兼容；需要显式迁移");
  if (typeof root.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(root.id))
    throw new Error("id: 需要 1–100 位字母、数字、连字符或下划线");
  if (typeof root.name !== "string" || !root.name.trim() || root.name.length > 100)
    throw new Error("name: 需要 1–100 位名称");
  const revision = validateNumber(root.revision, ["版本", 1, 1e6, true], "revision");
  const payload = object(root.payload, "payload");
  keys(payload, ["player", "enemies", "endless", "rewards", "stageRules"], "payload");
  const player = object(payload.player, "player");
  keys(player, ["hp", "shield", "stats"], "player");
  const stats = validateNumbers<keyof Stats>(player.stats, STAT_FIELDS, "player.stats");
  const hp = validateNumber(player.hp, ["初始生命", 1, stats.maxHp], "player.hp");
  const shield = validateNumber(player.shield, ["初始护盾", 0, 1e12], "player.shield");
  const enemies = object(payload.enemies, "enemies");
  keys(enemies, Object.keys(ENEMIES), "enemies");
  const parsedEnemies = Object.fromEntries(
    Object.keys(ENEMIES).map((kind) => [
      kind,
      validateNumbers(enemies[kind], ENEMY_FIELDS, `enemies.${kind}`),
    ]),
  ) as BalanceProfile["payload"]["enemies"];
  const endless = validateNumbers(payload.endless, ENDLESS_FIELDS, "endless");
  if (!Array.isArray(payload.stageRules) || payload.stageRules.length > 200)
    throw new Error("stageRules: 最多 200 条规则");
  const stageRules = payload.stageRules.map((input: unknown, index: number): StageRule => {
    const path = `stageRules[${index}]`;
    const rule = object(input, path);
    keys(rule, ["from", "to", "stage", "kindWeights", "rewards"], path);
    const from = validateNumber(
      rule.from,
      ["起始关", 1, Number.MAX_SAFE_INTEGER, true],
      `${path}.from`,
    );
    const to =
      rule.to === null
        ? null
        : validateNumber(rule.to, ["结束关", from, Number.MAX_SAFE_INTEGER, true], `${path}.to`);
    return {
      from,
      to,
      stage: validateStagePatch(rule.stage, `${path}.stage`),
      kindWeights: validateKindWeights(rule.kindWeights, `${path}.kindWeights`),
      rewards: policies(rule.rewards, `${path}.rewards`, true),
    };
  });
  for (let i = 0; i < stageRules.length; i++) {
    const a = stageRules[i];
    if (!a) continue;
    for (const b of stageRules.slice(i + 1))
      if (
        specificity(a) === specificity(b) &&
        a.from <= (b.to ?? Infinity) &&
        b.from <= (a.to ?? Infinity)
      )
        throw new Error("stageRules: 同优先级规则不能重叠（全局、区间、单关分别检查）");
  }
  return {
    schemaVersion: 1,
    baseline: "balance-v1",
    id: root.id,
    name: root.name.trim(),
    revision,
    payload: {
      player: { hp, shield, stats },
      enemies: parsedEnemies,
      endless,
      rewards: policies(payload.rewards, "rewards") as Record<RewardSource, RewardPolicy>,
      stageRules,
    },
  };
}
function specificity(rule: StageRule): number {
  return rule.from === rule.to ? 2 : rule.from === 1 && rule.to === null ? 0 : 1;
}
export function stageRulesAt(profile: BalanceProfile, index: number): StageRule[] {
  return profile.payload.stageRules
    .filter((rule) => index + 1 >= rule.from && index + 1 <= (rule.to ?? Infinity))
    .sort((a, b) => specificity(a) - specificity(b));
}
export function rewardPolicyAt(
  profile: BalanceProfile,
  index: number,
  source: RewardSource,
): RewardPolicy {
  let result = profile.payload.rewards[source];
  for (const rule of stageRulesAt(profile, index)) result = rule.rewards[source] ?? result;
  return result;
}
export function kindWeightsAt(profile: BalanceProfile, index: number): KindWeights | null {
  let weights: KindWeights | null = null;
  for (const rule of stageRulesAt(profile, index)) if (rule.kindWeights) weights = rule.kindWeights;
  return weights;
}
export function patchStage(stage: Stage, patch: StagePatch, width: number): Stage {
  const arena = arenaLayout(width);
  const population = arena.laneCount / 4;
  const result = { ...stage, ...patch };
  if (patch.enemyCount !== undefined) result.enemyCount = Math.ceil(patch.enemyCount * population);
  if (patch.supportCount !== undefined)
    result.supportCount = Math.ceil(patch.supportCount * population);
  if (patch.maxEnemies !== undefined)
    result.maxEnemies = Math.min(arena.encounterCapacity, Math.ceil(patch.maxEnemies * population));
  if (
    patch.spawnInterval === undefined &&
    (patch.enemyCount !== undefined || patch.bossAt !== undefined)
  )
    result.spawnInterval = Math.max(
      CONFIG.fixedStep,
      (result.bossAt - 0.8) / Math.max(1, result.enemyCount),
    );
  return result;
}
export function resolvedStage(
  profile: BalanceProfile,
  index: number,
  width: number = CONFIG.width,
): Stage {
  const stage = stageAt(index, width, profile.payload.endless, profile.payload.enemies.tank.hp);
  const patch = Object.assign(
    {},
    ...stageRulesAt(profile, index).map((rule) => rule.stage),
  ) as StagePatch;
  return patchStage(stage, patch, width);
}
export function officialProfile(): BalanceProfile {
  return official === null ? defaultProfile() : parseProfile(official);
}
