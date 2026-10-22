# Balance Simulator V1

这是开发专用的自然对局数值实验工具，直接在 Bun 中按 `CONFIG.fixedStep` 驱动正式 `World`，不启动 Phaser、Canvas、DOM 或浏览器。它衡量给定测试策略在给定方案、种子和逻辑场地中的表现，不等于真人通关率，也不能证明游戏是否好玩、公平或触屏舒适。不会修改 `official.json`、执行 `balance:apply`、推送、发布 Wiki 或部署。

## 从干净环境运行

在仓库根目录使用 Bun 1.4.3 或更高版本：

```sh
bun install --frozen-lockfile
bun run balance:simulate --help
bun run balance:simulate --profile official --preset smoke --out artifacts/balance/smoke
bun run balance:replay --case artifacts/balance/smoke/cases/death.json
```

输出目录必须尚不存在；自动创建父目录，绝不静默覆盖旧实验。重跑请换一个输出目录。`official` 使用 `officialProfile()`，包括已采用的 `official.json`；即使文件为 `null`，也会保存完整解析后的实际方案。PRE 导出的 JSON 无需转换：

```sh
bun run balance:simulate --profile /path/to/pre-profile.json --preset standard --out artifacts/balance/pre-standard
bun run balance:simulate --profile official --preset standard --out artifacts/balance/baseline
bun run balance:compare --baseline official --candidate experiments/balance/example-candidate.json --preset smoke --out artifacts/balance/comparison
bun run balance:sweep --experiment experiments/balance/sweep.json --out artifacts/balance/sweep
```

示例候选仅将初始基础伤害乘以 1.1，保存为独立完整方案，不代表推荐采用。每个 preset 默认使用三种策略 × 两种布局：smoke 每格 2 个种子共 12 局；standard 每格 100 个种子共 600 局；deep 必须显式选择，每格 500 个种子共 3000 局。先用 smoke 测量资源，再启动 standard/deep。顺序运行，一次只保留一个 World。

## 实验配置与预算

`--experiment FILE` 可覆盖 preset 中的字段。示例：

```json
{
  "schemaVersion": 1,
  "mode": "campaign",
  "seeds": [1, 2, 3, 4],
  "validationSeeds": [101, 102, 103, 104],
  "strategies": [
    {"name": "random-auto"},
    {"name": "build-auto", "reward": {"preferences": {"barrage": 1}}},
    {"name": "build-active", "reward": {"preferences": {"barrage": 1}}, "target": {"intervalSeconds": 0.5}}
  ],
  "layouts": [{"id": "portrait", "width": 450}, {"id": "desktop", "width": 1600}],
  "maxSeconds": 650,
  "maxSteps": 78000,
  "endlessTarget": 2,
  "maxRuns": 120,
  "trace": false,
  "sampleIntervalSeconds": 1,
  "traceCapacity": 1000,
  "deathWindowSeconds": 8,
  "eventCapacity": 400,
  "observations": {
    "provisional": true,
    "unresolvedRatio": 0.05,
    "layoutGap": 0.2,
    "stageDrop": 0.35,
    "strategyGain": 0.1,
    "buildConcentration": 0.6
  }
}
```

流派 ID 从实际 `SYNERGIES` 数据校验。只偏好真实候选，不注入卡组、补卡或绕过首关限制。可以用 `masterSeed` 与 `seedCount` 替代 `seeds`，生成确定性的去重 uint32 种子集；选择集和验证集不得重叠。CLI 的 `--seeds`、`--seed-count N --master-seed N`、`--max-runs`、`--max-seconds`、`--max-steps`、`--mode`、`--endless-target` 覆盖配置。所有配置先校验再执行，不支持任意代码或表达式。

`campaign` 完成四关及最后奖励才算胜利。`endless` 从正常战役开始，领取最终奖励后继续无尽；目标是**已清无尽层数**，有明确上限（V1 1–251），不是永久通关。手机默认 `CONFIG.width=450`，桌面复用 `DESKTOP_WIDTH=1600`；报告同时记录实际车道数、容量和逻辑宽高。逻辑宽度不是 CSS 视口宽度。

停止条件：

| 结果 | 含义 |
| --- | --- |
| `campaign_victory` | 四关与最后奖励已完成 |
| `death` | 正式结算中生命归零 |
| `endless_target_reached` | 指定无尽层数和奖励已完成，仍可能存活 |
| `budget_exhausted` | 达到步数或玩家侧时间预算，胜负未决 |
| `error` | 非法状态、循环保护、非有限数值等运行错误 |
| `cancelled` | 外部取消，不算游戏失败 |

SIGINT/SIGTERM 在当前同步对局结束后处理，下一局记录取消，其余计划样本记缺失；已经完成的 JSONL 保留，manifest 标记 `interrupted`。进程死亡等非正常中断可能留下 `running` 和部分文件，这不表示实验完成，须检查 manifest/逐局行数。V1 不自动续跑、不拼接不同版本结果。正常死亡、预算耗尽、观察告警退出 0；配置/运行/数据完整性/复现错误退出 1；受控中断退出 130。

## 策略的解释与限制

奖励和目标策略可独立组合。所有选择只读取当前可观察状态和已知规则，策略 RNG 与游戏的各随机流分离；日志、统计不消耗游戏随机数。

- `random-auto`：自动索敌，独立固定种子 RNG 在合法奖励间等概率选择，是低策略投入对照，不能称为真人新手。
- `build-auto`：自动索敌。比较合法奖励对当前衍生输出、生存、已有流派投入和下个 3/6/9 档位距离的边际收益，再叠加可配置偏好和稀有度权重。输出估计只用于评分，不是实测 DPS。即时卡牌效果只在克隆玩家上试算，不影响真实 World。
- `build-active`：默认使用相同奖励评分，每 0.5 玩家秒最多选一次目标，关注可观察的蓄力/准备威胁、危险敌人和安全时宝箱。自动索敌的正式攻击区域、嘲讽限制仍然有效。
- `legacy`：保留旧自然对局的固定卡权重、低血治疗加分和半秒宝箱优先行为，作为明确对照；旧 `tests/policy.ts` 和既有测试不替换。其历史锻体评分低是保留的局限，不应用到新 build 策略。

`reward.kind` 为 `random/build/legacy`，`reward.tieBreak` 为 `first/random`。`reward.weights` 可覆盖 `output=28`、`survival=18`、`investment=1.5`、`threshold=8`、`preference=10`、`rarity=1`、`fallback=2`。`seed`、完整权重、版本、同分规则与目标频率均写入结果。V1 默认每局从相同策略 seed 重新创建策略流，因此某次奖励在不同游戏种子中可能总选同一候选下标；候选内容仍由游戏流决定。这是固定策略随机种子条件下的表现，不是对策略随机种子的平均，解释 random-auto 结果前应做策略 seed / 候选排序敏感性复核。`target.kind=auto/active`、`target.chestSafeHealthRatio`（默认 0.5）也可配置。任意更改选牌规则或其 RNG 种子后，报告不再声称隔离了目标操作的收益。

普通/稀有/史诗卡、手动锻体、分数自动锻体分开记录；资格和属性实效上限由正式奖励流程处理。空卡池走真实一次性令牌的 `skipUnavailableReward`，有合法候选时不能跳过。新或尚未细分边际收益的奖励采用中性 fallback，记录 `fallbackOffers`；不能把覆盖不足解释成卡牌无效。有限代理失败不证明任何玩家都无法通关，build 策略也不保证强于 legacy。

## 指标口径

`World` 可选观测只复制已经结算的值，不改变执行顺序或 RNG，未启用不保存逐帧记录。原计数器的覆盖并不完全相同，所以实验采用观测结算值：

| 指标 | 实验含义 / 旧口径差异 |
| --- | --- |
| `enemyDamage` | 实际敌人 HP 扣减，含处决，不含过量、宝箱；与旧 damageDealt 一致 |
| `chestDamage` | 宝箱实际扣血，独立计量 |
| `hpLoss` / `shieldAbsorbed` | 实际生命损失 / 盾吸收分开；生命损失包括 bloodpact 自损。旧 damageTaken 将盾混入且不含 bloodpact |
| `healing` | 有效恢复，分吸血、再生、击杀、卡牌、过关来源；旧 healingDone 不含卡牌和过关恢复 |
| `shieldGained` | 实际获得护盾，含卡牌；旧 shieldRestored 不含卡牌 |
| `effectiveDps` | enemyDamage / 玩家侧 Playing 秒数，宝箱排除；不是面板攻击力 |
| `fatalSource` | 正式致死结算来源；未知保留 unknown。最后一击与长期失败原因分开分析 |

`playerSeconds` 是玩家侧累计战斗时间；`enemySeconds` 是各关敌方时钟增量之和；每关 `stageSeconds` 从零开始；`wallTimeMs` 是程序实际执行耗时。遗世庇护继续玩家攻击与玩家时钟，冻结敌方/关卡时钟。选牌、暂停及领奖不推进任何战斗时间。状态持续时间按固定步开始（本步庇护净化后）的有效状态累计玩家秒数，离散误差受固定步限制，不能解释为逐毫秒遥测。

JSON 的 `stageIndex` / `deathStage` 沿用 World 从 0 开始，Markdown/CSV 的关卡显示从 1 开始。每关记录入关、Boss 出现/死亡、清场时刻与状态，`clear` 在清关分数锻体、手动奖励及恢复前采集，`postReward` 在对应奖励/恢复后采集；`resetStage` 不清除已收集分关数据。另记录到达攻击区、实际攻击、入场峰值、排队召唤峰值、融合/嘲讽/毒/打断/首领技能次数。主要来源、状态时长和奖励顺序可追溯到逐局记录。

关键事件、死亡前窗口与轨迹都有容量上限；默认不存逐帧实体快照。事件/奖励/样本截断量显式记录。每个原生动作/固定步自动锻体超过 4096 次时明确 error 退出，避免极端合法方案在单步内无限消耗预算。奖励历史最多 4096 项，分关最多 256，机制覆盖与卡牌机会累计不因事件环截断而丢失。`--trace` 开启定间隔有界采样；建议仅对异常种子重新运行：

```sh
bun run balance:simulate --profile official --experiment experiments/balance/legacy-review.json --out artifacts/balance/legacy-review
bun run balance:replay --case artifacts/balance/legacy-review/cases/campaign_victory.json
```

每局独立创建 World/深拷贝方案。自然实验不调用临时改血、构筑注入、跳关、补怪或重置 RNG；定向调试属于 scenario/fixture，不得混入自然通关统计，V1 批量入口只接受 natural。

运行错误全部保留。若数值非有限，`invalidValues` 保留字段路径及原 NaN/Infinity 文本，`validMetrics=false`；JSON 中的有限占位数仅用于传输，代表状态不可用，绝不能解读成真实 0 或纳入连续/构筑统计。

## 统计与对照

报告按方案、策略（含参数/偏好）、布局、选择/验证队列、关卡分别列出，不用总平均掩盖差异。显示计划、已完成、缺失和全部六种终止；胜率分母仅胜/死已决局，另列未决比例和将未知结果视为全败/全胜的胜率上下界。预算、错误、取消和未运行不会变成死亡，也不会消失。

二项比例采用 Wilson 95% 区间；零胜/全胜也有区间，零样本为 null。连续指标线性插值 P10/P50/P90：单样本为自身，零样本 null，非有限值明确失败。全体终局生命与只胜局生命单列。错误或不可用状态从连续指标排除但错误数量完整报告。每关条件清关率为清关/进入，本关累计通过比例为清关/该组已记录对局；未到达不算死于该关。取消（包括尚未开局）及错误记录仍在后者分母中，代表结果未知，因此中断实验的累计比例只能作保守下界，不能当作纯开局条件率；另须查看缺失数和全部终止数量。无尽目标达成会在正常领奖并进入下一关后停止；该下一关可能有入关记录但战斗时间为 0，这是观察上限删失，不是该关死亡或难度断崖。

配对使用相同种子、方案/策略条件、布局、模式、步长和预算。输出双方均胜、均败、仅 A 胜、仅 B 胜、未决配对和不匹配样本；胜率差用百分点。配对差的 95% 区间用有界差值的保守 Hoeffding 区间，小样本会很宽；不是高精度效果证明。连续差 B−A 列明统计对象为双方已决配对，不能冒充全体。不同决策之后游戏 RNG 的消耗路径可能分叉，同种子不是每个后续敌人/奖励都相同。

卡牌机会、选择次数/率、获取层数、自动/手动锻体和流派达档位时点在 summary/原始记录中保留。后期卡依赖存活、流派偏好影响选择；这些关联只用于诊断，不能当作因果强度。

告警阈值均为 provisional 设计参考，默认主要观察未决、布局差异、关卡断崖、同奖励规则的目标策略收益和构筑集中度。可增加 `observations.winRate:[min,max]`、`durationP90`；没有统一 PvE 行业胜率目标，也不照搬 PvP 50%。告警默认不阻断构建，程序/数据错误明确失败。

## 有界单因素扫描

`experiments/balance/sweep.json` 先对少量种子比较初始输出 0.9/1/1.1 倍，再将观察到达成目标局数最多的候选用独立验证种子与基线重新比较，同分按候选配置顺序。倍率 1 没有实际改动会跳过。保留所有负面结果，验证集不用于选择；这不构成全局最优搜索。运行前输出实际候选数、种子/策略/布局数、验证局数和总局数硬上限。

受控 `paths` 相对 profile.payload，支持：

- `player.stats.damage`：初始基础输出。
- `enemies.wisp.hp`（或其他正式敌人 ID 与 ENEMY_FIELDS 字段）：敌人基础生命、`interval` 攻击间隔等。
- `endless.healthGrowth`：已有无尽字段。
- `stageRules.0.stage.health`、`stageRules.0.stage.enemyCount`：显式已有规则中的关卡生命倍率、出怪预算等。未写明的基值不能猜测，需先导出并创建经过校验的实验基线。

`values` 是绝对候选值，`multipliers` 是相对倍率，二选一，最多 20 项。多个 paths 必须是同一个明确命名的关联因子，默认示例只有一个字段。整数字段按现有元数据舍入，实际差异落盘，重复/未变化候选跳过；每个完整候选必须经过同一 `parseProfile` 范围/版本/规则重叠校验。场地容量及派生出怪间隔仍由正式 resolver 处理，扫描器不重写公式。不支持卡牌效果、羁绊算法或对象池预算的配置扫描。

## 产物与精确复现

- `manifest.json`：完整配置、命令、Bun/模拟器版本、Git commit/dirty、模拟相关源码逐文件 SHA-256 与组合指纹、完整 profile 和哈希、全部种子、运行状态。dirty 不能只靠 commit 证明版本。
- `profiles/<SHA256>.json`：完整已解析方案，可直接导入现有 PRE。
- `runs.jsonl`：每局完成即追加；含来源/策略/布局、完整结果与实际耗时。内存仅保留有界摘要，不常驻所有 World 或详细轨迹。
- `stages.csv`：分关数据，正确转义逗号、引号、换行，并中和外部文本的表格公式前缀。包含运行错误之前已采集的关卡行；CSV 本身没有终止类型/有效性列，独立分析必须按 `run` 联查 `runs.jsonl` 的 `termination`、`validMetrics` 和 `invalidValues`，排除不可用指标，不能将错误行中的传输占位数当作真实 0。
- `summary.json` / `report.md`：机器统计/中文阅读结论与告警。
- `comparison.json`：实际参数差异、配对分类、百分点与连续指标差异、不匹配样本。
- `cases/`：少量首次出现的成功/死亡/未决等代表案例。case 自包含完整方案、代码指纹、运行参数、完整确定性结果和哈希；wall time/生成日期不进入结果哈希。

`balance:replay` 在相同源码指纹、Bun 版本、步长、策略版本和方案下重跑，完整确定性事件/摘要哈希一致才报成功；版本/指纹不同明确拒绝。实体 ID/奖励令牌仍单调递增，实验事件按可观察语义记录，不倒退游戏 ID。提交或 dirty 标志变化但源码指纹完全一致时会提示，仍能验证相同内容。case 的方案/结果哈希不符也明确失败。大型原始产物在 `artifacts/balance/` 被 Git 忽略，只提交精选示例和精简证据报告。

## PRE 人工复核

PRE 实验室「方案版本」可导出已保存的固定版本，独立于草稿。将其 JSON 交给上述 CLI；CLI 候选 JSON 使用「实验/复核」中的「导入候选为独立版本（保留草稿）」：分配新方案标识并保存，不改变已有草稿、选中版本或正在运行版本，继续复用原版本存储、校验和跨标签页写锁。原「导入配置 JSON」是显式替换当前编辑草稿的旧操作，不用于需要保留草稿的实验导入。

「实验/复核」入口载入经过版本、结构、数值、profile/result SHA-256 校验的 `summary.json` 或 case，显示方案、种子、策略、逻辑场地、结果和诊断。summary 仅展示。case 可以点击准备人工复核：独立 one-shot sessionStorage 暂存后重建页面，按 case 的方案、种子、逻辑宽度从开局暂停准备，保留当前 localStorage 草稿、选中版本及已保存历史。临时补怪/血量/跳关不会写入持久方案。

这是**同方案、同种子重新开局供人工试玩**，不是动作轨迹自动播放，也不是任意战场状态恢复。CLI 才提供按相同策略的精确复现。浏览器只能核验文件内容一致性，不能证明当前 PRE 的代码指纹与 CLI 相同，人工复核页面会提示这一限制。普通 dev/PRO 不含实验入口、策略运行器、报告查看器或详细轨迹模块，不暴露可写 World，不上传数据或新增调参 API。原跨标签页锁和版本保护保持。

## 采用配置前

先检查错误/未决和样本规模，再看相同条件的配对差异；选中候选在独立种子复核，重跑代表性负面案例，并在 PRE 人工试玩触控、暂停、奖励节奏、可读性及长局疲劳。结合策略覆盖、敌方压力和最终一击区分机制/策略/数值原因，另行提出正式数值评审。工具报告的建议与正式采用、PR、Wiki 和 PRE/PRO 发布分别授权、验证。
