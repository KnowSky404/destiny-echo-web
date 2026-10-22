import { arenaLayout } from "../arena";
import { CONFIG } from "../config";
import type { Random } from "../random";
import type { AttackRegion, Enemy, Vec2 } from "../types";
import { advanceEnemy } from "./enemy";

// Each arena has its own lanes; these exports describe the portrait baseline.
const portrait = arenaLayout();
const rows = portrait.rows;
export const CROWD_LANES = portrait.crowdLanes;
export const MINION_CAPACITY = portrait.minionCapacity;
export const ENCOUNTER_CAPACITY = portrait.encounterCapacity;

export function crowdSpawn(
  enemies: readonly Enemy[],
  random: Random,
  lanes: readonly number[] = CROWD_LANES,
  regions?: readonly AttackRegion[],
): Vec2 | undefined {
  const candidates: Vec2[] = [];
  for (const x of lanes) {
    const lane = enemies.filter(
      (enemy) => enemy.active && enemy.kind !== "boss" && enemy.defenseX === x,
    );
    if (lane.length >= rows) continue;
    for (let y = CONFIG.defense.y; y >= 0; y -= CONFIG.crowd.cellHeight) {
      if (
        regions
          ? !regions.some(
              (region) =>
                x >= region.x &&
                x < region.x + region.width &&
                y >= region.y &&
                y < region.y + region.height,
            )
          : y > 400
      )
        continue;
      if (lane.some((enemy) => Math.abs(enemy.y - y) < CONFIG.crowd.cellHeight)) continue;
      // Inserting into any gap must preserve every body's position when the
      // formation assigns its destinations on the next simulation step.
      const ordered = [...lane.map((enemy) => enemy.y), y].sort((a, b) => b - a);
      if (
        ordered.some((position, row) => position > CONFIG.defense.y - row * CONFIG.crowd.cellHeight)
      )
        continue;
      candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return;
  return candidates[Math.floor(random() * candidates.length)];
}

export function advanceFormation(
  enemies: readonly Enemy[],
  delta: number,
  wave: number,
  enemyDelta: (enemy: Enemy, delta: number) => number,
  lanes: readonly number[] = CROWD_LANES,
): number {
  let arrivals = 0;
  for (const x of lanes) {
    const lane = enemies
      .filter((enemy) => enemy.active && enemy.formation && enemy.defenseX === x)
      .sort((a, b) => b.y - a.y || a.id - b.id);
    let ahead = Infinity;
    for (const [row, enemy] of lane.entries()) {
      const destination = CONFIG.defense.y - row * CONFIG.crowd.cellHeight;
      if (enemy.defenseY !== destination) enemy.arrived = false;
      enemy.defenseY = destination;
      enemy.slot = row * lanes.length + lanes.indexOf(x);
      const arrived = advanceEnemy(enemy, enemyDelta(enemy, delta), wave);
      enemy.x = x;
      enemy.y = Math.min(enemy.y, ahead - CONFIG.crowd.cellHeight);
      if (enemy.y < destination) enemy.arrived = false;
      if (arrived && enemy.arrived) arrivals++;
      ahead = enemy.y;
    }
  }
  return arrivals;
}

// Groups must stay together continuously. Absorbed bodies are not kills and
// cannot emit poison, score, healing, explosions or stale-ID pool references.
export function advanceFusion(
  enemies: readonly Enemy[],
  delta: number,
  merged: (enemy: Enemy) => void,
  distance: number = CONFIG.fusion.distance,
): void {
  const claimed = new Set<number>();
  const progressing = new Set<number>();
  const eligible = enemies
    .filter(
      (enemy) =>
        enemy.active &&
        enemy.kind !== "boss" &&
        enemy.stars < CONFIG.fusion.maxStars &&
        enemy.age >= CONFIG.fusion.grace &&
        enemy.stunTime <= 0,
    )
    .sort((a, b) => a.id - b.id);
  const close = (a: Enemy, b: Enemy) => Math.hypot(a.x - b.x, a.y - b.y) <= distance;
  for (const anchor of eligible) {
    if (claimed.has(anchor.id)) continue;
    const peers = eligible.filter(
      (enemy) =>
        enemy !== anchor &&
        !claimed.has(enemy.id) &&
        enemy.kind === anchor.kind &&
        enemy.stars === anchor.stars &&
        close(anchor, enemy),
    );
    let pair: [Enemy, Enemy] | undefined;
    for (let i = 0; i < peers.length && !pair; i++) {
      const a = peers[i];
      const b = peers.slice(i + 1).find((item) => a && close(a, item));
      if (a && b) pair = [a, b];
    }
    if (!pair) continue;
    const group = [anchor, ...pair];
    for (const enemy of group) claimed.add(enemy.id);
    progressing.add(anchor.id);
    const key = group.map((enemy) => enemy.id).join(":");
    anchor.fusionTime = (anchor.fusionPeers === key ? anchor.fusionTime : 0) + delta;
    anchor.fusionPeers = key;
    if (anchor.fusionTime + 1e-9 < CONFIG.fusion.duration) continue;
    anchor.stars++;
    anchor.maxHp = Math.max(...group.map((enemy) => enemy.maxHp)) * CONFIG.fusion.health;
    anchor.hp = anchor.maxHp;
    anchor.damageScale =
      Math.max(...group.map((enemy) => enemy.damageScale)) * CONFIG.fusion.damage;
    anchor.enhanced = group.some((enemy) => enemy.enhanced);
    anchor.fusionTime = 0;
    anchor.fusionPeers = "";
    for (const donor of pair) donor.active = false;
    merged(anchor);
  }
  for (const enemy of enemies) {
    if (!progressing.has(enemy.id)) {
      enemy.fusionTime = 0;
      enemy.fusionPeers = "";
    }
  }
}
