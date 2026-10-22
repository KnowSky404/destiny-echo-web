import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { bootFixture, snapshot } from "./helpers";

export async function trainingRewardFlow(page: Page, name: string, touch = false) {
  if (touch) await page.setViewportSize({ width: 320, height: 568 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (entry) => {
    if (entry.type() === "error") errors.push(entry.text());
  });
  await bootFixture(
    page,
    `
    world.stageIndex = 3; world.clearedStages = 3;
    enemy({ kind: "boss", x: world.arena.player.x, defenseX: world.arena.player.x, hp: 1 });
  `,
    touch ? 450 : 1600,
  );
  await page.clock.runFor(1000);
  await expect(page).toHaveTitle("命运残响 · Echoes of Destiny");
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".reward-card")).toHaveCount(3);
  await expect(page.locator(".reward-card.training")).toHaveCount(2);
  await expect(page.locator(".reward-card:not(.training)")).toHaveCount(1);
  await expect(page.locator(".reward-modal")).toContainText("两项锻体与一张残响三选一");
  await expect(page.locator(".reward-card.training").first()).toContainText("不计入流派层数");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const before = await snapshot(page);
  await page.clock.runFor(1000);
  expect(await snapshot(page)).toEqual(before);
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-training-reward.png`) });
  const choice = page.locator(".reward-card.training").first();
  const id = await choice.getAttribute("data-card");
  if (!id) throw new Error("Missing training choice");
  if (touch) await choice.tap();
  else {
    await choice.focus();
    await page.keyboard.press("Enter");
  }
  await page.clock.runFor(100);
  const victory = await snapshot(page);
  expect(victory.phase).toBe("Victory");
  expect(victory.trainingStacks[id]).toBe(1);
  expect(victory.stacks).toEqual(before.stacks);
  await expect(page.locator(".collected-card.training")).toHaveCount(1);
  const endless = page.getByRole("button", { name: "继续无尽 · 保留构筑", exact: true });
  if (touch) await endless.tap();
  else await endless.click();
  await page.clock.runFor(100);
  expect((await snapshot(page)).trainingStacks).toEqual(victory.trainingStacks);
  expect((await snapshot(page)).stageIndex).toBe(4);
  expect(errors).toEqual([]);
}

export async function crowdFusionFlow(page: Page, name: string, touch = false) {
  if (touch) await page.setViewportSize({ width: 320, height: 568 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await bootFixture(
    page,
    `
    world.stageIndex = 4; world.stageSupplies = 3;
    world.player.cooldown = 1000; world.player.shield = 1000000;
    for (const [lane, x] of world.arena.crowdLanes.entries()) for (let row=0; row<6; row++) {
      const y = 620 - row*84;
      const kind = lane < 2 && row < 2 ? "wisp" : ["wisp","tank","wizard"][(lane+row)%3];
      enemy({ kind, x, y, defenseX:x, defenseY:y, slot:row*world.arena.laneCount+lane,
        formation:true, age:4, speed:0, stage:"Attacking", shotCooldown:100 });
    }
    enemy({ kind:"boss", x:world.arena.player.x, defenseX:world.arena.player.x, y:300, speed:0, stage:"Attacking", shotCooldown:100, skillsUsed:3 });
  `,
    touch ? 450 : 1600,
  );
  const before = await snapshot(page);
  expect(before.enemies).toHaveLength(before.arena.encounterCapacity);
  await expect(page.locator("#stage-route")).toContainText(
    `${before.arena.encounterCapacity}/${before.arena.encounterCapacity}`,
  );
  const resourceLayout = await page.locator(".hud").evaluate((hud) => {
    const bounds = hud.getBoundingClientRect();
    const timer = hud.querySelector("#timer")?.getBoundingClientRect();
    if (!timer) throw new Error("Missing timer bounds");
    return ["#health-value", "#shield-value"].map((selector) => {
      const resource = hud.querySelector(selector);
      if (!resource) throw new Error(`Missing resource: ${selector}`);
      const range = document.createRange();
      range.selectNodeContents(resource);
      const text = [...range.getClientRects()];
      const box = resource.getBoundingClientRect();
      return {
        selector,
        visible: text.length > 0 && text.every((rect) => rect.width > 0 && rect.height > 0),
        unclipped: text.every(
          (rect) =>
            rect.left >= box.left - 1 &&
            rect.right <= box.right + 1 &&
            rect.top >= box.top - 1 &&
            rect.bottom <= box.bottom + 1,
        ),
        insideHud:
          box.left >= bounds.left - 1 &&
          box.right <= bounds.right + 1 &&
          box.top >= bounds.top - 1 &&
          box.bottom <= bounds.bottom + 1,
        clearOfTimer:
          Math.min(box.right, timer.right) - Math.max(box.left, timer.left) <= 1 ||
          Math.min(box.bottom, timer.bottom) - Math.max(box.top, timer.top) <= 1,
      };
    });
  });
  for (const resource of resourceLayout) {
    expect(resource, `${resource.selector} must remain readable and clear of the timer`).toEqual({
      selector: resource.selector,
      visible: true,
      unclipped: true,
      insideHud: true,
      clearOfTimer: true,
    });
  }
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-crowd-capacity.png`) });
  await page.clock.runFor(3200);
  const after = await snapshot(page);
  expect(after.enemies.some((enemy) => enemy.stars === 2)).toBe(true);
  expect(after.enemies.length).toBeLessThan(before.enemies.length);
  expect(after.kills).toBe(0);
  expect(after.metrics.fusions).toBeGreaterThan(0);
  await expect(page.locator("#arena-notice")).toContainText("融合为 2 星");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-fusion-stars.png`) });
  expect(errors).toEqual([]);
}
