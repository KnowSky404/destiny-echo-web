import type { AttackPolicy, EnemyKind } from "../game/types";

export const CAMPAIGN_KINDS = ["wisp", "sentinel", "hexer"] as const;
export const ENDLESS_KINDS = ["wisp", "tank", "wizard"] as const;

export interface EnemyDefinition {
  name: string;
  hp: number;
  radius: number;
  speed: number;
  interval: number;
  damage: number;
  score: number;
  preparation: number;
  attackPolicy: AttackPolicy;
  fan: number;
  shotSpeed: number;
  attackStyle: "melee" | "ranged";
}

export const ENEMIES: Record<EnemyKind, EnemyDefinition> = {
  wisp: {
    name: "游离残响",
    hp: 50,
    radius: 16,
    speed: 112,
    interval: 3.2,
    damage: 6,
    score: 100,
    preparation: 1.4,
    attackPolicy: { type: "defense" },
    fan: 1,
    shotSpeed: 155,
    attackStyle: "melee",
  },
  sentinel: {
    name: "棱镜守卫",
    hp: 108,
    radius: 21,
    speed: 86,
    interval: 3.8,
    damage: 9,
    score: 180,
    preparation: 1.8,
    attackPolicy: { type: "defense" },
    fan: 3,
    shotSpeed: 140,
    attackStyle: "melee",
  },
  hexer: {
    name: "蚀光术士",
    hp: 66,
    radius: 18,
    speed: 96,
    interval: 2.8,
    damage: 7,
    score: 160,
    preparation: 1.2,
    attackPolicy: { type: "region", y: 120 },
    fan: 1,
    shotSpeed: 190,
    attackStyle: "ranged",
  },
  tank: {
    name: "嘲讽巨像",
    hp: 500,
    radius: 23,
    speed: 72,
    interval: 4,
    damage: 9,
    score: 250,
    preparation: 1.8,
    attackPolicy: { type: "defense" },
    fan: 1,
    shotSpeed: 140,
    attackStyle: "melee",
  },
  wizard: {
    name: "腐毒巫师",
    hp: 250,
    radius: 19,
    speed: 92,
    interval: 3.4,
    damage: 7,
    score: 220,
    preparation: 1.2,
    attackPolicy: { type: "region", y: 120 },
    fan: 1,
    shotSpeed: 190,
    attackStyle: "ranged",
  },
  boss: {
    name: "失控圣杯 · 空愿之器",
    hp: 2000,
    radius: 48,
    speed: 112,
    interval: 2.7,
    damage: 10,
    score: 3000,
    preparation: 2,
    attackPolicy: { type: "defense" },
    fan: 3,
    shotSpeed: 170,
    attackStyle: "ranged",
  },
};
