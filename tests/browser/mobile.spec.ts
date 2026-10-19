import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { boot, snapshot, start } from "./helpers";

test("real touch drag respects scaled coordinates, high DPR and page scroll", async ({
  page,
  context,
}) => {
  await boot(page);
  await start(page);
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("No canvas");
  const client = await context.newCDPSession(page);
  const state = await snapshot(page);
  expect(
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      return [canvas?.width, canvas?.height];
    }),
  ).toEqual([450, 800]);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBeGreaterThan(1);
  const x = box.x + (state.player.x / 450) * box.width;
  const y = box.y + (state.player.y / 800) * box.height;
  const scroll = await page.evaluate(() => window.scrollY);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + box.width * 0.22, y: y - box.height * 0.12 }],
  });
  await page.clock.runFor(800);
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const moved = await snapshot(page);
  expect(moved.player.x).toBeCloseTo(state.player.x + 99, 0);
  expect(moved.player.y).toBeCloseTo(state.player.y - 96, 0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-touch.png") });
});

test("320px reward cards fit, remain readable and can be tapped", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await boot(page);
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-menu.png") });
  await start(page);
  await page.clock.runFor(7000);
  await expect(page.locator(".reward-card")).toHaveCount(3);
  const frame = await page.locator(".arena-frame").boundingBox();
  const modal = await page.locator(".reward-modal").boundingBox();
  if (!frame || !modal) throw new Error("Missing reward bounds");
  expect(modal.y).toBeGreaterThanOrEqual(frame.y);
  expect(modal.y + modal.height).toBeLessThanOrEqual(frame.y + frame.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), "destiny-mobile-reward.png") });
  await page.locator(".reward-card").last().tap();
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Playing");
});
