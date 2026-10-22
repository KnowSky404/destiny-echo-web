import type { BalanceProfile } from "../data/balance/model";
import { ENEMIES } from "../data/enemies";
import { REWARD_BY_ID } from "../data/training";
import type { EnemyKind } from "../game/types";
import { enemyName, rewardName } from "./content";
import { getLocale, type Locale } from "./locale";

// These keys belong to the PRE component. User profile names, imported JSON and
// input values are never passed through word-by-word replacement.
const DEBUG_EN: Record<string, string> = {
  版本: "Version",
  整数: "integer",
  有限数值: "finite number",
  史诗概率: "Epic probability",
  方案: "Profile",
  起始关: "First stage",
  结束关: "Last stage",
  种子: "Seed",
  逻辑宽度: "Logical width",
  最大步数: "Maximum steps",
  模拟时长预算: "Simulation time budget",
  无尽目标: "Endless target",
  实验文件: "Experiment file",
  "方案版本或规则基线不兼容；需要显式迁移":
    "Profile schema or rule baseline is incompatible; explicit migration is required.",
  "id: 需要 1–100 位字母、数字、连字符或下划线":
    "id: expected 1–100 letters, digits, hyphens or underscores",
  "name: 需要 1–100 位名称": "name: expected a name with 1–100 characters",
  "stageRules: 最多 200 条规则": "stageRules: at most 200 rules are allowed",
  "stageRules: 同优先级规则不能重叠（全局、区间、单关分别检查）":
    "stageRules: rules at the same priority cannot overlap (global, range and single-stage rules are checked separately)",
  实验文件结构过深: "Experiment file nesting is too deep",
  实验文件包含非有限数值: "Experiment file contains nonfinite values",
  实验文件数组过长: "Experiment file array is too long",
  "实验文件版本不兼容；需要 schemaVersion 1 / simulatorVersion 1":
    "Incompatible experiment file; schemaVersion 1 / simulatorVersion 1 required",
  "需要 balance-simulator-case 单局文件": "A balance-simulator-case single-run file is required",
  "run.mode: 未知实验模式": "run.mode: unknown experiment mode",
  "expected.termination: 未知终止结果": "expected.termination: unknown termination result",
  "expected: 缺少数值有效性标记": "expected: missing metric validity flag",
  "expected: 数值有效性与异常信息不一致":
    "expected: metric validity and anomaly information disagree",
  "expected: 需要版本 1 的自然实验结果": "expected: version 1 natural experiment results required",
  "expected.config 与案例 run 不一致": "expected.config does not match the case run",
  "expected.strategy: 策略或版本不一致": "expected.strategy: strategy or version mismatch",
  "expected.fixedStep: 固定步长不一致": "expected.fixedStep: fixed timestep mismatch",
  "expected.stages: 需要关卡摘要数组": "expected.stages: stage summary array required",
  "profileHash 不一致；方案内容已改变": "profileHash mismatch; profile content has changed",
  "expectedHash 不一致；结果内容已改变": "expectedHash mismatch; result content has changed",
  "需要经过校验的实验摘要或单局 case 文件":
    "A validated experiment summary or single-run case file is required",
  "summary: 已完成局数超过计划": "summary: completed runs exceed planned runs",
  "summary: 总计与分组样本数量不一致": "summary: totals do not match group sample counts",

  语言: "Language",
  "PRE 数值实验室": "PRE Balance Lab",
  "PRE · 数值调试": "PRE · Balance Lab",
  返回战场: "Return to battle",
  "仅当前浏览器的 PRE 生效 · 修改不会同步给其他浏览器或生产环境":
    "Changes apply only to PRE in this browser; other browsers and production are unaffected.",
  调试分类: "Debug categories",
  玩家与构筑: "Player & build",
  敌人与出怪: "Enemies & spawning",
  关卡控制: "Stage controls",
  方案版本: "Profile versions",
  "实验/复核": "Experiments / review",
  "已按案例方案、种子和逻辑宽度准备人工复核；战斗保持暂停，未自动执行策略":
    "Manual review is ready with the case profile, seed and logical width. Battle is paused; the strategy has not run.",
  "已保存草稿，仅当前浏览器有效": "Draft saved in this browser.",
  "正在应用本地修改…": "Applying local changes…",
  "草稿已保存在当前浏览器；正在运行的版本保持固定":
    "Draft saved in this browser; the running version remains fixed.",
  "当前生命、护盾与状态": "Current HP, shield & statuses",
  属性覆盖与实际战斗数值: "Stat overrides & effective combat values",
  应用玩家修改: "Apply player changes",
  清除全部属性覆盖: "Clear all stat overrides",
  "卡组与锻体：增删、设置层数": "Augments & training: add, remove and set stacks",
  "修改持续本局。新增卡牌的即时效果只执行一次；减少层数不撤销过去的治疗。属性覆盖独立保留。":
    "Changes last for this run. New cards trigger their immediate effects once; removing stacks does not reverse past healing. Stat overrides are kept separately.",
  应用卡组修改: "Apply build changes",
  "出怪规则仅影响后续生成。修改现有敌人请使用下方单位操作；生命上限修改按剩余生命比例同步。移除不发击杀收益，移除首领后仍须清完其余敌人才结算。":
    "Spawn rules affect future enemies. Use unit controls below for existing enemies; changing maximum HP preserves the remaining HP ratio. Removal grants no kill rewards. Clear remaining enemies after removing a boss to finish the stage.",
  操作对象: "Selected units",
  "指定当前生命（应用时生效）": "Set current HP on apply",
  应用到所选敌人: "Apply to selected enemies",
  移除所选敌人: "Remove selected enemies",
  手动补怪: "Spawn enemies manually",
  补怪种类: "Enemy kind",
  补怪数量: "Enemy count",
  补入战场: "Spawn in arena",
  当前关卡临时出怪规则: "Temporary spawn rules for this stage",
  应用本关出怪规则: "Apply stage spawn rules",
  关卡与重开: "Stage & restart",
  "目标关卡（1–4 战役，5 起为无尽）": "Target stage (1–4 campaign; 5+ endless)",
  跳关时使用初始角色与构筑: "Reset player and build when jumping",
  跳转关卡: "Jump to stage",
  保留当前构筑重开本关: "Restart stage with current build",
  恢复入关快照: "Restore stage-entry snapshot",
  "保留构筑重开会清空战场与本关时钟，保留当前生命、卡组和临时出怪规则。恢复快照会撤销本关成长与修改，恢复入关角色、累计进度和全部随机状态。跳关只是测试起点，不代表自然通关。":
    "Restarting with the current build clears the arena and stage clock while keeping HP, augments and temporary spawn rules. Restoring the snapshot reverses this stage's gains and changes, restoring the entry player, cumulative progress and all random state. A stage jump is a test starting point, not a natural clear.",
  新测试随机种子: "New run seed",
  按此种子重开整局: "Restart run with this seed",
  "自定义小怪种类权重（关闭时继承配置，默认均衡轮换）":
    "Custom minion weights (off: inherit profile; balanced rotation by default)",
  "草稿自动保存在当前浏览器。保存为版本后才能启用测试；启用会按指定种子重开整局。导出文件只包含数值方案，不包含临时修改或战斗进度。":
    "Drafts save in this browser. Save a version before activating it; activation restarts the run with the chosen seed. Exports contain the balance profile, excluding temporary edits and battle progress.",
  方案名称: "Profile name",
  版本测试种子: "Version test seed",
  保存为新版本: "Save new version",
  "导出草稿 JSON": "Export draft JSON",
  复制为新方案: "Copy to new profile",
  已复制为新方案草稿: "Copied to a new profile draft.",
  恢复正式配置为草稿: "Reset draft to official profile",
  "已恢复正式配置草稿；当前测试保持不变":
    "Draft reset to the official profile; the current test is unchanged.",
  "导入配置 JSON": "Import profile JSON",
  "配置文件不能超过 2 MB": "Profile files must not exceed 2 MB.",
  "已导入为新草稿；保存版本后可启用": "Imported as a new draft; save a version to activate it.",
  "尚无已保存版本。": "No saved versions yet.",
  " · 下次打开时沿用": " · Reuse on next visit",
  启用此版本测试: "Activate version for testing",
  载入为草稿: "Load as draft",
  "已载入草稿，当前测试版本保持不变": "Loaded as draft; the running test version is unchanged.",
  导出此版本: "Export version",
  删除本地版本: "Delete local version",
  "已删除本地副本；当前战斗与导出的文件保持不变":
    "Local version deleted; the current battle and exported files are unchanged.",
  "方案：玩家初始数值": "Profile: starting player values",
  初始生命: "Starting HP",
  初始护盾: "Starting shield",
  "方案：敌人基础数值": "Profile: enemy base values",
  "首领基础生命作为关卡首领生命的倍率基准（默认 2000）；单关实际生命由关卡值 × 此处基准 / 2000 得出。":
    "Boss base HP scales stage boss HP (default 2000). Actual stage boss HP = stage value × this base / 2000.",
  "方案：无尽成长与补给": "Profile: endless scaling & supplies",
  "未选择（沿用正式配置）": "None selected (official profile)",
  "选中版本：未选择（沿用正式配置）": "Selected version: none (official profile)",
  "导出已保存且选中的方案交给 Bun CLI；导入实验文件只在本页查看，不覆盖草稿、固定版本或选中版本。":
    "Export the saved, selected profile for the Bun CLI. Imported experiment files are viewed here without replacing the draft, fixed versions or selected version.",
  导出选中方案用于实验: "Export selected profile for experiments",
  "载入实验摘要或 case JSON": "Load experiment summary or case JSON",
  "实验文件不能超过 2 MB": "Experiment files must not exceed 2 MB.",
  "实验文件已校验；浏览器草稿、固定版本、选中版本和当前战斗未改变":
    "Experiment validated; browser draft, fixed versions, selection and battle are unchanged.",
  "导入候选为独立版本（保留草稿）": "Import candidate as separate version (keep draft)",
  "候选 BalanceProfile JSON 可导入为独立固定版本，保留当前草稿及选中版本；之后在“方案版本”明确选择测试。原“导入配置 JSON”仍用于主动替换编辑草稿。实验功能不会自动应用正式配置或部署。":
    "Import candidate BalanceProfile JSON as a separate fixed version, keeping the draft and selection. Choose it under Profile versions to test. Import profile JSON replaces the editable draft. Experiments never apply official configuration or deploy automatically.",
  "尚未载入实验文件。CLI 精确复现使用 balance:replay；这里提供人工复核准备。":
    "No experiment loaded. Use balance:replay in the CLI for exact reproduction; this panel prepares manual review.",
  单局人工复核: "Manual case review",
  实验摘要: "Experiment summary",
  "结果数值有效；具体归因仍需结合分关及死亡窗口诊断。":
    "Result metrics are valid; use stage and death-window diagnostics to explain the outcome.",
  "数值失效，状态不可用：结果中的 0 可能是传输占位值，不能用于解释生命、伤害或构筑。请查看 invalidValues，仍可按原方案与种子准备人工开局。":
    "Metrics and state are invalid. Zeros may be transport placeholders and cannot explain HP, damage or builds. Inspect invalidValues; manual review can still use the original profile and seed.",
  含未提交修改: "Uncommitted changes",
  干净工作区: "Clean worktree",
  "人工准备会重新载入页面，并使用案例的完整数值方案、种子和逻辑宽度从开局暂停。不会自动执行策略或动作轨迹；人工操作后的过程和结果可能不同。浏览器未核验本构建与案例代码指纹相同，精确复现须使用 CLI。":
    "Preparation reloads the page with the case's complete profile, seed and logical width, paused at the start. It does not execute the strategy or action trace; manual play may differ. The browser has not verified this build against the case code fingerprint. Use the CLI for exact reproduction.",
  "按案例准备人工开局（重新载入）": "Prepare manual case run (reload)",
  正在重新载入以准备人工开局: "Reloading to prepare a manual run…",
  "关键诊断（原始结果摘要）": "Key diagnostics (raw result summary)",
  "方案：关卡范围与覆盖": "Profile: stage ranges & overrides",
  "全局（1 至无限）→ 区间 → 单关。同优先级不允许重叠；结束关留空表示后续全部关卡。数量按四车道基准填写，实际随车道换算并限制在物理容量内；显式设置出怪间隔时优先使用该值。":
    "Global (1 to infinity) → range → single stage. Rules at the same priority cannot overlap; a blank end includes every later stage. Counts use the four-lane baseline, scale by lane count and respect physical capacity. An explicit spawn interval takes priority.",
  新增关卡规则: "Add stage rule",
  "起始关（含）": "First stage (inclusive)",
  "结束关（含，留空为无限）": "Last stage (inclusive; blank for infinity)",
  无限: "Infinity",
  删除此规则: "Delete rule",
  "方案：卡池、权重与抽卡规则": "Profile: reward pools, weights & selection",
  "权重 0 表示排除，未设置为 1。引导模式在现有流派扶持、基础输出保底和史诗晋升中加权；纯权重模式将所有合格残响直接加权、不重复抽取。权重占比不是三选一面板的精确出现概率；叠加上限及资格仍生效。":
    "Weight 0 excludes an item; omitted weights default to 1. Guided mode weights family support, foundational offense and epic promotion. Weighted mode samples all eligible augments without replacement. Weight ratios are not exact offer probabilities; eligibility and stack caps still apply.",
  奖励来源: "Reward source",
  宝箱: "Chests",
  无尽补给: "Endless supplies",
  首领与分数锻体: "Boss & score training",
  卡池作用范围: "Reward pool scope",
  全局默认: "Global default",
  清除此范围的卡池覆盖: "Clear reward overrides for this scope",
  抽卡模式: "Selection mode",
  保留扶持规则并加权: "Weighted with guided support",
  纯权重抽取: "Pure weighted selection",
  "引导模式史诗晋升概率（0–1）": "Guided epic promotion probability (0–1)",
  保留首关四类输出卡池及首关禁吸血锻体:
    "Keep stage-one offense families and exclude stage-one lifesteal training",
  首领与分数自动锻体权重: "Boss & automatic score training weights",
  "已导出配置。生产环境需另行校验、应用和发布":
    "Profile exported. Production validation, application and deployment are separate steps.",
  本地版本列表无效: "Invalid local version list",
  本地版本计数无效: "Invalid local revision counters",
  本地版本标识无效: "Invalid local version ID",
  "其他 PRE 标签页已更新方案；本页未覆盖保存内容。请先导出草稿，再刷新后继续保存":
    "Another PRE tab updated the profiles; this page has not overwritten them. Export the draft, then refresh before saving.",
  "浏览器不允许本地存储；本页仍可测试和导出，刷新后不会保留":
    "Local storage is blocked. Testing and export still work; changes will not survive a reload.",
  "本地存储不可用或已满；本页仍可测试和导出，请先导出备份":
    "Local storage is unavailable or full. Testing and export still work; export a backup first.",
  "最多保存 100 个版本，请导出并删除旧版本后继续":
    "At most 100 versions can be saved. Export and delete old versions to continue.",
  请先保存为版本: "Save a version first.",
  "浏览器不支持安全的跨标签页保存；本页仍可测试和导出，刷新后不会保留":
    "Safe cross-tab saving is unavailable. Testing and export still work; changes will not survive a reload.",
  "人工复核文件不能超过 2 MB": "Manual review files must not exceed 2 MB.",
  "人工复核需要单局 case": "Manual review requires a single-run case.",
  请先开始一局测试: "Start a test run first.",
  未知敌人类型: "Unknown enemy kind",
  "已应用到当前浏览器的 PRE 测试；战斗保持暂停":
    "Applied to PRE in this browser; battle remains paused.",
  基础伤害: "Base damage",
  "基础攻击间隔 / 秒": "Base firing interval / seconds",
  基础弹数: "Base projectiles",
  额外穿透: "Extra penetration",
  生命上限: "Maximum HP",
  防线裁决层数: "Defense Verdict stacks",
  击杀爆炸层数: "Kill explosion stacks",
  献祭层数: "Sacrifice stacks",
  荆棘层数: "Thorns stacks",
  首领增伤层数: "Boss damage stacks",
  击杀恢复层数: "Kill healing stacks",
  "攻击加成 / 比例": "Attack power / ratio",
  "重击加成 / 比例": "Heavy-strike bonus / ratio",
  "基础吸血 / 比例": "Base lifesteal / ratio",
  每秒恢复: "HP/s",
  "治疗加成 / 比例": "Healing bonus / ratio",
  "基础暴击率 / 比例": "Base critical chance / ratio",
  暴击倍率: "Critical multiplier",
  "半血增伤 / 比例": "Below-half bonus / ratio",
  闪电跳跃数: "Lightning jumps",
  溅射层数: "Splash stacks",
  雷暴层数: "Storm stacks",
  "命中减速 / 比例": "On-hit slow / ratio",
  "减速增伤 / 比例": "Slowed-target bonus / ratio",
  寒潮层数: "Winter stacks",
  "命中眩晕 / 秒": "On-hit stun / seconds",
  "控制增伤 / 比例": "Control damage / ratio",
  遗世庇护层数: "Sanctuary stacks",
  "过量转盾 / 比例": "Overheal conversion / ratio",
  "转盾容量 / 比例": "Overheal shield capacity / ratio",
  "有盾吸血 / 比例": "Shielded lifesteal / ratio",
  "巨人杀手 / 比例": "Giant Slayer / ratio",
  体量增伤系数: "Size damage coefficient",
  "巨物增伤 / 比例": "Giant damage / ratio",
  "最大生命侵蚀 / 比例": "Maximum-HP erosion / ratio",
  "当前生命侵蚀 / 比例": "Current-HP erosion / ratio",
  "侵蚀脉冲 / 比例": "Erosion pulse / ratio",
  基础生命: "Base HP",
  碰撞半径: "Collision radius",
  移动速度: "Movement speed",
  "攻击间隔 / 秒": "Firing interval / seconds",
  击杀分数: "Kill score",
  "准备时间 / 秒": "Preparation time / seconds",
  弹幕数: "Projectile count",
  弹速: "Projectile speed",
  每层生命与预算成长倍率: "HP & budget growth per layer",
  每层伤害成长倍率: "Damage growth per layer",
  每层攻击计时倍率: "Attack timing growth per layer",
  无尽伤害倍率: "Endless damage multiplier",
  初始攻击计时倍率: "Initial attack timing multiplier",
  标准出怪预算上限: "Base spawn budget cap",
  标准援军批次上限: "Base escort batch cap",
  技能召唤数: "Skill summon count",
  每关补给次数: "Supplies per stage",
  强化召唤倍率: "Enhanced summon multiplier",
  重击基础伤害: "Base slam damage",
  重击逐层增加: "Slam damage per layer",
  小怪生命倍率: "Minion HP multiplier",
  移动倍率: "Movement multiplier",
  敌方伤害倍率: "Enemy damage multiplier",
  "出怪预算（四车道基准）": "Spawn budget (four-lane baseline)",
  "场内容量（四车道基准）": "Arena capacity (four-lane baseline)",
  "出怪间隔 / 秒": "Spawn interval / seconds",
  浓缩倍率: "Population compression",
  攻击计时倍率: "Attack timing multiplier",
  "首领出现 / 秒": "Boss arrival / seconds",
  首领生命: "Boss HP",
  首领弹幕数: "Boss projectile count",
  首领攻击间隔倍率: "Boss firing interval multiplier",
  蓄力攻击伤害: "Charged attack damage",
  "蓄力时间 / 秒": "Charge time / seconds",
  打断所需伤害: "Interrupt damage threshold",
  "援军间隔 / 秒": "Escort interval / seconds",
  "援军批次（四车道基准）": "Escort batch (four-lane baseline)",
  当前生命: "Current HP",
  当前护盾: "Current shield",
  "剩余无敌 / 秒": "Invulnerability remaining / seconds",
  "中毒剩余 / 秒": "Poison remaining / seconds",
  "重伤剩余 / 秒": "Wounds remaining / seconds",
  叠毒每秒额外伤害: "Stacked poison bonus damage / second",
  "叠毒攻速惩罚 / 比例": "Stacked poison attack-speed penalty / ratio",
};

for (const [id, reward] of REWARD_BY_ID) DEBUG_EN[reward.name] = rewardName(id, "en");
for (const kind of Object.keys(ENEMIES) as EnemyKind[])
  DEBUG_EN[ENEMIES[kind].name] = enemyName(kind, "en");

const templates: readonly [string, string][] = [
  ["{path}: 必须是普通对象", "{path}: expected a plain object"],
  ["{path}: 未知字段", "{path}: unknown field"],
  [
    "{path}: 需要 {min}–{max} 之间的{numberKind}",
    "{path}: expected a {numberKind} between {min} and {max}",
  ],
  [
    "{path}: 需要全部五类小怪的权重，且至少一个大于零",
    "{path}: weights for all five minion kinds are required, with at least one above zero",
  ],
  ["{path}.mode: 未知抽卡模式", "{path}.mode: unknown reward selection mode"],
  ["{path}: 需要布尔值", "{path}: expected a boolean"],
  ["{path}: 需要 JSON 对象", "{path}: expected a JSON object"],
  [
    "{path}: 需要非空文本，最多 5000 字符",
    "{path}: expected nonempty text with at most 5000 characters",
  ],
  ["{path}: 需要 SHA-256 内容指纹", "{path}: expected a SHA-256 content fingerprint"],
  ["{path}: 未知策略", "{path}: unknown strategy"],
  ["{path}: 场地宽度、车道或容量不一致", "{path}: arena width, lanes or capacity do not match"],
  ["{path}: 未知终止字段", "{path}: unknown termination field"],
  [
    "{path}: 各终止数量与已完成局数不一致",
    "{path}: termination counts do not match completed runs",
  ],
  ["{path}: 需要两端区间或 null", "{path}: expected a two-endpoint interval or null"],
  ["{path}: 区间无效", "{path}: invalid interval"],
  ["{path}: 与样本数量计算结果不一致", "{path}: does not match the sample-count calculation"],
  ["{path}: 需要数组", "{path}: expected an array"],
  ["{path}: 进入/清关状态无效", "{path}: invalid entered/cleared state"],
  ["{path}.cohort: 未知样本队列", "{path}.cohort: unknown sample cohort"],
  [
    "{path}.strategy.version: 策略版本不兼容",
    "{path}.strategy.version: incompatible strategy version",
  ],
  ["{path}: 重复实验分组", "{path}: duplicate experiment group"],
  ["{path}: 计划、完成和缺失数量不一致", "{path}: planned, completed and missing counts disagree"],
  ["{path}: 已决或胜利数量不一致", "{path}: resolved or victory counts disagree"],
  [
    "{path}.winRateCI95: 已决分母与区间空值不一致",
    "{path}.winRateCI95: resolved denominator and null interval disagree",
  ],
  [
    "{path}.winRateCI95: 区间未覆盖点估计",
    "{path}.winRateCI95: interval does not contain point estimate",
  ],
  [
    "{path}.winRateBounds: 零计划样本需要 null",
    "{path}.winRateBounds: zero planned samples require null",
  ],
  ["{path}.winRateBounds: 缺少未决上下界", "{path}.winRateBounds: missing unresolved bounds"],

  ["{label} · {rarity}", "{label} · {rarity}"],
  ["覆盖 {label}", "Override {label}"],
  ["修改 {label}", "Edit {label}"],
  ["所有{label}", "All {label}"],
  ["#{id} {label} · {hp}/{maxHp}", "#{id} {label} · {hp}/{maxHp}"],
  ["场上单位修改（{count} 只）", "Edit arena units ({count})"],
  ["已保存版本（{count}）", "Saved versions ({count})"],

  [
    "分组数：{count}。统计衡量指定测试策略，不能视作真人通关率。摘要不含完整单局方案时，不能据此准备人工开局。",
    "Groups: {count}. Statistics measure the specified test strategy, not human win rate. A summary without a complete case profile cannot prepare a manual run.",
  ],

  [
    "种子：{seed} · 策略：{strategy} · 模式：{mode} · 逻辑宽度：{width}（不是 CSS 视口宽度）",
    "Seed: {seed} · Strategy: {strategy} · Mode: {mode} · Logical width: {width} (not CSS viewport width)",
  ],
  ["结果：{termination} · {reason}", "Result: {termination} · {reason}"],
  [
    "代码：{commit} · {state} · 指纹 {fingerprint}",
    "Code: {commit} · {state} · Fingerprint {fingerprint}",
  ],
  [
    "当前场地：{lanes} 车道 · 容量 {capacity}。准备后按案例宽度重建场地。",
    "Current arena: {lanes} lanes · Capacity {capacity}. Preparation rebuilds it at the case width.",
  ],
  ["规则 {index}：{from}–{to}", "Rule {index}: {from}–{to}"],
  [
    "已补入 {count} 只敌人；容量不足时停止，始终预留首领位置",
    "Spawned {count} enemies; stops at capacity and always reserves the boss slot.",
  ],
  ["未知卡牌：{id}", "Unknown card: {id}"],
  [
    "本地方案未能读取，现有存储未覆盖：{error}",
    "Local profiles could not be read; existing storage was preserved: {error}",
  ],
  ["人工复核未能准备：{error}", "Manual review could not be prepared: {error}"],
  [
    "{warning}；固定版本未保存，请导出草稿",
    "{warning}; the fixed version was not saved. Export the draft.",
  ],
  [
    "实际伤害 {damage} · 攻击间隔 {interval}s · 暴击率 {crit}% · 弹数 {shots}。勾选后覆盖基础属性；现有战斗上限仍生效。",
    "Effective damage {damage} · Firing interval {interval}s · Critical chance {crit}% · Projectiles {shots}. Enable an override to replace base stats; combat caps still apply.",
  ],
];
const pattern = (source: string) =>
  new RegExp(
    `^${source
      .split(/(\{\w+\})/)
      .map((part) =>
        /^\{\w+\}$/.test(part)
          ? `(?<${part.slice(1, -1)}>${part === "{rarity}" ? "common|rare|epic" : ".*?"})`
          : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("")}$`,
    "s",
  );
// Prefer complete UI contexts over short field prefixes. User profile values
// use the structured helpers below and never participate in pattern matching.
const patterns = templates
  .map(([source, target]) => ({
    match: pattern(source),
    target,
    specificity: source.replace(/\{\w+\}/g, "").length,
  }))
  .sort((left, right) => right.specificity - left.specificity);
const translatedSlots = new Set(["label", "state", "to", "error", "warning", "path", "numberKind"]);

export function debugText(source: string, locale: Locale = getLocale()): string {
  if (locale !== "en") return source;
  const exact = Object.hasOwn(DEBUG_EN, source) ? DEBUG_EN[source] : undefined;
  if (exact !== undefined) return exact;
  for (const { match, target } of patterns) {
    const groups = match.exec(source)?.groups;
    if (groups)
      return target.replace(/\{(\w+)\}/g, (_, key: string) =>
        translatedSlots.has(key)
          ? debugText(
              key === "path"
                ? (groups[key] ?? "")
                    .replace(/^方案(?=\.|$)/, "profile")
                    .replace(/^实验文件(?=\.|$)/, "experiment")
                : (groups[key] ?? ""),
              locale,
            )
          : (groups[key] ?? ""),
      );
  }
  return source;
}

interface TextBinding {
  node: Text;
  source: DebugTextSource;
}
type DebugTextValue = string | { chinese: string; english: string };
export type DebugTextSource = DebugTextValue | (() => DebugTextValue);

// Explicit pairs keep user values separate from the translated UI context.
// A profile called "已保存 X" and a real save notice can have identical Chinese
// text, so string matching cannot reliably distinguish their meanings.
export function debugPair(chinese: string, english: string): DebugTextValue {
  return { chinese, english };
}

type ProfileLabel = Pick<BalanceProfile, "id" | "name" | "revision">;
type ProfileContext =
  | { kind: "version"; selected: boolean }
  | { kind: "saved" | "draft" | "selected" | "candidate" }
  | { kind: "running"; width: number }
  | { kind: "case"; hash: string };

function englishProfileName(profile: ProfileLabel): string {
  return profile.id === "default" && profile.name === "当前正式数值"
    ? "Official balance"
    : profile.name;
}

export function profileDebugText(profile: ProfileLabel, context: ProfileContext): DebugTextValue {
  const original = `${profile.name} v${profile.revision}`;
  const translated = `${englishProfileName(profile)} v${profile.revision}`;
  switch (context.kind) {
    case "version":
      return debugPair(
        `${original}${context.selected ? " · 下次打开时沿用" : ""}`,
        `${original}${context.selected ? " · Reuse on next visit" : ""}`,
      );
    case "saved":
      return debugPair(`已保存 ${original}`, `Saved ${original}`);
    case "draft":
      return debugPair(`草稿：${original}（可编辑）`, `Draft: ${translated} (editable)`);
    case "selected":
      return debugPair(`选中版本：${original}`, `Selected version: ${translated}`);
    case "running":
      return debugPair(
        `正在运行：${original} · 逻辑宽度 ${context.width}`,
        `Running: ${translated} · Logical width ${context.width}`,
      );
    case "candidate":
      return debugPair(
        `已导入候选 ${original} 为独立版本；草稿、选中版本与当前战斗保持不变`,
        `Imported candidate ${original} as a separate version; draft, selection and battle are unchanged.`,
      );
    case "case":
      return debugPair(
        `方案：${original} · 内容哈希 ${context.hash}`,
        `Profile: ${original} · Content hash ${context.hash}`,
      );
  }
}

export interface DebugMetrics {
  seed: number;
  stage: number;
  stageTime: number;
  activeTime: number | undefined;
  stageDamage: number | undefined;
  stageTaken: number | undefined;
  stageHealing: number | undefined;
  stageKills: number | undefined;
  damage: number;
  taken: number;
  healing: number;
  kills: number;
}

export function metricsDebugText(profile: ProfileLabel, value: DebugMetrics): DebugTextValue {
  return debugPair(
    `${profile.name} v${profile.revision} · 种子 ${value.seed} · 第 ${value.stage} 关 · 本关 ${value.stageTime.toFixed(1)}s / 实战 ${value.activeTime?.toFixed(1)}s · 本关伤害 ${value.stageDamage?.toFixed(0)} / 承伤 ${value.stageTaken?.toFixed(0)} / 治疗 ${value.stageHealing?.toFixed(0)} / 击杀 ${value.stageKills} · 累计伤害 ${value.damage.toFixed(0)} / 承伤 ${value.taken.toFixed(0)} / 治疗 ${value.healing.toFixed(0)} / 击杀 ${value.kills}`,
    `${englishProfileName(profile)} v${profile.revision} · Seed ${value.seed} · Stage ${value.stage} · Stage ${value.stageTime.toFixed(1)}s / Active ${value.activeTime?.toFixed(1)}s · Stage damage ${value.stageDamage?.toFixed(0)} / Taken ${value.stageTaken?.toFixed(0)} / Healing ${value.stageHealing?.toFixed(0)} / Kills ${value.stageKills} · Total damage ${value.damage.toFixed(0)} / Taken ${value.taken.toFixed(0)} / Healing ${value.healing.toFixed(0)} / Kills ${value.kills}`,
  );
}

export function debugSource(source: DebugTextSource, locale: Locale = getLocale()): string {
  const value = typeof source === "function" ? source() : source;
  return typeof value === "string"
    ? debugText(value, locale)
    : locale === "en"
      ? value.english
      : value.chinese;
}
const textBindings = new WeakMap<Element, TextBinding>();
const attributeBindings = new WeakMap<Element, Map<string, string>>();

// Bind only text created by this component. Updating a Text node leaves nested
// inputs, their listeners, draft values, focus and disclosure state intact.
export function bindDebugText(element: HTMLElement, source: DebugTextSource): void {
  const existing = textBindings.get(element);
  if (existing && existing.node.parentNode === element) {
    existing.source = source;
    existing.node.data = debugSource(source);
  } else {
    const node = document.createTextNode(debugSource(source));
    element.prepend(node);
    textBindings.set(element, { node, source });
  }
}

export function debugAttribute(element: HTMLElement, name: string, source: string): void {
  const attributes = attributeBindings.get(element) ?? new Map<string, string>();
  attributes.set(name, source);
  attributeBindings.set(element, attributes);
  element.setAttribute(name, debugText(source));
}

export function refreshDebugText(root: HTMLElement): void {
  for (const element of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    const binding = textBindings.get(element);
    if (binding) binding.node.data = debugSource(binding.source);
    for (const [name, source] of attributeBindings.get(element) ?? [])
      element.setAttribute(name, debugText(source));
  }
}
