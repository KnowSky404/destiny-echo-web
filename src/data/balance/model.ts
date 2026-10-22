import { CONFIG } from "../../game/config";
import type { EnemyKind, Player, Reward, Stats } from "../../game/types";
import type { Stage } from "../stages";

export const BASE_STATS: Stats = {
  damage: 12,
  interval: 0.34,
  projectiles: 1,
  piercing: 0,
  maxHp: 100,
  execution: 0,
  fuse: 0,
  bloodpact: 0,
  thorns: 0,
  focus: 0,
  harvest: 0,
  power: 0,
  crush: 0,
  lifesteal: 0,
  regeneration: 0,
  recovery: 0,
  critChance: 0,
  critDamage: 1.5,
  expose: 0,
  chain: 0,
  splash: 0,
  storm: 0,
  slow: 0,
  frostbite: 0,
  frostPulse: 0,
  stun: 0,
  control: 0,
  controlPulse: 0,
  overheal: 0,
  shieldCapacity: 0,
  shieldLeech: 0,
  giantSlayer: 0,
  giantPower: 0,
  giantHunt: 0,
  maxHealthDamage: 0,
  currentHealthDamage: 0,
  erosionPulse: 0,
};

export type NumericField = readonly [label: string, min: number, max: number, integer?: boolean];
const value = (label: string, min = 0, max = 1e12, integer = false): NumericField => [
  label,
  min,
  max,
  integer,
];
export const STAT_FIELDS: Record<keyof Stats, NumericField> = {
  damage: value("基础伤害"),
  interval: value("基础攻击间隔 / 秒", 0.001, 3600),
  projectiles: value("基础弹数", 1, 6, true),
  piercing: value("额外穿透", 0, 64, true),
  maxHp: value("生命上限", 1),
  execution: value("防线裁决层数", 0, 1000, true),
  fuse: value("击杀爆炸层数", 0, 1000, true),
  bloodpact: value("献祭层数", 0, 1000, true),
  thorns: value("荆棘层数", 0, 1000, true),
  focus: value("首领增伤层数", 0, 1000, true),
  harvest: value("击杀恢复层数", 0, 1000, true),
  power: value("攻击加成 / 比例"),
  crush: value("重击加成 / 比例"),
  lifesteal: value("基础吸血 / 比例", 0, 1),
  regeneration: value("每秒恢复"),
  recovery: value("治疗加成 / 比例"),
  critChance: value("基础暴击率 / 比例", 0, 1),
  critDamage: value("暴击倍率", 1, 1000),
  expose: value("半血增伤 / 比例"),
  chain: value("闪电跳跃数", 0, 64, true),
  splash: value("溅射层数", 0, 1000, true),
  storm: value("雷暴层数", 0, 1000, true),
  slow: value("命中减速 / 比例", 0, 0.9),
  frostbite: value("减速增伤 / 比例"),
  frostPulse: value("寒潮层数", 0, 1000, true),
  stun: value("命中眩晕 / 秒", 0, 3600),
  control: value("控制增伤 / 比例"),
  controlPulse: value("遗世庇护层数", 0, 1000, true),
  overheal: value("过量转盾 / 比例", 0, 1),
  shieldCapacity: value("转盾容量 / 比例", 0, 1),
  shieldLeech: value("有盾吸血 / 比例", 0, 1),
  giantSlayer: value("巨人杀手 / 比例", 0, 1),
  giantPower: value("体量增伤系数", 0, 1000),
  giantHunt: value("巨物增伤 / 比例"),
  maxHealthDamage: value("最大生命侵蚀 / 比例", 0, 1),
  currentHealthDamage: value("当前生命侵蚀 / 比例", 0, 1),
  erosionPulse: value("侵蚀脉冲 / 比例", 0, 1),
};
export const ENEMY_FIELDS = {
  hp: value("基础生命", 1),
  radius: value("碰撞半径", 1, 100),
  speed: value("移动速度", 0, 1000),
  interval: value("攻击间隔 / 秒", 0.01, 3600),
  damage: value("基础伤害"),
  score: value("击杀分数", 0, 1e9, true),
  preparation: value("准备时间 / 秒", 0, 3600),
  fan: value("弹幕数", 1, 32, true),
  shotSpeed: value("弹速", 1, 5000),
} satisfies Record<string, NumericField>;
export type EnemyNumbers = Record<keyof typeof ENEMY_FIELDS, number>;
export const DEFAULT_ENDLESS = {
  healthGrowth: 2,
  damageGrowth: 1.08,
  timingGrowth: 0.97,
  damageMultiplier: CONFIG.endless.damageMultiplier,
  attackTiming: CONFIG.endless.attackTiming,
  populationCap: CONFIG.endless.populationCap,
  escortCap: CONFIG.endless.escortCap,
  summonCount: CONFIG.endless.summonCount,
  supplies: CONFIG.endless.supplies,
  summonMultiplier: CONFIG.endless.summonMultiplier,
  slamDamage: CONFIG.endless.slamDamage,
  slamDamagePerStage: CONFIG.endless.slamDamagePerStage,
};
export type EndlessNumbers = { [K in keyof typeof DEFAULT_ENDLESS]: number };
export const ENDLESS_FIELDS: Record<keyof EndlessNumbers, NumericField> = {
  healthGrowth: value("每层生命与预算成长倍率", 1, 10),
  damageGrowth: value("每层伤害成长倍率", 1, 3),
  timingGrowth: value("每层攻击计时倍率", 0.1, 1),
  damageMultiplier: value("无尽伤害倍率", 0, 100),
  attackTiming: value("初始攻击计时倍率", 0.01, 100),
  populationCap: value("标准出怪预算上限", 1, 10000, true),
  escortCap: value("标准援军批次上限", 1, 100, true),
  summonCount: value("技能召唤数", 0, 64, true),
  supplies: value("每关补给次数", 0, 12, true),
  summonMultiplier: value("强化召唤倍率", 0.01, 100),
  slamDamage: value("重击基础伤害"),
  slamDamagePerStage: value("重击逐层增加"),
};
export const STAGE_FIELDS = {
  health: value("小怪生命倍率", 0.01),
  speed: value("移动倍率", 0.01, 100),
  damage: value("敌方伤害倍率", 0, 1000),
  enemyCount: value("出怪预算（四车道基准）", 0, 10000, true),
  maxEnemies: value("场内容量（四车道基准）", 2, CONFIG.limits.enemies, true),
  spawnInterval: value("出怪间隔 / 秒", CONFIG.fixedStep, 3600),
  populationScale: value("浓缩倍率", 0.01),
  attackTiming: value("攻击计时倍率", 0.01, 100),
  bossAt: value("首领出现 / 秒", 0, 3600),
  bossHp: value("首领生命", 1),
  bossFan: value("首领弹幕数", 1, 32, true),
  bossInterval: value("首领攻击间隔倍率", 0.01, 100),
  specialDamage: value("蓄力攻击伤害"),
  chargeTime: value("蓄力时间 / 秒", 0.31, 3600),
  interrupt: value("打断所需伤害", 1),
  supportInterval: value("援军间隔 / 秒", 0.01, 3600),
  supportCount: value("援军批次（四车道基准）", 0, 10000, true),
} satisfies Record<string, NumericField>;
export type StagePatch = Partial<Pick<Stage, keyof typeof STAGE_FIELDS>>;
export type MinionKind = Exclude<EnemyKind, "boss">;
export const MINION_KINDS: readonly MinionKind[] = ["wisp", "sentinel", "hexer", "tank", "wizard"];
export type KindWeights = Record<MinionKind, number>;
export type RewardSource = Reward["source"];
export const REWARD_SOURCES: readonly RewardSource[] = ["chest", "supply", "stage"];
export interface RewardPolicy {
  mode: "guided" | "weighted";
  epicChance: number;
  firstStageRestriction: boolean;
  cardWeights: Record<string, number>;
  trainingWeights: Record<string, number>;
}
export interface StageRule {
  from: number;
  to: number | null;
  stage: StagePatch;
  kindWeights: KindWeights | null;
  rewards: Partial<Record<RewardSource, RewardPolicy>>;
}
export interface BalanceProfile {
  schemaVersion: 1;
  baseline: "balance-v1";
  id: string;
  revision: number;
  name: string;
  payload: {
    player: { hp: number; shield: number; stats: Stats };
    enemies: Record<EnemyKind, EnemyNumbers>;
    endless: EndlessNumbers;
    rewards: Record<RewardSource, RewardPolicy>;
    stageRules: StageRule[];
  };
}
export type PlayerSetup = BalanceProfile["payload"]["player"];
export type PlayerValues = Pick<
  Player,
  | "hp"
  | "shield"
  | "invulnerable"
  | "poisonTime"
  | "woundTime"
  | "poisonDamageBonus"
  | "poisonSlowBonus"
>;
export const PLAYER_FIELDS: Record<keyof PlayerValues, NumericField> = {
  hp: value("当前生命"),
  shield: value("当前护盾"),
  invulnerable: value("剩余无敌 / 秒", 0, 3600),
  poisonTime: value("中毒剩余 / 秒", 0, 3600),
  woundTime: value("重伤剩余 / 秒", 0, 3600),
  poisonDamageBonus: value("叠毒每秒额外伤害"),
  poisonSlowBonus: value("叠毒攻速惩罚 / 比例", 0, 0.9),
};
