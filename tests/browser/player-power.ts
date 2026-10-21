import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { bootFixture, clickTarget, snapshot } from "./helpers";

export async function bulletTimeFlow(page: Page, name: string) {
  await bootFixture(
    page,
    `
    applyCard("edict", world.player, world.stacks);
    world.player.cooldown = 100;
    for (let frame = 0; frame < 959; frame++) world.update(1 / 120);
    world.player.hp = 60;
    world.player.poisonTime = 3;
    world.player.poisonSlowTime = 3;
    world.player.cooldown = 0;
    enemy({ kind: "boss", x: 225, y: 500, hp: 10000, maxHp: 10000,
      stage: "Attacking", telegraph: 2, interruptRequired: 100000, speed: 0 });
    enemy({ x: 80, y: 100, arrived: false, speed: 60, hp: 10000, maxHp: 10000 });
    const hostile = world.hostileShots.acquire();
    Object.assign(hostile, { x: 20, y: 20, vx: 30, vy: 60, lifetime: 6, damage: 10 });
  `,
  );
  const before = await snapshot(page);
  expect(before.bulletTimeRemaining).toBeGreaterThan(1);
  expect(before.player.poisonTime).toBe(0);
  expect(before.player.poisonSlowTime).toBe(0);
  await page.clock.runFor(600);
  const after = await snapshot(page);
  expect(after.stageElapsed).toBe(before.stageElapsed);
  expect(after.hostileShots).toEqual(before.hostileShots);
  expect(after.enemies.map(({ x, y, telegraph }) => ({ x, y, telegraph }))).toEqual(
    before.enemies.map(({ x, y, telegraph }) => ({ x, y, telegraph })),
  );
  expect(after.metrics.damageDealt).toBeGreaterThan(before.metrics.damageDealt);
  expect(after.player.hp).toBe(60);
  await expect(page.locator("#status-effects")).toContainText("子弹时间");
  await expect(page.locator("#status-effects")).toContainText("已净化");
  await expect(page.locator("#stage-route")).toContainText("倒计时已冻结");
  await expect(page.locator("#status-effects")).not.toContainText("中毒");
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-bullet-time.png`) });
  await page.getByRole("button", { name: "暂停游戏", exact: true }).click();
  await page.clock.runFor(100);
  const paused = await snapshot(page);
  await page.clock.runFor(1000);
  expect(await snapshot(page)).toEqual(paused);
  await page.getByRole("button", { name: "继续共鸣", exact: true }).click();
  await page.clock.runFor(1600);
  expect((await snapshot(page)).stageElapsed).toBeGreaterThan(after.stageElapsed);
  await expect(page.locator("#status-effects")).not.toContainText("子弹时间");
}

export async function epicRewardFlow(page: Page, name: string, touch = false) {
  if (touch) await page.setViewportSize({ width: 320, height: 568 });
  await bootFixture(
    page,
    `
    enemy({ kind: "boss", x: 225, y: 500, hp: 1, speed: 0 });
  `,
  );
  await page.clock.runFor(800);
  const before = await snapshot(page);
  expect(before.phase).toBe("StageClear");
  await expect(page.locator(".reward-card")).toHaveCount(3);
  const epic = page.locator(".reward-card.epic");
  await expect(epic).toHaveCount(1);
  await expect(epic.locator(".card-topline small")).toHaveText("史诗");
  const id = await epic.getAttribute("data-card");
  if (!id) throw new Error("Missing epic card id");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-epic-reward.png`) });
  if (touch) await epic.tap();
  else {
    await epic.focus();
    await page.keyboard.press("Enter");
  }
  await page.clock.runFor(100);
  const after = await snapshot(page);
  expect(after.phase).toBe("Playing");
  expect(after.stageIndex).toBe(1);
  expect(after.stacks[id]).toBe(1);
  expect(after.player).not.toEqual(before.player);
  await expect(page.locator(".collected-card.epic")).toHaveCount(1);
}

export async function attackAreaFlow(page: Page, name: string, touch = false) {
  if (touch) await page.setViewportSize({ width: 320, height: 568 });
  await bootFixture(
    page,
    `
    world.stageIndex = 4;
    world.stageSupplies = 3;
    world.player.cooldown = 1000;
    enemy({ kind: "tank", x: 80, defenseX: 80, y: 280, arrived: false, speed: 0 });
    enemy({ x: 225, y: 620, arrived: true, speed: 0 });
    enemy({ kind: "wizard", x: 360, defenseX: 360, y: 240, arrived: false, speed: 0 });
  `,
  );
  const tank = (await snapshot(page)).enemies.find((item) => item.kind === "tank");
  if (!tank) throw new Error("Missing tank");
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await clickTarget(page, tank.x, tank.y, touch);
  await page.clock.runFor(100);
  const after = await snapshot(page);
  expect(after.manualTargetId).toBe(tank.id);
  expect(after.enemies.find((item) => item.id === after.targetId)?.kind).toBe("wisp");
  await expect(page.locator("#target-label")).toContainText("攻击区嘲讽");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(tmpdir(), `destiny-${name}-attack-area.png`) });
}
