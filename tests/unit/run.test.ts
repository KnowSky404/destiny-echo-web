import { expect, test } from "bun:test";
import { CONFIG } from "../../src/game/config";
import { clamp } from "../../src/game/systems/movement";
import { World } from "../../src/game/world";

test("a full unmodified seeded run reaches boss victory in 60–90 combat seconds", () => {
  const world = new World();
  world.start(1337);
  let bossSeen = false;
  let specialAttackSeen = false;
  let damageSeen = false;
  for (let frame = 0; frame < 120 * 90; frame++) {
    if (world.phase === "RewardSelection") {
      const reward = world.reward;
      if (!reward) throw new Error("Missing reward");
      const priorities =
        world.player.hp < 55
          ? ["vitality", "ward", "multishot", "overload", "haste", "piercing", "drift"]
          : ["multishot", "overload", "haste", "piercing", "vitality", "ward", "drift"];
      const choice = priorities.find((id) => reward.choices.includes(id));
      if (!choice) throw new Error("Missing eligible card");
      expect(world.chooseCard(choice, reward.token)).toBe(true);
    }
    if (world.phase !== "Playing") break;
    const chest = world.chests.items.find((item) => item.active);
    const boss = world.boss;
    const nearestEnemy = world.enemies.items
      .filter((item) => item.active)
      .sort((a, b) => b.y - a.y)[0];
    let aim =
      chest?.x ?? (boss ? 225 + Math.sin((boss.age + 0.8) * 0.65) * 125 : (nearestEnemy?.x ?? 225));
    if (boss) {
      bossSeen = true;
      expect(world.elapsed).toBeGreaterThanOrEqual(CONFIG.bossAt);
      if (boss.telegraph > 0) {
        specialAttackSeen = true;
        if (Math.abs(aim - boss.targetX) < 50) aim = boss.targetX + (boss.targetX < 225 ? 75 : -75);
      }
    }
    for (const shot of world.hostileShots.items) {
      if (!shot.active || shot.vy <= 0) continue;
      const timeToPlayer = (736 - shot.y) / shot.vy;
      const predictedX = shot.x + shot.vx * timeToPlayer;
      if (timeToPlayer > 0 && timeToPlayer < 0.65 && Math.abs(world.player.x - predictedX) < 22) {
        aim = world.player.x + (predictedX < 225 ? 75 : -75);
        break;
      }
    }
    // Only normal input and actual offered choices; no health / damage / clock mutations.
    world.update(1 / 120, { x: 0, y: 0, target: { x: clamp(aim, 20, 430), y: 736 } });
    if (world.player.hp < 100) damageSeen = true;
  }
  expect(world.phase).toBe("Victory");
  expect(world.elapsed).toBeGreaterThanOrEqual(60);
  expect(world.elapsed).toBeLessThanOrEqual(90);
  expect(bossSeen && specialAttackSeen && damageSeen).toBe(true);
  expect(world.openedChests).toBe(5);
  expect([...world.stacks.values()].reduce((a, b) => a + b, 0)).toBe(5);
  expect(world.kills).toBeGreaterThan(20);
  expect(world.shots.items.length).toBeLessThanOrEqual(CONFIG.limits.playerShots);
  expect(world.hostileShots.items.length).toBeLessThanOrEqual(CONFIG.limits.enemyShots);
});
