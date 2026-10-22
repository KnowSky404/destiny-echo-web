import { officialProfile } from "../data/balance/profile";
import { STAGES } from "../data/stages";
import { CONFIG } from "../game/config";
import { getLocale, onLocaleChange, setLocale, t } from "./locale";

const endless = officialProfile().payload.endless;
const finale = STAGES[STAGES.length - 1];
if (!finale) throw new Error("Missing endless baseline stage");
const n = (value: number) => Number(value.toFixed(4));
const thresholds = CONFIG.endless.bossThresholds.map((value) => `${n(value * 100)}%`).join(" / ");
const firstSlam = Math.round(endless.slamDamage * endless.damageMultiplier);
const slamGrowth = n(endless.slamDamagePerStage * endless.damageMultiplier);

// These entries own the document shell and help text. Live battle content belongs to GameUI.
const strings: Record<string, readonly [string, string]> = {
  brandName: ["命运残响", "Echoes of Destiny"],
  brandSubtitle: ["Echoes of Destiny", "Rewrite fate in the echoes."],
  buildTrigger: ["本局构筑", "Build"],
  helpTrigger: ["玩法说明", "Help"],
  health: ["生命", "HP"],
  scoreInitial: ["0 分", "0 points"],
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
    "你是最后的共鸣者。固定阵地，提前消灭威胁，击败失控的圣杯。",
    "You are the last Resonator. Hold your position, eliminate threats early, and defeat the runaway Grail.",
  ],
  targetingTitle: ["固定阵地与点选", "Fixed position and targeting"],
  targetingHelp: [
    "战机固定居中，自动追踪攻击。点选敌人或宝箱设置优先目标，点空白或 C 恢复自动，T 切换目标。WASD、方向键与拖动不移动战机。",
    "Your ship stays in the center and fires homing shots automatically. Select an enemy or chest to prioritize it; select empty space or press C to restore automatic targeting. T cycles targets. WASD, arrow keys and dragging do not move the ship.",
  ],
  layoutTitle: ["桌面与手机", "Desktop and mobile"],
  layoutHelp: [
    "手机为四条侧翼车道，1920×1080 桌面约六条；出生位置、下方攻击点、数量上限和预算按实际车道计算。桌面初始火力和弹速同步适配，范围效果按车道间距调整，怪物保持正常大小。页面打开时确定本局布局，窗口缩放只做等比显示。",
    "Mobile uses four side lanes; a 1920×1080 desktop uses roughly six. Spawn positions, lower attack positions, population caps and budgets follow the actual lane count. Desktop starting damage and shot speed scale accordingly, and area effects scale with lane spacing; monsters retain their normal size. The layout is chosen when the page opens. Resizing only rescales its display.",
  ],
  augmentsTitle: ["宝箱与构筑", "Chests and builds"],
  augmentsHelp: [
    "51 张残响、12 条流派，同流派累计 3 / 6 / 9 层触发质变，重复升级计层。12 张史诗每局各限取一次。首关只开放弹幕、泰坦、暴击与雷霆四类输出卡，第二关起开放全部流派。宝箱或补给取得三层后有 25% 概率出现史诗候选，过关候选也随机，不保底史诗。",
    "Collect 51 augments across 12 families. Family tiers unlock at 3 / 6 / 9 stacks, including duplicate upgrades. Each of the 12 epics can be acquired once per run. Stage one offers only the offensive Barrage, Might, Precision and Storm families; all families unlock in stage two. After three acquired cards, chest and supply offers have a 25% chance to include an epic candidate. Stage rewards are also random; an epic is never guaranteed.",
  ],
  percentDamageTitle: ["巨人杀手与百分比侵蚀", "Giant Slayer and percentage erosion"],
  percentDamageHelp: [
    "巨人杀手按怪物最大生命和敌我体量增加伤害；侵蚀按最大生命、当前生命或全场周期脉冲结算。主弹最大生命系数合计最高 5%，当前生命系数最高 10%；副弹与连锁不重复触发。每组包含三张普通卡与一张史诗，并有独立的三档羁绊。",
    "Giant Slayer adds damage based on monster maximum HP and the enemy/player maximum-HP ratio. Erosion uses maximum HP, current HP or periodic arena-wide pulses. Combined primary-shot coefficients cap at 5% maximum HP and 10% current HP; secondaries and chains do not trigger them again. Each family contains three ordinary cards and one epic, with its own three synergy tiers.",
  ],
  retaliationTitle: ["自爆与全屏反击", "Explosions and arena-wide retaliation"],
  retaliationHelp: [
    "击杀爆炸每层造成 16 点加来源怪物最大生命 3%；献祭每层 20 点加目标最大生命 2%，并保留玩家生命加成。殉星六层可连锁。荆棘每次有效受击向全场每个敌人造成每层 18 点伤害，护盾承伤也触发；壁垒六层翻倍，并额外反震最大生命 25%，九层为 50%。毒伤和无敌期间不触发。",
    "Each kill-explosion stack deals 16 damage plus 3% of the source monster’s maximum HP. Each sacrifice stack deals 20 damage plus 2% of the target’s maximum HP, retaining the player-HP bonus. Starfall Blast tier 6 enables explosion chains. Each effective hit, including shield absorption, triggers thorns against every enemy for 18 damage per stack. Bastion tier 6 doubles thorns and adds reflection equal to 25% player maximum HP, rising to 50% at tier 9. Poison and hits during invulnerability do not trigger retaliation.",
  ],
  recoveryTitle: ["治疗、护盾与重伤", "Healing, shields and wounds"],
  recoveryHelp: [
    "吸血只按普攻实际伤害计算，基础比例合计最高 50%，再乘 0.85。过量治疗可转护盾，有盾时赤盾汲取增加吸血。重伤固定减少 90% 治疗、生命恢复和护盾获得量，包括卡牌与定时补盾；重复只延长时间。过量治疗先减疗，转盾不重复折减，已有护盾和生命上限不被扣除。",
    "Lifesteal uses only actual damage dealt by basic attacks. Its combined base rate caps at 50%, then multiplies by 0.85. Overhealing can become shield; Crimson Siphon adds lifesteal while shielded. Wounds reduce all healing, regeneration and shield gains by 90%, including card effects and timed shield refills. Reapplication only extends the duration. Overhealing is reduced before conversion without a second penalty; existing shield and maximum HP are not deducted.",
  ],
  enemySkillsTitle: ["敌人技能", "Enemy skills"],
  enemySkillsHelp: [
    "坦克嘲讽持续 2.5 秒，40% 概率选择该技能，其余行动近战攻击；没有有效嘲讽时不强制锁定坦克。无尽先锁定能攻击的敌人，攻击区为空才受范围外嘲讽影响；遗世庇护期间解除限制。远程怪推进中即可开火，战役远近怪都停驻在各自分配的车道格。",
    "Tanks have a 40% chance to choose a 2.5s taunt; other actions are melee attacks. Without an active taunt, tanks do not force a lock. Endless targeting prioritizes enemies permitted to attack; out-of-area taunts restrict targets only when none qualify. Sanctuary lifts these restrictions. Ranged enemies can fire while advancing. Campaign melee and ranged enemies stop in their assigned lane positions.",
  ],
  poisonTitle: ["中毒", "Poison"],
  poisonHelp: [
    "巫师有 40% 概率选择毒素，否则远程射击。毒初始持续 3 秒、每秒 10 伤害，护盾先承伤并附带重伤。重复施加在剩余时间上加 3 秒，并随机使每秒伤害 +1 或总攻速降低 +1 个百分点。无护盾且中毒时总攻速降低 30% 起步，最高 90%；有盾立即免除攻速惩罚，中毒结束清除强化。普通射击与死亡不施毒。",
    "Wizards have a 40% chance to use poison; otherwise they fire a ranged shot. Poison initially lasts 3s, deals 10 damage per second, drains shield first and applies wounds. Each reapplication adds 3s to the remaining duration and randomly adds either 1 damage per second or 1 percentage point of total attack-speed reduction. Poison without shield reduces total attack speed by at least 30%, up to 90%. Positive shield immediately suppresses this penalty. Poison escalation clears when poison ends. Ordinary shots and death do not apply poison.",
  ],
  sanctuaryTitle: ["遗世庇护", "Sanctuary"],
  sanctuaryHelp: [
    "静默王权每 8 秒净化中毒、重伤与减速，敌方时序冻结，玩家继续攻击。持续 0.5 + 0.25×强化层数秒，首层 0.75 秒；王权羁绊延长，首领不减免。六层王权改为每 6 秒并清弹。暂停和选牌保留时长，过关与重开清除。",
    "Silent Dominion cleanses poison, wounds and slow every 8s, freezing hostile time while the player keeps firing. Duration is 0.5 + 0.25 × enhancement stacks in seconds: 0.75s for the first stack. Dominion synergy extends it; bosses receive its full duration. Dominion tier 6 changes the interval to 6s and clears hostile bullets. Pause and reward selection preserve the remaining duration; stage transitions and restart clear it.",
  ],
  rewardsTitle: ["首领、清剿与奖励", "Bosses, cleanup and rewards"],
  rewardsHelp: [
    "首领死亡停止援军并取消待召唤队列，剩余小怪及弹幕继续战斗。必须清完小怪才结算，两项不同锻体与一张随机残响三选一；第三张可能是普通、稀有或史诗，不优先史诗。累计每 5,000 分自动获得一张随机锻体，不计羁绊。前三关领奖后最多回复 35 生命继续，第四关领奖后胜利，可保留构筑继续无尽。",
    "Boss death stops reinforcements and cancels pending summons, but surviving minions and hostile bullets keep fighting. Clear every minion before choosing one of two distinct trainings and one random augment. The augment may be common, rare or epic, without epic priority. Every 5,000 cumulative points automatically grants one random training, which adds no synergy stack. Rewards from the first three stages restore up to 35 HP before continuing. Claim the fourth-stage reward to win, then retain your build to enter Endless.",
  ],
  attackRegionsTitle: ["无尽攻击区域", "Endless attack regions"],
  attackRegionsHelp: [
    "敌方区域分为车道数 × 7 格，战机所在行不参与抽取或格数统计。防线前两排对应的下方两行初始开放，每关无尽通关后只从未开放格中随机永久增加两个，排除固有与已开区域，直到覆盖全部敌方区域。淡红描边表示全部已开区域，近战怪进入即可蓄力和攻击。手机最多 24 只小怪加首领，六车道桌面为 36 加首领；预算随车道调整，超额数量转成属性。同类同星三合一可升至三星并回满生命。",
    "The enemy area contains lane count × 7 cells; the player’s row is excluded. The bottom two enemy rows near the defense line are open initially. Each Endless clearance permanently opens two random inactive cells, excluding existing cells, until the enemy area is fully covered. Pale red borders show all open cells; melee enemies inside them may prepare and attack. Mobile supports up to 24 minions plus a boss; a six-lane desktop supports 36 plus a boss. Budgets scale with lanes, and excess population becomes stronger stats. Three matching enemies of the same kind and star level fuse, up to three stars, and heal to full HP.",
  ],
  spawningTitle: ["无尽随机出生", "Random Endless spawns"],
  spawningHelp: [
    "普通怪、护卫和强化召唤共用每关 30% 攻击区出生保底，按成功出生累计向上取整，自然随机落入也计入。其余出生每次从上半屏侧翼车道的合法空位随机选择；首领从顶部中央登场。满员或保底所需攻击区无合法空位时等待，不消耗出生、兵种或召唤名额。",
    "Routine enemies, escorts and enhanced summons share a 30% attack-region spawn guarantee per stage, rounded up from successful spawns. Naturally random attack-region spawns also count. Other spawns choose a random legal vacancy in the upper side lanes each time; bosses enter from the top center. If the arena is full, or the guarantee requires an attack-region cell with no legal vacancy, the spawn waits without consuming population, enemy-type or summon slots.",
  ],
  scalingTitle: ["无尽强度", "Endless difficulty"],
  scalingHelp: [
    `普通伤害倍率为 ${n(endless.damageMultiplier)}×min(8,${n(finale.damage)}×${n(endless.damageGrowth)}^min(关数,100))，小怪数量浓缩另乘 √P（P 为浓缩倍率）。准备与间隔从 ${n(Math.max(0.35, endless.attackTiming))} 倍开始，每过一关再乘 ${n(endless.timingGrowth)}，最低 0.35 倍。首领生命至少高于同关最强三星强化坦克 25%。首领血量 ${thresholds} 随机释放减伤、召唤或重击，重击首关直接扣 ${firstSlam} 生命，之后每关 +${slamGrowth}，最终伤害四舍五入。每关 ${endless.supplies} 次补给加一次过关奖励。玩家生命归零才失败，没有超时失败。`,
    `Ordinary damage scales by ${n(endless.damageMultiplier)} × min(8, ${n(finale.damage)} × ${n(endless.damageGrowth)}^min(layer,100)). Minion population compression adds a separate ×√P, where P is the compression factor. Preparation and attack intervals start at ${n(Math.max(0.35, endless.attackTiming))}×, then multiply by ${n(endless.timingGrowth)} each layer, down to 0.35×. Boss HP is at least 25% above the strongest enhanced three-star tank in that layer. At ${thresholds} HP, bosses randomly use damage reduction, summons or slam. Slam directly removes ${firstSlam} HP in layer one, then ${slamGrowth} more per layer. Round final damage to the nearest integer. Each layer gives ${endless.supplies} supplies and one boss reward. Only zero player HP causes defeat; there is no timeout.`,
  ],
  pauseTitle: ["暂停与重开", "Pause and restart"],
  pauseHelp: [
    "顶部可打开构筑与玩法说明，查看时暂停，关闭后手动继续。Esc / P 或暂停按钮；后台和失焦会暂停。选牌不可跳过。死亡重开清除本局卡牌、锻体、攻击格、状态与分数；无账号或跨局存档。",
    "Open Build or Help from the header to pause; close the dialog, then resume manually. Use Esc / P or the pause button. Backgrounding or losing focus also pauses. Reward selection cannot be skipped. Restart after defeat clears all augments, training, attack cells, statuses and score. There are no accounts or saved runs.",
  ],
  wikiLink: [
    "完整游戏 Wiki：卡牌、怪物、羁绊与机制",
    "Complete Game Wiki: cards, enemies, synergies and mechanics",
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
