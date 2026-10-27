/** Optional, environment-independent observation of already resolved game actions.
 * Existing counters remain unchanged: damageTaken includes shields and excludes
 * bloodpact costs; healingDone excludes cards and between-stage healing;
 * shieldRestored excludes card grants. enemy_damage includes execution HP loss
 * and excludes chests. Events report the actual resolved HP/shield delta.
 */
export type WorldObservationType =
  | "stage_enter"
  | "stage_clear"
  | "stage_ready"
  | "boss_spawn"
  | "boss_death"
  | "enemy_spawn"
  | "enemy_death"
  | "enemy_damage"
  | "chest_damage"
  | "player_damage"
  | "heal"
  | "shield"
  | "death"
  | "reward_offer"
  | "reward_choice"
  | "reward_skip"
  | "auto_training"
  | "training_score"
  | "mechanic";

/** Frozen value snapshots only: no entity, World, pool or RNG references.
 * elapsed is player combat time; stageElapsed is the hostile stage clock.
 * Callbacks must only collect observations, and must not call World actions.
 */
export interface WorldObservation {
  readonly type: WorldObservationType;
  readonly stageIndex: number;
  readonly elapsed: number;
  readonly stageElapsed: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly shield: number;
  readonly source?: string;
  readonly amount?: number;
  readonly hpLoss?: number;
  readonly shieldAbsorbed?: number;
  readonly kind?: string;
  readonly entityId?: number;
  readonly role?: "minion" | "elite" | "boss";
  readonly stars?: number;
  readonly trainingCredit?: number;
  readonly trainingScore?: number;
  readonly castId?: number;
  readonly duration?: number;
  readonly choices?: readonly string[];
  readonly choice?: string;
  readonly training?: boolean;
  readonly automatic?: boolean;
}

export type WorldObserver = (event: Readonly<WorldObservation>) => void;
export type ObservationDetails = Partial<
  Omit<WorldObservation, "type" | "elapsed" | "hp" | "maxHp" | "shield">
>;
