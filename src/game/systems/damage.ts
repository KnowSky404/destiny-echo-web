import { CONFIG } from "../config";
import type { Player } from "../types";

export function healingMultiplier(player: Player): number {
  return player.woundTime > 0 ? 1 - CONFIG.endless.woundRecoveryReduction : 1;
}

export function healPlayer(player: Player, amount: number): number {
  if (amount <= 0 || player.hp <= 0) return 0;
  const restored = Math.min(amount * healingMultiplier(player), player.stats.maxHp - player.hp);
  player.hp += restored;
  return restored;
}

// Overheal has already paid the recovery penalty, so conversion pays it once.
export function grantShield(
  player: Player,
  amount: number,
  capacity = Infinity,
  reduced = false,
): number {
  if (amount <= 0 || player.hp <= 0) return 0;
  const restored = Math.max(
    0,
    Math.min(amount * (reduced ? 1 : healingMultiplier(player)), capacity - player.shield),
  );
  player.shield += restored;
  if (player.shield > 0) player.poisonSlowTime = 0;
  return restored;
}

export function applyWounds(player: Player, duration: number): void {
  player.woundTime += Math.max(0, duration);
}

export function cleansePlayer(player: Player): void {
  player.poisonTime = 0;
  player.poisonSlowTime = 0;
  player.woundTime = 0;
  player.poisonDamageBonus = 0;
  player.poisonSlowBonus = 0;
}

export function applyPoison(player: Player, random: () => number = () => 0.5): void {
  if (player.poisonTime > 0) {
    if (random() < 0.5) player.poisonDamageBonus++;
    else player.poisonSlowBonus += 0.01;
  } else {
    player.poisonDamageBonus = 0;
    player.poisonSlowBonus = 0;
  }
  player.poisonTime += CONFIG.endless.poisonDuration;
  applyWounds(player, CONFIG.endless.poisonDuration);
  player.poisonSlowTime = player.shield <= 0 ? player.poisonTime : 0;
}

export function poisonSlow(player: Player): number {
  return player.poisonTime > 0 && player.shield <= 0
    ? Math.min(0.9, CONFIG.endless.poisonAttackSlow + player.poisonSlowBonus)
    : 0;
}

// One continuous status drains shields first, without hit immunity or retaliation.
export function advancePoison(player: Player, delta: number): number {
  const duration = Math.min(delta, player.poisonTime);
  const damage = duration * (CONFIG.endless.poisonDamagePerSecond + player.poisonDamageBonus);
  player.poisonTime = Math.max(0, player.poisonTime - delta);
  player.woundTime = Math.max(0, player.woundTime - delta);
  if (player.poisonTime < 1e-9) player.poisonTime = 0;
  if (player.woundTime < 1e-9) player.woundTime = 0;
  const absorbed = Math.min(player.shield, damage);
  player.shield -= absorbed;
  const loss = Math.min(player.hp, damage - absorbed);
  player.hp -= loss;
  player.poisonSlowTime = poisonSlow(player) > 0 ? player.poisonTime : 0;
  if (player.poisonTime === 0) {
    player.poisonDamageBonus = 0;
    player.poisonSlowBonus = 0;
  }
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
