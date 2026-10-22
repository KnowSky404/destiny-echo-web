import { describe, expect, test } from "bun:test";
import { checkGuide, renderGuide, wikiMarkdown } from "../../scripts/game-guide";
import { CARDS } from "../../src/data/cards";
import { ENEMIES } from "../../src/data/enemies";
import { STAGES } from "../../src/data/stages";
import { SYNERGIES } from "../../src/data/synergies";
import { TRAININGS } from "../../src/data/training";
import { World } from "../../src/game/world";

describe("player guide and wiki synchronization", () => {
  test("checked-in pages match the current rules and every card, enemy and synergy is documented", async () => {
    expect(await checkGuide()).toEqual([]);
    const pages = await renderGuide();
    for (const card of [...CARDS, ...TRAININGS]) {
      expect(pages["Cards-zh-CN"]).toContain(card.name);
      expect(pages["Cards-zh-CN"]).toContain(`\`${card.id}\``);
    }
    for (const card of [...CARDS, ...TRAININGS]) expect(pages.Cards).toContain(`\`${card.id}\``);
    for (const enemy of Object.values(ENEMIES))
      expect(pages["Enemies-zh-CN"]).toContain(enemy.name);
    for (const family of SYNERGIES)
      for (const tier of family.tiers) expect(pages["Builds-zh-CN"]).toContain(tier);
    const endlessTable = pages["Stages-zh-CN"]?.split("| 无尽关数 |")[1] ?? "";
    const rows = [...endlessTable.matchAll(/^\| (\d+) \|.*? \| ([\d.]+) \|$/gm)];
    expect(rows).toHaveLength(4);
    const world = new World();
    for (const row of rows) {
      world.stageIndex = STAGES.length + Number(row[1]) - 1;
      expect(Number(row[2])).toBe(world.bossSlamDamage);
      expect(pages.Stages).toContain(row[0]);
    }
  });

  test("every English page has its Chinese counterpart, resolved content and explanatory images", async () => {
    const pages = await renderGuide();
    for (const name of [
      "Home",
      "Cards",
      "Builds",
      "Enemies",
      "Stages",
      "Mechanics",
      "Development",
      "Changelog",
      "Gallery",
      "Brand",
      "Validation",
    ]) {
      expect(pages[name]).toContain(`(${name}-zh-CN.md)`);
      expect(pages[`${name}-zh-CN`]).toContain(`(${name}.md)`);
      expect(pages[name]).not.toMatch(/\{\{[A-Z_]+\}\}/);
      expect(pages[`${name}-zh-CN`]).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
    for (const name of [
      "Home",
      "Cards",
      "Builds",
      "Enemies",
      "Stages",
      "Mechanics",
      "Development",
      "Gallery",
      "Brand",
    ]) {
      expect(pages[name]).toMatch(/(?:!\[[^\]]+\]\(|src=")\.\.\/assets\//);
      expect(pages[`${name}-zh-CN`]).toMatch(/(?:!\[[^\]]+\]\(|src=")\.\.\/assets\//);
    }
    expect(pages.Changelog).toContain("Game UI in English and Simplified Chinese");
    expect(pages["Changelog-zh-CN"]).toContain("游戏英文支持");
    expect(pages.Home).toContain("English / 中文");
    expect(pages["Home-zh-CN"]).toContain("切换保留当前战斗");
  });

  test("all guide navigation resolves and wiki publishing removes file extensions from local links", async () => {
    const pages = await renderGuide();
    for (const body of Object.values(pages)) {
      for (const link of body.matchAll(/\]\(([^:)]+)\.md\)/g))
        expect(pages[link[1] ?? ""]).toBeDefined();
      const published = wikiMarkdown(body);
      expect(published).not.toMatch(/\]\([^:)]+\.md\)/);
      expect(published).not.toMatch(/\]\(https:\/\/[^)]+\/Home\.md\)/);
    }
    expect(wikiMarkdown("[中文](Cards-zh-CN.md#test)")).toBe("[中文](Cards-zh-CN#test)");
    expect(wikiMarkdown("![capture](../assets/screenshots/start-desktop-v1.png)")).toBe(
      "![capture](https://raw.githubusercontent.com/wiki/KnowSky404/destiny-echo-web/assets/screenshots/start-desktop-v1.png)",
    );
    expect(wikiMarkdown('<img src="../assets/brand/echoes-mark-v2.svg" width="160">')).toContain(
      'src="https://raw.githubusercontent.com/wiki/KnowSky404/destiny-echo-web/assets/brand/echoes-mark-v2.svg"',
    );
    expect(wikiMarkdown("[external](https://example.com/Cards.md)")).toBe(
      "[external](https://example.com/Cards.md)",
    );
  });
});
