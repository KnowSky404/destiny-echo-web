import { CONFIG } from "../config";
import type { InputFrame, Player, Vec2 } from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function movePlayer(player: Player, input: InputFrame, delta: number): void {
  let x = input.x;
  let y = input.y;
  if (input.target) {
    x = input.target.x - player.x;
    y = input.target.y - player.y;
  }
  const length = Math.hypot(x, y);
  if (length > 0) {
    const distance = player.stats.speed * delta;
    const scale = input.target ? Math.min(distance / length, 1) : distance / Math.max(length, 1);
    player.x += x * scale;
    player.y += y * scale;
  }
  const bounds = CONFIG.movement;
  player.x = clamp(player.x, bounds.left, bounds.right);
  player.y = clamp(player.y, bounds.top, bounds.bottom);
}

export function segmentHitsCircle(from: Vec2, to: Vec2, center: Vec2, radius: number): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distanceSquared = dx * dx + dy * dy;
  const along = distanceSquared
    ? clamp(((center.x - from.x) * dx + (center.y - from.y) * dy) / distanceSquared, 0, 1)
    : 0;
  return (
    (from.x + along * dx - center.x) ** 2 + (from.y + along * dy - center.y) ** 2 <= radius ** 2
  );
}
