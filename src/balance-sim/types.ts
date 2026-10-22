import type { Phase } from "../game/types";

export type StrategyName = "random-auto" | "build-auto" | "build-active" | "legacy";
export interface RewardWeights {
  output: number;
  survival: number;
  investment: number;
  threshold: number;
  preference: number;
  rarity: number;
  fallback: number;
}
export interface StrategyConfig {
  name: StrategyName;
  seed?: number;
  reward?: {
    kind?: "random" | "build" | "legacy";
    tieBreak?: "first" | "random";
    preferences?: Record<string, number>;
    weights?: Partial<RewardWeights>;
  };
  target?: {
    kind?: "auto" | "active";
    intervalSeconds?: number;
    chestSafeHealthRatio?: number;
  };
}
export interface ResolvedStrategyConfig {
  name: StrategyName;
  version: "1";
  seed: number;
  reward: {
    kind: "random" | "build" | "legacy";
    tieBreak: "first" | "random";
    preferences: Record<string, number>;
    weights: RewardWeights;
  };
  target: {
    kind: "auto" | "active";
    intervalSeconds: number;
    chestSafeHealthRatio: number;
  };
}
export interface RunConfig {
  seed: number;
  width: number;
  mode: "campaign" | "endless";
  strategy: StrategyConfig;
  maxSteps: number;
  maxSeconds: number;
  /** Number of completed endless stages, after the four campaign stages. */
  endlessTarget: number;
  trace?: boolean;
  sampleIntervalSeconds?: number;
  traceCapacity?: number;
  deathWindowSeconds?: number;
  eventCapacity?: number;
}
export type Termination =
  | "campaign_victory"
  | "death"
  | "endless_target_reached"
  | "budget_exhausted"
  | "error"
  | "cancelled";
export interface PlayerSnapshot {
  hp: number;
  maxHp: number;
  shield: number;
  cards: Record<string, number>;
  trainings: Record<string, number>;
  synergies: Record<string, number>;
}
export interface KeyTime {
  playerSeconds: number;
  stageSeconds: number;
}
export interface CombatMetrics {
  enemyDamage: number;
  chestDamage: number;
  hpLoss: number;
  shieldAbsorbed: number;
  healing: number;
  shieldGained: number;
  damageBySource: Record<string, number>;
  hpLossBySource: Record<string, number>;
  shieldAbsorbedBySource: Record<string, number>;
  healingBySource: Record<string, number>;
  shieldBySource: Record<string, number>;
  mechanics: Record<string, number>;
  poisonSeconds: number;
  woundSeconds: number;
  slowSeconds: number;
  sanctuarySeconds: number;
  /** Effective enemy HP removed / player-side combat time; chests excluded. */
  effectiveDps: number | null;
}
export interface StageSummary {
  stageIndex: number;
  name: string;
  endless: boolean;
  entered: true;
  cleared: boolean;
  entryTime: KeyTime;
  bossSpawnTime: KeyTime | null;
  bossDeathTime: KeyTime | null;
  clearTime: KeyTime | null;
  entry: PlayerSnapshot;
  /** Before score rewards, manual stage rewards and stage-transition recovery. */
  clear: PlayerSnapshot | null;
  /** After the stage reward and any stage-transition recovery. */
  postReward: PlayerSnapshot | null;
  playerSeconds: number;
  enemySeconds: number;
  arrivals: number;
  enemyAttacks: number;
  peakEnemies: number;
  pendingSummonsPeak: number;
  spawned: number;
  metrics: CombatMetrics;
}
export interface RewardDecision {
  order: number;
  stageIndex: number;
  playerSeconds: number;
  stageSeconds: number;
  source: "chest" | "supply" | "stage" | "score";
  choices: string[];
  choice: string | null;
  kind: "card" | "training" | "empty" | "unknown";
  automatic: boolean;
  hp: number;
  hpRatio: number;
  shield: number;
  scores: Record<string, number>;
}
export interface SimEvent {
  type: string;
  stageIndex: number;
  playerSeconds: number;
  stageSeconds: number;
  source?: string;
  choice?: string;
  entityId?: number;
  amount?: number;
  hpLoss?: number;
  shieldAbsorbed?: number;
  hp?: number;
  maxHp?: number;
  shield?: number;
  detail?: string;
}
export interface TraceSample extends KeyTime {
  stageIndex: number;
  hp: number;
  shield: number;
  enemies: number;
  pendingSummons: number;
  sanctuary: boolean;
}
export interface StrategyCoverage {
  cardOffers: Record<string, number>;
  cardSelections: Record<string, number>;
  trainingOffers: Record<string, number>;
  trainingSelections: Record<string, number>;
  automaticTrainings: Record<string, number>;
  fallbackOffers: Record<string, number>;
  emptyRewards: number;
  targetDecisions: number;
  synergyMilestones: Array<{
    family: string;
    tier: number;
    stageIndex: number;
    playerSeconds: number;
  }>;
}
export interface RunResult {
  schemaVersion: 1;
  /** False means numeric zero placeholders are transport-only, never measured data. */
  validMetrics: boolean;
  invalidValues: Array<{ path: string; value: string }>;
  mode: "natural";
  config: RunConfig;
  strategy: ResolvedStrategyConfig;
  termination: Termination;
  reason: string;
  steps: number;
  playerSeconds: number;
  enemySeconds: number;
  fixedStep: number;
  layout: { width: number; height: number; laneCount: number; capacity: number };
  clearedStages: number;
  deathStage: number | null;
  endlessReached: number;
  endlessCleared: number;
  phase: Phase;
  final: PlayerSnapshot;
  metrics: CombatMetrics;
  stages: StageSummary[];
  rewards: RewardDecision[];
  rewardCount: number;
  coverage: StrategyCoverage;
  events: SimEvent[];
  droppedEvents: number;
  droppedRewards: number;
  deathWindow: SimEvent[];
  fatalSource: string | null;
  trace: TraceSample[];
  droppedTraceSamples: number;
}
