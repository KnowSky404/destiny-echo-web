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
  await expect(page.locator(".reward-card.epic")).toHaveCount(1);
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
      enemy({ kind, x, y, defenseX:x, defenseY:y, slot:row*4+lane,
        formation:true, age:4, speed:0, stage:"Attacking", shotCooldown:100 });
    }
    enemy({ kind:"boss", x:world.arena.player.x, defenseX:world.arena.player.x, y:300, speed:0, stage:"Attacking", shotCooldown:100, skillsUsed:3 });
  `,
    touch ? 450 : 1600,
  );
  const before = await snapshot(page);
  expect(before.enemies).toHaveLength(25);
  await expect(page.locator("#stage-route")).toContainText("25/25");
  const shield = await page.locator("#shield-value").boundingBox();
  const timer = await page.locator("#timer").boundingBox();
  if (!shield || !timer) throw new Error("Missing HUD bounds");
  expect(shield.x + shield.width).toBeLessThanOrEqual(timer.x + 1);
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-crowd-capacity.png`) });
  await page.clock.runFor(3200);
  const after = await snapshot(page);
  expect(after.enemies.some((enemy) => enemy.stars === 2)).toBe(true);
  expect(after.enemies.length).toBeLessThan(25);
  expect(after.kills).toBe(0);
  expect(after.metrics.fusions).toBeGreaterThan(0);
  await expect(page.locator("#arena-notice")).toContainText("融合为 2 星");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-fusion-stars.png`) });
  expect(errors).toEqual([]);
}
