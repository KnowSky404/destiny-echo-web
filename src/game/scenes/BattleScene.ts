import Phaser from "phaser";
import { CONFIG } from "../config";
import { InputController } from "../input";
import { seededRandom } from "../random";
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
    this.ship = this.add.image(225, CONFIG.playerY, "player").setScale(0.74).setDepth(5);
    this.halo = this.add.graphics().setDepth(4);
    this.overlay = this.add.graphics().setDepth(6);
    this.inputController = new InputController(this.game.canvas, this.world);
    this.game.canvas.setAttribute(
      "aria-label",
      "命运残响战场：使用 WASD 或方向键移动，也可按住并拖动",
    );
    this.game.canvas.setAttribute("role", "img");
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
    g.lineStyle(1, COLORS.gold, 0.22);
    g.lineBetween(18, CONFIG.movement.top, 432, CONFIG.movement.top);
    g.lineStyle(1, 0x5b749d, 0.18);
    g.strokeCircle(225, CONFIG.playerY, 68);
    g.strokeCircle(225, CONFIG.playerY, 82);
    g.lineBetween(225, 632, 225, 795);
    g.fillStyle(0x7185a4, 0.5);
    for (let x = 24; x < 450; x += 18) g.fillCircle(x, CONFIG.movement.top, 0.7);
    // Hundreds of static star / circle primitives become two cached GPU textures.
    g.generateTexture("background", CONFIG.width, CONFIG.height);
    g.destroy();
    this.add.image(0, 0, "background").setOrigin(0).setDepth(-2);
    this.add
      .text(225, CONFIG.movement.top + 13, "移 动 区 域  /  MOVEMENT ZONE", {
        fontFamily: "sans-serif",
        fontSize: "9px",
        color: "#71809d",
      })
      .setOrigin(0.5, 0);
  }

  update(_time: number, delta: number): void {
    if (!this.ship || !this.halo || !this.overlay) return;
    this.world.update(delta / 1000, this.inputController?.frame());
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
    if (this.sigil) this.sigil.rotation = this.reducedMotion ? 0 : this.world.elapsed * 0.025;
    this.renderPools();
    this.overlay.clear();
    const boss = this.world.boss;
    if (boss && boss.telegraph > 0) {
      this.overlay.fillStyle(COLORS.gold, 0.1 + boss.telegraph * 0.1);
      this.overlay.fillRect(boss.targetX - 28, boss.y + 45, 56, 800);
      this.overlay.lineStyle(1, COLORS.gold, 0.7);
      this.overlay.lineBetween(boss.targetX - 28, boss.y + 45, boss.targetX - 28, 800);
      this.overlay.lineBetween(boss.targetX + 28, boss.y + 45, boss.targetX + 28, 800);
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
    for (const kind of ["wisp", "sentinel", "boss"] as const) {
      const enemies = this.world.enemies.items.filter(
        (enemy) => enemy.active && enemy.kind === kind,
      );
      this.render(kind, enemies, (image, enemy) => {
        image.setPosition(enemy.x, enemy.y).setScale(kind === "boss" ? 0.9 : 0.8);
        image.rotation = kind === "sentinel" ? enemy.age * 0.4 : Math.sin(enemy.age) * 0.06;
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
