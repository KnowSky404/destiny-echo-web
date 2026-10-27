import { describe, expect, test } from "bun:test";
import { DEFAULT_EVOLUTION } from "../../src/data/balance/model";
import {
  defaultProfile,
  defaultRewardPolicy,
  migrateLegacyProfile,
  officialProfile,
  parseLegacyProfile,
  parseProfile,
  rewardPolicyAt,
} from "../../src/data/balance/profile";
import {
  applyCard,
  CARD_BY_ID,
  CARDS,
  drawBossCard,
  drawCards,
  eligibleCards,
} from "../../src/data/cards";
import { drawBossRewards, eligibleTrainings } from "../../src/data/training";
import { trainingsEarned, trainingThreshold } from "../../src/game/progression";
import { seededRandom } from "../../src/game/random";
import { createPlayer } from "../../src/game/world";
import { LEGACY_STORAGE_KEY, ProfileStore, STORAGE_KEY } from "../../src/ui/debug/store";

function legacyFixture() {
  const current = defaultProfile();
  const { evolution: _evolution, ...payload } = current.payload;
  return {
    ...current,
    schemaVersion: 1 as const,
    baseline: "balance-v1" as const,
    id: "original",
    payload,
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("progressive automatic training", () => {
  test("arithmetic marginal costs produce quadratic cumulative thresholds", () => {
    expect([0, 1, 2, 3, 5, 10, 20].map((n) => trainingThreshold(n, DEFAULT_EVOLUTION))).toEqual([
      0, 5000, 11500, 19500, 40000, 117500, 385000,
    ]);
    for (let n = 1; n < 100; n++) {
      const threshold = trainingThreshold(n, DEFAULT_EVOLUTION);
      expect(trainingsEarned(threshold - 1, DEFAULT_EVOLUTION)).toBe(n - 1);
      expect(trainingsEarned(threshold, DEFAULT_EVOLUTION)).toBe(n);
    }
    expect(trainingsEarned(100000, DEFAULT_EVOLUTION)).toBe(9);
    expect(trainingsEarned(1000000, DEFAULT_EVOLUTION)).toBe(33);
  });
  test("handles zero step, extreme finite credit and invalid inputs without unbounded loops", () => {
    expect(trainingsEarned(15000, { trainingBase: 5000, trainingStep: 0 })).toBe(3);
    expect(trainingsEarned(Number.MAX_VALUE, DEFAULT_EVOLUTION)).toBe(Number.MAX_SAFE_INTEGER);
    const enormous = { trainingBase: Number.MAX_VALUE, trainingStep: Number.MAX_VALUE };
    expect(trainingThreshold(2, enormous)).toBe(Number.MAX_VALUE);
    expect(trainingsEarned(Number.MAX_VALUE, enormous)).toBe(1);
    for (const score of [-1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => trainingsEarned(score, DEFAULT_EVOLUTION)).toThrow();
    for (const n of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(() => trainingThreshold(n, DEFAULT_EVOLUTION)).toThrow();
    expect(() => trainingsEarned(1, { trainingBase: 0, trainingStep: 1 })).toThrow();
  });
});

describe("v2 final reward offers", () => {
  test("haste candidates obey the configured permanent floor even during poison", () => {
    const player = createPlayer();
    player.stats.interval = 0.15;
    player.poisonTime = 3;
    player.shield = 0;
    const stacks = new Map([
      ["haste", 3],
      ["multishot", 3],
      ["piercing", 3],
    ]);
    const policy = {
      ...defaultRewardPolicy(),
      epicChance: 0,
      cardWeights: Object.fromEntries(CARDS.map((card) => [card.id, card.id === "haste" ? 1 : 0])),
    };
    expect(eligibleCards(player, stacks).some((card) => card.id === "haste")).toBe(false);
    expect(eligibleTrainings(player, stacks, 4).some((item) => item.id === "training-haste")).toBe(
      false,
    );
    expect(drawCards(player, stacks, seededRandom(1), "supply", 4, policy)).toEqual([]);
    expect(drawBossCard(player, stacks, seededRandom(1), 4, policy)).toBeUndefined();
    expect(applyCard("haste", player, stacks)).toBe(false);
    expect(drawCards(player, stacks, seededRandom(1), "supply", 4, policy, 0.08)).toEqual([
      "haste",
    ]);
    expect(drawBossRewards(player, stacks, seededRandom(1), 4, policy, 0.08)).toContain("haste");
    expect(applyCard("haste", player, stacks, 0.08)).toBe(true);
    expect(player.stats.interval).toBeCloseTo(0.132);
  });
  test("official rarity probabilities rise across four campaign stages and then endless", () => {
    const profile = officialProfile();
    for (const source of ["chest", "supply", "stage"] as const)
      expect(
        [0, 1, 2, 3, 4, 10].map((index) => rewardPolicyAt(profile, index, source).epicChance),
      ).toEqual([0.1, 0.15, 0.2, 0.25, 0.3, 0.3]);
  });
  test("the final three-card offer and single boss card each use the declared rarity rate", () => {
    const player = createPlayer();
    const samples = 2000;
    for (const stageIndex of [0, 1, 2, 3, 4]) {
      const policy = rewardPolicyAt(officialProfile(), stageIndex, "stage");
      let offers = 0;
      let bossCards = 0;
      for (let seed = 0; seed < samples; seed++) {
        const choices = drawCards(
          player,
          new Map(),
          seededRandom(seed),
          "chest",
          stageIndex,
          policy,
        );
        const epics = choices.filter((id) => CARD_BY_ID.get(id)?.rarity === "epic");
        expect(epics.length).toBeLessThanOrEqual(1);
        expect(new Set(choices).size).toBe(choices.length);
        offers += epics.length;
        const card = drawBossCard(player, new Map(), seededRandom(seed), stageIndex, policy);
        if (card && CARD_BY_ID.get(card)?.rarity === "epic") bossCards++;
      }
      expect(Math.abs(offers / samples - policy.epicChance)).toBeLessThan(0.035);
      expect(Math.abs(bossCards / samples - policy.epicChance)).toBeLessThan(0.035);
    }
  });
  test("boss reward composition does not dilute a guaranteed epic or restore disabled candidates", () => {
    const policy = { ...defaultRewardPolicy(), epicChance: 1 };
    for (let seed = 0; seed < 40; seed++) {
      const offer = drawBossRewards(createPlayer(), new Map(), seededRandom(seed), 1, policy);
      expect(offer.filter((id) => id.startsWith("training-"))).toHaveLength(2);
      expect(offer.filter((id) => CARD_BY_ID.get(id)?.rarity === "epic")).toHaveLength(1);
    }
    policy.cardWeights = Object.fromEntries(
      CARDS.map((card) => [card.id, card.id === "ward" ? 1 : 0]),
    );
    expect(drawBossCard(createPlayer(), new Map(), seededRandom(2), 1, policy)).toBe("ward");
  });
  test("mature families offer continuation, fixed complement and a distinct free choice", () => {
    const player = createPlayer();
    const policy = { ...defaultRewardPolicy(), epicChance: 0 };
    for (let seed = 0; seed < 60; seed++) {
      const early = drawCards(
        player,
        new Map([["force", 8]]),
        seededRandom(seed),
        "supply",
        4,
        policy,
      );
      expect(early.slice(0, 2).every((id) => CARD_BY_ID.get(id)?.synergy === "might")).toBe(true);
      const mature = drawCards(
        player,
        new Map([["force", 9]]),
        seededRandom(seed),
        "supply",
        4,
        policy,
      );
      expect(CARD_BY_ID.get(mature[0] ?? "")?.synergy).toBe("might");
      expect(CARD_BY_ID.get(mature[1] ?? "")?.synergy).toBe("giantslayer");
      expect(new Set(mature).size).toBe(3);
    }
    policy.cardWeights = Object.fromEntries(
      CARDS.map((card) => [card.id, card.synergy === "giantslayer" ? 0 : 1]),
    );
    expect(
      drawCards(player, new Map([["force", 9]]), seededRandom(1), "supply", 4, policy),
    ).toHaveLength(3);
  });
});

describe("explicit legacy profile migration", () => {
  test("v2 round trips strictly and v1 requires a new migrated identity", () => {
    const current = defaultProfile();
    expect(parseProfile(JSON.parse(JSON.stringify(current)))).toEqual(current);
    const legacy = legacyFixture();
    const before = JSON.stringify(legacy);
    expect(() => parseProfile(legacy)).toThrow("显式迁移");
    expect(parseLegacyProfile(legacy)).toEqual(legacy);
    const migrated = migrateLegacyProfile(legacy);
    expect(migrated.id).not.toBe(legacy.id);
    expect(migrated.revision).toBe(1);
    expect(migrated.payload.evolution).toEqual(DEFAULT_EVOLUTION);
    expect(migrated.payload.player).toEqual(legacy.payload.player);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(() =>
      parseLegacyProfile({ ...legacy, payload: { ...legacy.payload, unexpected: 1 } }),
    ).toThrow();
  });
  test("opening v2 preserves v1 storage; explicit migration saves without activation or draft replacement", () => {
    const storage = memoryStorage();
    const legacy = legacyFixture();
    const original = JSON.stringify({
      draft: legacy,
      versions: [legacy],
      selected: { id: legacy.id, revision: 1 },
    });
    storage.setItem(LEGACY_STORAGE_KEY, original);
    const store = new ProfileStore(storage);
    expect(store.active).toBeUndefined();
    expect(store.state.versions).toHaveLength(0);
    expect(store.legacyProfiles).toHaveLength(2);
    expect(store.legacyStorageRaw).toBe(original);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    const draft = structuredClone(store.state.draft);
    const migrated = store.migrateLegacy(0);
    expect(store.state.versions).toEqual([migrated]);
    expect(store.state.draft).toEqual(draft);
    expect(store.active).toBeUndefined();
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(original);
    const reopened = new ProfileStore(storage);
    expect(reopened.state.versions).toEqual([migrated]);
    expect(reopened.active).toBeUndefined();
    expect(reopened.legacyStorageRaw).toBe(original);
  });
  test("corrupt v1 storage remains exportable and does not prevent saving current profiles", () => {
    const storage = memoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY, "malformed legacy data");
    const store = new ProfileStore(storage);
    expect(store.legacyStorageRaw).toBe("malformed legacy data");
    expect(store.warning).toContain("v1");
    store.saveVersion();
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe("malformed legacy data");
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});

test("mature defensive builds keep a legal foundation option even after epic promotion", () => {
  const profile = defaultProfile();
  const policy = profile.payload.rewards.supply;
  policy.firstStageRestriction = false;
  policy.epicChance = 1;
  policy.cardWeights = Object.fromEntries(
    CARDS.map((card) => [
      card.id,
      card.id === "recovery"
        ? 1000
        : ["renewal", "ward", "force", "crimson-grail"].includes(card.id)
          ? 1
          : 0,
    ]),
  );
  for (let seed = 1; seed <= 20; seed++) {
    const choices = drawCards(
      createPlayer(),
      new Map([["leech", 9]]),
      seededRandom(seed),
      "supply",
      4,
      policy,
    );
    expect(choices).toContain("force");
    expect(choices).toContain("crimson-grail");
    expect(new Set(choices).size).toBe(choices.length);
  }
});
