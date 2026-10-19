export type Phase = "Menu" | "Playing" | "Paused" | "RewardSelection" | "Victory" | "GameOver";
export type EnemyKind = "wisp" | "sentinel" | "boss";
export type Rarity = "common" | "rare";

export interface Vec2 {
  x: number;
  y: number;
}

export interface InputFrame {
  x: number;
  y: number;
  target?: Vec2;
}

export interface Stats {
  damage: number;
  interval: number;
  projectiles: number;
  piercing: number;
  maxHp: number;
  speed: number;
}

export interface Player extends Vec2 {
  hp: number;
  shield: number;
  invulnerable: number;
  cooldown: number;
  stats: Stats;
}

export interface Enemy extends Vec2 {
  id: number;
  active: boolean;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  age: number;
  shotCooldown: number;
  patternCooldown: number;
  originX: number;
  telegraph: number;
  targetX: number;
}

export interface Projectile extends Vec2 {
  id: number;
  active: boolean;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  hitsLeft: number;
  hitIds: Set<number>;
}

export interface Chest extends Vec2 {
  id: number;
  active: boolean;
  hp: number;
  maxHp: number;
  radius: number;
  age: number;
}

export interface Particle extends Vec2 {
  active: boolean;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
}

export interface Reward {
  token: number;
  choices: string[];
}

export interface Card {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  symbol: string;
  maxStacks: number | null;
  eligible: (player: Player) => boolean;
  apply: (player: Player) => void;
  preview: (player: Player) => string;
}
