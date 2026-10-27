import type { EnemyKind } from "./types";

/** Value snapshots only: a defeated enemy can immediately release its combat slot. */
export interface DeathEcho {
  readonly id: number;
  readonly kind: EnemyKind;
  readonly role: "minion" | "elite" | "boss";
  readonly x: number;
  readonly y: number;
  readonly color: number;
  life: number;
  readonly maxLife: number;
  readonly stars: number;
}

/** Cosmetic effects never own targets, apply damage or consume gameplay randomness. */
export interface CombatEffect {
  readonly id: number;
  readonly kind: "chain" | "erosion" | "impact" | "blast" | "frost";
  readonly x: number;
  readonly y: number;
  readonly toX?: number;
  readonly toY?: number;
  readonly radius: number;
  readonly color: number;
  life: number;
  readonly maxLife: number;
}

export const PRESENTATION_LIMITS = { deaths: 64, effects: 96 } as const;

export function presentationProgress(effect: {
  readonly life: number;
  readonly maxLife: number;
}): number {
  return Math.max(0, Math.min(1, 1 - effect.life / Math.max(1e-9, effect.maxLife)));
}
