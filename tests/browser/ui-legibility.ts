import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { bootFixture, clickTarget, resizeAndFit, snapshot } from "./helpers";

// Browser plugin not available. Verify native text and input in the installed engines.
export async function defenseLabelFlow(page: Page, project: string, touch = false): Promise<void> {
  await page.setViewportSize(touch ? { width: 320, height: 568 } : { width: 1920, height: 1080 });
  await bootFixture(
    page,
    `
    import { initShell } from "/src/i18n/shell.ts";
    initShell();
    world.player.cooldown = 100;
    enemy({ x: 50, y: 666, defenseX: 50, defenseY: 666, speed: 0, hp: 10000, maxHp: 10000 });
  `,
    touch ? 450 : 1600,
  );
  const before = await snapshot(page);
  const sizes = touch
    ? [
        [320, 568],
        [390, 844],
        [320, 400],
      ]
    : [
        [1920, 1080],
        [1280, 720],
      ];
  for (const [width, height] of sizes) {
    await resizeAndFit(page, width as number, height as number);
    await page.clock.runFor(200);
    await page.locator("canvas").press("c");
    expect((await snapshot(page)).manualTargetId).toBeNull();
    await page.locator("#defense-label").scrollIntoViewIfNeeded();
    const measurements = await page.locator("#defense-label").evaluate((label) => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("Missing canvas");
      const c = canvas.getBoundingClientRect();
      const l = label.getBoundingClientRect();
      const style = getComputedStyle(label);
      return {
        left: l.left - c.left,
        top: l.top - c.top,
        right: l.right - c.left,
        bottom: l.bottom - c.top,
        height: c.height,
        width: c.width,
        fontSize: Number.parseFloat(style.fontSize),
        transform: style.transform,
        pointerEvents: style.pointerEvents,
      };
    });
    const scale = measurements.height / 800;
    if (touch) expect(measurements.width).toBeGreaterThanOrEqual(218);
    expect(measurements.fontSize).toBeGreaterThanOrEqual(11);
    expect(measurements.transform).toBe("none");
    expect(measurements.pointerEvents).toBe("none");
    expect(Math.abs(measurements.left - 22 * scale)).toBeLessThan(1);
    expect(Math.abs(measurements.top - 656 * scale)).toBeLessThan(1);
    expect(measurements.right).toBeLessThan(measurements.width);
    expect(measurements.bottom).toBeLessThan(measurements.height);
    // This enemy is beneath the native annotation: clicks and taps must reach the canvas.
    expect(50 * scale).toBeGreaterThan(measurements.left);
    expect(50 * scale).toBeLessThan(measurements.right);
    expect(666 * scale).toBeGreaterThan(measurements.top);
    expect(666 * scale).toBeLessThan(measurements.bottom);
    await clickTarget(page, 50, 666, touch);
    expect((await snapshot(page)).manualTargetId).toBe(before.enemies[0]?.id);
    expect((await snapshot(page)).arena).toEqual(before.arena);
    expect((await snapshot(page)).attackRegions).toEqual(before.attackRegions);
    await expect(page.locator("#defense-label")).toContainText("防线 / DEFENSE LINE");
    await page.screenshot({
      path: join(tmpdir(), `destiny-${project}-native-defense-${width}.png`),
    });
  }
  await page.locator("#language-button").click();
  await expect(page.locator("#defense-label")).toHaveText("DEFENSE LINE");
  expect((await snapshot(page)).manualTargetId).toBe(before.enemies[0]?.id);
}

export async function rewardReadabilityFlow(
  page: Page,
  project: string,
  touch = false,
): Promise<void> {
  await page.setViewportSize(touch ? { width: 320, height: 568 } : { width: 1920, height: 1080 });
  await bootFixture(
    page,
    `
    import { initShell } from "/src/i18n/shell.ts";
    initShell();
    world.player.cooldown = 100;
    world.player.hp = world.player.stats.maxHp = 12345;
    world.player.shield = 123456;
    for (let index = 0; index < 6; index++) applyCard("keen", world.player, world.stacks);
    for (let index = 0; index < 2; index++) applyCard("lethal", world.player, world.stacks);
    world.reward = { token: 100, choices: ["lethal", "chill", "edict"], source: "chest" };
    world.state.transition("RewardSelection");
  `,
    touch ? 450 : 1600,
  );
  for (const english of [false, true]) {
    if (english) await page.locator("#language-button").click();
    const before = await snapshot(page);
    await page.clock.runFor(300);
    expect(await snapshot(page)).toEqual(before);
    for (const selector of ["#shield-value", ".card-change", ".card-synergy"]) {
      for (const node of await page.locator(selector).all()) {
        expect(
          await node.evaluate((e) => Number.parseFloat(getComputedStyle(e).fontSize)),
        ).toBeGreaterThanOrEqual(11);
      }
    }
    const shield = await page.locator("#shield-value").evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const text = range.getBoundingClientRect();
      const box = node.closest(".health-block")?.getBoundingClientRect();
      if (!box) throw new Error("Missing health block");
      return {
        left: text.left,
        right: text.right,
        containerLeft: box.left,
        containerRight: box.right,
      };
    });
    expect(shield.left).toBeGreaterThanOrEqual(shield.containerLeft);
    expect(shield.right).toBeLessThanOrEqual(shield.containerRight);
    await page.locator(".reward-card").last().scrollIntoViewIfNeeded();
    const card = await page.locator(".reward-card").last().boundingBox();
    const modal = await page.locator(".reward-modal").boundingBox();
    if (!card || !modal) throw new Error("Missing reward bounds");
    expect(card.y).toBeGreaterThanOrEqual(modal.y);
    expect(card.y + card.height).toBeLessThanOrEqual(modal.y + modal.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: join(tmpdir(), `destiny-${project}-legible-reward-${english ? "en" : "zh"}.png`),
    });
  }
  const reward = page.locator('[data-card="lethal"]');
  await reward.scrollIntoViewIfNeeded();
  if (touch) await reward.tap();
  else await reward.click();
  await page.clock.runFor(100);
  expect((await snapshot(page)).stacks.lethal).toBe(3);
  await page.locator("#build-trigger").click();
  await page.clock.runFor(100);
  const summary = page.locator('[data-synergy="precision"] summary');
  await page.locator("#close-build").focus();
  // Use native Tab navigation: programmatic focus after a pointer click does
  // not consistently enter keyboard focus mode across browser engines.
  for (let step = 0; step < 20; step++) {
    await page.keyboard.press("Tab");
    if (await summary.evaluate((node) => node === document.activeElement)) break;
  }
  await expect(summary).toBeFocused();
  await summary.press("Enter");
  await expect(page.locator('[data-synergy="precision"]')).toHaveAttribute("open", "");
  expect(await summary.evaluate((node) => node.matches(":focus-visible"))).toBe(true);
  expect(await summary.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("solid");
  for (const selector of [".synergy-count", ".synergy-details"]) {
    expect(
      await page
        .locator(selector)
        .first()
        .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
    ).toBeGreaterThanOrEqual(11);
  }
  expect(
    await page
      .locator(".stats dd")
      .first()
      .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(tmpdir(), `destiny-${project}-legible-build.png`) });
}
