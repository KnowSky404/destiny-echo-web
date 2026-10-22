import { CARD_BY_ID, RARITY_NAMES } from "../data/cards";
import { ENEMIES } from "../data/enemies";
import { STAGES } from "../data/stages";
import { SYNERGIES, SYNERGY_BY_ID, SYNERGY_THRESHOLDS, TIER_NAMES } from "../data/synergies";
import { REWARD_BY_ID, TRAINING_BY_ID } from "../data/training";
import { CONFIG } from "../game/config";
import { combatStats, overhealStats } from "../game/stats";
import { synergyPreview, synergyProgress, synergyTier, synergyUnlock } from "../game/synergies";
import { poisonSlow } from "../game/systems/damage";
import { attackPermitted } from "../game/systems/enemy";
import { isEnemy } from "../game/systems/targeting";
import type { Phase } from "../game/types";
import type { World } from "../game/world";
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
  private frame = 0;
  private lastHudAt = 0;

  constructor(private readonly world: World) {
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
        fullscreen.textContent = "请按 F11 全屏";
      }
    });
    document.addEventListener("fullscreenchange", () => {
      fullscreen.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
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
    this.tick(0);
  }

  ready(): void {
    this.loaded = true;
    this.lastPhase = undefined;
  }

  fail(title: string, message: string): void {
    this.fatal = true;
    this.world.pause();
    this.overlay.hidden = false;
    this.overlay.innerHTML = `<section class="modal error-modal" role="alert"><div class="modal-emblem">✧</div><h2>${title}</h2><p>${message}</p><button class="button button-primary" type="button">重新加载</button></section>`;
    this.overlay.querySelector("button")?.addEventListener("click", () => window.location.reload());
    this.pauseButton.disabled = true;
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
    this.shieldValue.textContent = player.shield > 0 ? `+${Math.ceil(player.shield)} 护盾` : "";
    this.statusEffects.textContent = [
      world.sanctuaryRemaining > 0
        ? `遗世庇护 ${world.sanctuaryRemaining.toFixed(1)}s · 已净化 · 敌方时序冻结`
        : "",
      player.poisonTime > 0
        ? `中毒 ${player.poisonTime.toFixed(1)}s · 每秒 ${CONFIG.endless.poisonDamagePerSecond + player.poisonDamageBonus} 伤害`
        : "",
      player.woundTime > 0 ? `重伤 ${player.woundTime.toFixed(1)}s · 治疗 / 护盾获得 -90%` : "",
      poisonSlow(player) > 0 ? `总攻速 -${Math.round(poisonSlow(player) * 100)}%` : "",
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
      `累计 ${formatTime(world.elapsed)}，本关 ${formatTime(world.stageElapsed)}`,
    );
    this.stageLabel.textContent = `${world.endless ? "无尽" : `第 ${world.stageIndex + 1} / ${STAGES.length} 关`} · ${world.stage.name}`;
    this.stageRoute.textContent = `${world.clearedStages} 关已突破 · 本关 ${formatTime(world.stageElapsed)} · 无时间限制${world.sanctuaryRemaining > 0 ? " · 敌方时序已冻结" : ""}${world.endless ? ` · 攻击区 ${world.attackRegions.length}/${world.arena.attackRegions.length} · 场内 ${world.enemies.items.filter((enemy) => enemy.active).length}/${world.stage.maxEnemies} · 出怪预算 ${world.stage.enemyCount} · 浓缩 ×${Number(world.stage.populationScale.toPrecision(3))} · 补给 ${world.stageSupplies}/${world.endlessRules.supplies}` : ""}`;
    this.waveLabel.textContent =
      world.phase === "Menu"
        ? "等待共鸣"
        : world.bossSpawned
          ? world.bossDefeated
            ? "清剿残敌 · 全灭后过关"
            : "首领战 · 集中火力"
          : `第 ${world.wave} 波 · 残响涌动`;
    this.scoreValue.textContent = `${world.score.toLocaleString("zh-CN")} 分`;
    this.scoreProgress.textContent = `分数锻体已发 ${world.scoreTrainings} 张 · 下一张 ${(world.scoreMilestones + 1) * CONFIG.scoreTrainingInterval} 分${world.scoreMilestones > world.scoreTrainings ? ` · 无候选跳过 ${world.scoreMilestones - world.scoreTrainings} 次` : ""}${world.lastScoreTraining ? ` · 最近获得：${TRAINING_BY_ID.get(world.lastScoreTraining)?.name}` : ""}`;
    this.killLabel.textContent = `击破 ${world.kills}`;
    const target = world.target;
    this.targetLabel.textContent = target
      ? `${world.sanctuaryRemaining <= 0 && world.endless && isEnemy(target) && attackPermitted(target) ? "攻击区优先" : world.sanctuaryRemaining <= 0 && isEnemy(target) && target.kind === "tank" && target.tauntRemaining > 0 ? "嘲讽锁定" : world.manualTargetId !== null ? "手动优先" : "自动锁定"} · ${isEnemy(target) ? (target.kind === "boss" ? world.stage.bossName : `${ENEMIES[target.kind].name} · ${target.stars}星${target.tauntRemaining > 0 ? ` · 嘲讽 ${target.tauntRemaining.toFixed(1)}s` : ""}`) : "残响宝箱"}`
      : "自动索敌 · 等待目标";
    const threats = world.enemies.items.filter(
      (enemy) => enemy.active && enemy.stage !== "Approaching",
    ).length;
    this.threatLabel.textContent = `防线威胁 ${threats}`;
    this.pauseButton.disabled = !this.loaded || !["Playing", "Paused"].includes(world.phase);
    this.pauseButton.dataset.action = world.phase === "Paused" ? "resume" : "pause";
    this.pauseButton.setAttribute("aria-label", world.phase === "Paused" ? "继续游戏" : "暂停游戏");
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
        ? `${world.stage.bossName} · 技能 ${boss.skillsUsed}/3 · 重击 ${world.bossSlamDamage}${boss.damageReductionTime > 0 ? ` · 减伤 90% ${boss.damageReductionTime.toFixed(1)}s` : ""}${boss.arrived ? " · 攻击 ×2" : ""}`
        : boss.hp < boss.maxHp / 2
          ? `${world.stage.bossName} · 狂乱阶段`
          : world.stage.bossName;
    }
    const notice =
      world.phase === "Playing" && world.elapsed < world.noticeUntil ? world.notice : "";
    if (this.notice.textContent !== notice) this.notice.textContent = notice;
    const effective = combatStats(player, world.stacks);
    const overflow = overhealStats(player, world.stacks);
    const statKey = JSON.stringify([player.stats, effective, overflow]);
    if (this.lastStats !== statKey) {
      this.lastStats = statKey;
      const rows = [
        ["damage", "术式伤害", String(Number(effective.damage.toFixed(1)))],
        ["haste", "攻击间隔", `${effective.interval.toFixed(2)}s`],
        ["multishot", "弹幕数量", String(effective.projectiles)],
        ["piercing", "穿透目标", String(player.stats.piercing)],
        ["vitality", "生命上限", String(player.stats.maxHp)],
        [
          "critical",
          "暴击率 / 倍率",
          `${Math.round(effective.critChance * 100)}% / ${effective.critDamage.toFixed(2)}×`,
        ],
        ["bloodpact", "普攻吸血", `${Number((effective.lifesteal * 100).toFixed(2))}%`],
        [
          "ward",
          "过量转盾 / 储量",
          `${Math.round(overflow.conversion * 100)}% / ${Math.round(overflow.capacity)}`,
        ],
        [
          "frost",
          "命中减速",
          `${Math.round(Math.min(0.7, player.stats.slow + (synergyTier(world.stacks, "frost") >= 3 ? 0.1 : 0)) * 100)}%`,
        ],
        ["control", "命中眩晕", `${player.stats.stun.toFixed(2)}s`],
        ["focus", "巨人杀手", `${Number((player.stats.giantSlayer * 100).toFixed(2))}% 最大生命`],
        [
          "storm",
          "百分比侵蚀",
          `${Number((player.stats.maxHealthDamage * 100).toFixed(2))}% 最大 / ${Number((player.stats.currentHealthDamage * 100).toFixed(2))}% 当前`,
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
      this.synergies.innerHTML = synergyProgress(world.stacks)
        .map(
          (synergy) => `
        <details class="synergy-card ${synergy.tier > 0 ? "active" : ""}" data-synergy="${synergy.id}" style="--synergy-color:${synergy.color}" ${openSynergies.has(synergy.id) ? "open" : ""}>
          <summary><span class="synergy-symbol">${icon(synergy.symbol)}</span><strong>${synergy.name}</strong><span class="synergy-count">${Math.min(9, synergy.count)}/9 · ${TIER_NAMES[synergy.tier]}</span></summary>
          <div class="synergy-details"><p>累计 ${synergy.count} 层 · 重复升级计入</p><p>${synergy.cards.map((card) => `<span class="${card.owned ? "owned" : ""}">${card.owned ? "✦" : "◇"} ${card.name}${card.stacks > 0 ? ` ×${card.stacks}` : ""}</span>`).join(" · ")}</p>${synergy.tiers.map((description, index) => `<p class="${synergy.count >= (SYNERGY_THRESHOLDS[index] ?? 9) ? "unlocked" : ""}"><b>${SYNERGY_THRESHOLDS[index]} 层</b> ${description}</p>`).join("")}</div>
        </details>`,
        )
        .join("");
      if (world.stacks.size > 0)
        this.collection.innerHTML = `<p class="build-caption">已收集 ${[...world.stacks.values()].reduce((total, n) => total + n, 0)} 道残响</p>${[
          ...world.stacks,
        ]
          .map(([id, count]) => {
            const card = CARD_BY_ID.get(id);
            return card
              ? `<div class="collected-card ${card.rarity}"><span>${icon(card.symbol)}</span><div><strong>${card.name}</strong><small>${count}${card.maxStacks ? ` / ${card.maxStacks}` : ""} 层</small></div></div>`
              : "";
          })
          .join("")}`;
      else
        this.collection.innerHTML =
          '<div class="empty-build"><div class="empty-sigil" aria-hidden="true">✧</div><p>击破宝箱，<br/>收集你的第一张卡牌。</p></div>';
      if (world.trainingStacks.size > 0) {
        this.collection.innerHTML += `<p class="build-caption">本局锻体 · 首领或分数获得 · 不计入羁绊</p>${[
          ...world.trainingStacks,
        ]
          .map(([id, count]) => {
            const item = TRAINING_BY_ID.get(id);
            return item
              ? `<div class="collected-card training"><span>${icon(item.symbol)}</span><div><strong>${item.name}</strong><small>${count} 次锻体</small></div></div>`
              : "";
          })
          .join("")}`;
      }
    }
    document.body.dataset.phase = world.phase;
  }

  private renderOverlay(): void {
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
    let title = "开启这一轮命运";
    let description = `${SYNERGIES.length} 大流派 · 3 / 6 / 9 层质变 · 四关后无尽挑战`;
    let buttons =
      '<button type="button" class="button button-primary" data-action="start">开始共鸣</button>';
    let extra = '<p class="modal-hint">点击目标优先攻击 · 点击空白恢复自动</p>';
    if (phase === "Paused") {
      title = "命运暂歇";
      description = "深呼吸，下一道残响正在等待。";
      buttons =
        '<button type="button" class="button button-primary" data-action="resume">继续共鸣</button><button type="button" class="button button-quiet" data-action="menu">返回开始界面</button>';
      extra = '<p class="modal-hint">P / Esc 继续 · 战斗计时已停止</p>';
    } else if ((phase === "RewardSelection" || phase === "StageClear") && world.reward) {
      const reward = world.reward;
      const choices = reward.choices
        .map((id) => {
          const card = REWARD_BY_ID.get(id);
          if (!card) return "";
          if (card.type === "training")
            return `<button type="button" class="reward-card training" data-card="${id}" data-token="${reward.token}"><span class="card-icon">${icon(card.symbol)}</span><span class="card-content"><span class="card-topline"><strong>${card.name}</strong><small>锻体</small></span><span class="card-change">${card.preview(world.player)}</span><span class="card-synergy">首领专属 · 数值强化</span><span class="card-description">${card.description}</span></span></button>`;
          const synergy = SYNERGY_BY_ID.get(card.synergy);
          const unlock = synergyUnlock(world.stacks, id);
          return `<button type="button" class="reward-card ${card.rarity} ${unlock ? "synergy-upgrade" : ""}" data-card="${id}" data-token="${reward.token}"><span class="card-icon">${icon(card.symbol)}</span><span class="card-content"><span class="card-topline"><strong>${card.name}</strong><small>${RARITY_NAMES[card.rarity]}</small></span><span class="card-change">${card.preview(world.player)}</span><span class="card-synergy" style="color:${synergy?.color}">${synergyPreview(world.stacks, id)}</span><span class="card-description">${card.description}${unlock ? `<br>${unlock}` : ""}</span></span></button>`;
        })
        .join("");
      const emptyChoice =
        reward.choices.length === 0
          ? `<p>当前配置下没有可用奖励。</p><button type="button" class="button button-primary" data-action="skip-empty" data-token="${reward.token}">无可用奖励 · 继续</button>`
          : "";
      const stageClear = phase === "StageClear";
      const next = world.resolveStage(world.stageIndex + 1);
      const supply = reward.source === "supply";
      const finale = stageClear && world.stageIndex === STAGES.length - 1;
      this.overlay.innerHTML = `<section class="modal reward-modal" role="dialog" aria-labelledby="overlay-title"><div class="modal-emblem" aria-hidden="true">✧</div><h2 id="overlay-title">${stageClear ? `第 ${world.stageIndex + 1} 关突破` : supply ? `无尽随机补给 ${world.stageSupplies} / ${world.endlessRules.supplies}` : "选择一道残响"}</h2><p>${stageClear ? `${finale ? "选择奖励后完成战役" : `下一站：${next.name} · 保留构筑，恢复 35 生命`} · 两项锻体与一张残响三选一` : supply ? `本关固定 ${world.endlessRules.supplies} 次随机补给 · 首领另有锻体与残响三选一` : "同流派 3 / 6 / 9 层质变 · 重复升级计入"}</p>${stageClear && !finale ? `<p class="next-stage-rule">${next.subtitle}</p>` : ""}<div class="reward-choices">${choices}${emptyChoice}</div><p class="modal-hint">${stageClear ? (finale ? "选择一项，完成战役" : "选择一项，进入下一关") : "选择一张，立即强化"} · 战斗已暂停</p></section>`;
      this.bindActions();
      this.focusOverlay();
      return;
    } else if (phase === "Victory" || phase === "GameOver") {
      title = phase === "Victory" ? "终局，由你改写" : "残响尚未终结";
      description =
        phase === "Victory"
          ? `四关已突破。构筑仍在，继续无尽，让这套牌尽兴。`
          : "生命已耗尽。这不是终点，只是另一轮命运的起点。";
      extra = `<p class="run-progress">已突破 ${world.clearedStages} 关 · ${world.stage.name}</p><dl class="result-stats"><div><dt>存续时间</dt><dd>${formatTime(world.elapsed)}</dd></div><div><dt>击破敌人</dt><dd>${world.kills}</dd></div><div><dt>收集残响</dt><dd>${[...world.stacks.values()].reduce((sum, count) => sum + count, 0)}</dd></div><div><dt>本局得分</dt><dd>${world.score}</dd></div></dl>`;
      buttons = `${phase === "Victory" ? '<button type="button" class="button button-primary" data-action="endless">继续无尽 · 保留构筑</button>' : ""}<button type="button" class="button ${phase === "Victory" ? "button-quiet" : "button-primary"}" data-action="start">再次共鸣</button><button type="button" class="button button-quiet" data-action="menu">返回开始界面</button>`;
    }
    this.overlay.innerHTML = `<section class="modal ${phase === "Victory" ? "victory-modal" : ""}" role="dialog" aria-labelledby="overlay-title"><div class="modal-emblem" aria-hidden="true">✧</div><h2 id="overlay-title">${title}</h2><p>${description}</p>${phase === "Victory" || phase === "GameOver" ? extra : ""}<div class="modal-actions">${buttons}</div>${phase === "Victory" || phase === "GameOver" ? "" : extra}</section>`;
    this.bindActions();
    this.focusOverlay();
  }

  private bindActions(): void {
    this.overlay.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.card) {
          this.world.chooseCard(button.dataset.card, Number(button.dataset.token));
        } else if (button.dataset.action === "skip-empty")
          this.world.skipUnavailableReward(Number(button.dataset.token));
        else if (button.dataset.action === "start") this.world.start();
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
  }
}

export const RUN_DESCRIPTION = `${STAGES.length} 关连续挑战 · 流派联动 · 可继续无尽`;
