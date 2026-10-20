import { CARD_BY_ID } from "../data/cards";
import { ENEMIES } from "../data/enemies";
import { STAGES, stageAt } from "../data/stages";
import { SYNERGY_BY_ID } from "../data/synergies";
import { synergyPreview, synergyProgress, synergyTier } from "../game/synergies";
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
    element("#close-help").addEventListener("click", () => this.help.close());
    this.help.addEventListener("close", () => {
      this.overlay.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
    window.addEventListener("keydown", (event) => {
      if (this.help.open || this.fatal) return;
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
    this.healthFill.style.width = `${(player.hp / player.stats.maxHp) * 100}%`;
    this.healthMeter.max = player.stats.maxHp;
    this.healthMeter.value = Math.ceil(player.hp);
    this.timer.textContent = formatTime(world.elapsed);
    this.timer.setAttribute(
      "aria-label",
      `累计 ${formatTime(world.elapsed)}，本关 ${formatTime(world.stageElapsed)}`,
    );
    this.stageLabel.textContent = `${world.endless ? "无尽" : `第 ${world.stageIndex + 1} / ${STAGES.length} 关`} · ${world.stage.name}`;
    this.stageRoute.textContent = `${world.clearedStages} 关已突破 · 本关 ${formatTime(world.stageElapsed)} / ${formatTime(world.stage.deadline)}`;
    this.waveLabel.textContent =
      world.phase === "Menu"
        ? "等待共鸣"
        : world.bossSpawned
          ? "首领战 · 集中火力"
          : `第 ${world.wave} 波 · 残响涌动`;
    this.killLabel.textContent = `击破 ${world.kills}`;
    const target = world.target;
    this.targetLabel.textContent = target
      ? `${world.manualTargetId !== null ? "手动优先" : "自动锁定"} · ${isEnemy(target) ? (target.kind === "boss" ? world.stage.bossName : ENEMIES[target.kind].name) : "残响宝箱"}`
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
      this.bossName.textContent =
        boss.hp < boss.maxHp / 2 ? `${world.stage.bossName} · 狂乱阶段` : world.stage.bossName;
    }
    const notice =
      world.phase === "Playing" && world.elapsed < world.noticeUntil ? world.notice : "";
    if (this.notice.textContent !== notice) this.notice.textContent = notice;
    const statKey = JSON.stringify(player.stats);
    if (this.lastStats !== statKey) {
      this.lastStats = statKey;
      const rows = [
        ["damage", "术式伤害", String(player.stats.damage)],
        [
          "haste",
          "攻击间隔",
          `${(player.stats.interval * (synergyTier(world.stacks, "barrage") >= 2 ? 0.85 : 1)).toFixed(2)}s`,
        ],
        ["multishot", "弹幕数量", String(player.stats.projectiles)],
        ["piercing", "穿透目标", String(player.stats.piercing)],
        ["vitality", "生命上限", String(player.stats.maxHp)],
        ["execution", "防线增伤", `+${player.stats.execution * 20}%`],
      ];
      this.stats.innerHTML = rows
        .map(
          ([symbol, label, value]) =>
            `<div><dt>${icon(symbol ?? "damage")}<span>${label}</span></dt><dd>${value}</dd></div>`,
        )
        .join("");
    }
    const buildKey = JSON.stringify([...world.stacks]);
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
          <summary><span class="synergy-symbol">${icon(synergy.symbol)}</span><strong>${synergy.name}</strong><span class="synergy-count">${synergy.count}/3 · ${synergy.tier === 3 ? "质变" : synergy.tier === 2 ? "激活" : "待集齐"}</span></summary>
          <div class="synergy-details"><p>${synergy.cards.map((card) => `<span class="${card.owned ? "owned" : ""}">${card.owned ? "✦" : "◇"} ${card.name}</span>`).join(" · ")}</p>${synergy.tiers.map((description, index) => `<p class="${synergy.count >= index + 2 ? "unlocked" : ""}"><b>${index + 2} 张</b> ${description}</p>`).join("")}</div>
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
    let description = "四关连战 · 流派联动 · 通关后无尽挑战";
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
          const card = CARD_BY_ID.get(id);
          if (!card) return "";
          const synergy = SYNERGY_BY_ID.get(card.synergy);
          const count = world.stacks.has(card.id)
            ? 0
            : (synergyProgress(world.stacks).find((item) => item.id === card.synergy)?.count ?? 0);
          const unlock = count === 1 || count === 2 ? synergy?.tiers[count - 1] : undefined;
          return `<button type="button" class="reward-card ${card.rarity} ${unlock ? "synergy-upgrade" : ""}" data-card="${id}" data-token="${reward.token}"><span class="card-icon">${icon(card.symbol)}</span><span class="card-content"><span class="card-topline"><strong>${card.name}</strong><small>${card.rarity === "rare" ? "稀有" : "普通"}</small></span><span class="card-change">${card.preview(world.player)}</span><span class="card-synergy" style="color:${synergy?.color}">${synergyPreview(world.stacks, id)}</span><span class="card-description">${unlock ?? card.description}</span></span></button>`;
        })
        .join("");
      const stageClear = phase === "StageClear";
      const next = stageAt(world.stageIndex + 1);
      this.overlay.innerHTML = `<section class="modal reward-modal" role="dialog" aria-modal="true" aria-labelledby="overlay-title"><div class="modal-emblem" aria-hidden="true">✧</div><h2 id="overlay-title">${stageClear ? `第 ${world.stageIndex + 1} 关突破` : "选择一道残响"}</h2><p>${stageClear ? `下一站：${next.name} · 保留构筑，恢复 35 生命` : "同流派 2 张激活 · 3 张质变（不同卡牌）"}</p>${stageClear ? `<p class="next-stage-rule">${next.subtitle}</p>` : ""}<div class="reward-choices">${choices}</div><p class="modal-hint">${stageClear ? "选择一张，进入下一关" : "选择一张，立即强化"} · 战斗已暂停</p></section>`;
      this.bindActions();
      this.focusOverlay();
      return;
    } else if (phase === "Victory" || phase === "GameOver") {
      title = phase === "Victory" ? "终局，由你改写" : "残响尚未终结";
      description =
        phase === "Victory"
          ? `四关已突破。构筑仍在，继续无尽，让这套牌尽兴。`
          : world.endingReason === "timeout"
            ? "仪式已失控。下一次，更早击碎圣杯。"
            : "这不是终点，只是另一轮命运的起点。";
      extra = `<p class="run-progress">已突破 ${world.clearedStages} 关 · ${world.stage.name}</p><dl class="result-stats"><div><dt>存续时间</dt><dd>${formatTime(world.elapsed)}</dd></div><div><dt>击破敌人</dt><dd>${world.kills}</dd></div><div><dt>收集残响</dt><dd>${[...world.stacks.values()].reduce((sum, count) => sum + count, 0)}</dd></div><div><dt>本局得分</dt><dd>${world.score}</dd></div></dl>`;
      buttons = `${phase === "Victory" ? '<button type="button" class="button button-primary" data-action="endless">继续无尽 · 保留构筑</button>' : ""}<button type="button" class="button ${phase === "Victory" ? "button-quiet" : "button-primary"}" data-action="start">再次共鸣</button><button type="button" class="button button-quiet" data-action="menu">返回开始界面</button>`;
    }
    this.overlay.innerHTML = `<section class="modal ${phase === "Victory" ? "victory-modal" : ""}" role="dialog" aria-modal="true" aria-labelledby="overlay-title"><div class="modal-emblem" aria-hidden="true">✧</div><h2 id="overlay-title">${title}</h2><p>${description}</p>${phase === "Victory" || phase === "GameOver" ? extra : ""}<div class="modal-actions">${buttons}</div>${phase === "Victory" || phase === "GameOver" ? "" : extra}</section>`;
    this.bindActions();
    this.focusOverlay();
  }

  private bindActions(): void {
    this.overlay.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.card) {
          this.world.chooseCard(button.dataset.card, Number(button.dataset.token));
        } else if (button.dataset.action === "start") this.world.start();
        else if (button.dataset.action === "endless") this.world.continueEndless();
        else if (button.dataset.action === "resume") this.world.resume();
        else if (button.dataset.action === "menu") this.world.toMenu();
      });
    });
  }

  private focusOverlay(): void {
    this.overlay.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }

  private trapFocus(event: KeyboardEvent): void {
    const buttons = [...this.overlay.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first || !this.overlay.contains(document.activeElement))
    ) {
      event.preventDefault();
      last?.focus({ preventScroll: true });
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !this.overlay.contains(document.activeElement))
    ) {
      event.preventDefault();
      first?.focus({ preventScroll: true });
    }
  }

  destroy(): void {
    window.cancelAnimationFrame(this.frame);
  }
}

export const RUN_DESCRIPTION = `${STAGES.length} 关连续挑战 · 流派联动 · 可继续无尽`;
