import { describe, expect, test } from "bun:test";
import { groupSummary } from "../../scripts/balance-sim/statistics";
import { contentHash } from "../../src/balance-sim/encoding";
import { parseReviewCase, parseReviewDocument } from "../../src/balance-sim/review";
import { runNatural } from "../../src/balance-sim/runner";
import type { RunConfig } from "../../src/balance-sim/types";
import { officialProfile } from "../../src/data/balance/profile";
import { ProfileStore, STORAGE_KEY } from "../../src/ui/debug/store";

async function fixture() {
  const profile = officialProfile();
  const run: RunConfig = {
    seed: 57,
    width: 450,
    mode: "campaign",
    strategy: { name: "build-auto" },
    maxSteps: 120,
    maxSeconds: 2,
    endlessTarget: 2,
  };
  const expected = runNatural(run, profile);
  return {
    schemaVersion: 1,
    kind: "balance-simulator-case",
    simulatorVersion: "1",
    profile,
    profileHash: await contentHash(profile),
    code: { commit: "fixture", dirty: false, fingerprint: "fixture" },
    run,
    expected,
    expectedHash: await contentHash(expected),
  };
}

describe("portable PRE experiment review", () => {
  test("candidate import saves a distinct version while preserving draft, selection and prior versions", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const store = new ProfileStore(storage);
    const original = store.saveVersion();
    store.select(original);
    store.state.draft.name = "preserve current draft";
    store.persist();
    const before = structuredClone(store.state);
    const candidate = officialProfile();
    candidate.payload.player.stats.damage = 51;
    const imported = await store.withWriteLock(() =>
      store.importVersion(JSON.stringify(candidate)),
    );
    expect(imported.id).not.toBe(candidate.id);
    expect(imported.revision).toBe(1);
    expect(imported.payload).toEqual(candidate.payload);
    expect(JSON.stringify(store.state.draft)).toBe(JSON.stringify(before.draft));
    expect(JSON.stringify(store.state.selected)).toBe(JSON.stringify(before.selected));
    expect(store.state.versions).toEqual([...before.versions, imported]);
    expect(new ProfileStore(storage).state).toEqual(store.state);
    const stale = new ProfileStore(storage);
    store.importVersion(JSON.stringify(candidate));
    const persisted = storage.getItem(STORAGE_KEY);
    await expect(
      stale.withWriteLock(() => stale.importVersion(JSON.stringify(candidate))),
    ).rejects.toThrow("其他 PRE 标签页");
    expect(storage.getItem(STORAGE_KEY)).toBe(persisted);
  });
  test("candidate persistence failure rolls back the entire version operation", () => {
    const values = new Map<string, string>();
    let full = false;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (full) throw new Error("Quota exceeded");
        values.set(key, value);
      },
    };
    const store = new ProfileStore(storage);
    store.select(store.saveVersion());
    store.state.draft.name = "preserved";
    store.persist();
    const before = structuredClone(store.state);
    const persisted = storage.getItem(STORAGE_KEY);
    full = true;
    expect(() => store.importVersion(JSON.stringify(officialProfile()))).toThrow("固定版本未保存");
    expect(store.state).toEqual(before);
    expect(storage.getItem(STORAGE_KEY)).toBe(persisted);
    full = false;
    expect(store.importVersion(JSON.stringify(officialProfile())).revision).toBe(1);
  });
  test("accepts an exported saved PRE profile without changing its identity or payload", async () => {
    const store = new ProfileStore(undefined);
    store.state.draft.payload.player.stats.damage = 27;
    const saved = store.saveVersion();
    const input = await fixture();
    input.profile = JSON.parse(JSON.stringify(saved));
    input.profileHash = await contentHash(input.profile);
    const parsed = await parseReviewDocument(input);
    expect(parsed.kind).toBe("balance-simulator-case");
    if (parsed.kind !== "balance-simulator-case") throw new Error("Expected case");
    expect(parsed.profile).toEqual(saved);
    parsed.profile.payload.player.stats.damage = 90;
    expect(saved.payload.player.stats.damage).toBe(27);
    expect(input.profile.payload.player.stats.damage).toBe(27);
  });
  test("rejects mismatched profile and result evidence before manual preparation", async () => {
    const input = await fixture();
    input.profile.payload.player.stats.damage++;
    await expect(parseReviewDocument(input)).rejects.toThrow("profileHash");
    input.profileHash = await contentHash(input.profile);
    input.expected.final.hp = 5;
    await expect(parseReviewDocument(input)).rejects.toThrow("expectedHash");
  });
  test("preserves explicitly invalid error diagnostics and rejects unmarked placeholder values", async () => {
    const input = await fixture();
    input.expected.termination = "error";
    input.expected.validMetrics = false;
    input.expected.invalidValues = [{ path: "final.hp", value: "NaN" }];
    input.expected.final.hp = 0;
    input.expectedHash = await contentHash(input.expected);
    const parsed = await parseReviewDocument(input);
    if (parsed.kind !== "balance-simulator-case") throw new Error("Expected case");
    expect(parsed.expected.validMetrics).toBe(false);
    expect(parsed.expected.invalidValues).toEqual([{ path: "final.hp", value: "NaN" }]);
    input.expected.validMetrics = true;
    expect(() => parseReviewCase(input)).toThrow("数值有效性");
  });
  test("rejects incompatible versions, illegal seeds, layouts, budgets, and unknown outcomes", async () => {
    const good = await fixture();
    for (const change of [
      (input: typeof good) => {
        input.schemaVersion = 2;
      },
      (input: typeof good) => {
        input.simulatorVersion = "2";
      },
      (input: typeof good) => {
        input.run.seed = -1;
      },
      (input: typeof good) => {
        input.run.width = 2401;
      },
      (input: typeof good) => {
        input.run.maxSteps = 0;
      },
      (input: typeof good) => {
        input.run.maxSeconds = Number.NaN;
      },
      (input: typeof good) => {
        input.run.strategy.name = "cheating" as "build-auto";
      },
      (input: typeof good) => {
        input.expected.termination = "success" as "death";
      },
    ]) {
      const input = structuredClone(good);
      change(input);
      expect(() => parseReviewCase(input)).toThrow();
    }
  });
  test("summary import requires a versioned envelope and finite structured groups", async () => {
    const sample = await fixture();
    const group = groupSummary(
      [
        {
          id: "fixture",
          cohort: "selection",
          profileHash: sample.profileHash,
          profileId: sample.profile.id,
          profileName: "<script>never execute</script>",
          layoutId: "phone",
          wallTimeMs: 0,
          result: sample.expected,
        },
      ],
      1,
    );
    const summary = {
      schemaVersion: 1,
      simulatorVersion: "1",
      kind: "balance-simulator-summary",
      planned: 1,
      completed: 1,
      counts: group.counts,
      groups: [group],
    };
    expect(JSON.stringify(await parseReviewDocument(summary))).toEqual(JSON.stringify(summary));
    await expect(parseReviewDocument({ ...summary, groups: [null] })).rejects.toThrow();
    await expect(parseReviewDocument({ ...summary, groups: [{ runs: Infinity }] })).rejects.toThrow(
      "非有限",
    );
    await expect(parseReviewDocument({ ...summary, groups: "not-array" })).rejects.toThrow();
    for (const mutate of [
      (value: typeof summary) => {
        value.completed = 1234;
        value.planned = 1234;
        value.counts.budget_exhausted = 1234;
      },
      (value: typeof summary) => {
        const first = value.groups[0];
        if (first) first.winRate = 1;
      },
      (value: typeof summary) => {
        const first = value.groups[0];
        if (first) first.unresolvedRatio = 0;
      },
      (value: typeof summary) => {
        const first = value.groups[0];
        if (first) first.winRateCI95 = [0, 1];
      },
      (value: typeof summary) => {
        const first = value.groups[0];
        if (first) first.winRateBounds = [0, 0];
      },
      (value: typeof summary) => {
        value.groups.push(structuredClone(group));
        value.planned = 2;
        value.completed = 2;
        value.counts.budget_exhausted = 2;
      },
    ]) {
      const tampered = structuredClone(summary);
      mutate(tampered);
      await expect(parseReviewDocument(tampered)).rejects.toThrow();
    }
  });
});
