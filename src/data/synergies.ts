import type { SynergyId } from "../game/types";

export interface Synergy {
  id: SynergyId;
  name: string;
  symbol: string;
  color: string;
  tiers: readonly [string, string];
}

export const SYNERGIES: readonly Synergy[] = [
  {
    id: "blast",
    name: "殉星自爆",
    symbol: "blast",
    color: "#f5a17d",
    tiers: [
      "爆炸伤害 +80%，范围扩大至 175。",
      "爆炸击杀触发连锁；献祭每 3 秒释放，额外造成最大生命 45% 的伤害。",
    ],
  },
  {
    id: "barrage",
    name: "祷言弹幕",
    symbol: "multishot",
    color: "#8cc6f2",
    tiers: ["攻击间隔再缩短 15%，副弹提升至主弹 100% 伤害。", "每第 4 轮齐射追加一整轮弹幕。"],
  },
  {
    id: "bastion",
    name: "不落壁垒",
    symbol: "ward",
    color: "#95d9be",
    tiers: [
      "每 3 秒恢复 10 护盾，自动恢复上限为最大生命的 60%。",
      "受击向全场反震最大生命 50% 的伤害；荆棘反击翻倍。",
    ],
  },
  {
    id: "judgment",
    name: "终焉裁决",
    symbol: "execution",
    color: "#c6a5f4",
    tiers: [
      "对准备或攻击中的敌人额外增伤 35%。",
      "命中斩杀生命不足 15% 的敌人（含首领）；对蓄力首领伤害翻倍。",
    ],
  },
];

export const SYNERGY_BY_ID = new Map(SYNERGIES.map((synergy) => [synergy.id, synergy]));
