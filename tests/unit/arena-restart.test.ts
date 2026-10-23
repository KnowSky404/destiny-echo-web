import { describe, expect, test } from "bun:test";
import { defaultProfile, resolvedStage } from "../../src/data/balance/profile";
import { DebugWorld } from "../../src/game/debug/DebugWorld";
import { World } from "../../src/game/world";
import { tick } from "./helpers";

describe("new-run arena selection", () => {
  test("a new width resets player, attack regions, cached stage budgets and real spawn positions", () => {
    const profile = defaultProfile();
    const world = new World(450, profile);
    const portraitStage = world.stage;
    expect(world.start(3, 1600)).toBe(true);
    expect(world.arena.laneCount).toBe(6);
    expect(world.player.x).toBe(800);
    expect(world.player.stats.damage).toBe(18);
    expect(world.attackRegions).toEqual(world.arena.baseAttackRegions);
    expect(world.attackRegions).toHaveLength(12);
    expect(world.stage).toEqual(resolvedStage(profile, 0, 1600));
    expect(world.stage).not.toEqual(portraitStage);
    tick(world, 4);
    expect(world.enemies.items.some((enemy) => enemy.active && enemy.x > 800)).toBe(true);

    world.pause();
    expect(world.start(3, 450)).toBe(true);
    expect(world.player.x).toBe(225);
    expect(world.player.stats.damage).toBe(12);
    expect(world.attackRegions).toEqual(world.arena.baseAttackRegions);
    expect(world.attackRegions).toHaveLength(8);
    expect(world.stage).toEqual(portraitStage);
    expect(world.enemies.items.some((enemy) => enemy.active)).toBe(false);
    tick(world, 4);
    const minions = world.enemies.items.filter((enemy) => enemy.active);
    expect(minions.length).toBeGreaterThan(0);
    expect(minions.every((enemy) => enemy.x >= 0 && enemy.x <= 450)).toBe(true);
    expect(world.profile).toEqual(profile);
  });

  test.each(["Playing", "RewardSelection", "StageClear"] as const)(
    "rejected starts preserve the entire %s run and its geometry",
    (phase) => {
      const world = new World(450, defaultProfile());
      world.start(17);
      tick(world, 2);
      if (phase !== "Playing") world.state.transition(phase);
      const arena = world.arena;
      const before = world.snapshot();
      expect(world.start(99, 1600)).toBe(false);
      expect(world.start(99, Number.NaN)).toBe(false);
      expect(world.arena).toBe(arena);
      expect(world.snapshot()).toEqual(before);
    },
  );

  test.each([0, 449, 2401, Number.NaN, Number.POSITIVE_INFINITY])(
    "an invalid new width cannot change phase or erase progress: %s",
    (width) => {
      const world = new World(1600, defaultProfile());
      for (const phase of ["Menu", "Paused"] as const) {
        if (phase === "Paused") {
          world.start(17);
          tick(world, 2);
          world.pause();
        }
        const before = world.snapshot();
        expect(() => world.start(99, width)).toThrow("Invalid arena width");
        expect(world.snapshot()).toEqual(before);
      }
    },
  );

  test("default restarts and continuing Endless retain the selected geometry", () => {
    const world = new World(450, defaultProfile());
    world.start(17, 1600);
    const arena = world.arena;
    world.pause();
    expect(world.start(18)).toBe(true);
    expect(world.arena).toBe(arena);
    world.stageIndex = 3;
    world.clearedStages = 4;
    world.stacks.set("force", 2);
    world.score = 1234;
    world.state.transition("Victory");
    expect(world.continueEndless()).toBe(true);
    expect(world.arena).toBe(arena);
    expect(world.player.x).toBe(800);
    expect(world.stacks.get("force")).toBe(2);
    expect(world.score).toBe(1234);
    expect(world.stageIndex).toBe(4);
  });

  test("PRE geometry changes retain the active profile and refresh the replay checkpoint", () => {
    const profile = defaultProfile();
    profile.payload.player.stats.damage = 20;
    const world = new DebugWorld(450, profile);
    world.start(17);
    world.execute({ type: "jump", stage: 3, fresh: false });
    expect(world.start(undefined, 1600)).toBe(true);
    expect(world.seed).toBeGreaterThanOrEqual(0);
    expect(world.seed).toBeLessThanOrEqual(0xffffffff);
    expect(world.player.stats.damage).toBe(30);
    expect(world.stageIndex).toBe(0);
    expect(world.stage).toEqual(resolvedStage(profile, 0, 1600));
    expect(world.profile).toEqual(profile);
    world.execute({ type: "jump", stage: 2, fresh: false });
    world.player.hp = 1;
    world.execute({ type: "restart", restoreEntry: true });
    expect(world.arena.width).toBe(1600);
    expect(world.player.x).toBe(800);
    expect(world.player.stats.damage).toBe(30);
    expect(world.player.hp).toBe(profile.payload.player.hp);
    expect(world.stageIndex).toBe(1);
  });
});
