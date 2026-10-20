import type { Vec2 } from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
