import type { SynergyId } from "../game/types";

export const SYNERGY_THRESHOLDS = [3, 6, 9] as const;
export const TIER_NAMES = { 0: "未成型", 3: "小质变", 6: "中质变", 9: "大质变" } as const;

export interface Synergy {
  id: SynergyId;
  name: string;
  symbol: string;
  color: string;
  tiers: readonly [string, string, string];
}

export const SYNERGIES: readonly Synergy[] = [
  {
    id: "blast",
    name: "殉星自爆",
    symbol: "blast",
    color: "#f5a17d",
    tiers: [
      "击杀普通敌人引发基础爆炸；爆炸伤害 +40%，半径 160。",
      "爆炸击杀可连锁引爆；每 4 秒自动献祭。",
      "爆炸伤害 +100%、半径 190；每 3 秒献祭，额外造成最大生命 45% 的伤害。",
    ],
  },
  {
    id: "barrage",
    name: "祷言弹幕",
    symbol: "multishot",
    color: "#8cc6f2",
    tiers: [
      "攻击间隔再缩短 12%，副弹提升至主弹 80% 伤害。",
      "每第 4 轮齐射追加一整轮弹幕；副弹提升至 100%。",
      "攻击间隔缩短 25%，额外 1 枚弹幕，每第 3 轮追加一整轮。",
    ],
  },
  {
    id: "bastion",
    name: "不落壁垒",
    symbol: "ward",
    color: "#95d9be",
    tiers: [
      "每 3 秒恢复 10 护盾，自动恢复上限为最大生命的 60%。",
      "荆棘反击翻倍；受击向全场反震最大生命 25% 的伤害。",
      "每 3 秒恢复 20 护盾，上限为最大生命的 100%；全场反震提升至最大生命的 50%。",
    ],
  },
  {
    id: "judgment",
    name: "终焉裁决",
    symbol: "execution",
    color: "#c6a5f4",
    tiers: [
      "对准备或攻击中的敌人额外增伤 20%。",
      "斩杀生命不足 8% 的敌人（含首领），对蓄力首领伤害提升 50%。",
      "斩杀阈值提升至 15%；对蓄力首领伤害翻倍。",
    ],
  },
  {
    id: "might",
    name: "泰坦重击",
    symbol: "damage",
    color: "#e9b477",
    tiers: [
      "基础攻击伤害乘以 1.2。",
      "每第 4 轮触发重击，整轮额外增伤 30%；可与重击卡叠加。",
      "每第 3 轮重击，整轮额外增伤 80%。",
    ],
  },
  {
    id: "blood",
    name: "猩红渴望",
    symbol: "bloodpact",
    color: "#ec8ba6",
    tiers: [
      "普攻吸血额外增加 5 个百分点。",
      "战斗中过量治疗的 50% 转化为护盾，转化上限为最大生命的 40%。",
      "普攻吸血额外增加 10 个百分点，持续回复翻倍；过量治疗全额转为护盾，上限为最大生命的 80%。",
    ],
  },
  {
    id: "precision",
    name: "命定暴击",
    symbol: "critical",
    color: "#f1ce7a",
    tiers: [
      "暴击率额外增加 10 个百分点。",
      "暴击伤害倍率额外增加 0.25。",
      "暴击伤害倍率再增加 0.5，每第 3 轮齐射必定暴击。",
    ],
  },
  {
    id: "storm",
    name: "雷霆共振",
    symbol: "storm",
    color: "#a7b8fa",
    tiers: [
      "普攻命中额外跳跃 1 个目标，溅射范围增加 20。",
      "连锁再增加 2 个目标，每 4 秒自动释放雷暴。",
      "每 3 秒引发雷暴，雷暴与连锁伤害翻倍。",
    ],
  },
  {
    id: "frost",
    name: "永冬结界",
    symbol: "frost",
    color: "#9ce2ef",
    tiers: [
      "命中减速额外增加 10 个百分点，减速持续 3 秒。",
      "每命中同一敌人 4 次冻结 0.6 秒；首领冻结时间为四分之一。",
      "每 3 次命中冻结 1 秒，对减速敌人额外增伤 30%。",
    ],
  },
  {
    id: "dominion",
    name: "王权禁锢",
    symbol: "control",
    color: "#c7b7e8",
    tiers: [
      "眩晕与遗世庇护持续时间增加 30%；对受控或蓄力中的敌人额外增伤 20%。",
      "每 6 秒展开遗世庇护并净化中毒、重伤与攻速降低，清除敌方弹幕；时停期间敌方嘲讽失效，首领不减免。",
      "眩晕与遗世庇护持续时间增加 60%；击杀眩晕或时停中的敌人恢复 8 护盾，对首领蓄力的打断伤害额外增加 50%。",
    ],
  },
];

export const SYNERGY_BY_ID = new Map(SYNERGIES.map((synergy) => [synergy.id, synergy]));
