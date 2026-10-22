import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { bootFixture, clickTarget, snapshot } from "./helpers";

export async function endlessSpawnFlow(page: Page, name: string, touch = false) {
  if (touch) await page.setViewportSize({ width: 320, height: 568 });
  await bootFixture(
    page,
    `
    world.stageIndex = 4; world.stageSupplies = 3; world.bossSpawned = false;
    world.player.cooldown = 1000; world.player.shield = 1000000;
  `,
    touch ? 450 : 1600,
  );
  const initial = await snapshot(page);
  expect([...new Set(initial.attackRegions.map((region) => region.y))].sort()).toEqual([500, 600]);
  const admissions = new Map<number, { spawnX: number; spawnY: number }>();
  for (let step = 0; step < 8; step++) {
    await page.clock.runFor(800);
    for (const enemy of (await snapshot(page)).enemies)
      if (enemy.kind !== "boss") admissions.set(enemy.id, enemy);
  }
  expect(admissions.size).toBeGreaterThanOrEqual(10);
  let inRegions = 0;
  const ordered = [...admissions.entries()].sort(([a], [b]) => a - b).map(([, enemy]) => enemy);
  for (const [index, enemy] of ordered.entries()) {
    if (
      initial.attackRegions.some(
        (region) =>
          enemy.spawnX >= region.x &&
          enemy.spawnX < region.x + region.width &&
          enemy.spawnY >= region.y &&
          enemy.spawnY < region.y + region.height,
      )
    )
      inRegions++;
    expect(inRegions).toBeGreaterThanOrEqual(Math.ceil((index + 1) * 0.3 - 1e-9));
  }
  expect(new Set(ordered.slice(5).map((enemy) => enemy.spawnY)).size).toBeGreaterThan(1);
  await expect(page).toHaveTitle("命运残响 · Echoes of Destiny");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  expect((await snapshot(page)).phase).toBe("Paused");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-endless-spawns.png`) });
}

export async function cleanupAndRegionsFlow(page: Page, name: string, touch = false) {
  if (touch) await page.setViewportSize({ width: 320, height: 568 });
  const width = touch ? 450 : 1600;
  await bootFixture(
    page,
    `
    world.stageIndex = 4;
    world.stageSupplies = 3;
    world.player.stats.damage = 1000;
    world.player.stats.interval = 4;
    enemy({ kind: "boss", x: ${width / 2}, defenseX: ${width / 2}, y: 500,
      hp: 1, maxHp: 1, arrived: false, speed: 0, skillsUsed: 3, attackPolicy: {type: "anywhere"} });
    enemy({ x: ${width - 70}, defenseX: ${width - 70}, y: 300, hp: 50, maxHp: 50,
      arrived: false, speed: 0 });
  `,
    width,
  );
  await page.clock.runFor(500);
  const cleanup = await snapshot(page);
  expect(cleanup.bossDefeated).toBe(true);
  expect(cleanup.phase).toBe("Playing");
  expect(cleanup.enemies).toHaveLength(1);
  expect(cleanup.clearedStages).toBe(0);
  await expect(page.locator("#wave-label")).toContainText("清剿残敌");
  const escort = cleanup.enemies[0];
  if (!escort) throw new Error("No surviving escort");
  await clickTarget(page, escort.x, escort.y, touch);
  await page.clock.runFor(6000);
  const cleared = await snapshot(page);
  expect(cleared.phase).toBe("StageClear");
  expect(cleared.clearedStages).toBe(1);
  expect(cleared.enemies).toEqual([]);
  const reward = page.locator(".reward-card").first();
  if (touch) await reward.tap();
  else await reward.click();
  await page.clock.runFor(100);
  const next = await snapshot(page);
  expect(next.stageIndex).toBe(5);
  expect(next.attackRegions.length).toBe(cleanup.attackRegions.length + 2);
  expect(next.arena.laneCount).toBe(touch ? 4 : 6);
  await expect(page.locator("#stage-route")).toContainText(`攻击区 ${next.attackRegions.length}/`);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-arena-regions.png`) });
}

export async function healthScalingCardsFlow(page: Page, name: string, touch = false) {
  if (touch) await page.setViewportSize({ width: 320, height: 568 });
  await bootFixture(
    page,
    `
    world.stageIndex = 4;
    world.stageSupplies = 3;
    world.player.cooldown = 1000;
    world.reward = { token: 900, source: "supply", choices: ["giant-slayer", "life-rend", "entropy"] };
    world.state.transition("RewardSelection");
  `,
    touch ? 450 : 1600,
  );
  await expect(page.locator(".reward-card")).toHaveCount(3);
  await expect(page.locator('[data-card="giant-slayer"]')).toContainText("0.25%");
  await expect(page.locator('[data-card="life-rend"]')).toContainText("0.2%");
  await expect(page.locator('[data-card="entropy"]')).toContainText("0.5%");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-health-scaling-cards.png`) });
  const card = page.locator('[data-card="giant-slayer"]');
  if (touch) await card.tap();
  else {
    await card.focus();
    await page.keyboard.press("Enter");
  }
  await page.clock.runFor(100);
  const selected = await snapshot(page);
  expect(selected.stacks["giant-slayer"]).toBe(1);
  expect(selected.player.stats.giantSlayer).toBe(0.0025);
  expect(selected.phase).toBe("Playing");
  await page.getByRole("button", { name: "本局构筑", exact: true }).click();
  const build = page.locator("#build-dialog");
  await expect(build).toContainText("巨人杀手");
  expect(await build.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-health-scaling-build.png`) });
}
