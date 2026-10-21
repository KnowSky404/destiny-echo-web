import { CONFIG } from "../config";
import type { Enemy, Target } from "../types";
import { attackPermitted } from "./enemy";

export function isEnemy(target: Target): target is Enemy {
  return "kind" in target;
}

export function isTargetable(target: Target): boolean {
  return (
    target.active && target.hp > 0 && target.y + target.radius >= 0 && target.y < CONFIG.height
  );
}

export function targetPriority(target: Target): number {
  if (!isEnemy(target)) return 2;
  if (target.kind === "boss" || target.stage !== "Approaching") return 0;
  return target.y >= CONFIG.defense.dangerY ? 1 : 3;
}

export function rankedTargets(targets: Target[]): Target[] {
  return targets
    .filter(isTargetable)
    .sort((a, b) => targetPriority(a) - targetPriority(b) || b.y - a.y || a.id - b.id);
}

export function tauntedTargets(targets: Target[], endless = false, sanctuary = false): Target[] {
  const living = targets.filter(isTargetable);
  // Stopped enemies cannot force a lock; saved manual preferences are usable again.
  if (sanctuary) return living;
  if (endless) {
    const threats = living.filter((target) => isEnemy(target) && attackPermitted(target));
    if (threats.length > 0) return threats;
  }
  const tanks = living.filter((target) => isEnemy(target) && target.kind === "tank");
  return tanks.length > 0 ? tanks : living;
}

// Keep a living lock within a priority band. Only a higher threat preempts it.
export function chooseTarget(
  targets: Target[],
  currentId: number | null,
  manualId: number | null,
  excluded?: ReadonlySet<number>,
  endless = false,
  sanctuary = false,
): Target | undefined {
  const ranked = rankedTargets(tauntedTargets(targets, endless, sanctuary)).filter(
    (target) => !excluded?.has(target.id),
  );
  const manual = ranked.find((target) => target.id === manualId);
  if (manual) return manual;
  const current = ranked.find((target) => target.id === currentId);
  const best = ranked[0];
  return current && best && targetPriority(current) <= targetPriority(best) ? current : best;
}
