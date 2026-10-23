import { CONFIG } from "./config";
import type { AttackRegion } from "./types";

export const DESKTOP_WIDTH = 1600;

// Preview at boot and choose again on new runs; resize/DPR never rewrite a running battle.
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
  const regionHeight = 100;
  const regionRows = 7;
  const attackRegions: AttackRegion[] = Array.from({ length: laneCount * regionRows }, (_, id) => ({
    id,
    x: ((id % laneCount) * width) / laneCount,
    y: Math.floor(id / laneCount) * regionHeight,
    width: width / laneCount,
    height: regionHeight,
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
    baseAttackRegions: attackRegions.filter((region) => region.y >= 500 && region.y < 700),
  };
}

/** CSS-pixel measurements of a fixed logical arena inside its available display area. */
export function arenaDisplayMetrics(
  arena: ReturnType<typeof arenaLayout>,
  displayWidth: number,
  displayHeight: number,
) {
  if (
    !Number.isFinite(displayWidth) ||
    !Number.isFinite(displayHeight) ||
    displayWidth <= 0 ||
    displayHeight <= 0
  )
    throw new Error("Invalid arena display size");
  const scale = Math.min(displayWidth / arena.width, displayHeight / arena.height);
  return {
    scale,
    widthPx: arena.width * scale,
    heightPx: arena.height * scale,
    laneGapPx: arena.laneGap * scale,
    // A body slot is the authored 68×84 crowd cell, independent of monster radius or DPR.
    cellWidthPx: CONFIG.crowd.cellWidth * scale,
    cellHeightPx: CONFIG.crowd.cellHeight * scale,
    laneCount: arena.laneCount,
    rows: arena.rows,
    minionCapacity: arena.minionCapacity,
    encounterCapacity: arena.encounterCapacity,
  };
}
