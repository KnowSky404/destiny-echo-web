import { CARD_BY_ID } from "../data/cards";
import { SYNERGIES, SYNERGY_THRESHOLDS } from "../data/synergies";
import { REWARD_BY_ID, TRAINING_BY_ID } from "../data/training";
import { seededRandom } from "../game/random";
import { combatStats } from "../game/stats";
import { synergyCount } from "../game/synergies";
import { isEnemy } from "../game/systems/targeting";
import type { Player } from "../game/types";
import type { World } from "../game/world";
import type { ResolvedStrategyConfig, RewardWeights, StrategyConfig } from "./types";

const DEFAULT_WEIGHTS: RewardWeights = {
  output: 28,
  survival: 18,
  investment: 1.5,
  threshold: 8,
  preference: 10,
  rarity: 1,
  fallback: 2,
};

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], name: string): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw new Error(`Unknown ${name} field: ${key}`);
}
function number(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name} must be a finite number in [${min}, ${max}]`);
  return value;
}

/** Resolves independent reward and target policies; no World RNG is consumed. */
export function resolveStrategy(config: StrategyConfig): ResolvedStrategyConfig {
  const raw = object(config, "strategy");
  keys(raw, ["name", "seed", "reward", "target"], "strategy");
  if (!["random-auto", "build-auto", "build-active", "legacy"].includes(String(raw.name)))
    throw new Error(`Unknown strategy: ${String(raw.name)}`);
  const name = config.name;
  const reward = object(raw.reward ?? {}, "strategy.reward");
  const target = object(raw.target ?? {}, "strategy.target");
  keys(reward, ["kind", "tieBreak", "preferences", "weights"], "strategy.reward");
  keys(target, ["kind", "intervalSeconds", "chestSafeHealthRatio"], "strategy.target");
  const kind =
    reward.kind ?? (name === "random-auto" ? "random" : name === "legacy" ? "legacy" : "build");
  const targetKind =
    target.kind ?? (name === "build-active" || name === "legacy" ? "active" : "auto");
  const tieBreak = reward.tieBreak ?? "first";
  if (!["random", "build", "legacy"].includes(String(kind)))
    throw new Error("Invalid reward policy kind");
  if (!["auto", "active"].includes(String(targetKind)))
    throw new Error("Invalid target policy kind");
  if (!["first", "random"].includes(String(tieBreak))) throw new Error("Invalid reward tieBreak");
  const preferences = object(reward.preferences ?? {}, "strategy.reward.preferences");
  const knownFamilies = SYNERGIES.map((family) => family.id);
  const resolvedPreferences: Record<string, number> = {};
  for (const [family, value] of Object.entries(preferences)) {
    if (!knownFamilies.includes(family as (typeof knownFamilies)[number]))
      throw new Error(`Unknown synergy preference: ${family}`);
    resolvedPreferences[family] = number(value, `Preference ${family}`, 0, 100);
  }
  const weights = object(reward.weights ?? {}, "strategy.reward.weights");
  keys(weights, Object.keys(DEFAULT_WEIGHTS), "strategy.reward.weights");
  const resolvedWeights = { ...DEFAULT_WEIGHTS };
  for (const [key, value] of Object.entries(weights))
    resolvedWeights[key as keyof RewardWeights] = number(value, `Weight ${key}`, 0, 1_000_000);
  const seed = number(raw.seed ?? 0x53545241, "Strategy seed", 0, 0xffff_ffff);
  if (!Number.isInteger(seed)) throw new Error("Strategy seed must be an unsigned 32-bit integer");
  return {
    name,
    version: targetKind === "active" && name !== "legacy" ? "2" : "1",
    seed,
    reward: {
      kind: kind as ResolvedStrategyConfig["reward"]["kind"],
      tieBreak: tieBreak as "first" | "random",
      preferences: resolvedPreferences,
      weights: resolvedWeights,
    },
    target: {
      kind: targetKind as "auto" | "active",
      intervalSeconds: number(target.intervalSeconds ?? 0.5, "Target interval", 0.1, 60),
      chestSafeHealthRatio: number(
        target.chestSafeHealthRatio ?? 0.5,
        "Chest safe health ratio",
        0,
        1,
      ),
    },
  };
}

// Kept equivalent to tests/policy.ts's active reward ranking for explicit legacy comparisons.
const LEGACY_WEIGHTS: Record<string, number> = {
  "nova-heart": 42,
  "heavenly-barrage": 43,
  "aegis-core": 30,
  "final-verdict": 38,
  "titan-heart": 44,
  "crimson-grail": 32,
  "fate-eye": 38,
  "tempest-core": 44,
  "absolute-zero": 35,
  chronocrown: 40,
  multishot: 30,
  haste: 26,
  piercing: 18,
  overload: 24,
  force: 25,
  momentum: 24,
  crush: 18,
  chain: 27,
  splash: 24,
  stormcall: 25,
  keen: 23,
  lethal: 16,
  expose: 18,
  fuse: 24,
  bloodpact: 21,
  focus: 16,
  execution: 15,
  harvest: 16,
  vitality: 12,
  ward: 10,
  thorns: 12,
  leech: 16,
  renewal: 13,
  recovery: 8,
  chill: 12,
  frostbite: 12,
  icefield: 12,
  impact: 12,
  suppression: 13,
  edict: 14,
};

function legacyScore(id: string, world: World): number {
  const card = CARD_BY_ID.get(id);
  if (!card) return -1000;
  const count = synergyCount(world.stacks, card.synergy);
  const route = count > 0 && count < 9 ? count * 5 : 0;
  const healing =
    world.player.hp < 45 && ["vitality", "ward", "leech", "renewal", "harvest"].includes(id)
      ? 20
      : 0;
  return (LEGACY_WEIGHTS[id] ?? 1) + route + healing;
}

/** A ranking heuristic only. This estimate is never reported as measured combat DPS. */
function outputEstimate(player: Player, stacks: ReadonlyMap<string, number>): number {
  const stats = combatStats(player, stacks);
  return (
    (stats.damage / stats.interval) *
    (1 + (stats.projectiles - 1) * stats.secondaryDamage) *
    (1 + stats.critChance * Math.max(0, stats.critDamage - 1))
  );
}

export interface RewardChoice {
  choice: string | undefined;
  scores: Record<string, number>;
  fallback: string[];
}

export function createStrategy(config: ResolvedStrategyConfig) {
  const rewardRandom = seededRandom(config.seed);
  let nextTargetAt = 0;
  const score = (id: string, world: World): { value: number; fallback: boolean } => {
    const item = REWARD_BY_ID.get(id);
    if (config.reward.kind === "legacy")
      return { value: legacyScore(id, world), fallback: !CARD_BY_ID.has(id) };
    if (!item) return { value: config.reward.weights.fallback, fallback: true };
    const player = structuredClone(world.player);
    const stacks = new Map(world.stacks);
    item.apply(player);
    if (item.type === "augment") stacks.set(id, (stacks.get(id) ?? 0) + 1);
    const before = combatStats(world.player, world.stacks);
    const after = combatStats(player, stacks);
    const weights = config.reward.weights;
    const currentOutput = outputEstimate(world.player, world.stacks);
    const output =
      outputEstimate(player, stacks) / Math.max(1e-9, currentOutput) -
      1 +
      Math.max(0, player.stats.chain - world.player.stats.chain) * 0.12 +
      Math.max(0, player.stats.piercing - world.player.stats.piercing) * 0.1 +
      Math.max(0, player.stats.splash - world.player.stats.splash) / 300 +
      Math.max(0, player.stats.storm - world.player.stats.storm) * 0.1 +
      Math.max(0, player.stats.maxHealthDamage - world.player.stats.maxHealthDamage) * 35 +
      Math.max(0, player.stats.currentHealthDamage - world.player.stats.currentHealthDamage) * 12 +
      Math.max(0, player.stats.giantSlayer - world.player.stats.giantSlayer) * 35 +
      Math.max(0, player.stats.erosionPulse - world.player.stats.erosionPulse) * 60;
    const need = 1 + 2 * Math.max(0, 1 - world.player.hp / world.player.stats.maxHp);
    const survival =
      ((player.stats.maxHp - world.player.stats.maxHp) / world.player.stats.maxHp +
        (player.hp - world.player.hp) / world.player.stats.maxHp +
        (player.shield - world.player.shield) / world.player.stats.maxHp +
        Math.max(0, after.lifesteal - before.lifesteal) * 5 +
        Math.max(0, player.stats.regeneration - world.player.stats.regeneration) * 0.15 +
        Math.max(0, player.stats.harvest - world.player.stats.harvest) * 0.12 +
        Math.max(0, player.stats.controlPulse - world.player.stats.controlPulse) * 0.1 +
        Math.max(0, player.stats.overheal - world.player.stats.overheal) * 0.4) *
      need;
    let route = 0;
    if (item.type === "augment") {
      const count = synergyCount(world.stacks, item.synergy);
      const distance = SYNERGY_THRESHOLDS.find((tier) => tier > count);
      route =
        (distance ? count * weights.investment : 0) +
        (distance ? weights.threshold / (distance - count) : 0) +
        (config.reward.preferences[item.synergy] ?? 0) * weights.preference;
    }
    // Every known legal reward starts with a neutral fallback utility. Rewards whose
    // special effect has no marginal model remain usable and are recorded as fallback.
    const modeled = output > 1e-9 || survival > 1e-9;
    const rarity = item.rarity === "epic" ? 3 : item.rarity === "rare" ? 1 : 0;
    return {
      value:
        weights.fallback +
        output * weights.output +
        survival * weights.survival +
        route +
        rarity * weights.rarity,
      fallback: !modeled,
    };
  };
  return {
    chooseReward(world: World): RewardChoice {
      const choices = world.reward?.choices ?? [];
      if (choices.length === 0) return { choice: undefined, scores: {}, fallback: [] };
      if (config.reward.kind === "random")
        return {
          choice: choices[Math.floor(rewardRandom() * choices.length)],
          scores: {},
          fallback: [],
        };
      const scores: Record<string, number> = {};
      const fallback: string[] = [];
      for (const id of choices) {
        const ranked = score(id, world);
        scores[id] = ranked.value;
        if (ranked.fallback) fallback.push(id);
      }
      const best = Math.max(...Object.values(scores));
      const tied = choices.filter((id) => Math.abs((scores[id] ?? 0) - best) < 1e-9);
      return {
        choice:
          tied[config.reward.tieBreak === "random" ? Math.floor(rewardRandom() * tied.length) : 0],
        scores,
        fallback,
      };
    },
    target(world: World): boolean {
      if (config.target.kind === "auto" || world.elapsed + 1e-9 < nextTargetAt) return false;
      nextTargetAt = world.elapsed + config.target.intervalSeconds;
      const boss = world.boss;
      const chest = world.chests.items.find((item) => item.active);
      const threats = world.enemies.items.filter((enemy) => enemy.active);
      if (config.name === "legacy") {
        if (chest && !boss) world.selectTargetAt(chest);
        else world.clearTarget();
        return true;
      }
      // Charging enemies and bosses are observable; no unopened skills or RNG are read.
      const interruptible = threats
        .filter((enemy) => enemy.telegraph > 0 || enemy.preparation > 0)
        .sort(
          (a, b) =>
            Number(b.telegraph > 0 && b.role !== "minion") -
              Number(a.telegraph > 0 && a.role !== "minion") ||
            (a.telegraph > 0 && b.telegraph > 0 ? a.telegraph - b.telegraph : 0) ||
            Number(b.kind === "boss") - Number(a.kind === "boss") ||
            a.hp / a.maxHp - b.hp / b.maxHp ||
            a.id - b.id,
        )[0];
      // Version 2 uses only visible charge/exposure state. The decision interval,
      // reward policy, strategy RNG and all native targeting actions stay unchanged.
      const dangerousLeader = threats
        .filter((enemy) => enemy.role !== "minion" && enemy.telegraph > 0)
        .sort(
          (a, b) =>
            a.telegraph - b.telegraph ||
            Number(b.kind === "boss") - Number(a.kind === "boss") ||
            a.hp / a.maxHp - b.hp / b.maxHp ||
            a.id - b.id,
        )[0];
      const exposedLeader = threats
        .filter((enemy) => enemy.role !== "minion" && enemy.vulnerableTime > 0)
        .sort(
          (a, b) =>
            a.vulnerableTime - b.vulnerableTime ||
            Number(b.kind === "boss") - Number(a.kind === "boss") ||
            a.hp / a.maxHp - b.hp / b.maxHp ||
            a.id - b.id,
        )[0];
      const imminent = threats
        .filter((enemy) => enemy.arrived || enemy.stage === "Attacking")
        .sort(
          (a, b) =>
            Number(["hexer", "wizard"].includes(b.kind)) -
              Number(["hexer", "wizard"].includes(a.kind)) ||
            a.hp - b.hp ||
            a.id - b.id,
        )[0];
      const safeChest =
        chest &&
        !boss &&
        !imminent &&
        world.player.hp / world.player.stats.maxHp >= config.target.chestSafeHealthRatio;
      const target =
        dangerousLeader ?? exposedLeader ?? interruptible ?? (safeChest ? chest : imminent);
      if (target && (isEnemy(target) || safeChest)) world.selectTargetAt(target);
      else world.clearTarget();
      return true;
    },
  };
}

export function rewardKind(id: string): "card" | "training" | "unknown" {
  return CARD_BY_ID.has(id) ? "card" : TRAINING_BY_ID.has(id) ? "training" : "unknown";
}
