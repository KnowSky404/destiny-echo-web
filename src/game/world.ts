import { applyCard, drawCards } from "../data/cards";
import { ENEMIES } from "../data/enemies";
import { CONFIG } from "./config";
import { Pool } from "./pool";
import { type Random, seededRandom } from "./random";
import { RunState } from "./state";
import { damagePlayer } from "./systems/damage";
import { movePlayer, segmentHitsCircle } from "./systems/movement";
import type {
  Chest,
  Enemy,
  EnemyKind,
  InputFrame,
  Particle,
  Player,
  Projectile,
  Reward,
} from "./types";

export function createPlayer(): Player {
  return {
    x: CONFIG.width / 2,
    y: CONFIG.playerY,
    hp: 100,
    shield: 0,
    invulnerable: 0,
    cooldown: 0,
    stats: { damage: 12, interval: 0.28, projectiles: 1, piercing: 0, maxHp: 100, speed: 260 },
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
    originX: 0,
    telegraph: 0,
    targetX: 0,
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
  readonly stacks = new Map<string, number>();
  player = createPlayer();
  reward: Reward | null = null;
  elapsed = 0;
  kills = 0;
  score = 0;
  openedChests = 0;
  bossSpawned = false;
  endingReason: "health" | "timeout" = "health";
  lastHitAt = -10;
  notice = "";
  noticeUntil = 0;
  seed = 0;
  private random: Random = seededRandom(0);
  private nextId = 1;
  private rewardSerial = 0;
  private accumulator = 0;
  private spawnCooldown = 0.8;
  private nextChestAt: number = CONFIG.chestFirstAt;

  get phase() {
    return this.state.phase;
  }
  get wave() {
    return Math.min(5, Math.floor(this.elapsed / 11) + 1);
  }
  get boss(): Enemy | undefined {
    return this.enemies.items.find((enemy) => enemy.active && enemy.kind === "boss");
  }

  start(seed = Date.now()): boolean {
    if (this.phase === "Playing" || this.phase === "RewardSelection") return false;
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
    this.kills = 0;
    this.score = 0;
    this.openedChests = 0;
    this.bossSpawned = false;
    this.endingReason = "health";
    this.lastHitAt = -10;
    this.notice = "";
    this.noticeUntil = 0;
    this.nextId = 1;
    this.accumulator = 0;
    this.spawnCooldown = 0.8;
    this.nextChestAt = CONFIG.chestFirstAt;
    for (const pool of [this.enemies, this.shots, this.hostileShots, this.chests, this.particles])
      pool.clear();
  }

  chooseCard(id: string, token: number): boolean {
    if (
      this.phase !== "RewardSelection" ||
      !this.reward ||
      this.reward.token !== token ||
      !this.reward.choices.includes(id)
    )
      return false;
    if (!applyCard(id, this.player, this.stacks)) return false;
    // Remove the capability before resuming: stale clicks cannot claim this reward again.
    this.reward = null;
    this.state.transition("Playing");
    this.accumulator = 0;
    this.notice = "残响已融合 · 继续改写命运";
    this.noticeUntil = this.elapsed + 2;
    return true;
  }

  update(delta: number, input: InputFrame = { x: 0, y: 0 }): void {
    if (this.phase !== "Playing" || !Number.isFinite(delta) || delta <= 0) return;
    this.accumulator += Math.min(delta, CONFIG.maxFrameDelta);
    while (this.accumulator + 1e-9 >= CONFIG.fixedStep && this.phase === "Playing") {
      this.accumulator -= CONFIG.fixedStep;
      this.step(CONFIG.fixedStep, input);
    }
    if (this.phase !== "Playing") this.accumulator = 0;
  }

  private step(delta: number, input: InputFrame): void {
    this.elapsed += delta;
    this.player.invulnerable = Math.max(0, this.player.invulnerable - delta);
    movePlayer(this.player, input, delta);
    this.attack(delta);
    this.spawn(delta);
    this.moveEnemies(delta);
    this.moveShots(this.shots, delta);
    this.moveShots(this.hostileShots, delta);
    for (const chest of this.chests.items) {
      if (!chest.active) continue;
      chest.age += delta;
      chest.y = Math.min(340, chest.y + 7 * delta);
    }
    this.collisions();
    if (this.phase !== "Playing") return;
    for (const particle of this.particles.items) {
      if (!particle.active) continue;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.life -= delta;
      if (particle.life <= 0) particle.active = false;
    }
    if (this.elapsed >= CONFIG.deadline) {
      this.endingReason = "timeout";
      this.state.transition("GameOver");
    }
  }

  private attack(delta: number): void {
    this.player.cooldown -= delta;
    if (this.player.cooldown > 0) return;
    this.player.cooldown += this.player.stats.interval;
    const count = this.player.stats.projectiles;
    for (let index = 0; index < count; index++) {
      const offset = index - (count - 1) / 2;
      this.projectile(
        this.shots,
        this.player.x + offset * 10,
        this.player.y - 22,
        offset * 24,
        -620,
        this.player.stats.damage,
        4,
        this.player.stats.piercing + 1,
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
    });
    shot.hitIds.clear();
  }

  private spawn(delta: number): void {
    if (!this.bossSpawned && this.elapsed >= CONFIG.bossAt) {
      this.bossSpawned = true;
      this.enemies.clear();
      this.hostileShots.clear();
      this.spawnEnemy("boss", CONFIG.width / 2);
      this.notice = "失控圣杯降临 · 留意金色预警";
      this.noticeUntil = this.elapsed + 3;
    }
    if (!this.bossSpawned) {
      this.spawnCooldown -= delta;
      if (this.spawnCooldown <= 0) {
        this.spawnCooldown += Math.max(0.48, 1.15 - this.wave * 0.12);
        this.spawnEnemy(this.random() < 0.65 ? "wisp" : "sentinel", 42 + this.random() * 366);
      }
      if (
        this.elapsed >= this.nextChestAt &&
        this.nextChestAt <= CONFIG.chestLastAt &&
        !this.chests.items.some((chest) => chest.active)
      ) {
        const chest = this.chests.acquire();
        if (chest) {
          Object.assign(chest, {
            id: this.nextId++,
            x: this.openedChests === 0 ? 225 : 100 + this.random() * 250,
            y: 240,
            hp: 32,
            maxHp: 32,
            radius: 26,
            age: 0,
          });
          this.nextChestAt = this.elapsed + CONFIG.chestInterval;
          this.notice = "宝箱显现 · 对准金色宝箱持续攻击";
          this.noticeUntil = this.elapsed + 3;
        }
      }
    }
  }

  private spawnEnemy(kind: EnemyKind, x: number): void {
    const enemy = this.enemies.acquire();
    if (!enemy) return;
    const data = ENEMIES[kind];
    const hp = kind === "boss" ? data.hp : Math.round(data.hp * (1 + (this.wave - 1) * 0.1));
    Object.assign(enemy, {
      id: this.nextId++,
      kind,
      x,
      originX: x,
      y: kind === "boss" ? 110 : -30,
      hp,
      maxHp: hp,
      radius: data.radius,
      speed: data.speed,
      age: 0,
      telegraph: 0,
      shotCooldown: kind === "boss" ? 1.4 : 1.3 + this.random() * 0.7,
      patternCooldown: 3.5,
      targetX: 0,
    });
  }

  private moveEnemies(delta: number): void {
    for (const enemy of this.enemies.items) {
      if (!enemy.active) continue;
      enemy.age += delta;
      if (enemy.kind === "boss") {
        enemy.x = 225 + Math.sin(enemy.age * 0.65) * 125;
        enemy.y = 112 + Math.sin(enemy.age * 0.9) * 15;
        this.bossPattern(enemy, delta);
      } else {
        enemy.x = enemy.originX + Math.sin(enemy.age * (enemy.kind === "wisp" ? 2 : 0.9)) * 26;
        enemy.y += enemy.speed * (1 + (this.wave - 1) * 0.07) * delta;
      }
      if (enemy.y > CONFIG.height + 40) {
        enemy.active = false;
        continue;
      }
      enemy.shotCooldown -= delta;
      if (enemy.shotCooldown <= 0 && enemy.y > 0 && enemy.y < 580) {
        const data = ENEMIES[enemy.kind];
        enemy.shotCooldown +=
          data.interval * (enemy.kind === "boss" ? 1 : Math.max(0.7, 1 - this.wave * 0.04));
        const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
        const fan = enemy.kind === "wisp" ? 1 : enemy.kind === "boss" ? 5 : 3;
        const speed = enemy.kind === "boss" ? 168 : 110 + this.wave * 9;
        for (let index = 0; index < fan; index++) {
          const direction = angle + (index - (fan - 1) / 2) * 0.19;
          this.projectile(
            this.hostileShots,
            enemy.x,
            enemy.y + 12,
            Math.cos(direction) * speed,
            Math.sin(direction) * speed,
            data.damage,
          );
        }
      }
    }
  }

  private bossPattern(boss: Enemy, delta: number): void {
    boss.patternCooldown -= delta;
    if (boss.patternCooldown <= 0) {
      boss.patternCooldown += boss.hp < boss.maxHp / 2 ? 3.4 : 4.5;
      boss.telegraph = 0.9;
      boss.targetX = this.player.x;
      const count = 16;
      for (let index = 0; index < count; index++) {
        const angle = index * ((Math.PI * 2) / count) + boss.age * 0.3;
        this.projectile(
          this.hostileShots,
          boss.x,
          boss.y,
          Math.cos(angle) * 138,
          Math.sin(angle) * 138,
          16,
          5,
        );
      }
    }
    if (boss.telegraph > 0) {
      boss.telegraph -= delta;
      if (boss.telegraph <= 0) {
        for (const offset of [-20, 0, 20]) {
          this.projectile(this.hostileShots, boss.targetX + offset, boss.y + 42, 0, 390, 24, 8);
        }
      }
    }
  }

  private moveShots(pool: Pool<Projectile>, delta: number): void {
    for (const shot of pool.items) {
      if (!shot.active) continue;
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
    target.hp = Math.max(0, target.hp - shot.damage);
    shot.hitsLeft--;
    if (shot.hitsLeft <= 0) shot.active = false;
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
        if (enemy.hp <= 0) {
          enemy.active = false;
          this.kills++;
          this.score += ENEMIES[enemy.kind].score;
          this.burst(
            enemy.x,
            enemy.y,
            enemy.kind === "boss" ? 0xdec28a : 0xa795ed,
            enemy.kind === "boss" ? 60 : 14,
          );
          if (enemy.kind === "boss") {
            this.score += Math.ceil(this.player.hp) * 10;
            this.state.transition("Victory");
            return;
          }
        }
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
    for (const enemy of this.enemies.items) {
      if (
        !enemy.active ||
        Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) > enemy.radius + 7
      )
        continue;
      if (enemy.kind !== "boss") enemy.active = false;
      this.hurt(20);
      if (this.phase !== "Playing") return;
    }
  }

  private hurt(damage: number): void {
    if (this.player.invulnerable > 0) return;
    damagePlayer(this.player, damage);
    this.lastHitAt = this.elapsed;
    this.burst(this.player.x, this.player.y, 0xe57d98, 12);
    if (this.player.hp <= 0) this.state.transition("GameOver");
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
      seed: this.seed,
      player: structuredClone(this.player),
      kills: this.kills,
      score: this.score,
      openedChests: this.openedChests,
      stacks: Object.fromEntries(this.stacks),
      reward: this.reward ? structuredClone(this.reward) : null,
      enemies: this.enemies.items
        .filter((item) => item.active)
        .map(({ id, kind, x, y, hp, radius, telegraph, targetX }) => ({
          id,
          kind,
          x,
          y,
          hp,
          radius,
          telegraph,
          targetX,
        })),
      chests: this.chests.items
        .filter((item) => item.active)
        .map(({ id, x, y, hp }) => ({ id, x, y, hp })),
      shots: this.shots.items
        .filter((item) => item.active)
        .map(({ x, y, vx, vy }) => ({ x, y, vx, vy })),
      hostileShots: this.hostileShots.items
        .filter((item) => item.active)
        .map(({ x, y, vx, vy }) => ({ x, y, vx, vy })),
    };
  }
}
