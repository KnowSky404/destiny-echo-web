import { CARD_BY_ID, CARDS } from "../data/cards";
import { SYNERGIES, SYNERGY_THRESHOLDS } from "../data/synergies";
import { rewardName, synergyName, synergyTiers, tierName } from "../i18n/content";
import { type Locale, t } from "../i18n/locale";
import type { SynergyId, SynergyTier } from "./types";

// Every acquired layer counts, including repeat upgrades. The combat tier caps at nine.
export function synergyCount(stacks: ReadonlyMap<string, number>, id: SynergyId): number {
  let count = 0;
  for (const [cardId, layers] of stacks) {
    if (CARD_BY_ID.get(cardId)?.synergy === id) count += layers;
  }
  return count;
}

export function synergyTier(stacks: ReadonlyMap<string, number>, id: SynergyId): SynergyTier {
  const count = synergyCount(stacks, id);
  return count >= 9 ? 9 : count >= 6 ? 6 : count >= 3 ? 3 : 0;
}

export function synergyProgress(stacks: ReadonlyMap<string, number>, locale: Locale = "zh-CN") {
  return SYNERGIES.map((synergy) => ({
    ...synergy,
    name: synergyName(synergy.id, locale),
    tiers: synergyTiers(synergy.id, locale),
    count: synergyCount(stacks, synergy.id),
    tier: synergyTier(stacks, synergy.id),
    cards: CARDS.filter((card) => card.synergy === synergy.id).map((card) => ({
      id: card.id,
      name: rewardName(card.id, locale),
      owned: (stacks.get(card.id) ?? 0) > 0,
      stacks: stacks.get(card.id) ?? 0,
    })),
  }));
}

export function synergyUnlock(
  stacks: ReadonlyMap<string, number>,
  cardId: string,
): string | undefined {
  const card = CARD_BY_ID.get(cardId);
  if (!card) return;
  const next = synergyCount(stacks, card.synergy) + 1;
  const index = (SYNERGY_THRESHOLDS as readonly number[]).indexOf(next);
  return index < 0 ? undefined : synergyTiers(card.synergy)[index];
}

export function synergyPreview(stacks: ReadonlyMap<string, number>, cardId: string): string {
  const card = CARD_BY_ID.get(cardId);
  const synergy = SYNERGIES.find((item) => item.id === card?.synergy);
  if (!card || !synergy) return "";
  const count = synergyCount(stacks, synergy.id);
  const next = count + 1;
  const threshold = SYNERGY_THRESHOLDS.find((value) => value >= next);
  return `${synergyName(synergy.id)} ${count} → ${next}/${threshold ?? 9}${SYNERGY_THRESHOLDS.some((value) => value === next) ? ` · ${tierName(next as 3 | 6 | 9)}` : count >= 9 ? t(" · 大质变已生效", " · Final tier active") : t(" · 重复升级计入", " · Repeat upgrades count")}`;
}
