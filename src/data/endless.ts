import { DEFAULT_EVOLUTION, type EvolutionNumbers } from "./balance/model";

export type StarLevel = 1 | 2 | 3;
export type StarWeights = Readonly<Record<StarLevel, number>>;

const STAR_WEIGHTS: readonly StarWeights[] = [
  { 1: 100, 2: 0, 3: 0 },
  { 1: 75, 2: 25, 3: 0 },
  { 1: 45, 2: 45, 3: 10 },
  { 1: 20, 2: 50, 3: 30 },
];

function validateDepth(depth: number): void {
  if (!Number.isSafeInteger(depth) || depth < 1) throw new Error("Invalid endless depth");
}

/** One growth factor is shared by every endless health baseline. */
export function endlessGrowth(
  depth: number,
  tuning: Pick<EvolutionNumbers, "growthLinear" | "growthQuadratic"> = DEFAULT_EVOLUTION,
): number {
  validateDepth(depth);
  return 1 + tuning.growthLinear * depth + tuning.growthQuadratic * depth * depth;
}

export function starWeightsAt(depth: number): StarWeights {
  validateDepth(depth);
  const band = depth <= 2 ? 0 : depth <= 5 ? 1 : depth <= 10 ? 2 : 3;
  return STAR_WEIGHTS[band] as StarWeights;
}
