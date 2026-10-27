import { type StarLevel, starWeightsAt } from "../../data/endless";
import type { Random } from "../random";

export type EncounterStep =
  | { readonly id: "wave1" | "wave2"; readonly type: "wave"; readonly budget: number }
  | {
      readonly id: "miniA";
      readonly type: "mini";
      readonly kind: "tank" | "wizard";
      readonly partnerKind?: "tank" | "wizard";
    }
  | { readonly id: "main"; readonly type: "main"; readonly kind: "boss" };

export interface EncounterState {
  readonly plan: readonly EncounterStep[];
  readonly index: number;
  readonly spentBudget: number;
  /** Successful admissions, never the number of leaders still alive. */
  readonly admittedLeaders: number;
  /** Fixed on the first successful leader admission; failures never spend it. */
  readonly initialEscortsRemaining: number;
  readonly breakRemaining: number;
}

export interface EncounterAdvance {
  readonly state: EncounterState;
  readonly changed: boolean;
  readonly completed: boolean;
  /** Present only on the call that enters the next combat segment. */
  readonly enteredStep: EncounterStep | undefined;
}

export function starCost(stars: StarLevel): number {
  return 3 ** (stars - 1);
}

export function createEncounterPlan(
  depth: number,
  totalWaveBudget: number,
): readonly EncounterStep[] {
  // Also validates depth even when a custom budget contains no ordinary enemies.
  starWeightsAt(depth);
  if (!Number.isSafeInteger(totalWaveBudget) || totalWaveBudget < 0)
    throw new Error("Invalid encounter budget");
  const firstKind = depth % 2 === 1 ? "tank" : "wizard";
  const firstBudget = Math.ceil(totalWaveBudget / 2);
  const plan: EncounterStep[] = [
    { id: "wave1", type: "wave", budget: firstBudget },
    {
      id: "miniA",
      type: "mini",
      kind: firstKind,
      ...(depth >= 4 ? { partnerKind: firstKind === "tank" ? "wizard" : "tank" } : {}),
    },
    { id: "wave2", type: "wave", budget: totalWaveBudget - firstBudget },
  ];
  plan.push({ id: "main", type: "main", kind: "boss" });
  return plan;
}

export function createEncounterState(plan: readonly EncounterStep[]): EncounterState {
  return {
    plan,
    index: 0,
    spentBudget: 0,
    admittedLeaders: 0,
    initialEscortsRemaining: 0,
    breakRemaining: 0,
  };
}

export function currentEncounterStep(state: EncounterState): EncounterStep | undefined {
  return state.plan[state.index];
}

export function encounterLeaders(step: EncounterStep): readonly ("tank" | "wizard" | "boss")[] {
  if (step.type === "wave") return [];
  return step.type === "mini" && step.partnerKind ? [step.kind, step.partnerKind] : [step.kind];
}

export function encounterAdmissionsComplete(state: EncounterState): boolean {
  const step = currentEncounterStep(state);
  if (!step) return true;
  return step.type === "wave"
    ? state.spentBudget >= step.budget
    : state.admittedLeaders === encounterLeaders(step).length &&
        state.initialEscortsRemaining === 0;
}

/** Reconfigure only budget that has not been admitted; completed segments stay completed. */
export function replanEncounterBudget(
  state: EncounterState,
  requestedBudget: number,
): { state: EncounterState; effectiveBudget: number } {
  if (!Number.isSafeInteger(requestedBudget) || requestedBudget < 0)
    throw new Error("Invalid encounter budget");
  let spent = 0;
  const remainingWaves: number[] = [];
  for (const [index, step] of state.plan.entries()) {
    if (step.type !== "wave") continue;
    if (index < state.index || (index === state.index && state.breakRemaining > 0))
      spent += step.budget;
    else if (index === state.index) {
      spent += state.spentBudget;
      remainingWaves.push(index);
    } else remainingWaves.push(index);
  }
  if (!remainingWaves.length) return { state, effectiveBudget: spent };
  const effectiveBudget = Math.max(requestedBudget, spent);
  const remaining = effectiveBudget - spent;
  const share = Math.floor(remaining / remainingWaves.length);
  let remainder = remaining % remainingWaves.length;
  let changed = false;
  const plan = state.plan.map((step, index) => {
    if (step.type !== "wave" || !remainingWaves.includes(index)) return step;
    const allocation = share + (remainder-- > 0 ? 1 : 0);
    const budget = (index === state.index ? state.spentBudget : 0) + allocation;
    if (budget === step.budget) return step;
    changed = true;
    return { ...step, budget };
  });
  return { state: changed ? { ...state, plan } : state, effectiveBudget };
}

/** Filter unaffordable stars before sampling; the last few credits always remain usable. */
export function drawSpawnStars(
  depth: number,
  remainingBudget: number,
  random: Random,
): StarLevel | undefined {
  const weights = starWeightsAt(depth);
  if (!Number.isSafeInteger(remainingBudget) || remainingBudget < 1) return undefined;
  const affordable = ([1, 2, 3] as const).filter(
    (stars) => starCost(stars) <= remainingBudget && weights[stars] > 0,
  );
  let roll = random() * affordable.reduce((sum, stars) => sum + weights[stars], 0);
  for (const stars of affordable) {
    roll -= weights[stars];
    if (roll < 0) return stars;
  }
  return affordable[affordable.length - 1];
}

/** Call only after an entity was successfully admitted to the bounded pool. */
export function admitEncounterSpawn(state: EncounterState, stars: StarLevel): EncounterState {
  const step = currentEncounterStep(state);
  if (step?.type !== "wave" || state.breakRemaining > 0) return state;
  if (![1, 2, 3].includes(stars)) return state;
  const spentBudget = state.spentBudget + starCost(stars);
  if (spentBudget > step.budget) return state;
  return { ...state, spentBudget };
}

/** A failed pool admission must not call this function or consume the encounter. */
export function admitEncounterLeader(
  state: EncounterState,
  initialEscortQuota: number,
): EncounterState {
  const step = currentEncounterStep(state);
  if (
    !step ||
    step.type === "wave" ||
    state.admittedLeaders >= encounterLeaders(step).length ||
    state.breakRemaining > 0
  )
    return state;
  if (!Number.isSafeInteger(initialEscortQuota) || initialEscortQuota < 0)
    throw new Error("Invalid initial escort quota");
  return {
    ...state,
    admittedLeaders: state.admittedLeaders + 1,
    initialEscortsRemaining:
      state.admittedLeaders === 0 ? initialEscortQuota : state.initialEscortsRemaining,
  };
}

/** Call only after a budgeted initial escort entered; leaders have admission priority. */
export function admitEncounterEscort(state: EncounterState): EncounterState {
  const step = currentEncounterStep(state);
  if (
    !step ||
    step.type === "wave" ||
    state.admittedLeaders !== encounterLeaders(step).length ||
    state.initialEscortsRemaining <= 0 ||
    state.breakRemaining > 0
  )
    return state;
  return { ...state, initialEscortsRemaining: state.initialEscortsRemaining - 1 };
}

/** No timers or combat side effects: callers own spawning, rewards, effects and stage completion. */
export function advanceEncounter(
  state: EncounterState,
  activeEnemyCount: number,
  delta: number,
  breakSeconds: number,
): EncounterAdvance {
  const unchanged = (): EncounterAdvance => ({
    state,
    changed: false,
    completed: currentEncounterStep(state) === undefined,
    enteredStep: undefined,
  });
  if (
    !Number.isFinite(delta) ||
    delta < 0 ||
    !Number.isFinite(breakSeconds) ||
    breakSeconds < 0 ||
    !Number.isSafeInteger(activeEnemyCount) ||
    activeEnemyCount !== 0
  )
    return unchanged();
  const step = currentEncounterStep(state);
  if (!step) return unchanged();
  if (!encounterAdmissionsComplete(state)) return unchanged();
  const remaining = step.type === "main" ? 0 : (state.breakRemaining || breakSeconds) - delta;
  if (remaining > 1e-9) {
    if (remaining === state.breakRemaining) return unchanged();
    const next = { ...state, breakRemaining: remaining };
    return { state: next, changed: true, completed: false, enteredStep: undefined };
  }
  const next: EncounterState = {
    ...state,
    index: state.index + 1,
    spentBudget: 0,
    admittedLeaders: 0,
    initialEscortsRemaining: 0,
    breakRemaining: 0,
  };
  const enteredStep = currentEncounterStep(next);
  return { state: next, changed: true, completed: enteredStep === undefined, enteredStep };
}
