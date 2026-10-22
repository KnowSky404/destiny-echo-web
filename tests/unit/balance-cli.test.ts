import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { RecordedRun, Summary } from "../../scripts/balance-sim/statistics";
import { CONFIG } from "../../src/game/config";

const root = resolve(import.meta.dir, "../..");
const temporary = await mkdtemp(join(tmpdir(), "echo-balance-cli-"));
afterAll(async () => {
  await rm(temporary, { recursive: true, force: true });
});

async function execute(args: string[]) {
  const child = Bun.spawn(["bun", "scripts/balance-simulator.ts", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 15000);
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, code };
  } finally {
    clearTimeout(timeout);
  }
}
async function read<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}
async function records(out: string): Promise<RecordedRun[]> {
  return (await readFile(join(out, "runs.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RecordedRun);
}
async function experiment(name: string, overrides: Record<string, unknown> = {}) {
  const path = join(temporary, `${name}.json`);
  await writeFile(
    path,
    JSON.stringify({
      seeds: [1],
      validationSeeds: [],
      strategies: [{ name: "build-auto" }],
      layouts: [{ id: "portrait", width: CONFIG.width }],
      maxSteps: 1,
      maxSeconds: CONFIG.fixedStep,
      maxRuns: 1,
      ...overrides,
    }),
  );
  return path;
}

describe("balance simulator CLI complete evidence and cancellation", () => {
  test("help exposes runnable contracts without starting an experiment", async () => {
    const result = await execute(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("balance:simulate");
    expect(result.stdout).toContain("balance:compare");
    expect(result.stdout).toContain("balance:sweep");
    expect(result.stdout).toContain("balance:replay");
  });

  test("a bounded run creates missing parent directories, complete reports and an exact replay", async () => {
    const config = await experiment("bounded");
    const out = join(temporary, "new-parent", "nested", "bounded");
    const result = await execute([
      "simulate",
      "--profile",
      "official",
      "--experiment",
      config,
      "--out",
      out,
    ]);
    expect(result.code).toBe(0);
    const manifest = await read<{ status: string; planned: number; completed: number }>(
      join(out, "manifest.json"),
    );
    expect(manifest).toMatchObject({ status: "complete", planned: 1, completed: 1 });
    for (const file of [
      "manifest.json",
      "runs.jsonl",
      "stages.csv",
      "summary.json",
      "report.md",
      "comparison.json",
    ])
      expect((await stat(join(out, file))).size).toBeGreaterThan(0);
    const runs = await records(out);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.result.termination).toBe("budget_exhausted");
    expect(runs[0]?.result.steps).toBe(1);
    const summary = await read<Summary>(join(out, "summary.json"));
    expect(summary.planned).toBe(1);
    expect(summary.completed).toBe(1);
    expect(summary.counts.budget_exhausted).toBe(1);
    expect(summary.counts.death).toBe(0);
    const replay = await execute(["replay", "--case", join(out, "cases", "budget_exhausted.json")]);
    expect(replay.code).toBe(0);
    expect(replay.stdout).toContain("精确复现通过");
    const originalManifest = await readFile(join(out, "manifest.json"), "utf8");
    const repeated = await execute(["simulate", "--experiment", config, "--out", out]);
    expect(repeated.code).toBe(1);
    expect(await readFile(join(out, "manifest.json"), "utf8")).toBe(originalManifest);
  }, 15000);

  test("normal GameOver is a successful CLI execution, independently of game outcome", async () => {
    const config = await experiment("natural-death", {
      seeds: [2401570752],
      strategies: [{ name: "random-auto" }],
      maxSteps: 78000,
      maxSeconds: 650,
    });
    const out = join(temporary, "natural-death");
    const result = await execute(["simulate", "--experiment", config, "--out", out]);
    expect(result.code).toBe(0);
    expect((await records(out))[0]?.result.termination).toBe("death");
    expect(await read(join(out, "manifest.json"))).toMatchObject({
      status: "complete",
      completed: 1,
    });
  }, 15000);

  test("invalid command options and budget overflow fail before running", async () => {
    const config = await experiment("invalid");
    const out = join(temporary, "must-not-exist");
    for (const args of [
      ["compare", "--profile", "official", "--candidate", "official"],
      ["sweep", "--profile", "official"],
      ["simulate", "--baseline", "official"],
      ["simulate", "--candidate", "official"],
      ["simulate", "--max-steps", "0"],
      ["simulate", "--seed-count", "2"],
      ["simulate", "--max-runs", "1", "--seeds", "1,2"],
      ["simulate", "--max-steps", "1", "--max-steps", "2"],
    ]) {
      const result = await execute([...args, "--experiment", config, "--out", out]);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Balance Simulator error");
    }
    expect(await Bun.file(join(out, "manifest.json")).exists()).toBe(false);
  }, 15000);

  test("two-candidate sweep reserves validation only for baseline and selected candidate", async () => {
    const file = join(temporary, "sweep.json");
    await writeFile(
      file,
      JSON.stringify({
        profile: "official",
        experiment: {
          seeds: [1],
          validationSeeds: [2],
          strategies: [{ name: "build-auto" }],
          layouts: [{ id: "portrait", width: CONFIG.width }],
          maxSteps: 1,
          maxSeconds: CONFIG.fixedStep,
          maxRuns: 5,
        },
        sweep: { label: "damage", paths: ["player.stats.damage"], values: [10, 14] },
      }),
    );
    const out = join(temporary, "sweep");
    const result = await execute(["sweep", "--experiment", file, "--out", out]);
    expect(result.code).toBe(0);
    const summary = await read<Summary>(join(out, "summary.json"));
    expect(summary.planned).toBe(5);
    expect(summary.completed).toBe(5);
    expect(summary.groups).toHaveLength(5);
    expect(summary.groups.reduce((sum, group) => sum + group.planned, 0)).toBe(5);
    expect(summary.groups.reduce((sum, group) => sum + group.missing, 0)).toBe(0);
    const runs = await records(out);
    expect(runs.filter((run) => run.cohort === "selection")).toHaveLength(3);
    expect(runs.filter((run) => run.cohort === "validation")).toHaveLength(2);
    expect(
      new Set(
        runs.filter((run) => run.cohort === "selection").map((run) => run.result.config.seed),
      ),
    ).toEqual(new Set([1]));
    expect(
      new Set(
        runs.filter((run) => run.cohort === "validation").map((run) => run.result.config.seed),
      ),
    ).toEqual(new Set([2]));
    const conflict = await execute([
      "sweep",
      "--baseline",
      join(temporary, "different-source.json"),
      "--experiment",
      file,
      "--out",
      join(temporary, "conflicting-sweep"),
    ]);
    expect(conflict.code).toBe(1);
    expect(conflict.stderr).toContain("Conflicting");
  }, 15000);

  test("SIGINT preserves completed runs, records a pre-start cancellation, and exposes all missing groups", async () => {
    const out = join(temporary, "interrupted");
    const child = Bun.spawn(
      ["bun", "scripts/balance-simulator.ts", "simulate", "--preset", "smoke", "--out", out],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    const timeout = setTimeout(() => child.kill("SIGKILL"), 20000);
    const stderr = new Response(child.stderr).text();
    const reader = child.stdout.getReader();
    let stdout = "";
    let signalled = false;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        stdout += new TextDecoder().decode(item.value);
        if (!signalled && stdout.includes("[1/12]")) {
          signalled = true;
          child.kill("SIGINT");
        }
      }
      const code = await child.exited;
      const errors = await stderr;
      expect(signalled).toBe(true);
      expect(errors).toBe("");
      expect(code).toBe(130);
      const manifest = await read<{ status: string; completed: number }>(
        join(out, "manifest.json"),
      );
      expect(manifest.status).toBe("interrupted");
      const runs = await records(out);
      expect(runs.length).toBeGreaterThan(1);
      expect(runs.length).toBeLessThan(12);
      expect(runs.filter((run) => run.result.termination === "cancelled")).toHaveLength(1);
      expect(runs.at(-1)?.result).toMatchObject({
        termination: "cancelled",
        steps: 0,
        playerSeconds: 0,
      });
      const summary = await read<Summary>(join(out, "summary.json"));
      expect(summary.planned).toBe(12);
      expect(summary.completed).toBe(runs.length);
      expect(summary.groups).toHaveLength(6);
      expect(summary.groups.reduce((sum, group) => sum + group.completed, 0)).toBe(runs.length);
      expect(summary.groups.reduce((sum, group) => sum + group.missing, 0)).toBe(12 - runs.length);
      expect(Object.values(summary.counts).reduce((sum, count) => sum + count, 0)).toBe(
        runs.length,
      );
      expect(summary.counts.cancelled).toBe(1);
      expect(manifest.completed).toBe(runs.length);
    } finally {
      clearTimeout(timeout);
      if (child.exitCode === null) {
        child.kill("SIGKILL");
        await child.exited;
      }
    }
  }, 25000);
});
