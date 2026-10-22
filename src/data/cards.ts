import { CONFIG } from "../game/config";
import { type Random, weightedShuffle } from "../game/random";
import { grantShield, healingMultiplier, healPlayer } from "../game/systems/damage";
import type { Card, Player, Reward, Stats, SynergyId } from "../game/types";
import { t } from "../i18n/locale";
import type { RewardPolicy } from "./balance/model";

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
  labelEn: string;
  unit?: "percent" | "seconds" | "multiplier";
  maxStacks: number | null;
  offense: boolean;
}

function statCard(definition: StatCard): Card {
  const format = (value: number) =>
    definition.unit === "percent"
      ? `${Number((value * 100 * (definition.field === "lifesteal" || definition.field === "shieldLeech" ? CONFIG.lifestealMultiplier : 1)).toFixed(2))}%`
      : `${Number(value.toFixed(2))}${definition.unit === "seconds" ? "s" : definition.unit === "multiplier" ? "×" : ""}`;
  return {
    ...definition,
    type: "augment",
    rarity: definition.field === "chain" || definition.field === "controlPulse" ? "rare" : "common",
    eligible: () => true,
    apply: (player) => {
      player.stats[definition.field] += definition.amount;
    },
    preview: (player) =>
      `${t(definition.label, definition.labelEn)} ${format(player.stats[definition.field])} → ${format(player.stats[definition.field] + definition.amount)}`,
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
    labelEn: "Base damage",
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
    labelEn: "Attack power",
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
    labelEn: "Heavy-strike bonus",
    unit: "percent",
    maxStacks: 3,
    offense: true,
  }),
  statCard({
    id: "leech",
    name: "渴血刻印",
    description: "普攻对敌人的实际伤害转化为生命，每层基础吸血 4%（实际 3.4%）；宝箱不提供吸血。",
    synergy: "blood",
    symbol: "bloodpact",
    field: "lifesteal",
    amount: 0.04,
    label: "普攻吸血",
    labelEn: "Basic lifesteal",
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
    labelEn: "HP/s",
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
    labelEn: "Combat healing bonus",
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
    labelEn: "Base critical chance",
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
    labelEn: "Critical multiplier",
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
    labelEn: "Below-half bonus",
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
    labelEn: "Lightning jumps",
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
    labelEn: "Splash stacks",
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
    labelEn: "Storm stacks",
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
    labelEn: "On-hit slow",
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
    labelEn: "Slowed-target bonus",
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
    labelEn: "Winter stacks",
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
    labelEn: "On-hit stun",
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
    labelEn: "Control bonus",
    unit: "percent",
    maxStacks: 4,
    offense: true,
  }),
  statCard({
    id: "edict",
    name: "静默王权",
    description:
      "每 8 秒展开遗世庇护，净化中毒、重伤与攻速降低。首层时停 0.75 秒，敌方嘲讽失效，融合与技能计时冻结，玩家继续攻击。",
    synergy: "dominion",
    symbol: "control",
    field: "controlPulse",
    amount: 1,
    label: "遗世庇护强化层数",
    labelEn: "Sanctuary enhancement stacks",
    maxStacks: 4,
    offense: false,
  }),
];

function epicCard(
  definition: Pick<Card, "id" | "name" | "description" | "synergy" | "symbol" | "offense"> & {
    bonuses: Partial<Stats>;
    change: string;
    changeEn: string;
    restore?: { hp: number; shield: number };
  },
): Card {
  return {
    ...definition,
    type: "augment",
    rarity: "epic",
    maxStacks: 1,
    eligible: () => true,
    apply: (player) => {
      for (const [field, amount] of Object.entries(definition.bonuses) as [keyof Stats, number][])
        player.stats[field] += amount;
      if (definition.restore) {
        healPlayer(player, definition.restore.hp);
        grantShield(player, definition.restore.shield);
      }
    },
    preview: (player) =>
      definition.restore && healingMultiplier(player) < 1
        ? `${t(definition.change, definition.changeEn)} · ${t("重伤后治疗", "Healing after wounds")} ${Number((definition.restore.hp * healingMultiplier(player)).toFixed(2))} / ${t("护盾", "Shield")} ${Number((definition.restore.shield * healingMultiplier(player)).toFixed(2))}`
        : t(definition.change, definition.changeEn),
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
    changeEn: "Base damage +8 · Explosion +2 stacks · Sacrifice +1 stack",
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
    changeEn: "Projectiles +2 · Extra penetration +1",
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
    changeEn: "Maximum HP +60 · Heal 80 · Shield +60 · Thorns +1",
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
    changeEn: "Boss bonus +40% · Attacking-state damage bonus +40% · Kill healing +4",
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
    changeEn: "Base damage +18 · Attack power +30 percentage points",
  }),
  epicCard({
    id: "crimson-grail",
    name: "猩红圣杯",
    synergy: "blood",
    symbol: "bloodpact",
    offense: false,
    description: "以敌人的伤口修复防线。吸血、持续回复和治疗加成同时强化。每局限取一次。",
    bonuses: { lifesteal: 0.12, regeneration: 3, recovery: 0.25 },
    change: "实际吸血 +10.2% · 每秒回复 +3 · 治疗加成 +25%",
    changeEn: "Effective lifesteal +10.2% · HP/s +3 · Healing bonus +25%",
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
    changeEn: "Critical chance +20 percentage points · Critical multiplier +0.75",
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
    changeEn: "Lightning jumps +2 · Splash +2 stacks · Storm +2 stacks",
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
    changeEn: "On-hit slow +20% · Slowed-target bonus +35% · Winter +2 stacks",
  }),
  epicCard({
    id: "chronocrown",
    name: "时序王冠",
    synergy: "dominion",
    symbol: "control",
    offense: true,
    description:
      "单独获得即可展开 1 秒遗世庇护；已有庇护额外延长 0.5 秒，再受王权羁绊加成。每局限取一次。",
    bonuses: { controlPulse: 2, control: 0.35, stun: 0.3 },
    change: "遗世庇护 +2 层 · 控制增伤 +35% · 命中眩晕 +0.3s",
    changeEn: "Sanctuary +2 stacks · Control bonus +35% · On-hit stun +0.3s",
  }),
  epicCard({
    id: "godfall",
    name: "诸神黄昏",
    synergy: "giantslayer",
    symbol: "focus",
    offense: true,
    description: "主弹额外 0.75% 最大生命伤害，体量系数 +8%，巨物增伤 +20%。每局限取一次。",
    bonuses: { giantSlayer: 0.0075, giantPower: 0.08, giantHunt: 0.2 },
    change: "主弹最大生命 +0.75% · 体量系数 +8% · 巨物增伤 +20%",
    changeEn: "Primary maximum HP +0.75% · Size coefficient +8% · Giant bonus +20%",
  }),
  epicCard({
    id: "event-horizon",
    name: "终末视界",
    synergy: "erosion",
    symbol: "storm",
    offense: true,
    description: "主弹额外造成 0.6% 最大生命与 2% 当前生命伤害，全场脉冲额外 1%。每局限取一次。",
    bonuses: { maxHealthDamage: 0.006, currentHealthDamage: 0.02, erosionPulse: 0.01 },
    change: "主弹最大生命 +0.6% · 当前生命 +2% · 脉冲 +1%",
    changeEn: "Primary maximum HP +0.6% · Current HP +2% · Pulse +1%",
  }),
];

export const CARDS: readonly Card[] = [
  {
    type: "augment",
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
    preview: (player) =>
      `${t("伤害", "Damage")} ${player.stats.damage} → ${player.stats.damage + 4}`,
  },
  {
    type: "augment",
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
      `${t("间隔", "Interval")} ${player.stats.interval.toFixed(2)}s → ${Math.max(0.13, player.stats.interval * 0.88).toFixed(2)}s`,
  },
  {
    type: "augment",
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
      `${t("弹幕", "Projectiles")} ${player.stats.projectiles} → ${Math.min(6, player.stats.projectiles + 1)} ${t("枚", "shots")}`,
  },
  {
    type: "augment",
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
    preview: (player) =>
      `${t("额外穿透", "Extra penetration")} ${player.stats.piercing} → ${player.stats.piercing + 1} ${t("个", "targets")}`,
  },
  {
    type: "augment",
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
      healPlayer(player, 30);
    },
    preview: (player) =>
      `${t("生命上限", "Maximum HP")} ${player.stats.maxHp} → ${player.stats.maxHp + 20} · ${t("治疗", "Heal")} ${Number((30 * healingMultiplier(player)).toFixed(2))}`,
  },
  {
    type: "augment",
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
      `${t("攻击阶段增伤", "Attacking-state damage bonus")} ${player.stats.execution * 20}% → ${(player.stats.execution + 1) * 20}%`,
  },
  {
    type: "augment",
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
      grantShield(player, 24);
    },
    preview: (player) =>
      `${t("护盾", "Shield")} ${Math.ceil(player.shield)} → ${Math.ceil(player.shield + 24 * healingMultiplier(player))}`,
  },
  {
    type: "augment",
    id: "fuse",
    offense: true,
    synergy: "blast",
    name: "余烬引信",
    description:
      "击杀时引爆目标，对附近敌人造成每层 16 点 + 被引爆怪物最大生命 3% 的伤害。殉星 6 层后可连锁。",
    rarity: "rare",
    symbol: "blast",
    maxStacks: 4,
    eligible: () => true,
    apply: (player) => {
      player.stats.fuse++;
    },
    preview: (player) =>
      `${t("击杀爆炸", "Kill explosion")} ${player.stats.fuse * 16} → ${(player.stats.fuse + 1) * 16} · ${t("来源怪物最大生命 +3% / 层", "Source maximum HP +3% / stack")}`,
  },
  {
    type: "augment",
    id: "bloodpact",
    offense: true,
    synergy: "blast",
    name: "殉星契约",
    description:
      "有敌人时每 5 秒献祭 3 生命（不会致死），在目标处爆炸。除基础和玩家生命加成，每层附加目标最大生命 2%。",
    rarity: "rare",
    symbol: "bloodpact",
    maxStacks: 3,
    eligible: () => true,
    apply: (player) => {
      player.stats.bloodpact++;
    },
    preview: (player) =>
      `${t("献祭基础伤害", "Sacrifice base damage")} ${player.stats.bloodpact * 20} → ${(player.stats.bloodpact + 1) * 20} · ${t("玩家生命加成 + 目标最大生命 2% / 层", "Player HP bonus + Target maximum HP 2% / stack")}`,
  },
  {
    type: "augment",
    id: "thorns",
    offense: false,
    synergy: "bastion",
    name: "荆棘圣约",
    description: "每次有效受击，对全场每个敌人反击每层 18 点伤害；护盾承伤也能触发。",
    rarity: "rare",
    symbol: "thorns",
    maxStacks: 4,
    eligible: () => true,
    apply: (player) => {
      player.stats.thorns++;
    },
    preview: (player) =>
      `${t("受击反击", "Hit retaliation")} ${player.stats.thorns * 18} → ${(player.stats.thorns + 1) * 18}`,
  },
  {
    type: "augment",
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
      `${t("首领增伤", "Boss bonus")} +${player.stats.focus * 20}% → +${(player.stats.focus + 1) * 20}%`,
  },
  {
    type: "augment",
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
    preview: (player) =>
      `${t("击杀回复", "Kill healing")} ${player.stats.harvest * 2} → ${(player.stats.harvest + 1) * 2}`,
  },
  ...EXTRA_CARDS,
  statCard({
    id: "overflow",
    name: "余血屏障",
    description:
      "战斗中过量治疗的 10% 转为护盾，基础储量上限为最大生命的 20%；可与吸血、回复联动。",
    synergy: "blood",
    symbol: "ward",
    field: "overheal",
    amount: 0.1,
    label: "过量转盾",
    labelEn: "Overheal conversion",
    unit: "percent",
    maxStacks: 3,
    offense: false,
  }),
  {
    type: "augment",
    id: "reservoir",
    name: "血铸容器",
    description: "过量治疗转盾 +5 个百分点，储量上限 +10% 最大生命；可单独启动转盾。",
    synergy: "bastion",
    rarity: "rare",
    symbol: "ward",
    maxStacks: 3,
    offense: false,
    eligible: () => true,
    apply: (player) => {
      player.stats.overheal += 0.05;
      player.stats.shieldCapacity += 0.1;
    },
    preview: () =>
      t(
        "过量转盾 +5% · 转盾储量上限 +10% 最大生命",
        "Overheal conversion +5% · Conversion capacity +10% Maximum HP",
      ),
  },
  statCard({
    id: "shield-leech",
    name: "赤盾汲取",
    description:
      "持有护盾时基础普攻吸血 +2 个百分点（实际 +1.7）；护盾耗尽后失效，与过量治疗转盾联动。",
    synergy: "blood",
    symbol: "bloodpact",
    field: "shieldLeech",
    amount: 0.02,
    label: "有盾额外吸血",
    labelEn: "Shielded bonus lifesteal",
    unit: "percent",
    maxStacks: 3,
    offense: false,
  }),
  statCard({
    id: "giant-slayer",
    name: "巨人杀手",
    synergy: "giantslayer",
    symbol: "focus",
    offense: true,
    description: "主弹直接命中额外造成目标最大生命 0.25% 的伤害；高血量目标承受更多伤害。",
    field: "giantSlayer",
    amount: 0.0025,
    label: "主弹最大生命伤害",
    labelEn: "Primary maximum-HP damage",
    unit: "percent",
    maxStacks: 4,
  }),
  statCard({
    id: "titan-breaker",
    name: "撼岳之力",
    synergy: "giantslayer",
    symbol: "damage",
    offense: true,
    description: "普攻额外增伤为 4% × log₂(1 + 敌人最大生命 / 玩家最大生命)，随目标体量成长。",
    field: "giantPower",
    amount: 0.04,
    label: "体量增伤系数",
    labelEn: "Size damage coefficient",
    unit: "percent",
    maxStacks: 4,
  }),
  statCard({
    id: "colossus-hunt",
    name: "猎神誓约",
    synergy: "giantslayer",
    symbol: "execution",
    offense: true,
    description: "对最大生命达到玩家 5 倍的敌人，普攻每层额外增伤 15%。",
    field: "giantHunt",
    amount: 0.15,
    label: "巨物普攻增伤",
    labelEn: "Giant basic damage bonus",
    unit: "percent",
    maxStacks: 4,
  }),
  statCard({
    id: "life-rend",
    name: "生命撕裂",
    synergy: "erosion",
    symbol: "piercing",
    offense: true,
    description: "主弹直接命中额外造成目标最大生命 0.2% 的伤害，与巨人杀手合计最高 5%。",
    field: "maxHealthDamage",
    amount: 0.002,
    label: "主弹最大生命侵蚀",
    labelEn: "Primary maximum-HP erosion",
    unit: "percent",
    maxStacks: 4,
  }),
  statCard({
    id: "decay",
    name: "衰亡刻痕",
    synergy: "erosion",
    symbol: "damage",
    offense: true,
    description: "主弹直接命中额外造成目标当前生命 1% 的伤害，羁绊后最高 10%。",
    field: "currentHealthDamage",
    amount: 0.01,
    label: "主弹当前生命伤害",
    labelEn: "Primary current-HP damage",
    unit: "percent",
    maxStacks: 4,
  }),
  statCard({
    id: "entropy",
    name: "熵蚀脉冲",
    synergy: "erosion",
    symbol: "storm",
    offense: true,
    description: "每 4 秒对全场敌人造成每层 0.5% 最大生命伤害；羁绊缩短间隔，单次最高 5%。",
    field: "erosionPulse",
    amount: 0.005,
    label: "全场最大生命侵蚀",
    labelEn: "Arena maximum-HP erosion",
    unit: "percent",
    maxStacks: 4,
  }),
  ...EPIC_CARDS,
];

export const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

export function isControlCard(card: Card): boolean {
  return card.synergy === "frost" || card.synergy === "dominion";
}

export function isFirstStageExcluded(card: Card): boolean {
  return !["barrage", "might", "precision", "storm"].includes(card.synergy);
}

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
  stageIndex = 0,
  policy?: RewardPolicy,
): string[] {
  const eligible = eligibleCards(player, stacks).filter(
    (card) =>
      (stageIndex > 0 || policy?.firstStageRestriction === false || !isFirstStageExcluded(card)) &&
      (policy?.cardWeights[card.id] ?? 1) > 0,
  );
  const weight = (card: Card) => policy?.cardWeights[card.id] ?? 1;
  if (policy?.mode === "weighted")
    return weightedShuffle(eligible, weight, random)
      .slice(0, 3)
      .map((card) => card.id);
  const pool = weightedShuffle(
    eligible.filter((card) => card.rarity !== "epic"),
    weight,
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
  if (
    epics.length > 0 &&
    (source === "stage" || collected >= 3) &&
    random() < (policy?.epicChance ?? 0.25)
  ) {
    const promoted = weightedShuffle(epics, weight, random);
    const epic = promoted.find((card) => card.synergy === focused) ?? promoted[0];
    if (epic) {
      // Preserve a foundation option even when the epic itself is defensive.
      const replacement = choices.findIndex((card) => !foundations.has(card.id));
      if (choices.length === 0) choices.push(epic);
      else choices[replacement >= 0 ? replacement : choices.length - 1] = epic;
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
