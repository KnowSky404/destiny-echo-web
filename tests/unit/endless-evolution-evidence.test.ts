import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseExperiment } from "../../scripts/balance-sim/config";
import { codeIdentity } from "../../scripts/balance-sim/evidence";
import type { RecordedRun } from "../../scripts/balance-sim/statistics";
import {
  auditEvolutionRuns,
  collectEvolutionEvidence,
} from "../../scripts/endless-evolution-evidence";
import { contentHash } from "../../src/balance-sim/encoding";
import { runNatural } from "../../src/balance-sim/runner";
import type { RunResult } from "../../src/balance-sim/types";
import { defaultProfile } from "../../src/data/balance/profile";

const fixtureFor = async (mode: "campaign" | "endless") => {
  const profile = defaultProfile();
  profile.payload.player.stats.damage = 100000;
  profile.payload.stageRules = [
    {
      from: 1,
      to: null,
      stage: { enemyCount: 0, supportCount: 0, bossAt: 0, bossHp: 1 },
      kindWeights: null,
      rewards: {},
    },
  ];
  const config = parseExperiment({
    mode,
    endlessTarget: 1,
    seeds: [4],
    validationSeeds: [],
    strategies: [{ name: "build-auto" }],
    layouts: [{ id: "portrait", width: 450 }],
    maxSteps: mode === "endless" ? 7200 : 3600,
    maxSeconds: mode === "endless" ? 60 : 30,
  });
  const result = runNatural(
    {
      seed: 4,
      width: 450,
      strategy: { name: "build-auto" },
      mode: config.mode,
      maxSteps: config.maxSteps,
      maxSeconds: config.maxSeconds,
      endlessTarget: config.endlessTarget,
      trace: config.trace,
      sampleIntervalSeconds: config.sampleIntervalSeconds,
      traceCapacity: config.traceCapacity,
      deathWindowSeconds: config.deathWindowSeconds,
      eventCapacity: config.eventCapacity,
    },
    profile,
  );
  const hash = await contentHash(profile);
  const record: RecordedRun = {
    id: "fixture",
    cohort: "selection",
    profileHash: hash,
    profileId: profile.id,
    profileName: profile.name,
    layoutId: "portrait",
    wallTimeMs: 1,
    result,
  };
  return { config, profile: { hash, name: profile.name }, profileDocument: profile, record };
};
const fixture = fixtureFor("campaign");
const endlessFixture = fixtureFor("endless");

async function withArchive(
  mode: "campaign" | "endless",
  check: (archive: {
    directory: string;
    actual: Awaited<ReturnType<typeof fixtureFor>>;
    manifest: {
      status: string;
      finishedAt: string | null;
      planned: number;
      completed: number;
      startedAt: string;
      config: Awaited<ReturnType<typeof fixtureFor>>["config"];
      code: Awaited<ReturnType<typeof codeIdentity>>;
      profiles: Array<{
        profile: Awaited<ReturnType<typeof fixtureFor>>["profileDocument"];
        hash: string;
      }>;
    };
    saveManifest: () => Promise<void>;
  }) => Promise<void>,
) {
  const actual = structuredClone(await (mode === "campaign" ? fixture : endlessFixture));
  const directory = await mkdtemp(join(tmpdir(), "echoes-candidate-evidence-"));
  const manifest = {
    status: "complete",
    startedAt: "2026-10-23T00:00:00.000Z",
    finishedAt: "2026-10-23T00:00:01.000Z" as string | null,
    planned: 1,
    completed: 1,
    config: actual.config,
    code: await codeIdentity(),
    profiles: [{ profile: actual.profileDocument, hash: actual.profile.hash }],
  };
  const saveManifest = () => writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
  try {
    await mkdir(join(directory, "profiles"));
    await writeFile(
      join(directory, "profiles", `${actual.profile.hash}.json`),
      JSON.stringify(actual.profileDocument),
    );
    await writeFile(join(directory, "runs.jsonl"), `${JSON.stringify(actual.record)}\n`);
    await saveManifest();
    await check({ directory, actual, manifest, saveManifest });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("candidate-only evidence archives", () => {
  test("complete campaign and endless archives retain hashes and have no invented comparison", async () => {
    for (const mode of ["campaign", "endless"] as const)
      await withArchive(mode, async ({ directory, actual, manifest }) => {
        const report = await collectEvolutionEvidence(directory, actual.config);
        expect(report.kind).toBe("endless-evolution-candidate-evidence");
        expect(report.candidate.summary.completed).toBe(1);
        expect(report.candidate.code.fingerprint).toBe(manifest.code.fingerprint);
        expect(report.candidate.profileHash).toBe(actual.profile.hash);
        expect(report.candidate.groups).toHaveLength(1);
        for (const [key, file] of [
          ["rawHash", "runs.jsonl"],
          ["manifestHash", "manifest.json"],
        ] as const)
          expect(report.candidate[key]).toBe(
            createHash("sha256")
              .update(await readFile(join(directory, file)))
              .digest("hex"),
          );
        expect(report).not.toHaveProperty("baseline");
        expect(report).not.toHaveProperty("paired");
        expect(report.candidate).not.toHaveProperty("runs");
      });
  });

  test("stale code, altered profile snapshots and incomplete matrices are rejected", async () => {
    await withArchive("campaign", async ({ directory, actual, manifest, saveManifest }) => {
      const [path] = Object.keys(manifest.code.files);
      if (!path) throw new Error("Missing code fixture");
      manifest.code.files[path] = "0".repeat(64);
      manifest.code.fingerprint = await contentHash(manifest.code.files);
      await saveManifest();
      await expect(collectEvolutionEvidence(directory, actual.config)).rejects.toThrow(
        "current simulation code",
      );
    });
    await withArchive("campaign", async ({ directory, actual }) => {
      await writeFile(
        join(directory, "profiles", `${actual.profile.hash}.json`),
        JSON.stringify({ ...actual.profileDocument, name: "Altered snapshot" }),
      );
      await expect(collectEvolutionEvidence(directory, actual.config)).rejects.toThrow(
        "Archived profile hash differs",
      );
    });
    await withArchive("campaign", async ({ directory, actual, manifest, saveManifest }) => {
      manifest.config.seeds.push(5);
      await saveManifest();
      await expect(collectEvolutionEvidence(directory, actual.config)).rejects.toThrow("Missing");
    });
  });

  test("failed manifests and unresolved results cannot pass candidate-only collection", async () => {
    for (const status of ["running", "failed"])
      await withArchive("campaign", async ({ directory, actual, manifest, saveManifest }) => {
        manifest.status = status;
        await saveManifest();
        await expect(collectEvolutionEvidence(directory, actual.config)).rejects.toThrow(
          "incomplete",
        );
      });
    await withArchive("campaign", async ({ directory, actual }) => {
      actual.record.result.termination = "budget_exhausted";
      await writeFile(join(directory, "runs.jsonl"), `${JSON.stringify(actual.record)}\n`);
      await expect(collectEvolutionEvidence(directory, actual.config)).rejects.toThrow(
        "budget-exhausted",
      );
    });
  });

  test("the CLI accepts an explicit candidate without a baseline and never overwrites evidence", async () => {
    await withArchive("campaign", async ({ directory, actual }) => {
      const experiment = join(directory, "experiment.json");
      const output = join(directory, "accepted.json");
      await writeFile(experiment, JSON.stringify(actual.config));
      const command = [
        process.execPath,
        resolve("scripts/endless-evolution-evidence.ts"),
        "--candidate",
        directory,
        "--experiment",
        experiment,
        "--out",
        output,
      ];
      const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
      const [stdout, stderr, exit] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect(exit).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toContain("1 candidate runs");
      const original = await readFile(output, "utf8");
      const report = JSON.parse(original);
      expect(report.kind).toBe("endless-evolution-candidate-evidence");
      expect(report).not.toHaveProperty("paired");
      const repeated = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
      const [, repeatedError, repeatedExit] = await Promise.all([
        new Response(repeated.stdout).text(),
        new Response(repeated.stderr).text(),
        repeated.exited,
      ]);
      expect(repeatedExit).toBe(1);
      expect(repeatedError).toContain("EEXIST");
      expect(await readFile(output, "utf8")).toBe(original);
    });
  });
});

describe("strict endless evolution evidence acceptance", () => {
  test("resolved natural runs and legacy evidence without new telemetry remain distinguishable", async () => {
    const { config, profile, record } = await fixture;
    expect(auditEvolutionRuns([record], config, profile, true).completed).toBe(1);
    const legacy = structuredClone(record);
    legacy.result.steps -= Math.round(
      legacy.result.evolution.presentationSeconds / legacy.result.fixedStep,
    );
    delete (legacy.result as Partial<RunResult>).evolution;
    expect(auditEvolutionRuns([legacy], config, profile, false).completed).toBe(1);
    expect(() => auditEvolutionRuns([legacy], config, profile, true)).toThrow();
  });

  test("missing, repeated and unplanned seed/strategy/layout samples are rejected", async () => {
    const { config, profile, record } = await fixture;
    expect(() => auditEvolutionRuns([], config, profile, true)).toThrow("Missing");
    expect(() => auditEvolutionRuns([record, record], config, profile, true)).toThrow("Duplicate");
    for (const patch of [{ seed: 99 }, { width: 1600 }, { strategy: { name: "random-auto" } }]) {
      const copy = structuredClone(record);
      Object.assign(copy.result.config, patch);
      expect(() => auditEvolutionRuns([copy], config, profile, true)).toThrow();
    }
  });

  test("unresolved or invalid runs never become gameplay defeats or passing samples", async () => {
    const { config, profile, record } = await fixture;
    for (const termination of ["budget_exhausted", "cancelled", "error"] as const) {
      const copy = structuredClone(record);
      copy.result.termination = termination;
      expect(() => auditEvolutionRuns([copy], config, profile, true)).toThrow();
    }
    const copy = structuredClone(record);
    copy.result.validMetrics = false;
    expect(() => auditEvolutionRuns([copy], config, profile, true)).toThrow();
  });

  test("a successful result must satisfy the declared campaign or endless objective", async () => {
    for (const actual of [await fixture, await endlessFixture]) {
      expect(actual.record.result.termination).toBe(
        actual.config.mode === "campaign" ? "campaign_victory" : "endless_target_reached",
      );
      expect(
        auditEvolutionRuns([actual.record], actual.config, actual.profile, true).completed,
      ).toBe(1);
      const otherMode = actual.config.mode === "campaign" ? "endless" : "campaign";
      const mismatched = structuredClone(actual.record);
      mismatched.result.config.mode = otherMode;
      expect(() =>
        auditEvolutionRuns(
          [mismatched],
          { ...actual.config, mode: otherMode },
          actual.profile,
          true,
        ),
      ).toThrow("experiment mode");
    }
  });

  test("campaign and endless success require a living player", async () => {
    for (const actual of [await fixture, await endlessFixture]) {
      for (const hp of [0, -1]) {
        const defeated = structuredClone(actual.record);
        defeated.result.final.hp = hp;
        expect(() => auditEvolutionRuns([defeated], actual.config, actual.profile, true)).toThrow(
          "positive final HP",
        );
      }
    }
  });

  test("null metrics, attack counter drift and unsafe cast evidence fail closed", async () => {
    const { config, profile, record } = await fixture;
    const missing = structuredClone(record);
    Object.assign(missing.result.metrics, { enemyDamage: null });
    expect(() => auditEvolutionRuns([missing], config, profile, true)).toThrow();
    const attacks = structuredClone(record);
    const first = attacks.result.stages[0];
    if (!first) throw new Error("Missing stage fixture");
    first.enemyAttacks++;
    expect(() => auditEvolutionRuns([attacks], config, profile, true)).toThrow("enemyAttacks");
    for (const key of [
      "unwarnedReleases",
      "prematureReleases",
      "missingLifecycleEvents",
    ] as const) {
      const cast = structuredClone(record);
      cast.result.evolution[key]++;
      expect(() => auditEvolutionRuns([cast], config, profile, true)).toThrow("observations");
    }
  });

  test("training score and lifecycle stage totals must exactly reconcile", async () => {
    const { config, profile, record } = await fixture;
    const score = structuredClone(record);
    score.result.final.trainingScore++;
    expect(() => auditEvolutionRuns([score], config, profile, true)).toThrow("trainingScore");
    const lifetime = structuredClone(record);
    lifetime.result.evolution.ttk.boss.sum++;
    expect(() => auditEvolutionRuns([lifetime], config, profile, true)).toThrow("ttk");
  });

  test("attack counts require exact safe integers even above floating-point tolerance scales", async () => {
    const { config, profile, record } = await fixture;
    for (const [reported, observed] of [
      [10_000_001, 10_000_000],
      [0.5, 0.5],
      [1e-8, 0],
      [Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1],
    ]) {
      const drift = structuredClone(record);
      const stage = drift.result.stages[0];
      if (!stage || reported === undefined || observed === undefined)
        throw new Error("Missing attack fixture");
      stage.enemyAttacks = reported;
      stage.metrics.mechanics.enemy_attack = observed;
      expect(() => auditEvolutionRuns([drift], config, profile, true)).toThrow("enemyAttacks");
    }
    const missing = structuredClone(record);
    const first = missing.result.stages[0];
    if (!first) throw new Error("Missing attack fixture");
    first.enemyAttacks = 0;
    delete first.metrics.mechanics.enemy_attack;
    expect(auditEvolutionRuns([missing], config, profile, true).completed).toBe(1);
    Object.assign(first.metrics.mechanics, { enemy_attack: null });
    expect(() => auditEvolutionRuns([missing], config, profile, true)).toThrow();
  });
});
