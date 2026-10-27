import { describe, expect, test } from "bun:test";
import { STAGES } from "../../src/data/stages";
import { CONFIG } from "../../src/game/config";
import type { WorldObservation } from "../../src/game/observation";
import {
  createEncounterState,
  type EncounterState,
  type EncounterStep,
} from "../../src/game/systems/encounter";
import { World } from "../../src/game/world";

class WaveWorld extends World {
  get breakSeconds(): number {
    return this.balance.payload.evolution.breakSeconds;
  }
  configure(depth: number, interval = 1, budget = 72, maxEnemies?: number): void {
    this.stageIndex = STAGES.length + depth - 1;
    const stage = this.resolveStage(this.stageIndex);
    this.configuredStage = {
      index: this.stageIndex,
      value: {
        ...stage,
        spawnInterval: interval,
        enemyCount: budget,
        ...(maxEnemies === undefined ? {} : { maxEnemies }),
      },
    };
    this.resetStage();
    this.stageSupplies = 100;
    this.player.cooldown = 1000;
    this.player.shield = 1e6;
    this.wavePlan([
      { id: "wave1", type: "wave", budget },
      { id: "wave2", type: "wave", budget: 0 },
    ]);
  }
  wavePlan(plan: EncounterStep[]): void {
    Reflect.set(this, "encounterState", createEncounterState(plan));
    Reflect.set(this, "encounterStageIndex", this.stageIndex);
  }
  replan(budget: number): void {
    const previous = this.stage;
    this.configuredStage = { index: this.stageIndex, value: { ...previous, enemyCount: budget } };
    this.rescheduleSpawns(previous);
  }
}
function fixture(depth = 7, interval = 1, budget = 72, maxEnemies?: number) {
  const events: WorldObservation[] = [];
  const world = new WaveWorld(CONFIG.width, undefined, (event) => {
    if (event.type === "enemy_spawn") events.push(event);
  });
  world.start(4);
  world.configure(depth, interval, budget, maxEnemies);
  return { world, events };
}
function advance(world: World, seconds: number): void {
  for (let index = 0; index < Math.round(seconds / CONFIG.fixedStep); index++) {
    world.update(CONFIG.fixedStep);
    // Isolate the real spawn director from movement/fusion/damage in these short fixtures.
    for (const entity of world.enemies.items)
      if (entity.active) {
        entity.speed = 0;
        entity.age = 0;
        entity.shotCooldown = 1000;
      }
  }
}
function until(world: World, events: WorldObservation[], count: number): void {
  for (let index = 0; events.length < count && index < 2400; index++)
    advance(world, CONFIG.fixedStep);
  expect(events).toHaveLength(count);
}
const admissions = (world: World): number => Reflect.get(world, "waveAdmissions");
const cooldown = (world: World): number => Reflect.get(world, "spawnCooldown");
const state = (world: World): EncounterState => Reflect.get(world, "encounterState");
function expectGaps(events: WorldObservation[], gaps: number[]): void {
  for (const [index, gap] of gaps.entries()) {
    const actual = (events[index + 1]?.stageElapsed ?? 0) - (events[index]?.stageElapsed ?? 0);
    expect(Math.abs(actual - gap)).toBeLessThanOrEqual(CONFIG.fixedStep + 1e-8);
  }
}

describe("Q success-counted late endless wave packs", () => {
  test.each([1, 6])("depth %s keeps the original one-at-a-time cadence", (depth) => {
    const { world, events } = fixture(depth);
    until(world, events, 4);
    expect(Math.abs((events[0]?.stageElapsed ?? 0) - 0.8)).toBeLessThanOrEqual(
      CONFIG.fixedStep + 1e-8,
    );
    expectGaps(events, [1, 1, 1]);
  });
  test.each([7, 12])("depth %s alternates two admissions and the compensating gap", (depth) => {
    const { world, events } = fixture(depth);
    until(world, events, 5);
    expectGaps(events, [0.25, 1.75, 0.25, 1.75]);
    expect(
      Math.abs((events[4]?.stageElapsed ?? 0) - (events[0]?.stageElapsed ?? 0) - 4),
    ).toBeLessThanOrEqual(4 * CONFIG.fixedStep + 1e-8);
  });
  test.each([13, 20])("depth %s admits triples then waits the full compensating gap", (depth) => {
    const { world, events } = fixture(depth);
    until(world, events, 6);
    expectGaps(events, [0.25, 0.25, 2.5, 0.25, 0.25]);
    expect(
      Math.abs((events[3]?.stageElapsed ?? 0) - (events[0]?.stageElapsed ?? 0) - 3),
    ).toBeLessThanOrEqual(3 * CONFIG.fixedStep + 1e-8);
  });
  test.each([0, 0.001, 0.1, 0.5, 1.7])(
    "custom interval %s never produces a negative gap",
    (interval) => {
      const { world, events } = fixture(13, interval);
      const intra = Math.min(0.25, interval * 0.5);
      for (let count = 1; count <= 4; count++) {
        until(world, events, count);
        const expected = count % 3 === 0 ? 3 * interval - 2 * intra : intra;
        expect(cooldown(world)).toBeCloseTo(expected, 8);
        expect(cooldown(world)).toBeGreaterThanOrEqual(0);
      }
      expectGaps(events, [
        Math.max(CONFIG.fixedStep, intra),
        Math.max(CONFIG.fixedStep, intra),
        Math.max(CONFIG.fixedStep, 3 * interval - 2 * intra),
      ]);
    },
  );
  test("group progress counts successful entities rather than their star credit", () => {
    const { world, events } = fixture(13);
    until(world, events, 3);
    const credit = events.reduce((sum, event) => sum + 3 ** ((event.stars ?? 1) - 1), 0);
    expect(credit).toBeGreaterThan(3);
    expect(state(world).spentBudget).toBe(credit);
    expect(admissions(world)).toBe(3);
    expect(cooldown(world)).toBeCloseTo(2.5, 8);
  });
  test("a partial final pack spends only the remaining star credit and legally clears", () => {
    const { world, events } = fixture(13, 1, 2);
    until(world, events, 2);
    expect(events.map((event) => event.stars)).toEqual([1, 1]);
    expect(state(world).spentBudget).toBe(2);
    expect(admissions(world)).toBe(2);
    advance(world, 1);
    expect(events).toHaveLength(2);
    world.enemies.clear();
    advance(world, world.breakSeconds + 0.1);
    expect(state(world).index).toBeGreaterThan(0);
    expect(events).toHaveLength(2);
  });
  test("full capacity retries preserve quota, role cursor and pack progress", () => {
    const { world, events } = fixture(7, 1, 72, 2);
    until(world, events, 1);
    const spent = state(world).spentBudget;
    const order = [...Reflect.get(world, "minionOrder")];
    advance(world, 0.5);
    expect(events).toHaveLength(1);
    expect(state(world).spentBudget).toBe(spent);
    expect(admissions(world)).toBe(1);
    expect(Reflect.get(world, "minionOrder")).toEqual(order);
    world.enemies.clear();
    advance(world, CONFIG.fixedStep);
    expect(events).toHaveLength(2);
    expect(admissions(world)).toBe(2);
    expect(cooldown(world)).toBeCloseTo(1.75, 8);
    world.enemies.clear();
    advance(world, 1.7);
    expect(events).toHaveLength(2);
    advance(world, 0.06);
    expect(events).toHaveLength(3);
  });
  test("a blocked third member retries as the same pack and then pays the long gap", () => {
    const { world, events } = fixture(13, 1, 72, 3);
    until(world, events, 2);
    const spent = state(world).spentBudget;
    const order = [...Reflect.get(world, "minionOrder")];
    advance(world, 0.5);
    expect(events).toHaveLength(2);
    expect(admissions(world)).toBe(2);
    expect(state(world).spentBudget).toBe(spent);
    expect(Reflect.get(world, "minionOrder")).toEqual(order);
    const occupied = world.enemies.items.find((entity) => entity.active);
    if (!occupied) throw new Error("Missing occupied slot");
    occupied.active = false;
    advance(world, CONFIG.fixedStep);
    expect(events).toHaveLength(3);
    expect(admissions(world)).toBe(3);
    expect(cooldown(world)).toBeCloseTo(2.5, 8);
  });
  test("live budget replan preserves an unfinished pack and its due time", () => {
    const { world, events } = fixture(7);
    until(world, events, 1);
    const due = cooldown(world),
      spent = state(world).spentBudget;
    world.replan(80);
    expect(admissions(world)).toBe(1);
    expect(state(world).spentBudget).toBe(spent);
    expect(cooldown(world)).toBe(due);
    expect(world.stage.enemyCount).toBe(80);
    until(world, events, 2);
    expectGaps(events, [0.25]);
    expect(cooldown(world)).toBeCloseTo(1.75, 8);
  });
  test("each segment starts a fresh pack after a partial preceding pack", () => {
    const { world, events } = fixture(7);
    world.wavePlan([
      { id: "wave1", type: "wave", budget: 1 },
      { id: "wave2", type: "wave", budget: 10 },
    ]);
    until(world, events, 1);
    expect(admissions(world)).toBe(1);
    world.enemies.clear();
    until(world, events, 2);
    expect(state(world).index).toBe(1);
    expect(admissions(world)).toBe(1);
    expect(cooldown(world)).toBeCloseTo(0.25, 8);
    until(world, events, 3);
    expectGaps(events.slice(1), [0.25]);
    expect(cooldown(world)).toBeCloseTo(1.75, 8);
  });
  test("stage reset and native restart discard unfinished packs", () => {
    const { world, events } = fixture(13);
    until(world, events, 2);
    world.configure(13);
    expect(admissions(world)).toBe(0);
    events.length = 0;
    until(world, events, 1);
    expect(cooldown(world)).toBeCloseTo(0.25, 8);
    world.pause();
    expect(world.start(4)).toBe(true);
    expect(admissions(world)).toBe(0);
    world.configure(7);
    events.length = 0;
    until(world, events, 1);
    expect(cooldown(world)).toBeCloseTo(0.25, 8);
  });
  test("Pause, rewards, Sanctuary and visual clear never spend hostile spawn time", () => {
    const { world, events } = fixture(7);
    until(world, events, 1);
    const due = cooldown(world),
      hostile = world.stageElapsed;
    world.pause();
    advance(world, 1);
    expect(cooldown(world)).toBe(due);
    world.resume();
    world.state.transition("RewardSelection");
    advance(world, 1);
    expect(cooldown(world)).toBe(due);
    world.state.transition("Playing");
    world.sanctuaryRemaining = 1;
    advance(world, 1);
    expect(world.stageElapsed).toBe(hostile);
    expect(cooldown(world)).toBe(due);
    world.clearPresentationRemaining = 1;
    advance(world, 0.5);
    expect(world.stageElapsed).toBe(hostile);
    expect(cooldown(world)).toBe(due);
    world.clearPresentationRemaining = 0;
    until(world, events, 2);
    expectGaps(events, [0.25]);
    expect(admissions(world)).toBe(2);
  });
});
