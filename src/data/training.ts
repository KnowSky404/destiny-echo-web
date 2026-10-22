import { CONFIG } from "../game/config";
import { type Random, shuffled, weightedChoice, weightedShuffle } from "../game/random";
import { combatStats } from "../game/stats";
import type { Player, Stats, Training } from "../game/types";
import type { RewardPolicy } from "./balance/model";
import { CARDS, drawCards } from "./cards";

function training(
  id: string,
  name: string,
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
      `${name} ${format(player.stats[field])} → ${format(Math.min(cap, player.stats[field] + amount))}`,
  };
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
export const TRAININGS: readonly Training[] = [
  training("damage", "基础伤害", "damage", 6, "damage"),
  training("health", "生命上限", "maxHp", 30, "vitality"),
  training("power", "攻击加成", "power", 0.1, "damage", percent),
  training("critical", "暴击率", "critChance", 0.04, "critical", percent, 0.85),
  training("critical-power", "暴击倍率", "critDamage", 0.2, "critical"),
  training(
    "leech",
    "普攻吸血",
    "lifesteal",
    0.02,
    "bloodpact",
    (value) => `${Number((value * CONFIG.lifestealMultiplier * 100).toFixed(2))}%`,
    0.5,
  ),
  training("renewal", "每秒回复", "regeneration", 0.75, "vitality"),
  {
    type: "training",
    id: "training-haste",
    name: "攻击间隔",
    rarity: "common",
    symbol: "haste",
    maxStacks: null,
    description: "本局锻体：本局基础攻击间隔缩短 6%，最低 0.08 秒；不计入流派层数。",
    eligible: (player) => player.stats.interval > 0.080001,
    apply: (player) => {
      player.stats.interval = Math.max(0.08, player.stats.interval * 0.94);
    },
    preview: (player) =>
      `攻击间隔 ${player.stats.interval.toFixed(3)}s → ${Math.max(0.08, player.stats.interval * 0.94).toFixed(3)}s`,
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
): Training[] {
  // Shield is ignored so conditional leech does not hide a useful permanent upgrade.
  const effective = combatStats({ ...player, shield: 0, poisonSlowTime: 0 }, stacks);
  return TRAININGS.filter(
    (item) =>
      item.eligible(player) &&
      (policy?.trainingWeights[item.id] ?? 1) > 0 &&
      (item.id !== "training-critical" || effective.critChance < 0.85 - 1e-9) &&
      (item.id !== "training-leech" ||
        ((stageIndex > 0 || policy?.firstStageRestriction === false) &&
          effective.lifesteal < 0.5 * CONFIG.lifestealMultiplier - 1e-9)) &&
      (item.id !== "training-haste" || effective.interval > 0.08 + 1e-9),
  );
}

export function drawBossRewards(
  player: Player,
  stacks: ReadonlyMap<string, number>,
  random: Random,
  stageIndex: number,
  policy?: RewardPolicy,
): string[] {
  const trainingChoices = weightedShuffle(
    eligibleTrainings(player, stacks, stageIndex, policy),
    (item) => policy?.trainingWeights[item.id] ?? 1,
    random,
  ).slice(0, 2);
  const augments = drawCards(player, stacks, random, "stage", stageIndex, policy);
  const weight = (id: string) => policy?.cardWeights[id] ?? 1;
  const uniform = augments.every((id) => weight(id) === weight(augments[0] ?? ""));
  const card =
    policy?.mode === "weighted"
      ? augments[0]
      : uniform
        ? shuffled(augments, random)[0]
        : weightedChoice(augments, weight, random);
  return [...trainingChoices.map((item) => item.id), ...(card ? [card] : [])];
}

export function applyTraining(id: string, player: Player, stacks: Map<string, number>): boolean {
  const item = TRAINING_BY_ID.get(id);
  if (!item?.eligible(player)) return false;
  item.apply(player);
  stacks.set(id, (stacks.get(id) ?? 0) + 1);
  return true;
}
