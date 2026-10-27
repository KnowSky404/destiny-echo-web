import { describe, expect, test } from "bun:test";
import { createStrategy, resolveStrategy } from "../../src/balance-sim/strategies";
import { defaultProfile } from "../../src/data/balance/profile";
import { CONFIG } from "../../src/game/config";
import { World } from "../../src/game/world";
import { enemy, isolateEndless, tick } from "./helpers";

function arena(): World {
  const world = new World(CONFIG.width, defaultProfile());
  world.start(40);
  world.stageIndex = 4;
  isolateEndless(world);
  world.bossSpawned = true;
  world.player.cooldown = 1000;
  return world;
}

function targets(world: World) {
  const exposed = enemy(world, {
    kind: "boss",
    role: "boss",
    x: 80,
    defenseX: 80,
    y: 300,
    hp: 1000000,
    maxHp: 1000000,
    speed: 0,
    arrived: true,
    stage: "Attacking",
    attackPolicy: { type: "anywhere" },
    vulnerableTime: 2,
    patternCooldown: 1000,
    shotCooldown: 1000,
  });
  const preparing = enemy(world, {
    kind: "hexer",
    x: 225,
    defenseX: 225,
    y: 500,
    hp: 1000000,
    maxHp: 1000000,
    speed: 0,
    arrived: true,
    stage: "Preparing",
    preparation: 10,
    shotCooldown: 1000,
  });
  return { exposed, preparing };
}

describe("visible active targeting policy v2", () => {
  test("active policy follows a leader's exposed window instead of an ordinary preparation", () => {
    const world = arena();
    const { exposed, preparing } = targets(world);
    const strategy = createStrategy(resolveStrategy({ name: "build-active" }));
    expect(strategy.target(world)).toBe(true);
    expect(world.manualTargetId).toBe(exposed.id);
    expect(world.manualTargetId).not.toBe(preparing.id);
  });

  test("dangerous leader charges preempt an exposed window and decisions retain the 0.5s throttle", () => {
    const world = arena();
    const { exposed, preparing } = targets(world);
    const danger = enemy(world, {
      kind: "wizard",
      role: "elite",
      x: 370,
      defenseX: 370,
      y: 300,
      hp: 1000000,
      maxHp: 1000000,
      speed: 0,
      arrived: true,
      stage: "Attacking",
      attackPolicy: { type: "anywhere" },
      telegraph: 1,
      castSkill: "ritual",
      interruptRequired: 1000000,
      patternCooldown: 1000,
      shotCooldown: 1000,
    });
    const resolved = resolveStrategy({ name: "build-active" });
    expect(resolved.target.intervalSeconds).toBe(0.5);
    const strategy = createStrategy(resolved);
    expect(strategy.target(world)).toBe(true);
    expect(world.manualTargetId).toBe(danger.id);
    danger.telegraph = 0;
    danger.castSkill = null;
    expect(strategy.target(world)).toBe(false);
    tick(world, 0.49);
    expect(strategy.target(world)).toBe(false);
    expect(world.manualTargetId).toBe(danger.id);
    tick(world, 0.01);
    expect(strategy.target(world)).toBe(true);
    expect(world.manualTargetId).toBe(exposed.id);
    exposed.vulnerableTime = 0;
    tick(world, 0.5);
    expect(strategy.target(world)).toBe(true);
    expect(world.manualTargetId).toBe(preparing.id);
  });

  test("only nonlegacy active policies receive version 2", () => {
    expect(resolveStrategy({ name: "build-active" }).version).toBe("2");
    expect(resolveStrategy({ name: "build-auto", target: { kind: "active" } }).version).toBe("2");
    expect(resolveStrategy({ name: "build-active", target: { kind: "auto" } }).version).toBe("1");
    for (const name of ["random-auto", "build-auto", "legacy"] as const)
      expect(resolveStrategy({ name }).version).toBe("1");
  });

  test("auto still leaves native targeting untouched and legacy still clears a manual boss lock", () => {
    const world = arena();
    const { exposed } = targets(world);
    world.selectTargetAt(exposed);
    const before = world.snapshot();
    const auto = createStrategy(resolveStrategy({ name: "build-auto" }));
    expect(auto.target(world)).toBe(false);
    expect(world.snapshot()).toEqual(before);
    const legacy = createStrategy(resolveStrategy({ name: "legacy" }));
    expect(legacy.target(world)).toBe(true);
    expect(world.manualTargetId).toBeNull();
  });

  test("active target decisions do not consume the independent random reward stream", () => {
    const world = arena();
    targets(world);
    world.reward = { token: 1, source: "chest", choices: ["force", "keen", "haste"] };
    const config = resolveStrategy({ name: "random-auto", seed: 77, target: { kind: "active" } });
    const first = createStrategy(config),
      second = createStrategy(config);
    for (let index = 0; index < 10; index++) {
      first.target(world);
      expect(first.chooseReward(world).choice).toBe(second.chooseReward(world).choice);
      tick(world, 0.5);
    }
  });
});
