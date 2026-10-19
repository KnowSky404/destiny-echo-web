import { expect, type Page } from "@playwright/test";

export async function snapshot(page: Page) {
  return page.evaluate(() => {
    if (!window.__ECHOES__) throw new Error("Test server diagnostics missing");
    return window.__ECHOES__();
  });
}

export async function boot(page: Page) {
  await page.clock.install();
  await page.goto("/");
  await expect(page).toHaveTitle("命运残响 · Echoes of Destiny");
  await expect(page.getByRole("button", { name: "开始共鸣", exact: true })).toBeEnabled();
  await expect(page.locator("#game-canvas canvas")).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  // Boot naturally, then stop wall-clock drift while slow software renderers
  // execute driver commands. Only explicit runFor calls advance combat.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
}

export async function start(page: Page) {
  await page.getByRole("button", { name: "开始共鸣", exact: true }).click();
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Playing");
}

export async function dragTo(page: Page, x: number, y: number) {
  const state = await snapshot(page);
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  await page.mouse.move(
    box.x + (state.player.x / 450) * box.width,
    box.y + (state.player.y / 800) * box.height,
  );
  await page.mouse.down();
  await page.mouse.move(box.x + (x / 450) * box.width, box.y + (y / 800) * box.height);
  const travelMs = Math.ceil(
    (Math.hypot(x - state.player.x, y - state.player.y) / state.player.stats.speed) * 1000,
  );
  await page.clock.runFor(travelMs + 150);
  await page.mouse.up();
}

export async function expectPlayerAt(page: Page, x: number, y: number) {
  const state = await snapshot(page);
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  // Native engines quantize pointer endpoints to CSS pixels (not logical game units).
  expect((Math.abs(state.player.x - x) * box.width) / 450).toBeLessThanOrEqual(1.01);
  expect((Math.abs(state.player.y - y) * box.height) / 800).toBeLessThanOrEqual(1.01);
}

export async function resizeAndFit(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  let fitted = false;
  // FIT responds asynchronously to native resize events and parent polling.
  // Check real bounds before sending coordinates into the resized battlefield.
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.clock.runFor(50);
    fitted = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const parent = canvas?.parentElement;
      if (!canvas || !parent) return false;
      const actual = canvas.getBoundingClientRect();
      const expected = parent.getBoundingClientRect();
      return (
        Math.abs(actual.width - expected.width) < 1 && Math.abs(actual.height - expected.height) < 1
      );
    });
    if (fitted) break;
  }
  expect(fitted, "Phaser canvas must fit its resized parent before input").toBe(true);
}
