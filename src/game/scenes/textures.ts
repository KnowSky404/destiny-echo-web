import Phaser from "phaser";

export const COLORS = { blue: 0x91dbea, violet: 0xa795ed, gold: 0xdec28a, pink: 0xe57d98 };
// Rasterize the original vector drawings at 2x; display sizes stay in world units.
export const TEXTURE_SCALE = 2;

export function createTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const polygon = (points: { x: number; y: number }[]) => {
    const vectors = points.map((point) => new Phaser.Math.Vector2(point.x, point.y));
    g.fillPoints(vectors, true);
    g.strokePoints(vectors, true);
  };
  const texture = (key: string, width: number, height: number, draw: () => void) => {
    g.clear();
    g.scaleCanvas(TEXTURE_SCALE, TEXTURE_SCALE);
    draw();
    g.generateTexture(key, width * TEXTURE_SCALE, height * TEXTURE_SCALE);
  };
  texture("player", 64, 72, () => {
    g.fillStyle(0x111c35, 1);
    g.lineStyle(1.5, COLORS.blue, 1);
    g.fillTriangle(32, 4, 12, 56, 32, 46);
    g.strokeTriangle(32, 4, 12, 56, 32, 46);
    g.fillTriangle(32, 4, 52, 56, 32, 46);
    g.strokeTriangle(32, 4, 52, 56, 32, 46);
    g.fillStyle(0x486baf, 0.8);
    g.fillTriangle(10, 35, 3, 59, 24, 49);
    g.strokeTriangle(10, 35, 3, 59, 24, 49);
    g.fillTriangle(54, 35, 61, 59, 40, 49);
    g.strokeTriangle(54, 35, 61, 59, 40, 49);
    g.fillStyle(0xe5faff, 1);
    g.fillTriangle(32, 23, 26, 41, 38, 41);
    g.lineStyle(1, COLORS.blue, 0.45);
    g.strokeCircle(32, 38, 25);
    g.fillStyle(COLORS.blue, 0.5);
    g.fillTriangle(27, 52, 32, 70, 37, 52);
  });
  texture("hexer", 56, 60, () => {
    g.fillStyle(0x172839, 0.95);
    g.lineStyle(1.5, 0x9ce2ef, 1);
    polygon([
      { x: 28, y: 4 },
      { x: 46, y: 17 },
      { x: 42, y: 47 },
      { x: 28, y: 57 },
      { x: 14, y: 47 },
      { x: 10, y: 17 },
    ]);
    g.strokeCircle(28, 28, 17);
    g.fillStyle(0x9ce2ef, 1);
    g.fillCircle(28, 28, 4);
    g.lineBetween(4, 28, 17, 28);
    g.lineBetween(39, 28, 52, 28);
  });
  texture("wisp", 48, 56, () => {
    g.fillStyle(0x292448, 0.9);
    g.lineStyle(1.4, COLORS.violet, 1);
    polygon([
      { x: 24, y: 3 },
      { x: 39, y: 28 },
      { x: 24, y: 53 },
      { x: 9, y: 28 },
    ]);
    g.lineStyle(1, 0xe0d7ff, 1);
    g.strokeTriangle(24, 10, 17, 32, 31, 32);
    g.lineBetween(24, 10, 24, 44);
    g.fillStyle(0xf0e9ff, 1);
    g.fillCircle(24, 27, 3);
  });
  texture("sentinel", 64, 64, () => {
    g.fillStyle(0x231c39, 1);
    g.lineStyle(1.5, COLORS.pink, 0.9);
    g.fillCircle(32, 32, 19);
    g.strokeCircle(32, 32, 23);
    g.strokeTriangle(32, 3, 57, 47, 7, 47);
    g.lineStyle(1, COLORS.violet, 1);
    g.strokeTriangle(32, 61, 7, 17, 57, 17);
    g.fillStyle(COLORS.pink, 1);
    g.fillCircle(32, 32, 6);
    g.fillStyle(0xffe4ee, 1);
    g.fillCircle(32, 32, 2.5);
  });
  texture("tank", 64, 68, () => {
    g.fillStyle(0x30251a, 1);
    g.lineStyle(2, 0xf1b464, 1);
    polygon([
      { x: 32, y: 4 },
      { x: 56, y: 14 },
      { x: 52, y: 45 },
      { x: 32, y: 63 },
      { x: 12, y: 45 },
      { x: 8, y: 14 },
    ]);
    g.strokeCircle(32, 30, 15);
    g.lineBetween(32, 18, 32, 34);
    g.fillStyle(0xffdf9c, 1);
    g.fillCircle(32, 42, 3);
  });
  texture("wizard", 60, 68, () => {
    g.fillStyle(0x1b2c27, 1);
    g.lineStyle(1.5, 0xb6e7a4, 1);
    polygon([
      { x: 30, y: 3 },
      { x: 49, y: 28 },
      { x: 42, y: 34 },
      { x: 51, y: 60 },
      { x: 9, y: 60 },
      { x: 18, y: 34 },
      { x: 11, y: 28 },
    ]);
    g.strokeCircle(30, 39, 11);
    g.fillStyle(0xb6e7a4, 1);
    g.fillCircle(30, 39, 4);
    g.lineBetween(6, 20, 6, 56);
    g.strokeCircle(6, 17, 4);
  });
  texture("chest", 72, 64, () => {
    g.fillStyle(0x2d261d, 1);
    g.lineStyle(1.5, COLORS.gold, 1);
    const points = [
      { x: 8, y: 20 },
      { x: 20, y: 9 },
      { x: 54, y: 9 },
      { x: 65, y: 20 },
      { x: 65, y: 52 },
      { x: 8, y: 52 },
    ];
    polygon(points);
    g.lineBetween(8, 28, 65, 28);
    g.lineBetween(20, 9, 20, 52);
    g.lineBetween(54, 9, 54, 52);
    g.fillStyle(0x121523, 1);
    g.fillTriangle(36, 23, 27, 37, 45, 37);
    g.strokeTriangle(36, 23, 27, 37, 45, 37);
    g.strokeTriangle(36, 47, 27, 33, 45, 33);
    g.fillStyle(COLORS.gold, 1);
    g.fillCircle(36, 35, 3);
  });
  texture("boss", 144, 144, () => {
    g.fillStyle(0x171525, 0.95);
    g.fillCircle(72, 72, 56);
    g.lineStyle(1.5, COLORS.gold, 0.8);
    g.strokeCircle(72, 72, 57);
    g.lineStyle(1, COLORS.violet, 0.9);
    g.strokeCircle(72, 72, 65);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.lineBetween(
        72 + Math.cos(a) * 55,
        72 + Math.sin(a) * 55,
        72 + Math.cos(a) * 70,
        72 + Math.sin(a) * 70,
      );
    }
    g.fillStyle(0x483469, 1);
    g.lineStyle(2, COLORS.violet, 1);
    const cup = [
      { x: 44, y: 44 },
      { x: 100, y: 44 },
      { x: 94, y: 72 },
      { x: 77, y: 83 },
      { x: 77, y: 99 },
      { x: 92, y: 106 },
      { x: 52, y: 106 },
      { x: 67, y: 99 },
      { x: 67, y: 83 },
      { x: 50, y: 72 },
    ];
    polygon(cup);
    g.lineStyle(1, COLORS.gold, 1);
    g.lineBetween(50, 50, 94, 50);
    g.fillStyle(0xf3e3ac, 1);
    g.fillTriangle(72, 50, 62, 64, 82, 64);
    g.fillTriangle(72, 78, 62, 64, 82, 64);
  });
  texture("friendly-shot", 16, 32, () => {
    g.fillStyle(COLORS.blue, 0.2);
    g.fillEllipse(8, 16, 12, 28);
    g.fillStyle(COLORS.blue, 0.8);
    g.fillEllipse(8, 16, 5, 19);
    g.fillStyle(0xefffff, 1);
    g.fillEllipse(8, 13, 2, 11);
  });
  texture("hostile-shot", 20, 20, () => {
    g.fillStyle(COLORS.pink, 0.12);
    g.fillCircle(10, 10, 10);
    g.lineStyle(1.2, COLORS.pink, 1);
    g.strokeCircle(10, 10, 5);
    g.fillStyle(0xffd5df, 1);
    g.fillCircle(10, 10, 3);
  });
  texture("spark", 8, 8, () => {
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(4, 0, 8, 4, 4, 8);
    g.fillTriangle(4, 0, 0, 4, 4, 8);
  });
  g.destroy();
}
