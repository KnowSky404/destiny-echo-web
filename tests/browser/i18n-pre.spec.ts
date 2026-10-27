import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { contentHash } from "../../src/balance-sim/encoding";
import { runNatural } from "../../src/balance-sim/runner";
import type { RunConfig } from "../../src/balance-sim/types";
import { officialProfile } from "../../src/data/balance/profile";
import { boot, snapshot, start } from "./helpers";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }, info) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", (error) => messages.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") messages.push(message.text());
  });
  if (info.project.name.includes("touch")) return page.setViewportSize({ width: 320, height: 740 });
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

async function language(page: Page, locale: "en" | "zh-CN") {
  await page.locator(".debug-header select").selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

async function englishPanel(page: Page, userNames: string[] = []) {
  const content = await page.locator("#debug-dialog").evaluate((dialog) => {
    const clone = dialog.cloneNode(true) as HTMLElement;
    // Language autonyms and raw imported evidence are intentionally original.
    for (const element of clone.querySelectorAll(".debug-header select, pre")) element.remove();
    return clone.textContent ?? "";
  });
  let translated = content;
  for (const name of userNames) translated = translated.replaceAll(name, "user profile");
  expect(translated).not.toMatch(/\p{Script=Han}/u);
  const labels = await page
    .locator("#debug-dialog [aria-label]")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label") ?? ""));
  for (const label of labels) expect(label).not.toMatch(/\p{Script=Han}/u);
}

async function switchBack(page: Page, tab: string) {
  const index = await page
    .locator('#debug-dialog [role="tab"][aria-selected="true"]')
    .getAttribute("id");
  await language(page, "zh-CN");
  await expect(page.locator("#debug-title")).toHaveText("PRE 数值实验室");
  await language(page, "en");
  await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(`#${index}`)).toHaveAttribute("aria-selected", "true");
}

test("English PRE tabs preserve pending numeric edits, checkboxes, selections and profile names on language switches", async ({
  page,
}, info) => {
  await boot(page);
  await start(page);
  await page.locator("#debug-trigger").click();
  await language(page, "en");
  await expect(page.locator("#debug-title")).toHaveText("PRE Balance Lab");
  await englishPanel(page);
  await page.getByLabel("Current HP", { exact: true }).fill("73");
  await page.getByLabel("Override Base damage", { exact: true }).check();
  await page
    .locator(".debug-override")
    .getByRole("spinbutton", { name: "Base damage", exact: true })
    .fill("88.125");
  await page.getByText("Augments & training: add, remove and set stacks", { exact: true }).click();
  await page.getByLabel("Might Sigil", { exact: true }).fill("2");
  const before = await snapshot(page);
  await switchBack(page, "Player & build");
  expect(await snapshot(page)).toEqual(before);
  await expect(page.getByLabel("Current HP", { exact: true })).toHaveValue("73");
  await expect(page.getByLabel("Override Base damage", { exact: true })).toBeChecked();
  await expect(
    page.locator(".debug-override").getByRole("spinbutton", { name: "Base damage", exact: true }),
  ).toHaveValue("88.125");
  await expect(page.getByLabel("Might Sigil", { exact: true })).toHaveValue("2");
  await expect(
    page.locator("details").filter({
      has: page.getByText("Augments & training: add, remove and set stacks", { exact: true }),
    }),
  ).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Apply player changes", exact: true }).click();
  expect((await snapshot(page)).player.hp).toBe(73);
  expect((await snapshot(page)).player.stats.damage).toBe(88.125);
  await englishPanel(page);

  await page.getByRole("tab", { name: "Enemies & spawning", exact: true }).click();
  await englishPanel(page);
  await page.getByLabel("Enemy kind", { exact: true }).selectOption("tank");
  await page.getByLabel("Enemy count", { exact: true }).fill("3");
  await page.getByLabel("Edit Base damage", { exact: true }).check();
  await switchBack(page, "Enemies & spawning");
  await expect(page.getByLabel("Enemy kind", { exact: true })).toHaveValue("tank");
  await expect(page.getByLabel("Enemy count", { exact: true })).toHaveValue("3");
  await expect(page.getByLabel("Edit Base damage", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Spawn in arena", exact: true }).click();
  await expect(page.locator(".debug-status")).toContainText("Spawned 3 enemies");
  await englishPanel(page);

  await page.getByRole("tab", { name: "Stage controls", exact: true }).click();
  await englishPanel(page);
  await page.getByLabel("Target stage (1–4 campaign; 5+ endless)", { exact: true }).fill("7");
  await page.getByLabel("Reset player and build when jumping", { exact: true }).check();
  await switchBack(page, "Stage controls");
  await expect(
    page.getByLabel("Target stage (1–4 campaign; 5+ endless)", { exact: true }),
  ).toHaveValue("7");
  await expect(
    page.getByLabel("Reset player and build when jumping", { exact: true }),
  ).toBeChecked();

  await page.getByRole("tab", { name: "Profile versions", exact: true }).click();
  await englishPanel(page);
  const name = "覆盖 基础伤害 {label} 已保存 X";
  await page.getByLabel("Profile name", { exact: true }).fill(name);
  await switchBack(page, "Profile versions");
  await expect(page.getByLabel("Profile name", { exact: true })).toHaveValue(name);
  await englishPanel(page, [name]);
  const official = officialProfile();
  const revision = official.id === "default" ? 1 : official.revision + 1;
  await page.getByRole("button", { name: "Save new version", exact: true }).click();
  await expect(page.locator(".debug-status")).toContainText(`Saved ${name} v${revision}`);
  await englishPanel(page, [name]);
  await expect(page.locator(".debug-version strong")).toHaveText(`${name} v${revision}`);
  await page.getByRole("button", { name: "Activate version for testing", exact: true }).click();
  await expect(page.locator(".debug-version strong")).toHaveText(
    `${name} v${revision} · Reuse on next visit`,
  );
  await switchBack(page, "Profile versions");
  await expect(page.locator(".debug-version strong")).toHaveText(
    `${name} v${revision} · Reuse on next visit`,
  );
  await englishPanel(page, [name]);

  // Invalid imports keep the draft and translate the validator at presentation.
  await page.getByLabel("Import profile JSON", { exact: true }).setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.locator(".debug-status")).toContainText(
    "Profile schema or rule baseline is incompatible",
  );
  await switchBack(page, "Profile versions");
  await expect(page.locator(".debug-status")).toContainText(
    "Profile schema or rule baseline is incompatible",
  );
  await expect(page.getByLabel("Profile name", { exact: true })).toHaveValue(name);
  await englishPanel(page, [name]);

  await page.getByRole("tab", { name: "Experiments / review", exact: true }).click();
  await englishPanel(page, [name]);
  await switchBack(page, "Experiments / review");
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-english-lab.png`) });
  const bounds = await page.locator("#debug-dialog").boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(
    await page
      .locator("#debug-dialog")
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  ).toBe(true);
});

test("English PRE manual review preserves the imported case, raw JSON, input file and disclosure state", async ({
  page,
}) => {
  const profile = officialProfile();
  profile.name = "Review candidate";
  const run: RunConfig = {
    seed: 574,
    width: 450,
    mode: "campaign",
    strategy: { name: "build-auto" },
    maxSteps: 120,
    maxSeconds: 2,
    endlessTarget: 1,
  };
  const expected = runNatural(run, profile);
  const sample = {
    schemaVersion: 1,
    kind: "balance-simulator-case",
    simulatorVersion: "1",
    profile,
    profileHash: await contentHash(profile),
    code: { commit: "browser-i18n-fixture", dirty: false, fingerprint: "fixture-only" },
    run,
    expected,
    expectedHash: await contentHash(expected),
  };
  await boot(page);
  await page.locator("#debug-trigger").click();
  await language(page, "en");
  await page.getByRole("tab", { name: "Experiments / review", exact: true }).click();
  const stored = await page.evaluate(() => localStorage.getItem("echoes:pre:balance:v2"));
  await page.getByLabel("Load experiment summary or case JSON", { exact: true }).setInputFiles({
    name: "case.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(sample)),
  });
  await expect(page.getByText("Manual case review", { exact: true })).toBeVisible();
  await expect(page.locator("#debug-content")).toContainText("Seed: 574 · Strategy: build-auto");
  await page.getByText("Key diagnostics (raw result summary)", { exact: true }).click();
  const raw = await page.locator(".debug-review-json").textContent();
  const fileInput = page.getByLabel("Load experiment summary or case JSON", { exact: true });
  const originalInput = await fileInput.elementHandle();
  if (!originalInput) throw new Error("Missing review file input");
  const originalFile = await fileInput.evaluate(
    (input: HTMLInputElement) => input.files?.[0]?.name ?? null,
  );
  await englishPanel(page);
  await switchBack(page, "Experiments / review");
  await englishPanel(page);
  expect(await page.locator(".debug-review-json").textContent()).toBe(raw);
  await expect(
    page.getByText("Key diagnostics (raw result summary)", { exact: true }).locator(".."),
  ).toHaveAttribute("open", "");
  expect(await originalInput.evaluate((input) => input.isConnected)).toBe(true);
  expect(
    await fileInput.evaluate((input: HTMLInputElement) => input.files?.[0]?.name ?? null),
  ).toBe(originalFile);
  expect(await page.evaluate(() => localStorage.getItem("echoes:pre:balance:v2"))).toBe(stored);
  await expect(
    page.getByRole("button", { name: "Prepare manual case run (reload)", exact: true }),
  ).toBeEnabled();
});
