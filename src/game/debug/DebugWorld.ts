import {
  type BalanceProfile,
  ENEMY_FIELDS,
  type EnemyNumbers,
  type KindWeights,
  PLAYER_FIELDS,
  type PlayerValues,
  STAT_FIELDS,
  type StagePatch,
} from "../../data/balance/model";
import {
  kindWeightsAt,
  parseProfile,
  patchStage,
  validateKindWeights,
  validateNumber,
  validateNumbers,
  validateStagePatch,
} from "../../data/balance/profile";
import { CARD_BY_ID, drawCards } from "../../data/cards";
import { ENEMIES } from "../../data/enemies";
import { drawBossRewards, REWARD_BY_ID, TRAINING_BY_ID } from "../../data/training";
import { CONFIG } from "../config";
import type { EnemyKind, Stats } from "../types";
import { createPlayer, World } from "../world";

const PROGRESS_KEYS = [
  "elapsed",
  "stageIndex",
  "clearedStages",
  "kills",
  "score",
  "scoreTrainings",
  "scoreMilestones",
  "openedChests",
  "arrivals",
  "enemyAttacks",
  "regularAttacks",
  "bossSpecials",
  "bossInterrupts",
  "peakEnemies",
  "explosionCount",
  "chainKills",
  "echoVolleys",
  "shieldRestored",
  "executions",
  "meleeSpawns",
  "rangedSpawns",
  "damageDealt",
  "damageTaken",
  "healingDone",
  "criticalHits",
  "controlProcs",
  "fusions",
  "poisonCasts",
  "tauntCasts",
] as const;

export type DebugCommand =
  | { type: "player"; values: PlayerValues; overrides: Partial<Stats> }
  | { type: "deck"; cards: Record<string, number>; trainings: Record<string, number> }
  | { type: "spawn-rules"; stage: StagePatch; weights: KindWeights | null }
  | { type: "enemy"; ids: number[]; patch: Partial<EnemyNumbers> & { currentHp?: number } }
  | { type: "spawn"; kind: EnemyKind; count: number }
  | { type: "remove"; ids: number[] }
  | { type: "restart"; restoreEntry: boolean }
  | { type: "jump"; stage: number; fresh: boolean }
  | { type: "new-run"; seed: number }
  | { type: "profile"; profile: BalanceProfile; seed: number };

// Only the pre-mode entry imports this subclass. No writable world is put on window.
export class DebugWorld extends World {
  private history: string[] = [];
  private overrides: Partial<Stats> = {};
  private stagePatch: StagePatch = {};
  private kindWeights: KindWeights | null = null;
  private entry: RunCheckpoint | undefined;
  private stageStartMetrics = {
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    kills: 0,
    elapsed: 0,
  };

  override start(seed = Date.now() >>> 0): boolean {
    validateNumber(seed, ["种子", 0, 0xffffffff, true], "seed");
    return super.start(seed);
  }

  get debugInfo() {
    return {
      overrides: { ...this.overrides },
      stagePatch: { ...this.stagePatch },
      kindWeights: structuredClone(this.kindWeights),
      stageMetrics: Object.fromEntries(
        Object.entries(this.stageStartMetrics).map(([key, start]) => [
          key,
          this[key as keyof typeof this.stageStartMetrics] - start,
        ]),
      ),
      entryAvailable: Boolean(this.entry),
    };
  }

  protected override acquired(id: string): void {
    this.history.push(id);
    Object.assign(this.player.stats, this.overrides);
    this.player.hp = Math.min(this.player.hp, this.player.stats.maxHp);
  }

  protected override reset(seed: number): void {
    this.history = [];
    this.overrides = {};
    this.stagePatch = {};
    this.kindWeights = null;
    super.reset(seed);
  }

  override resolveStage(index: number) {
    const stage = super.resolveStage(index);
    return index === this.stageIndex
      ? patchStage(stage, this.stagePatch ?? {}, this.arena.width)
      : stage;
  }

  protected override resetStage(): void {
    this.stagePatch = {};
    this.kindWeights = null;
    this.configuredStage = undefined;
    super.resetStage();
    this.stageStartMetrics = {
      damageDealt: this.damageDealt,
      damageTaken: this.damageTaken,
      healingDone: this.healingDone,
      kills: this.kills,
      elapsed: this.elapsed,
    };
    this.entry = this.captureEntry();
  }

  protected override minionWeights(): KindWeights | null {
    return this.kindWeights ?? kindWeightsAt(this.balance, this.stageIndex);
  }

  private pauseForCommand(): void {
    if (this.phase === "Playing") this.pause();
  }

  execute(command: DebugCommand): string {
    this.pauseForCommand();
    switch (command.type) {
      case "player": {
        if (this.phase === "Menu") throw new Error("请先开始一局测试");
        const values = validateNumbers(command.values, PLAYER_FIELDS, "player");
        const overrides = validateNumbers(command.overrides, STAT_FIELDS, "overrides", true);
        this.overrides = overrides;
        this.rebuildStats();
        Object.assign(this.player, values);
        this.player.hp = Math.min(this.player.hp, this.player.stats.maxHp);
        this.player.poisonSlowTime =
          this.player.poisonTime > 0 && this.player.shield <= 0 ? this.player.poisonTime : 0;
        this.refreshReward();
        break;
      }
      case "deck":
        this.editDeck(command.cards, command.trainings);
        this.refreshReward();
        break;
      case "spawn-rules": {
        const patch = validateStagePatch(command.stage);
        const weights = validateKindWeights(command.weights);
        const previous = this.stage;
        this.stagePatch = patch;
        this.kindWeights = weights;
        this.configuredStage = undefined;
        this.rescheduleSpawns(previous);
        break;
      }
      case "enemy": {
        const { currentHp, ...numbers } = command.patch;
        const patch = validateNumbers(numbers, ENEMY_FIELDS, "enemy", true);
        if (currentHp !== undefined)
          validateNumber(currentHp, ["当前生命", 0, 1e12], "enemy.currentHp");
        for (const enemy of this.enemies.items.filter(
          (item) => item.active && command.ids.includes(item.id),
        )) {
          const ratio = enemy.hp / enemy.maxHp;
          enemy.definition = { ...this.enemyDefinition(enemy), ...patch };
          if (patch.hp !== undefined) {
            enemy.maxHp = patch.hp;
            enemy.hp = patch.hp * ratio;
          }
          if (patch.speed !== undefined) enemy.speed = patch.speed;
          if (patch.radius !== undefined) enemy.radius = patch.radius;
          if (currentHp !== undefined) enemy.hp = Math.min(currentHp, enemy.maxHp);
          if (enemy.hp <= 0) this.removeWithoutReward(enemy.id);
        }
        this.refreshTarget();
        break;
      }
      case "spawn": {
        if (!(command.kind in ENEMIES)) throw new Error("未知敌人类型");
        validateNumber(command.count, ["补怪数量", 1, CONFIG.limits.enemies, true], "count");
        let added = 0;
        for (let i = 0; i < command.count; i++) {
          if (command.kind === "boss" && (this.bossSpawned || this.bossDefeated)) break;
          if (
            command.kind !== "boss" &&
            this.enemies.items.filter((item) => item.active && item.kind !== "boss").length >=
              this.stage.maxEnemies - 1
          )
            break;
          const enemy = this.spawnEnemy(command.kind, this.arena.player.x);
          if (!enemy) break;
          added++;
          if (command.kind === "boss") this.bossSpawned = true;
        }
        return `已补入 ${added} 只敌人；容量不足时停止，始终预留首领位置`;
      }
      case "remove":
        for (const id of command.ids) this.removeWithoutReward(id);
        this.refreshTarget();
        break;
      case "restart":
        this.restart(command.restoreEntry);
        break;
      case "jump": {
        validateNumber(command.stage, ["目标关", 1, Number.MAX_SAFE_INTEGER, true], "stage");
        if (command.fresh || this.phase === "Menu") this.reset(this.seed);
        this.stageIndex = command.stage - 1;
        this.clearedStages = this.stageIndex;
        this.resetStage();
        this.toPaused();
        break;
      }
      case "new-run":
      case "profile": {
        validateNumber(command.seed, ["种子", 0, 0xffffffff, true], "seed");
        const profile = command.type === "profile" ? parseProfile(command.profile) : this.balance;
        this.replaceBalance(profile);
        this.configuredStage = undefined;
        this.reset(command.seed);
        this.toPaused();
        break;
      }
    }
    return "已应用到当前浏览器的 PRE 测试；战斗保持暂停";
  }

  private toPaused(): void {
    if (this.phase === "Paused") return;
    if (this.phase !== "Playing") this.state.transition("Playing");
    this.pause();
  }

  private removeWithoutReward(id: number): void {
    const enemy = this.enemies.items.find((item) => item.active && item.id === id);
    if (!enemy) return;
    enemy.active = false;
    if (enemy.kind === "boss") {
      this.bossSpawned = true;
      this.bossDefeated = true;
      this.pendingSummons = 0;
    }
  }

  private editDeck(cards: Record<string, number>, trainings: Record<string, number>): void {
    if (this.phase === "Menu") throw new Error("请先开始一局测试");
    const desired = new Map<string, number>();
    for (const [input, catalog] of [
      [cards, CARD_BY_ID],
      [trainings, TRAINING_BY_ID],
    ] as const) {
      for (const [id, count] of Object.entries(input)) {
        const card = catalog.get(id);
        if (!card) throw new Error(`未知卡牌：${id}`);
        validateNumber(count, [id, 0, card.maxStacks ?? 10000, true], id);
        desired.set(id, count);
      }
    }
    // Keep original acquisition order. Dropping a count removes its latest events.
    const kept = new Map<string, number>();
    this.history = this.history.filter((id) => {
      const count = kept.get(id) ?? 0;
      if (count >= (desired.get(id) ?? 0)) return false;
      kept.set(id, count + 1);
      return true;
    });
    const resources = structuredClone(this.player);
    for (const [id, count] of desired) {
      const item = REWARD_BY_ID.get(id);
      if (!item) continue;
      for (let n = kept.get(id) ?? 0; n < count; n++) {
        this.history.push(id);
        item.apply(resources); // Only new acquisitions pay their one-time resource effects.
      }
    }
    this.stacks.clear();
    this.trainingStacks.clear();
    for (const id of this.history) {
      const stacks = TRAINING_BY_ID.has(id) ? this.trainingStacks : this.stacks;
      stacks.set(id, (stacks.get(id) ?? 0) + 1);
    }
    this.rebuildStats();
    this.player.hp = Math.min(resources.hp, this.player.stats.maxHp);
    this.player.shield = resources.shield;
  }

  private rebuildStats(): void {
    const scratch = createPlayer(
      this.arena.player,
      this.arena.laneCount / 4,
      this.balance.payload.player,
    );
    for (const id of this.history) REWARD_BY_ID.get(id)?.apply(scratch);
    Object.assign(scratch.stats, this.overrides);
    this.player.stats = scratch.stats;
    this.player.hp = Math.min(this.player.hp, scratch.stats.maxHp);
  }

  private refreshReward(): void {
    const reward = this.reward;
    if (!reward) return;
    reward.token = this.invalidateReward();
    reward.choices =
      reward.source === "stage"
        ? drawBossRewards(
            this.player,
            this.stacks,
            this.random,
            this.stageIndex,
            this.rewardPolicy("stage"),
          )
        : drawCards(
            this.player,
            this.stacks,
            this.random,
            reward.source,
            this.stageIndex,
            this.rewardPolicy(reward.source),
          );
  }

  private captureEntry() {
    return structuredClone({
      player: this.player,
      cards: [...this.stacks],
      trainings: [...this.trainingStacks],
      history: this.history,
      overrides: this.overrides,
      regions: this.attackRegions,
      lastScoreTraining: this.lastScoreTraining,
      progress: Object.fromEntries(PROGRESS_KEYS.map((key) => [key, this[key]])) as Record<
        (typeof PROGRESS_KEYS)[number],
        number
      >,
      random: [
        this.random,
        this.trainingRandom,
        this.combatRandom,
        this.bossRandom,
        this.enemyRandom,
        this.regionRandom,
      ].map((random) => random.getState()),
    });
  }

  private restart(restore: boolean): void {
    const entry = this.entry;
    if (!entry) throw new Error("请先开始一局测试");
    const patch = { ...this.stagePatch };
    const weights = structuredClone(this.kindWeights);
    if (restore) {
      this.player = structuredClone(entry.player);
      this.history = [...entry.history];
      this.overrides = { ...entry.overrides };
      this.stacks.clear();
      for (const [id, n] of entry.cards) this.stacks.set(id, n);
      this.trainingStacks.clear();
      for (const [id, n] of entry.trainings) this.trainingStacks.set(id, n);
      Object.assign(this, entry.progress);
      this.lastScoreTraining = entry.lastScoreTraining;
      this.attackRegions.splice(0, this.attackRegions.length, ...structuredClone(entry.regions));
    }
    // Same entry RNG streams make comparisons reproducible; IDs deliberately never rewind.
    [
      this.random,
      this.trainingRandom,
      this.combatRandom,
      this.bossRandom,
      this.enemyRandom,
      this.regionRandom,
    ].forEach((random, index) => {
      random.setState(entry.random[index] ?? 0);
    });
    this.resetStage();
    if (!restore) {
      const previous = this.stage;
      this.stagePatch = patch;
      this.kindWeights = weights;
      this.configuredStage = undefined;
      this.rescheduleSpawns(previous);
    }
    this.entry = entry;
    this.toPaused();
  }
}

type RunCheckpoint = ReturnType<DebugWorld["captureEntry"]>;
