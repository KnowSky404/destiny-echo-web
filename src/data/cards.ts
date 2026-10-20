import { type Random, shuffled } from "../game/random";
import type { Card, Player } from "../game/types";

export const CARDS: readonly Card[] = [
  {
    id: "overload",
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
    preview: (player) => `护盾 ${player.shield} → ${player.shield + 24}`,
  },
  {
    id: "fuse",
    synergy: "blast",
    name: "余烬引信",
    description: "击杀时引爆目标，对附近敌人造成每层 16 点伤害。凑齐三种殉星卡可连锁引爆。",
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
  const ownedFamilies = new Set(
    CARDS.filter((card) => (stacks.get(card.id) ?? 0) > 0).map((card) => card.synergy),
  );
  // One slot helps complete an existing family. The other two preserve alternatives.
  // Repeated copies strengthen a card, but never count as distinct synergy pieces.
  const connector = pool.find((card) => ownedFamilies.has(card.synergy) && !stacks.has(card.id));
  const choices = (
    connector ? [connector, ...pool.filter((card) => card !== connector)] : pool
  ).slice(0, 3);
  const offense = new Set(["overload", "haste", "multishot", "fuse", "bloodpact"]);
  if (!choices.some((card) => offense.has(card.id))) {
    const attack = pool.find((card) => offense.has(card.id));
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
