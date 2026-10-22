# Balance Simulator V1 本地验收与基线

本报告只记录开发实验，不构成正式数值采用建议或发布记录。工具直接运行正式 World；未覆盖 official.json，也未执行 balance:apply、推送、PR、Wiki 发布或 PRE/PRO 部署。浏览器自动化不等于真人或真机验收。

本次本地交付位于 `/root/Clouds/destiny-echo-web/.worktrees/balance-simulator-v1`，分支 `feat/balance-simulator-v1`。主分支跟踪文件保持不变；按本次范围保留未合并的工作分支、worktree 和本地原始实验产物。

## 实现与复用

复用 BalanceProfile/officialProfile/parseProfile、独立随机流、固定步长、正式奖励令牌/空池继续、战役/无尽推进、现有 PRE 版本存储和跨标签页写锁。没有第二套战斗模型或参数体系。

- `src/game/observation.ts` 与 `src/game/world.ts`：可选只读结算事件、有效 HP/盾/恢复、来源与机制、清场前/恢复后状态。
- `src/balance-sim/{runner,strategies,types}.ts`：自然对局、奖励/目标组合策略、六类终止、有界历史/轨迹、状态和动作保护。
- `scripts/balance-sim/` 与 `scripts/balance-simulator.ts`：实验配置、指纹、增量保存、分组统计、配对、扫描、报告、精确复现。
- `src/balance-sim/review.ts`、`src/ui/debug/`：PRE 文件校验、固定版本导出、安全候选导入和人工开局准备；PRO/普通开发不包含实验入口或专用模块。
- `docs/balance-simulator.md`：完整命令、指标口径、限制和后续正式评审流程。

单因素扫描只生成独立候选文件，整数舍入/范围/规则优先级使用既有解析器。示例候选仅把玩家初始基础伤害由 12 调整到 13.2（+10%），其他 payload 不变；不是推荐值。卡牌效果、羁绊算法和对象池预算不全部可由 BalanceProfile 调整。

## 复核命令

以下输出目录必须尚不存在；已有产物请换后缀重新运行。

```sh
cd /root/Clouds/destiny-echo-web/.worktrees/balance-simulator-v1
bun install --frozen-lockfile
bun run balance:simulate --profile official --preset smoke --out artifacts/balance/smoke-new
bun run balance:simulate --profile official --preset standard --out artifacts/balance/standard-new
bun run balance:compare --baseline official --candidate experiments/balance/example-candidate.json --preset standard --out artifacts/balance/compare-new
bun run balance:sweep --experiment experiments/balance/sweep.json --out artifacts/balance/sweep-new
bun run balance:simulate --profile official --experiment experiments/balance/legacy-review.json --out artifacts/balance/legacy-new
bun run balance:replay --case artifacts/balance/legacy-new/cases/campaign_victory.json
bun run balance:simulate --profile official --experiment experiments/balance/endless-review.json --out artifacts/balance/endless-new
```

PRE → 实验/复核 → 导出选中固定方案 → CLI 输入原 JSON。候选文件使用“导入候选为独立版本（保留草稿）”；case 使用“载入实验摘要或 case JSON”并准备人工开局。后者从同方案、种子、逻辑宽度的开局暂停，不是自动播放或战场存档恢复，CLI 才验证相同策略精确复现。

## 正式配置 standard 基线（已完成）

600/600 局，每策略 × 布局独立列出 100 个共同种子。主种子 20261022；完整去重种子列表、全部方案和源码文件哈希在 `artifacts/balance/accepted-baseline/manifest.json`。模拟器版本 1、Bun 1.4.3、固定步长 1/120 秒，玩家侧预算 650 秒 / 78000 步，campaign 模式，默认策略参数，默认不记录完整轨迹。

最终源码内容指纹：`48f3fa830d19ee366a2cc00bd545facf94191f0aa6278acd41fad664028b43b2`。实验在基提交 `ecc7a844f9bb8213256c7969b50fc3367a99d716` 的 dirty worktree 执行；内容指纹及逐文件 SHA-256 记录实际新增实现，不能只用该基提交复现。

| 策略 | 逻辑宽度 / 车道 / 容量 | 胜 / 死 | 已决通关率 | Wilson 95% 区间 | 全体玩家时间 P10 / P50 / P90（秒） |
| --- | --- | --- | --- | --- | --- |
| random-auto | 450 / 4 / 25 | 1 / 99 | 1% | 0.18%–5.45% | 27.30 / 29.20 / 32.91 |
| random-auto | 1600 / 6 / 37 | 5 / 95 | 5% | 2.15%–11.18% | 26.41 / 28.21 / 36.24 |
| build-auto | 450 / 4 / 25 | 41 / 59 | 41% | 31.87%–50.80% | 28.51 / 35.52 / 216.58 |
| build-auto | 1600 / 6 / 37 | 37 / 63 | 37% | 28.18%–46.78% | 28.06 / 31.64 / 216.49 |
| build-active | 450 / 4 / 25 | 45 / 55 | 45% | 35.61%–54.76% | 28.77 / 36.74 / 216.56 |
| build-active | 1600 / 6 / 37 | 39 / 61 | 39% | 30.02%–48.80% | 27.52 / 31.64 / 216.49 |

总计仅用于核账：168 局 campaign_victory、432 局 death；budget_exhausted/error/cancelled/missing 均 0，不能把跨策略总和解释成“游戏真实通关率”。这里的宽度是逻辑场地，不是 CSS 视口。

全部 432 次死亡发生在第 1 关；每个组的第 1 关清关人数分别为 1/5/41/37/45/39，第 2–4 关进入者全部完成战役。后关条件清关率 100% 的分母是已经通过首关的幸存构筑，最小组只有 1 个样本，存在明显存活选择偏差，不能据此断言所有构筑都能轻松通后关。

六组首要累计 HP 损失来源均为 `projectile:hexer`，但致死最后一击分布不同：例如竖屏 random-auto 为 hexer 弹幕 48、wisp 近战 29、sentinel 近战 21、Boss 弹幕 1；竖屏 build-active 为 hexer 19、wisp 16、sentinel 20。不能把“主要长期压力”与“最后一击来源”混成一项归因。

奖励规则相同的 build-auto → build-active 目标策略配对：

| 布局 | 均胜 / 均败 | 仅 auto 胜 / 仅 active 胜 | active−auto | 保守配对 95% 区间 |
| --- | --- | --- | --- | --- |
| 450 | 38 / 52 | 3 / 7 | +4 个百分点 | −23.16 至 +31.16 个百分点 |
| 1600 | 37 / 61 | 0 / 2 | +2 个百分点 | −25.16 至 +29.16 个百分点 |

这两个区间都覆盖 0，不能宣称已经证明目标操作提高真人胜率。random-auto → build-auto 在相同自动目标下分别增加 40 和 32 个百分点，说明这些代理的奖励选择差异比当前目标启发式更显著；这仍不是玩家水平认证。

小批量先测资源：最终 smoke 12/12 用时约 4.03 秒，采样到直接 Bun 子进程 VmHWM 84268 kB；standard 观测 VmHWM 124496 kB、墙时 1485.57 秒。standard 与软件渲染浏览器并行且后台优先级较低，这些墙时不是独占性能基准，也不与玩家侧战斗秒数混用。

## 已复现的代表案例

- `accepted-smoke`：正式方案、random-auto、种子 2401570752、450 逻辑宽度，正常死亡；CLI 完整 case 哈希精确复现通过，保留失败轨迹而不换种子。
- `accepted-legacy`：正式方案、legacy、种子 4、450 逻辑宽度，战役胜利，玩家侧累计 212.5417 秒；0 庇护时间，CLI 完整 case 哈希精确复现通过。
- `accepted-endless`：正式方案、legacy、种子 4、1600 逻辑宽度，自然战役后清掉两层无尽，玩家侧累计 313.4250 秒；终止为 endless_target_reached，仍不是永久通关。记录 68.3083 秒中毒/重伤/减速占用；最后下一关入关的 0 秒记录是观察上限删失，不是该关失败。CLI 完整 case 精确复现通过。
- PRE 已用实际 CLI 生成的 case 完成同方案、种子、宽度的暂停开局准备，草稿/版本/选中状态不被覆盖；只证明准备流程，不证明人工会做出相同策略动作。

## 优先复核的问题与建议

1. **风险是否过度集中在首关，而成长后压力不足。** 证据：432 次死亡全部在首关，412 次发生在 Boss 出现前；168 名首关清关者之后全通战役，各组累计 HP 损失首位均是 hexer 弹幕。可能原因包括前期输出尚未成型时的远程压力，以及首关幸存后奖励/分数锻体反馈超过后续成长。局限：后关只观察到经过筛选的幸存构筑，不代表其他构筑的难度；最后一击也不能单独解释长期失败。建议先在 PRE 复核早亡与幸存的同种子差异，再单因素测试 hexer 攻击间隔、首关出怪预算或初始输出，用未参与选择的种子复核，不直接削弱正式敌人。
2. **首奖边际清怪收益与选牌信息是否足够清楚。** 证据：build-auto 竖屏首奖 multishot 出现并被选 31 次，其中 30 局胜；piercing 首选 7 局均胜；chain 首选 18 局全败，haste 首选 10 局全败。桌面对应首选 multishot 为 23/24 胜、piercing 13/13 胜、chain 0/22、haste 0/12。可能原因是前期弹数/穿透的边际覆盖与初始敌群关系，比通用面板分数更关键。局限：这些是被策略筛选的相关性；候选机会、槽位、种子和后续奖励都混杂，不能由此断言 chain/haste 本身弱或 multishot 必须削弱。建议复核相同初始候选下的合法选择轨迹，记录实际敌人扣血、宝箱获取时间与生命损失，再设计独立种子实验。
3. **先校准测试代理的随机性与目标覆盖，再把代理差异解释成设计结论。** 基线使用固定策略随机种子 1398035009，每局重新创建独立策略流，因此 random-auto 的首奖在本批两个布局的每局都选择候选下标 2；候选内容由游戏种子变化，但这不是对所有策略随机种子的平均。random-auto 与 build-auto 在相同布局/游戏种子下的首奖候选顺序、时点、HP/盾完全相同，能够定位到奖励选择的闭环差异；当前有限目标策略的 +4/+2 个百分点则没有排除零收益。建议后续把策略种子、候选顺序敏感性与目标决策频率设成明确实验因子，保留原基线，不挑有利种子替换结果；不能把这些代理当真人新手或高手。

以上是待验证的诊断方向，不是正式参数修改清单。触屏点选的舒适度、可读性、奖励节奏、长局疲劳及是否好玩仍需人工试玩。

## 独立候选配对比较（已完成）

基线和候选各 600 局，共 1200/1200；使用同一批 100 个游戏种子、相同策略参数、逻辑场地、步长和预算。候选唯一 payload 差异为 `player.stats.damage: 12 → 13.200000000000001`（显示为 13.2，约 +10%）。这里评估的是初始基础伤害，不是给每张卡或所有伤害结算直接乘 1.1。

| 策略 | 逻辑宽度 | 基线胜 / 100 | 候选胜 / 100 | 均胜 / 均败 | 仅基线胜 / 仅候选胜 | 候选−基线（百分点） | 保守配对 95% 区间（百分点） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| random-auto | 450 | 1 | 5 | 0 / 94 | 1 / 5 | +4 | −23.16 至 +31.16 |
| random-auto | 1600 | 5 | 5 | 3 / 93 | 2 / 2 | 0 | −27.16 至 +27.16 |
| build-auto | 450 | 41 | 54 | 37 / 42 | 4 / 17 | +13 | −14.16 至 +40.16 |
| build-auto | 1600 | 37 | 41 | 37 / 59 | 0 / 4 | +4 | −23.16 至 +31.16 |
| build-active | 450 | 45 | 54 | 40 / 41 | 5 / 14 | +9 | −18.16 至 +36.16 |
| build-active | 1600 | 39 | 48 | 39 / 52 | 0 / 9 | +9 | −18.16 至 +36.16 |

全部 600 个配对均已决且匹配。候选不是逐种子单调改善：有 12 个配对从基线胜变为候选死亡，也有 51 个反向改善；桌面 random-auto 的净变化为 0。初始输出改变会影响击杀、奖励时点、后续选择和各随机流的消耗路径，不能要求后来每张牌或敌人动作仍逐项相同，也不能隐去这些退步案例。所有配对区间均覆盖 0；这些是当前样本的观察差异，不是已找到最优参数或已证明真人体验改善。

同一次比较重新执行的基线 600 局，与首次 standard 基线的完整 `RunResult` 逐局完全一致（奖励、事件、死亡窗口均含；排除外层实际耗时和运行编号）。smoke 也用于检查相同条件的子集一致性。候选比较观测 VmHWM 157512 kB、墙时 1212.93 秒，同样受到并发软件渲染和调度影响。

逐项参数差异、连续指标的配对分布、完整双方胜负和未匹配列表见 `artifacts/balance/accepted-comparison/comparison.json`；不能只看本表的胜率差。

一个优先复核的负面案例是种子 **1437975313、逻辑宽度 450**：三个策略在基线均胜、候选均死。build-auto 的基线 `run-256` 在 217.0833 秒完成战役，候选 `run-856` 于 33.0833 秒被 hexer 弹幕击杀。首奖从基线 4.0417 秒的 `[chain, stormcall, multishot] → multishot` 变成候选 4.7167 秒的 `[momentum, stormcall, crush] → momentum`。这能定位到实际机会/决策路径变化，而不是仅用最终一击给整个失败归因。

这两个原始记录已导出为 `accepted-comparison/cases/regression-{baseline,candidate}-1437975313.json`，候选死亡 case 的 CLI 完整精确复现通过；导出和复现不新增统计样本。PRE 可以用同一 case 从暂停开局人工复核。

## 有界单因素扫描与独立验证（已完成）

选择集游戏种子 `[1,2,3,4]`，验证集 `[101,102,103,104]`，两者不重叠。三种策略 × 两种布局，其他参数保持 standard 口径；总预算硬上限 120，实际 120/120 完成。因子为初始基础伤害，倍率 `[0.9,1,1.1]`；倍率 1 没有实际变化被跳过，实际只生成两个候选，逐项参数变更保存。

| 队列 | 基线 | 0.9 倍候选 | 1.1 倍候选 | 样本口径 |
| --- | --- | --- | --- | --- |
| 选择集 | 5 / 24 胜 | 2 / 24 胜 | 6 / 24 胜 | 每个策略/布局 4 个种子；仅用于选择 |
| 独立验证集 | 4 / 24 胜 | 未入选，不执行 | 4 / 24 胜 | 选择后仅比较基线与入选候选 |

表中合计只用于说明选择过程，不能替代分组胜率；完整 30 个分组及各组 Wilson 区间保留在 `accepted-sweep/summary.json`、`report.md` 和本次精简证据中。按选择集已观察到的达标局数选出 1.1 倍候选，但验证集六个策略/布局组的净变化均为 0。竖屏 build-auto、build-active 各有 1 个仅基线胜和 1 个仅候选胜，不能把相同净胜率说成逐局等效。每组只有 4 个验证种子，不足以确认广泛无效或收益稳定。

0.9 倍的负面结果完整保留。验证结果没有复现选择集上的净收益，不能据此采用参数，也不能继续用同一验证集选新候选。后续如继续探索，应预先扩大选择/验证种子并检查代表性负面路径。该扫描墙时约 86.82 秒，观测 VmHWM 113916 kB；仍是本机并发条件下的观察值。

## 运行规模与证据追溯

| 实验目录（均位于 `artifacts/balance/`） | 游戏种子数量 | 计划 / 完成 |
| --- | --- | --- |
| accepted-smoke | 2，standard 列表的前 2 个 | 12 / 12 |
| accepted-baseline | 100 | 600 / 600 |
| accepted-comparison | 同一批 100，两个方案 | 1200 / 1200 |
| accepted-sweep | 选择 4 + 独立验证 4 | 120 / 120 |
| accepted-legacy | 种子 4 | 1 / 1 |
| accepted-endless | 种子 4 | 1 / 1 |

合计 **1934/1934 次统计运行**，包括配对实验中有意重复执行的基线；不是 1934 个独立种子。全部 manifest 均 complete，0 error/cancelled/budget_exhausted/missing。CLI 复现和浏览器人工开局准备不再计入这 1934 局。较早开发过程中不同内容指纹或主动停止的试跑不属于此集合，保留原文件但未拼接或冒充完整 standard。

提交的 `experiments/balance/evidence.json` 保存完整解析配置与种子、源码内容指纹及 41 个文件哈希、方案/case 哈希、六套产物 SHA-256、分组统计、配对和扫描结果。独立核账从逐局 JSONL 重算计划矩阵、终止、分位数、区间、分关时钟/伤害/恢复及 3635 行 CSV，并核对完整基线重复与 smoke 子集一致性。原始大型 `artifacts/balance/accepted-*` 留在本地、被 Git 忽略；精简证据不能替代这些逐局文件，报告中的结论可从原文件追溯。

## 工程与浏览器验证

`bun run docs:check`、`bun run typecheck`、`bun run lint`、`bun test`、`bun run build`、`bun run build:pre` 均通过。完整单元/集成测试为 **336 通过、0 失败**，23 个文件，8,661,645 次断言，包含既有自然对局及关键机制。构建仍提示已有大块资源警告，不影响退出状态。正式 `src/data/`、固定步长、随机数及伤害结算文件与基提交逐字节一致；World 的修改仅为可选结算观察。

浏览器插件不可用，使用工程匹配的 Playwright 浏览器（修订号：Chromium 1248、Firefox 1555、WebKit 2370）和 Xvfb，在本机软件渲染、单 worker 下执行。首次完整 `bun run test:browser` 为 **157 通过、6 跳过、3 失败**，不能把这条命令写成全绿。6 个跳过是既有 WebKit 自然长局 2 项，以及未指定实际 case 文件的 PRE 用例 4 项；后者另用实际实验 case 执行。

首次失败包括 Chromium 自然 offense 的 300 秒墙时超时、随后 defensive 的启动等待超时，以及 WebKit 宝箱流程的 DOM 更新落后一帧。追踪中 offense 仍正常处于 Playing、模拟约 44.66 秒、已开 6 个宝箱；没有到达最终玩法断言。WebKit 的正式模拟已是 RewardSelection、宝箱数 1，但 mock clock 冻结后 DOM 未获下一次 RAF。测试辅助函数仅补充 100 毫秒虚拟时钟让选牌界面渲染；该阶段不推进战斗，保留原种子、原断言及原超时，没有改正式规则。

首次完整日志和 3 个失败的 trace/error-context 保存在本地 `artifacts/balance/browser-evidence/first-*`，后续复测日志另存，避免复测清理原证据。浏览器证明覆盖自动化交互、窄屏/键盘/暂停、版本保护和打包隔离，不替代真机触控、长局疲劳或真人体验验收。

批量模拟和首轮浏览器均结束后，使用原种子、原断言和原超时串行复测：Chromium 的两个自然对局 **2/2 通过**（约 6.9 分钟），WebKit 宝箱流程 **1/1 通过**。首次超时与低负载复测结果分开记录，没有用新结果覆盖首轮日志。单元、文档、类型、lint 和两套构建的最终日志保存在 `artifacts/balance/validation/`。

最终 PRE 专项使用最新构建、最新断言及真实的 `regression-candidate-1437975313.json`，覆盖 pre-chromium、pre-touch、pre-firefox、pre-webkit 四个配置，**16/16 通过，0 跳过**（约 2.5 分钟）。验证固定方案导出、安全候选导入、草稿/选中/运行版本隔离、哈希/配置拒绝、文本转义、PRO 无实验模块，以及真实 case 的同方案/种子/逻辑宽度暂停开局准备。首次未指定文件而跳过的 4 项实际 case 验证在这一轮全部执行通过；既有 WebKit 自然长局 2 项仍按工程配置跳过。首次 3 个失败全部通过针对性复测，但首次完整命令的退出码仍如实保留为 1。

工具说明、README 和架构/PRE 文档已同步。核对 `scripts/game-guide.ts` 后确认玩家可见规则没有语义变化，仅更新生成指南的源码指纹及审计摘要并通过 docs:check，没有发布独立 Wiki。中断实验的累计分母、CSV 错误行联查、固定策略 seed 与选择偏差等 V1 限制见使用文档；正式样本全部有效，未受这些错误/取消口径影响。
