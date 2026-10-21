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
  await page.clock.runFor(400);
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

export async function clickTarget(page: Page, x: number, y: number, touch = false) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clientX = box.x + (x / 450) * box.width;
  const clientY = box.y + (y / 800) * box.height;
  if (touch) await page.touchscreen.tap(clientX, clientY);
  else await page.mouse.click(clientX, clientY);
}

export async function firstReward(page: Page) {
  for (let attempt = 0; attempt < 48; attempt++) {
    const state = await snapshot(page);
    if (state.phase === "RewardSelection") return;
    const chest = state.chests[0];
    if (chest && state.manualTargetId !== chest.id) await clickTarget(page, chest.x, chest.y);
    await page.clock.runFor(250);
  }
  throw new Error("First chest never opened");
}

export async function bootFixture(page: Page, setup: string) {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
      import { World } from "/src/game/world.ts";
      import { ENEMIES } from "/src/data/enemies.ts";
      import { applyCard } from "/src/data/cards.ts";
      import { GameUI } from "/src/ui/GameUI.ts";
      import { createGame } from "/src/game/createGame.ts";
      import "/src/ui/style.css";
      const world = new World();
      world.start(3);
      world.bossSpawned = true;
      let fixtureId = 1000000;
      function enemy(overrides = {}) {
        const kind = overrides.kind ?? "wisp";
        const data = ENEMIES[kind];
        const entity = world.enemies.acquire();
        Object.assign(entity, { id: fixtureId++, kind, x: 225, y: 620, hp: data.hp,
          maxHp: data.hp, radius: data.radius, speed: data.speed, age: 0,
          shotCooldown: 0, patternCooldown: 2.8, stage: "Approaching",
          attackPolicy: { ...data.attackPolicy }, preparation: 0, arrived: true,
          slot: 3, defenseX: 225, defenseY: 620, telegraph: 0,
          interruptDamage: 0, interruptRequired: 0,
          slow: 0, slowTime: 0, stunTime: 0, receivedHits: 0, primaryHits: 0 }, overrides);
        return entity;
      }
      ${setup}
      world.pause();
      const ui = new GameUI(world);
      createGame(document.querySelector("#game-canvas"), world, () => ui.ready());
      window.__ECHOES__ = () => world.snapshot();
    `,
    }),
  );
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#overlay button").first()).toBeEnabled();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  const phase = (await snapshot(page)).phase;
  expect(["Paused", "RewardSelection", "StageClear"]).toContain(phase);
  if (phase === "Paused") await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  await page.clock.runFor(100);
}
