import type { AttackPolicy, EnemyKind } from "../game/types";

export interface Stage {
  name: string;
  subtitle: string;
  color: number;
  sentinelChance: number;
  health: number;
  speed: number;
  damage: number;
  spawnInterval: number;
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
  support: { kind: Exclude<EnemyKind, "boss">; interval: number } | null;
}

export const STAGES: readonly Stage[] = [
  {
    name: "圣杯前庭",
    subtitle: "游离残响正在聚集。击破宝箱，启动你的第一条流派。",
    color: 0x8cc6f2,
    sentinelChance: 0.35,
    health: 1,
    speed: 1,
    damage: 1,
    spawnInterval: 1.5,
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
    support: null,
  },
  {
    name: "棱镜回廊",
    subtitle: "重甲守卫占据回廊。首领会召来援军，范围与穿透更有用。",
    color: 0xc6a5f4,
    sentinelChance: 0.7,
    health: 1.3,
    speed: 1,
    damage: 1.1,
    spawnInterval: 1.4,
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
    support: { kind: "sentinel", interval: 9 },
  },
  {
    name: "焚星熔炉",
    subtitle: "残响加速涌入，在防线前开始蓄力。优先消灭金环目标。",
    color: 0xf5a17d,
    sentinelChance: 0.2,
    health: 1.7,
    speed: 1.25,
    damage: 1.2,
    spawnInterval: 1.2,
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
    support: { kind: "wisp", interval: 7 },
  },
  {
    name: "终愿核心",
    subtitle: "密集混编与持续援军。让成型的流派改写最后的愿望。",
    color: 0xdec28a,
    sentinelChance: 0.55,
    health: 2.1,
    speed: 1.15,
    damage: 1.35,
    spawnInterval: 1.1,
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
    support: { kind: "sentinel", interval: 6 },
  },
];

export function stageAt(index: number): Stage {
  const authored = STAGES[index];
  if (authored) return authored;
  const theme = STAGES[index % STAGES.length];
  const finale = STAGES[STAGES.length - 1];
  if (!theme || !finale || index < 0 || !Number.isInteger(index))
    throw new Error("Invalid stage index");
  const depth = index - STAGES.length + 1;
  const growth = Math.min(1000, 1.25 ** depth);
  return {
    ...theme,
    name: `${theme.name} · 无尽 ${depth}`,
    subtitle: "构筑继续保留，敌人的生命与火力逐关增强。还能走多远？",
    health: finale.health * growth,
    damage: Math.min(4, finale.damage * 1.07 ** depth),
    spawnInterval: Math.max(0.9, finale.spawnInterval - depth * 0.02),
    bossHp: Math.round(finale.bossHp * growth),
    deadline: 96,
    interrupt: Math.round(finale.interrupt * Math.sqrt(growth)),
    support: theme.support ?? { kind: "wisp", interval: 7 },
  };
}
