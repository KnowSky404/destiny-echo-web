import { describe, expect, test } from "bun:test";
import { checkGuide, renderGuide, wikiMarkdown } from "../../scripts/game-guide";
import { CARDS } from "../../src/data/cards";
import { ENEMIES } from "../../src/data/enemies";
import { SYNERGIES } from "../../src/data/synergies";
import { TRAININGS } from "../../src/data/training";

describe("player guide and wiki synchronization", () => {
  test("checked-in pages match the current rules and every card, enemy and synergy is documented", async () => {
    expect(await checkGuide()).toEqual([]);
    const pages = await renderGuide();
    for (const card of [...CARDS, ...TRAININGS]) {
      expect(pages.Cards).toContain(card.name);
      expect(pages.Cards).toContain(`\`${card.id}\``);
    }
    for (const enemy of Object.values(ENEMIES)) expect(pages.Enemies).toContain(enemy.name);
    for (const family of SYNERGIES)
      for (const tier of family.tiers) expect(pages.Builds).toContain(tier);
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
    expect(wikiMarkdown("[external](https://example.com/Cards.md)")).toBe(
      "[external](https://example.com/Cards.md)",
    );
  });
});
