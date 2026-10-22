import { CONFIG } from "./config";
import type { AttackRegion } from "./types";

export const DESKTOP_WIDTH = 1600;

// Choose geometry once at boot; resizing and DPR never rewrite a running battle.
export function arenaWidthForViewport(width: number, height: number): number {
  if (width < 951) return CONFIG.width;
  return Math.max(
    800,
    Math.min(2400, Math.round(((width - 28) / Math.max(400, height - 74)) * CONFIG.height)),
  );
}

export function arenaLayout(width: number = CONFIG.width) {
  if (!Number.isFinite(width) || width < CONFIG.width || width > 2400)
    throw new Error("Invalid arena width");
  const center = width / 2;
  const laneCount =
    width === CONFIG.width ? 4 : Math.max(4, 2 * Math.floor(Math.round((width - 36) / 210) / 2));
  const laneGap = (width - CONFIG.crowd.margin * 2 - 136) / laneCount;
  const lanes = Array.from({ length: laneCount }, (_, index) =>
    index < laneCount / 2
      ? CONFIG.crowd.margin + (index + 0.5) * laneGap
      : CONFIG.crowd.margin + 136 + (index + 0.5) * laneGap,
  );
  const rows = Math.floor((CONFIG.defense.y - CONFIG.crowd.top) / CONFIG.crowd.cellHeight);
  const regionRows = 8;
  const attackRegions: AttackRegion[] = Array.from({ length: laneCount * regionRows }, (_, id) => ({
    id,
    x: ((id % laneCount) * width) / laneCount,
    y: (Math.floor(id / laneCount) * CONFIG.height) / regionRows,
    width: width / laneCount,
    height: CONFIG.height / regionRows,
  }));
  return {
    width,
    height: CONFIG.height,
    player: { x: center, y: CONFIG.player.y },
    laneCount,
    laneGap,
    rangeScale: laneGap / 69.5,
    rows,
    crowdLanes: lanes,
    minionCapacity: laneCount * rows,
    encounterCapacity: laneCount * rows + 1,
    attackRegions,
    baseAttackRegions: attackRegions.filter((region) => region.y >= 600),
  };
}
