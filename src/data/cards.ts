import { type Random, shuffled } from "../game/random";
import type { Card, Player, Reward, Stats, SynergyId } from "../game/types";

export const RARITY_NAMES = { common: "普通", rare: "稀有", epic: "史诗" } as const;

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
    description:
      "每 8 秒进入子弹时间，净化中毒与攻速降低；冻结敌方、弹幕与关卡倒计时，玩家继续攻击。首领不减免。",
    synergy: "dominion",
    symbol: "control",
    field: "controlPulse",
    amount: 1,
    label: "子弹时间强化层数",
    maxStacks: 4,
    offense: false,
  }),
];

function epicCard(
  definition: Pick<Card, "id" | "name" | "description" | "synergy" | "symbol" | "offense"> & {
    bonuses: Partial<Stats>;
    change: string;
    restore?: { hp: number; shield: number };
  },
): Card {
  return {
    ...definition,
    rarity: "epic",
    maxStacks: 1,
    eligible: () => true,
    apply: (player) => {
      for (const [field, amount] of Object.entries(definition.bonuses) as [keyof Stats, number][])
        player.stats[field] += amount;
      if (definition.restore) {
        player.hp = Math.min(player.stats.maxHp, player.hp + definition.restore.hp);
        player.shield += definition.restore.shield;
      }
    },
    preview: () => definition.change,
  };
}

export const EPIC_CARDS: readonly Card[] = [
  epicCard({
    id: "nova-heart",
    name: "超新星之心",
    synergy: "blast",
    symbol: "blast",
    offense: true,
    description: "星核替你承担过载。强化击杀爆炸与自动献祭，并提高普攻伤害。每局限取一次。",
    bonuses: { damage: 8, fuse: 2, bloodpact: 1 },
    change: "基础伤害 +8 · 爆炸 +2 层 · 献祭 +1 层",
  }),
  epicCard({
    id: "heavenly-barrage",
    name: "万千祷言",
    synergy: "barrage",
    symbol: "multishot",
    offense: true,
    description: "圣杯同时回应每一道祈祷。增加两枚弹幕并提高穿透；最终弹数最多六枚。每局限取一次。",
    bonuses: { projectiles: 2, piercing: 1 },
    change: "弹幕 +2 枚 · 额外穿透 +1",
  }),
  epicCard({
    id: "aegis-core",
    name: "不灭圣城",
    synergy: "bastion",
    symbol: "ward",
    offense: false,
    description: "立即扩展生命上限、治疗并获得护盾，荆棘反击再增加一层。每局限取一次。",
    bonuses: { maxHp: 60, thorns: 1 },
    restore: { hp: 80, shield: 60 },
    change: "生命上限 +60 · 治疗 80 · 护盾 +60 · 荆棘 +1",
  }),
  epicCard({
    id: "final-verdict",
    name: "终焉敕令",
    synergy: "judgment",
    symbol: "execution",
    offense: true,
    description: "对首领和攻击阶段的敌人各增加 40% 伤害，每次击杀额外回复 4 生命。每局限取一次。",
    bonuses: { focus: 2, execution: 2, harvest: 2 },
    change: "首领增伤 +40% · 攻击阶段增伤 +40% · 击杀回复 +4",
  }),
  epicCard({
    id: "titan-heart",
    name: "泰坦神躯",
    synergy: "might",
    symbol: "damage",
    offense: true,
    description: "巨神将力量借给凡人。固定伤害与攻击倍率同时提升。每局限取一次。",
    bonuses: { damage: 18, power: 0.3 },
    change: "基础伤害 +18 · 攻击加成 +30 个百分点",
  }),
  epicCard({
    id: "crimson-grail",
    name: "猩红圣杯",
    synergy: "blood",
    symbol: "bloodpact",
    offense: false,
    description: "以敌人的伤口修复防线。吸血、持续回复和治疗加成同时强化。每局限取一次。",
    bonuses: { lifesteal: 0.12, regeneration: 3, recovery: 0.25 },
    change: "吸血 +12% · 每秒回复 +3 · 治疗加成 +25%",
  }),
  epicCard({
    id: "fate-eye",
    name: "命运之眼",
    synergy: "precision",
    symbol: "critical",
    offense: true,
    description: "看见下一次暴击，也让它更加致命。每局限取一次。",
    bonuses: { critChance: 0.2, critDamage: 0.75 },
    change: "暴击率 +20 个百分点 · 暴击倍率 +0.75",
  }),
  epicCard({
    id: "tempest-core",
    name: "万雷归一",
    synergy: "storm",
    symbol: "storm",
    offense: true,
    description: "连锁、溅射与周期雷暴同时强化，单体攻击也能清场。每局限取一次。",
    bonuses: { chain: 2, splash: 2, storm: 2 },
    change: "闪电跳跃 +2 · 溅射 +2 层 · 雷暴 +2 层",
  }),
  epicCard({
    id: "absolute-zero",
    name: "绝对零域",
    synergy: "frost",
    symbol: "frost",
    offense: true,
    description: "同时强化命中减速、碎冰增伤与周期寒潮。首领仍抵抗普通减速。每局限取一次。",
    bonuses: { slow: 0.2, frostbite: 0.35, frostPulse: 2 },
    change: "命中减速 +20% · 减速增伤 +35% · 寒潮 +2 层",
  }),
  epicCard({
    id: "chronocrown",
    name: "时序王冠",
    synergy: "dominion",
    symbol: "control",
    offense: true,
    description:
      "单独获得即可解锁 2 秒子弹时间；已有子弹时间额外延长 1 秒，再受王权羁绊加成。每局限取一次。",
    bonuses: { controlPulse: 2, control: 0.35, stun: 0.3 },
    change: "子弹时间 +2 层 · 控制增伤 +35% · 命中眩晕 +0.3s",
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
    eligible: (player) => player.stats.projectiles < 6,
    apply: (player) => {
      player.stats.projectiles = Math.min(6, player.stats.projectiles + 1);
    },
    preview: (player) =>
      `弹幕 ${player.stats.projectiles} → ${Math.min(6, player.stats.projectiles + 1)} 枚`,
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
    eligible: () => true,
    apply: (player) => {
      player.stats.piercing++;
    },
    preview: (player) => `额外穿透 ${player.stats.piercing} → ${player.stats.piercing + 1} 个`,
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
    eligible: () => true,
    apply: (player) => {
      player.stats.execution++;
    },
    preview: (player) =>
      `攻击阶段增伤 ${player.stats.execution * 20}% → ${(player.stats.execution + 1) * 20}%`,
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
    eligible: () => true,
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
    eligible: () => true,
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
    eligible: () => true,
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
    eligible: () => true,
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
    eligible: () => true,
    apply: (player) => {
      player.stats.harvest++;
    },
    preview: (player) => `击杀回复 ${player.stats.harvest * 2} → ${(player.stats.harvest + 1) * 2}`,
  },
  ...EXTRA_CARDS,
  ...EPIC_CARDS,
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
  source: Reward["source"] = "chest",
): string[] {
  const eligible = eligibleCards(player, stacks);
  const pool = shuffled(
    eligible.filter((card) => card.rarity !== "epic"),
    random,
  );
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
    "nova-heart",
    "heavenly-barrage",
    "titan-heart",
    "tempest-core",
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
  const collected = [...stacks.values()].reduce((sum, count) => sum + count, 0);
  const epics = eligible.filter((card) => card.rarity === "epic");
  if (epics.length > 0 && (source === "stage" || (collected >= 3 && random() < 0.25))) {
    const promoted = shuffled(epics, random);
    const epic = promoted.find((card) => card.synergy === focused) ?? promoted[0];
    if (epic) {
      // Preserve a foundation option even when the epic itself is defensive.
      const replacement = choices.findIndex((card) => !foundations.has(card.id));
      choices[replacement >= 0 ? replacement : choices.length - 1] = epic;
    }
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
