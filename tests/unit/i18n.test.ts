import { afterEach, describe, expect, test } from "bun:test";
import { CARDS } from "../../src/data/cards";
import { ENEMIES } from "../../src/data/enemies";
import { STAGES, stageAt } from "../../src/data/stages";
import { SYNERGIES } from "../../src/data/synergies";
import { TRAININGS } from "../../src/data/training";
import { createPlayer, World } from "../../src/game/world";
import {
  bossName,
  CARD_EN,
  enemyName,
  rewardDescription,
  rewardName,
  stageName,
  stageSubtitle,
  synergyName,
  synergyTiers,
  tierName,
} from "../../src/i18n/content";
import { getLocale, onLocaleChange, setLocale, t } from "../../src/i18n/locale";

afterEach(() => setLocale("zh-CN"));

describe("game languages", () => {
  test("switches, notifies once and allows subscriptions to be removed", () => {
    setLocale("zh-CN");
    let changes = 0;
    const unsubscribe = onLocaleChange(() => changes++);
    expect(t("中文", "English")).toBe("中文");
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(t("中文", "English")).toBe("English");
    setLocale("en");
    expect(changes).toBe(1);
    unsubscribe();
    setLocale("zh-CN");
    expect(changes).toBe(1);
  });

  test("every reward and synergy has English text and live numerical previews", () => {
    setLocale("en");
    const player = createPlayer();
    player.woundTime = 3;
    for (const reward of [...CARDS, ...TRAININGS]) {
      if (reward.type === "augment") expect(CARD_EN[reward.id]).toBeDefined();
      for (const text of [
        rewardName(reward.id),
        rewardDescription(reward.id),
        reward.preview(player),
      ]) {
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/\p{Script=Han}/u);
      }
      expect(rewardName(reward.id, "zh-CN")).toBe(reward.name);
      for (const woundTime of [0, 3]) {
        player.woundTime = woundTime;
        setLocale("zh-CN");
        const chineseNumbers = reward.preview(player).match(/[-+]?\d+(?:\.\d+)?/g);
        setLocale("en");
        expect(reward.preview(player).match(/[-+]?\d+(?:\.\d+)?/g)).toEqual(chineseNumbers);
      }
    }
    for (const synergy of SYNERGIES) {
      expect(synergyName(synergy.id)).not.toMatch(/\p{Script=Han}/u);
      expect(synergyTiers(synergy.id)).toHaveLength(3);
      for (const tier of synergyTiers(synergy.id)) expect(tier).not.toMatch(/\p{Script=Han}/u);
    }
    for (const tier of [0, 3, 6, 9] as const) expect(tierName(tier)).not.toMatch(/\p{Script=Han}/u);
  });

  test("translates every enemy, campaign boss, and custom endless subtitle", () => {
    setLocale("en");
    for (const kind of Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]) {
      expect(enemyName(kind)).not.toMatch(/\p{Script=Han}/u);
      expect(enemyName(kind, "zh-CN")).toBe(ENEMIES[kind].name);
    }
    for (let index = 0; index < STAGES.length + 5; index++) {
      const stage = stageAt(index, 900);
      expect(stageName(index)).not.toMatch(/\p{Script=Han}/u);
      expect(bossName(index)).not.toMatch(/\p{Script=Han}/u);
      expect(stageSubtitle(stage, index)).not.toMatch(/\p{Script=Han}/u);
    }
    expect(stageName(4)).toContain("1");
  });

  test("language switches do not change simulation or reward capabilities", () => {
    const world = new World();
    world.start(120);
    for (let frame = 0; frame < 300; frame++) world.update(1 / 60);
    const state = structuredClone(world.snapshot());
    setLocale("en");
    expect(world.snapshot()).toEqual(state);
    setLocale("zh-CN");
    expect(world.snapshot()).toEqual(state);
  });

  test("an existing combat notice switches immediately without another simulation step", () => {
    const world = new World();
    world.start(120);
    world.player.stats.controlPulse = 1;
    // Trigger Sanctuary through the actual fixed-step simulation.
    for (let frame = 0; frame < 490; frame++) {
      if (world.reward) world.chooseCard(world.reward.choices[0] ?? "", world.reward.token);
      world.update(1 / 60);
    }
    expect(world.notice).toContain("遗世庇护");
    setLocale("en");
    expect(world.localizedNotice).toContain("Sanctuary");
    expect(world.localizedNotice).not.toMatch(/\p{Script=Han}/u);
    setLocale("zh-CN");
    expect(world.localizedNotice).toBe(world.notice);
  });
});
