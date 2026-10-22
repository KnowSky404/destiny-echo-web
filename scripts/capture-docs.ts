import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect, type Page } from "@playwright/test";

// Browser plugin not available. Capture real local builds with repository Playwright.
const root = new URL("../docs/assets/screenshots/", import.meta.url).pathname;
await mkdir(root, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--disable-dev-shm-usage"],
});
const errors: string[] = [];
async function pageAt(url: string, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
    deviceScaleFactor: mobile ? 3 : 2,
    hasTouch: mobile,
    isMobile: mobile,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.clock.install({ time: new Date("2026-10-22T12:00:00Z") });
  await page.goto(url);
  await expect(page).toHaveTitle("命运残响 · Echoes of Destiny");
  await expect(page.getByRole("button", { name: "开始共鸣", exact: true })).toBeEnabled();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  return page;
}
async function capture(page: Page, name: string) {
  await page.screenshot({ path: join(root, `${name}.png`), scale: "device" });
  console.log(`Captured ${name}`);
}
try {
  if (!Bun.argv.includes("--pre-only")) {
    const page = await pageAt(process.env.DOCS_PRO_URL ?? "http://127.0.0.1:4197");
    await capture(page, "start-desktop-v1");
    await page.getByRole("button", { name: "开始共鸣", exact: true }).click();
    await page.clock.runFor(3000);
    await capture(page, "combat-desktop-v1");
    // Natural first chest: click its center and wait for normal homing fire.
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas missing");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * (148 / 800));
    for (let i = 0; i < 60; i++) {
      if (await page.locator(".reward-card").first().isVisible()) break;
      await page.clock.runFor(250);
    }
    await expect(page.locator(".reward-card").first()).toBeVisible();
    await capture(page, "rewards-desktop-v1");
    await page.locator(".reward-card").first().click();
    await page.clock.runFor(100);
    await page.getByRole("button", { name: "本局构筑", exact: true }).click();
    await expect(page.locator("#build-dialog")).toBeVisible();
    await page.locator("#synergies summary").first().click();
    await capture(page, "build-desktop-v1");
    const mobile = await pageAt(process.env.DOCS_PRO_URL ?? "http://127.0.0.1:4197", true);
    await capture(mobile, "start-mobile-v1");
  }
  const pre = await pageAt(process.env.DOCS_PRE_URL ?? "http://127.0.0.1:4198");
  await pre.getByRole("button", { name: "开始共鸣", exact: true }).click();
  await pre.clock.runFor(100);
  await pre.locator("#debug-trigger").click();
  await expect(pre.getByRole("dialog", { name: "PRE 数值实验室" })).toBeVisible();
  await capture(pre, "balance-lab-v1");
  await pre.getByRole("tab", { name: "关卡控制", exact: true }).click();
  await pre.getByLabel("目标关卡（1–4 战役，5 起为无尽）", { exact: true }).fill("5");
  await pre.getByRole("button", { name: "跳转关卡", exact: true }).click();
  await pre.getByRole("button", { name: "返回战场", exact: true }).click();
  await pre.clock.runFor(100);
  await pre.getByRole("button", { name: "继续共鸣", exact: true }).click();
  await pre.clock.runFor(2000);
  await capture(pre, "endless-pre-v1");
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
