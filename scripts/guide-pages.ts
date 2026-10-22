import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CARDS, isFirstStageExcluded } from "../src/data/cards";
import { SYNERGIES } from "../src/data/synergies";
import { TRAININGS } from "../src/data/training";
import { createPlayer } from "../src/game/world";
import { CARD_EN, FAMILY_EN, previewEnglish } from "./guide-catalog.en";

const contentRoot = new URL("../docs/wiki-content/", import.meta.url);
const source = (name: string) => readFile(new URL(name, contentRoot), "utf8");
const table = (headers: string[], rows: (string | number)[][]) =>
  [headers, headers.map(() => "---"), ...rows]
    .map((row) => `| ${row.map((cell) => String(cell).replaceAll("|", "\\|")).join(" | ")} |`)
    .join("\n");
const names: Record<string, string> = {
  "失控圣杯 · 空愿之器": "Runaway Grail · Vessel of Empty Wishes",
  "折光主教 · 千面棱镜": "Refraction Bishop · Thousand-Faced Prism",
  "焚星之心 · 永燃余烬": "Starforge Heart · Eternal Ember",
  "终愿之器 · 命运归零": "Final Wish · Fate Zero",
  圣杯前庭: "Grail Courtyard",
  棱镜回廊: "Prism Gallery",
  焚星熔炉: "Starforge",
  终愿核心: "Final Wish Core",
  游离残响: "Wisp",
  棱镜守卫: "Prism Sentinel",
  蚀光术士: "Light Hexer",
  嘲讽巨像: "Taunting Colossus",
  腐毒巫师: "Venom Wizard",
  "怪物 / ID": "Enemy / ID",
  基础生命: "Base HP",
  普通伤害: "Ordinary damage",
  移动速度: "Speed",
  攻击间隔: "Interval",
  准备时间: "Preparation",
  类型: "Style",
  基础攻击许可: "Base attack permission",
  击杀分数: "Kill score",
  近战: "Melee",
  远程: "Ranged",
  抵达自己的防线位置: "Arrive at assigned defense position",
  首领生命: "Boss HP",
  首领出现: "Boss arrival",
  常规预算: "Routine budget",
  同时上限: "Active cap",
  "护卫/批": "Escorts/batch",
  小怪生命倍率: "Minion HP multiplier",
  速度倍率: "Speed multiplier",
  普通伤害倍率: "Ordinary damage multiplier",
  攻击计时倍率: "Attack timing multiplier",
  首领弹数: "Boss fan",
  首领常规间隔: "Boss interval",
  蓄力时间: "Charge duration",
  打断伤害: "Interrupt damage",
  蓄力弹基础伤害: "Base charged-shot damage",
  无尽关数: "Endless layer",
  怪物预算: "Minion budget",
  重击生命损失: "Slam HP loss",
  关卡: "Stage",
  首领: "Boss",
};
function numericTables(zh: string, limit = Infinity) {
  return (zh.match(/(?:^\|.*\n)+/gm) ?? [])
    .slice(0, limit)
    .map((original) => {
      let text = original.replace(/进入 y ≥ (\d+) 的区域/g, "Region y ≥ $1");
      for (const [key, value] of Object.entries(names).sort((a, b) => b[0].length - a[0].length))
        text = text.replaceAll(key, value);
      if (/[\u3400-\u9fff]/u.test(text)) throw new Error(`Untranslated numeric table: ${text}`);
      return text;
    })
    .join("\n");
}
function entry<T>(catalog: Record<string, T>, id: string): T {
  const value = catalog[id];
  if (!value) throw new Error(`Missing English guide translation: ${id}`);
  return value;
}
const gallery = (file: string, caption: string) =>
  `![${caption}](../assets/screenshots/${file}.png)`;

export async function bilingualPages(
  zh: Record<string, string>,
  rulesHash: string,
  stageValues: Record<string, string | number>,
) {
  // Fail closed when rules change: a maintainer must review the English prose/catalog.
  if ((await source("reviewed-rules.txt")).trim() !== rulesHash)
    throw new Error(
      `Review English guide prose/catalog before updating ${fileURLToPath(new URL("reviewed-rules.txt", contentRoot))}; current rules: ${rulesHash}`,
    );
  const en: Record<string, string> = {};
  for (const name of [
    "Home",
    "Mechanics",
    "Enemies",
    "Stages",
    "Development",
    "Changelog",
    "Gallery",
    "Brand",
    "Validation",
  ])
    en[name] = await source(`${name}.md`);
  en.Mechanics = (en.Mechanics ?? "").replace(
    "{{PLAYER_STATS}}",
    `Starting HP ${createPlayer().hp} · ${previewEnglish(
      `生命上限 ${createPlayer().stats.maxHp} · 护盾 ${createPlayer().shield} · 基础伤害 ${createPlayer().stats.damage} · 间隔 ${createPlayer().stats.interval}s · 弹幕 ${createPlayer().stats.projectiles} · 额外穿透 ${createPlayer().stats.piercing} · 暴击率 ${createPlayer().stats.critChance * 100}% · 暴击倍率 ${createPlayer().stats.critDamage}`,
    )}`,
  );
  en.Enemies = (en.Enemies ?? "").replace("{{ENEMY_TABLES}}", numericTables(zh.Enemies ?? ""));
  en.Stages = (en.Stages ?? "").replace("{{STAGE_TABLES}}", numericTables(zh.Stages ?? "", 3));
  for (const [key, value] of Object.entries(stageValues))
    for (const name of ["Stages", "Enemies"])
      en[name] = (en[name] ?? "").replaceAll(`{{${key}}}`, String(value));
  en.Cards = `# Cards and training\n\n${gallery("rewards-desktop-v1", "Earlier Chinese card offer; the game now supports either language")}

${CARDS.length} augments across ${SYNERGIES.length} families: ${CARDS.filter((card) => card.rarity !== "epic").length} common/rare and ${CARDS.filter((card) => card.rarity === "epic").length} epics. Epics are once per run. Every acquisition grants one family stack, even an epic with several effects. Caps are per card ID; composite epic effects do not consume ordinary card stacks. Previews use starting four-lane stats, before wounds; the game shows changes for the current build. Unlimited cards still obey combat caps.

${SYNERGIES.map(
  (family) => `## ${entry(FAMILY_EN, family.id)[0]} / ${family.name}

${table(
  ["Card / in-game name / ID", "Rarity", "Run stack cap", "Available from"],
  CARDS.filter((card) => card.synergy === family.id).map((card) => [
    `${entry(CARD_EN, card.id)[0]} / ${card.name} / \`${card.id}\``,
    card.rarity,
    card.maxStacks ?? "Unlimited",
    isFirstStageExcluded(card) ? "Stage 2" : "Stage 1",
  ]),
)}

${CARDS.filter((card) => card.synergy === family.id)
  .map(
    (card) => `### ${entry(CARD_EN, card.id)[0]}

- **Effect:** ${entry(CARD_EN, card.id)[1]}
- **Starting preview:** ${previewEnglish(card.preview(createPlayer()))}
`,
  )
  .join("\n")}`,
).join("\n")}

## Boss and score training

Every 5,000 cumulative points automatically grants an eligible training, without pausing, spending points or choosing; crossing several milestones awards them in order. Stage one excludes lifesteal. Boss offers contain two different trainings and one augment: choose one. Trainings add no family stacks, persist for the run, and do not appear in chests or supplies. Maximum-HP training does not heal.

${table(
  ["Training / in-game name / ID", "Starting change", "Effect"],
  TRAININGS.map((item) => [
    `${previewEnglish(item.name)} / ${item.name} / \`${item.id}\``,
    previewEnglish(item.preview(createPlayer())),
    item.id === "training-haste"
      ? "Base firing interval ×0.94, minimum 0.08s; no family stack"
      : "Adjust run base stats; no family stack",
  ]),
)}
`;
  en.Builds = `# Builds and synergies\n\n${gallery("build-desktop-v1", "Current Build panel: stats, collected augments and family thresholds")}

Each card acquisition, including duplicates and epics, adds one family stack. Tiers unlock at 3 / 6 / 9 and different families can coexist. Higher tiers keep lower effects, replacing a stated multiplier, threshold or interval rather than adding both values. Cards below their own cap remain available after nine family stacks.

Stage one offers Barrage, Might, Precision and Storm; other families unlock in stage two. Guided offers favor invested families and retain foundational offense; an epic promotion may replace a family slot.

${SYNERGIES.map((family) => {
  const [name, tiers] = entry(FAMILY_EN, family.id);
  return `## ${name} / ${family.name}\n\nCards: ${CARDS.filter((card) => card.synergy === family.id)
    .map((card) => entry(CARD_EN, card.id)[0])
    .join(", ")}.\n\n${table(
    ["Stacks", "Effect"],
    tiers.map((tier, index) => [[3, 6, 9][index] ?? 0, tier]),
  )}`;
}).join("\n\n")}

Build enough damage, firing speed, projectiles or area coverage before relying on recovery. Lifesteal comes only from actual basic enemy HP damage, not explosions, counters or chests. These are current rules, not a claim of completed balance.
`;
  const extraNames = ["Development", "Changelog", "Gallery", "Brand", "Validation"];
  for (const name of extraNames) zh[name] = await source(`${name}-zh-CN.md`);
  const prompt = await readFile(
    new URL("../docs/assets/brand/prompt-v1.txt", import.meta.url),
    "utf8",
  );
  for (const language of [en, zh])
    language.Brand = (language.Brand ?? "").replace(
      "{{LOGO_PROMPT}}",
      `\`\`\`text\n${prompt.trim()}\n\`\`\``,
    );
  zh.Home = `# 命运残响 · 游戏说明\n\n*在残响中，改写命运。*\n\n<img src="../assets/brand/echoes-mark-v2.svg" width="160" alt="文档版 Logo">\n\n[在线游玩](https://destiny-echo-web.littlecontrol.workers.dev/) · [预览 PRE](https://destiny-echo-web-pre.littlecontrol.workers.dev/)\n\n${(zh.Home ?? "").replace(/^# .*\n/, "")}\n\n游戏支持简体中文和英文，顶部 English / 中文 即时切换，默认中文；本地存储可用时记住选择。切换保留当前战斗、构筑与奖励选项。本页下方截图为此前版本的中文界面。\n\n${gallery("start-desktop-v1", "此前版本中文开始界面，桌面高清截图")}\n\n${gallery("start-mobile-v1", "移动端开始界面，1170×2532")}\n`;
  const images: Record<string, readonly [string, string]> = {
    Cards: ["rewards-desktop-v1", "自然首个宝箱奖励，选牌期间暂停"],
    Builds: ["build-desktop-v1", "本局构筑面板：属性、卡组与羁绊"],
    Enemies: ["combat-desktop-v1", "战役初期真实战场与敌人"],
    Stages: ["endless-pre-v1", "PRE 跳关演示的无尽攻击格，非自然通关证明"],
    Mechanics: ["combat-desktop-v1", "固定战机、敌人、弹幕与防线"],
  };
  for (const [name, [file, caption]] of Object.entries(images))
    zh[name] = (zh[name] ?? "").replace(/^(# .*\n)/, `$1\n${gallery(file, caption)}\n`);
  const labels = ["Home", "Cards", "Builds", "Enemies", "Stages", "Mechanics", ...extraNames];
  const chineseLabels = [
    "首页",
    "卡牌",
    "流派",
    "敌人",
    "关卡",
    "机制",
    "开发与发布",
    "版本日志",
    "配图",
    "品牌",
    "验证历史",
  ];
  const pages: Record<string, string> = {};
  const legacyNav = /^\[首页\]\(Home\.md\).*$/m;
  for (const name of labels) {
    pages[name] = `${en[name]?.trim()}\n`;
    const zhBody = (zh[name] ?? "")
      .replace(legacyNav, "")
      .replace(/\]\((\w+)\.md\)/g, "]($1-zh-CN.md)")
      .trim();
    pages[`${name}-zh-CN`] = `${zhBody.replace(/\n{3,}/g, "\n\n")}\n`;
    const navEn = labels.map((slug) => `[${slug}](${slug}.md)`).join(" · ");
    const navZh = labels
      .map((slug, index) => `[${chineseLabels[index]}](${slug}-zh-CN.md)`)
      .join(" · ");
    pages[name] = (pages[name] ?? "").replace(
      /^(# .*\n)/,
      `$1\nEnglish · [简体中文](${name}-zh-CN.md)\n\n${navEn}\n`,
    );
    pages[`${name}-zh-CN`] = (pages[`${name}-zh-CN`] ?? "").replace(
      /^(# .*\n)/,
      `$1\n[English](${name}.md) · 简体中文\n\n${navZh}\n`,
    );
  }
  pages._Sidebar = `## Echoes of Destiny\n\n${labels.map((slug, index) => `- [${slug}](${slug}.md) / [${chineseLabels[index]}](${slug}-zh-CN.md)`).join("\n")}\n`;
  pages._Footer =
    "[English](Home.md) · [简体中文](Home-zh-CN.md) · [Changelog](Changelog.md) · [版本日志](Changelog-zh-CN.md)\n\nRepository rules and live deployments are tracked separately. / 仓库规则与线上部署分别核验。\n";
  return pages;
}
