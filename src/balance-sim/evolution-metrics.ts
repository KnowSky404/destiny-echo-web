import type { WorldObservation } from "../game/observation";
import type { EvolutionMetrics, TimeDistribution } from "./types";

const TTK_BOUNDS = [
  0.25, 0.5, 1, 2, 3, 5, 8, 12, 20, 30, 45, 60, 90, 120, 180, 300, 600, 1200, 3600, 7200, 1_000_000,
] as const;
type Role = "minion" | "elite" | "boss";
const distribution = (): TimeDistribution => ({
  count: 0,
  sum: 0,
  min: null,
  max: null,
  buckets: TTK_BOUNDS.map((upperSeconds) => ({ upperSeconds, count: 0 })),
});
export function evolutionMetrics(): EvolutionMetrics {
  return {
    ttk: { minion: distribution(), elite: distribution(), boss: distribution() },
    spawnedByRole: { minion: 0, elite: 0, boss: 0 },
    deathsByRole: { minion: 0, elite: 0, boss: 0 },
    spawnedByStars: {},
    deathCreditByRole: { minion: 0, elite: 0, boss: 0 },
    trainingScore: 0,
    trainingScoreBySource: {},
    idleSeconds: 0,
    presentationSeconds: 0,
    longestIdleSeconds: 0,
    castStarts: 0,
    castInterrupts: 0,
    castReleases: 0,
    unwarnedReleases: 0,
    prematureReleases: 0,
    missingLifecycleEvents: 0,
    maxOneSecondHpLoss: 0,
    maxOneSecondDamage: 0,
    maxOneSecondHpLossRatio: 0,
  };
}

interface StageState {
  metrics: EvolutionMetrics;
  idleStreak: number;
  damage: Array<{ time: number; hpLoss: number; damage: number }>;
}

/** Observations never consume gameplay RNG; lifetime tables are pruned to the live pool. */
export class EvolutionMetricsCollector {
  readonly total = evolutionMetrics();
  private readonly stages = new Map<number, StageState>();
  private readonly births = new Map<number, { time: number; stageIndex: number }>();
  private readonly casts = new Map<number, { castId: number; time: number; duration: number }>();

  stage(index: number): EvolutionMetrics {
    let state = this.stages.get(index);
    if (!state) {
      state = { metrics: evolutionMetrics(), idleStreak: 0, damage: [] };
      this.stages.set(index, state);
    }
    return state.metrics;
  }

  observe(event: WorldObservation): void {
    const stage = this.stage(event.stageIndex);
    const targets = [this.total, stage];
    const role: Role = event.role ?? (event.kind === "boss" ? "boss" : "minion");
    if (event.type === "enemy_spawn") {
      if (event.entityId !== undefined) {
        if (this.births.has(event.entityId))
          for (const metric of targets) metric.missingLifecycleEvents++;
        this.births.set(event.entityId, { time: event.elapsed, stageIndex: event.stageIndex });
      } else for (const metric of targets) metric.missingLifecycleEvents++;
      for (const metric of targets) {
        metric.spawnedByRole[role]++;
        const star = String(event.stars ?? 1);
        metric.spawnedByStars[star] = (metric.spawnedByStars[star] ?? 0) + 1;
      }
    } else if (event.type === "enemy_death") {
      const birth = event.entityId === undefined ? undefined : this.births.get(event.entityId);
      for (const metric of targets) {
        metric.deathsByRole[role]++;
        metric.deathCreditByRole[role] += event.trainingCredit ?? 0;
        if (!birth || birth.stageIndex !== event.stageIndex) metric.missingLifecycleEvents++;
        else {
          const duration = Math.max(0, event.elapsed - birth.time);
          const ttk = metric.ttk[role];
          ttk.count++;
          ttk.sum += duration;
          ttk.min = ttk.min === null ? duration : Math.min(ttk.min, duration);
          ttk.max = ttk.max === null ? duration : Math.max(ttk.max, duration);
          const bucket = ttk.buckets.find((item) => duration <= item.upperSeconds + 1e-9);
          if (bucket) bucket.count++;
          else metric.missingLifecycleEvents++;
        }
      }
      if (event.entityId !== undefined) {
        this.births.delete(event.entityId);
        this.casts.delete(event.entityId);
      }
    } else if (event.type === "training_score") {
      const source = event.source ?? "unknown";
      for (const metric of targets) {
        metric.trainingScore += event.amount ?? 0;
        metric.trainingScoreBySource[source] =
          (metric.trainingScoreBySource[source] ?? 0) + (event.amount ?? 0);
      }
    } else if (event.type === "mechanic" && event.source?.startsWith("cast_")) {
      const id = event.entityId;
      if (event.source === "cast_start") {
        for (const metric of targets) metric.castStarts++;
        if (id !== undefined && event.castId !== undefined && event.duration !== undefined)
          this.casts.set(id, {
            castId: event.castId,
            time: event.elapsed,
            duration: event.duration,
          });
        else for (const metric of targets) metric.missingLifecycleEvents++;
      } else if (event.source === "cast_release" || event.source === "cast_interrupt") {
        const cast = id === undefined ? undefined : this.casts.get(id);
        const paired = cast !== undefined && cast.castId === event.castId;
        for (const metric of targets) {
          if (event.source === "cast_interrupt") metric.castInterrupts++;
          else {
            metric.castReleases++;
            if (!paired) metric.unwarnedReleases++;
            else if (event.elapsed - cast.time + 1e-7 < cast.duration) metric.prematureReleases++;
          }
        }
        if (id !== undefined) this.casts.delete(id);
      }
    } else if (event.type === "player_damage" && event.source !== "bloodpact") {
      const state = this.stages.get(event.stageIndex) as StageState;
      const hpLoss = event.hpLoss ?? 0;
      const damage = hpLoss + (event.shieldAbsorbed ?? 0);
      const last = state.damage[state.damage.length - 1];
      if (last?.time === event.elapsed) {
        last.hpLoss += hpLoss;
        last.damage += damage;
      } else state.damage.push({ time: event.elapsed, hpLoss, damage });
      while ((state.damage[0]?.time ?? event.elapsed) <= event.elapsed - 1 + 1e-9)
        state.damage.shift();
      // A fixed-step World has at most 121 distinct timestamps in this one-second window.
      if (state.damage.length > 256) throw new Error("Damage-window observation capacity exceeded");
      const recentHp = state.damage.reduce((sum, item) => sum + item.hpLoss, 0);
      const recentDamage = state.damage.reduce((sum, item) => sum + item.damage, 0);
      for (const metric of targets) {
        metric.maxOneSecondHpLoss = Math.max(metric.maxOneSecondHpLoss, recentHp);
        metric.maxOneSecondDamage = Math.max(metric.maxOneSecondDamage, recentDamage);
        metric.maxOneSecondHpLossRatio = Math.max(
          metric.maxOneSecondHpLossRatio,
          recentHp / Math.max(1, event.maxHp),
        );
      }
    }
  }

  step(stageIndex: number, delta: number, liveIds: ReadonlySet<number>, idle: boolean): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.stage(stageIndex);
    const state = this.stages.get(stageIndex) as StageState;
    if (idle) {
      state.idleStreak += delta;
      for (const metric of [this.total, state.metrics]) {
        metric.idleSeconds += delta;
        metric.longestIdleSeconds = Math.max(metric.longestIdleSeconds, state.idleStreak);
      }
    } else state.idleStreak = 0;
    for (const id of this.births.keys()) if (!liveIds.has(id)) this.births.delete(id);
    for (const id of this.casts.keys()) if (!liveIds.has(id)) this.casts.delete(id);
  }

  presentationStep(stageIndex: number, delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.total.presentationSeconds += delta;
    this.stage(stageIndex).presentationSeconds += delta;
  }
}
