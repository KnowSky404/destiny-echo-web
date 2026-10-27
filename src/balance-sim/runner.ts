import type { BalanceProfile } from "../data/balance/model";
import { officialProfile, parseProfile } from "../data/balance/profile";
import { STAGES } from "../data/stages";
import { SYNERGIES, SYNERGY_THRESHOLDS } from "../data/synergies";
import { CONFIG } from "../game/config";
import type { WorldObservation } from "../game/observation";
import { synergyCount } from "../game/synergies";
import { World } from "../game/world";
import { EvolutionMetricsCollector } from "./evolution-metrics";
import { createStrategy, resolveStrategy, rewardKind } from "./strategies";
import type {
  CombatMetrics,
  PlayerSnapshot,
  RewardDecision,
  RunConfig,
  RunResult,
  SimEvent,
  StageSummary,
  StrategyCoverage,
  Termination,
  TraceSample,
} from "./types";

const REWARD_CAPACITY = 4096;
const STAGE_CAPACITY = 256;
// The official score conversion is synchronous. A legal extreme profile can
// otherwise perform billions of trainings before a fixed-step budget is checked.
const AUTO_TRAININGS_PER_ACTION = 4096;

function add(record: Record<string, number>, key: string, amount = 1): void {
  record[key] = (record[key] ?? 0) + amount;
}
function metrics(): CombatMetrics {
  return {
    enemyDamage: 0,
    chestDamage: 0,
    hpLoss: 0,
    shieldAbsorbed: 0,
    healing: 0,
    shieldGained: 0,
    damageBySource: {},
    hpLossBySource: {},
    shieldAbsorbedBySource: {},
    healingBySource: {},
    shieldBySource: {},
    mechanics: {},
    poisonSeconds: 0,
    woundSeconds: 0,
    slowSeconds: 0,
    sanctuarySeconds: 0,
    effectiveDps: null,
  };
}
export function playerSnapshot(world: World): PlayerSnapshot {
  return {
    hp: world.player.hp,
    maxHp: world.player.stats.maxHp,
    shield: world.player.shield,
    trainingScore: world.trainingScore,
    cards: Object.fromEntries(world.stacks),
    trainings: Object.fromEntries(world.trainingStacks),
    synergies: Object.fromEntries(
      SYNERGIES.map((family) => [family.id, synergyCount(world.stacks, family.id)]),
    ),
  };
}
function applyMetric(target: CombatMetrics, event: WorldObservation): void {
  const source = event.source ?? "unknown";
  const amount = event.amount ?? 0;
  if (event.type === "enemy_damage") {
    target.enemyDamage += amount;
    add(target.damageBySource, source, amount);
  } else if (event.type === "chest_damage") target.chestDamage += amount;
  else if (event.type === "player_damage") {
    target.hpLoss += event.hpLoss ?? 0;
    target.shieldAbsorbed += event.shieldAbsorbed ?? 0;
    add(target.hpLossBySource, source, event.hpLoss ?? 0);
    add(target.shieldAbsorbedBySource, source, event.shieldAbsorbed ?? 0);
  } else if (event.type === "heal") {
    target.healing += amount;
    add(target.healingBySource, source, amount);
  } else if (event.type === "shield") {
    target.shieldGained += amount;
    add(target.shieldBySource, source, amount);
  } else if (event.type === "mechanic") {
    // Sanctuary events contain duration; mechanics counts activations, not seconds.
    add(
      target.mechanics,
      source,
      source === "sanctuary" || source.startsWith("cast_") ? 1 : amount || 1,
    );
  }
}

function limit(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string,
  integer = false,
): number {
  const resolved = value ?? fallback;
  if (
    !Number.isFinite(resolved) ||
    resolved < min ||
    resolved > max ||
    (integer && !Number.isInteger(resolved))
  )
    throw new Error(
      `Invalid ${label}: expected ${integer ? "integer" : "number"} in [${min}, ${max}]`,
    );
  return resolved;
}
export function validateRunConfig(config: RunConfig): void {
  limit(config.seed, 0, 0, 0xffff_ffff, "run seed", true);
  limit(config.width, CONFIG.width, CONFIG.width, 2400, "logical width");
  if (!["campaign", "endless"].includes(config.mode))
    throw new Error("Run mode must be campaign or endless");
  limit(config.maxSteps, 0, 1, 100_000_000, "maxSteps", true);
  limit(config.maxSeconds, 0, CONFIG.fixedStep, 1_000_000, "maxSeconds");
  limit(config.endlessTarget, 0, 0, STAGE_CAPACITY - STAGES.length - 1, "endlessTarget", true);
  if (config.mode === "endless" && config.endlessTarget < 1)
    throw new Error("Endless runs require a positive finite endlessTarget");
  if (config.trace !== undefined && typeof config.trace !== "boolean")
    throw new Error("trace must be boolean");
  limit(config.sampleIntervalSeconds, 1, CONFIG.fixedStep, 3600, "sample interval");
  limit(config.traceCapacity, 2048, 1, 100_000, "trace capacity", true);
  limit(config.deathWindowSeconds, 8, 0, 120, "death window");
  limit(config.eventCapacity, 512, 1, 100_000, "event capacity", true);
  resolveStrategy(config.strategy);
}

export interface RunControl {
  isCancelled?: () => boolean;
  /** Readonly telemetry; no World, pool, action or RNG references escape. */
  onObservation?: (event: Readonly<WorldObservation>) => void;
}

/** Executes the real fixed-step World using only native natural-run actions. No I/O. */
export function runNatural(
  config: RunConfig,
  profile: BalanceProfile = officialProfile(),
  control: RunControl = {},
): RunResult {
  validateRunConfig(config);
  const resolvedProfile = parseProfile(profile);
  const runConfig = structuredClone(config);
  const resolved = resolveStrategy(runConfig.strategy);
  const strategy = createStrategy(resolved);
  const total = metrics();
  const evolution = new EvolutionMetricsCollector();
  const stages: StageSummary[] = [];
  const rewards: RewardDecision[] = [];
  const events: SimEvent[] = [];
  const deathWindow: SimEvent[] = [];
  const trace: TraceSample[] = [];
  const coverage: StrategyCoverage = {
    cardOffers: {},
    cardSelections: {},
    trainingOffers: {},
    trainingSelections: {},
    automaticTrainings: {},
    fallbackOffers: {},
    emptyRewards: 0,
    targetDecisions: 0,
    synergyMilestones: [],
  };
  const eventCapacity = config.eventCapacity ?? 512;
  const traceCapacity = config.traceCapacity ?? 2048;
  const windowSeconds = config.deathWindowSeconds ?? 8;
  const sampleInterval = config.sampleIntervalSeconds ?? 1;
  let nextSampleAt = 0;
  let nextIntegrityAt = 0;
  let droppedEvents = 0;
  let droppedRewards = 0;
  let droppedTraceSamples = 0;
  let rewardCount = 0;
  let sanctuaryActivations = 0;
  let actionTrainings = 0;
  const nativeAction = <T>(action: () => T): T => {
    actionTrainings = 0;
    return action();
  };
  let fatalSource: string | null = null;
  const invalidValues: Array<{ path: string; value: string }> = [];
  const invalidNumber = (path: string, value: number): void => {
    if (!invalidValues.some((item) => item.path === path))
      invalidValues.push({ path, value: String(value) });
  };
  let world: World;
  const remember = (event: SimEvent, key = true): void => {
    if (key) {
      if (events.length < eventCapacity) events.push(event);
      else droppedEvents++;
    }
    if (windowSeconds > 0) {
      deathWindow.push(event);
      while (
        deathWindow.length > eventCapacity ||
        (deathWindow[0]?.playerSeconds ?? event.playerSeconds) < event.playerSeconds - windowSeconds
      )
        deathWindow.shift();
    }
  };
  const milestone = (stageIndex: number): void => {
    for (const family of SYNERGIES) {
      const count = synergyCount(world.stacks, family.id);
      for (const tier of SYNERGY_THRESHOLDS) {
        if (
          count >= tier &&
          !coverage.synergyMilestones.some(
            (item) => item.family === family.id && item.tier === tier,
          )
        )
          coverage.synergyMilestones.push({
            family: family.id,
            tier,
            stageIndex,
            playerSeconds: world.elapsed,
          });
      }
    }
  };
  const saveReward = (reward: RewardDecision): void => {
    rewardCount++;
    if (rewards.length < REWARD_CAPACITY) rewards.push(reward);
    else droppedRewards++;
  };
  const observe = (event: WorldObservation): void => {
    control.onObservation?.(event);
    evolution.observe(event);
    if (event.type === "mechanic" && event.source === "sanctuary") sanctuaryActivations++;
    if (event.type === "auto_training" && ++actionTrainings > AUTO_TRAININGS_PER_ACTION)
      throw new Error(
        `Automatic training loop guard: native action exceeded ${AUTO_TRAININGS_PER_ACTION} trainings`,
      );
    const stage = stages.find((item) => item.stageIndex === event.stageIndex);
    applyMetric(total, event);
    if (stage) applyMetric(stage.metrics, event);
    const simEvent: SimEvent = {
      type: event.type,
      stageIndex: event.stageIndex,
      playerSeconds: event.elapsed,
      stageSeconds: event.stageElapsed,
      hp: event.hp,
      maxHp: event.maxHp,
      shield: event.shield,
      ...(event.source === undefined ? {} : { source: event.source }),
      ...(event.choice === undefined ? {} : { choice: event.choice }),
      ...(event.amount === undefined ? {} : { amount: event.amount }),
      ...(event.hpLoss === undefined ? {} : { hpLoss: event.hpLoss }),
      ...(event.shieldAbsorbed === undefined ? {} : { shieldAbsorbed: event.shieldAbsorbed }),
      ...(event.kind === undefined ? {} : { detail: event.kind }),
      ...(event.entityId === undefined ? {} : { entityId: event.entityId }),
      ...(event.role === undefined ? {} : { role: event.role }),
      ...(event.stars === undefined ? {} : { stars: event.stars }),
      ...(event.trainingCredit === undefined ? {} : { trainingCredit: event.trainingCredit }),
      ...(event.trainingScore === undefined ? {} : { trainingScore: event.trainingScore }),
      ...(event.castId === undefined ? {} : { castId: event.castId }),
      ...(event.duration === undefined ? {} : { duration: event.duration }),
    };
    const detail =
      [
        "enemy_spawn",
        "enemy_death",
        "enemy_damage",
        "chest_damage",
        "player_damage",
        "heal",
        "shield",
        "training_score",
      ].includes(event.type) ||
      (event.type === "mechanic" && ["arrival", "enemy_attack"].includes(event.source ?? ""));
    remember(simEvent, !detail);
    const time = { playerSeconds: event.elapsed, stageSeconds: event.stageElapsed };
    if (event.type === "stage_enter") {
      if (stages.length >= STAGE_CAPACITY) throw new Error("Stage record capacity exceeded");
      stages.push({
        stageIndex: event.stageIndex,
        name: world.stage.name,
        endless: world.endless,
        entered: true,
        cleared: false,
        entryTime: time,
        bossSpawnTime: null,
        bossDeathTime: null,
        clearTime: null,
        entry: playerSnapshot(world),
        clear: null,
        postReward: null,
        playerSeconds: 0,
        enemySeconds: 0,
        arrivals: 0,
        enemyAttacks: 0,
        peakEnemies: 0,
        pendingSummonsPeak: 0,
        spawned: 0,
        metrics: metrics(),
        evolution: evolution.stage(event.stageIndex),
      });
    } else if (event.type === "stage_clear" && stage) {
      stage.cleared = true;
      stage.clearTime = time;
      stage.clear = playerSnapshot(world);
    } else if (event.type === "stage_ready" && stage) stage.postReward = playerSnapshot(world);
    else if (event.type === "boss_spawn" && stage) stage.bossSpawnTime = time;
    else if (event.type === "enemy_spawn" && stage)
      stage.peakEnemies = Math.max(stage.peakEnemies, event.amount ?? 0);
    else if (event.type === "boss_death" && stage) stage.bossDeathTime = time;
    else if (event.type === "death") fatalSource = event.source ?? "unknown";
    else if (event.type === "auto_training" && event.choice) {
      add(coverage.automaticTrainings, event.choice);
      saveReward({
        order: rewardCount + 1,
        stageIndex: event.stageIndex,
        playerSeconds: event.elapsed,
        stageSeconds: event.stageElapsed,
        source: "score",
        choices: [],
        choice: event.choice,
        kind: "training",
        automatic: true,
        hp: event.hp,
        hpRatio: event.hp / event.maxHp,
        shield: event.shield,
        scores: {},
      });
    }
  };
  world = new World(config.width, resolvedProfile, observe);
  let termination: Termination = "error";
  let reason = "Runner did not terminate";
  let steps = 0;
  let enemySeconds = 0;
  let lastRewardToken = -1;
  let consecutiveActions = 0;
  const finish = (kind: Termination, message: string): void => {
    termination = kind;
    reason = message;
  };
  const finite = (allEntities: boolean): void => {
    const records: Array<[string, Record<string, unknown>]> = [
      ["world.player", world.player as unknown as Record<string, unknown>],
      ["world.player.stats", world.player.stats as unknown as Record<string, unknown>],
      [
        "world",
        {
          elapsed: world.elapsed,
          stageElapsed: world.stageElapsed,
          score: world.score,
          pendingSummons: world.pendingSummons,
        },
      ],
      ["metrics", total as unknown as Record<string, unknown>],
    ];
    if (allEntities)
      for (const [name, pool] of Object.entries({
        enemies: world.enemies,
        shots: world.shots,
        hostileShots: world.hostileShots,
        chests: world.chests,
      }))
        for (const [index, entity] of pool.items.entries())
          if (entity.active)
            records.push([
              `world.${name}.items[${index}]`,
              entity as unknown as Record<string, unknown>,
            ]);
    for (const [path, record] of records)
      for (const [key, value] of Object.entries(record))
        if (typeof value === "number" && !Number.isFinite(value))
          invalidNumber(`${path}.${key}`, value);
    if (invalidValues.length)
      throw new Error(`Non-finite simulation value: ${invalidValues[0]?.path}`);
  };
  try {
    if (control.isCancelled?.()) finish("cancelled", "Cancelled before start");
    else if (!nativeAction(() => world.start(config.seed)))
      throw new Error("Native start action was rejected");
    else
      while (true) {
        if (control.isCancelled?.()) {
          finish("cancelled", "External cancellation");
          break;
        }
        finite(false);
        if (world.phase === "GameOver" || world.player.hp <= 0) {
          fatalSource ??= "unknown";
          finish("death", "Player health reached zero");
          break;
        }
        if (world.phase === "RewardSelection" || world.phase === "StageClear") {
          if (++consecutiveActions > 128)
            throw new Error("Reward/action loop guard exceeded without a combat step");
          const reward = world.reward;
          if (!reward) throw new Error("Reward phase has no native reward");
          if (reward.token <= lastRewardToken)
            throw new Error("Repeated or non-monotonic reward token");
          lastRewardToken = reward.token;
          const decision = strategy.chooseReward(world);
          const kind = decision.choice ? rewardKind(decision.choice) : "empty";
          const record: RewardDecision = {
            order: rewardCount + 1,
            stageIndex: world.stageIndex,
            playerSeconds: world.elapsed,
            stageSeconds: world.stageElapsed,
            source: reward.source,
            choices: [...reward.choices],
            choice: decision.choice ?? null,
            kind,
            automatic: false,
            hp: world.player.hp,
            hpRatio: world.player.hp / world.player.stats.maxHp,
            shield: world.player.shield,
            scores: decision.scores,
          };
          for (const id of reward.choices) {
            const type = rewardKind(id);
            add(
              type === "card"
                ? coverage.cardOffers
                : type === "training"
                  ? coverage.trainingOffers
                  : coverage.fallbackOffers,
              id,
            );
          }
          for (const id of decision.fallback) add(coverage.fallbackOffers, id);
          const accepted =
            reward.choices.length === 0
              ? nativeAction(() => world.skipUnavailableReward(reward.token))
              : decision.choice !== undefined &&
                nativeAction(() => world.chooseCard(decision.choice as string, reward.token));
          if (!accepted)
            throw new Error(`Native reward action rejected: ${decision.choice ?? "empty"}`);
          if (decision.choice)
            add(
              kind === "card"
                ? coverage.cardSelections
                : kind === "training"
                  ? coverage.trainingSelections
                  : coverage.fallbackOffers,
              decision.choice,
            );
          else coverage.emptyRewards++;
          saveReward(record);
          milestone(record.stageIndex);
          continue;
        }
        if (world.phase === "Victory") {
          if (config.mode === "campaign") {
            finish("campaign_victory", "Campaign and final reward completed");
            break;
          }
          if (!nativeAction(() => world.continueEndless()))
            throw new Error("Native continueEndless action was rejected");
          continue;
        }
        if (
          config.mode === "endless" &&
          world.clearedStages >= STAGES.length + config.endlessTarget &&
          world.clearPresentationRemaining === 0 &&
          !world.reward &&
          world.stageIndex >= STAGES.length + config.endlessTarget
        ) {
          finish(
            "endless_target_reached",
            "Requested endless stages cleared and rewards completed",
          );
          break;
        }
        if (
          steps >= config.maxSteps ||
          world.elapsed + CONFIG.fixedStep > config.maxSeconds + 1e-9
        ) {
          finish(
            "budget_exhausted",
            steps >= config.maxSteps
              ? "Maximum fixed steps reached"
              : "Maximum player combat seconds reached",
          );
          break;
        }
        if (world.phase !== "Playing")
          throw new Error(`Cannot advance natural run from phase ${world.phase}`);
        consecutiveActions = 0;
        if (strategy.target(world)) {
          coverage.targetDecisions++;
          // IDs stay monotonic in World. Record observable kind, never a raw process-local ID.
          const target = world.target;
          remember({
            type: "target_decision",
            stageIndex: world.stageIndex,
            playerSeconds: world.elapsed,
            stageSeconds: world.stageElapsed,
            detail: target ? ("kind" in target ? target.kind : "chest") : "auto",
          });
        }
        const stage = stages.find((item) => item.stageIndex === world.stageIndex);
        if (!stage) throw new Error("Missing entered stage summary");
        const priorStageSeconds = world.stageElapsed;
        const priorPlayerSeconds = world.elapsed;
        const priorSanctuaryActivations = sanctuaryActivations;
        const beforePresentation = world.clearPresentationRemaining > 0;
        const idle =
          !world.enemies.items.some((enemy) => enemy.active) &&
          !world.chests.items.some((chest) => chest.active);
        const status = {
          poison: world.player.poisonTime > 0,
          wound: world.player.woundTime > 0,
          slow: world.player.poisonSlowTime > 0,
        };
        nativeAction(() => world.update(CONFIG.fixedStep));
        steps++;
        const playerDelta = world.elapsed - priorPlayerSeconds;
        const hostileDelta = world.stageElapsed - priorStageSeconds;
        const presentationFrozen = beforePresentation && playerDelta === 0 && hostileDelta === 0;
        if (
          !presentationFrozen &&
          (playerDelta <= 0 ||
            playerDelta > CONFIG.fixedStep + 1e-7 ||
            hostileDelta < -1e-9 ||
            hostileDelta > playerDelta + 1e-7)
        )
          throw new Error("Fixed-step simulation failed to advance consistent clocks");
        if (presentationFrozen) evolution.presentationStep(stage.stageIndex, CONFIG.fixedStep);
        enemySeconds += hostileDelta;
        stage.playerSeconds += playerDelta;
        stage.enemySeconds += hostileDelta;
        evolution.step(
          stage.stageIndex,
          playerDelta,
          new Set(world.enemies.items.filter((enemy) => enemy.active).map((enemy) => enemy.id)),
          idle,
        );
        stage.arrivals =
          world.arrivals -
          stages.filter((item) => item !== stage).reduce((sum, item) => sum + item.arrivals, 0);
        stage.enemyAttacks =
          world.enemyAttacks -
          stages.filter((item) => item !== stage).reduce((sum, item) => sum + item.enemyAttacks, 0);
        stage.spawned = world.stageSpawned;
        stage.peakEnemies = Math.max(
          stage.peakEnemies,
          world.enemies.items.filter((enemy) => enemy.active).length,
        );
        stage.pendingSummonsPeak = Math.max(stage.pendingSummonsPeak, world.pendingSummons);
        for (const metric of [total, stage.metrics]) {
          // Status occupancy uses the fixed-step start state after any sanctuary
          // cleansing at that step. Timers expire on the engine's discrete ticks.
          if (sanctuaryActivations === priorSanctuaryActivations) {
            if (status.poison) metric.poisonSeconds += playerDelta;
            if (status.wound) metric.woundSeconds += playerDelta;
            if (status.slow) metric.slowSeconds += playerDelta;
          }
          // The engine advances hostile time by either one fixed step or zero.
          // Differencing clocks with different magnitudes adds rounding noise at
          // stage transitions; only an actually unchanged hostile clock is frozen.
          if (hostileDelta === 0) metric.sanctuarySeconds += playerDelta;
        }
        if (world.elapsed + 1e-9 >= nextIntegrityAt) {
          finite(true);
          nextIntegrityAt = world.elapsed + 1;
        }
        if (world.elapsed + 1e-9 >= nextSampleAt) {
          if (config.trace) {
            const sample: TraceSample = {
              playerSeconds: world.elapsed,
              stageSeconds: world.stageElapsed,
              stageIndex: world.stageIndex,
              hp: world.player.hp,
              shield: world.player.shield,
              enemies: world.enemies.items.filter((enemy) => enemy.active).length,
              pendingSummons: world.pendingSummons,
              sanctuary: world.sanctuaryRemaining > 0,
            };
            if (trace.length < traceCapacity) trace.push(sample);
            else droppedTraceSamples++;
          }
          nextSampleAt = world.elapsed + sampleInterval;
        }
      }
  } catch (error) {
    finish("error", error instanceof Error ? error.message : String(error));
    remember({
      type: "runner_error",
      stageIndex: world.stageIndex,
      playerSeconds: world.elapsed,
      stageSeconds: world.stageElapsed,
      detail: reason,
    });
  }
  // Final integrity does not depend on trace sampling or the chosen termination.
  try {
    finite(true);
  } catch (error) {
    finish("error", error instanceof Error ? error.message : String(error));
  }
  const observedDeaths = Object.values(evolution.total.deathsByRole).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (observedDeaths !== world.kills) {
    evolution.total.missingLifecycleEvents += Math.abs(world.kills - observedDeaths);
    const message = `Enemy death observation mismatch: World kills=${world.kills}, observed deaths=${observedDeaths}`;
    if ((termination as Termination) === "error") reason += `; ${message}`;
    else finish("error", message);
    remember({
      type: "runner_error",
      stageIndex: world.stageIndex,
      playerSeconds: world.elapsed,
      stageSeconds: world.stageElapsed,
      detail: message,
    });
  }
  total.effectiveDps = world.elapsed > 0 ? total.enemyDamage / world.elapsed : null;
  for (const stage of stages)
    stage.metrics.effectiveDps =
      stage.playerSeconds > 0 ? stage.metrics.enemyDamage / stage.playerSeconds : null;
  // TS does not follow assignments made by the termination helper inside the loop.
  const finalTermination = termination as Termination;
  const result: RunResult = {
    schemaVersion: 1,
    validMetrics: true,
    invalidValues: [],
    mode: "natural",
    config: runConfig,
    strategy: resolved,
    termination: finalTermination,
    reason,
    steps,
    playerSeconds: world.elapsed,
    enemySeconds,
    fixedStep: CONFIG.fixedStep,
    layout: {
      width: world.arena.width,
      height: world.arena.height,
      laneCount: world.arena.laneCount,
      capacity: world.arena.encounterCapacity,
    },
    clearedStages: world.clearedStages,
    deathStage: finalTermination === "death" ? world.stageIndex : null,
    endlessReached: world.endless ? world.stageIndex - STAGES.length + 1 : 0,
    endlessCleared: Math.max(0, world.clearedStages - STAGES.length),
    phase: world.phase,
    final: playerSnapshot(world),
    metrics: total,
    evolution: evolution.total,
    stages,
    rewards,
    rewardCount,
    coverage,
    events,
    droppedEvents,
    droppedRewards,
    deathWindow: finalTermination === "death" ? deathWindow : [],
    fatalSource,
    trace,
    droppedTraceSamples,
  };
  // Preserve the offending paths and original textual values. Numeric zero values
  // on invalid results are only JSON transport placeholders and must be excluded
  // from statistics and human interpretation. Normal results are unchanged.
  const transport = (value: unknown, path: string): unknown => {
    if (typeof value === "number" && !Number.isFinite(value)) {
      invalidNumber(path, value);
      return 0;
    }
    if (Array.isArray(value))
      return value.map((item, index) => transport(item, `${path}[${index}]`));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, transport(item, `${path}.${key}`)]),
      );
    return value;
  };
  const safe = transport(result, "result") as RunResult;
  if (invalidValues.length) {
    safe.termination = "error";
    safe.validMetrics = false;
    safe.invalidValues = invalidValues;
    safe.reason += "; Non-finite state unavailable; zero placeholders are transport-only";
  }
  return safe;
}
