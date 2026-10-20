import type { Phase } from "./types";

const TRANSITIONS: Record<Phase, readonly Phase[]> = {
  Menu: ["Playing"],
  Playing: ["Paused", "RewardSelection", "StageClear", "Victory", "GameOver"],
  Paused: ["Playing", "Menu"],
  RewardSelection: ["Playing"],
  StageClear: ["Playing"],
  Victory: ["Playing", "Menu"],
  GameOver: ["Playing", "Menu"],
};

export class RunState {
  phase: Phase = "Menu";
  private readonly listeners = new Set<(phase: Phase) => void>();

  subscribe(listener: (phase: Phase) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  transition(next: Phase): boolean {
    if (!TRANSITIONS[this.phase].includes(next)) return false;
    this.phase = next;
    for (const listener of this.listeners) listener(next);
    return true;
  }
}
