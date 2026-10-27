import { describe, expect, test } from "bun:test";
import { ENDLESS_KINDS } from "../../src/data/enemies";
import { CONFIG } from "../../src/game/config";
import { DebugWorld } from "../../src/game/debug/DebugWorld";
import type { AttackRegion, Enemy, EnemyKind } from "../../src/game/types";
import { World } from "../../src/game/world";
import { enemy, enterBossEncounter, tick } from "./helpers";

function inRegions(x: number, y: number, regions: readonly AttackRegion[]): boolean {
  return regions.some(
    (region) =>
      x >= region.x &&
      x <= region.x + region.width &&
      y >= region.y &&
      y <= region.y + region.height,
  );
}

class RecordedWorld extends World {
  readonly admissions: {
    kind: EnemyKind;
    enhanced: boolean;
    x: number;
    y: number;
    inAttackRegion: boolean;
  }[] = [];

  protected override spawnEnemy(kind: EnemyKind, x: number, enhanced = false): Enemy | undefined {
    const spawned = super.spawnEnemy(kind, x, enhanced);
    if (spawned && kind !== "boss")
      this.admissions.push({
        kind,
        enhanced,
        x: spawned.spawnX,
        y: spawned.spawnY,
        inAttackRegion: inRegions(spawned.spawnX, spawned.spawnY, this.attackRegions),
      });
    return spawned;
  }

  admit(kind: EnemyKind = "wisp", enhanced = false): Enemy | undefined {
    return this.spawnEnemy(kind, this.arena.player.x, enhanced);
  }

  restartStage(): void {
    this.resetStage();
  }
}

function endlessWorld(width: number, seed = 30): RecordedWorld {
  const world = new RecordedWorld(width);
  world.start(seed);
  world.stageIndex = 4;
  world.stageSupplies = 3;
  world.player.cooldown = 1000;
  world.player.shield = 1e9;
  return world;
}

function clearMinions(world: World): void {
  for (const item of world.enemies.items) if (item.kind !== "boss") item.active = false;
}

function expectEveryPrefixGuaranteed(world: RecordedWorld): void {
  let inAttackRegion = 0;
  for (const [index, admission] of world.admissions.entries()) {
    if (admission.inAttackRegion) inAttackRegion++;
    expect(inAttackRegion).toBeGreaterThanOrEqual(Math.ceil((index + 1) * 0.3));
    expect(admission.y <= 400 || admission.inAttackRegion).toBe(true);
  }
}

describe("endless attack-region spawn guarantees", () => {
  test.each([450, 1600])(
    "ordinary waves, escorts and enhanced summons share every successful 30 percent prefix: %s",
    (width) => {
      for (const seed of [1, 30, 71]) {
        const world = endlessWorld(width, seed);
        while (world.admissions.length < 18) {
          clearMinions(world);
          world.update(CONFIG.fixedStep);
          expect(world.stageElapsed).toBeLessThan(world.stage.bossAt);
        }
        const ordinary = world.admissions.length;
        expect(world.stageSpawned).toBe(ordinary);

        clearMinions(world);
        enterBossEncounter(world);
        world.update(CONFIG.fixedStep);
        expect(world.boss?.spawnY).toBe(-55);
        expect(world.admissions.length).toBeGreaterThan(ordinary);
        expect(world.stageKindSpawns.boss).toBe(1);
        const escorts = world.admissions.length;

        clearMinions(world);
        enterBossEncounter(world, true);
        world.pendingSummons = world.endlessRules.summonCount;
        world.update(CONFIG.fixedStep);
        expect(world.pendingSummons).toBe(0);
        expect(world.admissions.slice(escorts)).toHaveLength(world.endlessRules.summonCount);
        expect(world.admissions.slice(escorts).every((item) => item.enhanced)).toBe(true);

        clearMinions(world);
        tick(world, 5 + CONFIG.fixedStep);
        expect(world.admissions.length).toBeGreaterThan(escorts + world.endlessRules.summonCount);
        expectEveryPrefixGuaranteed(world);
        const counts = ENDLESS_KINDS.map((kind) => world.stageKindSpawns[kind]);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      }
    },
  );

  test.each([450, 1600])(
    "a full required region defers ordinary and summoned admissions until space is available: %s",
    (width) => {
      const world = endlessWorld(width);
      const control = endlessWorld(width);
      const region = world.attackRegions.find((item) => item.y === 500);
      const lane = world.arena.crowdLanes.find(
        (x) => region && x >= region.x && x < region.x + region.width,
      );
      if (!region || lane === undefined) throw new Error("Missing initial attack lane");
      world.attackRegions.splice(0, world.attackRegions.length, region);
      const blocker = enemy(world, {
        x: lane,
        defenseX: lane,
        y: 550,
        speed: 0,
        slot: world.arena.minionCapacity - 1,
      });
      tick(world, 0.81);
      tick(control, 0.81);
      expect(control.admissions).toHaveLength(1);
      expect(world.admissions).toHaveLength(0);
      expect(world.stageSpawned).toBe(0);
      expect(Object.values(world.stageKindSpawns).every((count) => count === 0)).toBe(true);

      world.bossSpawned = true;
      enemy(world, {
        kind: "boss",
        x: world.arena.player.x,
        defenseX: world.arena.player.x,
        y: 100,
        speed: 0,
      });
      enterBossEncounter(world, true);
      world.pendingSummons = world.endlessRules.summonCount;
      tick(world, 0.1);
      expect(world.pendingSummons).toBe(world.endlessRules.summonCount);
      expect(world.admissions).toHaveLength(0);
      expect(world.stageSpawned).toBe(0);
      expect(Object.values(world.stageKindSpawns).every((count) => count === 0)).toBe(true);

      blocker.active = false;
      world.update(CONFIG.fixedStep);
      expect(world.admissions.length).toBeGreaterThan(0);
      expect(world.admissions[0]?.kind).toBe(control.admissions[0]?.kind);
      expect(world.pendingSummons).toBeGreaterThan(0);
      expect(world.pendingSummons).toBeLessThan(world.endlessRules.summonCount);
      expectEveryPrefixGuaranteed(world);
      for (
        let attempt = 0;
        attempt < world.endlessRules.summonCount && world.pendingSummons > 0;
        attempt++
      ) {
        clearMinions(world);
        world.update(CONFIG.fixedStep);
      }
      expect(world.pendingSummons).toBe(0);
      expect(world.admissions).toHaveLength(world.endlessRules.summonCount);
      expect(world.stageSpawned).toBe(0);
      expectEveryPrefixGuaranteed(world);
      const counts = ENDLESS_KINDS.map((kind) => world.stageKindSpawns[kind]);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    },
  );

  test.each([450, 1600])(
    "stage and run restarts renew the first admission guarantee: %s",
    (width) => {
      const world = endlessWorld(width);
      expect(world.admit()).toBeDefined();
      expect(world.admissions.at(-1)?.inAttackRegion).toBe(true);
      world.restartStage();
      expect(world.admit()).toBeDefined();
      expect(world.admissions.at(-1)?.inAttackRegion).toBe(true);
      world.pause();
      expect(world.start(30)).toBe(true);
      world.stageIndex = 4;
      expect(world.admit()).toBeDefined();
      expect(world.admissions.at(-1)?.inAttackRegion).toBe(true);
      expect(world.stageKindSpawns.wisp).toBe(1);
    },
  );

  test.each([450, 1600])(
    "debug retained restart and entry restore renew the guarantee: %s",
    (width) => {
      const world = new DebugWorld(width);
      world.start(30);
      world.execute({ type: "jump", stage: 5, fresh: false });
      for (const restoreEntry of [false, true, false]) {
        world.execute({ type: "spawn", kind: "wisp", count: 1 });
        const spawned = world.enemies.items.find((item) => item.active);
        if (!spawned) throw new Error("Missing debug admission");
        expect(inRegions(spawned.spawnX, spawned.spawnY, world.attackRegions)).toBe(true);
        expect(world.stageKindSpawns.wisp).toBe(1);
        world.execute({ type: "restart", restoreEntry });
        expect(world.enemies.items.some((item) => item.active)).toBe(false);
        expect(Object.values(world.stageKindSpawns).every((count) => count === 0)).toBe(true);
      }
    },
  );

  test.each([450, 1600])(
    "ordinary random births inside expanded regions count toward the guarantee: %s",
    (width) => {
      for (const seed of [1, 30, 71]) {
        const world = endlessWorld(width, seed);
        world.attackRegions.splice(0, world.attackRegions.length, ...world.arena.attackRegions);
        expect(world.admit()).toBeDefined();
        for (let index = 1; index < 24; index++) {
          clearMinions(world);
          const spawned = world.admit();
          expect(spawned).toBeDefined();
          // Every upper-half birth is already inside the fully expanded field,
          // so later admissions keep their ordinary random-position policy.
          expect(spawned?.spawnY).toBeLessThanOrEqual(400);
        }
        expect(world.admissions.every((item) => item.inAttackRegion)).toBe(true);
        expectEveryPrefixGuaranteed(world);
      }
    },
  );

  test.each([450, 1600])(
    "seeded ordinary and enhanced spawn positions remain reproducible: %s",
    (width) => {
      const a = endlessWorld(width, 1001);
      const b = endlessWorld(width, 1001);
      for (let index = 0; index < 90; index++) {
        for (const world of [a, b]) {
          clearMinions(world);
          expect(
            world.admit(ENDLESS_KINDS[index % ENDLESS_KINDS.length], index % 4 === 0),
          ).toBeDefined();
        }
      }
      expect(a.admissions).toEqual(b.admissions);
      expectEveryPrefixGuaranteed(a);
      expect(
        new Set(a.admissions.filter((item) => item.y <= 400).map((item) => item.y)).size,
      ).toBeGreaterThan(2);
      expect(
        new Set(a.admissions.filter((item) => item.inAttackRegion).map((item) => item.y)).size,
      ).toBeGreaterThan(1);
    },
  );
});
