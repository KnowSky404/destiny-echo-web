export type Phase =
  | "Menu"
  | "Playing"
  | "Paused"
  | "RewardSelection"
  | "StageClear"
  | "Victory"
  | "GameOver";
export type SynergyId = "blast" | "barrage" | "bastion" | "judgment";
export type EnemyKind = "wisp" | "sentinel" | "boss";
export type Rarity = "common" | "rare";
export type EnemyStage = "Approaching" | "Preparing" | "Attacking";
export type AttackPolicy =
  | { type: "defense" }
  | { type: "region"; y: number }
  | { type: "anywhere" };

export interface Vec2 {
  x: number;
  y: number;
}

export interface Stats {
  damage: number;
  interval: number;
  projectiles: number;
  piercing: number;
  maxHp: number;
  execution: number;
  fuse: number;
  bloodpact: number;
  thorns: number;
  focus: number;
  harvest: number;
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
  stage: EnemyStage;
  attackPolicy: AttackPolicy;
  preparation: number;
  arrived: boolean;
  slot: number;
  defenseX: number;
  defenseY: number;
  age: number;
  shotCooldown: number;
  patternCooldown: number;
  telegraph: number;
  interruptDamage: number;
  interruptRequired: number;
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
  targetId: number | null;
  lifetime: number;
}

export interface Chest extends Vec2 {
  id: number;
  active: boolean;
  hp: number;
  maxHp: number;
  radius: number;
  age: number;
}

export type Target = Enemy | Chest;

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
  source: "chest" | "stage";
}

export interface Card {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  symbol: string;
  synergy: SynergyId;
  maxStacks: number | null;
  eligible: (player: Player) => boolean;
  apply: (player: Player) => void;
  preview: (player: Player) => string;
}

export interface Blast extends Vec2 {
  active: boolean;
  radius: number;
  life: number;
  maxLife: number;
  color: number;
}
