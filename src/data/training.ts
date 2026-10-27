import { CONFIG } from "../game/config";
import { type Random, weightedShuffle } from "../game/random";
import { combatStats } from "../game/stats";
import type { Player, Stats, Training } from "../game/types";
import { t } from "../i18n/locale";
import { DEFAULT_EVOLUTION, type RewardPolicy } from "./balance/model";
import { CARDS, drawBossCard } from "./cards";

function training(
  id: string,
  name: string,
  nameEn: string,
  field: keyof Stats,
  amount: number,
  symbol: string,
  format: (value: number) => string = (value) => String(Number(value.toFixed(2))),
  cap = Infinity,
): Training {
  return {
    type: "training",
    id: `training-${id}`,
    name,
    description: "本局锻体：永久调整本局数值，不计入流派层数。",
    rarity: "common",
    symbol,
    maxStacks: null,
    eligible: (player) => player.stats[field] < cap - 1e-9,
    apply: (player) => {
      player.stats[field] = Math.min(cap, player.stats[field] + amount);
    },
    preview: (player) =>
      `${t(name, nameEn)} ${format(player.stats[field])} → ${format(Math.min(cap, player.stats[field] + amount))}`,
  };
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
export const TRAININGS: readonly Training[] = [
  training("damage", "基础伤害", "Base damage", "damage", 6, "damage"),
  training("health", "生命上限", "Maximum HP", "maxHp", 30, "vitality"),
  training("power", "攻击加成", "Attack power", "power", 0.1, "damage", percent),
  training("critical", "暴击率", "Critical chance", "critChance", 0.04, "critical", percent, 0.85),
  training("critical-power", "暴击倍率", "Critical multiplier", "critDamage", 0.2, "critical"),
  training(
    "leech",
    "普攻吸血",
    "Basic lifesteal",
    "lifesteal",
    0.02,
    "bloodpact",
    (value) => `${Number((value * CONFIG.lifestealMultiplier * 100).toFixed(2))}%`,
    0.5,
  ),
  training("renewal", "每秒回复", "HP/s", "regeneration", 0.75, "vitality"),
  {
    type: "training",
    id: "training-haste",
    name: "攻击间隔",
    rarity: "common",
    symbol: "haste",
    maxStacks: null,
    description:
      "本局锻体：基础攻击间隔缩短 6%；实际间隔受本局下限约束，正式配置最低 0.12 秒；不计入流派层数。",
    eligible: (player) => player.stats.interval > 0.080001,
    apply: (player) => {
      player.stats.interval = Math.max(0.08, player.stats.interval * 0.94);
    },
    preview: (player) =>
      `${t("基础攻击间隔", "Base firing interval")} ${player.stats.interval.toFixed(3)}s → ${Math.max(0.08, player.stats.interval * 0.94).toFixed(3)}s · ${t("实际间隔受本局下限约束", "Effective interval respects this run's floor")}`,
  },
];
export const TRAINING_BY_ID = new Map(TRAININGS.map((item) => [item.id, item]));
export const REWARD_BY_ID = new Map<string, (typeof CARDS)[number] | Training>(
  [...CARDS, ...TRAININGS].map((item) => [item.id, item]),
);

export function eligibleTrainings(
  player: Player,
  stacks: ReadonlyMap<string, number>,
  stageIndex: number,
  policy?: RewardPolicy,
  firingIntervalFloor: number = DEFAULT_EVOLUTION.firingIntervalFloor,
): Training[] {
  // Shield is ignored so conditional leech does not hide a useful permanent upgrade.
  const effective = combatStats(
    { ...player, shield: 0, poisonTime: 0, poisonSlowTime: 0 },
    stacks,
    firingIntervalFloor,
  );
  return TRAININGS.filter(
    (item) =>
      item.eligible(player) &&
      (policy?.trainingWeights[item.id] ?? 1) > 0 &&
      (item.id !== "training-critical" || effective.critChance < 0.85 - 1e-9) &&
      (item.id !== "training-leech" ||
        ((stageIndex > 0 || policy?.firstStageRestriction === false) &&
          effective.lifesteal < 0.5 * CONFIG.lifestealMultiplier - 1e-9)) &&
      (item.id !== "training-haste" || effective.interval > firingIntervalFloor + 1e-9),
  );
}

export function drawBossRewards(
  player: Player,
  stacks: ReadonlyMap<string, number>,
  random: Random,
  stageIndex: number,
  policy?: RewardPolicy,
  firingIntervalFloor: number = DEFAULT_EVOLUTION.firingIntervalFloor,
): string[] {
  const trainingChoices = weightedShuffle(
    eligibleTrainings(player, stacks, stageIndex, policy, firingIntervalFloor),
    (item) => policy?.trainingWeights[item.id] ?? 1,
    random,
  ).slice(0, 2);
  const card = drawBossCard(player, stacks, random, stageIndex, policy, firingIntervalFloor);
  return [...trainingChoices.map((item) => item.id), ...(card ? [card] : [])];
}

export function applyTraining(id: string, player: Player, stacks: Map<string, number>): boolean {
  const item = TRAINING_BY_ID.get(id);
  if (!item?.eligible(player)) return false;
  item.apply(player);
  stacks.set(id, (stacks.get(id) ?? 0) + 1);
  return true;
}
