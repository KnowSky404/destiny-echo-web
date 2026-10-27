import { CONFIG } from "./config";
import { synergyTier } from "./synergies";
import { poisonSlow } from "./systems/damage";
import type { Player } from "./types";

export function combatStats(
  player: Player,
  stacks: ReadonlyMap<string, number>,
  intervalFloor = 0.12,
) {
  const barrage = synergyTier(stacks, "barrage");
  const might = synergyTier(stacks, "might");
  const precision = synergyTier(stacks, "precision");
  const blood = synergyTier(stacks, "blood");
  return {
    damage: player.stats.damage * (1 + player.stats.power) * (might >= 3 ? 1.2 : 1),
    interval:
      Math.max(
        intervalFloor,
        player.stats.interval * (barrage >= 9 ? 0.75 : barrage >= 3 ? 0.88 : 1),
      ) /
      (1 - poisonSlow(player)),
    projectiles: Math.min(6, player.stats.projectiles + (barrage >= 9 ? 1 : 0)),
    secondaryDamage: barrage >= 6 ? 1 : barrage >= 3 ? 0.8 : CONFIG.friendlyShot.secondaryDamage,
    critChance: Math.min(0.85, player.stats.critChance + (precision >= 3 ? 0.1 : 0)),
    critDamage: player.stats.critDamage + (precision >= 6 ? 0.25 : 0) + (precision >= 9 ? 0.5 : 0),
    lifesteal:
      CONFIG.lifestealMultiplier *
      Math.min(
        0.5,
        player.stats.lifesteal +
          (blood >= 9 ? 0.1 : blood >= 3 ? 0.05 : 0) +
          (player.shield > 0 ? player.stats.shieldLeech : 0),
      ),
  };
}

export function overhealStats(player: Player, stacks: ReadonlyMap<string, number>) {
  const blood = synergyTier(stacks, "blood");
  return {
    conversion: Math.min(1, player.stats.overheal + (blood >= 9 ? 1 : blood >= 6 ? 0.5 : 0)),
    capacity:
      player.stats.maxHp *
      Math.min(
        1,
        Math.max(player.stats.overheal > 0 ? 0.2 : 0, blood >= 9 ? 0.8 : blood >= 6 ? 0.4 : 0) +
          player.stats.shieldCapacity,
      ),
  };
}
