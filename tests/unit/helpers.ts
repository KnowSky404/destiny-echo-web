import { ENEMIES } from "../../src/data/enemies";
import { CONFIG } from "../../src/game/config";
import type { Enemy, EnemyKind } from "../../src/game/types";
import { World } from "../../src/game/world";
import { chooseReward, type RunPolicy } from "../policy";

let fixtureId = 1_000_000;

export function tick(world: World, seconds: number): void {
  for (let index = 0; index < Math.round(seconds * 120); index++) world.update(1 / 120);
}

export function enemy(world: World, overrides: Partial<Enemy> = {}): Enemy {
  const kind: EnemyKind = overrides.kind ?? "wisp";
  const data = ENEMIES[kind];
  const entity = world.enemies.acquire();
  if (!entity) throw new Error("Enemy pool exhausted");
  Object.assign(
    entity,
    {
      id: fixtureId++,
      active: true,
      kind,
      x: 57,
      y: -30,
      hp: data.hp,
      maxHp: data.hp,
      radius: data.radius,
      speed: data.speed,
      age: 0,
      shotCooldown: 0,
      patternCooldown: 2.8,
      stage: "Approaching",
      attackPolicy: { ...data.attackPolicy },
      preparation: 0,
      arrived: false,
      slot: 0,
      defenseX: 57,
      defenseY: CONFIG.defense.y,
      telegraph: 0,
      interruptDamage: 0,
      interruptRequired: 0,
      slow: 0,
      slowTime: 0,
      stunTime: 0,
      receivedHits: 0,
      primaryHits: 0,
    },
    overrides,
  );
  return entity;
}

export function naturalRun(seed: number, policy: RunPolicy = "active", endless = false): World {
  const world = new World();
  world.start(seed);
  for (let frame = 0; frame < 120 * 650; frame++) {
    if (endless && world.phase === "Victory") world.continueEndless();
    if (["RewardSelection", "StageClear"].includes(world.phase) && world.reward) {
      const choice = chooseReward(world.reward.choices, world.stacks, world.player.hp, policy);
      if (!choice || !world.chooseCard(choice, world.reward.token))
        throw new Error("No eligible reward");
    }
    if (world.clearedStages >= (endless ? 6 : 4) || world.phase !== "Playing") break;
    if (policy !== "auto" && frame % 60 === 0) {
      const chest = world.chests.items.find((item) => item.active);
      if (chest && !world.boss) world.selectTargetAt(chest);
      else world.clearTarget();
    }
    // Only native run actions: no HP, output, stage, schedule, RNG or clock mutations.
    world.update(CONFIG.fixedStep);
  }
  return world;
}
