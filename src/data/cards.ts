import { type Random, shuffled } from "../game/random";
import type { Card, Player } from "../game/types";

export const CARDS: readonly Card[] = [
  {
    id: "overload",
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
    name: "分岔祷言",
    description: "一个愿望，分多路提交。",
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
    id: "drift",
    name: "星轨偏移",
    description: "命运追上你之前，先挪一步。",
    rarity: "common",
    symbol: "drift",
    maxStacks: 4,
    eligible: (player) => player.stats.speed < 380,
    apply: (player) => {
      player.stats.speed = Math.min(380, player.stats.speed + 30);
    },
    preview: (player) => `移速 ${player.stats.speed} → ${Math.min(380, player.stats.speed + 30)}`,
  },
  {
    id: "ward",
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
  // Damage, vitality and ward remain eligible, even when every bounded effect is capped.
  return shuffled(eligibleCards(player, stacks), random)
    .slice(0, 3)
    .map((card) => card.id);
}

export function applyCard(id: string, player: Player, stacks: Map<string, number>): boolean {
  const card = CARD_BY_ID.get(id);
  if (!card || !eligibleCards(player, stacks).includes(card)) return false;
  card.apply(player);
  stacks.set(id, (stacks.get(id) ?? 0) + 1);
  return true;
}
