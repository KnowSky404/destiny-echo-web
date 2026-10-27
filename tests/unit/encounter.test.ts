import { describe, expect, test } from "bun:test";
import { endlessGrowth } from "../../src/data/endless";
import { seededRandom } from "../../src/game/random";
import {
  admitEncounterLeader,
  admitEncounterSpawn,
  advanceEncounter,
  createEncounterPlan,
  createEncounterState,
  currentEncounterStep,
  drawSpawnStars,
  encounterLeaders,
  replanEncounterBudget,
  starCost,
} from "../../src/game/systems/encounter";

describe("endless encounter pacing", () => {
  test("live budget edits preserve admitted stars and split only the remaining wave credits", () => {
    const initial = createEncounterState(createEncounterPlan(6, 72));
    const spent = admitEncounterSpawn(initial, 3);
    const increased = replanEncounterBudget(spent, 100);
    expect(increased.effectiveBudget).toBe(100);
    expect(
      increased.state.plan.filter((step) => step.type === "wave").map((step) => step.budget),
    ).toEqual([55, 45]);
    expect(increased.state.spentBudget).toBe(9);
    expect(spent.plan.filter((step) => step.type === "wave").map((step) => step.budget)).toEqual([
      36, 36,
    ]);
    const decreased = replanEncounterBudget(increased.state, 2);
    expect(decreased.effectiveBudget).toBe(9);
    expect(
      decreased.state.plan.filter((step) => step.type === "wave").map((step) => step.budget),
    ).toEqual([9, 0]);
    expect(admitEncounterSpawn(decreased.state, 1)).toBe(decreased.state);
  });

  test("a cleared wave keeps its break and sends extra budget to the later wave", () => {
    let state = createEncounterState(createEncounterPlan(4, 18));
    state = admitEncounterSpawn(state, 3);
    state = advanceEncounter(state, 0, 0.5, 1.5).state;
    const replanned = replanEncounterBudget(state, 31);
    expect(replanned.effectiveBudget).toBe(31);
    expect(
      replanned.state.plan.filter((step) => step.type === "wave").map((step) => step.budget),
    ).toEqual([9, 22]);
    expect(replanned.state.index).toBe(state.index);
    expect(replanned.state.admittedLeaders).toBe(state.admittedLeaders);
    expect(replanned.state.initialEscortsRemaining).toBe(state.initialEscortsRemaining);
    expect(replanned.state.breakRemaining).toBe(1);
    expect(advanceEncounter(replanned.state, 0, 1, 1.5).enteredStep?.id).toBe("miniA");
  });

  test("completed waves cannot be reclaimed in a mini or final boss segment", () => {
    const plan = createEncounterPlan(4, 72);
    const mini = {
      ...createEncounterState(plan),
      index: 1,
      admittedLeaders: 1,
      initialEscortsRemaining: 3,
      breakRemaining: 0.7,
    };
    const less = replanEncounterBudget(mini, 20);
    expect(less.effectiveBudget).toBe(36);
    expect(
      less.state.plan.filter((step) => step.type === "wave").map((step) => step.budget),
    ).toEqual([36, 0]);
    expect(less.state.admittedLeaders).toBe(1);
    expect(less.state.initialEscortsRemaining).toBe(3);
    expect(less.state.breakRemaining).toBe(0.7);
    for (const index of [3, 4, 5]) {
      const state = { ...createEncounterState(plan), index, admittedLeaders: 1 };
      const more = replanEncounterBudget(state, 1000);
      expect(more.state).toBe(state);
      expect(more.effectiveBudget).toBe(72);
      expect(replanEncounterBudget(state, 1).effectiveBudget).toBe(72);
    }
  });

  test("current second-wave spend survives further edits and invalid budgets do not mutate state", () => {
    const state = { ...createEncounterState(createEncounterPlan(6, 72)), index: 2, spentBudget: 9 };
    const increased = replanEncounterBudget(state, 80);
    expect(
      increased.state.plan.filter((step) => step.type === "wave").map((step) => step.budget),
    ).toEqual([36, 44]);
    const decreased = replanEncounterBudget(increased.state, 20);
    expect(decreased.effectiveBudget).toBe(45);
    expect(
      decreased.state.plan.filter((step) => step.type === "wave").map((step) => step.budget),
    ).toEqual([36, 9]);
    expect(decreased.state.spentBudget).toBe(9);
    for (const invalid of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => replanEncounterBudget(state, invalid)).toThrow("Invalid encounter budget");
    expect(state.plan.filter((step) => step.type === "wave").map((step) => step.budget)).toEqual([
      36, 36,
    ]);
  });
  test("the first three depths introduce one elite, then both share the same segment", () => {
    const introKinds = [1, 2, 3].map((depth) => {
      const plan = createEncounterPlan(depth, 31);
      expect(plan.map((step) => step.id)).toEqual(["wave1", "miniA", "wave2", "main"]);
      expect(plan.filter((step) => step.type === "wave").map((step) => step.budget)).toEqual([
        16, 15,
      ]);
      return plan.find((step) => step.type === "mini")?.kind;
    });
    expect(introKinds).toEqual(["tank", "wizard", "tank"]);
    for (const depth of [4, 5, 10, 20]) {
      const plan = createEncounterPlan(depth, 31);
      expect(plan.map((step) => step.id)).toEqual(["wave1", "miniA", "wave2", "main"]);
      expect(
        new Set(plan.filter((step) => step.type === "mini").flatMap(encounterLeaders)),
      ).toEqual(new Set(["tank", "wizard"]));
    }
  });

  test("budget cannot disappear while the pool is full or a boss has not been admitted", () => {
    let state = createEncounterState(createEncounterPlan(6, 18));
    expect(advanceEncounter(state, 0, 100, 1.5).state).toBe(state);
    expect(admitEncounterLeader(state, 0)).toBe(state);
    state = admitEncounterSpawn(state, 3);
    expect(state.spentBudget).toBe(9);
    expect(admitEncounterSpawn(state, 1)).toBe(state);
    expect(advanceEncounter(state, 1, 100, 1.5).state).toBe(state);
    let transition = advanceEncounter(state, 0, 0.5, 1.5);
    expect(transition.enteredStep).toBeUndefined();
    expect(transition.state.breakRemaining).toBe(1);
    expect(admitEncounterSpawn(transition.state, 1)).toBe(transition.state);
    transition = advanceEncounter(transition.state, 0, 1, 1.5);
    state = transition.state;
    expect(transition.enteredStep?.id).toBe("miniA");
    expect(advanceEncounter(state, 0, 100, 1.5).state).toBe(state);
    expect(admitEncounterSpawn(state, 3)).toBe(state);
    state = admitEncounterLeader(state, 0);
    expect(advanceEncounter(state, 0, 100, 1.5).state).toBe(state);
    state = admitEncounterLeader(state, 0);
    expect(admitEncounterLeader(state, 0)).toBe(state);
    expect(advanceEncounter(state, 1, 100, 1.5).state).toBe(state);
    expect(advanceEncounter(state, 0, 1.5, 1.5).enteredStep?.id).toBe("wave2");
  });

  test("every segment must finish before the main boss can complete a layer", () => {
    let state = createEncounterState(createEncounterPlan(4, 7));
    const visited: string[] = [];
    for (let index = 0; index < 10; index++) {
      const step = currentEncounterStep(state);
      if (!step) break;
      visited.push(step.id);
      if (step.type === "wave") {
        for (let count = 0; count < step.budget; count++) state = admitEncounterSpawn(state, 1);
      } else {
        for (let admitted = 0; admitted < encounterLeaders(step).length; admitted++)
          state = admitEncounterLeader(state, 0);
      }
      const transition = advanceEncounter(state, 0, 1.5, 1.5);
      expect(transition.completed).toBe(step.type === "main");
      state = transition.state;
    }
    expect(visited).toEqual(["wave1", "miniA", "wave2", "main"]);
    const repeated = advanceEncounter(state, 0, 1, 1.5);
    expect(repeated.changed).toBe(false);
    expect(repeated.completed).toBe(true);
    expect(repeated.state).toBe(state);
  });

  test("paused and invalid clocks cannot consume a break or skip segments", () => {
    let state = createEncounterState(createEncounterPlan(1, 0));
    state = advanceEncounter(state, 0, 0.5, 1.5).state;
    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const transition = advanceEncounter(state, 0, delta, 1.5);
      expect(transition.changed).toBe(false);
      expect(transition.state).toBe(state);
    }
    for (const count of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(advanceEncounter(state, count, 1, 1.5).state).toBe(state);
    expect(advanceEncounter(state, 0, 1, -1).state).toBe(state);
  });
});

describe("native stars and a single health curve", () => {
  test("star populations follow the introductory, strengthening and deep-endless bands", () => {
    for (const [depth, expected] of [
      [1, [1, 0, 0]],
      [2, [1, 0, 0]],
      [3, [0.75, 0.25, 0]],
      [5, [0.75, 0.25, 0]],
      [6, [0.45, 0.45, 0.1]],
      [10, [0.45, 0.45, 0.1]],
      [11, [0.2, 0.5, 0.3]],
    ] as const) {
      const counts = [0, 0, 0];
      const random = seededRandom(812);
      for (let index = 0; index < 10000; index++) {
        const stars = drawSpawnStars(depth, 9, random);
        if (!stars) throw new Error("Missing star draw");
        counts[stars - 1] = (counts[stars - 1] ?? 0) + 1;
      }
      expected.forEach((ratio, index) => {
        expect(Math.abs((counts[index] ?? 0) / 10000 - ratio)).toBeLessThan(0.02);
      });
    }
  });

  test("mixed native stars spend exact credit without stranding a partial wave", () => {
    for (const depth of [1, 3, 6, 11, 100]) {
      const random = seededRandom(depth);
      for (const budget of [1, 2, 3, 8, 9, 17, 71]) {
        let remaining = budget;
        let entities = 0;
        while (remaining > 0) {
          const stars = drawSpawnStars(depth, remaining, random);
          if (!stars) throw new Error("Unspendable budget");
          remaining -= starCost(stars);
          expect(remaining).toBeGreaterThanOrEqual(0);
          entities++;
          expect(entities).toBeLessThanOrEqual(budget);
        }
        expect(remaining).toBe(0);
      }
    }
    expect(drawSpawnStars(11, 0, () => 0.5)).toBeUndefined();
  });

  test("health grows smoothly from the resolved baseline without compounding population", () => {
    expect(endlessGrowth(1)).toBe(1.5);
    expect(endlessGrowth(5)).toBe(4.5);
    expect(endlessGrowth(10)).toBe(10.5);
    expect(endlessGrowth(20)).toBe(30);
    expect(endlessGrowth(100) / endlessGrowth(99)).toBeLessThan(1.03);
    expect(endlessGrowth(2, { growthLinear: 0.2, growthQuadratic: 0 })).toBe(1.4);
    for (const depth of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => createEncounterPlan(depth, 1)).toThrow();
    expect(() => createEncounterPlan(1, -1)).toThrow();
  });
});
