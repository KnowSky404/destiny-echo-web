import { CARDS } from "../src/data/cards";
import { synergyCount } from "../src/game/synergies";

export type RunPolicy = "active" | "auto" | "families" | "defensive";

export function chooseReward(
  choices: readonly string[],
  stacks: ReadonlyMap<string, number>,
  hp: number,
  policy: RunPolicy = "active",
): string | undefined {
  const weights: Record<string, number> = {
    multishot: 30,
    haste: 26,
    piercing: 18,
    overload: 24,
    force: 25,
    momentum: 24,
    crush: 18,
    chain: 27,
    splash: 24,
    stormcall: 25,
    keen: 23,
    lethal: 16,
    expose: 18,
    fuse: 24,
    bloodpact: 21,
    focus: 16,
    execution: 15,
    harvest: 16,
    vitality: 12,
    ward: 10,
    thorns: 12,
    leech: 16,
    renewal: 13,
    recovery: 8,
    chill: 12,
    frostbite: 12,
    icefield: 12,
    impact: 12,
    suppression: 13,
    edict: 14,
  };
  const rank = (id: string): number => {
    const card = CARDS.find((item) => item.id === id);
    if (!card) return -1000;
    const count = synergyCount(stacks, card.synergy);
    const route = count > 0 && count < 9 ? count * (policy === "families" ? 7 : 5) : 0;
    const healing =
      hp < 45 && ["vitality", "ward", "leech", "renewal", "harvest"].includes(id) ? 20 : 0;
    const defense = policy === "defensive" && ["bastion", "blood"].includes(card.synergy) ? 35 : 0;
    return (weights[id] ?? 1) + route + healing + defense;
  };
  return [...choices].sort((a, b) => rank(b) - rank(a))[0];
}
