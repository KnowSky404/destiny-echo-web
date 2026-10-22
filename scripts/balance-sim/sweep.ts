import { stableStringify } from "../../src/balance-sim/encoding";
import type { BalanceProfile, NumericField } from "../../src/data/balance/model";
import {
  ENDLESS_FIELDS,
  ENEMY_FIELDS,
  STAGE_FIELDS,
  STAT_FIELDS,
} from "../../src/data/balance/model";
import { parseProfile } from "../../src/data/balance/profile";
import { integer, keys, number, object } from "./config";

export interface SweepSpec {
  paths: string[];
  values?: number[];
  multipliers?: number[];
  label: string;
}
export interface ParameterChange {
  path: string;
  before: unknown;
  after: unknown;
}
export function parameterDiff(a: unknown, b: unknown, path = "payload"): ParameterChange[] {
  if (stableStringify(a) === stableStringify(b)) return [];
  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const aa = a as Record<string, unknown>,
      bb = b as Record<string, unknown>;
    return [...new Set([...Object.keys(aa), ...Object.keys(bb)])].flatMap((key) =>
      key in aa && key in bb
        ? parameterDiff(aa[key], bb[key], `${path}.${key}`)
        : [{ path: `${path}.${key}`, before: aa[key] ?? null, after: bb[key] ?? null }],
    );
  }
  return [{ path, before: a, after: b }];
}
function fieldAt(
  profile: BalanceProfile,
  path: string,
): { parent: Record<string, unknown>; key: string; field: NumericField } {
  const parts = path.split(".");
  let fields: Record<string, NumericField>;
  if (parts[0] === "player" && parts[1] === "stats" && parts.length === 3) fields = STAT_FIELDS;
  else if (
    parts[0] === "enemies" &&
    parts.length === 3 &&
    parts[1] &&
    parts[1] in profile.payload.enemies
  )
    fields = ENEMY_FIELDS;
  else if (parts[0] === "endless" && parts.length === 2) fields = ENDLESS_FIELDS;
  else if (
    parts[0] === "stageRules" &&
    /^\d+$/.test(parts[1] ?? "") &&
    parts[2] === "stage" &&
    parts.length === 4
  ) {
    integer(Number(parts[1]), "stage rule index", 0, profile.payload.stageRules.length - 1);
    fields = STAGE_FIELDS;
  } else throw new Error(`Unsupported sweep path: ${path}`);
  const key = parts.at(-1) as string;
  if (!Object.hasOwn(fields, key)) throw new Error(`Unsupported numeric field: ${path}`);
  let parent = profile.payload as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) parent = parent[part] as Record<string, unknown>;
  if (typeof parent[key] !== "number")
    throw new Error(
      `Sweep needs an explicit base value at ${path}; create a validated experimental profile first`,
    );
  return { parent, key, field: fields[key] as NumericField };
}
export function parseSweep(input: unknown): SweepSpec {
  const data = object(input, "sweep");
  keys(data, ["paths", "values", "multipliers", "label"], "sweep");
  if (typeof data.label !== "string" || !data.label.trim() || data.label.length > 70)
    throw new Error("sweep.label: required named factor");
  if (
    !Array.isArray(data.paths) ||
    !data.paths.length ||
    data.paths.length > 20 ||
    !data.paths.every((path) => typeof path === "string")
  )
    throw new Error("sweep.paths: expected 1..20 controlled numeric paths");
  if (new Set(data.paths).size !== data.paths.length) throw new Error("Duplicate sweep paths");
  if ((data.values === undefined) === (data.multipliers === undefined))
    throw new Error("Use exactly one of sweep.values or multipliers");
  const values = data.values ?? data.multipliers;
  if (!Array.isArray(values) || !values.length || values.length > 20)
    throw new Error("sweep: expected 1..20 candidates");
  values.forEach((value) => {
    number(value, "sweep candidate", 0, 1e12);
  });
  return data as unknown as SweepSpec;
}
export function sweepCandidates(
  base: BalanceProfile,
  spec: SweepSpec,
): { profile: BalanceProfile; changes: ParameterChange[] }[] {
  const result: { profile: BalanceProfile; changes: ParameterChange[] }[] = [];
  const seen = new Set([stableStringify(base.payload)]);
  for (const value of spec.values ?? spec.multipliers ?? []) {
    const candidate = structuredClone(base);
    for (const path of spec.paths) {
      const { parent, key, field } = fieldAt(candidate, path);
      const raw = spec.values ? value : (parent[key] as number) * value;
      parent[key] = field[3] ? Math.round(raw) : raw;
    }
    candidate.id = `sweep-${result.length + 1}`;
    candidate.revision = 1;
    candidate.name = `${spec.label} ${value}`.slice(0, 100);
    const profile = parseProfile(candidate);
    const hash = stableStringify(profile.payload);
    if (seen.has(hash)) continue;
    seen.add(hash);
    result.push({ profile, changes: parameterDiff(base.payload, profile.payload) });
  }
  return result;
}
