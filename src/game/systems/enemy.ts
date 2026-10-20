import { ENEMIES } from "../../data/enemies";
import { CONFIG } from "../config";
import type { Enemy } from "../types";

export function attackPermitted(enemy: Enemy): boolean {
  switch (enemy.attackPolicy.type) {
    case "defense":
      return enemy.arrived;
    case "region":
      return enemy.y >= enemy.attackPolicy.y;
    case "anywhere":
      return enemy.y >= 0;
  }
}

export function advanceEnemy(enemy: Enemy, delta: number, wave: number): boolean {
  enemy.age += delta;
  if (enemy.arrived) return false;
  const multiplier = enemy.kind === "boss" ? 1 : 1 + (wave - 1) * 0.05;
  enemy.y = Math.min(enemy.defenseY, enemy.y + enemy.speed * multiplier * delta);
  const sway = enemy.kind === "boss" ? 12 : 16;
  const taper = Math.min(1, Math.max(0, (enemy.defenseY - enemy.y) / 120));
  enemy.x = enemy.defenseX + Math.sin(enemy.age * 1.6) * sway * taper;
  if (enemy.y < enemy.defenseY) return false;
  enemy.x = enemy.defenseX;
  enemy.arrived = true;
  return true;
}

// No external timers: revoking permission resets the preparation and pending special.
export function advanceAttackStage(enemy: Enemy, delta: number): boolean {
  if (!attackPermitted(enemy)) {
    enemy.stage = "Approaching";
    enemy.preparation = 0;
    enemy.telegraph = 0;
    enemy.interruptDamage = 0;
    enemy.shotCooldown = 0;
    return false;
  }
  if (enemy.stage === "Approaching") {
    enemy.stage = "Preparing";
    enemy.preparation = ENEMIES[enemy.kind].preparation;
    return false;
  }
  if (enemy.stage === "Preparing") {
    enemy.preparation = Math.max(0, enemy.preparation - delta);
    if (enemy.preparation > CONFIG.fixedStep / 100) return false;
    enemy.preparation = 0;
    enemy.stage = "Attacking";
    enemy.shotCooldown = 0;
  }
  return true;
}
