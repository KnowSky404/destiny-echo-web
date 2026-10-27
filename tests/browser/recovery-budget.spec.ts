import { expect, type Locator, type Page, test } from "@playwright/test";
import { bootFixture, snapshot } from "./helpers";

type RecoveryReadout = {
  phase: string;
  elapsed: number;
  stageElapsed: number;
  hp: number;
  maxHp: number;
  shield: number;
  recoveryRate: number | null;
  recoveryAllowance: { available: number; capacity: number } | null;
  lifestealCeiling: number | null;
  shieldCeiling: number | null;
  overflowCapacity: number;
  overflowConversion: number;
  fallbackHelp: string;
};

declare global {
  interface Window {
    __RECOVERY_UI_READ__?: () => RecoveryReadout;
  }
}

// Browser plugin not available. These are rendered rule fixtures, not natural
// progression or pacing evidence. Only initial depth/stats/reward are authored;
// the vitality choice, getters, dialogs, locale and pause use production code.
async function recoveryFixture(page: Page, depth: number) {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await bootFixture(
    page,
    `
    const { overhealStats } = await import("/src/game/stats.ts");
    const { initShell } = await import("/src/i18n/shell.ts");
    const fallbackHelp = document.querySelector('[data-i18n="rewardsHelp"]').textContent;
    initShell();
    world.stageIndex = ${depth + 3};
    world.stageSupplies = 100;
    world.player.cooldown = 1000;
    world.player.stats.maxHp = world.player.hp = 200;
    world.player.stats.lifesteal = 0.4;
    world.player.stats.overheal = 0.5;
    world.player.stats.shieldCapacity = 1;
    world.player.shield = 1000000;
    world.reward = { token: 700, source: "supply", choices: ["vitality"] };
    world.state.transition("RewardSelection");
    window.__RECOVERY_UI_READ__ = () => {
      const overflow = overhealStats(world.player, world.stacks);
      return { phase: world.phase, elapsed: world.elapsed,
        stageElapsed: world.stageElapsed, hp: world.player.hp,
        maxHp: world.player.stats.maxHp, shield: world.player.shield,
        recoveryRate: world.combatRecoveryPerSecond,
        recoveryAllowance: world.combatRecoveryAllowance,
        lifestealCeiling: world.lifestealRecoveryPerSecond,
        shieldCeiling: world.combatShieldCeiling,
        overflowCapacity: overflow.capacity, overflowConversion: overflow.conversion,
        fallbackHelp };
    };
    `,
  );
}
async function read(page: Page): Promise<RecoveryReadout> {
  return page.evaluate(() => {
    if (!window.__RECOVERY_UI_READ__) throw new Error("Missing readonly recovery fixture");
    return window.__RECOVERY_UI_READ__();
  });
}
async function activate(locator: Locator, touch: boolean): Promise<void> {
  if (touch) await locator.tap();
  else await locator.click();
}
async function assertBuild(page: Page, english: boolean) {
  const value = await read(page);
  if (
    value.recoveryRate === null ||
    value.lifestealCeiling === null ||
    value.shieldCeiling === null
  )
    throw new Error("Late recovery getters are unavailable");
  const rows = page.locator("#stats > div");
  const recovery = rows.filter({
    hasText: english ? "Shared HP / shield recovery" : "生命/护盾共享回复",
  });
  await recovery.scrollIntoViewIfNeeded();
  await expect(recovery).toBeVisible();
  const unitIntact = await recovery.locator("dd").evaluate((value) => {
    const walker = document.createTreeWalker(value, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const start = node.textContent?.indexOf("HP/s") ?? -1;
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + 4);
      return (
        [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0).length === 1
      );
    }
    return false;
  });
  expect(unitIntact, "The HP/s unit must remain a single readable token at 320px").toBe(true);
  await expect(recovery).toContainText(`${Number(value.recoveryRate.toFixed(2))} HP/s`);
  await expect(
    rows.filter({ hasText: english ? "Lifesteal recovery ceiling" : "吸血回复上限" }),
  ).toContainText(`${Number(value.lifestealCeiling.toFixed(2))} HP/s`);
  await expect(
    rows.filter({ hasText: english ? "Overheal shield / capacity" : "过量转盾 / 储量" }),
  ).toContainText(
    `${Math.round(value.overflowConversion * 100)}% / ${Number(Math.min(value.overflowCapacity, value.shieldCeiling).toFixed(2))}`,
  );
  expect(value.shield).toBeGreaterThan(value.shieldCeiling);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .locator("#build-dialog")
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
  ).toBe(true);
  const textFits = await recovery.evaluate((row) => {
    const dialog = row.closest("dialog")?.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(row);
    const text = range.getBoundingClientRect();
    return !!dialog && text.left >= dialog.left && text.right <= dialog.right;
  });
  expect(textFits, "320px recovery label and value must fit the dialog").toBe(true);
  return value;
}

for (const depth of [7, 20]) {
  test(`depth ${depth} Build recovery follows a native max-HP reward and bilingual Help at 320px`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const touch = info.project.name === "mobile-chromium";
    await recoveryFixture(page, depth);
    await expect(page).toHaveTitle("命运残响 · Echoes of Destiny");
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    await activate(page.locator("#build-trigger"), touch);
    await page.clock.runFor(100);
    const before = await assertBuild(page, false);
    expect(before.phase).toBe("RewardSelection");
    expect(before.recoveryRate).toBeCloseTo((before.maxHp * 0.04) / (1 + 0.075 * (depth - 7)), 8);
    await page.screenshot({ path: info.outputPath(`recovery-d${depth}-zh-before.png`) });
    await activate(page.locator("#close-build"), touch);
    await activate(page.locator('[data-card="vitality"]'), touch);
    await page.clock.runFor(100);
    expect((await snapshot(page)).phase).toBe("Playing");
    await activate(page.locator("#build-trigger"), touch);
    await page.clock.runFor(100);
    const after = await assertBuild(page, false);
    expect(after.phase).toBe("Paused");
    expect(after.maxHp).toBeGreaterThan(before.maxHp);
    expect(after.recoveryRate).toBeGreaterThan(before.recoveryRate ?? 0);
    expect(after.recoveryRate).toBeCloseTo((after.maxHp * 0.04) / (1 + 0.075 * (depth - 7)), 8);
    expect(after.shield).toBe(before.shield);
    const paused = await snapshot(page);
    await page.clock.runFor(500);
    expect(await snapshot(page)).toEqual(paused);
    expect(await read(page)).toEqual(after);
    await activate(page.locator("#close-build"), touch);
    await activate(page.locator(".help-trigger").first(), touch);
    const help = page.locator('[data-i18n="rewardsHelp"]');
    await expect(help).toHaveText(after.fallbackHelp);
    await expect(help).toContainText(/第\s*7\s*层/);
    await expect(help).toContainText("共享");
    await expect(help).toContainText("护盾");
    await expect(help).toContainText("35%");
    expect(await snapshot(page)).toEqual(paused);
    await page.screenshot({ path: info.outputPath(`recovery-d${depth}-zh-help.png`) });
    await activate(page.locator("#close-help"), touch);
    await activate(page.locator("#language-button"), touch);
    await activate(page.locator("#build-trigger"), touch);
    await page.clock.runFor(100);
    const english = await assertBuild(page, true);
    expect(english).toEqual(after);
    await page.screenshot({ path: info.outputPath(`recovery-d${depth}-en-build.png`) });
    await activate(page.locator("#close-build"), touch);
    await activate(page.locator(".help-trigger").first(), touch);
    await expect(help).toContainText(/depth\s*7/i);
    await expect(help).toContainText(/shar/i);
    await expect(help).toContainText(/shield/i);
    await expect(help).toContainText("35%");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page
        .locator("#help-dialog")
        .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
    ).toBe(true);
    expect(await snapshot(page)).toEqual(paused);
    await activate(page.locator("#close-help"), touch);
    await activate(page.getByRole("button", { name: "Resume resonance", exact: true }), touch);
    await page.clock.runFor(100);
    expect((await snapshot(page)).phase).toBe("Playing");
    expect((await read(page)).elapsed).toBeGreaterThan(after.elapsed);
    expect((await read(page)).shield).toBe(before.shield);
    expect(errors).toEqual([]);
  });
}
