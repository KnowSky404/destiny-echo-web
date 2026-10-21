import { CONFIG } from "./config";
import { synergyTier } from "./synergies";
import type { Player } from "./types";

export function combatStats(player: Player, stacks: ReadonlyMap<string, number>) {
  const barrage = synergyTier(stacks, "barrage");
  const might = synergyTier(stacks, "might");
  const precision = synergyTier(stacks, "precision");
  const blood = synergyTier(stacks, "blood");
  return {
    damage: player.stats.damage * (1 + player.stats.power) * (might >= 3 ? 1.2 : 1),
    interval:
      Math.max(0.08, player.stats.interval * (barrage >= 9 ? 0.75 : barrage >= 3 ? 0.88 : 1)) /
      (player.poisonSlowTime > 0 ? 1 - CONFIG.endless.poisonAttackSlow : 1),
    projectiles: Math.min(6, player.stats.projectiles + (barrage >= 9 ? 1 : 0)),
    secondaryDamage: barrage >= 6 ? 1 : barrage >= 3 ? 0.8 : CONFIG.friendlyShot.secondaryDamage,
    critChance: Math.min(0.85, player.stats.critChance + (precision >= 3 ? 0.1 : 0)),
    critDamage: player.stats.critDamage + (precision >= 6 ? 0.25 : 0) + (precision >= 9 ? 0.5 : 0),
    lifesteal: Math.min(0.5, player.stats.lifesteal + (blood >= 9 ? 0.1 : blood >= 3 ? 0.05 : 0)),
  };
}
