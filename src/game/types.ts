import type { EnemyDefinition } from "../data/enemies";
import type { Stage } from "../data/stages";

export type Phase =
  | "Menu"
  | "Playing"
  | "Paused"
  | "RewardSelection"
  | "StageClear"
  | "Victory"
  | "GameOver";
export type SynergyId =
  | "blast"
  | "barrage"
  | "bastion"
  | "judgment"
  | "might"
  | "blood"
  | "precision"
  | "storm"
  | "frost"
  | "dominion"
  | "giantslayer"
  | "erosion";
export type SynergyTier = 0 | 3 | 6 | 9;
export type EnemyKind = "wisp" | "sentinel" | "hexer" | "tank" | "wizard" | "boss";
export type BossSkill = "guard" | "summon" | "slam";
export type Rarity = "common" | "rare" | "epic";
export type EnemyStage = "Approaching" | "Preparing" | "Attacking";
export type AttackPolicy =
  | { type: "defense" }
  | { type: "region"; y: number }
  | { type: "anywhere" }
  | { type: "zones"; regions: readonly AttackRegion[] };

export interface AttackRegion extends Vec2 {
  id: number;
  width: number;
  height: number;
}

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
  power: number;
  crush: number;
  lifesteal: number;
  regeneration: number;
  recovery: number;
  critChance: number;
  critDamage: number;
  expose: number;
  chain: number;
  splash: number;
  storm: number;
  slow: number;
  frostbite: number;
  frostPulse: number;
  stun: number;
  control: number;
  controlPulse: number;
  overheal: number;
  shieldCapacity: number;
  shieldLeech: number;
  giantSlayer: number;
  giantPower: number;
  giantHunt: number;
  maxHealthDamage: number;
  currentHealthDamage: number;
  erosionPulse: number;
}

export interface Player extends Vec2 {
  hp: number;
  shield: number;
  invulnerable: number;
  cooldown: number;
  poisonTime: number;
  poisonSlowTime: number;
  woundTime: number;
  poisonDamageBonus: number;
  poisonSlowBonus: number;
  stats: Stats;
}

export interface Enemy extends Vec2 {
  definition?: EnemyDefinition;
  encounter?: Stage;
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
  spawnX: number;
  spawnY: number;
  enhanced: boolean;
  age: number;
  shotCooldown: number;
  patternCooldown: number;
  telegraph: number;
  interruptDamage: number;
  interruptRequired: number;
  slow: number;
  slowTime: number;
  stunTime: number;
  receivedHits: number;
  primaryHits: number;
  skillsUsed: number;
  lastSkill: BossSkill | null;
  damageReductionTime: number;
  stars: number;
  damageScale: number;
  fusionTime: number;
  fusionPeers: string;
  tauntRemaining: number;
  skillCooldown: number;
  lastAction: "attack" | "taunt" | "poison" | null;
  formation: boolean;
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
  primary: boolean;
  critical: boolean;
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
  source: "chest" | "supply" | "stage";
}

export interface Card {
  type: "augment";
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  symbol: string;
  synergy: SynergyId;
  offense: boolean;
  maxStacks: number | null;
  eligible: (player: Player) => boolean;
  apply: (player: Player) => void;
  preview: (player: Player) => string;
}

export interface Training extends Omit<Card, "type" | "synergy" | "offense"> {
  type: "training";
}

export interface Blast extends Vec2 {
  active: boolean;
  radius: number;
  life: number;
  maxLife: number;
  color: number;
}
