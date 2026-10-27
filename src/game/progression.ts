import type { EvolutionNumbers } from "../data/balance/model";

type TrainingCurve = Pick<EvolutionNumbers, "trainingBase" | "trainingStep">;

function validateCurve(curve: TrainingCurve): void {
  if (
    !Number.isFinite(curve.trainingBase) ||
    curve.trainingBase <= 0 ||
    !Number.isFinite(curve.trainingStep) ||
    curve.trainingStep < 0
  )
    throw new Error("Invalid training curve");
}

function thresholdValue(n: number, curve: TrainingCurve): number {
  return curve.trainingBase * n + curve.trainingStep * ((n * (n - 1)) / 2);
}

/** Cumulative training credit required for the nth automatic training. */
export function trainingThreshold(n: number, curve: TrainingCurve): number {
  validateCurve(curve);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid training milestone");
  if (n === 0) return 0;
  return Math.min(Number.MAX_VALUE, thresholdValue(n, curve));
}

/** A bounded search preserves exact milestone boundaries without inverse rounding. */
export function trainingsEarned(score: number, curve: TrainingCurve): number {
  validateCurve(curve);
  if (!Number.isFinite(score) || score < 0) throw new Error("Invalid training credit");
  let low = 0;
  let high = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(score / curve.trainingBase));
  while (low < high) {
    const middle = low + Math.ceil((high - low) / 2);
    if (thresholdValue(middle, curve) <= score) low = middle;
    else high = middle - 1;
  }
  return low;
}
