import type { Player } from "../types";

export function damagePlayer(player: Player, damage: number): number {
  if (player.invulnerable > 0 || damage <= 0 || player.hp <= 0) return 0;
  const absorbed = Math.min(player.shield, damage);
  player.shield -= absorbed;
  const loss = Math.min(player.hp, damage - absorbed);
  player.hp -= loss;
  player.invulnerable = 0.7;
  return loss;
}
