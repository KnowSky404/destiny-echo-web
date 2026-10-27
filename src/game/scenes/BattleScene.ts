import Phaser from "phaser";
import { onLocaleChange, t } from "../../i18n/locale";
import { CONFIG } from "../config";
import { InputController } from "../input";
import { presentationProgress } from "../presentation";
import { seededRandom } from "../random";
import { synergyTier } from "../synergies";
import type { World } from "../world";
import { COLORS, createTextures, TEXTURE_SCALE } from "./textures";

export class BattleScene extends Phaser.Scene {
  private inputController?: InputController;
  private ship?: Phaser.GameObjects.Image;
  private halo?: Phaser.GameObjects.Graphics;
  private sigil?: Phaser.GameObjects.Image;
  private overlay?: Phaser.GameObjects.Graphics;
  private tracery?: Phaser.GameObjects.Graphics;
  private views = new Map<string, Phaser.GameObjects.Image[]>();
  private previousHitAt = -10;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(
    private readonly world: World,
    private readonly ready: () => void,
  ) {
    super("battle");
  }

  private onStop(cleanup: () => void): void {
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, dispose);
      this.events.off(Phaser.Scenes.Events.DESTROY, dispose);
      cleanup();
    };
    // Scene stops emit SHUTDOWN, while destroying a complete Game goes straight
    // to DESTROY. Release external subscriptions in both lifecycle paths.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
    this.events.once(Phaser.Scenes.Events.DESTROY, dispose);
  }

  create(): void {
    const fitCamera = () => {
      // Only the drawing buffer changes. Combat and pointer input retain the
      // complete, fixed logical arena at every viewport size.
      this.cameras.main
        .setSize(this.scale.width, this.scale.height)
        .setZoom(this.scale.width / this.world.arena.width, this.scale.height / CONFIG.height)
        .centerOn(this.world.arena.width / 2, CONFIG.height / 2);
    };
    fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, fitCamera);
    createTextures(this);
    this.background();
    this.ship = this.add
      .image(this.world.arena.player.x, this.world.arena.player.y, "player")
      .setScale(0.74 / TEXTURE_SCALE)
      .setDepth(5);
    this.halo = this.add.graphics().setDepth(4);
    this.tracery = this.add.graphics().setDepth(4);
    this.overlay = this.add.graphics().setDepth(6);
    this.inputController = new InputController(this.game.canvas, this.world);
    const labelCanvas = () =>
      this.game.canvas.setAttribute(
        "aria-label",
        t(
          "命运残响固定阵地：点击敌人或宝箱优先攻击，点击空白恢复自动。聚焦战场后 T 切换目标，C 恢复自动，F 确认本次集火。",
          "Echoes of Destiny defense arena: select enemies or chests to focus fire; select empty space for auto targeting. Focus the arena, then press T to cycle targets, C for auto targeting, or F to confirm the current cast.",
        ),
      );
    labelCanvas();
    const unsubscribe = onLocaleChange(labelCanvas);
    this.game.canvas.setAttribute("role", "img");
    this.game.canvas.tabIndex = 0;
    this.game.canvas.setAttribute("aria-keyshortcuts", "T C F");
    this.onStop(() => {
      this.inputController?.destroy();
      this.inputController = undefined;
      this.scale.off(Phaser.Scale.Events.RESIZE, fitCamera);
      unsubscribe();
    });
    this.ready();
  }

  private background(): void {
    const g = this.add.graphics();
    // Keep wide cached backgrounds below 4096px while supplying desktop detail.
    const backgroundScale = Math.min(TEXTURE_SCALE, 4096 / this.world.arena.width);
    g.scaleCanvas(backgroundScale, backgroundScale);
    g.fillStyle(0x0b1020, 1);
    g.fillRect(0, 0, this.world.arena.width, CONFIG.height);
    const random = seededRandom(73);
    for (let i = 0; i < 120; i++) {
      const x = random() * this.world.arena.width;
      const y = random() * CONFIG.height;
      const radius = i % 5 === 0 ? 1.3 : 0.6;
      g.fillStyle(i % 3 ? 0x8c9bbd : COLORS.blue, 0.15 + random() * 0.45);
      g.fillCircle(x, y, radius);
      if (i % 15 === 0) {
        g.lineStyle(0.6, COLORS.blue, 0.4);
        g.lineBetween(x - 3, y, x + 3, y);
        g.lineBetween(x, y - 3, x, y + 3);
      }
    }
    const sigil = this.add.graphics();
    sigil.scaleCanvas(TEXTURE_SCALE, TEXTURE_SCALE);
    sigil.lineStyle(1, 0x6e72ba, 0.2);
    for (const radius of [135, 167, 195, 205]) sigil.strokeCircle(210, 210, radius);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const end = angle + (Math.PI * 2) / 3;
      sigil.lineBetween(
        210 + Math.cos(angle) * 195,
        210 + Math.sin(angle) * 195,
        210 + Math.cos(end) * 195,
        210 + Math.sin(end) * 195,
      );
      sigil.lineStyle(1, COLORS.blue, 0.2);
      sigil.strokeCircle(210 + Math.cos(angle) * 205, 210 + Math.sin(angle) * 205, 3);
    }
    sigil.generateTexture("sigil", 420 * TEXTURE_SCALE, 420 * TEXTURE_SCALE);
    sigil.destroy();
    this.sigil = this.add
      .image(this.world.arena.player.x, 315, "sigil")
      .setDisplaySize(420, 420)
      .setDepth(-1);
    g.fillStyle(COLORS.gold, 0.035);
    for (const region of this.world.arena.baseAttackRegions)
      g.fillRect(region.x, region.y, region.width, region.height);
    g.lineStyle(1.5, COLORS.gold, 0.5);
    g.lineBetween(18, CONFIG.defense.y + 25, this.world.arena.width - 18, CONFIG.defense.y + 25);
    g.lineStyle(1, 0x5b749d, 0.18);
    g.strokeCircle(this.world.arena.player.x, this.world.arena.player.y, 44);
    g.strokeCircle(this.world.arena.player.x, this.world.arena.player.y, 52);
    g.fillStyle(0x7185a4, 0.5);
    for (const x of this.world.arena.crowdLanes) {
      for (let row = 0; row < this.world.arena.rows; row++)
        g.strokeEllipse(x, CONFIG.defense.y - row * CONFIG.crowd.cellHeight, 42, 14);
    }
    // Hundreds of static star / circle primitives become two cached GPU textures.
    g.generateTexture(
      "background",
      Math.ceil(this.world.arena.width * backgroundScale),
      Math.ceil(CONFIG.height * backgroundScale),
    );
    g.destroy();
    this.add
      .image(0, 0, "background")
      .setDisplaySize(this.world.arena.width, CONFIG.height)
      .setOrigin(0)
      .setDepth(-2);
  }

  update(_time: number, delta: number): void {
    if (!this.ship || !this.halo || !this.overlay || !this.tracery) return;
    this.world.update(delta / 1000);
    const { player } = this.world;
    this.ship.setPosition(player.x, player.y);
    this.ship.setAlpha(
      player.invulnerable > 0 ? (Math.sin(this.world.elapsed * 35) > 0 ? 0.4 : 1) : 1,
    );
    this.halo.clear();
    this.halo.lineStyle(1, COLORS.blue, 0.24);
    this.halo.strokeCircle(player.x, player.y, 31);
    if (player.shield > 0) {
      this.halo.lineStyle(1.5, COLORS.blue, 0.65);
      this.halo.strokeCircle(player.x, player.y, 35);
    }
    if (player.poisonTime > 0) {
      this.halo.lineStyle(2, 0xb6e7a4, 0.9);
      this.halo.strokeCircle(player.x, player.y, 40);
    }
    // The small central dot is the real hit box, not the decorative wings.
    this.halo.fillStyle(0xffffff, 0.95);
    this.halo.fillCircle(player.x, player.y, 3);
    if (this.sigil) {
      this.sigil.rotation = this.reducedMotion ? 0 : this.world.elapsed * 0.025;
      this.sigil.setTint(this.world.stage.color);
    }
    this.renderPools();
    this.renderTracery();
    this.overlay.clear();
    if (this.world.endless) {
      for (const region of this.world.attackRegions) {
        const centerX = region.x + region.width / 2;
        const centerY = region.y + region.height / 2;
        // Star coordinates and short constellation links trace the real cell
        // boundaries, leaving the action visible instead of covering it in red.
        this.overlay.lineStyle(0.75, COLORS.blue, 0.3);
        this.overlay.strokeEllipse(centerX, centerY, 42, 14);
        this.overlay.lineStyle(0.8, COLORS.gold, 0.42);
        for (const x of [region.x, region.x + region.width]) {
          for (const y of [region.y, region.y + region.height]) {
            const directionX = x < centerX ? 1 : -1;
            const directionY = y < centerY ? 1 : -1;
            this.overlay.lineBetween(x + directionX * 7, y, x + directionX * 23, y);
            this.overlay.lineBetween(x, y + directionY * 7, x, y + directionY * 19);
            this.overlay.fillStyle(COLORS.blue, 0.8);
            this.overlay.fillTriangle(x, y - 4, x - 1.5, y, x + 1.5, y);
            this.overlay.fillTriangle(x, y + 4, x - 1.5, y, x + 1.5, y);
            this.overlay.fillTriangle(x - 4, y, x, y - 1.5, x, y + 1.5);
            this.overlay.fillTriangle(x + 4, y, x, y - 1.5, x, y + 1.5);
          }
        }
        this.overlay.fillStyle(COLORS.gold, 0.8);
        this.overlay.fillTriangle(centerX, centerY - 4, centerX - 3, centerY, centerX + 3, centerY);
        this.overlay.fillTriangle(centerX, centerY + 4, centerX - 3, centerY, centerX + 3, centerY);
      }
    }
    for (const blast of this.world.blasts.items) {
      if (!blast.active) continue;
      const progress = 1 - blast.life / blast.maxLife;
      this.overlay.lineStyle(3, blast.color, (1 - progress) * 0.8);
      this.overlay.strokeCircle(
        blast.x,
        blast.y,
        blast.radius * (this.reducedMotion ? 1 : 0.25 + progress * 0.75),
      );
    }
    for (const enemy of this.world.enemies.items) {
      if (!enemy.active) continue;
      const preparing = enemy.stage === "Preparing";
      const attacking = enemy.stage === "Attacking";
      const color =
        this.world.sanctuaryRemaining > 0 || enemy.stunTime > 0
          ? 0xc7b7e8
          : enemy.slowTime > 0
            ? 0x9ce2ef
            : preparing
              ? COLORS.gold
              : attacking
                ? 0xe57d98
                : COLORS.blue;
      this.overlay.lineStyle(
        preparing || attacking ? 2 : 1,
        color,
        preparing || attacking ? 0.8 : 0.25,
      );
      this.overlay.strokeCircle(enemy.x, enemy.y, enemy.radius + 5);
      if (enemy.role === "elite") {
        // A broken diamond identifies a sub-boss without hiding its species silhouette.
        this.overlay.lineStyle(2, COLORS.gold, 0.9);
        const radius = enemy.radius + 16;
        for (const direction of [-1, 1]) {
          this.overlay.lineBetween(
            enemy.x + direction * radius,
            enemy.y,
            enemy.x + direction * radius * 0.5,
            enemy.y - radius * 0.5,
          );
          this.overlay.lineBetween(
            enemy.x + direction * radius,
            enemy.y,
            enemy.x + direction * radius * 0.5,
            enemy.y + radius * 0.5,
          );
        }
        this.overlay.fillStyle(COLORS.gold, 0.95);
        this.overlay.fillTriangle(
          enemy.x,
          enemy.y - radius - 11,
          enemy.x - 5,
          enemy.y - radius - 3,
          enemy.x + 5,
          enemy.y - radius - 3,
        );
      }
      if (enemy.vulnerableTime > 0) {
        this.overlay.lineStyle(3, COLORS.blue, 0.95);
        for (let corner = 0; corner < 4; corner++) {
          const angle = (corner * Math.PI) / 2;
          this.overlay.beginPath();
          this.overlay.arc(enemy.x, enemy.y, enemy.radius + 12, angle + 0.15, angle + 0.9);
          this.overlay.strokePath();
        }
      }
      if (enemy.tauntRemaining > 0 || enemy.damageReductionTime > 0 || enemy.enhanced) {
        this.overlay.lineStyle(2, enemy.tauntRemaining > 0 ? 0xf1b464 : COLORS.gold, 0.85);
        this.overlay.strokeCircle(enemy.x, enemy.y, enemy.radius + 10);
      }
      if (this.world.endless && enemy.kind !== "boss") {
        const y = enemy.y - enemy.radius - 9;
        this.overlay.fillStyle(enemy.stars > 1 ? COLORS.gold : 0x8894b2, 0.95);
        for (let star = 0; star < enemy.stars; star++) {
          const x = enemy.x + (star - (enemy.stars - 1) / 2) * 9;
          this.overlay.fillTriangle(x, y - 4, x - 3, y + 2, x + 3, y + 2);
          this.overlay.fillTriangle(x, y + 4, x - 3, y - 2, x + 3, y - 2);
        }
        if (enemy.fusionTime > 0) {
          this.overlay.lineStyle(2, 0xc7b7e8, 0.95);
          this.overlay.beginPath();
          this.overlay.arc(
            enemy.x,
            enemy.y,
            enemy.radius + 8,
            -Math.PI / 2,
            -Math.PI / 2 + (Math.PI * 2 * enemy.fusionTime) / CONFIG.fusion.duration,
          );
          this.overlay.strokePath();
        }
      }
      const width = enemy.kind === "boss" ? 84 : enemy.role === "elite" ? 56 : 34;
      const y = enemy.y + enemy.radius + 10;
      this.overlay.fillStyle(0x303044, 1);
      this.overlay.fillRect(enemy.x - width / 2, y, width, 3);
      this.overlay.fillStyle(enemy.stars > 1 ? COLORS.gold : color, 1);
      this.overlay.fillRect(enemy.x - width / 2, y, (width * enemy.hp) / enemy.maxHp, 3);
      if (preparing) {
        this.overlay.lineStyle(3, COLORS.gold, 1);
        this.overlay.beginPath();
        this.overlay.arc(
          enemy.x,
          enemy.y,
          enemy.radius + 8,
          -Math.PI / 2,
          -Math.PI / 2 +
            Math.PI *
              2 *
              (1 -
                enemy.preparation /
                  Math.max(
                    1e-9,
                    this.world.enemyDefinition(enemy).preparation *
                      this.world.enemyStage(enemy).attackTiming,
                  )),
        );
        this.overlay.strokePath();
      }
      if (enemy.telegraph > 0) {
        const forming = this.world.interruptOpeningRemaining(enemy) > 0;
        const needsFocus =
          this.world.counterFocusRequired(enemy) && !this.world.counterFocusConfirmed(enemy);
        const warningColor = forming ? 0xc7b7e8 : needsFocus ? COLORS.gold : COLORS.blue;
        this.overlay.lineStyle(2, warningColor, 0.8);
        if (!enemy.castSkill || enemy.castSkill === "slam" || enemy.castSkill === "volley")
          this.overlay.lineBetween(enemy.x, enemy.y + enemy.radius, player.x, player.y);
        const warningRadius = enemy.radius + 12;
        if (forming) {
          // Four separated arcs mark the unopened window without motion or color alone.
          for (let arc = 0; arc < 4; arc++) {
            const angle = (arc * Math.PI) / 2;
            this.overlay.beginPath();
            this.overlay.arc(enemy.x, enemy.y, warningRadius, angle + 0.15, angle + 0.95);
            this.overlay.strokePath();
          }
        } else {
          this.overlay.strokeCircle(enemy.x, enemy.y, warningRadius);
          if (needsFocus) {
            // An open diamond asks for a fresh target selection for this cast.
            for (const direction of [-1, 1]) {
              this.overlay.lineBetween(
                enemy.x,
                enemy.y - warningRadius - 12,
                enemy.x + direction * 6,
                enemy.y - warningRadius - 6,
              );
              this.overlay.lineBetween(
                enemy.x + direction * 6,
                enemy.y - warningRadius - 6,
                enemy.x,
                enemy.y - warningRadius,
              );
            }
          } else {
            // Double ring and a check identify an armed hit route, including reduced motion.
            this.overlay.strokeCircle(enemy.x, enemy.y, warningRadius + 4);
            this.overlay.lineBetween(
              enemy.x - 5,
              enemy.y - warningRadius - 9,
              enemy.x - 1,
              enemy.y - warningRadius - 5,
            );
            this.overlay.lineBetween(
              enemy.x - 1,
              enemy.y - warningRadius - 5,
              enemy.x + 6,
              enemy.y - warningRadius - 13,
            );
          }
        }
        // Confirmation may be made during the opening; the check remains visible
        // while the separated arcs still say that hits cannot count yet.
        if (forming && this.world.counterFocusConfirmed(enemy)) {
          this.overlay.lineBetween(
            enemy.x - 5,
            enemy.y - warningRadius - 9,
            enemy.x - 1,
            enemy.y - warningRadius - 5,
          );
          this.overlay.lineBetween(
            enemy.x - 1,
            enemy.y - warningRadius - 5,
            enemy.x + 6,
            enemy.y - warningRadius - 13,
          );
        }
        // The release location remains explicit even with reduced motion enabled.
        if (enemy.castSkill === "slam") {
          this.overlay.lineStyle(2.5, COLORS.pink, 0.85);
          this.overlay.strokeCircle(player.x, player.y, 43);
          for (const direction of [-1, 1]) {
            this.overlay.lineBetween(
              player.x + direction * 30,
              player.y - 30,
              player.x + direction * 16,
              player.y - 16,
            );
            this.overlay.lineBetween(
              player.x + direction * 30,
              player.y + 30,
              player.x + direction * 16,
              player.y + 16,
            );
          }
        } else if (enemy.castSkill) {
          const points = enemy.castSkill === "ritual" || enemy.castSkill === "summon" ? 6 : 4;
          this.overlay.fillStyle(COLORS.gold, 0.9);
          for (let point = 0; point < points; point++) {
            const angle = (point / points) * Math.PI * 2;
            this.overlay.fillCircle(
              enemy.x + Math.cos(angle) * (enemy.radius + 18),
              enemy.y + Math.sin(angle) * (enemy.radius + 18),
              2.5,
            );
          }
        }
        this.overlay.fillStyle(warningColor, 1);
        this.overlay.fillRect(
          enemy.x - 42,
          y + 7,
          84 *
            Math.min(
              1,
              Math.max(
                enemy.interruptDamage / Math.max(1, enemy.interruptRequired),
                (enemy.interruptHits ?? 0) / this.world.interruptHitTarget,
              ),
            ),
          4,
        );
      }
    }
    const target = this.world.target;
    if (target) {
      const radius = target.radius + 14;
      this.overlay.lineStyle(
        2,
        this.world.manualTargetId !== null ? COLORS.gold : COLORS.blue,
        0.95,
      );
      for (let corner = 0; corner < 4; corner++) {
        const angle = (corner * Math.PI) / 2 + Math.PI / 4;
        const x = target.x + Math.cos(angle) * radius;
        const y = target.y + Math.sin(angle) * radius;
        this.overlay.lineBetween(x, y, x - Math.sign(x - target.x) * 9, y);
        this.overlay.lineBetween(x, y, x, y - Math.sign(y - target.y) * 9);
      }
    }
    for (const chest of this.world.chests.items) {
      if (!chest.active) continue;
      this.overlay.lineStyle(1, COLORS.gold, 0.3);
      this.overlay.strokeEllipse(chest.x, chest.y, 80, 42);
      this.overlay.fillStyle(0x303044, 1);
      this.overlay.fillRect(chest.x - 21, chest.y + 33, 42, 3);
      this.overlay.fillStyle(COLORS.gold, 1);
      this.overlay.fillRect(chest.x - 21, chest.y + 33, (42 * chest.hp) / chest.maxHp, 3);
    }
    if (this.world.lastHitAt !== this.previousHitAt) {
      this.previousHitAt = this.world.lastHitAt;
      if (this.world.lastHitAt > 0 && !this.reducedMotion) this.cameras.main.shake(90, 0.003);
    }
  }

  private renderTracery(): void {
    const graphics = this.tracery;
    if (!graphics) return;
    graphics.clear();
    if (!this.reducedMotion) {
      for (const shot of this.world.shots.items) {
        if (!shot.active) continue;
        const speed = Math.max(1, Math.hypot(shot.vx, shot.vy));
        graphics.lineStyle(shot.primary ? 2 : 1, shot.critical ? COLORS.gold : COLORS.blue, 0.35);
        graphics.lineBetween(
          shot.x,
          shot.y,
          shot.x - (shot.vx / speed) * 18,
          shot.y - (shot.vy / speed) * 18,
        );
      }
    }
    for (const effect of this.world.effects) {
      const progress = presentationProgress(effect);
      const alpha = (1 - progress) * 0.9;
      graphics.lineStyle(effect.kind === "impact" ? 3 : 1.5, effect.color, alpha);
      if (effect.kind === "chain") {
        const endX = effect.toX ?? effect.x;
        const endY = effect.toY ?? effect.y;
        if (this.reducedMotion) graphics.lineBetween(effect.x, effect.y, endX, endY);
        else {
          const dx = endX - effect.x;
          const dy = endY - effect.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          let previousX = effect.x;
          let previousY = effect.y;
          for (let point = 1; point <= 5; point++) {
            const offset = point === 5 ? 0 : (point % 2 ? 1 : -1) * Math.min(7, length * 0.06);
            const x = effect.x + (dx * point) / 5 - (dy / length) * offset;
            const y = effect.y + (dy * point) / 5 + (dx / length) * offset;
            graphics.lineBetween(previousX, previousY, x, y);
            previousX = x;
            previousY = y;
          }
        }
        graphics.strokeCircle(endX, endY, 7);
        continue;
      }
      const radius = effect.radius * (this.reducedMotion ? 1 : 0.6 + progress * 0.5);
      graphics.strokeCircle(effect.x, effect.y, radius);
      if (effect.kind === "erosion") {
        graphics.strokeCircle(effect.x, effect.y, radius * 0.65);
        for (let spoke = 0; spoke < 3; spoke++) {
          const angle = (spoke / 3) * Math.PI * 2 - Math.PI / 2;
          graphics.lineBetween(
            effect.x + Math.cos(angle) * radius,
            effect.y + Math.sin(angle) * radius,
            effect.x + Math.cos(angle + (Math.PI * 2) / 3) * radius,
            effect.y + Math.sin(angle + (Math.PI * 2) / 3) * radius,
          );
        }
      } else if (effect.kind === "impact") {
        for (let spoke = 0; spoke < 8; spoke++) {
          const angle = (spoke / 8) * Math.PI * 2;
          graphics.lineBetween(
            effect.x + Math.cos(angle) * radius * 0.45,
            effect.y + Math.sin(angle) * radius * 0.45,
            effect.x + Math.cos(angle) * radius,
            effect.y + Math.sin(angle) * radius,
          );
        }
      }
    }
    for (const echo of this.world.deathEchoes) {
      const progress = presentationProgress(echo);
      const radius = echo.role === "boss" ? 48 : echo.role === "elite" ? 29 : 18;
      graphics.lineStyle(1.5, echo.color, (1 - progress) * 0.7);
      const spread = this.reducedMotion ? 0 : progress * (echo.role === "boss" ? 34 : 18);
      for (let piece = 0; piece < 6; piece++) {
        const angle = (piece / 6) * Math.PI * 2;
        const x = echo.x + Math.cos(angle) * (radius + spread);
        const y = echo.y + Math.sin(angle) * (radius + spread);
        graphics.lineBetween(
          x - Math.cos(angle + 0.5) * 5,
          y - Math.sin(angle + 0.5) * 5,
          x + Math.cos(angle + 0.5) * 5,
          y + Math.sin(angle + 0.5) * 5,
        );
      }
    }
  }

  private renderPools(): void {
    const menu = this.world.phase === "Menu";
    for (const kind of ["wisp", "sentinel", "hexer", "tank", "wizard", "boss"] as const) {
      const enemies = this.world.enemies.items.filter(
        (enemy) => enemy.active && enemy.kind === kind,
      );
      this.render(kind, enemies, (image, enemy) => {
        image
          .setPosition(enemy.x, enemy.y)
          .setScale((kind === "boss" ? 0.9 : enemy.role === "elite" ? 0.96 : 0.8) / TEXTURE_SCALE);
        image.rotation = this.reducedMotion
          ? 0
          : kind === "sentinel"
            ? enemy.age * 0.4
            : Math.sin(enemy.age) * 0.06;
        image.setTint(
          enemy.vulnerableTime > 0
            ? COLORS.blue
            : enemy.stunTime > 0
              ? 0xc7b7e8
              : enemy.slowTime > 0
                ? 0x9ce2ef
                : enemy.stage === "Attacking"
                  ? 0xffb3cc
                  : enemy.stage === "Preparing"
                    ? 0xffdf9c
                    : kind === "boss"
                      ? this.world.stage.color
                      : 0xffffff,
        );
      });
    }
    this.render(
      "death-echo",
      this.world.deathEchoes,
      (image, echo) => {
        const progress = presentationProgress(echo);
        const scale = echo.role === "boss" ? 0.9 : echo.role === "elite" ? 0.96 : 0.8;
        image
          .setTexture(echo.kind)
          .setPosition(echo.x, echo.y)
          .setTint(echo.color)
          .setDepth(4)
          .setAlpha((1 - progress) * 0.8)
          .setScale((scale * (this.reducedMotion ? 1 : 1 + progress * 0.22)) / TEXTURE_SCALE)
          .setRotation(this.reducedMotion ? 0 : progress * 0.12);
      },
      "wisp",
    );
    this.render(
      "chest",
      this.world.chests.items.filter((item) => item.active),
      (image, item) => {
        image.setPosition(item.x, item.y).setScale(0.9 / TEXTURE_SCALE);
      },
    );
    this.render(
      "friendly-shot",
      this.world.shots.items.filter((item) => item.active),
      (image, item) => {
        image
          .setPosition(item.x, item.y)
          .setScale(0.7 / TEXTURE_SCALE)
          .setRotation(Math.atan2(item.vx, -item.vy));
        image.setTint(
          item.critical
            ? 0xf1ce7a
            : synergyTier(this.world.stacks, "blast") >= 3
              ? 0xffc3a1
              : 0xffffff,
        );
      },
    );
    this.render(
      "hostile-shot",
      this.world.hostileShots.items.filter((item) => item.active),
      (image, item) => {
        image.setPosition(item.x, item.y).setScale(item.radius / 5 / TEXTURE_SCALE);
      },
    );
    this.render(
      "spark",
      this.world.particles.items.filter((item) => item.active),
      (image, item) => {
        image
          .setPosition(item.x, item.y)
          .setScale(0.45 / TEXTURE_SCALE)
          .setTint(item.color)
          .setAlpha(Math.max(0, item.life / item.maxLife));
      },
    );
    const preview = menu
      ? [
          { x: 105, y: 125 },
          { x: 338, y: 104 },
          { x: 225, y: 66 },
          { x: 55, y: 263 },
          { x: 386, y: 230 },
        ]
      : [];
    this.render(
      "menu-wisp",
      preview.map((item) => ({ ...item, x: (item.x / CONFIG.width) * this.world.arena.width })),
      (image, item) => {
        image
          .setTexture("wisp")
          .setPosition(item.x, item.y)
          .setScale(0.7 / TEXTURE_SCALE)
          .setAlpha(0.75);
      },
    );
    this.render(
      "menu-chest",
      menu ? [{ x: this.world.arena.player.x, y: 548 }] : [],
      (image, item) => {
        image
          .setTexture("chest")
          .setPosition(item.x, item.y)
          .setScale(0.8 / TEXTURE_SCALE);
      },
    );
  }

  private render<T>(
    key: string,
    items: readonly T[],
    update: (image: Phaser.GameObjects.Image, item: T) => void,
    texture = key.startsWith("menu-") ? key.slice(5) : key,
  ): void {
    let views = this.views.get(key);
    if (!views) {
      views = [];
      this.views.set(key, views);
    }
    for (let index = 0; index < items.length; index++) {
      let view = views[index];
      if (!view) {
        view = this.add.image(0, 0, texture).setDepth(key === "spark" ? 7 : 3);
        views.push(view);
      }
      view.setVisible(true);
      const item = items[index];
      if (item) update(view, item);
    }
    for (let index = items.length; index < views.length; index++) views[index]?.setVisible(false);
  }
}
