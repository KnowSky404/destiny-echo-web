import { CONFIG } from "../config";
import { type Random, shuffled } from "../random";
import type { Enemy, Vec2 } from "../types";
import { advanceEnemy } from "./enemy";

// FIT scales the entire 450 x 800 arena, so CSS size and DPR do not change capacity.
// 414 / 68 = 6 columns; reserve the middle two for the 118 px boss silhouette.
// floor((620 - 116) / 84) = 6 rows, leaving entry space above the formation.
const columns = Math.floor((CONFIG.width - CONFIG.crowd.margin * 2) / CONFIG.crowd.cellWidth);
const rows = Math.floor((CONFIG.defense.y - CONFIG.crowd.top) / CONFIG.crowd.cellHeight);
export const CROWD_LANES = Array.from({ length: columns }, (_, lane) => lane)
  .filter((lane) => Math.abs(lane - (columns - 1) / 2) >= CONFIG.crowd.reservedColumns / 2)
  .map((lane) => CONFIG.player.x + (lane - (columns - 1) / 2) * CONFIG.crowd.cellWidth);
export const MINION_CAPACITY = CROWD_LANES.length * rows;
export const ENCOUNTER_CAPACITY = MINION_CAPACITY + 1;

export function crowdSpawn(enemies: readonly Enemy[], random: Random): Vec2 | undefined {
  for (const x of shuffled([...CROWD_LANES], random)) {
    const lane = enemies.filter(
      (enemy) => enemy.active && enemy.kind !== "boss" && enemy.defenseX === x,
    );
    if (lane.length >= rows) continue;
    const rear = Math.min(...lane.map((enemy) => enemy.y));
    const ceiling = Math.min(400, rear - CONFIG.crowd.cellHeight);
    const candidates = [52, 136, 220, 304, 388].filter((y) => y <= ceiling);
    const y = shuffled(candidates, random)[0];
    if (y !== undefined) return { x, y };
  }
  return undefined;
}

export function advanceFormation(
  enemies: readonly Enemy[],
  delta: number,
  wave: number,
  enemyDelta: (enemy: Enemy, delta: number) => number,
): number {
  let arrivals = 0;
  for (const x of CROWD_LANES) {
    const lane = enemies
      .filter((enemy) => enemy.active && enemy.formation && enemy.defenseX === x)
      .sort((a, b) => b.y - a.y || a.id - b.id);
    let ahead = Infinity;
    for (const [row, enemy] of lane.entries()) {
      const destination = CONFIG.defense.y - row * CONFIG.crowd.cellHeight;
      if (enemy.defenseY !== destination) enemy.arrived = false;
      enemy.defenseY = destination;
      enemy.slot = row * CROWD_LANES.length + CROWD_LANES.indexOf(x);
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
  const close = (a: Enemy, b: Enemy) => Math.hypot(a.x - b.x, a.y - b.y) <= CONFIG.fusion.distance;
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
