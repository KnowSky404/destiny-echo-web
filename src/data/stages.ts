import type { AttackPolicy } from "../game/types";

export interface Stage {
  name: string;
  subtitle: string;
  color: number;
  health: number;
  speed: number;
  damage: number;
  spawnInterval: number;
  enemyCount: number;
  maxEnemies: number;
  growth: number;
  attackPolicy: AttackPolicy;
  bossAt: number;
  deadline: number;
  bossName: string;
  bossHp: number;
  bossFan: number;
  bossInterval: number;
  specialDamage: number;
  chargeTime: number;
  interrupt: number;
  supportInterval: number;
  supportCount: number;
}

type CampaignEncounter = Omit<
  Stage,
  "health" | "enemyCount" | "growth" | "spawnInterval" | "supportInterval" | "supportCount"
>;

function campaignStage(index: number, encounter: CampaignEncounter): Stage {
  const growth = 1.5 ** index;
  const enemyCount = Math.ceil(40 * growth);
  return {
    ...encounter,
    health: growth,
    enemyCount,
    growth,
    spawnInterval: (encounter.bossAt - 0.8) / enemyCount,
    supportInterval: 2,
    supportCount: Math.ceil(4 * growth),
  };
}

export const STAGES: readonly Stage[] = [
  campaignStage(0, {
    name: "圣杯前庭",
    subtitle: "游离残响正在聚集。击破宝箱，启动你的第一条流派。",
    color: 0x8cc6f2,
    speed: 1,
    damage: 1,
    maxEnemies: 14,
    attackPolicy: { type: "defense" },
    bossAt: 52,
    deadline: 88,
    bossName: "失控圣杯 · 空愿之器",
    bossHp: 2000,
    bossFan: 3,
    bossInterval: 1,
    specialDamage: 26,
    chargeTime: 2,
    interrupt: 90,
  }),
  campaignStage(1, {
    name: "棱镜回廊",
    subtitle: "三类残响均衡涌入回廊。首领会召来援军，范围与穿透更有用。",
    color: 0xc6a5f4,
    speed: 1,
    damage: 1.1,
    maxEnemies: 18,
    attackPolicy: { type: "defense" },
    bossAt: 48,
    deadline: 90,
    bossName: "折光主教 · 千面棱镜",
    bossHp: 4300,
    bossFan: 5,
    bossInterval: 1,
    specialDamage: 28,
    chargeTime: 2.1,
    interrupt: 130,
  }),
  campaignStage(2, {
    name: "焚星熔炉",
    subtitle: "残响加速涌入，在防线前开始蓄力。优先消灭金环目标。",
    color: 0xf5a17d,
    speed: 1.25,
    damage: 1.2,
    maxEnemies: 21,
    attackPolicy: { type: "region", y: 450 },
    bossAt: 46,
    deadline: 90,
    bossName: "焚星之心 · 永燃余烬",
    bossHp: 7200,
    bossFan: 3,
    bossInterval: 0.8,
    specialDamage: 30,
    chargeTime: 1.9,
    interrupt: 170,
  }),
  campaignStage(3, {
    name: "终愿核心",
    subtitle: "密集混编与持续援军。让成型的流派改写最后的愿望。",
    color: 0xdec28a,
    speed: 1.15,
    damage: 1.35,
    maxEnemies: 28,
    attackPolicy: { type: "defense" },
    bossAt: 48,
    deadline: 96,
    bossName: "终愿之器 · 命运归零",
    bossHp: 11000,
    bossFan: 5,
    bossInterval: 0.8,
    specialDamage: 34,
    chargeTime: 1.8,
    interrupt: 220,
  }),
];

// Count is a per-stage spawn budget, separate from the bounded simultaneous pool.
// Every endless stage doubles population, escort packs and health.
export function stageAt(index: number): Stage {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("Invalid stage index");
  const authored = STAGES[index];
  if (authored) return authored;
  const theme = STAGES[index % STAGES.length];
  const finale = STAGES[STAGES.length - 1];
  if (!theme || !finale) throw new Error("Missing stage configuration");
  const depth = index - STAGES.length + 1;
  // Only protects numeric overflow in unreachable depths; no gameplay-scale plateau.
  const growth = Math.min(2 ** depth, Math.exp(500));
  const enemyCount = Math.ceil(finale.enemyCount * growth);
  return {
    ...theme,
    name: `${theme.name} · 无尽 ${depth}`,
    subtitle:
      "怪物数量与生命逐关翻倍；小怪、嘲讽坦克、腐毒巫师各占 1/3。每关随机发放 3 张卡，击败首领再选 1 张。",
    attackPolicy: { ...finale.attackPolicy },
    bossFan: finale.bossFan,
    bossInterval: finale.bossInterval,
    specialDamage: finale.specialDamage,
    chargeTime: finale.chargeTime,
    health: finale.health * growth,
    growth,
    enemyCount,
    maxEnemies: finale.maxEnemies,
    damage: Math.min(4, finale.damage * 1.04 ** Math.min(depth, 100)),
    speed: finale.speed,
    spawnInterval: (finale.bossAt - 0.8) / enemyCount,
    bossAt: finale.bossAt,
    bossHp: Math.round(finale.bossHp * growth),
    deadline: finale.deadline,
    interrupt: Math.round(finale.interrupt * Math.sqrt(growth)),
    supportInterval: finale.supportInterval,
    supportCount: Math.ceil(finale.supportCount * growth),
  };
}
