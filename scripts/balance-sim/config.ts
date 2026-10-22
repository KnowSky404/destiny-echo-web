import type { StrategyConfig } from "../../src/balance-sim/types";
import { arenaLayout, DESKTOP_WIDTH } from "../../src/game/arena";
import { CONFIG } from "../../src/game/config";
import { seededRandom } from "../../src/game/random";

export interface Observations {
  provisional: true;
  winRate?: [number, number];
  durationP90?: number;
  unresolvedRatio: number;
  layoutGap: number;
  stageDrop: number;
  strategyGain: number;
  buildConcentration: number;
}
export interface ExperimentConfig {
  schemaVersion: 1;
  mode: "campaign" | "endless";
  seeds: number[];
  validationSeeds: number[];
  strategies: StrategyConfig[];
  layouts: { id: string; width: number }[];
  maxSteps: number;
  maxSeconds: number;
  endlessTarget: number;
  maxRuns: number;
  trace: boolean;
  sampleIntervalSeconds: number;
  traceCapacity: number;
  deathWindowSeconds: number;
  eventCapacity: number;
  observations: Observations;
}
export function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${label}: expected integer ${min}..${max}`);
  return value;
}
export function number(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label}: expected finite number ${min}..${max}`);
  return value;
}
export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}: expected object`);
  return value as Record<string, unknown>;
}
export function keys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw new Error(`${label}.${key}: unknown option`);
}
export function seedSet(masterSeed: number, count: number): number[] {
  integer(masterSeed, "masterSeed", 0, 0xffffffff);
  integer(count, "seedCount", 1, 10000);
  const random = seededRandom(masterSeed);
  const result = new Set<number>();
  while (result.size < count) result.add(Math.floor(random() * 0x100000000));
  return [...result];
}
export function preset(name: string): ExperimentConfig {
  if (!["smoke", "standard", "deep"].includes(name))
    throw new Error("preset: expected smoke, standard, or deep");
  const count = name === "smoke" ? 2 : name === "standard" ? 100 : 500;
  return {
    schemaVersion: 1,
    mode: "campaign",
    seeds: seedSet(20261022, count),
    validationSeeds: seedSet(20261023, count),
    strategies: [{ name: "random-auto" }, { name: "build-auto" }, { name: "build-active" }],
    layouts: [
      { id: "portrait", width: CONFIG.width },
      { id: "desktop", width: DESKTOP_WIDTH },
    ],
    maxSteps: 120 * 650,
    maxSeconds: 650,
    endlessTarget: 2,
    maxRuns: name === "deep" ? 12000 : 5000,
    trace: false,
    sampleIntervalSeconds: 1,
    traceCapacity: 1000,
    deathWindowSeconds: 8,
    eventCapacity: 400,
    observations: {
      provisional: true,
      unresolvedRatio: 0.05,
      layoutGap: 0.2,
      stageDrop: 0.35,
      strategyGain: 0.1,
      buildConcentration: 0.6,
    },
  };
}
export function parseExperiment(input: unknown, base = preset("smoke")): ExperimentConfig {
  const data = object(input, "experiment");
  keys(data, [...Object.keys(base), "masterSeed", "seedCount"], "experiment");
  const result = { ...base, ...data } as ExperimentConfig;
  if (result.schemaVersion !== 1) throw new Error("experiment.schemaVersion: expected 1");
  if (result.mode !== "campaign" && result.mode !== "endless")
    throw new Error("experiment.mode: expected campaign or endless");
  if (data.masterSeed !== undefined || data.seedCount !== undefined) {
    if (data.seeds !== undefined) throw new Error("Use seeds OR masterSeed/seedCount");
    result.seeds = seedSet(
      integer(data.masterSeed, "masterSeed", 0, 0xffffffff),
      integer(data.seedCount, "seedCount", 1, 10000),
    );
  }
  for (const field of ["seeds", "validationSeeds"] as const) {
    const values = result[field];
    if (!Array.isArray(values) || values.length > 10000 || (field === "seeds" && !values.length))
      throw new Error(`${field}: expected bounded seed list`);
    values.forEach((seed) => {
      integer(seed, field, 0, 0xffffffff);
    });
    if (new Set(values).size !== values.length) throw new Error(`${field}: duplicate seeds`);
    result[field] = [...values];
  }
  if (result.validationSeeds.some((seed) => result.seeds.includes(seed)))
    throw new Error("Validation seeds must be disjoint from selection seeds");
  if (
    !Array.isArray(result.strategies) ||
    !result.strategies.length ||
    result.strategies.length > 32
  )
    throw new Error("strategies: expected 1..32 configurations");
  if (!Array.isArray(result.layouts) || !result.layouts.length || result.layouts.length > 8)
    throw new Error("layouts: expected 1..8");
  result.layouts = result.layouts.map((layout) => {
    const item = object(layout, "layout");
    keys(item, ["id", "width"], "layout");
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,50}$/.test(item.id))
      throw new Error("layout.id: invalid");
    const width = number(item.width, "layout.width", CONFIG.width, 2400);
    arenaLayout(width);
    return { id: item.id, width };
  });
  if (
    new Set(result.layouts.map((item) => item.id)).size !== result.layouts.length ||
    new Set(result.layouts.map((item) => item.width)).size !== result.layouts.length
  )
    throw new Error("Duplicate layouts");
  result.maxSteps = integer(result.maxSteps, "maxSteps", 1, 12_000_000);
  result.maxSeconds = number(result.maxSeconds, "maxSeconds", CONFIG.fixedStep, 86400);
  result.endlessTarget = integer(result.endlessTarget, "endlessTarget", 1, 251);
  result.maxRuns = integer(result.maxRuns, "maxRuns", 1, 100000);
  if (typeof result.trace !== "boolean") throw new Error("trace: expected boolean");
  result.sampleIntervalSeconds = number(
    result.sampleIntervalSeconds,
    "sampleIntervalSeconds",
    CONFIG.fixedStep,
    3600,
  );
  result.traceCapacity = integer(result.traceCapacity, "traceCapacity", 1, 10000);
  result.eventCapacity = integer(result.eventCapacity, "eventCapacity", 1, 10000);
  result.deathWindowSeconds = number(result.deathWindowSeconds, "deathWindowSeconds", 0, 60);
  const obs = object(result.observations, "observations");
  keys(
    obs,
    [
      "provisional",
      "winRate",
      "durationP90",
      "unresolvedRatio",
      "layoutGap",
      "stageDrop",
      "strategyGain",
      "buildConcentration",
    ],
    "observations",
  );
  if (obs.provisional !== true) throw new Error("Thresholds must be marked provisional:true");
  result.observations = { ...base.observations, ...obs };
  for (const key of [
    "unresolvedRatio",
    "layoutGap",
    "stageDrop",
    "strategyGain",
    "buildConcentration",
  ] as const)
    number(result.observations[key], key, 0, 1);
  if (result.observations.durationP90 !== undefined)
    number(result.observations.durationP90, "durationP90", 0, 86400);
  if (result.observations.winRate !== undefined) {
    const interval = result.observations.winRate;
    if (!Array.isArray(interval) || interval.length !== 2)
      throw new Error("winRate: expected [min,max]");
    number(interval[0], "winRate.min", 0, 1);
    number(interval[1], "winRate.max", interval[0], 1);
  }
  delete (result as unknown as Record<string, unknown>).masterSeed;
  delete (result as unknown as Record<string, unknown>).seedCount;
  return structuredClone(result);
}
export function plannedRuns(config: ExperimentConfig, profiles = 1, validation = false): number {
  const count =
    (config.seeds.length + (validation ? config.validationSeeds.length : 0)) *
    config.strategies.length *
    config.layouts.length *
    profiles;
  if (count > config.maxRuns)
    throw new Error(`Planned ${count} runs exceeds maxRuns=${config.maxRuns}`);
  return count;
}
