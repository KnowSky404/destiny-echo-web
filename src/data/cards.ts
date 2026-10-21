import { type Random, shuffled } from "../game/random";
import type { Card, Player, Stats, SynergyId } from "../game/types";

interface StatCard {
  id: string;
  name: string;
  description: string;
  synergy: SynergyId;
  symbol: string;
  field: keyof Stats;
  amount: number;
  label: string;
  unit?: "percent" | "seconds" | "multiplier";
  maxStacks: number | null;
  offense: boolean;
}

function statCard(definition: StatCard): Card {
  const format = (value: number) =>
    definition.unit === "percent"
      ? `${Math.round(value * 100)}%`
      : `${Number(value.toFixed(2))}${definition.unit === "seconds" ? "s" : definition.unit === "multiplier" ? "×" : ""}`;
  return {
    ...definition,
    rarity: definition.field === "chain" || definition.field === "controlPulse" ? "rare" : "common",
    eligible: () => true,
    apply: (player) => {
      player.stats[definition.field] += definition.amount;
    },
    preview: (player) =>
      `${definition.label} ${format(player.stats[definition.field])} → ${format(player.stats[definition.field] + definition.amount)}`,
  };
}

const EXTRA_CARDS: readonly Card[] = [
  statCard({
    id: "force",
    name: "巨力刻印",
    description: "基础攻击伤害 +5。重击与暴击继续放大基础输出。",
    synergy: "might",
    symbol: "damage",
    field: "damage",
    amount: 5,
    label: "基础伤害",
    maxStacks: null,
    offense: true,
  }),
  statCard({
    id: "momentum",
    name: "泰坦意志",
    description: "基础攻击倍率增加 12 个百分点，与固定伤害加成相乘。",
    synergy: "might",
    symbol: "damage",
    field: "power",
    amount: 0.12,
    label: "攻击加成",
    unit: "percent",
    maxStacks: 6,
    offense: true,
  }),
  statCard({
    id: "crush",
    name: "破城重锤",
    description: "每第 5 轮齐射重击，每层额外增伤 25%；羁绊可缩短轮数。",
    synergy: "might",
    symbol: "piercing",
    field: "crush",
    amount: 0.25,
    label: "重击增伤",
    unit: "percent",
    maxStacks: 3,
    offense: true,
  }),
  statCard({
    id: "leech",
    name: "渴血刻印",
    description: "普攻对敌人的实际伤害转化为生命，每层吸血 4%；宝箱不提供吸血。",
    synergy: "blood",
    symbol: "bloodpact",
    field: "lifesteal",
    amount: 0.04,
    label: "普攻吸血",
    unit: "percent",
    maxStacks: 6,
    offense: false,
  }),
  statCard({
    id: "renewal",
    name: "不息血泉",
    description: "战斗中每秒恢复 1.2 生命，暂停与选牌时停止。",
    synergy: "blood",
    symbol: "vitality",
    field: "regeneration",
    amount: 1.2,
    label: "每秒回复",
    maxStacks: null,
    offense: false,
  }),
  statCard({
    id: "recovery",
    name: "赤色恩赐",
    description: "吸血、击杀与持续回复的治疗量增加 15 个百分点。",
    synergy: "blood",
    symbol: "harvest",
    field: "recovery",
    amount: 0.15,
    label: "战斗治疗加成",
    unit: "percent",
    maxStacks: 4,
    offense: false,
  }),
  statCard({
    id: "keen",
    name: "命定锋芒",
    description: "每枚普攻弹幕的暴击率增加 8 个百分点。暴击基础倍率为 1.5。",
    synergy: "precision",
    symbol: "critical",
    field: "critChance",
    amount: 0.08,
    label: "基础暴击率",
    unit: "percent",
    maxStacks: 6,
    offense: true,
  }),
  statCard({
    id: "lethal",
    name: "致命祷词",
    description: "暴击伤害倍率增加 0.25；与暴击率卡和必暴羁绊联动。",
    synergy: "precision",
    symbol: "critical",
    field: "critDamage",
    amount: 0.25,
    label: "暴击倍率",
    unit: "multiplier",
    maxStacks: 6,
    offense: true,
  }),
  statCard({
    id: "expose",
    name: "弱点解剖",
    description: "对生命低于一半的敌人，每层额外造成 12% 伤害。",
    synergy: "precision",
    symbol: "focus",
    field: "expose",
    amount: 0.12,
    label: "半血增伤",
    unit: "percent",
    maxStacks: 4,
    offense: true,
  }),
  statCard({
    id: "chain",
    name: "跃迁闪电",
    description: "普攻命中向附近额外 1 个敌人跳跃，造成普攻伤害的 30%；不重复命中。",
    synergy: "storm",
    symbol: "storm",
    field: "chain",
    amount: 1,
    label: "闪电跳跃",
    maxStacks: 4,
    offense: true,
  }),
  statCard({
    id: "splash",
    name: "共振电弧",
    description: "普攻命中对周围敌人溅射，每层造成普攻伤害的 15%；不重复伤害主目标。",
    synergy: "storm",
    symbol: "blast",
    field: "splash",
    amount: 1,
    label: "溅射层数",
    maxStacks: 4,
    offense: true,
  }),
  statCard({
    id: "stormcall",
    name: "雷暴仪式",
    description: "每 6 秒在敌人处引发范围雷暴，伤害为攻击力 ×（1 + 0.5 × 层数）。",
    synergy: "storm",
    symbol: "storm",
    field: "storm",
    amount: 1,
    label: "雷暴层数",
    maxStacks: 4,
    offense: true,
  }),
  statCard({
    id: "chill",
    name: "寒霜刻印",
    description: "普攻命中减速 2 秒，每层减速 10%；同时减慢移动、准备和攻击计时。",
    synergy: "frost",
    symbol: "frost",
    field: "slow",
    amount: 0.1,
    label: "命中减速",
    unit: "percent",
    maxStacks: 4,
    offense: false,
  }),
  statCard({
    id: "frostbite",
    name: "碎冰咒",
    description: "对已减速的敌人，每层额外造成 12% 伤害。",
    synergy: "frost",
    symbol: "frost",
    field: "frostbite",
    amount: 0.12,
    label: "减速增伤",
    unit: "percent",
    maxStacks: 4,
    offense: true,
  }),
  statCard({
    id: "icefield",
    name: "永冬脉冲",
    description: "每 6 秒全场减速 2 秒，基础 20% 加每层 5%；羁绊延长持续。",
    synergy: "frost",
    symbol: "frost",
    field: "frostPulse",
    amount: 1,
    label: "寒潮层数",
    maxStacks: 4,
    offense: false,
  }),
  statCard({
    id: "impact",
    name: "震慑刻印",
    description: "主弹每命中同一敌人 4 次，眩晕每层 0.15 秒；首领持续四分之一。",
    synergy: "dominion",
    symbol: "control",
    field: "stun",
    amount: 0.15,
    label: "命中眩晕",
    unit: "seconds",
    maxStacks: 4,
    offense: false,
  }),
  statCard({
    id: "suppression",
    name: "破阵敕令",
    description: "对眩晕或蓄力中的敌人，每层额外造成 12% 伤害。",
    synergy: "dominion",
    symbol: "execution",
    field: "control",
    amount: 0.12,
    label: "控制增伤",
    unit: "percent",
    maxStacks: 4,
    offense: true,
  }),
  statCard({
    id: "edict",
    name: "静默王权",
    description: "每 8 秒全场眩晕，每层持续 0.25 秒；首领持续四分之一。",
    synergy: "dominion",
    symbol: "control",
    field: "controlPulse",
    amount: 1,
    label: "禁锢层数",
    maxStacks: 4,
    offense: false,
  }),
];

export const CARDS: readonly Card[] = [
  {
    id: "overload",
    offense: true,
    synergy: "blast",
    name: "过载刻印",
    description: "术式输出上调，理智暂时下线。",
    rarity: "common",
    symbol: "damage",
    maxStacks: null,
    eligible: () => true,
    apply: (player) => {
      player.stats.damage += 4;
    },
    preview: (player) => `伤害 ${player.stats.damage} → ${player.stats.damage + 4}`,
  },
  {
    id: "haste",
    offense: true,
    synergy: "barrage",
    name: "急速咏唱",
    description: "省略吟唱过程，包括标点符号。",
    rarity: "common",
    symbol: "haste",
    maxStacks: 6,
    eligible: (player) => player.stats.interval > 0.131,
    apply: (player) => {
      player.stats.interval = Math.max(0.13, player.stats.interval * 0.88);
    },
    preview: (player) =>
      `间隔 ${player.stats.interval.toFixed(2)}s → ${Math.max(0.13, player.stats.interval * 0.88).toFixed(2)}s`,
  },
  {
    id: "multishot",
    offense: true,
    synergy: "barrage",
    name: "分岔祷言",
    description: "增加一道追踪副弹，造成主弹 60% 伤害，优先分流至其他目标。",
    rarity: "rare",
    symbol: "multishot",
    maxStacks: 4,
    eligible: (player) => player.stats.projectiles < 5,
    apply: (player) => {
      player.stats.projectiles = Math.min(5, player.stats.projectiles + 1);
    },
    preview: (player) =>
      `弹幕 ${player.stats.projectiles} → ${Math.min(5, player.stats.projectiles + 1)} 枚`,
  },
  {
    id: "piercing",
    offense: true,
    synergy: "barrage",
    name: "因果贯穿",
    description: "击中以后，这件事还没完。",
    rarity: "rare",
    symbol: "piercing",
    maxStacks: 3,
    eligible: (player) => player.stats.piercing < 3,
    apply: (player) => {
      player.stats.piercing = Math.min(3, player.stats.piercing + 1);
    },
    preview: (player) =>
      `额外穿透 ${player.stats.piercing} → ${Math.min(3, player.stats.piercing + 1)} 个`,
  },
  {
    id: "vitality",
    offense: false,
    synergy: "bastion",
    name: "续杯仪式",
    description: "圣杯不保修，但可以续杯。增加上限并治疗。",
    rarity: "common",
    symbol: "vitality",
    maxStacks: null,
    eligible: () => true,
    apply: (player) => {
      player.stats.maxHp += 20;
      player.hp = Math.min(player.stats.maxHp, player.hp + 30);
    },
    preview: (player) => `生命上限 ${player.stats.maxHp} → ${player.stats.maxHp + 20} · 治疗 30`,
  },
  {
    id: "execution",
    offense: true,
    synergy: "judgment",
    name: "防线裁决",
    description: "对进入攻击阶段的敌人，每层额外造成 20% 伤害。推进与准备阶段不生效。",
    rarity: "common",
    symbol: "execution",
    maxStacks: 3,
    eligible: (player) => player.stats.execution < 3,
    apply: (player) => {
      player.stats.execution = Math.min(3, player.stats.execution + 1);
    },
    preview: (player) =>
      `攻击阶段增伤 ${player.stats.execution * 20}% → ${Math.min(3, player.stats.execution + 1) * 20}%`,
  },
  {
    id: "ward",
    offense: false,
    synergy: "bastion",
    name: "守夜契约",
    description: "为意外签一张临时保单。护盾优先承伤。",
    rarity: "common",
    symbol: "ward",
    maxStacks: null,
    eligible: () => true,
    apply: (player) => {
      player.shield += 24;
    },
    preview: (player) => `护盾 ${Math.ceil(player.shield)} → ${Math.ceil(player.shield + 24)}`,
  },
  {
    id: "fuse",
    offense: true,
    synergy: "blast",
    name: "余烬引信",
    description: "击杀时引爆目标，对附近敌人造成每层 16 点伤害。殉星达到 6 层后可连锁引爆。",
    rarity: "rare",
    symbol: "blast",
    maxStacks: 4,
    eligible: (player) => player.stats.fuse < 4,
    apply: (player) => {
      player.stats.fuse++;
    },
    preview: (player) => `击杀爆炸 ${player.stats.fuse * 16} → ${(player.stats.fuse + 1) * 16}`,
  },
  {
    id: "bloodpact",
    offense: true,
    synergy: "blast",
    name: "殉星契约",
    description: "有敌人时每 5 秒献祭 3 生命（不会致死），在目标处爆炸。伤害随最大生命提升。",
    rarity: "rare",
    symbol: "bloodpact",
    maxStacks: 3,
    eligible: (player) => player.stats.bloodpact < 3,
    apply: (player) => {
      player.stats.bloodpact++;
    },
    preview: (player) =>
      `献祭基础伤害 ${player.stats.bloodpact * 20} → ${(player.stats.bloodpact + 1) * 20} · 生命加成`,
  },
  {
    id: "thorns",
    offense: false,
    synergy: "bastion",
    name: "荆棘圣约",
    description: "每次有效受击，向当前敌人反击每层 18 点伤害；护盾承伤也能触发。",
    rarity: "rare",
    symbol: "thorns",
    maxStacks: 4,
    eligible: (player) => player.stats.thorns < 4,
    apply: (player) => {
      player.stats.thorns++;
    },
    preview: (player) => `受击反击 ${player.stats.thorns * 18} → ${(player.stats.thorns + 1) * 18}`,
  },
  {
    id: "focus",
    offense: true,
    synergy: "judgment",
    name: "破绽凝视",
    description: "每层对首领额外造成 20% 伤害。金色蓄力，是火力全开的时机。",
    rarity: "common",
    symbol: "focus",
    maxStacks: 3,
    eligible: (player) => player.stats.focus < 3,
    apply: (player) => {
      player.stats.focus++;
    },
    preview: (player) =>
      `首领增伤 +${player.stats.focus * 20}% → +${(player.stats.focus + 1) * 20}%`,
  },
  {
    id: "harvest",
    offense: false,
    synergy: "judgment",
    name: "终焉回响",
    description: "每次击杀回复每层 2 点生命，最高不超过生命上限。连锁击杀同样生效。",
    rarity: "common",
    symbol: "harvest",
    maxStacks: 3,
    eligible: (player) => player.stats.harvest < 3,
    apply: (player) => {
      player.stats.harvest++;
    },
    preview: (player) => `击杀回复 ${player.stats.harvest * 2} → ${(player.stats.harvest + 1) * 2}`,
  },
  ...EXTRA_CARDS,
];

export const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

export function eligibleCards(player: Player, stacks: ReadonlyMap<string, number>): Card[] {
  return CARDS.filter(
    (card) =>
      (card.maxStacks === null || (stacks.get(card.id) ?? 0) < card.maxStacks) &&
      card.eligible(player),
  );
}

export function drawCards(
  player: Player,
  stacks: ReadonlyMap<string, number>,
  random: Random,
): string[] {
  const pool = shuffled(eligibleCards(player, stacks), random);
  const counts = new Map<SynergyId, number>();
  for (const [id, count] of stacks) {
    const family = CARD_BY_ID.get(id)?.synergy;
    if (family) counts.set(family, (counts.get(family) ?? 0) + count);
  }
  const focused = [...counts]
    .filter(([family]) => pool.some((card) => card.synergy === family))
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  // Two different offers from the most invested family help reach 3/6/9 without
  // drowning it in ten families. The third slot retains an alternative.
  const foundations = new Set([
    "overload",
    "haste",
    "multishot",
    "piercing",
    "force",
    "momentum",
    "chain",
    "splash",
    "stormcall",
  ]);
  const preferred = focused
    ? pool.filter((card) => card.synergy === focused).slice(0, 2)
    : pool.filter((card) => foundations.has(card.id)).slice(0, 2);
  const choices = [...preferred, ...pool.filter((card) => !preferred.includes(card))].slice(0, 3);
  // Conditional damage cards (for example crit damage without crit chance) are
  // not the only escape from a weak start: always retain a foundation upgrade.
  if (!choices.some((card) => foundations.has(card.id))) {
    const attack = pool.find((card) => foundations.has(card.id) && !choices.includes(card));
    if (attack) choices[choices.length - 1] = attack;
  }
  return choices.map((card) => card.id);
}

export function applyCard(id: string, player: Player, stacks: Map<string, number>): boolean {
  const card = CARD_BY_ID.get(id);
  if (!card || !eligibleCards(player, stacks).includes(card)) return false;
  card.apply(player);
  stacks.set(id, (stacks.get(id) ?? 0) + 1);
  return true;
}
