import {
  parseReviewDocument,
  REVIEW_CASE_KEY,
  type ReviewDocument,
} from "../../balance-sim/review";
import {
  type BalanceProfile,
  ENDLESS_FIELDS,
  ENEMY_FIELDS,
  type EnemyNumbers,
  EVOLUTION_FIELDS,
  type KindWeights,
  MINION_KINDS,
  type NumericField,
  PLAYER_FIELDS,
  type PlayerValues,
  REWARD_SOURCES,
  type RewardPolicy,
  type RewardSource,
  STAGE_FIELDS,
  STAT_FIELDS,
  type StagePatch,
} from "../../data/balance/model";
import { officialProfile, parseProfile, resolvedStage } from "../../data/balance/profile";
import { CARDS } from "../../data/cards";
import { ENEMIES } from "../../data/enemies";
import { TRAININGS } from "../../data/training";
import type { DebugCommand, DebugWorld } from "../../game/debug/DebugWorld";
import type { EnemyKind, Stats } from "../../game/types";
import {
  bindDebugText,
  type DebugTextSource,
  debugAttribute,
  debugPair,
  debugSource,
  metricsDebugText,
  profileDebugText,
  refreshDebugText,
} from "../../i18n/debug";
import { getLocale, onLocaleChange, setLocale } from "../../i18n/locale";
import type { ProfileStore } from "./store";
import "./debug.css";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: DebugTextSource,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) {
    if (tag === "pre") node.textContent = typeof text === "string" ? text : debugSource(text);
    else bindDebugText(node, text);
  }
  if (className) node.className = className;
  return node;
}
function button(text: string, action: () => void, primary = false): HTMLButtonElement {
  const node = el("button", text, `button ${primary ? "button-primary" : "button-quiet"}`);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}
function numberField(
  parent: HTMLElement,
  field: NumericField,
  initial: number,
  change: (n: number) => void,
  labelPrefix = "",
): HTMLInputElement {
  const row = el("label", undefined, "debug-field");
  row.append(el("span", `${labelPrefix}${field[0]}`));
  const input = el("input");
  input.type = "number";
  input.min = String(field[1]);
  input.max = String(field[2]);
  input.step = field[3] ? "1" : "any";
  input.value = String(initial);
  input.addEventListener("change", () => change(input.valueAsNumber));
  row.append(input);
  parent.append(row);
  return input;
}
function check(
  parent: HTMLElement,
  title: string,
  checked: boolean,
  change: (value: boolean) => void,
): HTMLInputElement {
  const label = el("label", undefined, "debug-check");
  const input = el("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => change(input.checked));
  label.append(input, el("span", title));
  parent.append(label);
  return input;
}
function select(
  parent: HTMLElement,
  title: string,
  options: [string, string][],
  value: string,
  change: (value: string) => void,
): HTMLSelectElement {
  const label = el("label", undefined, "debug-field");
  label.append(el("span", title));
  const input = el("select");
  debugAttribute(input, "aria-label", title);
  for (const [id, name] of options) {
    const option = el("option", name);
    option.value = id;
    input.append(option);
  }
  input.value = value;
  input.addEventListener("change", () => change(input.value));
  label.append(input);
  parent.append(label);
  return input;
}
function details(parent: HTMLElement, title: string, open = false): HTMLElement {
  const section = el("details", undefined, "debug-section");
  section.open = open;
  section.append(el("summary", title));
  const body = el("div", undefined, "debug-section-body");
  section.append(body);
  parent.append(section);
  return body;
}
const SOURCES: Record<RewardSource, string> = {
  chest: "宝箱",
  supply: "无尽补给",
  stage: "首领与分数锻体",
};

export class DebugPanel {
  private readonly dialog = el("dialog", undefined, "debug-dialog");
  private readonly body = el("div", undefined, "debug-body");
  private readonly status = el("p", "", "debug-status");
  private readonly metrics = el("p", "", "debug-metrics");
  private readonly trigger: HTMLButtonElement;
  private tab = 0;
  private rewardSource: RewardSource = "chest";
  private rewardScope = -1;
  private selectedEnemy = "kind:wisp";
  private seed: number;
  private pendingWrites = 0;
  private readonly tabs: HTMLButtonElement[] = [];
  private review: ReviewDocument | undefined;
  private readonly unsubscribeLocale: () => void;

  constructor(
    private readonly world: DebugWorld,
    private readonly store: ProfileStore,
  ) {
    this.seed = Date.now() >>> 0;
    this.dialog.id = "debug-dialog";
    this.dialog.setAttribute("aria-labelledby", "debug-title");
    const header = el("div", undefined, "debug-header");
    const heading = el("h2", "PRE 数值实验室");
    heading.id = "debug-title";
    const language = el("select");
    debugAttribute(language, "aria-label", "语言");
    for (const [value, title] of [
      ["zh-CN", "简体中文"],
      ["en", "English"],
    ]) {
      const option = el("option");
      option.value = value ?? "";
      option.textContent = title ?? "";
      language.append(option);
    }
    language.value = getLocale();
    language.addEventListener("change", () => setLocale(language.value === "en" ? "en" : "zh-CN"));
    header.append(
      heading,
      language,
      button("返回战场", () => this.dialog.close()),
    );
    const boundary = el(
      "p",
      "仅当前浏览器的 PRE 生效 · 修改不会同步给其他浏览器或生产环境",
      "debug-boundary",
    );
    const nav = el("div", undefined, "debug-tabs");
    nav.setAttribute("role", "tablist");
    debugAttribute(nav, "aria-label", "调试分类");
    ["玩家与构筑", "敌人与出怪", "关卡控制", "方案版本", "实验/复核"].forEach((name, index) => {
      const item = button(name, () => {
        this.tab = index;
        this.render();
      });
      item.id = `debug-tab-${index}`;
      item.setAttribute("role", "tab");
      item.setAttribute("aria-controls", "debug-content");
      item.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        this.tab =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? this.tabs.length - 1
              : (this.tab + (event.key === "ArrowRight" ? 1 : this.tabs.length - 1)) %
                this.tabs.length;
        this.render();
        this.tabs[this.tab]?.focus();
      });
      this.tabs.push(item);
      nav.append(item);
    });
    this.body.id = "debug-content";
    this.body.setAttribute("role", "tabpanel");
    this.status.setAttribute("role", "status");
    this.dialog.append(header, boundary, this.metrics, nav, this.status, this.body);
    this.trigger = button("PRE · 数值调试", () => {
      if (world.phase === "Playing") world.pause();
      this.render();
      this.dialog.showModal();
      if (store.warning) this.message(store.warning, true);
    });
    this.trigger.id = "debug-trigger";
    this.trigger.setAttribute("aria-haspopup", "dialog");
    this.trigger.setAttribute("aria-controls", "debug-dialog");
    document.querySelector(".header-actions")?.prepend(this.trigger);
    document.body.append(this.dialog);
    this.unsubscribeLocale = onLocaleChange(() => {
      language.value = getLocale();
      refreshDebugText(this.dialog);
      refreshDebugText(this.trigger);
    });
  }
  destroy(): void {
    this.unsubscribeLocale();
    this.dialog.remove();
    this.trigger.remove();
  }
  openReview(review: ReviewDocument): void {
    this.review = review;
    this.tab = 4;
    this.render();
    this.dialog.showModal();
    this.message("已按案例方案、种子和逻辑宽度准备人工复核；战斗保持暂停，未自动执行策略");
  }
  private message(text: DebugTextSource, error = false): void {
    bindDebugText(this.status, text);
    this.status.classList.toggle("debug-error", error);
  }
  private attempt(action: () => DebugTextSource | undefined, redraw = true): void {
    try {
      const message = action();
      if (redraw) this.render();
      this.message(message ?? "已保存草稿，仅当前浏览器有效");
    } catch (error) {
      this.message(error instanceof Error ? error.message : String(error), true);
    }
  }
  private command(command: DebugCommand): void {
    this.attempt(() => this.world.execute(command));
  }
  private async write(action: () => DebugTextSource | undefined, redraw = true): Promise<void> {
    if (redraw) {
      this.pendingWrites++;
      this.body.inert = true;
      for (const tab of this.tabs) tab.disabled = true;
      this.dialog.setAttribute("aria-busy", "true");
      this.message("正在应用本地修改…");
    }
    try {
      await this.store.withWriteLock(() => this.attempt(action, redraw));
    } catch (error) {
      this.message(error instanceof Error ? error.message : String(error), true);
    } finally {
      if (redraw) {
        const busy = --this.pendingWrites > 0;
        this.body.inert = busy;
        for (const tab of this.tabs) tab.disabled = busy;
        this.dialog.setAttribute("aria-busy", String(busy));
      }
    }
  }
  private saveDraft(): void {
    this.write(() => {
      parseProfile(this.store.state.draft);
      this.store.persist();
      return this.store.warning || "草稿已保存在当前浏览器；正在运行的版本保持固定";
    }, false);
  }
  private render(): void {
    this.tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(this.tab === i));
      tab.tabIndex = this.tab === i ? 0 : -1;
    });
    const disclosureState = new Map(
      [...this.body.querySelectorAll("details")].map((item) => [
        item.querySelector("summary")?.textContent,
        item.open,
      ]),
    );
    this.body.setAttribute("aria-labelledby", `debug-tab-${this.tab}`);
    this.body.replaceChildren();
    const snapshot = this.world.snapshot();
    const stageMetrics = this.world.debugInfo.stageMetrics;
    bindDebugText(this.metrics, () =>
      metricsDebugText(this.world.profile, {
        seed: snapshot.seed,
        stage: snapshot.stageIndex + 1,
        stageTime: snapshot.stageElapsed,
        activeTime: stageMetrics.elapsed,
        stageDamage: stageMetrics.damageDealt,
        stageTaken: stageMetrics.damageTaken,
        stageHealing: stageMetrics.healingDone,
        stageKills: stageMetrics.kills,
        damage: snapshot.metrics.damageDealt,
        taken: snapshot.metrics.damageTaken,
        healing: snapshot.metrics.healingDone,
        kills: snapshot.kills,
      }),
    );
    if (this.tab === 0) this.renderPlayer();
    if (this.tab === 1) this.renderEnemies();
    if (this.tab === 2) this.renderStages();
    if (this.tab === 3) this.renderProfiles();
    if (this.tab === 4) this.renderExperiments();
    for (const item of this.body.querySelectorAll("details")) {
      const state = disclosureState.get(item.querySelector("summary")?.textContent);
      if (state !== undefined) item.open = state;
    }
  }
  private renderPlayer(): void {
    const values = Object.fromEntries(
      Object.keys(PLAYER_FIELDS).map((key) => [key, this.world.player[key as keyof PlayerValues]]),
    ) as PlayerValues;
    const overrides = { ...this.world.debugInfo.overrides };
    const resources = details(this.body, "当前生命、护盾与状态", true);
    const grid = el("div", undefined, "debug-grid");
    resources.append(grid);
    for (const [key, spec] of Object.entries(PLAYER_FIELDS))
      numberField(grid, spec, values[key as keyof PlayerValues], (n) => {
        values[key as keyof PlayerValues] = n;
      });
    const stats = details(this.body, "属性覆盖与实际战斗数值", true);
    stats.append(
      el(
        "p",
        `实际伤害 ${this.world.snapshot().combat.damage.toFixed(2)} · 攻击间隔 ${this.world.snapshot().combat.interval.toFixed(3)}s · 暴击率 ${(this.world.snapshot().combat.critChance * 100).toFixed(1)}% · 弹数 ${this.world.snapshot().combat.projectiles}。勾选后覆盖基础属性；现有战斗上限仍生效。`,
      ),
    );
    const statGrid = el("div", undefined, "debug-grid");
    stats.append(statGrid);
    for (const key of Object.keys(STAT_FIELDS) as (keyof Stats)[]) {
      const row = el("div", undefined, "debug-override");
      statGrid.append(row);
      const input = numberField(
        row,
        STAT_FIELDS[key],
        overrides[key] ?? this.world.player.stats[key],
        (n) => {
          overrides[key] = n;
        },
      );
      input.disabled = overrides[key] === undefined;
      check(row, `覆盖 ${STAT_FIELDS[key][0]}`, overrides[key] !== undefined, (enabled) => {
        input.disabled = !enabled;
        if (enabled) overrides[key] = input.valueAsNumber;
        else delete overrides[key];
      });
    }
    const actions = el("div", undefined, "debug-actions");
    actions.append(
      button("应用玩家修改", () => this.command({ type: "player", values, overrides }), true),
      button("清除全部属性覆盖", () => this.command({ type: "player", values, overrides: {} })),
    );
    this.body.append(actions);
    const deck = details(this.body, "卡组与锻体：增删、设置层数");
    deck.append(
      el(
        "p",
        "修改持续本局。新增卡牌的即时效果只执行一次；减少层数不撤销过去的治疗。属性覆盖独立保留。",
      ),
    );
    const cards = Object.fromEntries(this.world.stacks);
    const trainings = Object.fromEntries(this.world.trainingStacks);
    const deckGrid = el("div", undefined, "debug-grid");
    deck.append(deckGrid);
    for (const card of [...CARDS, ...TRAININGS]) {
      const counts = card.type === "training" ? trainings : cards;
      numberField(
        deckGrid,
        [card.name, 0, card.maxStacks ?? 10000, true],
        counts[card.id] ?? 0,
        (n) => {
          counts[card.id] = n;
        },
      );
    }
    deck.append(
      button("应用卡组修改", () => this.command({ type: "deck", cards, trainings }), true),
    );
  }
  private renderEnemies(): void {
    this.body.append(
      el(
        "p",
        "出怪规则仅影响后续生成。修改现有敌人请使用下方单位操作；生命上限修改按剩余生命比例同步。移除不发击杀收益，移除首领后仍须清完其余敌人才结算。",
      ),
    );
    const active = this.world.enemies.items.filter((enemy) => enemy.active);
    const options: [string, string][] = Object.entries(ENEMIES).map(([kind, data]) => [
      `kind:${kind}`,
      `所有${data.name}`,
    ]);
    options.push(
      ...active.map((enemy): [string, string] => [
        `id:${enemy.id}`,
        `#${enemy.id} ${ENEMIES[enemy.kind].name} · ${Math.ceil(enemy.hp)}/${Math.ceil(enemy.maxHp)}`,
      ]),
    );
    select(this.body, "操作对象", options, this.selectedEnemy, (value) => {
      this.selectedEnemy = value;
      this.render();
    });
    const selected = active.filter(
      (enemy) =>
        this.selectedEnemy === `kind:${enemy.kind}` || this.selectedEnemy === `id:${enemy.id}`,
    );
    const ids = selected.map((enemy) => enemy.id);
    const first = selected[0];
    const unit = details(this.body, `场上单位修改（${ids.length} 只）`, true);
    const patch: Partial<EnemyNumbers> & { currentHp?: number } = {};
    const unitGrid = el("div", undefined, "debug-grid");
    unit.append(unitGrid);
    numberField(unitGrid, ["指定当前生命（应用时生效）", 0, 1e12], first?.hp ?? 50, (n) => {
      patch.currentHp = n;
    });
    for (const key of Object.keys(ENEMY_FIELDS) as (keyof EnemyNumbers)[]) {
      const row = el("div", undefined, "debug-override");
      unitGrid.append(row);
      const input = numberField(
        row,
        ENEMY_FIELDS[key],
        first
          ? key === "hp"
            ? first.maxHp
            : key === "speed"
              ? first.speed
              : this.world.enemyDefinition(first)[key]
          : ENEMIES.wisp[key],
        (n) => {
          patch[key] = n;
        },
      );
      input.disabled = true;
      check(row, `修改 ${ENEMY_FIELDS[key][0]}`, false, (enabled) => {
        input.disabled = !enabled;
        if (enabled) patch[key] = input.valueAsNumber;
        else delete patch[key];
      });
    }
    const actions = el("div", undefined, "debug-actions");
    actions.append(
      button("应用到所选敌人", () => this.command({ type: "enemy", ids, patch }), true),
      button("移除所选敌人", () => this.command({ type: "remove", ids })),
    );
    unit.append(actions);
    const spawn = details(this.body, "手动补怪", true);
    let kind: EnemyKind = "wisp";
    let count = 1;
    select(
      spawn,
      "补怪种类",
      Object.entries(ENEMIES).map(([id, data]) => [id, data.name]),
      kind,
      (value) => {
        kind = value as EnemyKind;
      },
    );
    numberField(spawn, ["补怪数量", 1, 65, true], count, (n) => {
      count = n;
    });
    spawn.append(button("补入战场", () => this.command({ type: "spawn", kind, count })));
    const rules = details(this.body, "当前关卡临时出怪规则");
    rules.append(
      el(
        "p",
        "无尽预算修改只重分当前及后续怪群的剩余名额，已出场信用不追回；显示有效预算，保留构筑重开才完整采用请求值。补给数量按前三段累计 floor(N×k/3) 分配，可能连续选多次。",
      ),
    );
    const stagePatch = { ...this.world.debugInfo.stagePatch };
    let weights = structuredClone(this.world.debugInfo.kindWeights);
    this.stageFields(
      rules,
      stagePatch,
      resolvedStage(this.world.profile, this.world.stageIndex),
      () => {},
    );
    this.weightFields(rules, weights, (value) => {
      weights = value;
    });
    rules.append(
      button(
        "应用本关出怪规则",
        () => this.command({ type: "spawn-rules", stage: stagePatch, weights }),
        true,
      ),
    );
  }
  private renderStages(): void {
    const controls = details(this.body, "关卡与重开", true);
    let target = this.world.stageIndex + 1;
    let fresh = false;
    numberField(
      controls,
      ["目标关卡（1–4 战役，5 起为无尽）", 1, Number.MAX_SAFE_INTEGER, true],
      target,
      (n) => {
        target = n;
      },
    );
    check(controls, "跳关时使用初始角色与构筑", fresh, (value) => {
      fresh = value;
    });
    const actions = el("div", undefined, "debug-actions");
    actions.append(
      button("跳转关卡", () => this.command({ type: "jump", stage: target, fresh }), true),
      button("保留当前构筑重开本关", () => this.command({ type: "restart", restoreEntry: false })),
      button("恢复入关快照", () => this.command({ type: "restart", restoreEntry: true })),
    );
    controls.append(
      actions,
      el(
        "p",
        "保留构筑重开会清空战场与本关时钟，保留当前生命、卡组和临时出怪规则。恢复快照会撤销本关成长与修改，恢复入关角色、累计进度和全部随机状态。跳关只是测试起点，不代表自然通关。",
      ),
    );
    numberField(controls, ["新测试随机种子", 0, 0xffffffff, true], this.seed, (n) => {
      this.seed = n;
    });
    controls.append(
      button("按此种子重开整局", () => this.command({ type: "new-run", seed: this.seed })),
    );
  }
  private stageFields(
    parent: HTMLElement,
    patch: StagePatch,
    baseline: ReturnType<typeof resolvedStage>,
    changed: () => void,
  ): void {
    const grid = el("div", undefined, "debug-grid");
    parent.append(grid);
    for (const key of Object.keys(STAGE_FIELDS) as (keyof StagePatch)[]) {
      const row = el("div", undefined, "debug-override");
      grid.append(row);
      const input = numberField(row, STAGE_FIELDS[key], patch[key] ?? baseline[key], (n) => {
        patch[key] = n;
        changed();
      });
      input.disabled = patch[key] === undefined;
      check(row, `覆盖 ${STAGE_FIELDS[key][0]}`, patch[key] !== undefined, (enabled) => {
        input.disabled = !enabled;
        if (enabled) patch[key] = input.valueAsNumber;
        else delete patch[key];
        changed();
      });
    }
  }
  private weightFields(
    parent: HTMLElement,
    initial: KindWeights | null,
    changed: (weights: KindWeights | null) => void,
  ): void {
    let weights = initial ? { ...initial } : null;
    const grid = el("div", undefined, "debug-grid");
    check(
      parent,
      "自定义小怪种类权重（关闭时继承配置，默认均衡轮换）",
      weights !== null,
      (enabled) => {
        weights = enabled
          ? (Object.fromEntries(MINION_KINDS.map((kind) => [kind, 1])) as KindWeights)
          : null;
        for (const input of grid.querySelectorAll("input")) {
          input.disabled = !enabled;
          if (enabled) input.value = "1";
        }
        changed(weights);
      },
    );
    for (const kind of MINION_KINDS) {
      const input = numberField(grid, [ENEMIES[kind].name, 0, 1e6], weights?.[kind] ?? 1, (n) => {
        if (weights) {
          weights[kind] = n;
          changed(weights);
        }
      });
      input.disabled = weights === null;
    }
    parent.append(grid);
  }
  private renderProfiles(): void {
    const draft = this.store.state.draft;
    const intro = el(
      "p",
      "草稿自动保存在当前浏览器。保存为版本后才能启用测试；启用会按指定种子重开整局。导出文件只包含数值方案，不包含临时修改或战斗进度。",
    );
    this.body.append(intro);
    this.renderProfileIdentity(this.body);
    const name = el("label", undefined, "debug-field");
    name.append(el("span", "方案名称"));
    const input = el("input");
    input.type = "text";
    input.maxLength = 100;
    input.value = draft.name;
    input.addEventListener("change", () => {
      draft.name = input.value;
      this.saveDraft();
    });
    name.append(input);
    this.body.append(name);
    numberField(this.body, ["版本测试种子", 0, 0xffffffff, true], this.seed, (n) => {
      this.seed = n;
    });
    const actions = el("div", undefined, "debug-actions");
    actions.append(
      button(
        "保存为新版本",
        () =>
          this.write(() => {
            const version = this.store.saveVersion();
            return this.store.warning || profileDebugText(version, { kind: "saved" });
          }),
        true,
      ),
      button("导出草稿 JSON", () => this.exportProfile(draft, true)),
      button("复制为新方案", () =>
        this.write(() => {
          this.store.copy(draft);
          return this.store.warning || "已复制为新方案草稿";
        }),
      ),
      button("恢复正式配置为草稿", () =>
        this.write(() => {
          this.store.state.draft = officialProfile();
          this.store.persist();
          return "已恢复正式配置草稿；当前测试保持不变";
        }),
      ),
    );
    const importer = el("label", "导入配置 JSON", "debug-import button button-quiet");
    const file = el("input");
    file.type = "file";
    file.accept = ".json,application/json";
    file.addEventListener("change", async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      if (selected.size > 2_000_000) {
        this.message("配置文件不能超过 2 MB", true);
        return;
      }
      try {
        const text = await selected.text();
        this.write(() => {
          this.store.import(text);
          return this.store.warning || "已导入为新草稿；保存版本后可启用";
        });
      } catch (error) {
        this.message(String(error), true);
      }
    });
    importer.append(file);
    actions.append(importer);
    this.body.append(actions);
    this.renderLegacyProfiles();
    const versions = details(this.body, `已保存版本（${this.store.state.versions.length}）`, true);
    if (!this.store.state.versions.length) versions.append(el("p", "尚无已保存版本。"));
    for (const version of this.store.state.versions) {
      const row = el("div", undefined, "debug-version");
      const selected =
        this.store.state.selected?.id === version.id &&
        this.store.state.selected.revision === version.revision;
      row.append(el("strong", profileDebugText(version, { kind: "version", selected })));
      const buttons = el("div", undefined, "debug-actions");
      buttons.append(
        button(
          "启用此版本测试",
          () =>
            this.write(() => {
              const result = this.world.execute({
                type: "profile",
                profile: version,
                seed: this.seed,
              });
              this.store.select(version);
              return this.store.warning || result;
            }),
          true,
        ),
        button("载入为草稿", () =>
          this.write(() => {
            this.store.state.draft = structuredClone(version);
            this.store.persist();
            return "已载入草稿，当前测试版本保持不变";
          }),
        ),
        button("导出此版本", () => this.exportProfile(version)),
        button("删除本地版本", () =>
          this.write(() => {
            this.store.remove(version.id, version.revision);
            return "已删除本地副本；当前战斗与导出的文件保持不变";
          }),
        ),
      );
      row.append(buttons);
      versions.append(row);
    }
    const player = details(this.body, "方案：玩家初始数值");
    const playerGrid = el("div", undefined, "debug-grid");
    player.append(playerGrid);
    numberField(playerGrid, ["初始生命", 1, 1e12], draft.payload.player.hp, (n) => {
      draft.payload.player.hp = n;
      this.saveDraft();
    });
    numberField(playerGrid, ["初始护盾", 0, 1e12], draft.payload.player.shield, (n) => {
      draft.payload.player.shield = n;
      this.saveDraft();
    });
    for (const key of Object.keys(STAT_FIELDS) as (keyof Stats)[])
      numberField(playerGrid, STAT_FIELDS[key], draft.payload.player.stats[key], (n) => {
        draft.payload.player.stats[key] = n;
        this.saveDraft();
      });
    const enemies = details(this.body, "方案：敌人基础数值");
    enemies.append(
      el(
        "p",
        "首领基础生命作为关卡首领生命的倍率基准（默认 2000）；单关实际生命由关卡值 × 此处基准 / 2000 得出。",
      ),
    );
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const group = details(enemies, ENEMIES[kind].name);
      const grid = el("div", undefined, "debug-grid");
      group.append(grid);
      for (const key of Object.keys(ENEMY_FIELDS) as (keyof EnemyNumbers)[])
        numberField(grid, ENEMY_FIELDS[key], draft.payload.enemies[kind][key], (n) => {
          draft.payload.enemies[kind][key] = n;
          this.saveDraft();
        });
    }
    const endless = details(this.body, "方案：无尽成长与补给");
    endless.append(
      el("p", "v2 生命成长使用下方一次项与二次项；旧版指数成长字段仅保留在 JSON 中。"),
    );
    const endlessGrid = el("div", undefined, "debug-grid");
    endless.append(endlessGrid);
    for (const key of Object.keys(ENDLESS_FIELDS) as (keyof typeof ENDLESS_FIELDS)[]) {
      if (["healthGrowth", "damageGrowth", "timingGrowth"].includes(key)) continue;
      numberField(endlessGrid, ENDLESS_FIELDS[key], draft.payload.endless[key], (n) => {
        draft.payload.endless[key] = n;
        this.saveDraft();
      });
    }
    const evolution = details(this.body, "方案：锻体与无尽节奏");
    const evolutionGrid = el("div", undefined, "debug-grid");
    evolution.append(evolutionGrid);
    for (const key of Object.keys(EVOLUTION_FIELDS) as (keyof typeof EVOLUTION_FIELDS)[])
      numberField(evolutionGrid, EVOLUTION_FIELDS[key], draft.payload.evolution[key], (n) => {
        draft.payload.evolution[key] = n;
        this.saveDraft();
      });
    this.renderStageRules(draft);
    this.renderRewardPolicy(draft);
  }
  private renderLegacyProfiles(): void {
    const section = details(this.body, "v1 方案备份与迁移");
    section.append(
      el(
        "p",
        "v1 原始数据保留。迁移仅保存新的 v2 副本，补齐新规则参数；不会启用或重开战斗，旧版回放仍需旧代码。",
      ),
    );
    if (this.store.legacyStorageRaw !== null) {
      const raw = this.store.legacyStorageRaw;
      section.append(
        button("导出 v1 原始存储", () =>
          this.downloadJSON(raw, "echoes-balance-v1-storage-backup.json"),
        ),
      );
    }
    for (const [index, source] of this.store.legacyProfiles.entries()) {
      const row = el("div", undefined, "debug-version");
      row.append(el("strong", () => `${source.name} v${source.revision} · v1`));
      const actions = el("div", undefined, "debug-actions");
      actions.append(
        button("导出 v1 方案", () =>
          this.downloadJSON(
            `${JSON.stringify(source, null, 2)}\n`,
            `echoes-balance-v1-${source.id}-v${source.revision}.json`,
          ),
        ),
        button("迁移为 v2 独立版本", () =>
          this.write(() => {
            this.store.migrateLegacy(index);
            return "已迁移为独立 v2 版本；草稿、选中版本与当前战斗保持不变";
          }),
        ),
      );
      row.append(actions);
      section.append(row);
    }
    const importer = el("label", "导入并迁移 v1 方案副本", "debug-import button button-quiet");
    const input = el("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 2_000_000) {
        this.message("配置文件不能超过 2 MB", true);
        return;
      }
      try {
        const text = await file.text();
        await this.write(() => {
          this.store.migrateLegacyVersion(text);
          return "已迁移为独立 v2 版本；草稿、选中版本与当前战斗保持不变";
        });
      } catch (error) {
        this.message(error instanceof Error ? error.message : String(error), true);
      }
    });
    importer.append(input);
    section.append(importer);
  }
  private renderProfileIdentity(parent: HTMLElement): void {
    const { draft } = this.store.state;
    const selected = this.store.active;
    const running = this.world.profile;
    const state = el("p", undefined, "debug-profile-state");
    state.append(
      el("span", () => profileDebugText(draft, { kind: "draft" })),
      el("span", () =>
        selected
          ? profileDebugText(selected, { kind: "selected" })
          : debugPair(
              "选中版本：未选择（沿用正式配置）",
              "Selected version: none (official profile)",
            ),
      ),
      el("span", () =>
        profileDebugText(running, { kind: "running", width: this.world.arena.width }),
      ),
    );
    parent.append(state);
  }
  private renderExperiments(): void {
    this.body.append(
      el(
        "p",
        "导出已保存且选中的方案交给 Bun CLI；导入实验文件只在本页查看，不覆盖草稿、固定版本或选中版本。",
      ),
    );
    this.renderProfileIdentity(this.body);
    const actions = el("div", undefined, "debug-actions");
    const selected = this.store.active;
    const exporter = button("导出选中方案用于实验", () => {
      if (selected) this.exportProfile(selected);
    });
    exporter.disabled = !selected;
    actions.append(exporter);
    const importer = el("label", "载入实验摘要或 case JSON", "debug-import button button-quiet");
    const file = el("input");
    file.type = "file";
    file.accept = ".json,application/json";
    file.addEventListener("change", async () => {
      const selectedFile = file.files?.[0];
      if (!selectedFile) return;
      if (selectedFile.size > 2_000_000) {
        this.message("实验文件不能超过 2 MB", true);
        return;
      }
      try {
        const parsed = await parseReviewDocument(JSON.parse(await selectedFile.text()));
        this.review = parsed;
        this.render();
        this.message("实验文件已校验；浏览器草稿、固定版本、选中版本和当前战斗未改变");
      } catch (error) {
        this.message(error instanceof Error ? error.message : String(error), true);
      }
    });
    importer.append(file);
    actions.append(importer);
    const candidateImporter = el(
      "label",
      "导入候选为独立版本（保留草稿）",
      "debug-import button button-quiet",
    );
    const candidateFile = el("input");
    candidateFile.type = "file";
    candidateFile.accept = ".json,application/json";
    candidateFile.addEventListener("change", async () => {
      const candidate = candidateFile.files?.[0];
      if (!candidate) return;
      if (candidate.size > 2_000_000) {
        this.message("配置文件不能超过 2 MB", true);
        return;
      }
      try {
        const text = await candidate.text();
        await this.write(() => {
          const version = this.store.importVersion(text);
          return this.store.warning || profileDebugText(version, { kind: "candidate" });
        });
      } catch (error) {
        this.message(error instanceof Error ? error.message : String(error), true);
      }
    });
    candidateImporter.append(candidateFile);
    actions.append(candidateImporter);
    this.body.append(actions);
    this.body.append(
      el(
        "p",
        "候选 BalanceProfile JSON 可导入为独立固定版本，保留当前草稿及选中版本；之后在“方案版本”明确选择测试。原“导入配置 JSON”仍用于主动替换编辑草稿。实验功能不会自动应用正式配置或部署。",
      ),
    );
    if (!this.review) {
      this.body.append(
        el("p", "尚未载入实验文件。CLI 精确复现使用 balance:replay；这里提供人工复核准备。"),
      );
      return;
    }
    const review = this.review;
    const content = details(
      this.body,
      review.kind === "balance-simulator-case" ? "单局人工复核" : "实验摘要",
      true,
    );
    if (review.kind === "balance-simulator-summary") {
      content.append(
        el(
          "p",
          `分组数：${review.groups.length}。统计衡量指定测试策略，不能视作真人通关率。摘要不含完整单局方案时，不能据此准备人工开局。`,
        ),
      );
      const diagnostic = el("pre", JSON.stringify(review, null, 2), "debug-review-json");
      content.append(diagnostic);
      return;
    }
    const layout = this.world.arena;
    content.append(
      el("p", profileDebugText(review.profile, { kind: "case", hash: review.profileHash })),
      el(
        "p",
        `种子：${review.run.seed} · 策略：${review.run.strategy.name} · 模式：${review.run.mode} · 逻辑宽度：${review.run.width}（不是 CSS 视口宽度）`,
      ),
      el("p", `结果：${review.expected.termination} · ${review.expected.reason}`),
      el(
        "p",
        review.expected.validMetrics
          ? "结果数值有效；具体归因仍需结合分关及死亡窗口诊断。"
          : "数值失效，状态不可用：结果中的 0 可能是传输占位值，不能用于解释生命、伤害或构筑。请查看 invalidValues，仍可按原方案与种子准备人工开局。",
      ),
      el(
        "p",
        `代码：${review.code.commit} · ${review.code.dirty ? "含未提交修改" : "干净工作区"} · 指纹 ${review.code.fingerprint}`,
      ),
      el(
        "p",
        "人工准备会重新载入页面，并使用案例的完整数值方案、种子和逻辑宽度从开局暂停。不会自动执行策略或动作轨迹；人工操作后的过程和结果可能不同。浏览器未核验本构建与案例代码指纹相同，精确复现须使用 CLI。",
      ),
      button(
        "按案例准备人工开局（重新载入）",
        () => {
          this.attempt(() => {
            window.sessionStorage.setItem(REVIEW_CASE_KEY, JSON.stringify(review));
            window.location.reload();
            return "正在重新载入以准备人工开局";
          }, false);
        },
        true,
      ),
      el(
        "p",
        `当前场地：${layout.laneCount} 车道 · 容量 ${layout.encounterCapacity}。准备后按案例宽度重建场地。`,
      ),
    );
    const diagnostic = details(content, "关键诊断（原始结果摘要）");
    diagnostic.append(el("pre", JSON.stringify(review.expected, null, 2), "debug-review-json"));
  }
  private renderStageRules(draft: BalanceProfile): void {
    const section = details(this.body, "方案：关卡范围与覆盖");
    section.append(
      el(
        "p",
        "全局（1 至无限）→ 区间 → 单关。同优先级不允许重叠；结束关留空表示后续全部关卡。数量按四车道基准填写，实际随车道换算并限制在物理容量内；显式设置出怪间隔时优先使用该值。",
      ),
    );
    section.append(
      button("新增关卡规则", () => {
        draft.payload.stageRules.push({
          from: 1,
          to: null,
          stage: {},
          kindWeights: null,
          rewards: {},
        });
        this.render();
        this.saveDraft();
      }),
    );
    draft.payload.stageRules.forEach((rule, index) => {
      const group = details(section, `规则 ${index + 1}：${rule.from}–${rule.to ?? "无限"}`, true);
      numberField(group, ["起始关（含）", 1, Number.MAX_SAFE_INTEGER, true], rule.from, (n) => {
        rule.from = n;
        this.saveDraft();
      });
      const end = el("label", undefined, "debug-field");
      end.append(el("span", "结束关（含，留空为无限）"));
      const input = el("input");
      input.type = "number";
      input.min = "1";
      input.step = "1";
      input.value = rule.to === null ? "" : String(rule.to);
      input.addEventListener("change", () => {
        rule.to = input.value === "" ? null : input.valueAsNumber;
        this.saveDraft();
      });
      end.append(input);
      group.append(end);
      const baseline = resolvedStage(
        draft,
        Number.isSafeInteger(rule.from) && rule.from > 0 ? rule.from - 1 : 0,
      );
      this.stageFields(group, rule.stage, baseline, () => this.saveDraft());
      this.weightFields(group, rule.kindWeights, (weights) => {
        rule.kindWeights = weights;
        this.saveDraft();
      });
      group.append(
        button("删除此规则", () => {
          draft.payload.stageRules.splice(index, 1);
          this.rewardScope = -1;
          this.render();
          this.saveDraft();
        }),
      );
    });
  }
  private renderRewardPolicy(draft: BalanceProfile): void {
    const section = details(this.body, "方案：卡池、权重与抽卡规则");
    section.append(
      el(
        "p",
        "权重 0 表示排除，未设置为 1。引导模式在现有流派扶持、基础输出保底和史诗晋升中加权；纯权重模式将所有合格残响直接加权、不重复抽取。权重占比不是三选一面板的精确出现概率；叠加上限及资格仍生效。",
      ),
    );
    select(
      section,
      "奖励来源",
      REWARD_SOURCES.map((source) => [source, SOURCES[source]]),
      this.rewardSource,
      (source) => {
        this.rewardSource = source as RewardSource;
        this.render();
      },
    );
    select(
      section,
      "卡池作用范围",
      [
        ["-1", "全局默认"],
        ...draft.payload.stageRules.map((rule, i): [string, string] => [
          String(i),
          `规则 ${i + 1}：${rule.from}–${rule.to ?? "无限"}`,
        ]),
      ],
      String(this.rewardScope),
      (value) => {
        this.rewardScope = Number(value);
        this.render();
      },
    );
    const rule = draft.payload.stageRules[this.rewardScope];
    const source = this.rewardSource;
    const policy = rule?.rewards[source] ?? draft.payload.rewards[source];
    const edit = (apply: (policy: RewardPolicy) => void) => {
      if (rule && !rule.rewards[source]) rule.rewards[source] = structuredClone(policy);
      apply(rule?.rewards[source] ?? draft.payload.rewards[source]);
      this.saveDraft();
    };
    if (rule)
      section.append(
        button("清除此范围的卡池覆盖", () => {
          delete rule.rewards[source];
          this.render();
          this.saveDraft();
        }),
      );
    select(
      section,
      "抽卡模式",
      [
        ["guided", "保留扶持规则并加权"],
        ["weighted", "纯权重抽取"],
      ],
      policy.mode,
      (value) =>
        edit((target) => {
          target.mode = value as RewardPolicy["mode"];
        }),
    );
    numberField(section, ["引导模式史诗晋升概率（0–1）", 0, 1], policy.epicChance, (n) =>
      edit((target) => {
        target.epicChance = n;
      }),
    );
    check(
      section,
      "保留首关四类输出卡池及首关禁吸血锻体",
      policy.firstStageRestriction,
      (enabled) =>
        edit((target) => {
          target.firstStageRestriction = enabled;
        }),
    );
    const grid = el("div", undefined, "debug-grid");
    section.append(grid);
    for (const card of CARDS)
      numberField(
        grid,
        [`${card.name} · ${card.rarity}`, 0, 1e6],
        policy.cardWeights[card.id] ?? 1,
        (n) =>
          edit((target) => {
            target.cardWeights[card.id] = n;
          }),
      );
    if (source === "stage") {
      const training = details(section, "首领与分数自动锻体权重", true);
      const grid = el("div", undefined, "debug-grid");
      training.append(grid);
      for (const item of TRAININGS)
        numberField(grid, [item.name, 0, 1e6], policy.trainingWeights[item.id] ?? 1, (n) =>
          edit((target) => {
            target.trainingWeights[item.id] = n;
          }),
        );
    }
  }
  private exportProfile(profile: BalanceProfile, draft = false): void {
    this.attempt(() => {
      const parsed = parseProfile(profile);
      if (draft) {
        parsed.id = crypto.randomUUID();
        parsed.revision = 1;
      }
      const url = URL.createObjectURL(
        new Blob([`${JSON.stringify(parsed, null, 2)}\n`], { type: "application/json" }),
      );
      const link = el("a");
      link.href = url;
      link.download = `echoes-balance-${parsed.id}-v${parsed.revision}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return "已导出配置。生产环境需另行校验、应用和发布";
    }, false);
  }
  private downloadJSON(text: string, filename: string): void {
    this.attempt(() => {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const link = el("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return "已导出原始 v1 数据";
    }, false);
  }
}
