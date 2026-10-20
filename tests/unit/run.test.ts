import { describe, expect, test } from "bun:test";
import { CARDS } from "../../src/data/cards";
import { CONFIG } from "../../src/game/config";
import { synergyCount } from "../../src/game/synergies";
import { World } from "../../src/game/world";

function run(
  seed: number,
  policy: "active" | "auto" | "families" | "defensive" = "active",
  endless = false,
): World {
  const world = new World();
  world.start(seed);
  for (let frame = 0; frame < 120 * 600; frame++) {
    if (endless && world.phase === "Victory") world.continueEndless();
    if (["RewardSelection", "StageClear"].includes(world.phase) && world.reward) {
      let priorities =
        policy === "defensive"
          ? [
              "vitality",
              "ward",
              "thorns",
              "harvest",
              "piercing",
              "execution",
              "haste",
              "overload",
              "multishot",
              "focus",
              "fuse",
              "bloodpact",
            ]
          : world.player.hp < 45
            ? [
                "harvest",
                "vitality",
                "ward",
                "thorns",
                "multishot",
                "haste",
                "overload",
                "piercing",
                "execution",
                "focus",
                "fuse",
                "bloodpact",
              ]
            : [
                "multishot",
                "haste",
                "overload",
                "piercing",
                "harvest",
                "focus",
                "execution",
                "fuse",
                "bloodpact",
                "vitality",
                "ward",
                "thorns",
              ];
      if (policy === "families") {
        const missing = world.reward.choices.filter((id) => {
          const card = CARDS.find((card) => card.id === id);
          return card && !world.stacks.has(id) && synergyCount(world.stacks, card.synergy) > 0;
        });
        priorities = [...missing, ...priorities];
      }
      const choice = priorities.find((id) => world.reward?.choices.includes(id));
      if (!choice || !world.chooseCard(choice, world.reward.token))
        throw new Error("No eligible reward");
    }
    if (world.clearedStages >= (endless ? 6 : 4) || world.phase !== "Playing") break;
    if (policy !== "auto" && frame % 60 === 0) {
      const chest = world.chests.items.find((item) => item.active);
      if (chest && !world.boss) world.selectTargetAt(chest);
      else world.clearTarget();
    }
    // Public target input, offered cards and continue action; no HP, output,
    // stage, schedule, RNG or clock mutations.
    world.update(CONFIG.fixedStep);
  }
  return world;
}

describe("natural unmodified multi-stage runs", () => {
  test("a growing build clears four bosses under observable defense pressure", () => {
    const world = run(4);
    expect(world.phase).toBe("Victory");
    expect(world.clearedStages).toBe(4);
    expect(world.stageIndex).toBe(3);
    expect(world.elapsed).toBeGreaterThan(200);
    expect(world.elapsed).toBeLessThan(364);
    expect(world.regularAttacks).toBeGreaterThan(0);
    expect(world.arrivals).toBeGreaterThan(1);
    expect(world.bossInterrupts + world.bossSpecials).toBeGreaterThan(0);
    expect(world.openedChests).toBeGreaterThanOrEqual(15);
    expect([...world.stacks.values()].reduce((a, b) => a + b, 0)).toBe(world.openedChests + 3);
    expect(world.kills).toBeGreaterThan(100);
  });

  test("20 seeds resolve with actual threats, rewards and bounded pools", () => {
    const worlds = Array.from({ length: 20 }, (_, index) => run(index + 1));
    expect(worlds.some((world) => world.phase === "Victory")).toBe(true);
    expect(worlds.some((world) => world.phase === "GameOver")).toBe(true);
    for (const world of worlds) {
      expect(["Victory", "GameOver"]).toContain(world.phase);
      expect(world.openedChests).toBeGreaterThan(0);
      expect(world.shots.items.length).toBeLessThanOrEqual(CONFIG.limits.playerShots);
      expect(world.hostileShots.items.length).toBeLessThanOrEqual(CONFIG.limits.enemyShots);
      expect(world.enemies.items.length).toBeLessThanOrEqual(CONFIG.limits.enemies);
      expect(world.blasts.items.length).toBeLessThanOrEqual(CONFIG.limits.blasts);
      expect({ x: world.player.x, y: world.player.y }).toEqual(CONFIG.player);
    }
  });

  test("target decisions change an outcome; incomplete growth can still fail", () => {
    expect(run(4, "auto").phase).toBe("GameOver");
    expect(run(4, "active").phase).toBe("Victory");
    const poorBuild = run(3, "defensive");
    expect(poorBuild.phase).toBe("GameOver");
    expect(poorBuild.regularAttacks).toBeGreaterThan(0);
  });

  test("a complete explosion build continues through two real endless bosses", () => {
    const world = run(4, "families", true);
    expect(world.clearedStages).toBeGreaterThanOrEqual(6);
    expect(world.endless).toBe(true);
    expect(world.stageIndex).toBeGreaterThanOrEqual(5);
    expect(synergyCount(world.stacks, "blast")).toBe(3);
    expect(world.explosionCount).toBeGreaterThan(100);
    expect(world.chainKills).toBeGreaterThan(0);
    expect(world.echoVolleys).toBeGreaterThan(0);
  });
});
