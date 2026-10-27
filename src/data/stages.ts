import { arenaLayout } from "../game/arena";
import { CONFIG } from "../game/config";
import type { AttackPolicy } from "../game/types";
import {
  DEFAULT_ENDLESS,
  DEFAULT_EVOLUTION,
  type EndlessNumbers,
  type EvolutionNumbers,
} from "./balance/model";
import { endlessGrowth } from "./endless";
import { ENEMIES } from "./enemies";

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
  populationScale: number;
  attackPolicy: AttackPolicy;
  bossAt: number;
  attackTiming: number;
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
  | "attackTiming"
  | "health"
  | "enemyCount"
  | "growth"
  | "populationScale"
  | "spawnInterval"
  | "supportInterval"
  | "supportCount"
>;

function campaignStage(index: number, encounter: CampaignEncounter): Stage {
  const growth = 1.5 ** index;
  const enemyCount = Math.ceil(40 * growth);
  return {
    ...encounter,
    health: growth,
    attackTiming: 1,
    enemyCount,
    growth,
    populationScale: 1,
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
    bossName: "终愿之器 · 命运归零",
    bossHp: 11000,
    bossFan: 5,
    bossInterval: 0.8,
    specialDamage: 34,
    chargeTime: 1.8,
    interrupt: 220,
  }),
];

/** Stretch the authored chest opportunities over a longer combat wave without
 * granting additional cards merely because the pre-boss phase lasts longer. */
export function campaignChestTiming(index: number, bossAt: number) {
  const authored = STAGES[index];
  if (!authored) throw new Error("Missing campaign encounter");
  const first = CONFIG.chestFirstAt;
  const authoredLast = Math.min(CONFIG.chestLastAt, authored.bossAt - 5);
  const count = Math.max(0, Math.floor((authoredLast - first) / CONFIG.chestInterval) + 1);
  const last =
    bossAt > authored.bossAt
      ? Math.max(first, bossAt - 5)
      : Math.min(CONFIG.chestLastAt, bossAt - 5);
  const interval =
    bossAt > authored.bossAt && count > 1 ? (last - first) / (count - 1) : CONFIG.chestInterval;
  return { first, last, interval, count };
}

// Physical capacity follows arena geometry; bosses share the health pressure.
export function stageAt(
  index: number,
  width: number = CONFIG.width,
  tuning: EndlessNumbers = DEFAULT_ENDLESS,
  tankHp = ENEMIES.tank.hp,
  evolution: EvolutionNumbers = DEFAULT_EVOLUTION,
  resolvedFinale?: Stage,
): Stage {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("Invalid stage index");
  const arena = arenaLayout(width);
  const population = arena.laneCount / 4;
  const authored = STAGES[index];
  if (authored) {
    const enemyCount = Math.ceil(authored.enemyCount * population);
    return {
      ...authored,
      enemyCount,
      maxEnemies: Math.min(arena.encounterCapacity, Math.ceil(authored.maxEnemies * population)),
      spawnInterval: (authored.bossAt - 0.8) / enemyCount,
      supportCount: Math.ceil(authored.supportCount * population),
    };
  }
  const theme = STAGES[index % STAGES.length];
  const finale = resolvedFinale ?? STAGES[STAGES.length - 1];
  if (!theme || !finale) throw new Error("Missing stage configuration");
  const depth = index - STAGES.length + 1;
  // Only protects numeric overflow in unreachable depths; no gameplay-scale plateau.
  const growth = endlessGrowth(depth, evolution);
  const healthTail = 1 + 0.08 * Math.max(0, depth - 5);
  // Depth pressure is represented once. Native stars spend the same finite
  // population budget instead of multiplying an exponential overflow again.
  const enemyCount = Math.min(
    Math.ceil(72 * population),
    Math.ceil(tuning.populationCap * population),
  );
  const supportCount = Math.min(
    Math.ceil(4 * population),
    Math.ceil(tuning.escortCap * population),
  );
  const populationScale = 1;
  return {
    ...theme,
    name: `${theme.name} · 无尽 ${depth}`,
    subtitle: `分段击破怪群与小首领后迎战主首领；场内最多 ${arena.encounterCapacity} 个敌人。每层三次补给，清场后推进。`,
    attackPolicy: { ...finale.attackPolicy },
    bossFan: finale.bossFan,
    bossInterval: finale.bossInterval,
    specialDamage: finale.specialDamage,
    chargeTime: finale.chargeTime,
    health: finale.health * growth * healthTail,
    growth,
    populationScale,
    enemyCount,
    maxEnemies: arena.encounterCapacity,
    damage: Math.min(4, finale.damage * (1 + (depth - 1) * 0.035)) * tuning.damageMultiplier,
    attackTiming: Math.max(0.7, tuning.attackTiming / (1 + (depth - 1) * 0.015)),
    speed: finale.speed,
    spawnInterval: Math.max(0.55, 1.2 / population),
    bossAt: finale.bossAt,
    bossHp: Math.round(
      Math.max(
        finale.bossHp * growth,
        tankHp *
          finale.health *
          growth *
          populationScale *
          tuning.summonMultiplier *
          CONFIG.fusion.health ** (CONFIG.fusion.maxStars - 1) *
          1.8,
      ) * healthTail,
    ),
    interrupt: Math.round(finale.interrupt * Math.sqrt(growth)),
    supportInterval: finale.supportInterval,
    supportCount,
  };
}
