import type { BalanceProfile, KindWeights, PlayerSetup } from "../data/balance/model";
import {
  kindWeightsAt,
  officialProfile,
  resolvedStage,
  rewardPolicyAt,
} from "../data/balance/profile";
import { applyCard, drawCards } from "../data/cards";
import { CAMPAIGN_KINDS, ENDLESS_KINDS, ENEMIES, type EnemyDefinition } from "../data/enemies";
import { STAGES, type stageAt } from "../data/stages";
import { SYNERGIES, TIER_NAMES } from "../data/synergies";
import {
  applyTraining,
  drawBossRewards,
  eligibleTrainings,
  TRAINING_BY_ID,
} from "../data/training";
import { bossName, enemyName, rewardName, stageName, synergyName, tierName } from "../i18n/content";
import { t } from "../i18n/locale";
import { arenaLayout } from "./arena";
import { CONFIG } from "./config";
import type { ObservationDetails, WorldObservationType, WorldObserver } from "./observation";
import { Pool } from "./pool";
import { type SeededRandom, seededRandom, shuffled, weightedChoice } from "./random";
import { RunState } from "./state";
import { combatStats, overhealStats } from "./stats";
import { synergyProgress, synergyTier } from "./synergies";
import { advanceFormation, advanceFusion, crowdSpawn } from "./systems/crowd";
import {
  advancePoison,
  applyPoison,
  cleansePlayer,
  damagePlayer,
  grantShield,
  healingMultiplier,
  healPlayer,
} from "./systems/damage";
import { advanceAttackStage, advanceEnemy, attackPermitted } from "./systems/enemy";
import { clamp, segmentHitsCircle } from "./systems/movement";
import {
  chooseTarget,
  isEnemy,
  isTargetable,
  rankedTargets,
  tauntedTargets,
} from "./systems/targeting";
import type {
  AttackRegion,
  Blast,
  BossSkill,
  Chest,
  Enemy,
  EnemyKind,
  Particle,
  Player,
  Projectile,
  Reward,
  Target,
  Vec2,
} from "./types";

type DamageSource = "shot" | "blast" | "counter" | "arc";

export function createPlayer(
  position: Vec2 = CONFIG.player,
  population = 1,
  setup: PlayerSetup = officialProfile().payload.player,
): Player {
  return {
    ...position,
    hp: setup.hp,
    shield: setup.shield,
    invulnerable: 0,
    cooldown: 0,
    poisonTime: 0,
    poisonSlowTime: 0,
    woundTime: 0,
    poisonDamageBonus: 0,
    poisonSlowBonus: 0,
    stats: { ...setup.stats, damage: setup.stats.damage * population },
  };
}

function createProjectile(): Projectile {
  return {
    id: 0,
    active: false,
    x: 0,
    y: 0,
    previousX: 0,
    previousY: 0,
    vx: 0,
    vy: 0,
    radius: 4,
    damage: 0,
    hitsLeft: 1,
    hitIds: new Set(),
    targetId: null,
    lifetime: 0,
    primary: false,
    critical: false,
  };
}

export class World {
  private currentArena;
  readonly attackRegions: AttackRegion[];

  protected balance: BalanceProfile;
  private readonly definitions = new Map<EnemyKind, EnemyDefinition>();
  private observer?: WorldObserver;
  private hostileSources = new WeakMap<Projectile, string>();

  constructor(
    width: number = CONFIG.width,
    profile: BalanceProfile = officialProfile(),
    observer?: WorldObserver,
  ) {
    this.observer = observer;
    this.balance = structuredClone(profile);
    this.currentArena = arenaLayout(width);
    this.player = createPlayer(
      this.arena.player,
      this.arena.laneCount / 4,
      this.balance.payload.player,
    );
    this.attackRegions = [...this.arena.baseAttackRegions];
  }

  setObserver(observer?: WorldObserver): void {
    this.observer = observer;
    // Projectiles already in flight at attachment have unknown provenance.
    this.hostileSources = new WeakMap();
  }

  private observe(type: WorldObservationType, details: ObservationDetails = {}): void {
    if (!this.observer) return;
    this.observer(
      Object.freeze({
        type,
        stageIndex: this.stageIndex,
        elapsed: this.elapsed,
        stageElapsed: this.stageElapsed,
        hp: this.player.hp,
        maxHp: this.player.stats.maxHp,
        shield: this.player.shield,
        ...details,
        ...(details.choices ? { choices: Object.freeze([...details.choices]) } : {}),
      }),
    );
  }

  private observePlayerDamage(source: string, hp: number, shield: number): void {
    if (!this.observer) return;
    const hpLoss = hp - this.player.hp;
    const shieldAbsorbed = shield - this.player.shield;
    if (hpLoss <= 0 && shieldAbsorbed <= 0) return;
    this.observe("player_damage", {
      source,
      hpLoss,
      shieldAbsorbed,
      amount: hpLoss + shieldAbsorbed,
    });
    if (hp > 0 && this.player.hp <= 0) this.observe("death", { source });
  }

  private observeResourceGain(source: string, hp: number, shield: number): void {
    if (!this.observer) return;
    if (this.player.hp > hp) this.observe("heal", { source, amount: this.player.hp - hp });
    if (this.player.shield > shield)
      this.observe("shield", { source, amount: this.player.shield - shield });
  }
  readonly state = new RunState();
  readonly enemies = new Pool<Enemy>(CONFIG.limits.enemies, () => ({
    id: 0,
    active: false,
    kind: "wisp",
    x: 0,
    y: 0,
    hp: 0,
    maxHp: 0,
    radius: 0,
    speed: 0,
    age: 0,
    shotCooldown: 0,
    patternCooldown: 0,
    telegraph: 0,
    stage: "Approaching",
    attackPolicy: { type: "defense" },
    preparation: 0,
    arrived: false,
    slot: 0,
    defenseX: 0,
    defenseY: 0,
    spawnX: 0,
    spawnY: 0,
    enhanced: false,
    interruptDamage: 0,
    interruptRequired: 0,
    slow: 0,
    slowTime: 0,
    stunTime: 0,
    receivedHits: 0,
    primaryHits: 0,
    skillsUsed: 0,
    lastSkill: null,
    damageReductionTime: 0,
    stars: 1,
    damageScale: 1,
    fusionTime: 0,
    fusionPeers: "",
    tauntRemaining: 0,
    skillCooldown: 0,
    lastAction: null,
    formation: false,
  }));
  readonly shots = new Pool<Projectile>(CONFIG.limits.playerShots, createProjectile);
  readonly hostileShots = new Pool<Projectile>(CONFIG.limits.enemyShots, createProjectile);
  readonly chests = new Pool<Chest>(CONFIG.limits.chests, () => ({
    id: 0,
    active: false,
    x: 0,
    y: 0,
    hp: 0,
    maxHp: 0,
    radius: 26,
    age: 0,
  }));
  readonly particles = new Pool<Particle>(CONFIG.limits.particles, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    color: 0,
  }));
  readonly blasts = new Pool<Blast>(CONFIG.limits.blasts, () => ({
    active: false,
    x: 0,
    y: 0,
    radius: 0,
    life: 0,
    maxLife: 0.45,
    color: 0,
  }));
  readonly stacks = new Map<string, number>();
  readonly trainingStacks = new Map<string, number>();
  pendingSummons = 0;
  fusions = 0;
  poisonCasts = 0;
  tauntCasts = 0;
  player = createPlayer();
  reward: Reward | null = null;
  elapsed = 0;
  stageIndex = 0;
  stageElapsed = 0;
  sanctuaryRemaining = 0;
  clearedStages = 0;
  kills = 0;
  score = 0;
  scoreMilestones = 0;
  scoreTrainings = 0;
  lastScoreTraining: string | null = null;
  openedChests = 0;
  bossSpawned = false;
  bossDefeated = false;
  endingReason = "health" as const;
  lastHitAt = -10;
  notice = "";
  private englishNotice = "";

  get localizedNotice(): string {
    return t(this.notice, this.englishNotice);
  }

  private announce(chinese: string, english: string): void {
    this.notice = chinese;
    this.englishNotice = english;
  }
  noticeUntil = 0;
  seed = 0;
  targetId: number | null = null;
  manualTargetId: number | null = null;
  arrivals = 0;
  enemyAttacks = 0;
  regularAttacks = 0;
  bossSpecials = 0;
  bossInterrupts = 0;
  peakEnemies = 0;
  explosionCount = 0;
  chainKills = 0;
  echoVolleys = 0;
  shieldRestored = 0;
  executions = 0;
  stageSpawned = 0;
  meleeSpawns = 0;
  rangedSpawns = 0;
  damageDealt = 0;
  damageTaken = 0;
  healingDone = 0;
  criticalHits = 0;
  controlProcs = 0;
  stageSupplies = 0;
  readonly stageKindSpawns: Record<EnemyKind, number> = {
    wisp: 0,
    sentinel: 0,
    hexer: 0,
    tank: 0,
    wizard: 0,
    boss: 0,
  };
  protected trainingRandom: SeededRandom = seededRandom(4);
  protected random: SeededRandom = seededRandom(0);
  protected combatRandom: SeededRandom = seededRandom(1);
  protected bossRandom: SeededRandom = seededRandom(2);
  protected enemyRandom: SeededRandom = seededRandom(3);
  protected regionRandom: SeededRandom = seededRandom(5);
  protected configuredStage?: { index: number; value: ReturnType<typeof stageAt> };
  private nextId = 1;
  private rewardSerial = 0;
  private accumulator = 0;
  private spawnCooldown = 0.8;
  private nextChestAt: number = CONFIG.chestFirstAt;
  private bloodCooldown = 5;
  private shieldCooldown = 3;
  private stormCooldown = 6;
  private erosionCooldown = 4;
  private frostCooldown = 6;
  private controlCooldown = 8;
  private supportCooldown = 0;
  private supportSpawned = 0;
  private minionOrder: EnemyKind[] = [];
  private attackRegionSpawns = 0;
  private endlessRewardTimes: number[] = [];
  protected pendingStageReward = false;
  private volleys = 0;
  private readonly blastQueue: Array<{ x: number; y: number; radius: number; damage: number }> = [];

  get phase() {
    return this.state.phase;
  }
  get arena() {
    return this.currentArena;
  }
  get wave() {
    return Math.min(5, Math.floor(this.stageElapsed / 11) + 1);
  }
  get stage() {
    if (this.configuredStage?.index !== this.stageIndex)
      this.configuredStage = {
        index: this.stageIndex,
        value: this.resolveStage(this.stageIndex),
      };
    return this.configuredStage.value;
  }
  get profile(): BalanceProfile {
    return structuredClone(this.balance);
  }
  get endlessRules() {
    return this.balance.payload.endless;
  }

  resolveStage(index: number) {
    return resolvedStage(this.balance, index, this.arena.width);
  }

  enemyDefinition(enemy: Enemy): EnemyDefinition {
    return enemy.definition ?? this.enemyData(enemy.kind);
  }

  private enemyData(kind: EnemyKind): EnemyDefinition {
    let data = this.definitions.get(kind);
    if (!data) {
      data = { ...ENEMIES[kind], ...this.balance.payload.enemies[kind] };
      this.definitions.set(kind, data);
    }
    return data;
  }

  protected replaceBalance(profile: BalanceProfile): void {
    this.balance = structuredClone(profile);
    this.definitions.clear();
    this.configuredStage = undefined;
  }

  enemyStage(enemy: Enemy) {
    return enemy.encounter ?? this.stage;
  }

  protected rewardPolicy(source: Reward["source"]) {
    return rewardPolicyAt(this.balance, this.stageIndex, source);
  }

  protected acquired(_id: string): void {}

  protected minionWeights(): KindWeights | null {
    return kindWeightsAt(this.balance, this.stageIndex);
  }

  protected invalidateReward(): number {
    return ++this.rewardSerial;
  }

  protected rescheduleSpawns(previous: ReturnType<typeof stageAt>): void {
    if (this.stage.spawnInterval !== previous.spawnInterval)
      this.spawnCooldown = this.stage.spawnInterval;
    if (this.stage.supportInterval !== previous.supportInterval)
      this.supportCooldown = this.stage.supportInterval;
  }

  get endless() {
    return this.stageIndex >= STAGES.length;
  }
  get bossSlamDamage() {
    return Math.round(
      (this.balance.payload.endless.slamDamage +
        Math.max(0, this.stageIndex - STAGES.length) *
          this.balance.payload.endless.slamDamagePerStage) *
        this.balance.payload.endless.damageMultiplier,
    );
  }
  get boss(): Enemy | undefined {
    return this.enemies.items.find((enemy) => enemy.active && enemy.kind === "boss");
  }

  get targets(): Target[] {
    return [...this.enemies.items, ...this.chests.items].filter(isTargetable);
  }

  get target(): Target | undefined {
    return this.targets.find((target) => target.id === this.targetId);
  }

  selectTargetAt(point: Vec2, tolerance = 14): boolean {
    if (this.phase !== "Playing" || !Number.isFinite(point.x) || !Number.isFinite(point.y))
      return false;
    const candidates = this.targets
      .map((target) => ({ target, distance: Math.hypot(target.x - point.x, target.y - point.y) }))
      .filter(({ target, distance }) => distance <= target.radius + clamp(tolerance, 0, 36))
      .sort(
        (a, b) =>
          Number(b.distance <= b.target.radius) - Number(a.distance <= a.target.radius) ||
          a.distance / a.target.radius - b.distance / b.target.radius ||
          a.target.id - b.target.id,
      );
    this.manualTargetId = candidates[0]?.target.id ?? null;
    this.refreshTarget();
    return true;
  }

  cycleTarget(): void {
    if (this.phase !== "Playing") return;
    const targets = rankedTargets(
      tauntedTargets(this.targets, this.endless, this.sanctuaryRemaining > 0),
    );
    const index = targets.findIndex((target) => target.id === this.manualTargetId);
    this.manualTargetId = targets[(index + 1) % targets.length]?.id ?? null;
    this.refreshTarget();
  }

  clearTarget(): void {
    if (this.phase !== "Playing") return;
    this.manualTargetId = null;
    this.refreshTarget();
  }

  protected refreshTarget(): void {
    const targets = this.targets;
    if (!targets.some((target) => target.id === this.manualTargetId)) this.manualTargetId = null;
    this.targetId =
      chooseTarget(
        targets,
        this.targetId,
        this.manualTargetId,
        undefined,
        this.endless,
        this.sanctuaryRemaining > 0,
      )?.id ?? null;
  }

  start(seed = Date.now(), arenaWidth = this.arena.width): boolean {
    if (["Playing", "RewardSelection", "StageClear"].includes(this.phase)) return false;
    // Validate before changing phase, then apply geometry only to an accepted new run.
    const nextArena = arenaWidth === this.arena.width ? this.arena : arenaLayout(arenaWidth);
    if (!this.state.transition("Playing")) return false;
    if (nextArena !== this.arena) {
      this.currentArena = nextArena;
      this.configuredStage = undefined;
    }
    this.reset(seed);
    if (this.observer) this.observe("stage_enter");
    return true;
  }

  pause(): boolean {
    return this.state.transition("Paused");
  }
  resume(): boolean {
    return this.phase === "Paused" && this.state.transition("Playing");
  }

  toMenu(): boolean {
    if (!this.state.transition("Menu")) return false;
    this.reset(this.seed);
    return true;
  }

  protected reset(seed: number): void {
    this.seed = seed;
    this.random = seededRandom(seed);
    this.trainingRandom = seededRandom(seed ^ 0x7a11);
    this.combatRandom = seededRandom(seed ^ 0x5a17);
    this.bossRandom = seededRandom(seed ^ 0xb055);
    this.enemyRandom = seededRandom(seed ^ 0xe11e);
    this.regionRandom = seededRandom(seed ^ 0x2a0e);
    this.attackRegions.splice(0, this.attackRegions.length, ...this.arena.baseAttackRegions);
    this.player = createPlayer(
      this.arena.player,
      this.arena.laneCount / 4,
      this.balance.payload.player,
    );
    this.stacks.clear();
    this.trainingStacks.clear();
    this.fusions = 0;
    this.poisonCasts = 0;
    this.tauntCasts = 0;
    this.reward = null;
    this.elapsed = 0;
    this.stageIndex = 0;
    this.stageElapsed = 0;
    this.clearedStages = 0;
    this.kills = 0;
    this.score = 0;
    this.scoreMilestones = 0;
    this.scoreTrainings = 0;
    this.lastScoreTraining = null;
    this.openedChests = 0;
    this.bossSpawned = false;
    this.lastHitAt = -10;
    this.notice = "";
    this.englishNotice = "";
    this.noticeUntil = 0;
    // IDs remain monotonic across pool reuse and runs; locks never alias a recycled entity.
    this.targetId = null;
    this.manualTargetId = null;
    this.arrivals = 0;
    this.enemyAttacks = 0;
    this.regularAttacks = 0;
    this.bossSpecials = 0;
    this.bossInterrupts = 0;
    this.peakEnemies = 0;
    this.explosionCount = 0;
    this.chainKills = 0;
    this.echoVolleys = 0;
    this.shieldRestored = 0;
    this.executions = 0;
    this.meleeSpawns = 0;
    this.rangedSpawns = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.healingDone = 0;
    this.criticalHits = 0;
    this.controlProcs = 0;
    this.resetStage();
  }

  protected resetStage(): void {
    this.stageElapsed = 0;
    this.sanctuaryRemaining = 0;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.reward = null;
    this.targetId = null;
    this.manualTargetId = null;
    this.player.cooldown = 0;
    this.player.invulnerable = 0;
    cleansePlayer(this.player);
    this.lastHitAt = -10;
    this.accumulator = 0;
    this.spawnCooldown = 0.8;
    this.nextChestAt = CONFIG.chestFirstAt;
    this.bloodCooldown = 5;
    this.shieldCooldown = 3;
    this.supportCooldown = this.stage.supportInterval;
    this.supportSpawned = 0;
    this.pendingSummons = 0;
    this.stormCooldown = 6;
    this.erosionCooldown = 4;
    this.frostCooldown = 6;
    this.controlCooldown = 8;
    this.stageSpawned = 0;
    this.stageSupplies = 0;
    this.endlessRewardTimes = [];
    this.minionOrder = [];
    this.attackRegionSpawns = 0;
    this.pendingStageReward = false;
    for (const kind of Object.keys(this.stageKindSpawns) as EnemyKind[])
      this.stageKindSpawns[kind] = 0;
    this.volleys = 0;
    this.blastQueue.length = 0;
    this.clearCombat();
    this.particles.clear();
    this.blasts.clear();
  }

  protected clearCombat(): void {
    for (const pool of [this.enemies, this.shots, this.hostileShots, this.chests]) pool.clear();
    this.targetId = null;
    this.manualTargetId = null;
    this.blastQueue.length = 0;
    this.pendingSummons = 0;
  }

  private advanceStage(): void {
    const previousIndex = this.stageIndex;
    const previousElapsed = this.stageElapsed;
    if (this.endless) {
      const active = new Set(this.attackRegions.map((region) => region.id));
      const added = shuffled(
        this.arena.attackRegions.filter((region) => !active.has(region.id)),
        this.regionRandom,
      ).slice(0, 2);
      this.attackRegions.push(...added);
    }
    this.stageIndex++;
    cleansePlayer(this.player);
    const hp = this.player.hp;
    healPlayer(this.player, 35);
    if (this.observer) {
      if (this.player.hp > hp)
        this.observe("heal", {
          source: "stage_recovery",
          amount: this.player.hp - hp,
          stageIndex: previousIndex,
          stageElapsed: previousElapsed,
        });
      this.observe("stage_ready", { stageIndex: previousIndex, stageElapsed: previousElapsed });
    }
    this.resetStage();
    if (this.observer) this.observe("stage_enter");
    this.announce(
      `${this.stage.name} · 构筑已保留，恢复 35 生命`,
      `${stageName(this.stageIndex, "en")} · Build retained; recover up to 35 HP`,
    );
    this.noticeUntil = this.elapsed + 3;
  }

  continueEndless(): boolean {
    if (this.phase !== "Victory" || this.clearedStages < STAGES.length) return false;
    this.advanceStage();
    return this.state.transition("Playing");
  }

  chooseCard(id: string, token: number): boolean {
    if (
      !["RewardSelection", "StageClear"].includes(this.phase) ||
      !this.reward ||
      this.reward.token !== token ||
      !this.reward.choices.includes(id) ||
      (this.reward.source === "stage") !== (this.phase === "StageClear")
    )
      return false;
    const before = synergyProgress(this.stacks);
    const hp = this.player.hp;
    const shield = this.player.shield;
    const stageReward = this.reward.source === "stage";
    const training = TRAINING_BY_ID.has(id);
    if (
      training
        ? !stageReward || !applyTraining(id, this.player, this.trainingStacks)
        : !applyCard(id, this.player, this.stacks)
    )
      return false;
    if (this.observer) {
      this.observeResourceGain(`reward:${id}`, hp, shield);
      this.observe("reward_choice", {
        source: this.reward.source,
        choices: this.reward.choices,
        choice: id,
        training,
        automatic: false,
      });
    }
    this.acquired(id);
    return this.finishReward(stageReward, before);
  }

  skipUnavailableReward(token: number): boolean {
    if (
      !["RewardSelection", "StageClear"].includes(this.phase) ||
      !this.reward ||
      this.reward.token !== token ||
      this.reward.choices.length !== 0 ||
      (this.reward.source === "stage") !== (this.phase === "StageClear")
    )
      return false;
    if (this.observer)
      this.observe("reward_skip", { source: this.reward.source, choices: this.reward.choices });
    return this.finishReward(this.reward.source === "stage", synergyProgress(this.stacks));
  }

  private finishReward(stageReward: boolean, before: ReturnType<typeof synergyProgress>): boolean {
    // Remove the capability before resuming: stale clicks cannot claim this reward again.
    this.reward = null;
    if (stageReward && this.stageIndex === STAGES.length - 1) {
      if (this.observer) this.observe("stage_ready");
      this.state.transition("Victory");
      this.accumulator = 0;
      return true;
    }
    if (stageReward) this.advanceStage();
    this.state.transition("Playing");
    this.accumulator = 0;
    if (this.pendingStageReward) {
      if (this.stageSupplies < this.balance.payload.endless.supplies) this.offerEndlessSupply();
      else this.offerStageReward();
      return true;
    }
    const activated = SYNERGIES.find(
      (synergy, index) => synergyTier(this.stacks, synergy.id) > (before[index]?.tier ?? 0),
    );
    if (activated)
      this.announce(
        `${activated.name} · ${TIER_NAMES[synergyTier(this.stacks, activated.id)]}${stageReward ? " · 下一关已开启" : ""}`,
        `${synergyName(activated.id, "en")} · ${tierName(synergyTier(this.stacks, activated.id), "en")}${stageReward ? " · Next stage unlocked" : ""}`,
      );
    else if (!stageReward)
      this.announce("残响已融合 · 继续改写命运", "Echo fused · Keep rewriting fate");
    this.noticeUntil = this.elapsed + 3;
    return true;
  }

  private prepareEndlessSupplies(): void {
    if (this.endlessRewardTimes.length > 0) return;
    // Sample simulation times once per stage. Pauses never consume the schedule.
    this.endlessRewardTimes = Array.from({ length: this.balance.payload.endless.supplies }, () => {
      const end = Math.max(0, this.stage.bossAt - 5);
      const start = Math.min(CONFIG.chestFirstAt, end);
      return start + this.random() * (end - start);
    }).sort((a, b) => a - b);
  }

  protected offerEndlessSupply(): void {
    if (this.stageSupplies >= this.balance.payload.endless.supplies) return;
    this.stageSupplies++;
    this.reward = {
      token: ++this.rewardSerial,
      choices: drawCards(
        this.player,
        this.stacks,
        this.random,
        "supply",
        this.stageIndex,
        this.rewardPolicy("supply"),
      ),
      source: "supply",
    };
    this.state.transition("RewardSelection");
    if (this.observer)
      this.observe("reward_offer", { source: this.reward.source, choices: this.reward.choices });
  }

  protected offerStageReward(): void {
    this.pendingStageReward = false;
    this.reward = {
      token: ++this.rewardSerial,
      choices: drawBossRewards(
        this.player,
        this.stacks,
        this.random,
        this.stageIndex,
        this.rewardPolicy("stage"),
      ),
      source: "stage",
    };
    this.state.transition("StageClear");
    if (this.observer)
      this.observe("reward_offer", { source: this.reward.source, choices: this.reward.choices });
  }

  update(delta: number): void {
    if (this.phase !== "Playing" || !Number.isFinite(delta) || delta <= 0) return;
    this.accumulator += Math.min(delta, CONFIG.maxFrameDelta);
    while (this.accumulator + 1e-9 >= CONFIG.fixedStep && this.phase === "Playing") {
      this.accumulator -= CONFIG.fixedStep;
      this.step(CONFIG.fixedStep);
    }
    if (this.phase !== "Playing") this.accumulator = 0;
  }

  private step(delta: number): void {
    this.advanceControlPulse(delta);
    this.advanceCombat(delta);
    this.sanctuaryRemaining = Math.max(0, this.sanctuaryRemaining - delta);
    if (this.sanctuaryRemaining < 1e-9) this.sanctuaryRemaining = 0;
  }

  private advanceControlPulse(delta: number): void {
    // This cooldown uses hostile time, so a pulse cannot recharge itself while time is stopped.
    if (this.sanctuaryRemaining > 0) return;
    const dominion = synergyTier(this.stacks, "dominion");
    if (this.player.stats.controlPulse <= 0 && dominion < 6) return;
    const interval = dominion >= 6 ? CONFIG.sanctuary.empoweredInterval : CONFIG.sanctuary.interval;
    this.controlCooldown = Math.min(this.controlCooldown, interval) - delta;
    if (this.controlCooldown > 1e-9) return;
    this.controlCooldown = interval;
    this.sanctuaryRemaining =
      (CONFIG.sanctuary.baseDuration +
        this.player.stats.controlPulse * CONFIG.sanctuary.durationPerLayer) *
      (dominion >= 9 ? 1.6 : dominion >= 3 ? 1.3 : 1);
    cleansePlayer(this.player);
    if (dominion >= 6) this.hostileShots.clear();
    this.controlProcs++;
    if (this.observer)
      this.observe("mechanic", { source: "sanctuary", amount: this.sanctuaryRemaining });
    this.showBlast({ x: this.arena.player.x, y: 350 }, 500, 0xc7b7e8);
    this.announce(
      "遗世庇护 · 状态已净化，时序暂歇，敌方嘲讽失效",
      "Sanctuary · Debuffs cleansed, hostile time frozen, taunts disabled",
    );
    this.noticeUntil = this.elapsed + this.sanctuaryRemaining;
  }

  private advanceCombat(delta: number): void {
    const frozen = this.sanctuaryRemaining > 0;
    const hostileDelta = frozen ? 0 : delta;
    this.elapsed += delta;
    this.stageElapsed += hostileDelta;
    this.player.invulnerable = Math.max(0, this.player.invulnerable - delta);
    const poisonHp = this.player.hp;
    const poisonShield = this.player.shield;
    this.damageTaken += advancePoison(this.player, hostileDelta);
    if (this.observer) this.observePlayerDamage("poison", poisonHp, poisonShield);
    if (this.player.hp <= 0) {
      this.state.transition("GameOver");
      return;
    }
    for (const enemy of this.enemies.items) {
      if (enemy.active) {
        enemy.damageReductionTime = Math.max(0, enemy.damageReductionTime - hostileDelta);
        enemy.tauntRemaining = Math.max(0, enemy.tauntRemaining - hostileDelta);
      }
    }
    if (this.endless) {
      this.prepareEndlessSupplies();
    }
    // Position is a simulation invariant, independent of all browser input.
    Object.assign(this.player, this.arena.player);
    if (!frozen) this.spawn(delta);
    for (const enemy of this.enemies.items) {
      if (!frozen && enemy.active && !enemy.formation) {
        if (advanceEnemy(enemy, this.enemyDelta(enemy, delta), this.wave)) {
          this.arrivals++;
          if (this.observer)
            this.observe("mechanic", { source: "arrival", kind: enemy.kind, amount: 1 });
        }
        if (this.endless && enemy.kind === "boss") enemy.x = enemy.defenseX;
      }
    }
    if (!frozen && this.endless) {
      const arrivals = advanceFormation(
        this.enemies.items,
        delta,
        this.wave,
        (enemy, time) => this.enemyDelta(enemy, time),
        this.arena.crowdLanes,
      );
      this.arrivals += arrivals;
      if (this.observer && arrivals > 0)
        this.observe("mechanic", { source: "arrival", amount: arrivals });
      advanceFusion(
        this.enemies.items,
        delta,
        (enemy) => {
          this.fusions++;
          if (this.observer)
            this.observe("mechanic", { source: "fusion", kind: enemy.kind, amount: 1 });
          this.showBlast(enemy, enemy.radius + 16, 0xdec28a);
          this.announce(
            `${ENEMIES[enemy.kind].name} · 融合为 ${enemy.stars} 星，生命已回满`,
            `${enemyName(enemy.kind, "en")} · Fused to ${enemy.stars} stars; HP restored`,
          );
          this.noticeUntil = this.elapsed + 2;
        },
        CONFIG.fusion.distance * this.arena.rangeScale,
      );
    }
    this.refreshTarget();
    this.attack(delta);
    this.moveShots(this.shots, delta);
    if (!frozen) this.moveShots(this.hostileShots, delta);
    for (const chest of this.chests.items) {
      if (!chest.active || frozen) continue;
      chest.age += hostileDelta;
      chest.y = Math.min(340, chest.y + 7 * hostileDelta);
    }
    this.collisions();
    this.completeStageIfReady();
    this.refreshTarget();
    if (this.phase !== "Playing") return;
    this.buildEffects(delta);
    this.completeStageIfReady();
    this.refreshTarget();
    if (this.phase !== "Playing") return;
    // Resolve incoming friendly hits before releasing an attack on this step.
    if (!frozen && this.boss && this.endless) this.endlessBossSkills(this.boss);
    if (this.phase !== "Playing") return;
    this.enemyAttack(delta);
    this.completeStageIfReady();
    if (this.phase !== "Playing") return;
    for (const enemy of this.enemies.items) {
      if (!enemy.active) continue;
      enemy.stunTime = Math.max(0, enemy.stunTime - hostileDelta);
      enemy.slowTime = Math.max(0, enemy.slowTime - hostileDelta);
      if (enemy.slowTime === 0) enemy.slow = 0;
    }
    for (const particle of this.particles.items) {
      if (!particle.active) continue;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.life -= delta;
      if (particle.life <= 0) particle.active = false;
    }
    for (const blast of this.blasts.items) {
      if (!blast.active) continue;
      blast.life -= delta;
      if (blast.life <= 0) blast.active = false;
    }
    if (
      this.endless &&
      !frozen &&
      this.stageElapsed >= (this.endlessRewardTimes[this.stageSupplies] ?? Infinity)
    ) {
      this.offerEndlessSupply();
    }
  }

  private enemyDelta(enemy: Enemy, delta: number): number {
    return this.sanctuaryRemaining > 0 || enemy.stunTime > 0
      ? 0
      : delta * (1 - (enemy.slowTime > 0 ? enemy.slow : 0));
  }

  private attack(delta: number): void {
    this.player.cooldown = Math.max(0, this.player.cooldown - delta);
    const target = this.target;
    if (this.player.cooldown > 1e-9 || !target) return;
    const stats = combatStats(this.player, this.stacks);
    const barrage = synergyTier(this.stacks, "barrage");
    const might = synergyTier(this.stacks, "might");
    this.player.cooldown += stats.interval;
    this.volleys++;
    const cadence = might >= 9 ? 3 : might >= 6 ? 4 : 5;
    const heavy =
      this.volleys % cadence === 0
        ? this.player.stats.crush + (might >= 9 ? 0.8 : might >= 6 ? 0.3 : 0)
        : 0;
    this.fireVolley(target, 1 + heavy);
    if (barrage >= 6 && this.volleys % (barrage >= 9 ? 3 : 4) === 0) {
      this.fireVolley(target, 1 + heavy);
      this.echoVolleys++;
    }
  }

  private fireVolley(target: Target, multiplier: number): void {
    const stats = combatStats(this.player, this.stacks);
    const count = stats.projectiles;
    const others = rankedTargets(
      tauntedTargets(this.targets, this.endless, this.sanctuaryRemaining > 0),
    ).filter((item) => item.id !== target.id);
    const guaranteed = synergyTier(this.stacks, "precision") >= 9 && this.volleys % 3 === 0;
    for (let index = 0; index < count; index++) {
      const offset = index - (count - 1) / 2;
      const aim = index === 0 ? target : (others[(index - 1) % others.length] ?? target);
      const x = this.player.x + offset * 10;
      const y = this.player.y - 22;
      const angle = Math.atan2(aim.y - y, aim.x - x);
      const critical = guaranteed || this.combatRandom() < stats.critChance;
      const shot = this.projectile(
        this.shots,
        x,
        y,
        Math.cos(angle) * CONFIG.friendlyShot.speed * Math.sqrt(this.arena.width / CONFIG.width),
        Math.sin(angle) * CONFIG.friendlyShot.speed * Math.sqrt(this.arena.width / CONFIG.width),
        stats.damage *
          multiplier *
          (index === 0 ? 1 : stats.secondaryDamage) *
          (critical ? stats.critDamage : 1),
        4,
        this.player.stats.piercing + 1,
        aim.id,
      );
      if (shot) {
        shot.primary = index === 0;
        shot.critical = critical;
      }
    }
  }

  private projectile(
    pool: Pool<Projectile>,
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    radius = 6,
    hits = 1,
    targetId: number | null = null,
  ): Projectile | undefined {
    const shot = pool.acquire();
    if (!shot) return;
    Object.assign(shot, {
      id: this.nextId++,
      x,
      y,
      previousX: x,
      previousY: y,
      vx,
      vy,
      damage,
      radius,
      hitsLeft: hits,
      targetId,
      lifetime: pool === this.shots ? CONFIG.friendlyShot.lifetime : 6,
      primary: false,
      critical: false,
    });
    shot.hitIds.clear();
    return shot;
  }

  private spawn(delta: number): void {
    const stage = this.stage;
    if (!this.bossSpawned && this.stageElapsed >= stage.bossAt) {
      this.bossSpawned = Boolean(this.spawnEnemy("boss", this.arena.width / 2));
      if (!this.bossSpawned) return;
      this.reinforceBoss();
      this.supportCooldown = stage.supportInterval;
      this.announce(
        this.endless
          ? `${stage.bossName} · 全场攻击，抵达防线伤害翻倍；每损失 30% 生命随机施法`
          : `${stage.bossName} · 远近护卫到场，金色蓄力可打断`,
        this.endless
          ? `${bossName(this.stageIndex, "en")} · Attacks everywhere; double damage at defense line; random skill per 30% HP lost`
          : `${bossName(this.stageIndex, "en")} · Melee and ranged escorts arrive; interrupt the gold charge`,
      );
      this.noticeUntil = this.elapsed + 3;
    }
    if (!this.bossSpawned) {
      this.spawnCooldown -= delta;
      if (this.spawnCooldown <= 0 && this.stageSpawned < stage.enemyCount) {
        if (this.spawnMinion(42 + this.random() * (this.arena.width - 84))) this.stageSpawned++;
        // One admission per fixed step bounds catch-up work at extreme endless depths.
        this.spawnCooldown += stage.spawnInterval;
      }
      if (
        !this.endless &&
        this.stageElapsed >= this.nextChestAt &&
        this.nextChestAt <= Math.min(CONFIG.chestLastAt, stage.bossAt - 5) &&
        !this.chests.items.some((chest) => chest.active)
      ) {
        const chest = this.chests.acquire();
        if (chest) {
          Object.assign(chest, {
            id: this.nextId++,
            x:
              this.nextChestAt === CONFIG.chestFirstAt
                ? this.arena.width / 2 - 115
                : 70 + this.random() * (this.arena.width - 140),
            y: 240,
            hp: 36,
            maxHp: 36,
            radius: 26,
            age: 0,
          });
          this.nextChestAt = this.stageElapsed + CONFIG.chestInterval;
          this.announce(
            "宝箱显现 · 点击可优先击破，获取残响",
            "Chest appeared · Select it to focus fire and claim an echo",
          );
          this.noticeUntil = this.elapsed + 3;
        }
      }
    } else if (this.boss) {
      this.drainSummons();
      this.supportCooldown -= delta;
      if (this.supportCooldown <= 0) {
        this.supportCooldown += stage.supportInterval;
        if (this.pendingSummons === 0) this.reinforceBoss();
      }
    }
  }

  private drainSummons(): void {
    for (let count = this.pendingSummons; count > 0; count--) {
      if (!this.spawnMinion(this.arena.player.x, true)) break;
      this.pendingSummons--;
    }
  }

  private reinforceBoss(enhanced = false): void {
    // Reinforcements have no total quota while the boss lives. Bound each batch
    // by free slots even when its planned size grows beyond the physical pool.
    const available =
      this.stage.maxEnemies - this.enemies.items.filter((item) => item.active).length;
    const count = Math.min(this.stage.supportCount, available);
    for (let index = 0; index < count; index++) {
      const position = this.supportSpawned % this.arena.laneCount;
      if (!this.spawnMinion(this.arena.crowdLanes[position] ?? this.arena.player.x, enhanced))
        break;
      // Failed admissions do not consume the balanced species cycle.
      this.supportSpawned++;
    }
  }

  private spawnMinion(x: number, enhanced = false): Enemy | undefined {
    const minions = this.enemies.items.filter((item) => item.active && item.kind !== "boss").length;
    if (minions >= Math.min(this.arena.minionCapacity, this.stage.maxEnemies - 1)) return;
    const weights = this.minionWeights();
    if (weights) {
      const kind = weightedChoice(
        Object.keys(weights) as Exclude<EnemyKind, "boss">[],
        (item) => weights[item],
        this.random,
      );
      return kind ? this.spawnEnemy(kind, x, enhanced) : undefined;
    }
    if (this.minionOrder.length === 0) {
      this.minionOrder = [...(this.endless ? ENDLESS_KINDS : CAMPAIGN_KINDS)];
      for (let index = this.minionOrder.length - 1; index > 0; index--) {
        const other = Math.floor(this.random() * (index + 1));
        const kind = this.minionOrder[index];
        const swapped = this.minionOrder[other];
        if (kind && swapped) {
          this.minionOrder[index] = swapped;
          this.minionOrder[other] = kind;
        }
      }
    }
    const kind = this.minionOrder[0];
    if (!kind) return;
    const enemy = this.spawnEnemy(kind, x, enhanced);
    if (enemy) this.minionOrder.shift();
    return enemy;
  }

  protected spawnEnemy(kind: EnemyKind, x: number, enhanced = false): Enemy | undefined {
    if (this.enemies.items.filter((item) => item.active).length >= this.stage.maxEnemies) return;
    const data = this.enemyData(kind);
    const occupied = new Set(
      this.enemies.items
        .filter((item) => item.active && item.kind !== "boss")
        .map((item) => item.slot),
    );
    const slots = Array.from({ length: this.arena.minionCapacity }, (_, index) => index);
    const slotX = (slot: number) =>
      this.arena.crowdLanes[slot % this.arena.laneCount] ?? this.arena.player.x;
    const slot =
      kind === "boss"
        ? this.arena.minionCapacity
        : slots
            .filter((index) => !occupied.has(index))
            .sort(
              (a, b) =>
                Math.floor(a / this.arena.laneCount) - Math.floor(b / this.arena.laneCount) ||
                Math.abs(slotX(a) - x) - Math.abs(slotX(b) - x) ||
                a - b,
            )[0];
    if (slot === undefined) return;
    const minionSpawns = Object.entries(this.stageKindSpawns).reduce(
      (count, [kind, spawned]) => count + (kind === "boss" ? 0 : spawned),
      0,
    );
    const requireAttackRegion =
      this.attackRegionSpawns <
      Math.ceil((minionSpawns + 1) * CONFIG.endless.attackRegionSpawnRatio - 1e-9);
    const position =
      this.endless && kind !== "boss"
        ? crowdSpawn(
            this.enemies.items,
            this.random,
            this.arena.crowdLanes,
            requireAttackRegion ? this.attackRegions : undefined,
          )
        : undefined;
    if (this.endless && kind !== "boss" && !position) return;
    const enemy = this.enemies.acquire();
    if (!enemy) return;
    const hp =
      kind === "boss"
        ? (this.stage.bossHp * data.hp) / ENEMIES.boss.hp
        : Math.round(
            data.hp *
              this.stage.health *
              this.stage.populationScale *
              (1 + (this.wave - 1) * 0.12) *
              (enhanced ? this.balance.payload.endless.summonMultiplier : 1),
          );
    const ranged = kind !== "boss" && data.attackStyle === "ranged";
    const spawnX = kind === "boss" ? this.arena.player.x : (position?.x ?? slotX(slot));
    const spawnY = kind === "boss" ? -55 : (position?.y ?? -30);
    Object.assign(enemy, {
      id: this.nextId++,
      kind,
      definition: data,
      encounter: structuredClone(this.stage),
      x: spawnX,
      y: spawnY,
      spawnX,
      spawnY,
      enhanced,
      hp,
      maxHp: hp,
      radius: data.radius,
      speed: data.speed * (kind === "boss" ? 1 : this.stage.speed),
      age: 0,
      telegraph: 0,
      shotCooldown: 0,
      patternCooldown: 2.8,
      stage: "Approaching",
      attackPolicy: {
        ...(kind === "boss" && this.endless
          ? { type: "anywhere" as const }
          : this.endless && !ranged
            ? { type: "zones" as const, regions: this.attackRegions }
            : kind === "boss" || ranged
              ? data.attackPolicy
              : this.stage.attackPolicy),
      },
      preparation: 0,
      arrived: false,
      slot,
      defenseX: spawnX,
      defenseY:
        kind === "boss"
          ? CONFIG.defense.y
          : Math.max(
              spawnY,
              CONFIG.defense.y - Math.floor(slot / this.arena.laneCount) * CONFIG.crowd.cellHeight,
            ),
      interruptDamage: 0,
      interruptRequired: 0,
      slow: 0,
      slowTime: 0,
      stunTime: 0,
      receivedHits: 0,
      primaryHits: 0,
      skillsUsed: 0,
      lastSkill: null,
      damageReductionTime: 0,
      stars: 1,
      damageScale:
        kind === "boss"
          ? 1
          : Math.sqrt(this.stage.populationScale) *
            (enhanced ? this.balance.payload.endless.summonMultiplier : 1),
      fusionTime: 0,
      fusionPeers: "",
      tauntRemaining: 0,
      skillCooldown: (1.5 + this.enemyRandom() * 2.5) * this.stage.attackTiming,
      lastAction: null,
      formation: this.endless && kind !== "boss",
    });
    this.stageKindSpawns[kind]++;
    if (
      this.endless &&
      kind !== "boss" &&
      this.attackRegions.some(
        (region) =>
          spawnX >= region.x &&
          spawnX < region.x + region.width &&
          spawnY >= region.y &&
          spawnY < region.y + region.height,
      )
    )
      this.attackRegionSpawns++;
    if (ranged) this.rangedSpawns++;
    else if (kind !== "boss") this.meleeSpawns++;
    const activeEnemies = this.enemies.items.filter((item) => item.active).length;
    this.peakEnemies = Math.max(this.peakEnemies, activeEnemies);
    if (this.observer) this.observe("enemy_spawn", { kind, amount: activeEnemies });
    if (this.observer && kind === "boss") this.observe("boss_spawn", { kind });
    return enemy;
  }

  private enemyAttack(delta: number): void {
    for (const enemy of this.enemies.items) {
      if (this.phase !== "Playing") break;
      const effectiveDelta = this.enemyDelta(enemy, delta);
      if (!enemy.active || effectiveDelta <= 0) continue;
      if (enemy.kind === "tank" && !attackPermitted(enemy)) {
        enemy.skillCooldown -= effectiveDelta;
        if (enemy.skillCooldown <= 1e-9) {
          enemy.skillCooldown =
            CONFIG.skills.approachInterval * this.enemyStage(enemy).attackTiming;
          if (this.enemyRandom() < CONFIG.skills.tauntChance) this.castTaunt(enemy);
        }
      }
      if (
        !advanceAttackStage(
          enemy,
          effectiveDelta,
          this.enemyStage(enemy).attackTiming,
          this.enemyDefinition(enemy).preparation,
        )
      )
        continue;
      const enraged = enemy.kind === "boss" && enemy.hp < enemy.maxHp / 2;
      if (enemy.kind === "boss" && !this.endless) {
        if (enemy.telegraph > 0) {
          enemy.telegraph = Math.max(0, enemy.telegraph - effectiveDelta);
          if (enemy.telegraph <= 1e-9) {
            // Consume the charge even when subtraction leaves a tiny positive residue.
            enemy.telegraph = 0;
            this.aimedVolley(
              enemy,
              1,
              this.enemyStage(enemy).specialDamage + (enraged ? 4 : 0),
              240,
              10,
            );
            this.bossSpecials++;
            if (this.observer)
              this.observe("mechanic", {
                source: "boss_skill:charged_volley",
                kind: enemy.kind,
                amount: 1,
              });
            enemy.patternCooldown = enraged ? 3.6 : 4.5;
            enemy.shotCooldown = 1.2;
          }
          continue;
        }
        enemy.patternCooldown -= effectiveDelta;
        if (enemy.patternCooldown <= 0) {
          enemy.telegraph = this.enemyStage(enemy).chargeTime - (enraged ? 0.3 : 0);
          enemy.interruptDamage = 0;
          enemy.interruptRequired = Math.round(
            this.enemyStage(enemy).interrupt * (enraged ? 4 / 3 : 1),
          );
          this.announce(
            `首领蓄力 · 造成 ${enemy.interruptRequired} 伤害可打断`,
            `Boss charging · Deal ${enemy.interruptRequired} damage to interrupt`,
          );
          this.noticeUntil = this.elapsed + enemy.telegraph;
          continue;
        }
      }
      if (
        this.enemyDefinition(enemy).attackStyle === "melee" &&
        !enemy.arrived &&
        enemy.attackPolicy.type !== "zones"
      )
        continue;
      enemy.shotCooldown -= effectiveDelta;
      if (enemy.shotCooldown > 1e-9) continue;
      const data = this.enemyDefinition(enemy);
      enemy.shotCooldown +=
        data.interval *
        (enraged ? 0.8 : 1) *
        (enemy.kind === "boss" ? this.enemyStage(enemy).bossInterval : 1) *
        this.enemyStage(enemy).attackTiming;
      if (enemy.kind === "tank" && this.enemyRandom() < CONFIG.skills.tauntChance) {
        this.castTaunt(enemy);
        continue;
      }
      if (enemy.kind === "wizard" && this.enemyRandom() < CONFIG.skills.poisonChance) {
        this.poisonCasts++;
        enemy.lastAction = "poison";
        applyPoison(this.player, this.enemyRandom);
        if (this.observer)
          this.observe("mechanic", { source: "poison", kind: enemy.kind, amount: 1 });
        this.showBlast(enemy, enemy.radius + 10, 0xb6e7a4);
        continue;
      }
      enemy.lastAction = "attack";
      if (data.attackStyle === "melee") {
        this.enemyAttacks++;
        this.regularAttacks++;
        if (this.observer)
          this.observe("mechanic", { source: "enemy_attack", kind: enemy.kind, amount: 1 });
        this.showBlast({ x: enemy.x, y: enemy.defenseY }, 36, 0xe57d98);
        this.hurt(
          data.damage * this.enemyStage(enemy).damage * enemy.damageScale,
          `melee:${enemy.kind}`,
        );
        continue;
      }
      this.aimedVolley(
        enemy,
        enemy.kind === "boss" ? this.enemyStage(enemy).bossFan : data.fan,
        data.damage,
        data.shotSpeed,
      );
    }
    this.refreshTarget();
  }

  private castTaunt(enemy: Enemy): void {
    this.tauntCasts++;
    if (this.observer) this.observe("mechanic", { source: "taunt", kind: enemy.kind, amount: 1 });
    enemy.tauntRemaining = CONFIG.skills.tauntDuration;
    enemy.lastAction = "taunt";
    this.showBlast(enemy, enemy.radius + 10, 0xf1b464);
  }

  private aimedVolley(
    enemy: Enemy,
    count: number,
    damage: number,
    speed: number,
    radius = 6,
  ): void {
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    for (let index = 0; index < count; index++) {
      const direction = angle + (index - (count - 1) / 2) * 0.18;
      const shot = this.projectile(
        this.hostileShots,
        enemy.x,
        enemy.y + 12,
        Math.cos(direction) * speed,
        Math.sin(direction) * speed,
        damage *
          this.enemyStage(enemy).damage *
          enemy.damageScale *
          (enemy.kind === "boss" && this.endless && enemy.arrived ? 2 : 1),
        radius,
      );
      if (shot && this.observer) this.hostileSources.set(shot, `projectile:${enemy.kind}`);
    }
    this.enemyAttacks++;
    if (this.observer)
      this.observe("mechanic", { source: "enemy_attack", kind: enemy.kind, amount: 1 });
    if (enemy.kind !== "boss") this.regularAttacks++;
  }

  private endlessBossSkills(enemy: Enemy): void {
    const skills: readonly BossSkill[] = ["guard", "summon", "slam"];
    while (this.phase === "Playing" && enemy.active && enemy.hp > 0) {
      const threshold = CONFIG.endless.bossThresholds[enemy.skillsUsed];
      if (threshold === undefined || enemy.hp > enemy.maxHp * threshold + 1e-9) break;
      // Consume each health threshold once, including several crossed in one hit.
      enemy.skillsUsed++;
      const skill = skills[Math.floor(this.bossRandom() * skills.length)] ?? "guard";
      enemy.lastSkill = skill;
      this.bossSpecials++;
      if (this.observer)
        this.observe("mechanic", { source: `boss_skill:${skill}`, kind: enemy.kind, amount: 1 });
      if (skill === "guard") {
        enemy.damageReductionTime = CONFIG.endless.bossReductionDuration;
        this.announce("首领 · 减伤 90%，持续 3 秒", "Boss · 90% damage reduction for 3s");
      } else if (skill === "summon") {
        // Bounded scalar queue survives saturation without deleting living units.
        this.pendingSummons += this.balance.payload.endless.summonCount;
        this.drainSummons();
        this.announce(
          `首领 · 召唤 ${this.balance.payload.endless.summonCount} 只强化援军，生命与伤害 ×${this.balance.payload.endless.summonMultiplier}${this.pendingSummons > 0 ? " · 等待空位" : ""}`,
          `Boss · Summons ${this.balance.payload.endless.summonCount} enhanced escorts, HP and damage ×${this.balance.payload.endless.summonMultiplier}${this.pendingSummons > 0 ? " · Waiting for space" : ""}`,
        );
      } else {
        const hp = this.player.hp;
        const loss = Math.min(this.player.hp, this.bossSlamDamage);
        this.player.hp -= loss;
        this.damageTaken += loss;
        if (this.observer) this.observePlayerDamage("boss_slam", hp, this.player.shield);
        this.lastHitAt = this.elapsed;
        this.burst(this.player.x, this.player.y, 0xe57d98, 18);
        this.announce(
          `首领 · 重击，直接损失 ${this.bossSlamDamage} 生命`,
          `Boss · Slam directly removes ${this.bossSlamDamage} HP`,
        );
        if (this.player.hp <= 0) this.state.transition("GameOver");
      }
      this.noticeUntil = this.elapsed + 3;
    }
  }

  private moveShots(pool: Pool<Projectile>, delta: number): void {
    for (const shot of pool.items) {
      if (!shot.active) continue;
      shot.lifetime -= delta;
      if (shot.lifetime <= 0) {
        shot.active = false;
        continue;
      }
      if (pool === this.shots) {
        const targets = tauntedTargets(this.targets, this.endless, this.sanctuaryRemaining > 0);
        const target =
          targets.find((item) => item.id === shot.targetId && !shot.hitIds.has(item.id)) ??
          chooseTarget(
            targets,
            this.targetId,
            this.manualTargetId,
            shot.hitIds,
            this.endless,
            this.sanctuaryRemaining > 0,
          );
        shot.targetId = target?.id ?? null;
        if (target) {
          const angle = Math.atan2(shot.vy, shot.vx);
          const wanted = Math.atan2(target.y - shot.y, target.x - shot.x);
          const difference = Math.atan2(Math.sin(wanted - angle), Math.cos(wanted - angle));
          const turn = CONFIG.friendlyShot.turnRate * delta;
          const heading = angle + clamp(difference, -turn, turn);
          shot.vx =
            Math.cos(heading) *
            CONFIG.friendlyShot.speed *
            Math.sqrt(this.arena.width / CONFIG.width);
          shot.vy =
            Math.sin(heading) *
            CONFIG.friendlyShot.speed *
            Math.sqrt(this.arena.width / CONFIG.width);
        }
      }
      shot.previousX = shot.x;
      shot.previousY = shot.y;
      shot.x += shot.vx * delta;
      shot.y += shot.vy * delta;
      if (
        shot.y < -60 ||
        shot.y > CONFIG.height + 60 ||
        shot.x < -60 ||
        shot.x > this.arena.width + 60
      )
        shot.active = false;
    }
  }

  private hit(shot: Projectile, target: Enemy | Chest): boolean {
    return (
      !shot.hitIds.has(target.id) &&
      segmentHitsCircle(
        { x: shot.previousX, y: shot.previousY },
        shot,
        target,
        target.radius + shot.radius,
      )
    );
  }

  private consume(shot: Projectile, target: Enemy | Chest): void {
    shot.hitIds.add(target.id);
    if (isEnemy(target)) {
      if (shot.critical) this.criticalHits++;
      this.damageEnemy(target, shot.damage, "shot", shot.primary);
      if (this.phase === "Playing") this.onHitEffects(target, shot);
      this.resolveBlasts();
    } else {
      const hp = target.hp;
      target.hp = Math.max(0, target.hp - shot.damage);
      if (this.observer) this.observe("chest_damage", { source: "shot", amount: hp - target.hp });
    }
    shot.hitsLeft--;
    if (shot.hitsLeft <= 0) shot.active = false;
  }

  private damageEnemy(
    enemy: Enemy,
    rawDamage: number,
    source: DamageSource,
    primary = false,
  ): void {
    if (!enemy.active || enemy.hp <= 0 || rawDamage <= 0 || this.phase !== "Playing") return;
    const stats = this.player.stats;
    const judgment = synergyTier(this.stacks, "judgment");
    const frost = synergyTier(this.stacks, "frost");
    const dominion = synergyTier(this.stacks, "dominion");
    const controlled =
      this.sanctuaryRemaining > 0 ||
      enemy.stunTime > 0 ||
      enemy.telegraph > 0 ||
      enemy.stage === "Preparing";
    const bonus =
      (enemy.stage === "Attacking" ? stats.execution * 0.2 : 0) +
      (enemy.kind === "boss" ? stats.focus * 0.2 : 0) +
      (judgment >= 3 && enemy.stage !== "Approaching" ? 0.2 : 0) +
      (enemy.hp <= enemy.maxHp / 2 ? stats.expose : 0) +
      (enemy.slowTime > 0 ? stats.frostbite + (frost >= 9 ? 0.3 : 0) : 0) +
      (controlled ? stats.control + (dominion >= 3 ? 0.2 : 0) : 0);
    const chargedMultiplier =
      enemy.kind === "boss" && enemy.telegraph > 0
        ? judgment >= 9
          ? 2
          : judgment >= 6
            ? 1.5
            : 1
        : 1;
    const giant = synergyTier(this.stacks, "giantslayer");
    const erosion = synergyTier(this.stacks, "erosion");
    const giantRatio = enemy.maxHp / Math.max(1, stats.maxHp);
    const giantBonus =
      source === "shot"
        ? stats.giantPower * Math.log2(1 + giantRatio) +
          (giantRatio >= 5 ? stats.giantHunt + (giant >= 6 ? 0.5 : 0) : 0)
        : 0;
    const percentDamage = primary
      ? enemy.maxHp *
          Math.min(
            0.05,
            stats.giantSlayer * (giant >= 9 ? 2 : giant >= 3 ? 1.25 : 1) +
              stats.maxHealthDamage * (erosion >= 9 ? 2 : erosion >= 3 ? 1.25 : 1),
          ) +
        enemy.hp *
          Math.min(0.1, stats.currentHealthDamage * (erosion >= 9 ? 2 : erosion >= 3 ? 1.25 : 1))
      : 0;
    const damage =
      (rawDamage * (1 + giantBonus) + percentDamage) *
      (1 + bonus) *
      chargedMultiplier *
      (enemy.damageReductionTime > 0 ? 1 - CONFIG.endless.bossReduction : 1);
    const previousHp = enemy.hp;
    const actualDamage = Math.min(enemy.hp, damage);
    enemy.hp = Math.max(0, enemy.hp - damage);
    const executeAt = judgment >= 9 ? 0.15 : judgment >= 6 ? 0.08 : 0;
    if (executeAt > 0 && enemy.hp > 0 && enemy.hp <= enemy.maxHp * executeAt) {
      enemy.hp = 0;
      this.executions++;
    }
    this.damageDealt += previousHp - enemy.hp;
    if (this.observer)
      this.observe("enemy_damage", { source, kind: enemy.kind, amount: previousHp - enemy.hp });
    if (source === "shot")
      this.heal(actualDamage * combatStats(this.player, this.stacks).lifesteal, "lifesteal");
    if (enemy.hp <= 0) {
      this.defeatEnemy(enemy, source);
      return;
    }
    if (enemy.kind === "boss" && this.endless && this.sanctuaryRemaining <= 0)
      this.endlessBossSkills(enemy);
    if (enemy.kind === "boss" && enemy.telegraph > 0) {
      enemy.interruptDamage += actualDamage * (dominion >= 9 ? 1.5 : 1);
      if (enemy.interruptDamage >= enemy.interruptRequired) {
        enemy.telegraph = 0;
        enemy.patternCooldown = enemy.hp < enemy.maxHp / 2 ? 3.2 : 4;
        enemy.shotCooldown = 1;
        this.bossInterrupts++;
        if (this.observer)
          this.observe("mechanic", { source: "boss_interrupt", kind: enemy.kind, amount: 1 });
        this.announce(
          "蓄力已打断 · 防线暂时安全",
          "Charge interrupted · Defense line secured for now",
        );
        this.noticeUntil = this.elapsed + 1.5;
        this.burst(enemy.x, enemy.y, 0x8cc6f2, 18);
      }
    }
  }

  private heal(amount: number, source = "unknown"): void {
    if (amount <= 0 || this.player.hp <= 0) return;
    const scaled = amount * (1 + this.player.stats.recovery) * healingMultiplier(this.player);
    const restored = Math.min(scaled, this.player.stats.maxHp - this.player.hp);
    this.player.hp += restored;
    this.healingDone += restored;
    if (this.observer && restored > 0) this.observe("heal", { source, amount: restored });
    const overflow = overhealStats(this.player, this.stacks);
    const shield = Math.max(
      0,
      Math.min((scaled - restored) * overflow.conversion, overflow.capacity - this.player.shield),
    );
    this.shieldRestored += this.restoreShield(
      shield,
      overflow.capacity,
      true,
      `overheal:${source}`,
    );
  }

  private restoreShield(
    amount: number,
    capacity: number,
    reduced: boolean,
    source: string,
  ): number {
    const restored = grantShield(this.player, amount, capacity, reduced);
    if (this.observer && restored > 0) this.observe("shield", { source, amount: restored });
    return restored;
  }

  private slowEnemy(enemy: Enemy, strength: number, duration: number): void {
    if (!enemy.active || strength <= 0) return;
    const slow = Math.min(0.7, strength) * (enemy.kind === "boss" ? 0.5 : 1);
    enemy.slow = Math.max(enemy.slow, slow);
    enemy.slowTime = Math.max(enemy.slowTime, duration);
  }

  private stunEnemy(enemy: Enemy, duration: number): void {
    if (!enemy.active || duration <= 0) return;
    const dominion = synergyTier(this.stacks, "dominion");
    enemy.stunTime = Math.max(
      enemy.stunTime,
      duration *
        (dominion >= 9 ? 1.6 : dominion >= 3 ? 1.3 : 1) *
        (enemy.kind === "boss" ? 0.25 : 1),
    );
    this.controlProcs++;
    this.burst(enemy.x, enemy.y, 0xc7b7e8, 4);
  }

  private onHitEffects(target: Enemy, shot: Projectile): void {
    const stats = this.player.stats;
    const frost = synergyTier(this.stacks, "frost");
    const storm = synergyTier(this.stacks, "storm");
    if (target.active) {
      target.receivedHits++;
      if (shot.primary) target.primaryHits++;
      this.slowEnemy(target, stats.slow + (frost >= 3 ? 0.1 : 0), frost >= 3 ? 3 : 2);
      if (shot.primary && target.primaryHits % 4 === 0) this.stunEnemy(target, stats.stun);
      if (frost >= 6 && target.receivedHits % (frost >= 9 ? 3 : 4) === 0)
        this.stunEnemy(target, frost >= 9 ? 1 : 0.6);
    }
    const links = stats.chain + (storm >= 6 ? 3 : storm >= 3 ? 1 : 0);
    const visited = new Set([target.id]);
    let origin: Vec2 = target;
    for (let index = 0; index < links && this.phase === "Playing"; index++) {
      const next = this.enemies.items
        .filter(
          (enemy) =>
            enemy.active &&
            !visited.has(enemy.id) &&
            Math.hypot(enemy.x - origin.x, enemy.y - origin.y) <= 220 * this.arena.rangeScale,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - origin.x, a.y - origin.y) -
              Math.hypot(b.x - origin.x, b.y - origin.y) || a.id - b.id,
        )[0];
      if (!next) break;
      visited.add(next.id);
      this.damageEnemy(next, shot.damage * 0.3 * (storm >= 9 ? 2 : 1), "arc");
      this.showBlast(next, 24, 0xa7b8fa);
      origin = next;
    }
    if (stats.splash > 0 && this.phase === "Playing")
      this.areaDamage(
        target,
        shot.damage * stats.splash * 0.15,
        85 + (storm >= 3 ? 20 : 0),
        0xa7b8fa,
        target.id,
      );
  }

  private areaDamage(
    center: Vec2,
    damage: number,
    radius: number,
    color: number,
    excludeId?: number,
  ): void {
    radius *= this.arena.rangeScale;
    this.showBlast(center, radius, color);
    for (const enemy of this.enemies.items) {
      if (this.phase !== "Playing") break;
      if (
        enemy.active &&
        enemy.id !== excludeId &&
        Math.hypot(enemy.x - center.x, enemy.y - center.y) <= radius + enemy.radius
      )
        this.damageEnemy(enemy, damage, "arc");
    }
  }

  private addScore(points: number): void {
    this.score += points;
    const earned = Math.floor(this.score / CONFIG.scoreTrainingInterval);
    const names: string[] = [];
    while (this.scoreMilestones < earned) {
      const policy = this.rewardPolicy("stage");
      const eligible = eligibleTrainings(this.player, this.stacks, this.stageIndex, policy);
      const item = weightedChoice(
        eligible,
        (entry) => policy.trainingWeights[entry.id] ?? 1,
        this.trainingRandom,
      );
      if (!item || !applyTraining(item.id, this.player, this.trainingStacks)) {
        // No eligible grant can change this pool. Consume all unavailable milestones
        // now, so a later stage cannot retroactively award excluded training.
        this.scoreMilestones = earned;
        break;
      }
      this.scoreMilestones++;
      this.acquired(item.id);
      this.scoreTrainings++;
      this.lastScoreTraining = item.id;
      if (this.observer)
        this.observe("auto_training", {
          source: "score",
          choice: item.id,
          training: true,
          automatic: true,
        });
      names.push(item.id);
    }
    if (names.length > 0) {
      this.announce(
        `分数锻体 · 已自动获得 ${names.map((id) => rewardName(id, "zh-CN")).join("、")}`,
        `Score training · Automatically gained ${names.map((id) => rewardName(id, "en")).join(", ")}`,
      );
      this.noticeUntil = this.elapsed + 4;
    }
  }

  private defeatEnemy(enemy: Enemy, source: DamageSource): void {
    enemy.active = false;
    if (this.observer && enemy.kind === "boss")
      this.observe("boss_death", { source, kind: enemy.kind });
    this.kills++;
    this.addScore(this.enemyDefinition(enemy).score * 3 ** (enemy.stars - 1));
    if (source === "blast") this.chainKills++;
    this.heal(this.player.stats.harvest * 2, "harvest");
    if (
      (enemy.stunTime > 0 || this.sanctuaryRemaining > 0) &&
      synergyTier(this.stacks, "dominion") >= 9
    )
      this.shieldRestored += this.restoreShield(8, this.player.stats.maxHp, false, "dominion_kill");
    this.burst(
      enemy.x,
      enemy.y,
      enemy.kind === "boss" ? 0xdec28a : 0xa795ed,
      enemy.kind === "boss" ? 60 : 14,
    );
    if (enemy.kind === "boss") {
      this.bossDefeated = true;
      this.pendingSummons = 0;
      this.announce(
        "首领已击败 · 清除剩余敌人后领取过关奖励",
        "Boss defeated · Clear remaining enemies to claim the stage reward",
      );
      this.noticeUntil = this.elapsed + 5;
      return;
    }
    if (
      (this.player.stats.fuse > 0 || synergyTier(this.stacks, "blast") >= 3) &&
      (source !== "blast" || synergyTier(this.stacks, "blast") >= 6)
    ) {
      this.queueBlast(
        enemy,
        Math.max(1, this.player.stats.fuse) * 16,
        0.03 * Math.max(1, this.player.stats.fuse),
      );
    }
  }

  protected completeStageIfReady(): void {
    if (
      this.phase !== "Playing" ||
      !this.bossDefeated ||
      this.enemies.items.some((enemy) => enemy.active)
    )
      return;
    this.clearedStages++;
    // Observe before clear-score training, cleansing, rewards and stage recovery.
    if (this.observer) this.observe("stage_clear");
    this.addScore(Math.ceil(this.player.hp) * 10);
    this.clearCombat();
    cleansePlayer(this.player);
    this.sanctuaryRemaining = 0;
    if (this.endless && this.stageSupplies < this.balance.payload.endless.supplies) {
      this.pendingStageReward = true;
      this.offerEndlessSupply();
    } else this.offerStageReward();
  }

  private queueBlast(center: Enemy, damage: number, maxHpFraction: number): void {
    const tier = synergyTier(this.stacks, "blast");
    this.blastQueue.push({
      x: center.x,
      y: center.y,
      damage: (damage + center.maxHp * maxHpFraction) * (tier >= 9 ? 2 : tier >= 3 ? 1.4 : 1),
      radius: (tier >= 9 ? 190 : tier >= 3 ? 160 : 130) * this.arena.rangeScale,
    });
  }

  private showBlast(center: Vec2, radius: number, color: number): void {
    const blast = this.blasts.acquire();
    if (blast)
      Object.assign(blast, { x: center.x, y: center.y, radius, color, life: 0.45, maxLife: 0.45 });
    this.burst(center.x, center.y, color, 12);
  }

  private resolveBlasts(): void {
    // Each victim deactivates before it can enqueue another explosion. The queue
    // therefore drains in at most the enemy-pool size, without recursive calls.
    while (this.blastQueue.length > 0 && this.phase === "Playing") {
      const blast = this.blastQueue.shift();
      if (!blast) break;
      this.explosionCount++;
      this.showBlast(blast, blast.radius, 0xf5a17d);
      for (const enemy of this.enemies.items) {
        if (
          enemy.active &&
          Math.hypot(enemy.x - blast.x, enemy.y - blast.y) <= blast.radius + enemy.radius
        )
          this.damageEnemy(enemy, blast.damage, "blast");
        if (this.phase !== "Playing") break;
      }
    }
    if (this.phase !== "Playing") this.blastQueue.length = 0;
  }

  private buildEffects(delta: number): void {
    const stats = this.player.stats;
    const blast = synergyTier(this.stacks, "blast");
    const bastion = synergyTier(this.stacks, "bastion");
    const blood = synergyTier(this.stacks, "blood");
    const storm = synergyTier(this.stacks, "storm");
    const frost = synergyTier(this.stacks, "frost");
    this.heal(stats.regeneration * delta * (blood >= 9 ? 2 : 1), "regeneration");
    if (stats.bloodpact > 0 || blast >= 6) {
      const interval = blast >= 9 ? 3 : blast >= 6 ? 4 : 5;
      this.bloodCooldown = Math.min(this.bloodCooldown, interval) - delta;
      const target = this.target;
      if (this.bloodCooldown <= 1e-9 && target && isEnemy(target)) {
        this.bloodCooldown = interval;
        const hp = this.player.hp;
        this.player.hp -= Math.min(3, Math.max(0, this.player.hp - 1));
        if (this.observer) this.observePlayerDamage("bloodpact", hp, this.player.shield);
        this.queueBlast(
          target,
          Math.max(1, stats.bloodpact) * 20 + stats.maxHp * (blast >= 9 ? 0.45 : 0.15),
          0.02 * Math.max(1, stats.bloodpact),
        );
        this.resolveBlasts();
      }
    }
    if (this.phase !== "Playing") return;
    if (bastion >= 3) {
      this.shieldCooldown -= delta;
      if (this.shieldCooldown <= 1e-9) {
        this.shieldCooldown = 3;
        this.shieldRestored += this.restoreShield(
          bastion >= 9 ? 20 : 10,
          stats.maxHp * (bastion >= 9 ? 1 : 0.6),
          false,
          "bastion",
        );
      }
    }
    const erosion = synergyTier(this.stacks, "erosion");
    if (stats.erosionPulse > 0) {
      const interval = erosion >= 9 ? 2 : erosion >= 6 ? 3 : 4;
      this.erosionCooldown = Math.min(this.erosionCooldown, interval) - delta;
      if (this.erosionCooldown <= 1e-9) {
        this.erosionCooldown = interval;
        for (const enemy of this.enemies.items)
          this.damageEnemy(
            enemy,
            enemy.maxHp *
              Math.min(0.05, stats.erosionPulse * (erosion >= 9 ? 2 : erosion >= 3 ? 1.25 : 1)),
            "arc",
          );
        this.resolveBlasts();
      }
    }
    if (this.phase !== "Playing") return;
    const target = this.target;
    if (stats.storm > 0 || storm >= 6) {
      const interval = storm >= 9 ? 3 : storm >= 6 ? 4 : 6;
      this.stormCooldown = Math.min(this.stormCooldown, interval) - delta;
      if (this.stormCooldown <= 1e-9 && target && isEnemy(target)) {
        this.stormCooldown = interval;
        this.areaDamage(
          target,
          combatStats(this.player, this.stacks).damage *
            (1 + Math.max(1, stats.storm) * 0.5) *
            (storm >= 9 ? 2 : 1),
          150,
          0xa7b8fa,
        );
        this.resolveBlasts();
      }
    }
    if (this.phase !== "Playing") return;
    if (stats.frostPulse > 0) {
      this.frostCooldown -= delta;
      if (this.frostCooldown <= 1e-9) {
        this.frostCooldown = 6;
        this.showBlast({ x: this.arena.player.x, y: 350 }, 500, 0x9ce2ef);
        for (const enemy of this.enemies.items)
          this.slowEnemy(enemy, 0.2 + stats.frostPulse * 0.05, frost >= 3 ? 3 : 2);
      }
    }
  }

  private collisions(): void {
    for (const shot of this.shots.items) {
      if (!shot.active) continue;
      for (const chest of this.chests.items) {
        if (!chest.active || !this.hit(shot, chest)) continue;
        this.consume(shot, chest);
        this.burst(shot.x, shot.y, 0xdec28a, 3);
        if (chest.hp <= 0) {
          chest.active = false;
          this.openedChests++;
          this.reward = {
            token: ++this.rewardSerial,
            choices: drawCards(
              this.player,
              this.stacks,
              this.random,
              "chest",
              this.stageIndex,
              this.rewardPolicy("chest"),
            ),
            source: "chest",
          };
          this.burst(chest.x, chest.y, 0xdec28a, 20);
          this.state.transition("RewardSelection");
          if (this.observer)
            this.observe("reward_offer", {
              source: this.reward.source,
              choices: this.reward.choices,
            });
          return;
        }
        if (!shot.active) break;
      }
      if (!shot.active) continue;
      for (const enemy of this.enemies.items) {
        if (!enemy.active || !this.hit(shot, enemy)) continue;
        this.consume(shot, enemy);
        this.burst(shot.x, shot.y, 0xb5a2ee, 2);
        if (this.phase !== "Playing") return;
        if (!shot.active) break;
      }
    }
    this.completeStageIfReady();
    if (this.phase !== "Playing" || this.sanctuaryRemaining > 0) return;
    for (const shot of this.hostileShots.items) {
      if (
        !shot.active ||
        !segmentHitsCircle(
          { x: shot.previousX, y: shot.previousY },
          shot,
          this.player,
          shot.radius + 5,
        )
      )
        continue;
      shot.active = false;
      this.hurt(shot.damage, this.hostileSources.get(shot) ?? "unknown");
      if (this.phase !== "Playing") return;
    }
  }

  private hurt(damage: number, source = "unknown"): void {
    if (this.player.invulnerable > 0 || this.player.hp <= 0 || damage <= 0) return;
    const before = this.player.hp + this.player.shield;
    const hp = this.player.hp;
    const shield = this.player.shield;
    damagePlayer(this.player, damage);
    this.damageTaken += before - this.player.hp - this.player.shield;
    if (this.observer) this.observePlayerDamage(source, hp, shield);
    this.lastHitAt = this.elapsed;
    this.burst(this.player.x, this.player.y, 0xe57d98, 12);
    if (this.player.hp <= 0) {
      this.state.transition("GameOver");
      return;
    }
    const bastion = synergyTier(this.stacks, "bastion");
    const complete = bastion >= 6;
    const retaliation =
      this.player.stats.thorns * 18 * (complete ? 2 : 1) +
      (complete ? this.player.stats.maxHp * (bastion >= 9 ? 0.5 : 0.25) : 0);
    if (retaliation > 0) {
      this.showBlast(this.player, Math.hypot(this.arena.width, this.arena.height), 0x95d9be);
      for (const enemy of this.enemies.items) {
        this.damageEnemy(enemy, retaliation, "counter");
        if (this.phase !== "Playing") break;
      }
    }
    this.resolveBlasts();
  }

  private burst(x: number, y: number, color: number, count: number): void {
    // Cosmetic particles never consume the run RNG, preserving deterministic rewards.
    for (let index = 0; index < count; index++) {
      const particle = this.particles.acquire();
      if (!particle) return;
      const angle = (index / count) * Math.PI * 2;
      const speed = 24 + (index % 5) * 22;
      Object.assign(particle, {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + (index % 3) * 0.12,
        maxLife: 0.69,
        color,
      });
    }
  }

  snapshot() {
    return {
      phase: this.phase,
      arena: structuredClone(this.arena),
      attackRegions: structuredClone(this.attackRegions),
      elapsed: this.elapsed,
      stageIndex: this.stageIndex,
      stageElapsed: this.stageElapsed,
      sanctuaryRemaining: this.sanctuaryRemaining,
      bossSlamDamage: this.bossSlamDamage,
      stageName: this.stage.name,
      stageSpawned: this.stageSpawned,
      stageQuota: this.stage.enemyCount,
      enemyCapacity: this.stage.maxEnemies,
      populationScale: this.stage.populationScale,
      pendingSummons: this.pendingSummons,
      growth: this.stage.growth,
      stageKindSpawns: { ...this.stageKindSpawns },
      stageSupplies: this.stageSupplies,
      endlessRewardTimes: [...this.endlessRewardTimes],
      clearedStages: this.clearedStages,
      endless: this.endless,
      bossDefeated: this.bossDefeated,
      seed: this.seed,
      player: structuredClone(this.player),
      combat: combatStats(this.player, this.stacks),
      kills: this.kills,
      score: this.score,
      scoreTrainings: this.scoreTrainings,
      scoreMilestones: this.scoreMilestones,
      lastScoreTraining: this.lastScoreTraining,
      nextScoreTraining: (this.scoreMilestones + 1) * CONFIG.scoreTrainingInterval,
      openedChests: this.openedChests,
      stacks: Object.fromEntries(this.stacks),
      trainingStacks: Object.fromEntries(this.trainingStacks),
      synergies: synergyProgress(this.stacks),
      reward: this.reward ? structuredClone(this.reward) : null,
      targetId: this.targetId,
      manualTargetId: this.manualTargetId,
      metrics: {
        meleeSpawns: this.meleeSpawns,
        rangedSpawns: this.rangedSpawns,
        damageDealt: this.damageDealt,
        damageTaken: this.damageTaken,
        healingDone: this.healingDone,
        criticalHits: this.criticalHits,
        controlProcs: this.controlProcs,
        arrivals: this.arrivals,
        enemyAttacks: this.enemyAttacks,
        regularAttacks: this.regularAttacks,
        bossSpecials: this.bossSpecials,
        bossInterrupts: this.bossInterrupts,
        peakEnemies: this.peakEnemies,
        explosionCount: this.explosionCount,
        chainKills: this.chainKills,
        echoVolleys: this.echoVolleys,
        shieldRestored: this.shieldRestored,
        executions: this.executions,
        fusions: this.fusions,
        poisonCasts: this.poisonCasts,
        tauntCasts: this.tauntCasts,
      },
      enemies: this.enemies.items
        .filter((item) => item.active)
        .map(
          ({
            id,
            kind,
            x,
            y,
            hp,
            maxHp,
            radius,
            telegraph,
            stage,
            preparation,
            arrived,
            defenseX,
            defenseY,
            interruptDamage,
            interruptRequired,
            spawnX,
            spawnY,
            enhanced,
            skillsUsed,
            lastSkill,
            damageReductionTime,
            stars,
            damageScale,
            fusionTime,
            tauntRemaining,
            lastAction,
          }) => ({
            id,
            kind,
            x,
            y,
            hp,
            maxHp,
            radius,
            telegraph,
            stage,
            preparation,
            arrived,
            defenseX,
            defenseY,
            interruptDamage,
            interruptRequired,
            spawnX,
            spawnY,
            enhanced,
            skillsUsed,
            lastSkill,
            damageReductionTime,
            stars,
            damageScale,
            fusionTime,
            tauntRemaining,
            lastAction,
          }),
        ),
      chests: this.chests.items
        .filter((item) => item.active)
        .map(({ id, x, y, hp }) => ({ id, x, y, hp })),
      shots: this.shots.items
        .filter((item) => item.active)
        .map(({ x, y, vx, vy, targetId }) => ({ x, y, vx, vy, targetId })),
      hostileShots: this.hostileShots.items
        .filter((item) => item.active)
        .map(({ x, y, vx, vy }) => ({ x, y, vx, vy })),
    };
  }
}
