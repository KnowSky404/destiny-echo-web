import { CARD_BY_ID, RARITY_NAMES } from "../data/cards";
import { STAGES } from "../data/stages";
import { SYNERGIES, SYNERGY_BY_ID, SYNERGY_THRESHOLDS } from "../data/synergies";
import { REWARD_BY_ID, TRAINING_BY_ID } from "../data/training";
import { CONFIG } from "../game/config";
import { combatStats, overhealStats } from "../game/stats";
import { synergyPreview, synergyProgress, synergyTier, synergyUnlock } from "../game/synergies";
import { poisonSlow } from "../game/systems/damage";
import { attackPermitted } from "../game/systems/enemy";
import { isEnemy } from "../game/systems/targeting";
import type { Phase } from "../game/types";
import type { World } from "../game/world";
import {
  bossName,
  enemyName,
  rewardDescription,
  rewardName,
  stageName,
  stageSubtitle,
  tierName,
} from "../i18n/content";
import { getLocale, onLocaleChange, t } from "../i18n/locale";
import { icon } from "./icons";

export function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing UI element: ${selector}`);
  return result;
}

export function formatTime(seconds: number): string {
  const time = Math.floor(seconds);
  return `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
}

export class GameUI {
  private readonly overlay = element("#overlay");
  private readonly pauseButton = element<HTMLButtonElement>("#pause-button");
  private readonly healthValue = element("#health-value");
  private readonly shieldValue = element("#shield-value");
  private readonly statusEffects = element("#status-effects");
  private readonly healthFill = element("#health-fill");
  private readonly healthMeter = element<HTMLMeterElement>("#health-meter");
  private readonly timer = element("#timer");
  private readonly waveLabel = element("#wave-label");
  private readonly killLabel = element("#kill-label");
  private readonly targetLabel = element("#target-label");
  private readonly threatLabel = element("#threat-label");
  private readonly bossHealth = element("#boss-health");
  private readonly bossName = element("#boss-health > span");
  private readonly bossFill = element("#boss-fill");
  private readonly notice = element("#arena-notice");
  private readonly stats = element("#stats");
  private readonly collection = element("#collected-cards");
  private readonly synergies = element("#synergies");
  private readonly stageLabel = element("#stage-label");
  private readonly stageRoute = element("#stage-route");
  private readonly build = element<HTMLDialogElement>("#build-dialog");
  private readonly scoreValue = element("#score-value");
  private readonly scoreProgress = element("#score-progress");
  private readonly help = element<HTMLDialogElement>("#help-dialog");
  private lastPhase: Phase | undefined;
  private lastReward = 0;
  private lastStats = "";
  private lastBuild = "";
  private loaded = false;
  private fatal = false;
  private failure: { title: string | (() => string); message: string | (() => string) } | undefined;
  private fullscreenFallback = false;
  private readonly unsubscribeLocale: () => void;
  private frame = 0;
  private lastHudAt = 0;

  constructor(
    private readonly world: World,
    private readonly startRun: () => boolean = () => world.start(),
  ) {
    this.pauseButton.addEventListener("click", () => {
      if (!this.loaded || this.fatal) return;
      // A blur may pause the model after this button was painted as "pause".
      // Follow the displayed intent so that the same click cannot resume it.
      if (this.pauseButton.dataset.action === "resume") world.resume();
      else world.pause();
    });
    document.querySelectorAll(".help-trigger").forEach((button) => {
      button.addEventListener("click", () => {
        if (world.phase === "Playing") world.pause();
        this.help.showModal();
      });
    });
    element("#build-trigger").addEventListener("click", () => {
      if (world.phase === "Playing") world.pause();
      this.build.showModal();
    });
    element("#close-build").addEventListener("click", () => this.build.close());
    const fullscreen = element<HTMLButtonElement>("#fullscreen-button");
    fullscreen.hidden = !document.fullscreenEnabled;
    fullscreen.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        this.fullscreenFallback = true;
        this.renderFullscreen();
      }
    });
    document.addEventListener("fullscreenchange", () => {
      this.fullscreenFallback = false;
      this.renderFullscreen();
    });
    element("#close-help").addEventListener("click", () => this.help.close());
    window.addEventListener("keydown", (event) => {
      if (document.querySelector("dialog[open]") || this.fatal) return;
      if ((event.key === "Escape" || event.key.toLowerCase() === "p") && !event.repeat) {
        event.preventDefault();
        this.togglePause();
      }
      if (event.key === "Tab" && !this.overlay.hidden) this.trapFocus(event);
    });
    const pauseForBackground = () => {
      if (world.phase === "Playing") world.pause();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseForBackground();
    });
    window.addEventListener("blur", pauseForBackground);
    window.addEventListener("pagehide", pauseForBackground);
    this.unsubscribeLocale = onLocaleChange(() => {
      this.lastStats = "";
      this.lastBuild = "";
      this.renderFullscreen();
      this.renderHud();
      if (this.fatal) this.renderFailure();
      else if (this.loaded) this.renderOverlay(false);
    });
    this.renderFullscreen();
    this.tick(0);
  }

  ready(): void {
    this.loaded = true;
    this.lastPhase = undefined;
  }

  fail(title: string | (() => string), message: string | (() => string)): void {
    this.fatal = true;
    this.failure = { title, message };
    this.world.pause();
    this.renderFailure();
  }

  private renderFailure(): void {
    if (!this.failure) return;
    const title =
      typeof this.failure.title === "function" ? this.failure.title() : this.failure.title;
    const message =
      typeof this.failure.message === "function" ? this.failure.message() : this.failure.message;
    this.overlay.hidden = false;
    this.overlay.innerHTML = `<section class="modal error-modal" role="alert"><div class="modal-emblem" aria-hidden="true"><img src="/brand/echoes-mark.svg" width="44" height="44" alt="" /></div><h2>${title}</h2><p>${message}</p><button class="button button-primary" type="button">${t("重新加载", "Reload")}</button></section>`;
    this.overlay.querySelector("button")?.addEventListener("click", () => window.location.reload());
    this.pauseButton.disabled = true;
  }

  private renderFullscreen(): void {
    element("#fullscreen-button").textContent = this.fullscreenFallback
      ? t("请按 F11 全屏", "Press F11 for fullscreen")
      : document.fullscreenElement
        ? t("退出全屏", "Exit fullscreen")
        : t("全屏", "Fullscreen");
  }

  private togglePause(): void {
    if (!this.loaded) return;
    if (this.world.phase === "Playing") this.world.pause();
    else if (this.world.phase === "Paused") this.world.resume();
  }

  private tick = (now: number): void => {
    if (!this.fatal) {
      if (
        this.loaded &&
        (this.lastPhase !== this.world.phase || this.lastReward !== (this.world.reward?.token ?? 0))
      ) {
        this.renderOverlay();
        this.renderHud();
        this.lastHudAt = now;
      }
      if (now - this.lastHudAt >= 80 || now === 0) {
        this.renderHud();
        this.lastHudAt = now;
      }
    }
    this.frame = window.requestAnimationFrame(this.tick);
  };

  private renderHud(): void {
    const world = this.world;
    const { player } = world;
    this.healthValue.textContent = `${Math.ceil(player.hp)} / ${player.stats.maxHp}`;
    this.shieldValue.textContent =
      player.shield > 0
        ? t(`+${Math.ceil(player.shield)} 护盾`, `+${Math.ceil(player.shield)} Shield`)
        : "";
    this.statusEffects.textContent = [
      world.sanctuaryRemaining > 0
        ? t(
            `遗世庇护 ${world.sanctuaryRemaining.toFixed(1)}s · 已净化 · 敌方时序冻结`,
            `Sanctuary ${world.sanctuaryRemaining.toFixed(1)}s · Cleansed · Enemy time frozen`,
          )
        : "",
      player.poisonTime > 0
        ? t(
            `中毒 ${player.poisonTime.toFixed(1)}s · 每秒 ${CONFIG.endless.poisonDamagePerSecond + player.poisonDamageBonus} 伤害`,
            `Poison ${player.poisonTime.toFixed(1)}s · ${CONFIG.endless.poisonDamagePerSecond + player.poisonDamageBonus} damage/s`,
          )
        : "",
      player.woundTime > 0
        ? t(
            `重伤 ${player.woundTime.toFixed(1)}s · 治疗 / 护盾获得 -90%`,
            `Wounded ${player.woundTime.toFixed(1)}s · Healing / shield gain -90%`,
          )
        : "",
      poisonSlow(player) > 0
        ? t(
            `总攻速 -${Math.round(poisonSlow(player) * 100)}%`,
            `Total attack speed -${Math.round(poisonSlow(player) * 100)}%`,
          )
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    this.statusEffects.hidden = !this.statusEffects.textContent;
    this.healthFill.style.width = `${(player.hp / player.stats.maxHp) * 100}%`;
    this.healthMeter.max = player.stats.maxHp;
    this.healthMeter.value = Math.ceil(player.hp);
    this.timer.textContent = formatTime(world.elapsed);
    this.timer.setAttribute(
      "aria-label",
      t(
        `累计 ${formatTime(world.elapsed)}，本关 ${formatTime(world.stageElapsed)}`,
        `Total ${formatTime(world.elapsed)}, stage ${formatTime(world.stageElapsed)}`,
      ),
    );
    this.stageLabel.textContent = `${world.endless ? t("无尽", "Endless") : t(`第 ${world.stageIndex + 1} / ${STAGES.length} 关`, `Stage ${world.stageIndex + 1} / ${STAGES.length}`)} · ${stageName(world.stageIndex)}`;
    this.stageRoute.textContent = `${t(`${world.clearedStages} 关已突破 · 本关 ${formatTime(world.stageElapsed)} · 无时间限制`, `${world.clearedStages} stages cleared · Stage ${formatTime(world.stageElapsed)} · No time limit`)}${world.sanctuaryRemaining > 0 ? t(" · 敌方时序已冻结", " · Enemy time frozen") : ""}${world.endless ? t(` · 攻击区 ${world.attackRegions.length}/${world.arena.attackRegions.length} · 场内 ${world.enemies.items.filter((enemy) => enemy.active).length}/${world.stage.maxEnemies} · 出怪预算 ${world.stage.enemyCount} · 浓缩 ×${Number(world.stage.populationScale.toPrecision(3))} · 补给 ${world.stageSupplies}/${world.endlessRules.supplies}`, ` · Attack zones ${world.attackRegions.length}/${world.arena.attackRegions.length} · On field ${world.enemies.items.filter((enemy) => enemy.active).length}/${world.stage.maxEnemies} · Spawn budget ${world.stage.enemyCount} · Density ×${Number(world.stage.populationScale.toPrecision(3))} · Supplies ${world.stageSupplies}/${world.endlessRules.supplies}`) : ""}`;
    this.waveLabel.textContent =
      world.phase === "Menu"
        ? t("等待共鸣", "Awaiting resonance")
        : world.bossSpawned
          ? world.bossDefeated
            ? t("清剿残敌 · 全灭后过关", "Clear remaining enemies to advance")
            : t("首领战 · 集中火力", "Boss battle · Focus fire")
          : t(`第 ${world.wave} 波 · 残响涌动`, `Wave ${world.wave} · Echoes rising`);
    this.scoreValue.textContent = t(
      `${world.score.toLocaleString("zh-CN")} 分`,
      `${world.score.toLocaleString("en-US")} pts`,
    );
    this.scoreProgress.textContent = `${t(`分数锻体已发 ${world.scoreTrainings} 张 · 下一张 ${(world.scoreMilestones + 1) * CONFIG.scoreTrainingInterval} 分`, `Score training awarded ${world.scoreTrainings} · Next at ${(world.scoreMilestones + 1) * CONFIG.scoreTrainingInterval} pts`)}${world.scoreMilestones > world.scoreTrainings ? t(` · 无候选跳过 ${world.scoreMilestones - world.scoreTrainings} 次`, ` · No eligible training: ${world.scoreMilestones - world.scoreTrainings} skipped`) : ""}${world.lastScoreTraining ? t(` · 最近获得：${rewardName(world.lastScoreTraining)}`, ` · Latest: ${rewardName(world.lastScoreTraining)}`) : ""}`;
    this.killLabel.textContent = t(`击破 ${world.kills}`, `Kills ${world.kills}`);
    const target = world.target;
    this.targetLabel.textContent = target
      ? `${world.sanctuaryRemaining <= 0 && world.endless && isEnemy(target) && attackPermitted(target) ? t("攻击区优先", "Attack zone priority") : world.sanctuaryRemaining <= 0 && isEnemy(target) && target.kind === "tank" && target.tauntRemaining > 0 ? t("嘲讽锁定", "Taunt lock") : world.manualTargetId !== null ? t("手动优先", "Manual priority") : t("自动锁定", "Auto lock")} · ${isEnemy(target) ? (target.kind === "boss" ? bossName(world.stageIndex) : `${enemyName(target.kind)} · ${t(`${target.stars}星`, `${target.stars}★`)}${target.tauntRemaining > 0 ? t(` · 嘲讽 ${target.tauntRemaining.toFixed(1)}s`, ` · Taunt ${target.tauntRemaining.toFixed(1)}s`) : ""}`) : t("残响宝箱", "Echo chest")}`
      : t("自动索敌 · 等待目标", "Auto targeting · Awaiting target");
    const threats = world.enemies.items.filter(
      (enemy) => enemy.active && enemy.stage !== "Approaching",
    ).length;
    this.threatLabel.textContent = t(`防线威胁 ${threats}`, `Threats ${threats}`);
    this.pauseButton.disabled = !this.loaded || !["Playing", "Paused"].includes(world.phase);
    this.pauseButton.dataset.action = world.phase === "Paused" ? "resume" : "pause";
    this.pauseButton.setAttribute(
      "aria-label",
      world.phase === "Paused" ? t("继续游戏", "Resume game") : t("暂停游戏", "Pause game"),
    );
    // Preserve the pointer target across HUD refreshes; replacing the SVG between
    // pointerdown and pointerup can cancel Firefox's native click event.
    this.pauseButton
      .querySelector("path")
      ?.setAttribute("d", world.phase === "Paused" ? "m8 5 11 7-11 7Z" : "M8 5v14M16 5v14");
    const boss = world.boss;
    this.bossHealth.hidden = !boss;
    if (boss) {
      this.bossFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
      this.bossName.textContent = world.endless
        ? `${bossName(world.stageIndex)} · ${t(`技能 ${boss.skillsUsed}/3 · 重击 ${world.bossSlamDamage}`, `Skills ${boss.skillsUsed}/3 · Slam ${world.bossSlamDamage}`)}${boss.damageReductionTime > 0 ? t(` · 减伤 90% ${boss.damageReductionTime.toFixed(1)}s`, ` · Damage reduction 90% ${boss.damageReductionTime.toFixed(1)}s`) : ""}${boss.arrived ? t(" · 攻击 ×2", " · Attack ×2") : ""}`
        : boss.hp < boss.maxHp / 2
          ? `${bossName(world.stageIndex)} · ${t("狂乱阶段", "Frenzy phase")}`
          : bossName(world.stageIndex);
    }
    const notice =
      world.phase === "Playing" && world.elapsed < world.noticeUntil ? world.localizedNotice : "";
    if (this.notice.textContent !== notice) this.notice.textContent = notice;
    const effective = combatStats(player, world.stacks);
    const overflow = overhealStats(player, world.stacks);
    const statKey = JSON.stringify([player.stats, effective, overflow]);
    if (this.lastStats !== statKey) {
      this.lastStats = statKey;
      const rows = [
        ["damage", t("术式伤害", "Spell damage"), String(Number(effective.damage.toFixed(1)))],
        ["haste", t("攻击间隔", "Attack interval"), `${effective.interval.toFixed(2)}s`],
        ["multishot", t("弹幕数量", "Projectiles"), String(effective.projectiles)],
        ["piercing", t("穿透目标", "Pierce targets"), String(player.stats.piercing)],
        ["vitality", t("生命上限", "Max health"), String(player.stats.maxHp)],
        [
          "critical",
          t("暴击率 / 倍率", "Crit chance / multiplier"),
          `${Math.round(effective.critChance * 100)}% / ${effective.critDamage.toFixed(2)}×`,
        ],
        [
          "bloodpact",
          t("普攻吸血", "Attack lifesteal"),
          `${Number((effective.lifesteal * 100).toFixed(2))}%`,
        ],
        [
          "ward",
          t("过量转盾 / 储量", "Overheal shield / capacity"),
          `${Math.round(overflow.conversion * 100)}% / ${Math.round(overflow.capacity)}`,
        ],
        [
          "frost",
          t("命中减速", "On-hit slow"),
          `${Math.round(Math.min(0.7, player.stats.slow + (synergyTier(world.stacks, "frost") >= 3 ? 0.1 : 0)) * 100)}%`,
        ],
        ["control", t("命中眩晕", "On-hit stun"), `${player.stats.stun.toFixed(2)}s`],
        [
          "focus",
          t("巨人杀手", "Giant slayer"),
          t(
            `${Number((player.stats.giantSlayer * 100).toFixed(2))}% 最大生命`,
            `${Number((player.stats.giantSlayer * 100).toFixed(2))}% max HP`,
          ),
        ],
        [
          "storm",
          t("百分比侵蚀", "Percent erosion"),
          t(
            `${Number((player.stats.maxHealthDamage * 100).toFixed(2))}% 最大 / ${Number((player.stats.currentHealthDamage * 100).toFixed(2))}% 当前`,
            `${Number((player.stats.maxHealthDamage * 100).toFixed(2))}% max / ${Number((player.stats.currentHealthDamage * 100).toFixed(2))}% current`,
          ),
        ],
      ];
      this.stats.innerHTML = rows
        .map(
          ([symbol, label, value]) =>
            `<div><dt>${icon(symbol ?? "damage")}<span>${label}</span></dt><dd>${value}</dd></div>`,
        )
        .join("");
    }
    const buildKey = JSON.stringify([[...world.stacks], [...world.trainingStacks]]);
    if (this.lastBuild !== buildKey) {
      this.lastBuild = buildKey;
      const openSynergies = new Set(
        [...this.synergies.querySelectorAll<HTMLDetailsElement>("details[open]")].map(
          (details) => details.dataset.synergy,
        ),
      );
      this.synergies.innerHTML = synergyProgress(world.stacks, getLocale())
        .map(
          (synergy) => `
        <details class="synergy-card ${synergy.tier > 0 ? "active" : ""}" data-synergy="${synergy.id}" style="--synergy-color:${synergy.color}" ${openSynergies.has(synergy.id) ? "open" : ""}>
          <summary><span class="synergy-symbol">${icon(synergy.symbol)}</span><strong>${synergy.name}</strong><span class="synergy-count">${Math.min(9, synergy.count)}/9 · ${tierName(synergy.tier)}</span></summary>
          <div class="synergy-details"><p>${t(`累计 ${synergy.count} 层 · 重复升级计入`, `${synergy.count} total stacks · Repeat upgrades count`)}</p><p>${synergy.cards.map((card) => `<span class="${card.owned ? "owned" : ""}">${card.owned ? "✦" : "◇"} ${card.name}${card.stacks > 0 ? ` ×${card.stacks}` : ""}</span>`).join(" · ")}</p>${synergy.tiers.map((description, index) => `<p class="${synergy.count >= (SYNERGY_THRESHOLDS[index] ?? 9) ? "unlocked" : ""}"><b>${t(`${SYNERGY_THRESHOLDS[index]} 层`, `${SYNERGY_THRESHOLDS[index]} stacks`)}</b> ${description}</p>`).join("")}</div>
        </details>`,
        )
        .join("");
      if (world.stacks.size > 0)
        this.collection.innerHTML = `<p class="build-caption">${t(`已收集 ${[...world.stacks.values()].reduce((total, n) => total + n, 0)} 道残响`, `${[...world.stacks.values()].reduce((total, n) => total + n, 0)} echoes collected`)}</p>${[
          ...world.stacks,
        ]
          .map(([id, count]) => {
            const card = CARD_BY_ID.get(id);
            return card
              ? `<div class="collected-card ${card.rarity}"><span>${icon(card.symbol)}</span><div><strong>${rewardName(card.id)}</strong><small>${count}${card.maxStacks ? ` / ${card.maxStacks}` : ""} ${t("层", "stacks")}</small></div></div>`
              : "";
          })
          .join("")}`;
      else
        this.collection.innerHTML = `<div class="empty-build"><div class="empty-sigil" aria-hidden="true">✧</div><p>${t("击破宝箱，<br/>收集你的第一张卡牌。", "Break a chest to collect<br/>your first card.")}</p></div>`;
      if (world.trainingStacks.size > 0) {
        this.collection.innerHTML += `<p class="build-caption">${t("本局锻体 · 首领或分数获得 · 不计入羁绊", "Run training · Boss or score rewards · No synergy stacks")}</p>${[
          ...world.trainingStacks,
        ]
          .map(([id, count]) => {
            const item = TRAINING_BY_ID.get(id);
            return item
              ? `<div class="collected-card training"><span>${icon(item.symbol)}</span><div><strong>${rewardName(item.id)}</strong><small>${t(`${count} 次锻体`, `${count} training upgrades`)}</small></div></div>`
              : "";
          })
          .join("")}`;
      }
    }
    document.body.dataset.phase = world.phase;
  }

  private renderOverlay(focus = true): void {
    const world = this.world;
    const phase = world.phase;
    this.lastPhase = phase;
    this.lastReward = world.reward?.token ?? 0;
    this.overlay.hidden = phase === "Playing";
    this.overlay.classList.toggle(
      "reward-overlay",
      phase === "RewardSelection" || phase === "StageClear",
    );
    if (phase === "Playing") return;
    let title = t("开启这一轮命运", "Begin a new fate");
    let description = t(
      `${SYNERGIES.length} 大流派 · 3 / 6 / 9 层质变 · 四关后无尽挑战`,
      `${SYNERGIES.length} synergies · Tiers at 3 / 6 / 9 stacks · Endless after four stages`,
    );
    let buttons = `<button type="button" class="button button-primary" data-action="start">${t("开始共鸣", "Begin resonance")}</button>`;
    let extra = `<p class="modal-hint">${t("点击目标优先攻击 · 点击空白恢复自动", "Click a target to prioritize it · Click empty space for auto targeting")}</p>`;
    if (phase === "Paused") {
      title = t("命运暂歇", "Fate at rest");
      description = t("深呼吸，下一道残响正在等待。", "Take a breath. The next echo awaits.");
      buttons = `<button type="button" class="button button-primary" data-action="resume">${t("继续共鸣", "Resume resonance")}</button><button type="button" class="button button-quiet" data-action="menu">${t("返回开始界面", "Return to menu")}</button>`;
      extra = `<p class="modal-hint">${t("P / Esc 继续 · 战斗计时已停止", "P / Esc to resume · Combat timer stopped")}</p>`;
    } else if ((phase === "RewardSelection" || phase === "StageClear") && world.reward) {
      const reward = world.reward;
      const choices = reward.choices
        .map((id) => {
          const card = REWARD_BY_ID.get(id);
          if (!card) return "";
          if (card.type === "training")
            return `<button type="button" class="reward-card training" data-card="${id}" data-token="${reward.token}"><span class="card-icon">${icon(card.symbol)}</span><span class="card-content"><span class="card-topline"><strong>${rewardName(id)}</strong><small>${t("锻体", "Training")}</small></span><span class="card-change">${card.preview(world.player)}</span><span class="card-synergy">${t("首领专属 · 数值强化", "Boss reward · Stat upgrade")}</span><span class="card-description">${rewardDescription(id)}</span></span></button>`;
          const synergy = SYNERGY_BY_ID.get(card.synergy);
          const unlock = synergyUnlock(world.stacks, id);
          return `<button type="button" class="reward-card ${card.rarity} ${unlock ? "synergy-upgrade" : ""}" data-card="${id}" data-token="${reward.token}"><span class="card-icon">${icon(card.symbol)}</span><span class="card-content"><span class="card-topline"><strong>${rewardName(id)}</strong><small>${t(RARITY_NAMES[card.rarity], { common: "Common", rare: "Rare", epic: "Epic" }[card.rarity])}</small></span><span class="card-change">${card.preview(world.player)}</span><span class="card-synergy" style="color:${synergy?.color}">${synergyPreview(world.stacks, id)}</span><span class="card-description">${rewardDescription(id)}${unlock ? `<br>${unlock}` : ""}</span></span></button>`;
        })
        .join("");
      const emptyChoice =
        reward.choices.length === 0
          ? `<p>${t("当前配置下没有可用奖励。", "No rewards are available with the current settings.")}</p><button type="button" class="button button-primary" data-action="skip-empty" data-token="${reward.token}">${t("无可用奖励 · 继续", "No rewards · Continue")}</button>`
          : "";
      const stageClear = phase === "StageClear";
      const next = world.resolveStage(world.stageIndex + 1);
      const supply = reward.source === "supply";
      const finale = stageClear && world.stageIndex === STAGES.length - 1;
      const rewardTitle = stageClear
        ? t(`第 ${world.stageIndex + 1} 关突破`, `Stage ${world.stageIndex + 1} cleared`)
        : supply
          ? t(
              `无尽随机补给 ${world.stageSupplies} / ${world.endlessRules.supplies}`,
              `Endless supplies ${world.stageSupplies} / ${world.endlessRules.supplies}`,
            )
          : t("选择一道残响", "Choose an echo");
      const rewardDescriptionText = stageClear
        ? `${finale ? t("选择奖励后完成战役", "Choose a reward to complete the campaign") : t(`下一站：${stageName(world.stageIndex + 1)} · 保留构筑，恢复 35 生命`, `Next: ${stageName(world.stageIndex + 1)} · Keep your build, recover 35 HP`)} · ${t("两项锻体与一张残响三选一", "Choose one of two training upgrades and one echo")}`
        : supply
          ? t(
              `本关固定 ${world.endlessRules.supplies} 次随机补给 · 首领另有锻体与残响三选一`,
              `${world.endlessRules.supplies} random supplies per stage · Boss offers a separate training / echo choice`,
            )
          : t(
              "同流派 3 / 6 / 9 层质变 · 重复升级计入",
              "Synergy tiers at 3 / 6 / 9 stacks · Repeat upgrades count",
            );
      const rewardHint = stageClear
        ? finale
          ? t("选择一项，完成战役", "Choose one to complete the campaign")
          : t("选择一项，进入下一关", "Choose one to enter the next stage")
        : t("选择一张，立即强化", "Choose one to upgrade immediately");
      this.overlay.innerHTML = `<section class="modal reward-modal" role="dialog" aria-labelledby="overlay-title"><div class="modal-emblem" aria-hidden="true"><img src="/brand/echoes-mark.svg" width="44" height="44" alt="" /></div><h2 id="overlay-title">${rewardTitle}</h2><p>${rewardDescriptionText}</p>${stageClear && !finale ? `<p class="next-stage-rule">${stageSubtitle(next, world.stageIndex + 1)}</p>` : ""}<div class="reward-choices">${choices}${emptyChoice}</div><p class="modal-hint">${rewardHint} · ${t("战斗已暂停", "Combat paused")}</p></section>`;
      this.bindActions();
      if (focus) this.focusOverlay();
      return;
    } else if (phase === "Victory" || phase === "GameOver") {
      title =
        phase === "Victory"
          ? t("终局，由你改写", "Rewrite the ending")
          : t("残响尚未终结", "The echoes live on");
      description =
        phase === "Victory"
          ? t(
              "四关已突破。构筑仍在，继续无尽，让这套牌尽兴。",
              "Four stages cleared. Keep your build and see how far it can go in endless mode.",
            )
          : t(
              "生命已耗尽。这不是终点，只是另一轮命运的起点。",
              "Your health is gone. A new cycle of fate awaits.",
            );
      extra = `<p class="run-progress">${t(`已突破 ${world.clearedStages} 关`, `${world.clearedStages} stages cleared`)} · ${stageName(world.stageIndex)}</p><dl class="result-stats"><div><dt>${t("存续时间", "Time survived")}</dt><dd>${formatTime(world.elapsed)}</dd></div><div><dt>${t("击破敌人", "Enemies defeated")}</dt><dd>${world.kills}</dd></div><div><dt>${t("收集残响", "Echoes collected")}</dt><dd>${[...world.stacks.values()].reduce((sum, count) => sum + count, 0)}</dd></div><div><dt>${t("本局得分", "Run score")}</dt><dd>${world.score}</dd></div></dl>`;
      buttons = `${phase === "Victory" ? `<button type="button" class="button button-primary" data-action="endless">${t("继续无尽 · 保留构筑", "Continue endless · Keep build")}</button>` : ""}<button type="button" class="button ${phase === "Victory" ? "button-quiet" : "button-primary"}" data-action="start">${t("再次共鸣", "Resonate again")}</button><button type="button" class="button button-quiet" data-action="menu">${t("返回开始界面", "Return to menu")}</button>`;
    }
    this.overlay.innerHTML = `<section class="modal ${phase === "Victory" ? "victory-modal" : ""}" role="dialog" aria-labelledby="overlay-title"><div class="modal-emblem" aria-hidden="true"><img src="/brand/echoes-mark.svg" width="44" height="44" alt="" /></div><h2 id="overlay-title">${title}</h2><p>${description}</p>${phase === "Victory" || phase === "GameOver" ? extra : ""}<div class="modal-actions">${buttons}</div>${phase === "Victory" || phase === "GameOver" ? "" : extra}</section>`;
    this.bindActions();
    if (focus) this.focusOverlay();
  }

  private bindActions(): void {
    this.overlay.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.card) {
          this.world.chooseCard(button.dataset.card, Number(button.dataset.token));
        } else if (button.dataset.action === "skip-empty")
          this.world.skipUnavailableReward(Number(button.dataset.token));
        else if (button.dataset.action === "start") this.startRun();
        else if (button.dataset.action === "endless") this.world.continueEndless();
        else if (button.dataset.action === "resume") this.world.resume();
        else if (button.dataset.action === "menu") this.world.toMenu();
      });
    });
  }

  private focusOverlay(): void {
    if (!document.querySelector("dialog[open]"))
      this.overlay.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }

  private trapFocus(event: KeyboardEvent): void {
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>(
        ".header-actions button:not([disabled]):not([hidden])",
      ),
      ...this.overlay.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
    ];
    if (buttons.length === 0) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.shiftKey
      ? (index <= 0 ? buttons.length : index) - 1
      : (index + 1) % buttons.length;
    event.preventDefault();
    buttons[next]?.focus({ preventScroll: true });
  }

  destroy(): void {
    window.cancelAnimationFrame(this.frame);
    this.unsubscribeLocale();
  }
}

export function runDescription(): string {
  return t(
    `${STAGES.length} 关连续挑战 · 流派联动 · 可继续无尽`,
    `${STAGES.length} consecutive stages · Synergy builds · Endless continuation`,
  );
}
