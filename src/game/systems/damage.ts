import { CONFIG } from "../config";
import type { Player } from "../types";

export function healingMultiplier(player: Player): number {
  return player.poisonTime > 0 ? 1 - CONFIG.endless.poisonHealingReduction : 1;
}

// Fixed card heals share poison's grievous wound penalty with combat healing.
export function healPlayer(player: Player, amount: number): number {
  if (amount <= 0 || player.hp <= 0) return 0;
  const restored = Math.min(amount * healingMultiplier(player), player.stats.maxHp - player.hp);
  player.hp += restored;
  return restored;
}

export function cleansePlayer(player: Player): void {
  player.poisonTime = 0;
  player.poisonSlowTime = 0;
}

export function applyPoison(player: Player): void {
  player.poisonTime = CONFIG.endless.poisonDuration;
}

// Poison is one continuous effect. It consumes shields first without hit immunity
// or per-tick retaliation; only real HP loss refreshes the attack-speed penalty.
export function advancePoison(player: Player, delta: number): number {
  player.poisonSlowTime = Math.max(0, player.poisonSlowTime - delta);
  const duration = Math.min(delta, player.poisonTime);
  player.poisonTime = Math.max(0, player.poisonTime - delta);
  if (player.poisonTime < 1e-9) player.poisonTime = 0;
  if (duration <= 0 || player.hp <= 0) return 0;
  const damage = duration * CONFIG.endless.poisonDamagePerSecond;
  const absorbed = Math.min(player.shield, damage);
  player.shield -= absorbed;
  const loss = Math.min(player.hp, damage - absorbed);
  player.hp -= loss;
  if (loss > 0) player.poisonSlowTime = CONFIG.endless.poisonDuration;
  return absorbed + loss;
}

export function damagePlayer(player: Player, damage: number): number {
  if (player.invulnerable > 0 || damage <= 0 || player.hp <= 0) return 0;
  const absorbed = Math.min(player.shield, damage);
  player.shield -= absorbed;
  const loss = Math.min(player.hp, damage - absorbed);
  player.hp -= loss;
  player.invulnerable = 0.7;
  return loss;
}
