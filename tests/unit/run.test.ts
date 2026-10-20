import { describe, expect, test } from "bun:test";
import { CONFIG } from "../../src/game/config";
import { World } from "../../src/game/world";

function run(seed: number, policy: "active" | "auto" | "defensive" = "active"): World {
  const world = new World();
  world.start(seed);
  for (let frame = 0; frame < 120 * 90; frame++) {
    if (world.phase === "RewardSelection" && world.reward) {
      const priorities =
        policy === "defensive"
          ? ["vitality", "ward", "piercing", "execution", "haste", "overload", "multishot"]
          : world.player.hp < 35
            ? ["vitality", "ward", "multishot", "overload", "haste", "execution", "piercing"]
            : ["multishot", "overload", "haste", "execution", "piercing", "vitality", "ward"];
      const choice = priorities.find((id) => world.reward?.choices.includes(id));
      if (!choice || !world.chooseCard(choice, world.reward.token))
        throw new Error("No eligible reward");
    }
    if (world.phase !== "Playing") break;
    if (policy === "active" && frame % 60 === 0) {
      const chest = world.chests.items.find((item) => item.active);
      if (chest && !world.boss) world.selectTargetAt(chest);
      else world.clearTarget();
    }
    // Only public target-selection input and actual offered rewards. No movement,
    // health, stats, enemy, RNG, schedule or clock mutations.
    world.update(CONFIG.fixedStep);
    expect(world.player.x).toBe(CONFIG.player.x);
    expect(world.player.y).toBe(CONFIG.player.y);
  }
  return world;
}

describe("natural unmodified complete runs", () => {
  test("target and card decisions win in 60–90 seconds under observable defense pressure", () => {
    const world = run(3);
    expect(world.phase).toBe("Victory");
    expect(world.elapsed).toBeGreaterThanOrEqual(60);
    expect(world.elapsed).toBeLessThan(CONFIG.deadline);
    expect(world.regularAttacks).toBeGreaterThan(0);
    expect(world.arrivals).toBeGreaterThan(1);
    expect(world.bossInterrupts + world.bossSpecials).toBeGreaterThan(0);
    expect(world.player.hp).toBeLessThan(100);
    expect(world.openedChests).toBe(5);
    expect([...world.stacks.values()].reduce((a, b) => a + b, 0)).toBe(5);
    expect(world.kills).toBeGreaterThan(20);
  });

  test("20 seeds produce both wins and losses with real threats, rewards and bounded pools", () => {
    const worlds = Array.from({ length: 20 }, (_, index) => run(index + 1));
    const winners = worlds.filter((world) => world.phase === "Victory");
    const losers = worlds.filter((world) => world.phase === "GameOver");
    expect(winners.length).toBeGreaterThan(0);
    expect(losers.length).toBeGreaterThan(0);
    expect(winners.length + losers.length).toBe(20);
    expect(worlds.some((world) => world.regularAttacks > 5)).toBe(true);
    for (const world of worlds) {
      expect(world.openedChests).toBeGreaterThan(0);
      expect(world.shots.items.length).toBeLessThanOrEqual(CONFIG.limits.playerShots);
      expect(world.hostileShots.items.length).toBeLessThanOrEqual(CONFIG.limits.enemyShots);
      expect(world.enemies.items.length).toBeLessThanOrEqual(CONFIG.limits.enemies);
    }
  });

  test("automatic targeting alone is not a guaranteed win, and decisions can change an outcome", () => {
    expect(run(14, "auto").phase).toBe("GameOver");
    expect(run(14, "active").phase).toBe("Victory");
    const poorBuild = run(3, "defensive");
    expect(poorBuild.phase).toBe("GameOver");
    expect(poorBuild.regularAttacks).toBeGreaterThan(0);
    expect(poorBuild.player.hp).toBe(0);
  });
});
