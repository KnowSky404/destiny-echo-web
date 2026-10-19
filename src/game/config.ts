export const CONFIG = {
  width: 450,
  height: 800,
  movement: { left: 20, right: 430, top: 576, bottom: 774 },
  playerY: 736,
  fixedStep: 1 / 120,
  maxFrameDelta: 0.1,
  bossAt: 52,
  deadline: 88,
  chestFirstAt: 5,
  chestInterval: 10,
  chestLastAt: 46,
  limits: { enemies: 32, playerShots: 240, enemyShots: 360, chests: 1, particles: 120 },
} as const;
