import type { AttackPolicy } from "../game/types";

export interface Stage {
  name: string;
  subtitle: string;
  color: number;
  sentinelChance: number;
  health: number;
  speed: number;
  damage: number;
  spawnInterval: number;
  enemyCount: number;
  maxEnemies: number;
  growth: number;
  rangedEvery: number;
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
    enemyCount: 40,
    maxEnemies: 14,
    growth: 1,
    rangedEvery: 0,
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
    supportInterval: 9,
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
    enemyCount: 42,
    maxEnemies: 18,
    growth: 1,
    rangedEvery: 0,
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
    supportInterval: 8,
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
    enemyCount: 44,
    maxEnemies: 21,
    growth: 1,
    rangedEvery: 0,
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
    supportInterval: 7,
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
    enemyCount: 48,
    maxEnemies: 28,
    growth: 1,
    rangedEvery: 0,
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
    supportInterval: 6,
  },
];

// Count is a per-stage spawn budget, separate from the bounded simultaneous pool.
// The first three endless stages compound by 30%; subsequent stages compound by 10%.
export function stageAt(index: number): Stage {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("Invalid stage index");
  const authored = STAGES[index];
  if (authored) return authored;
  const theme = STAGES[index % STAGES.length];
  const finale = STAGES[STAGES.length - 1];
  if (!theme || !finale) throw new Error("Missing stage configuration");
  const depth = index - STAGES.length + 1;
  // Only protects numeric overflow in unreachable depths; no gameplay-scale plateau.
  const growth = Math.exp(
    Math.min(500, Math.min(depth, 3) * Math.log(1.3) + Math.max(0, depth - 3) * Math.log(1.1)),
  );
  const enemyCount = Math.ceil(finale.enemyCount * growth);
  return {
    ...theme,
    name: `${theme.name} · 无尽 ${depth}`,
    subtitle: `敌人数量与生命较上一关 +${depth <= 3 ? 30 : 10}%；每 4 只常规敌人含 1 名远程术士。`,
    sentinelChance: finale.sentinelChance,
    attackPolicy: { ...finale.attackPolicy },
    bossFan: finale.bossFan,
    bossInterval: finale.bossInterval,
    specialDamage: finale.specialDamage,
    chargeTime: finale.chargeTime,
    health: finale.health * growth,
    growth,
    enemyCount,
    maxEnemies: finale.maxEnemies,
    rangedEvery: 4,
    damage: Math.min(4, finale.damage * 1.04 ** Math.min(depth, 100)),
    speed: finale.speed,
    spawnInterval: (finale.bossAt - 0.8) / enemyCount,
    bossAt: finale.bossAt,
    bossHp: Math.round(finale.bossHp * growth),
    deadline: finale.deadline,
    interrupt: Math.round(finale.interrupt * Math.sqrt(growth)),
    supportInterval: Math.max(0.5, finale.supportInterval / growth),
  };
}
