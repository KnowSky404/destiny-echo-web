import { describe, expect, test } from "bun:test";
import { officialProfile } from "../../src/data/balance/profile";
import { CONFIG } from "../../src/game/config";
import { DebugWorld } from "../../src/game/debug/DebugWorld";
import type { WorldObservation } from "../../src/game/observation";
import { World } from "../../src/game/world";
import { enemy, hit, isolateEndless, tick } from "./helpers";

// Isolated mechanics fixtures only: seed 3 is an existing unit-test seed.
// No runNatural, reserved input, natural policy, matrix or baseline sampling.
class RecoveryWorld extends World {
  resetCurrentStage(): void {
    this.resetStage();
    if (this.endless) isolateEndless(this);
    this.bossSpawned = true;
    this.player.cooldown = 1000;
  }
}
function fixture(depth: number | "campaign" = 7, events: WorldObservation[] = []) {
  const world = new RecoveryWorld(CONFIG.width, officialProfile(), (event) => events.push(event));
  world.start(3);
  world.stageIndex = depth === "campaign" ? 0 : depth + 3;
  world.resetCurrentStage();
  world.player.shield = 0;
  return world;
}
function heal(world: World, amount: number, source = "regeneration") {
  const action = Reflect.get(world, "heal");
  if (typeof action !== "function") throw Error("Missing real World heal path");
  Reflect.apply(action, world, [amount, source]);
}
function shield(world: World, amount: number, capacity = Infinity, reduced = false) {
  const action = Reflect.get(world, "restoreShield");
  if (typeof action !== "function") throw Error("Missing real World combat shield path");
  return Reflect.apply(action, world, [amount, capacity, reduced, "direct_combat"]);
}
function available(world: World) {
  const budget = world.combatRecoveryAllowance;
  if (!budget) throw Error("Expected active actual recovery allowance");
  return budget.available;
}
function claim(world: World, id: string, token: number, source: "chest" | "stage") {
  expect(world.state.transition(source === "stage" ? "StageClear" : "RewardSelection")).toBe(true);
  world.reward = { token, source, choices: [id] };
  expect(world.chooseCard(id, token)).toBe(true);
}

describe("isolated V4 actual HP plus combat shield recovery", () => {
  test("a real controlled kill shares HP harvest and Dominion shield, with HP first", () => {
    const events: WorldObservation[] = [];
    const world = fixture(7, events);
    world.player.hp = 50;
    world.player.stats.harvest = 0.3;
    world.stacks.set("impact", 4);
    world.stacks.set("suppression", 4);
    world.stacks.set("edict", 1);
    const target = enemy(world, {
      x: 225,
      y: 400,
      defenseX: 225,
      speed: 0,
      hp: 1,
      maxHp: 1,
      stunTime: 1,
      shotCooldown: 1000,
    });
    hit(world, target, 10);
    expect(target.active).toBe(false);
    expect(world.player.hp).toBeCloseTo(50.6, 10);
    expect(world.player.shield).toBeCloseTo(0.4, 10);
    expect(world.healingDone).toBeCloseTo(0.6, 10);
    expect(world.shieldRestored).toBeCloseTo(0.4, 10);
    expect(available(world)).toBeCloseTo(0, 10);
    const gains = events.filter((event) => event.type === "heal" || event.type === "shield");
    expect(
      gains.filter((event) => event.source === "harvest").map((event) => event.amount),
    ).toEqual([0.6]);
    expect(gains.find((event) => event.source === "dominion_kill")?.amount).toBeCloseTo(0.4, 10);
    expect(gains.reduce((sum, event) => sum + (event.amount ?? 0), 0)).toBeCloseTo(1, 10);
  });

  test("natural fixed-step regeneration and Bastion generation spend the same stored quarter", () => {
    const events: WorldObservation[] = [];
    const world = fixture(7, events);
    world.player.hp = 99.5;
    world.player.stats.regeneration = 1;
    world.player.stats.overheal = 1;
    world.player.stats.shieldCapacity = 1;
    world.stacks.set("ward", 9);
    tick(world, 3);
    expect(world.player.hp).toBe(100);
    expect(world.healingDone).toBeCloseTo(0.5, 9);
    const pulse = events.filter((event) => event.type === "shield" && event.source === "bastion");
    expect(pulse).toHaveLength(1);
    expect(pulse[0]?.amount).toBeCloseTo(1 - 1 / 120, 9);
    expect(world.shieldRestored).toBeCloseTo(2.5 + 1 - 1 / 120, 9);
    expect(world.player.shield).toBeCloseTo(world.shieldRestored, 10);
    expect(available(world)).toBeCloseTo(0, 9);
  });

  test("recovery and wounds change actual gains before the shared allowance is charged", () => {
    const world = fixture();
    world.player.hp = 50;
    world.player.stats.recovery = 1;
    world.player.woundTime = 5;
    heal(world, 1); // 1 * 2 * 0.1 = 0.2 HP, not 1 or 2 allowance.
    expect(world.player.hp).toBeCloseTo(50.2, 10);
    expect(available(world)).toBeCloseTo(0.8, 10);
    expect(shield(world, 1)).toBeCloseTo(0.1, 10);
    expect(available(world)).toBeCloseTo(0.7, 10);
    heal(world, 10);
    expect(world.player.hp).toBeCloseTo(50.9, 10);
    expect(world.player.shield).toBeCloseTo(0.1, 10);
    expect(available(world)).toBeCloseTo(0, 10);
    world.player.woundTime = 0;
    world.player.stats.recovery = 100;
    heal(world, 100);
    expect(world.player.hp).toBeCloseTo(50.9, 10);
  });

  test("one heal prioritizes actual missing HP and charges overflow shield exactly once", () => {
    const world = fixture();
    world.player.hp = 99.75;
    world.player.stats.overheal = 1;
    world.player.stats.shieldCapacity = 1;
    heal(world, 2);
    expect(world.player.hp).toBe(100);
    expect(world.player.shield).toBeCloseTo(0.75, 10);
    expect(world.healingDone).toBeCloseTo(0.25, 10);
    expect(world.shieldRestored).toBeCloseTo(0.75, 10);
    expect(available(world)).toBeCloseTo(0, 10);
  });

  test("the actual overflow conversion, not discarded healing or a second wound, spends allowance", () => {
    const world = fixture();
    world.player.hp = 100;
    world.player.stats.overheal = 0.5;
    world.player.stats.shieldCapacity = 1;
    world.player.stats.recovery = 1;
    world.player.woundTime = 5;
    heal(world, 2); // 2 * 2 * 0.1 healing, then 50% conversion = 0.2 shield.
    expect(world.player.shield).toBeCloseTo(0.2, 10);
    expect(world.shieldRestored).toBeCloseTo(0.2, 10);
    expect(available(world)).toBeCloseTo(0.8, 10);
    expect(shield(world, 1, Infinity, true)).toBeCloseTo(0.8, 10);
    expect(world.player.shield).toBeCloseTo(1, 10);
    expect(available(world)).toBeCloseTo(0, 10);
  });

  test("full values and preserved excess shields do not spend useless recovery", () => {
    const world = fixture();
    world.player.hp = 100;
    world.player.shield = 95;
    world.player.stats.overheal = 1;
    world.player.stats.shieldCapacity = 1;
    heal(world, 1000);
    expect(shield(world, 1000)).toBe(0);
    expect(available(world)).toBe(1);
    world.player.shield = 200;
    heal(world, 1000);
    expect(shield(world, 1000)).toBe(0);
    expect(world.player.shield).toBe(200);
    expect(available(world)).toBe(1);
    world.player.hp = 99.5;
    heal(world, 1000);
    expect(world.player.hp).toBe(100);
    expect(world.player.shield).toBe(200);
    expect(available(world)).toBeCloseTo(0.5, 10);
  });

  test("the original raw lifesteal budget is still applied before the new actual allowance", () => {
    const world = fixture();
    world.player.hp = 50;
    world.player.stats.lifesteal = 0.5;
    world.player.stats.recovery = 1;
    world.player.woundTime = 5;
    heal(world, 1000, "lifesteal");
    expect(world.player.hp).toBeCloseTo(50.53125, 10);
    expect(available(world)).toBeCloseTo(1 - 0.53125, 10);
    const limiter = Reflect.get(world, "lifestealLimiter") as {
      snapshot(): { available: number; capacity: number };
    };
    expect(limiter.snapshot().capacity).toBeCloseTo(2.65625, 10);
    expect(limiter.snapshot().available).toBe(0);
    heal(world, 1000, "lifesteal");
    expect(world.player.hp).toBeCloseTo(50.53125, 10);
    expect(available(world)).toBeCloseTo(1 - 0.53125, 10);
    heal(world, 1000, "regeneration");
    expect(world.player.hp).toBeCloseTo(51, 10);
  });

  test("HP, recovery and shield-capacity upgrades cannot refill an exhausted allowance", () => {
    const world = fixture();
    world.player.hp = 10;
    heal(world, 1);
    expect(available(world)).toBe(0);
    const elapsed = world.elapsed;
    for (let iteration = 0; iteration < 5; iteration++) {
      world.player.stats.maxHp = 200;
      world.player.stats.recovery += 2;
      world.player.stats.shieldCapacity += 0.2;
      heal(world, 1000);
      expect(shield(world, 1000)).toBe(0);
      expect(available(world)).toBe(0);
      world.player.stats.maxHp = 100;
      heal(world, 1000);
      expect(available(world)).toBe(0);
    }
    expect(world.elapsed).toBe(elapsed);
    expect(world.player.hp).toBe(11);
  });

  test("lower HP capacity clips existing storage; later growth restores no discarded tokens", () => {
    const world = fixture();
    world.player.hp = 10;
    world.player.stats.maxHp = 50;
    heal(world, 0.1);
    expect(available(world)).toBeCloseTo(0.4, 10);
    world.player.stats.maxHp = 200;
    expect(available(world)).toBeCloseTo(0.4, 10);
    heal(world, 0.1);
    expect(available(world)).toBeCloseTo(0.3, 10);
    expect(world.player.hp).toBeCloseTo(10.2, 10);
  });

  test("a full-value recovery attempt clips lower capacity without spending or later reminting it", () => {
    const world = fixture();
    world.player.stats.maxHp = 50;
    world.player.hp = 50;
    heal(world, 1000);
    expect(available(world)).toBeCloseTo(0.5, 10);
    world.player.stats.maxHp = 100;
    expect(available(world)).toBeCloseTo(0.5, 10);
    world.player.hp = 100;
    world.player.shield = 200;
    world.player.stats.maxHp = 50;
    world.player.hp = 50;
    expect(shield(world, 1000)).toBe(0);
    world.player.stats.maxHp = 200;
    expect(available(world)).toBeCloseTo(0.5, 10);
    expect(world.player.shield).toBe(200);
  });

  test("legal paused PRE player maxHP edits permanently clip storage without tick or heal", () => {
    const world = new DebugWorld(CONFIG.width, officialProfile());
    world.start(3);
    world.execute({ type: "jump", stage: 11, fresh: false });
    expect(world.phase).toBe("Paused");
    expect(available(world)).toBe(1);
    const values = () => {
      const {
        hp,
        shield,
        invulnerable,
        poisonTime,
        woundTime,
        poisonDamageBonus,
        poisonSlowBonus,
      } = world.player;
      return {
        hp,
        shield,
        invulnerable,
        poisonTime,
        woundTime,
        poisonDamageBonus,
        poisonSlowBonus,
      };
    };
    world.execute({ type: "player", values: values(), overrides: { maxHp: 50 } });
    expect(available(world)).toBeCloseTo(0.5, 10);
    world.execute({ type: "player", values: values(), overrides: { maxHp: 100 } });
    expect(available(world)).toBeCloseTo(0.5, 10);
    world.execute({ type: "player", values: values(), overrides: { maxHp: 20, recovery: 5 } });
    expect(available(world)).toBeCloseTo(0.2, 10);
    world.execute({ type: "player", values: values(), overrides: { maxHp: 200, recovery: 10 } });
    expect(available(world)).toBeCloseTo(0.2, 10);
    expect(world.elapsed).toBe(0);
    expect(world.phase).toBe("Paused");
  });

  test("legal paused PRE deck removal clips storage and regrowth cannot restore it", () => {
    const world = new DebugWorld(CONFIG.width, officialProfile());
    world.start(3);
    world.execute({ type: "jump", stage: 11, fresh: false });
    world.execute({ type: "deck", cards: { vitality: 5 }, trainings: {} });
    expect(world.player.stats.maxHp).toBe(200);
    expect(available(world)).toBe(1);
    world.execute({ type: "restart", restoreEntry: false });
    expect(available(world)).toBe(2); // A deliberate stage reset allows one fresh quarter.
    world.execute({ type: "deck", cards: {}, trainings: {} });
    expect(world.player.stats.maxHp).toBe(100);
    expect(available(world)).toBe(1);
    world.execute({ type: "deck", cards: { vitality: 5 }, trainings: {} });
    expect(world.player.stats.maxHp).toBe(200);
    expect(available(world)).toBe(1);
    expect(world.elapsed).toBe(0);
    expect(world.phase).toBe("Paused");
  });

  test("only player combat time refills: Sanctuary yes, Pause/reward/visual clear no", () => {
    const world = fixture();
    world.player.hp = 50;
    heal(world, 1000);
    expect(available(world)).toBe(0);
    world.sanctuaryRemaining = 10;
    tick(world, 0.125);
    expect(world.elapsed).toBeCloseTo(0.125, 10);
    expect(world.stageElapsed).toBe(0);
    expect(available(world)).toBeCloseTo(0.5, 10);
    world.pause();
    tick(world, 2);
    expect(available(world)).toBeCloseTo(0.5, 10);
    world.resume();
    expect(world.state.transition("RewardSelection")).toBe(true);
    tick(world, 2);
    expect(available(world)).toBeCloseTo(0.5, 10);
    expect(world.state.transition("Playing")).toBe(true);
    world.clearPresentationRemaining = 0.5;
    tick(world, 0.25);
    expect(world.clearPresentationRemaining).toBeGreaterThan(0);
    expect(world.elapsed).toBeCloseTo(0.125, 10);
    expect(available(world)).toBeCloseTo(0.5, 10);
    world.clearPresentationRemaining = 0;
    tick(world, 0.125);
    expect(available(world)).toBeCloseTo(1, 10);
    const before = world.snapshot();
    for (let read = 0; read < 20; read++) {
      expect(world.combatRecoveryPerSecond).toBe(4);
      expect(world.combatShieldCeiling).toBe(95);
      expect(available(world)).toBeCloseTo(1, 10);
    }
    expect(world.snapshot()).toEqual(before);
  });

  test("card HP/shield gains bypass the combat pool and stage/reset grants at most a fresh quarter", () => {
    const world = fixture();
    world.player.hp = 40;
    heal(world, 1000);
    expect(world.player.hp).toBe(41);
    world.player.shield = 200;
    claim(world, "ward", 701, "chest");
    expect(world.player.shield).toBe(224);
    expect(available(world)).toBe(0);
    claim(world, "vitality", 702, "chest");
    expect(world.player.stats.maxHp).toBe(120);
    expect(world.player.hp).toBe(71);
    expect(available(world)).toBe(0);
    heal(world, 1000);
    expect(world.player.hp).toBe(71);
    claim(world, "force", 703, "stage");
    expect(world.stageIndex).toBe(11);
    expect(world.player.hp).toBe(106);
    expect(world.player.shield).toBe(224);
    const capacity = ((120 * 0.04) / 1.075) * 0.25;
    expect(available(world)).toBeCloseTo(capacity, 10);
    heal(world, 1000);
    expect(available(world)).toBeCloseTo(0, 10);
    world.resetCurrentStage();
    expect(available(world)).toBeCloseTo(capacity, 10);
    expect(world.player.shield).toBe(224);
    tick(world, 10);
    expect(available(world)).toBeLessThanOrEqual(capacity + 1e-10);
    expect(world.pause()).toBe(true);
    expect(world.start(3)).toBe(true);
    expect(world.combatRecoveryAllowance).toBeNull();
    expect(world.player.shield).toBe(0);
  });

  test.each([7, 10, 20, 21, 40])(
    "depth %d uses the predeclared rate and shield ceiling without deleting old shields",
    (depth) => {
      const world = fixture(depth);
      const ceiling = 100 * Math.max(0.25, 1 - 0.05 * (depth - 6));
      const rate = 4 / (1 + 0.075 * (depth - 7));
      expect(world.combatRecoveryPerSecond).toBeCloseTo(rate, 12);
      expect(world.combatRecoveryAllowance?.capacity).toBeCloseTo(rate / 4, 12);
      expect(world.combatShieldCeiling).toBeCloseTo(ceiling, 12);
      world.player.shield = ceiling - 0.01;
      expect(shield(world, 1000)).toBeCloseTo(0.01, 10);
      expect(world.player.shield).toBeCloseTo(ceiling, 10);
      world.player.shield = ceiling + 100;
      expect(shield(world, 1000)).toBe(0);
      expect(world.player.shield).toBeCloseTo(ceiling + 100, 10);
    },
  );

  test("a smaller original combat shield capacity still wins over the new global ceiling", () => {
    const world = fixture();
    world.player.shield = 59.9;
    expect(shield(world, 1000, 60)).toBeCloseTo(0.1, 10);
    expect(world.player.shield).toBe(60);
    expect(available(world)).toBeCloseTo(0.9, 10);
  });

  test.each(["campaign", 1, 2, 3, 4, 5, 6] as const)(
    "%s preserves the old unbounded actual recovery and original shield caps",
    (depth) => {
      const world = fixture(depth);
      expect(world.combatRecoveryPerSecond).toBeNull();
      expect(world.combatRecoveryAllowance).toBeNull();
      expect(world.combatShieldCeiling).toBeNull();
      world.player.hp = 99;
      world.player.stats.recovery = 1;
      world.player.woundTime = 5;
      world.player.stats.overheal = 1;
      world.player.stats.shieldCapacity = 1;
      heal(world, 10);
      expect(world.player.hp).toBe(100);
      expect(world.player.shield).toBeCloseTo(1, 10);
      expect(shield(world, 10)).toBeCloseTo(1, 10);
      expect(world.player.shield).toBeCloseTo(2, 10);
      world.player.woundTime = 0;
      expect(shield(world, 1000, 100)).toBeCloseTo(98, 10);
      expect(world.player.shield).toBe(100);
      world.player.shield = 200;
      heal(world, 1000);
      expect(world.player.shield).toBe(200);
    },
  );
});
