import { describe, expect, test } from "bun:test";
import {
  admitEncounterEscort,
  admitEncounterLeader,
  admitEncounterSpawn,
  advanceEncounter,
  createEncounterPlan,
  createEncounterState,
  currentEncounterStep,
  encounterAdmissionsComplete,
  encounterLeaders,
  replanEncounterBudget,
} from "../../src/game/systems/encounter";

const miniState = (depth = 4) =>
  advanceEncounter(createEncounterState(createEncounterPlan(depth, 0)), 0, 1.5, 1.5).state;

describe("paired leader and finite escort admission", () => {
  test("intro plans retain one alternating elite; depth4+ shares one two-member segment", () => {
    for (const depth of [1, 2, 3, 4, 5, 6, 20]) {
      const plan = createEncounterPlan(depth, 31);
      expect(plan.map((step) => step.id)).toEqual(["wave1", "miniA", "wave2", "main"]);
      expect(plan.filter((step) => step.type === "wave").map((step) => step.budget)).toEqual([
        16, 15,
      ]);
      const mini = plan[1];
      if (!mini) throw new Error("Missing elite segment");
      const members = encounterLeaders(mini);
      expect(members[0]).toBe(depth % 2 === 1 ? "tank" : "wizard");
      expect(members.length).toBe(depth < 4 ? 1 : 2);
      if (depth >= 4) expect(new Set(members)).toEqual(new Set(["tank", "wizard"]));
      // Exactly three earned boundaries precede the main boss; no extra supply boundary.
      expect(plan.filter((step) => step.type !== "main").length).toBe(3);
    }
  });

  test("a failed or dead first admission cannot duplicate it or clear a missing partner", () => {
    const initial = miniState();
    expect(advanceEncounter(initial, 0, 99, 1.5).state).toBe(initial);
    let state = admitEncounterLeader(initial, 8);
    expect(state.admittedLeaders).toBe(1);
    expect(state.initialEscortsRemaining).toBe(8);
    // No admission callback after failed spawning; even an empty pool cannot advance.
    expect(advanceEncounter(state, 0, 99, 1.5).state).toBe(state);
    expect(admitEncounterEscort(state)).toBe(state);
    const step = currentEncounterStep(state);
    if (!step) throw new Error("Missing current elite segment");
    expect(encounterLeaders(step)[state.admittedLeaders]).toBe("tank");
    // The first successful member snapshots the total quota. Retry cannot enlarge it.
    state = admitEncounterLeader(state, 999);
    expect(state.admittedLeaders).toBe(2);
    expect(state.initialEscortsRemaining).toBe(8);
    expect(admitEncounterLeader(state, 999)).toBe(state);
  });

  test("failed escorts remain pending and every admitted escort spends one fixed credit", () => {
    let state = admitEncounterLeader(admitEncounterLeader(miniState(), 8), 8);
    expect(advanceEncounter(state, 0, 99, 1.5).state).toBe(state);
    for (let remaining = 8; remaining > 0; remaining--) {
      expect(state.initialEscortsRemaining).toBe(remaining);
      state = admitEncounterEscort(state);
    }
    expect(admitEncounterEscort(state)).toBe(state);
    expect(advanceEncounter(state, 1, 99, 1.5).state).toBe(state);
    state = advanceEncounter(state, 0, 0.5, 1.5).state;
    expect(state.breakRemaining).toBe(1);
    expect(admitEncounterLeader(state, 8)).toBe(state);
    expect(admitEncounterEscort(state)).toBe(state);
    expect(advanceEncounter(state, 0, 0, 1.5).state).toBe(state);
    const next = advanceEncounter(state, 0, 1, 1.5);
    expect(next.enteredStep?.id).toBe("wave2");
    expect(next.state.admittedLeaders).toBe(0);
    expect(next.state.initialEscortsRemaining).toBe(0);
  });

  test("single-leader and zero-escort segments use the same bounded admission sequence", () => {
    const initial = miniState(1);
    let state = admitEncounterLeader(initial, 4);
    expect(state.admittedLeaders).toBe(1);
    expect(admitEncounterLeader(state, 4)).toBe(state);
    for (let index = 0; index < 4; index++) state = admitEncounterEscort(state);
    expect(advanceEncounter(state, 0, 1.5, 1.5).enteredStep?.id).toBe("wave2");
    const withoutEscorts = admitEncounterLeader(initial, 0);
    expect(advanceEncounter(withoutEscorts, 0, 1.5, 1.5).enteredStep?.id).toBe("wave2");
  });

  test("wave replanning preserves partially admitted leaders and pending finite escorts", () => {
    const plan = createEncounterPlan(4, 18);
    let state = createEncounterState(plan);
    state = admitEncounterSpawn(state, 3);
    state = advanceEncounter(state, 0, 1.5, 1.5).state;
    state = admitEncounterLeader(state, 8);
    const replanned = replanEncounterBudget(state, 21);
    expect(replanned.state.admittedLeaders).toBe(1);
    expect(replanned.state.initialEscortsRemaining).toBe(8);
    expect(
      replanned.state.plan.filter((step) => step.type === "wave").map((step) => step.budget),
    ).toEqual([9, 12]);
  });

  test("the main boss still needs its single admission and all initial escorts before completion", () => {
    const plan = createEncounterPlan(4, 0);
    let state = { ...createEncounterState(plan), index: 3 };
    expect(advanceEncounter(state, 0, 99, 1.5).state).toBe(state);
    state = admitEncounterLeader(state, 2);
    expect(encounterAdmissionsComplete(state)).toBe(false);
    expect(advanceEncounter(state, 0, 99, 1.5).state).toBe(state);
    state = admitEncounterEscort(admitEncounterEscort(state));
    expect(encounterAdmissionsComplete(state)).toBe(true);
    expect(advanceEncounter(state, 1, 99, 1.5).state).toBe(state);
    const complete = advanceEncounter(state, 0, 0, 1.5);
    expect(complete.completed).toBe(true);
    expect(complete.enteredStep).toBeUndefined();
  });
});
