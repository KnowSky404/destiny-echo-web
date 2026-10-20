import { applyCard, drawCards } from "../data/cards";
import { ENEMIES } from "../data/enemies";
import { STAGES, stageAt } from "../data/stages";
import { SYNERGIES } from "../data/synergies";
import { CONFIG } from "./config";
import { Pool } from "./pool";
import { type Random, seededRandom } from "./random";
import { RunState } from "./state";
import { synergyProgress, synergyTier } from "./synergies";
import { damagePlayer } from "./systems/damage";
import { advanceAttackStage, advanceEnemy } from "./systems/enemy";
import { clamp, segmentHitsCircle } from "./systems/movement";
import { chooseTarget, isEnemy, isTargetable, rankedTargets } from "./systems/targeting";
import type {
  Blast,
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

export function createPlayer(): Player {
  return {
    ...CONFIG.player,
    hp: 100,
    shield: 0,
    invulnerable: 0,
    cooldown: 0,
    stats: {
      damage: 12,
      interval: 0.34,
      projectiles: 1,
      piercing: 0,
      maxHp: 100,
      execution: 0,
      fuse: 0,
      bloodpact: 0,
      thorns: 0,
      focus: 0,
      harvest: 0,
    },
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
  };
}

export class World {
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
    interruptDamage: 0,
    interruptRequired: 0,
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
  player = createPlayer();
  reward: Reward | null = null;
  elapsed = 0;
  stageIndex = 0;
  stageElapsed = 0;
  clearedStages = 0;
  kills = 0;
  score = 0;
  openedChests = 0;
  bossSpawned = false;
  endingReason: "health" | "timeout" = "health";
  lastHitAt = -10;
  notice = "";
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
  private random: Random = seededRandom(0);
  private nextId = 1;
  private rewardSerial = 0;
  private accumulator = 0;
  private spawnCooldown = 0.8;
  private nextChestAt: number = CONFIG.chestFirstAt;
  private bloodCooldown = 5;
  private shieldCooldown = 3;
  private supportCooldown = 0;
  private volleys = 0;
  private readonly blastQueue: Array<{ x: number; y: number; radius: number; damage: number }> = [];

  get phase() {
    return this.state.phase;
  }
  get wave() {
    return Math.min(5, Math.floor(this.stageElapsed / 11) + 1);
  }
  get stage() {
    return stageAt(this.stageIndex);
  }
  get endless() {
    return this.stageIndex >= STAGES.length;
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
    const targets = rankedTargets(this.targets);
    const index = targets.findIndex((target) => target.id === this.manualTargetId);
    this.manualTargetId = targets[(index + 1) % targets.length]?.id ?? null;
    this.refreshTarget();
  }

  clearTarget(): void {
    if (this.phase !== "Playing") return;
    this.manualTargetId = null;
    this.refreshTarget();
  }

  private refreshTarget(): void {
    const targets = this.targets;
    if (!targets.some((target) => target.id === this.manualTargetId)) this.manualTargetId = null;
    this.targetId = chooseTarget(targets, this.targetId, this.manualTargetId)?.id ?? null;
  }

  start(seed = Date.now()): boolean {
    if (["Playing", "RewardSelection", "StageClear"].includes(this.phase)) return false;
    if (!this.state.transition("Playing")) return false;
    this.reset(seed);
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

  private reset(seed: number): void {
    this.seed = seed;
    this.random = seededRandom(seed);
    this.player = createPlayer();
    this.stacks.clear();
    this.reward = null;
    this.elapsed = 0;
    this.stageIndex = 0;
    this.stageElapsed = 0;
    this.clearedStages = 0;
    this.kills = 0;
    this.score = 0;
    this.openedChests = 0;
    this.bossSpawned = false;
    this.endingReason = "health";
    this.lastHitAt = -10;
    this.notice = "";
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
    this.resetStage();
  }

  private resetStage(): void {
    this.stageElapsed = 0;
    this.bossSpawned = false;
    this.reward = null;
    this.targetId = null;
    this.manualTargetId = null;
    this.player.cooldown = 0;
    this.player.invulnerable = 0;
    this.lastHitAt = -10;
    this.accumulator = 0;
    this.spawnCooldown = 0.8;
    this.nextChestAt = CONFIG.chestFirstAt;
    this.bloodCooldown = 5;
    this.shieldCooldown = 3;
    this.supportCooldown = this.stage.support?.interval ?? 0;
    this.volleys = 0;
    this.blastQueue.length = 0;
    this.clearCombat();
    this.particles.clear();
    this.blasts.clear();
  }

  private clearCombat(): void {
    for (const pool of [this.enemies, this.shots, this.hostileShots, this.chests]) pool.clear();
    this.targetId = null;
    this.manualTargetId = null;
    this.blastQueue.length = 0;
  }

  private advanceStage(): void {
    this.stageIndex++;
    this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + 35);
    this.resetStage();
    this.notice = `${this.stage.name} · 构筑已保留，恢复 35 生命`;
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
    const stageReward = this.reward.source === "stage";
    if (!applyCard(id, this.player, this.stacks)) return false;
    // Remove the capability before resuming: stale clicks cannot claim this reward again.
    this.reward = null;
    if (stageReward) this.advanceStage();
    this.state.transition("Playing");
    this.accumulator = 0;
    const activated = SYNERGIES.find(
      (synergy, index) => synergyTier(this.stacks, synergy.id) > (before[index]?.tier ?? 0),
    );
    this.notice = activated
      ? `${activated.name} · ${synergyTier(this.stacks, activated.id) === 3 ? "流派质变" : "联动激活"}${stageReward ? " · 下一关已开启" : ""}`
      : stageReward
        ? this.notice
        : "残响已融合 · 继续改写命运";
    this.noticeUntil = this.elapsed + 3;
    return true;
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
    this.elapsed += delta;
    this.stageElapsed += delta;
    this.player.invulnerable = Math.max(0, this.player.invulnerable - delta);
    // Position is a simulation invariant, independent of all browser input.
    Object.assign(this.player, CONFIG.player);
    this.spawn(delta);
    for (const enemy of this.enemies.items) {
      if (enemy.active && advanceEnemy(enemy, delta, this.wave)) this.arrivals++;
    }
    this.refreshTarget();
    this.attack(delta);
    this.moveShots(this.shots, delta);
    this.moveShots(this.hostileShots, delta);
    for (const chest of this.chests.items) {
      if (!chest.active) continue;
      chest.age += delta;
      chest.y = Math.min(340, chest.y + 7 * delta);
    }
    this.collisions();
    this.refreshTarget();
    if (this.phase !== "Playing") return;
    this.buildEffects(delta);
    this.refreshTarget();
    if (this.phase !== "Playing") return;
    // Resolve incoming friendly hits before releasing an attack on this step.
    this.enemyAttack(delta);
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
    if (this.stageElapsed >= this.stage.deadline) {
      this.endingReason = "timeout";
      this.state.transition("GameOver");
    }
  }

  private attack(delta: number): void {
    this.player.cooldown = Math.max(0, this.player.cooldown - delta);
    const target = this.target;
    if (this.player.cooldown > 1e-9 || !target) return;
    const barrage = synergyTier(this.stacks, "barrage");
    this.player.cooldown += this.player.stats.interval * (barrage >= 2 ? 0.85 : 1);
    this.volleys++;
    this.fireVolley(target, barrage >= 2 ? 1 : CONFIG.friendlyShot.secondaryDamage);
    if (barrage === 3 && this.volleys % 4 === 0) {
      this.fireVolley(target, 1);
      this.echoVolleys++;
    }
  }

  private fireVolley(target: Target, secondaryDamage: number): void {
    const count = this.player.stats.projectiles;
    const others = rankedTargets(this.targets).filter((item) => item.id !== target.id);
    for (let index = 0; index < count; index++) {
      const offset = index - (count - 1) / 2;
      const aim = index === 0 ? target : (others[(index - 1) % others.length] ?? target);
      const x = this.player.x + offset * 10;
      const y = this.player.y - 22;
      const angle = Math.atan2(aim.y - y, aim.x - x);
      this.projectile(
        this.shots,
        x,
        y,
        Math.cos(angle) * CONFIG.friendlyShot.speed,
        Math.sin(angle) * CONFIG.friendlyShot.speed,
        this.player.stats.damage * (index === 0 ? 1 : secondaryDamage),
        4,
        this.player.stats.piercing + 1,
        aim.id,
      );
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
  ): void {
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
    });
    shot.hitIds.clear();
  }

  private spawn(delta: number): void {
    const stage = this.stage;
    if (!this.bossSpawned && this.stageElapsed >= stage.bossAt) {
      this.bossSpawned = true;
      this.enemies.clear();
      this.hostileShots.clear();
      this.spawnEnemy("boss", CONFIG.width / 2);
      this.supportCooldown = stage.support?.interval ?? 0;
      this.notice = `${stage.bossName} · 金色蓄力时集中火力可打断`;
      this.noticeUntil = this.elapsed + 3;
    }
    if (!this.bossSpawned) {
      this.spawnCooldown -= delta;
      if (this.spawnCooldown <= 0) {
        this.spawnCooldown += Math.max(0.55, stage.spawnInterval - this.wave * 0.1);
        this.spawnEnemy(
          this.random() < stage.sentinelChance ? "sentinel" : "wisp",
          42 + this.random() * 366,
        );
      }
      if (
        this.stageElapsed >= this.nextChestAt &&
        this.nextChestAt <= Math.min(CONFIG.chestLastAt, stage.bossAt - 5) &&
        !this.chests.items.some((chest) => chest.active)
      ) {
        const chest = this.chests.acquire();
        if (chest) {
          Object.assign(chest, {
            id: this.nextId++,
            x: this.nextChestAt === CONFIG.chestFirstAt ? 110 : 70 + this.random() * 310,
            y: 240,
            hp: 36,
            maxHp: 36,
            radius: 26,
            age: 0,
          });
          this.nextChestAt = this.stageElapsed + CONFIG.chestInterval;
          this.notice = "宝箱显现 · 点击可优先击破，获取残响";
          this.noticeUntil = this.elapsed + 3;
        }
      }
    } else if (stage.support && this.boss) {
      this.supportCooldown -= delta;
      if (this.supportCooldown <= 0) {
        this.supportCooldown += stage.support.interval;
        this.spawnEnemy(stage.support.kind, 42 + this.random() * 366);
      }
    }
  }

  private spawnEnemy(kind: EnemyKind, x: number): void {
    const occupied = new Set(
      this.enemies.items.filter((item) => item.active).map((item) => item.slot),
    );
    const slots = Array.from(
      { length: CONFIG.defense.lanes * CONFIG.defense.rows },
      (_, index) => index,
    );
    const slotX = (slot: number) =>
      CONFIG.player.x +
      ((slot % CONFIG.defense.lanes) - (CONFIG.defense.lanes - 1) / 2) * CONFIG.defense.laneGap;
    const slot =
      kind === "boss"
        ? Math.floor(CONFIG.defense.lanes / 2)
        : slots
            .filter((index) => !occupied.has(index))
            .sort(
              (a, b) =>
                Math.floor(a / CONFIG.defense.lanes) - Math.floor(b / CONFIG.defense.lanes) ||
                Math.abs(slotX(a) - x) - Math.abs(slotX(b) - x) ||
                a - b,
            )[0];
    if (slot === undefined) return;
    const enemy = this.enemies.acquire();
    if (!enemy) return;
    const data = ENEMIES[kind];
    const hp =
      kind === "boss"
        ? this.stage.bossHp
        : Math.round(data.hp * this.stage.health * (1 + (this.wave - 1) * 0.12));
    Object.assign(enemy, {
      id: this.nextId++,
      kind,
      x: slotX(slot),
      y: kind === "boss" ? -55 : -30,
      hp,
      maxHp: hp,
      radius: data.radius,
      speed: data.speed * (kind === "boss" ? 1 : this.stage.speed),
      age: 0,
      telegraph: 0,
      shotCooldown: 0,
      patternCooldown: 2.8,
      stage: "Approaching",
      attackPolicy: { ...(kind === "boss" ? data.attackPolicy : this.stage.attackPolicy) },
      preparation: 0,
      arrived: false,
      slot,
      defenseX: slotX(slot),
      defenseY: CONFIG.defense.y - Math.floor(slot / CONFIG.defense.lanes) * CONFIG.defense.rowGap,
      interruptDamage: 0,
      interruptRequired: 0,
    });
    this.peakEnemies = Math.max(
      this.peakEnemies,
      this.enemies.items.filter((item) => item.active).length,
    );
  }

  private enemyAttack(delta: number): void {
    for (const enemy of this.enemies.items) {
      if (!enemy.active || !advanceAttackStage(enemy, delta)) continue;
      const enraged = enemy.kind === "boss" && enemy.hp < enemy.maxHp / 2;
      if (enemy.kind === "boss") {
        if (enemy.telegraph > 0) {
          enemy.telegraph = Math.max(0, enemy.telegraph - delta);
          if (enemy.telegraph <= 1e-9) {
            // Consume the charge even when subtraction leaves a tiny positive residue.
            enemy.telegraph = 0;
            this.aimedVolley(enemy, 1, this.stage.specialDamage + (enraged ? 4 : 0), 240, 10);
            this.bossSpecials++;
            enemy.patternCooldown = enraged ? 3.6 : 4.5;
            enemy.shotCooldown = 1.2;
          }
          continue;
        }
        enemy.patternCooldown -= delta;
        if (enemy.patternCooldown <= 0) {
          enemy.telegraph = this.stage.chargeTime - (enraged ? 0.3 : 0);
          enemy.interruptDamage = 0;
          enemy.interruptRequired = Math.round(this.stage.interrupt * (enraged ? 4 / 3 : 1));
          this.notice = `首领蓄力 · 造成 ${enemy.interruptRequired} 伤害可打断`;
          this.noticeUntil = this.elapsed + enemy.telegraph;
          continue;
        }
      }
      enemy.shotCooldown -= delta;
      if (enemy.shotCooldown > 1e-9) continue;
      const data = ENEMIES[enemy.kind];
      enemy.shotCooldown +=
        data.interval * (enraged ? 0.8 : 1) * (enemy.kind === "boss" ? this.stage.bossInterval : 1);
      this.aimedVolley(
        enemy,
        enemy.kind === "boss" ? this.stage.bossFan : data.fan,
        data.damage,
        data.shotSpeed,
      );
    }
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
      this.projectile(
        this.hostileShots,
        enemy.x,
        enemy.y + 12,
        Math.cos(direction) * speed,
        Math.sin(direction) * speed,
        damage * this.stage.damage,
        radius,
      );
    }
    this.enemyAttacks++;
    if (enemy.kind !== "boss") this.regularAttacks++;
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
        const targets = this.targets;
        const target =
          targets.find((item) => item.id === shot.targetId && !shot.hitIds.has(item.id)) ??
          chooseTarget(targets, this.targetId, this.manualTargetId, shot.hitIds);
        shot.targetId = target?.id ?? null;
        if (target) {
          const angle = Math.atan2(shot.vy, shot.vx);
          const wanted = Math.atan2(target.y - shot.y, target.x - shot.x);
          const difference = Math.atan2(Math.sin(wanted - angle), Math.cos(wanted - angle));
          const turn = CONFIG.friendlyShot.turnRate * delta;
          const heading = angle + clamp(difference, -turn, turn);
          shot.vx = Math.cos(heading) * CONFIG.friendlyShot.speed;
          shot.vy = Math.sin(heading) * CONFIG.friendlyShot.speed;
        }
      }
      shot.previousX = shot.x;
      shot.previousY = shot.y;
      shot.x += shot.vx * delta;
      shot.y += shot.vy * delta;
      if (shot.y < -60 || shot.y > CONFIG.height + 60 || shot.x < -60 || shot.x > CONFIG.width + 60)
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
      this.damageEnemy(target, shot.damage, "shot");
      this.resolveBlasts();
    } else {
      target.hp = Math.max(0, target.hp - shot.damage);
    }
    shot.hitsLeft--;
    if (shot.hitsLeft <= 0) shot.active = false;
  }

  private damageEnemy(enemy: Enemy, rawDamage: number, source: "shot" | "blast" | "counter"): void {
    if (!enemy.active || enemy.hp <= 0 || this.phase !== "Playing") return;
    const judgment = synergyTier(this.stacks, "judgment");
    const bonus =
      (enemy.stage === "Attacking" ? this.player.stats.execution * 0.2 : 0) +
      (enemy.kind === "boss" ? this.player.stats.focus * 0.2 : 0) +
      (judgment >= 2 && enemy.stage !== "Approaching" ? 0.35 : 0);
    const damage =
      rawDamage *
      (1 + bonus) *
      (judgment === 3 && enemy.kind === "boss" && enemy.telegraph > 0 ? 2 : 1);
    const actualDamage = Math.min(enemy.hp, damage);
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (judgment === 3 && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.15) {
      enemy.hp = 0;
      this.executions++;
    }
    if (enemy.hp <= 0) {
      this.defeatEnemy(enemy, source);
      return;
    }
    if (enemy.kind === "boss" && enemy.telegraph > 0) {
      enemy.interruptDamage += actualDamage;
      if (enemy.interruptDamage >= enemy.interruptRequired) {
        enemy.telegraph = 0;
        enemy.patternCooldown = enemy.hp < enemy.maxHp / 2 ? 3.2 : 4;
        enemy.shotCooldown = 1;
        this.bossInterrupts++;
        this.notice = "蓄力已打断 · 防线暂时安全";
        this.noticeUntil = this.elapsed + 1.5;
        this.burst(enemy.x, enemy.y, 0x8cc6f2, 18);
      }
    }
  }

  private defeatEnemy(enemy: Enemy, source: "shot" | "blast" | "counter"): void {
    enemy.active = false;
    this.kills++;
    this.score += ENEMIES[enemy.kind].score;
    if (source === "blast") this.chainKills++;
    this.player.hp = Math.min(
      this.player.stats.maxHp,
      this.player.hp + this.player.stats.harvest * 2,
    );
    this.burst(
      enemy.x,
      enemy.y,
      enemy.kind === "boss" ? 0xdec28a : 0xa795ed,
      enemy.kind === "boss" ? 60 : 14,
    );
    if (enemy.kind === "boss") {
      this.clearedStages++;
      this.score += Math.ceil(this.player.hp) * 10;
      this.clearCombat();
      if (this.stageIndex === STAGES.length - 1) {
        this.state.transition("Victory");
      } else {
        this.reward = {
          token: ++this.rewardSerial,
          choices: drawCards(this.player, this.stacks, this.random),
          source: "stage",
        };
        this.state.transition("StageClear");
      }
      return;
    }
    if (
      this.player.stats.fuse > 0 &&
      (source !== "blast" || synergyTier(this.stacks, "blast") === 3)
    ) {
      this.queueBlast(enemy, this.player.stats.fuse * 16);
    }
  }

  private queueBlast(center: Vec2, damage: number): void {
    const amplified = synergyTier(this.stacks, "blast") >= 2;
    this.blastQueue.push({
      x: center.x,
      y: center.y,
      damage: damage * (amplified ? 1.8 : 1),
      radius: amplified ? 175 : 130,
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
    if (stats.bloodpact > 0) {
      const complete = synergyTier(this.stacks, "blast") === 3;
      this.bloodCooldown = Math.min(this.bloodCooldown, complete ? 3 : 5);
      this.bloodCooldown -= delta;
      const target = this.target;
      if (this.bloodCooldown <= 1e-9 && target && isEnemy(target)) {
        this.bloodCooldown = complete ? 3 : 5;
        this.player.hp -= Math.min(3, Math.max(0, this.player.hp - 1));
        this.queueBlast(target, stats.bloodpact * 20 + stats.maxHp * (complete ? 0.45 : 0.15));
        this.resolveBlasts();
      }
    }
    if (this.phase !== "Playing") return;
    if (synergyTier(this.stacks, "bastion") >= 2) {
      this.shieldCooldown -= delta;
      if (this.shieldCooldown <= 1e-9) {
        this.shieldCooldown = 3;
        const amount = Math.max(0, Math.min(10, stats.maxHp * 0.6 - this.player.shield));
        this.player.shield += amount;
        this.shieldRestored += amount;
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
            choices: drawCards(this.player, this.stacks, this.random),
            source: "chest",
          };
          this.burst(chest.x, chest.y, 0xdec28a, 20);
          this.state.transition("RewardSelection");
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
      this.hurt(shot.damage);
      if (this.phase !== "Playing") return;
    }
  }

  private hurt(damage: number): void {
    if (this.player.invulnerable > 0 || this.player.hp <= 0 || damage <= 0) return;
    damagePlayer(this.player, damage);
    this.lastHitAt = this.elapsed;
    this.burst(this.player.x, this.player.y, 0xe57d98, 12);
    if (this.player.hp <= 0) {
      this.state.transition("GameOver");
      return;
    }
    const complete = synergyTier(this.stacks, "bastion") === 3;
    const target = this.target;
    if (target && isEnemy(target) && this.player.stats.thorns > 0) {
      this.damageEnemy(target, this.player.stats.thorns * 18 * (complete ? 2 : 1), "counter");
    }
    if (complete && this.phase === "Playing") {
      this.showBlast(this.player, 800, 0x95d9be);
      for (const enemy of this.enemies.items) {
        this.damageEnemy(enemy, this.player.stats.maxHp * 0.5, "counter");
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
      elapsed: this.elapsed,
      stageIndex: this.stageIndex,
      stageElapsed: this.stageElapsed,
      stageName: this.stage.name,
      clearedStages: this.clearedStages,
      endless: this.endless,
      seed: this.seed,
      player: structuredClone(this.player),
      kills: this.kills,
      score: this.score,
      openedChests: this.openedChests,
      stacks: Object.fromEntries(this.stacks),
      synergies: synergyProgress(this.stacks),
      reward: this.reward ? structuredClone(this.reward) : null,
      targetId: this.targetId,
      manualTargetId: this.manualTargetId,
      metrics: {
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
