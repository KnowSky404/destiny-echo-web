import type { EnemyKind } from "../game/types";

export const ENEMIES: Record<
  EnemyKind,
  {
    name: string;
    hp: number;
    radius: number;
    speed: number;
    interval: number;
    damage: number;
    score: number;
  }
> = {
  wisp: { name: "游离残响", hp: 24, radius: 16, speed: 72, interval: 2.5, damage: 12, score: 100 },
  sentinel: {
    name: "棱镜守卫",
    hp: 40,
    radius: 21,
    speed: 38,
    interval: 2,
    damage: 16,
    score: 180,
  },
  boss: {
    name: "失控圣杯 · 空愿之器",
    hp: 1000,
    radius: 48,
    speed: 0,
    interval: 1.2,
    damage: 18,
    score: 3000,
  },
};
