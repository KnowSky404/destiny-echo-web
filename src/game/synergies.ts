import { CARD_BY_ID, CARDS } from "../data/cards";
import { SYNERGIES } from "../data/synergies";
import type { SynergyId } from "./types";

export function synergyCount(stacks: ReadonlyMap<string, number>, id: SynergyId): number {
  return CARDS.filter((card) => card.synergy === id && (stacks.get(card.id) ?? 0) > 0).length;
}

export function synergyTier(stacks: ReadonlyMap<string, number>, id: SynergyId): 0 | 2 | 3 {
  const count = synergyCount(stacks, id);
  return count >= 3 ? 3 : count >= 2 ? 2 : 0;
}

export function synergyProgress(stacks: ReadonlyMap<string, number>) {
  return SYNERGIES.map((synergy) => ({
    ...synergy,
    count: synergyCount(stacks, synergy.id),
    tier: synergyTier(stacks, synergy.id),
    cards: CARDS.filter((card) => card.synergy === synergy.id).map((card) => ({
      id: card.id,
      name: card.name,
      owned: (stacks.get(card.id) ?? 0) > 0,
    })),
  }));
}

export function synergyPreview(stacks: ReadonlyMap<string, number>, cardId: string): string {
  const card = CARD_BY_ID.get(cardId);
  const synergy = SYNERGIES.find((item) => item.id === card?.synergy);
  if (!card || !synergy) return "";
  const count = synergyCount(stacks, synergy.id);
  if ((stacks.get(cardId) ?? 0) > 0) return `${synergy.name} ${count}/3 · 升级不重复计数`;
  const next = count + 1;
  return `${synergy.name} ${count} → ${next}/3${next === 2 ? " · 激活联动" : next === 3 ? " · 流派质变" : ""}`;
}
