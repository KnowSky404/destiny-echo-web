import { getLocale, onLocaleChange, setLocale, t } from "./locale";

// These entries own the document shell and help text. Live battle content belongs to GameUI.
const strings: Record<string, readonly [string, string]> = {
  brandName: ["命运残响", "Echoes of Destiny"],
  brandSubtitle: ["Echoes of Destiny", "Rewrite fate in the echoes."],
  buildTrigger: ["本局构筑", "Build"],
  helpTrigger: ["玩法说明", "Help"],
  health: ["生命", "HP"],
  defenseLine: ["防线 / DEFENSE LINE", "DEFENSE LINE"],
  scoreInitial: ["总分 0 分", "Total 0 pts"],
  stageInitial: ["第 1 / 4 关 · 圣杯前庭", "Stage 1 / 4 · Grail Courtyard"],
  bossInitial: ["失控圣杯 · 空愿之器", "Runaway Grail · Vessel of Empty Wishes"],
  loadingTitle: ["开启这一轮命运", "Begin a new turn of fate"],
  loadingIntro: [
    "固定阵地 · 自动索敌 · 三选一构筑",
    "Fixed position · Automatic targeting · Choose one of three",
  ],
  loading: ["正在连接残响…", "Connecting to the echoes…"],
  targetHint: [
    "点击目标优先攻击 · 点击空白恢复自动",
    "Select a priority target · Select empty space for automatic targeting",
  ],
  waveInitial: ["等待共鸣", "Awaiting resonance"],
  killsInitial: ["击破 0", "Defeated 0"],
  targetInitial: ["自动索敌 · 等待目标", "Automatic targeting · Awaiting a target"],
  threatInitial: ["防线威胁 0", "Defense threats 0"],
  buildTitle: ["本局构筑", "Current Build"],
  closeBuild: ["返回战场", "Return to Battle"],
  buildCaption: [
    "查看时战斗暂停，关闭后手动继续共鸣。",
    "Battle pauses while this panel is open. Close it, then resume manually.",
  ],
  emptyBuild: ["击破宝箱，收集你的第一张卡牌。", "Break a chest to collect your first augment."],
  helpTitle: ["在残响中，改写命运。", "Rewrite fate in the echoes."],
  helpIntro: [
    "固定阵地，组合残响，突破四关并挑战无尽。",
    "Hold your position, combine augments, clear four stages and challenge Endless.",
  ],
  targetingTitle: ["自动攻击，自由点选", "Automatic fire, priority targets"],
  targetingHelp: [
    "战机自动攻击。点选敌人或宝箱优先锁定，点空白 / C 恢复自动；T 切换目标，F 重新确认当前目标。无尽第 4 层起，每次大小首领预警都需重新点选才累计主弹打断，可在起势时提前确认；起势结束才累计打断命中与伤害，自动射击照常。伤害达标仍可自动打断，随后主弹可趁弱点破防。第 4 层起，首领首次准备与已开始蓄力不受减速、眩晕拖延；遗世庇护可冻结，眩晕后短暂恢复。",
    "Your ship fires automatically. Select an enemy or chest to prioritize it; empty space / C restores auto targeting. T cycles targets; F reconfirms the current target. From Endless depth 4, reselect a leader for each warning to count primary hits. Confirm during forming if desired; interruption hits and damage count after forming ends. Automatic fire continues, and enough damage can still interrupt automatically. Primary hits exploit the exposed weak point. From depth 4, slow and stun cannot delay a leader’s first preparation or an active charge; Sanctuary freezes them. Leaders briefly recover after a stun.",
  ],
  augmentsTitle: ["三选一，组合流派", "Choose one, shape your build"],
  augmentsHelp: [
    "宝箱和补给三选一。同流派叠加 3 / 6 / 9 层解锁羁绊。击破常规波次与首领积累锻体阅历，每次所需阅历递增；总分另计，顶部构筑面板查看进度。",
    "Choose one of three chest or supply rewards. Matching families unlock synergies at 3 / 6 / 9 stacks. Regular waves and bosses grant Training XP; each training costs more XP. Total score is tracked separately. Check progress in Build.",
  ],
  rewardsTitle: ["突破四关，挑战无尽", "Clear four stages, enter Endless"],
  rewardsHelp: [
    "首领与小怪全灭、余响消散后领奖。突破四关可保留构筑挑战无尽：清空怪群与小首领推进分段、获得补给，最后迎战主首领。第 4 层起两只小首领同段；第 7 层起普通怪两只成组，第 13 层起三只成组。高星普通怪承受的敌方生命伤害项、减速强度与眩晕时长按星级减弱；第 7 层起，普通怪的百分比伤害额度，以及战斗回血与转盾共享的回复额度随层数温和下降，构筑可查看 HP/s 与转盾储量，已有护盾与卡牌即时效果保留。吸血另受自身生命上限和吸血对应的回复上限限制。无尽第 7 层起，普通近战与敌方弹幕单次最多承受生命上限的 35%；首领重击第 4 层起为 45%。多次攻击和持续伤害仍可致命。生命归零则本局结束。",
    "Clear the boss and all minions, then let their echoes fade to claim a reward. Keep your build after four stages for Endless: clear waves and sub-bosses to earn supplies before the main boss. From depth 4, two sub-bosses share a segment. Minions arrive in groups of two from depth 7 and three from depth 13. Higher-star minions resist enemy-HP damage, slow strength and stun duration according to their stars. From depth 7, the minion percentage-damage allowance and the shared allowance for combat HP recovery and shield generation gently decline with depth. Check HP/s and shield storage in Build; existing shield and immediate card effects remain. Lifesteal also keeps its maximum-HP and lifesteal-based ceiling. From Endless depth 7, ordinary melee and enemy projectiles each deal at most 35% of maximum HP; boss slams are capped at 45% from depth 4. Multiple attacks and ongoing damage can still kill. Zero HP ends the run.",
  ],
  pauseTitle: ["随时暂停，重新出发", "Pause and start again"],
  pauseHelp: [
    "P / Esc 或暂停按钮；查看面板和切后台也会暂停。返回后手动继续，重开清除本局。",
    "Use P / Esc or Pause. Panels and backgrounding also pause battle; resume manually when you return. Restart clears the run.",
  ],
  wikiLink: ["完整游戏 Wiki", "Complete Game Wiki"],
  wikiDescription: [
    "卡牌、怪物、羁绊与详细机制",
    "Cards, enemies, synergies and detailed mechanics",
  ],
  originalArt: ["原创几何美术", "Original geometric art"],
  sourceCode: ["源代码 · AGPL-3.0-or-later", "Source code · AGPL-3.0-or-later"],
  closeHelp: ["明白了", "Got It"],
  gameTools: ["游戏工具", "Game tools"],
  gameScreen: ["游戏主界面", "Game arena"],
  playerHealth: ["玩家生命", "Player health"],
  runScore: ["本局得分", "Run score"],
  combatTime: ["战斗用时", "Combat time"],
  pauseGame: ["暂停游戏", "Pause game"],
  synergyProgress: ["流派联动进度", "Family synergy progress"],
};

function textFor(key: string | null): string {
  const entry = key === null ? undefined : strings[key];
  if (!entry) throw new Error(`Missing shell translation: ${key}`);
  return t(entry[0], entry[1]);
}

function translateNodes(attribute: string, targetAttribute?: string, once = false): void {
  for (const node of document.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    const text = textFor(node.getAttribute(attribute));
    if (targetAttribute) node.setAttribute(targetAttribute, text);
    else node.textContent = text;
    if (once) node.removeAttribute(attribute);
  }
}

/** Translate static nodes in place so game controls and open dialogs retain their listeners. */
export function initShell(): () => void {
  const languageButton = document.querySelector<HTMLButtonElement>("#language-button");
  if (!languageButton) throw new Error("Missing language button");
  const render = () => {
    document.documentElement.lang = getLocale();
    document.title = t("命运残响 · Echoes of Destiny", "Echoes of Destiny");
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute(
        "content",
        t(
          "命运残响：圣杯失控中。固定阵地防守 Roguelike：自动索敌、点选目标、阻止敌人突破防线，集齐流派卡牌，连续突破四关并挑战无尽。",
          "Echoes of Destiny. A fixed-position defense roguelike: automatic targeting, priority targets, family synergies, four campaign stages and Endless mode.",
        ),
      );
    translateNodes("data-i18n");
    translateNodes("data-i18n-aria", "aria-label");
    languageButton.textContent = t("English", "中文");
    languageButton.lang = getLocale() === "zh-CN" ? "en" : "zh-CN";
    const label = t("Switch to English", "切换为中文");
    languageButton.title = label;
    languageButton.setAttribute("aria-label", label);
  };
  translateNodes("data-i18n-initial", undefined, true);
  translateNodes("data-i18n-aria-initial", "aria-label", true);
  render();
  const toggle = () => setLocale(getLocale() === "zh-CN" ? "en" : "zh-CN");
  languageButton.addEventListener("click", toggle);
  const unsubscribe = onLocaleChange(render);
  return () => {
    languageButton.removeEventListener("click", toggle);
    unsubscribe();
  };
}
