import { ENEMIES } from "../../src/data/enemies";
import { CONFIG } from "../../src/game/config";
import type { Enemy, EnemyKind } from "../../src/game/types";
import type { World } from "../../src/game/world";

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
    },
    overrides,
  );
  return entity;
}
