import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { boot, dragTo, expectPlayerAt, resizeAndFit, snapshot, start } from "./helpers";

test("pause intent remains paused when window blur happens immediately before the click", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await expect(page.getByRole("button", { name: "暂停游戏", exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>("#pause-button");
    if (button?.dataset.action !== "pause") throw new Error("Pause intent missing");
    window.dispatchEvent(new Event("blur"));
    button.click();
  });
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Paused");
  await expect(page.getByRole("button", { name: "继续共鸣", exact: true })).toBeVisible();
});

test("pause click survives HUD refresh while the pointer is held", async ({ page }) => {
  await boot(page);
  await start(page);
  const button = page.getByRole("button", { name: "暂停游戏", exact: true });
  const box = await button.boundingBox();
  if (!box) throw new Error("Pause button missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(250);
  await page.mouse.up();
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Paused");
  await expect(page.getByRole("button", { name: "继续共鸣", exact: true })).toBeVisible();
});

test("movement immediately after resume survives the first render frame", async ({ page }) => {
  await boot(page);
  await start(page);
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  const before = await snapshot(page);
  await page.keyboard.down("d");
  await page.clock.runFor(400);
  await page.keyboard.up("d");
  expect((await snapshot(page)).player.x).toBeGreaterThan(before.player.x + 70);
});

test("loads real WebGL, keyboard / drag / resizing work and pause blocks all combat", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await boot(page);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-menu.png`) });
  await start(page);
  const initial = await snapshot(page);
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor(400);
  await page.keyboard.up("ArrowRight");
  const moved = await snapshot(page);
  expect(moved.player.x).toBeGreaterThan(initial.player.x + 70);
  expect(moved.shots.length).toBeGreaterThan(0);
  await page.keyboard.down("w");
  await page.clock.runFor(1000);
  await page.keyboard.up("w");
  expect((await snapshot(page)).player.y).toBeCloseTo(576);
  await dragTo(page, 100, 720);
  await expectPlayerAt(page, 100, 720);
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  const paused = await snapshot(page);
  expect(paused.phase).toBe("Paused");
  await page.keyboard.down("d");
  await page.clock.runFor(500);
  await page.keyboard.up("d");
  expect(await snapshot(page)).toEqual(paused);
  await resizeAndFit(page, 1080, 780);
  await page.keyboard.press("p");
  await page.clock.runFor(100);
  await dragTo(page, 310, 740);
  await expectPlayerAt(page, 310, 740);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Paused");
  await page.getByRole("button", { name: "玩法说明" }).click();
  await expect(page.getByRole("dialog", { name: "在残响中，改写命运。" })).toBeVisible();
  await page.getByRole("button", { name: "明白了" }).click();
  expect(errors).toEqual([]);
});

test("shoots a real chest, offers three unique cards, freezes the run and applies exactly one upgrade", async ({
  page,
}, info) => {
  await boot(page);
  await start(page);
  await page.clock.runFor(7000);
  await expect(page.getByRole("heading", { name: "选择一道残响" })).toBeVisible();
  const before = await snapshot(page);
  expect(before.phase).toBe("RewardSelection");
  expect(before.openedChests).toBe(1);
  const cards = page.locator(".reward-card");
  await expect(cards).toHaveCount(3);
  expect(
    new Set(
      await cards.evaluateAll((buttons) =>
        buttons.map((button) => (button as HTMLElement).dataset.card),
      ),
    ).size,
  ).toBe(3);
  await page.keyboard.down("d");
  await page.clock.runFor(500);
  await page.keyboard.up("d");
  expect(await snapshot(page)).toEqual(before);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-reward.png`) });
  await cards.first().click();
  await page.clock.runFor(100);
  const after = await snapshot(page);
  expect(after.phase).toBe("Playing");
  expect(after.reward).toBeNull();
  expect(Object.values(after.stacks).reduce((sum, count) => sum + count, 0)).toBe(1);
  expect(after.player).not.toEqual(before.player);
  await expect(page.locator(".collected-card")).toHaveCount(1);
});

test("plays an entire natural run to a result and restarts with fresh stats", async ({
  page,
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium",
    "Long run is covered once; other engines exercise input and reward flows.",
  );
  test.setTimeout(180_000);
  await boot(page);
  await page.clock.setSystemTime(new Date(1337));
  await start(page);
  let previousHp = 100;
  let damageSeen = false;
  for (let second = 0; second < 95; second++) {
    const state = await snapshot(page);
    if (state.player.hp < previousHp) damageSeen = true;
    previousHp = state.player.hp;
    if (state.phase === "GameOver" || state.phase === "Victory") break;
    if (state.phase === "RewardSelection") await page.locator(".reward-card").first().click();
    await page.clock.runFor(1000);
  }
  const result = await snapshot(page);
  expect(["GameOver", "Victory"]).toContain(result.phase);
  expect(damageSeen).toBe(true);
  expect(result.kills).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "再次共鸣" })).toBeVisible();
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-result.png`) });
  await page.getByRole("button", { name: "再次共鸣" }).click();
  await page.clock.runFor(100);
  const fresh = await snapshot(page);
  expect(fresh.phase).toBe("Playing");
  expect(fresh.elapsed).toBeLessThan(0.3);
  expect(fresh.player.hp).toBe(100);
  expect(fresh.player.stats.damage).toBe(12);
  expect(fresh.player.stats.projectiles).toBe(1);
  expect(fresh.stacks).toEqual({});
  expect(fresh.openedChests).toBe(0);
  expect(fresh.kills).toBe(0);
  expect(fresh.score).toBe(0);
});

test("WebGL unavailable is a readable recovery screen", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).includes("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "未能唤醒图形引擎" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  await expect(page.locator("#overlay")).toContainText("硬件加速");
});

test("production static build loads without diagnostics or missing assets", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.goto("http://127.0.0.1:4187/");
  await expect(page).toHaveTitle("命运残响 · Echoes of Destiny");
  await expect(page.getByRole("button", { name: "开始共鸣", exact: true })).toBeEnabled();
  await expect(page.locator("canvas")).toBeVisible();
  expect(await page.evaluate(() => window.__ECHOES__)).toBeUndefined();
  expect(failures).toEqual([]);
});

test("a near-defeated boss fixture resolves through real shooting to victory and restart", async ({
  page,
}, info) => {
  await page.clock.install();
  // Isolate the last boss hit and presentation. The full unmodified 60–90 second
  // victory is covered separately by the deterministic Bun simulation test.
  await page.route("**/src/main.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
      import { World } from "/src/game/world.ts";
      import { GameUI } from "/src/ui/GameUI.ts";
      import { createGame } from "/src/game/createGame.ts";
      import "/src/ui/style.css";
      const world = new World();
      world.start(1337);
      world.elapsed = 68;
      world.bossSpawned = true;
      const boss = world.enemies.acquire();
      Object.assign(boss, { id: 500, kind: "boss", x: 225, originX: 225,
        y: 110, hp: 12, maxHp: 1000, radius: 48, speed: 0, age: 4.4,
        shotCooldown: 100, patternCooldown: 100, telegraph: 0, targetX: 225 });
      world.pause();
      const ui = new GameUI(world);
      createGame(document.querySelector("#game-canvas"), world, () => ui.ready());
      window.__ECHOES__ = () => world.snapshot();
    `,
    }),
  );
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "继续共鸣", exact: true })).toBeEnabled();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  await page.clock.runFor(2000);
  await expect(page.getByRole("heading", { name: "终局，由你改写" })).toBeVisible();
  const victory = await snapshot(page);
  expect(victory.phase).toBe("Victory");
  expect(victory.kills).toBe(1);
  expect(victory.score).toBe(4000);
  await expect(page.locator(".result-stats")).toContainText("4000");
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-victory-fixture.png`),
  });
  await page.getByRole("button", { name: "再次共鸣", exact: true }).click();
  await page.clock.runFor(100);
  const fresh = await snapshot(page);
  expect(fresh.phase).toBe("Playing");
  expect(fresh.kills).toBe(0);
  expect(fresh.score).toBe(0);
  expect(fresh.player.hp).toBe(100);
  expect(fresh.elapsed).toBeLessThan(0.3);
});
