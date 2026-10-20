export const CONFIG = {
  width: 450,
  height: 800,
  player: { x: 225, y: 736 },
  defense: { y: 620, dangerY: 500, lanes: 7, laneGap: 56, rowGap: 54, rows: 2 },
  friendlyShot: { speed: 620, turnRate: 10, lifetime: 3, secondaryDamage: 0.6 },
  fixedStep: 1 / 120,
  maxFrameDelta: 0.1,
  chestFirstAt: 5,
  chestInterval: 10,
  chestLastAt: 46,
  limits: { enemies: 14, playerShots: 240, enemyShots: 360, chests: 1, particles: 120, blasts: 24 },
} as const;
