import Phaser from "phaser";
import { ENEMIES } from "../../data/enemies";
import { CONFIG } from "../config";
import { InputController } from "../input";
import { seededRandom } from "../random";
import { synergyTier } from "../synergies";
import type { World } from "../world";
import { COLORS, createTextures } from "./textures";

export class BattleScene extends Phaser.Scene {
  private inputController?: InputController;
  private ship?: Phaser.GameObjects.Image;
  private halo?: Phaser.GameObjects.Graphics;
  private sigil?: Phaser.GameObjects.Image;
  private overlay?: Phaser.GameObjects.Graphics;
  private views = new Map<string, Phaser.GameObjects.Image[]>();
  private previousHitAt = -10;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(
    private readonly world: World,
    private readonly ready: () => void,
  ) {
    super("battle");
  }

  create(): void {
    createTextures(this);
    this.background();
    this.ship = this.add
      .image(CONFIG.player.x, CONFIG.player.y, "player")
      .setScale(0.74)
      .setDepth(5);
    this.halo = this.add.graphics().setDepth(4);
    this.overlay = this.add.graphics().setDepth(6);
    this.inputController = new InputController(this.game.canvas, this.world);
    this.game.canvas.setAttribute(
      "aria-label",
      "命运残响固定阵地：点击敌人或宝箱优先攻击，点击空白恢复自动。聚焦战场后 T 切换目标，C 恢复自动。",
    );
    this.game.canvas.setAttribute("role", "img");
    this.game.canvas.tabIndex = 0;
    this.game.canvas.setAttribute("aria-keyshortcuts", "T C");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.inputController?.destroy());
    this.ready();
  }

  private background(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0b1020, 1);
    g.fillRect(0, 0, CONFIG.width, CONFIG.height);
    const random = seededRandom(73);
    for (let i = 0; i < 120; i++) {
      const x = random() * CONFIG.width;
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
    sigil.generateTexture("sigil", 420, 420);
    sigil.destroy();
    this.sigil = this.add.image(225, 315, "sigil").setDepth(-1);
    g.fillStyle(COLORS.gold, 0.035);
    g.fillRect(18, CONFIG.defense.y - CONFIG.defense.rowGap - 25, 414, CONFIG.defense.rowGap + 50);
    g.lineStyle(1.5, COLORS.gold, 0.5);
    g.lineBetween(18, CONFIG.defense.y + 25, 432, CONFIG.defense.y + 25);
    g.lineStyle(1, 0x5b749d, 0.18);
    g.strokeCircle(CONFIG.player.x, CONFIG.player.y, 44);
    g.strokeCircle(CONFIG.player.x, CONFIG.player.y, 52);
    g.fillStyle(0x7185a4, 0.5);
    for (let lane = 0; lane < CONFIG.defense.lanes; lane++) {
      const x = CONFIG.player.x + (lane - (CONFIG.defense.lanes - 1) / 2) * CONFIG.defense.laneGap;
      g.strokeEllipse(x, CONFIG.defense.y, 42, 14);
      g.strokeEllipse(x, CONFIG.defense.y - CONFIG.defense.rowGap, 42, 14);
    }
    // Hundreds of static star / circle primitives become two cached GPU textures.
    g.generateTexture("background", CONFIG.width, CONFIG.height);
    g.destroy();
    this.add.image(0, 0, "background").setOrigin(0).setDepth(-2);
    this.add
      .text(22, CONFIG.defense.y + 36, "DEFENSE LINE  /  防线", {
        fontFamily: "sans-serif",
        fontSize: "9px",
        color: "#bea773",
      })
      .setOrigin(0, 0);
  }

  update(_time: number, delta: number): void {
    if (!this.ship || !this.halo || !this.overlay) return;
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
    // The small central dot is the real hit box, not the decorative wings.
    this.halo.fillStyle(0xffffff, 0.95);
    this.halo.fillCircle(player.x, player.y, 3);
    if (this.sigil) {
      this.sigil.rotation = this.reducedMotion ? 0 : this.world.elapsed * 0.025;
      this.sigil.setTint(this.world.stage.color);
    }
    this.renderPools();
    this.overlay.clear();
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
        enemy.stunTime > 0
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
      const width = enemy.kind === "boss" ? 84 : 34;
      const y = enemy.y + enemy.radius + 10;
      this.overlay.fillStyle(0x303044, 1);
      this.overlay.fillRect(enemy.x - width / 2, y, width, 3);
      this.overlay.fillStyle(color, 1);
      this.overlay.fillRect(enemy.x - width / 2, y, (width * enemy.hp) / enemy.maxHp, 3);
      if (preparing) {
        this.overlay.lineStyle(3, COLORS.gold, 1);
        this.overlay.beginPath();
        this.overlay.arc(
          enemy.x,
          enemy.y,
          enemy.radius + 8,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * (1 - enemy.preparation / ENEMIES[enemy.kind].preparation),
        );
        this.overlay.strokePath();
      }
      if (enemy.telegraph > 0) {
        this.overlay.lineStyle(2, COLORS.gold, 0.55);
        this.overlay.lineBetween(enemy.x, enemy.y + enemy.radius, player.x, player.y);
        this.overlay.strokeCircle(enemy.x, enemy.y, enemy.radius + 12);
        this.overlay.fillStyle(COLORS.gold, 1);
        this.overlay.fillRect(
          enemy.x - 42,
          y + 7,
          84 * Math.min(1, enemy.interruptDamage / enemy.interruptRequired),
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

  private renderPools(): void {
    const menu = this.world.phase === "Menu";
    for (const kind of ["wisp", "sentinel", "hexer", "boss"] as const) {
      const enemies = this.world.enemies.items.filter(
        (enemy) => enemy.active && enemy.kind === kind,
      );
      this.render(kind, enemies, (image, enemy) => {
        image.setPosition(enemy.x, enemy.y).setScale(kind === "boss" ? 0.9 : 0.8);
        image.rotation = this.reducedMotion
          ? 0
          : kind === "sentinel"
            ? enemy.age * 0.4
            : Math.sin(enemy.age) * 0.06;
        image.setTint(
          enemy.stunTime > 0
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
      "chest",
      this.world.chests.items.filter((item) => item.active),
      (image, item) => {
        image.setPosition(item.x, item.y).setScale(0.9);
      },
    );
    this.render(
      "friendly-shot",
      this.world.shots.items.filter((item) => item.active),
      (image, item) => {
        image.setPosition(item.x, item.y).setScale(0.7).setRotation(Math.atan2(item.vx, -item.vy));
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
        image.setPosition(item.x, item.y).setScale(item.radius / 5);
      },
    );
    this.render(
      "spark",
      this.world.particles.items.filter((item) => item.active),
      (image, item) => {
        image
          .setPosition(item.x, item.y)
          .setScale(0.45)
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
    this.render("menu-wisp", preview, (image, item) => {
      image.setTexture("wisp").setPosition(item.x, item.y).setScale(0.7).setAlpha(0.75);
    });
    this.render("menu-chest", menu ? [{ x: 225, y: 548 }] : [], (image, item) => {
      image.setTexture("chest").setPosition(item.x, item.y).setScale(0.8);
    });
  }

  private render<T>(
    key: string,
    items: T[],
    update: (image: Phaser.GameObjects.Image, item: T) => void,
  ): void {
    let views = this.views.get(key);
    if (!views) {
      views = [];
      this.views.set(key, views);
    }
    for (let index = 0; index < items.length; index++) {
      let view = views[index];
      if (!view) {
        view = this.add
          .image(0, 0, key.startsWith("menu-") ? key.slice(5) : key)
          .setDepth(key === "spark" ? 7 : 3);
        views.push(view);
      }
      view.setVisible(true);
      const item = items[index];
      if (item) update(view, item);
    }
    for (let index = items.length; index < views.length; index++) views[index]?.setVisible(false);
  }
}
