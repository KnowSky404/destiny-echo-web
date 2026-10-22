import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { boot, clickTarget, firstReward, snapshot } from "./helpers";

// Browser plugin not available. Exercise the repository's real Playwright engines.
const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }, info) => {
  if (info.project.name === "firefox" && !info.title.startsWith("language remains")) {
    const webgl = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    });
    test.skip(
      !webgl,
      "This Firefox environment cannot create WebGL; the translated failure path remains covered.",
    );
  }
  await page.setViewportSize(
    info.project.name === "mobile-chromium"
      ? { width: 320, height: 568 }
      : { width: 1920, height: 1080 },
  );
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
});

test.afterEach(async ({ page }) => {
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
});

async function activate(locator: Locator, touch: boolean): Promise<void> {
  if (touch) await locator.tap();
  else await locator.click();
}

async function language(page: Page, locale: "en" | "zh-CN", touch = false): Promise<void> {
  if ((await page.locator("html").getAttribute("lang")) !== locale)
    await activate(page.locator("#language-button"), touch);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

async function english(locator: Locator): Promise<void> {
  expect(await locator.textContent()).not.toMatch(/\p{Script=Han}/u);
}

async function healthVisible(page: Page): Promise<void> {
  const bounds = await page.locator("#health-value").evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const text = range.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return { textLeft: text.left, textRight: text.right, left: box.left, right: box.right };
  });
  expect(bounds.textLeft).toBeGreaterThanOrEqual(bounds.left - 1);
  expect(bounds.textRight).toBeLessThanOrEqual(bounds.right + 1);
}

async function fitsViewport(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const frame = await page.locator(".arena-frame").boundingBox();
  const modal = await page.locator("#overlay > section").boundingBox();
  if (!frame || !modal) throw new Error("Missing arena or overlay bounds");
  expect(modal.y).toBeGreaterThanOrEqual(frame.y - 1);
  expect(modal.y + modal.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
}

async function fixture(page: Page, setup: string): Promise<void> {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
        import { World } from "/src/game/world.ts";
        import { ENEMIES } from "/src/data/enemies.ts";
        import { applyCard } from "/src/data/cards.ts";
        import { GameUI } from "/src/ui/GameUI.ts";
        import { createGame } from "/src/game/createGame.ts";
        import { initShell } from "/src/i18n/shell.ts";
        import "/src/ui/style.css";
        initShell();
        const world = new World(450);
        world.start(3);
        world.bossSpawned = true;
        let fixtureId = 1000000;
        function enemy(overrides = {}) {
          const kind = overrides.kind ?? "wisp";
          const data = ENEMIES[kind];
          const entity = world.enemies.acquire();
          Object.assign(entity, { id: fixtureId++, kind, x: 225, y: 620, hp: data.hp,
            maxHp: data.hp, radius: data.radius, speed: 0, age: 0, shotCooldown: 1000,
            patternCooldown: 1000, stage: "Approaching", attackPolicy: { ...data.attackPolicy },
            preparation: 1000, arrived: true, slot: 3, defenseX: 225, defenseY: 620,
            telegraph: 0, spawnX: overrides.x ?? 225, spawnY: overrides.y ?? 620,
            enhanced: false, interruptDamage: 0, interruptRequired: 0,
            skillsUsed: 0, lastSkill: null, damageReductionTime: 0,
            stars: 1, damageScale: 1, fusionTime: 0, fusionPeers: "", tauntRemaining: 0,
            skillCooldown: 1000, lastAction: null, formation: false,
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
  await expect(page.locator("#game-canvas canvas")).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  await language(page, "en");
}

test("English covers the playable menu, help, chest, build, pause and persisted language", async ({
  page,
}, info) => {
  const touch = info.project.name === "mobile-chromium";
  await boot(page);
  await language(page, "en", touch);
  await expect(page).toHaveTitle("Echoes of Destiny");
  await healthVisible(page);
  await english(page.locator("#overlay"));
  await activate(page.locator(".help-trigger").first(), touch);
  await expect(page.locator("#help-dialog")).toBeVisible();
  await expect(page.locator("#help-dialog")).toContainText("Giant Slayer");
  await english(page.locator("#help-dialog"));
  await activate(page.locator("#close-help"), touch);
  await activate(page.locator('[data-action="start"]'), touch);
  await page.clock.runFor(100);
  await expect(page.locator("#stage-label")).toContainText("Grail Courtyard");
  await english(page.locator(".hud"));
  await firstReward(page);
  await english(page.locator("#overlay"));
  const before = await snapshot(page);
  const token = await page.locator(".reward-card").first().getAttribute("data-token");
  await language(page, "zh-CN", touch);
  await expect(page.locator("#overlay")).toContainText("选择一道残响");
  await language(page, "en", touch);
  expect(await snapshot(page)).toEqual(before);
  await expect(page.locator(".reward-card").first()).toHaveAttribute("data-token", token ?? "");
  await fitsViewport(page);
  await healthVisible(page);
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-english-reward.png`),
  });
  const lastChoice = page.locator(".reward-card").last();
  const chosen = await lastChoice.getAttribute("data-card");
  await lastChoice.scrollIntoViewIfNeeded();
  await activate(lastChoice, touch);
  await page.clock.runFor(100);
  expect((await snapshot(page)).stacks[chosen ?? ""]).toBe(1);
  await activate(page.locator("#build-trigger"), touch);
  await page.clock.runFor(100);
  await english(page.locator("#build-dialog"));
  await expect(page.locator("#collected-cards")).toContainText("echoes collected");
  await activate(page.locator("#synergies summary").first(), touch);
  await expect(page.locator("#synergies details").first()).toHaveAttribute("open", "");
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-english-build.png`) });
  await activate(page.locator("#close-build"), touch);
  await expect(page.locator("#overlay")).toContainText("Fate at rest");
  await activate(page.locator('#overlay [data-action="resume"]'), touch);
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Playing");
  await activate(page.locator("#pause-button"), touch);
  await page.clock.runFor(100);
  await activate(page.locator('[data-action="menu"]'), touch);
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Menu");
  await page.clock.resume();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('[data-action="start"]')).toHaveText("Begin resonance");
});

test("English stage rewards preserve their token and build through language switches", async ({
  page,
}, info) => {
  const touch = info.project.name === "mobile-chromium";
  await fixture(
    page,
    `
    world.player.hp = 40;
    applyCard("overload", world.player, world.stacks);
    applyCard("fuse", world.player, world.stacks);
    world.clearedStages = 1;
    world.reward = { token: 100, choices: ["bloodpact", "training-damage", "vitality"], source: "stage" };
    world.state.transition("StageClear");
  `,
  );
  await expect(page.locator("#overlay-title")).toHaveText("Stage 1 cleared");
  await english(page.locator("#overlay"));
  await expect(page.locator('[data-card="bloodpact"]')).toContainText("First breakthrough");
  const before = await snapshot(page);
  await language(page, "zh-CN", touch);
  await language(page, "en", touch);
  expect(await snapshot(page)).toEqual(before);
  await fitsViewport(page);
  await page.screenshot({ path: join(tmpdir(), `destiny-${info.project.name}-english-stage.png`) });
  await activate(page.locator('[data-card="bloodpact"]'), touch);
  await page.clock.runFor(100);
  const next = await snapshot(page);
  expect(next.stageIndex).toBe(1);
  expect(next.player.hp).toBe(75);
  expect(next.stacks).toEqual({ overload: 1, fuse: 1, bloodpact: 1 });
  await expect(page.locator("#stage-label")).toContainText("Prism Gallery");
});

test("English victory continues into endless with the build intact", async ({ page }, info) => {
  const touch = info.project.name === "mobile-chromium";
  await fixture(
    page,
    `
    world.stageIndex = 3;
    world.clearedStages = 4;
    applyCard("overload", world.player, world.stacks);
    world.state.transition("Victory");
  `,
  );
  await expect(page.locator("#overlay-title")).toHaveText("Rewrite the ending");
  await english(page.locator("#overlay"));
  await fitsViewport(page);
  const before = await snapshot(page);
  await language(page, "zh-CN", touch);
  await language(page, "en", touch);
  expect(await snapshot(page)).toEqual(before);
  await activate(page.locator('[data-action="endless"]'), touch);
  await page.clock.runFor(100);
  const after = await snapshot(page);
  expect(after.endless).toBe(true);
  expect(after.stageIndex).toBe(4);
  expect(after.stacks).toEqual({ overload: 1 });
  await expect(page.locator("#stage-label")).toContainText("Endless 1");
  await english(page.locator("#arena-notice"));
});

test("English defeat translates results and restarts a clean run", async ({ page }, info) => {
  const touch = info.project.name === "mobile-chromium";
  await fixture(
    page,
    `
    world.elapsed = 145;
    world.kills = 12;
    world.score = 1200;
    applyCard("overload", world.player, world.stacks);
    world.player.hp = 0;
    world.state.transition("GameOver");
  `,
  );
  await expect(page.locator("#overlay-title")).toHaveText("The echoes live on");
  await english(page.locator("#overlay"));
  await expect(page.locator(".result-stats")).toContainText("02:25");
  await fitsViewport(page);
  await language(page, "zh-CN", touch);
  await expect(page.locator("#overlay-title")).toHaveText("残响尚未终结");
  await language(page, "en", touch);
  await activate(page.locator('[data-action="start"]'), touch);
  await page.clock.runFor(100);
  const after = await snapshot(page);
  expect(after.phase).toBe("Playing");
  expect(after.stacks).toEqual({});
  expect(after.score).toBe(0);
});

test("English endless HUD covers poison, taunt, sanctuary and boss skills", async ({
  page,
}, info) => {
  const touch = info.project.name === "mobile-chromium";
  await fixture(
    page,
    `
    world.stageIndex = 5;
    world.stageSupplies = 3;
    world.player.cooldown = 1000;
    world.player.poisonTime = 3;
    world.player.woundTime = 3;
    enemy({ kind: "tank", x: 80, defenseX: 80, y: 280, arrived: false, tauntRemaining: 2 });
    enemy({ kind: "boss", x: 225, y: 100, arrived: false, skillsUsed: 1, damageReductionTime: 2 });
  `,
  );
  await activate(page.locator('#overlay [data-action="resume"]'), touch);
  await page.clock.runFor(100);
  await expect(page.locator("#status-effects")).toContainText("Poison");
  await expect(page.locator("#status-effects")).toContainText("Wounded");
  await expect(page.locator("#target-label")).toContainText("Taunt lock");
  await expect(page.locator("#boss-health")).toContainText("Skills 1/3 · Slam 189");
  await expect(page.locator("#boss-health")).toContainText("Damage reduction 90%");
  await english(page.locator("#stage-route"));
  await english(page.locator("#boss-health"));
  await language(page, "zh-CN", touch);
  await expect(page.locator("#status-effects")).toContainText("中毒");
  await language(page, "en", touch);
  await activate(page.locator("#pause-button"), touch);
  await page.clock.runFor(100);
  const before = await snapshot(page);
  await language(page, "zh-CN", touch);
  await language(page, "en", touch);
  expect(await snapshot(page)).toEqual(before);
  await page.screenshot({
    path: join(tmpdir(), `destiny-${info.project.name}-english-status.png`),
  });
});

test("English sanctuary status and targeting redraw without changing its remaining duration", async ({
  page,
}, info) => {
  const touch = info.project.name === "mobile-chromium";
  await fixture(
    page,
    `
    world.stageIndex = 4;
    world.stageSupplies = 3;
    world.sanctuaryRemaining = 1;
    world.player.cooldown = 1000;
    enemy({ kind: "tank", x: 80, defenseX: 80, y: 280, arrived: false, tauntRemaining: 2 });
  `,
  );
  await expect(page.locator("#status-effects")).toContainText("Sanctuary 1.0s · Cleansed");
  await expect(page.locator("#stage-route")).toContainText("Enemy time frozen");
  const before = await snapshot(page);
  await language(page, "zh-CN", touch);
  await expect(page.locator("#status-effects")).toContainText("遗世庇护");
  await language(page, "en", touch);
  expect(await snapshot(page)).toEqual(before);
  await activate(page.locator('#overlay [data-action="resume"]'), touch);
  await page.clock.runFor(100);
  const target = (await snapshot(page)).enemies[0];
  if (!target) throw new Error("Missing sanctuary target");
  await clickTarget(page, target.x, target.y, touch);
  await page.clock.runFor(100);
  await expect(page.locator("#target-label")).toContainText("Manual priority");
  await english(page.locator("#target-label"));
});

test("language remains usable when storage is denied and WebGL failure translates immediately", async ({
  page,
}, info) => {
  const touch = info.project.name === "mobile-chromium";
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      value: () => {
        throw new DOMException("Denied", "SecurityError");
      },
    });
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw new DOMException("Denied", "SecurityError");
      },
    });
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args) {
      if (String(args[0]).startsWith("webgl")) return null;
      return Reflect.apply(getContext, this, args);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(page.locator(".error-modal")).toContainText("未能唤醒图形引擎");
  await language(page, "en", touch);
  await expect(page.locator(".error-modal")).toContainText("Graphics engine unavailable");
  await english(page.locator(".error-modal"));
  await english(page.locator(".hud"));
  await english(page.locator("#stage-label"));
  await expect(page.locator("#pause-button")).toBeDisabled();
  await activate(page.locator(".help-trigger").first(), touch);
  await english(page.locator("#help-dialog"));
  await activate(page.locator("#close-help"), touch);
  await language(page, "zh-CN", touch);
  await expect(page.locator(".error-modal button")).toHaveText("重新加载");
  await language(page, "en", touch);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator(".error-modal")).toContainText("未能唤醒图形引擎");
});
