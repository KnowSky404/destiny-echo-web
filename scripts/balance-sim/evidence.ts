import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { contentHash } from "../../src/balance-sim/encoding";
import { parseReviewDocument } from "../../src/balance-sim/review";
import type { RunConfig, RunResult } from "../../src/balance-sim/types";
import type { BalanceProfile } from "../../src/data/balance/model";
import { CONFIG } from "../../src/game/config";

export const SIMULATOR_VERSION = "1";
export interface CodeIdentity {
  commit: string;
  dirty: boolean;
  fingerprint: string;
  bunVersion: string;
  fixedStep: number;
  files: Record<string, string>;
}
async function git(args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  const text = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) throw new Error(`Cannot read git identity: ${args.join(" ")}`);
  return text.trim();
}
export async function codeIdentity(): Promise<CodeIdentity> {
  const paths: string[] = [];
  async function collect(path: string) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      if (item.isDirectory()) await collect(join(path, item.name));
      else if (item.isFile()) paths.push(join(path, item.name));
    }
  }
  for (const dir of ["src/game", "src/data", "src/balance-sim", "scripts/balance-sim"])
    await collect(dir);
  paths.push("scripts/balance-simulator.ts", "package.json", "bun.lock", "tsconfig.json");
  const files: Record<string, string> = {};
  for (const path of paths.sort())
    files[path] = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  return {
    commit: await git(["rev-parse", "HEAD"]),
    dirty: Boolean(await git(["status", "--porcelain"])),
    fingerprint: await contentHash(files),
    bunVersion: Bun.version,
    fixedStep: CONFIG.fixedStep,
    files,
  };
}
export async function caseDocument(
  profile: BalanceProfile,
  profileHash: string,
  code: CodeIdentity,
  run: RunConfig,
  expected: RunResult,
) {
  return {
    schemaVersion: 1,
    kind: "balance-simulator-case",
    simulatorVersion: SIMULATOR_VERSION,
    profile,
    profileHash,
    code,
    run,
    expected,
    expectedHash: await contentHash(expected),
  };
}
export async function readJson(path: string): Promise<unknown> {
  const file = Bun.file(path);
  if (file.size > 8_000_000) throw new Error(`${path}: maximum JSON input 8 MB`);
  return JSON.parse(await file.text());
}
export async function readCase(path: string) {
  return parseReviewDocument(await readJson(path));
}
