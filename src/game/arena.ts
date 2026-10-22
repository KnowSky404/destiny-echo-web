import { CONFIG } from "./config";

export const DESKTOP_WIDTH = 1600;

// Logical sizes are fixed for a run. CSS scaling and DPR never change combat.
export function arenaLayout(width: number = CONFIG.width) {
  if (width !== CONFIG.width && width !== DESKTOP_WIDTH) throw new Error("Invalid arena width");
  const center = width / 2;
  const extra = width - CONFIG.width;
  return {
    width,
    height: CONFIG.height,
    player: { x: center, y: CONFIG.player.y },
    laneGap: CONFIG.defense.laneGap + extra / CONFIG.defense.lanes,
    crowdLanes: [55 + extra / 4, 123 + extra / 4, 327 + extra * 0.75, 395 + extra * 0.75],
  };
}
