# 无尽与锻体重构的独立实验协议

## 当前测量检查点：V4采纳供PRE交付

[V4冻结](freeze-v4.json)后的300局选择与独立600局战役、120局无尽均完整执行并通过独立源/原生/观测审计，预算、错误、非法、取消、缺失和重复未决均为零。[前瞻采纳](selection-adoption-v4.json)发生在两个独立验证集初始化之前。选择170胜/130自然死；战役355胜/245自然死，四组普通构筑成功P50为502–507秒；无尽30清20层/90自然死。原始分母、未进入深层和全部反例保留。

[PRE候选采纳记录](pre-candidate-acceptance-v4.json)结合持续晚层减员、实际生命/护盾消耗、可观察小怪寿命、主动反制与尖峰/等待边界，记录`calibrationAccepted`和`acceptedForPreDelivery`；它没有授权PRO或宣称真人完成率、所有强构筑都掉血、所有共同分层都变慢。完整事实和局限见[V4校准记录](../../../docs/endless-evolution-calibration-v4-2026-10-27.md)。源码审阅合并、Wiki、PRE部署和线上验收由PR交付记录另行核验，校准通过不替代它们。

协议为[选择300](campaign-selection-v4.json)、[战役600](campaign-validation-v4.json)、[无尽120](endless-v4.json)，主种子2026102701/02/03，共170个互异种子，与1513个保守收集的历史种子不重叠。旧4条Q开发输入仅支持候选选择，不计入新矩阵。历史[V3拒收](rejection-v3.json)及[10月27日原报告](../../../docs/endless-evolution-calibration-2026-10-27.md)、V1/V2原始结果均不改写；不把不同种子的历史比较冒充配对实验。

## 历史 revision 2

历史v2候选使用[冻结 v2](freeze-v2.json)；[300局选择集](selection-v2-audit.md)已完整严格接受，四组普通构筑成功局P50均达到480–720秒。[前瞻采纳](selection-adoption-v2.json)只允许进入保留验证，尚不代表发布验收。新协议分别为[选择集300局](campaign-selection-v2.json)、[独立战役600局](campaign-validation-v2.json)及[自然无尽120局](endless-v2.json)，主种子2026102601/02/03互不重叠，也不与全部270个旧种子重叠。正式结果与状态见[10月26日校准记录](../../../docs/endless-evolution-calibration-2026-10-26.md)。

新矩阵使用独立候选严格收集模式：省略 `--baseline`，仍检查完整身份、自然结局、预算、数值、目标、生命周期、准确计数及当前源码指纹。新种子与历史数据不组成配对比较，不虚构基线。重新执行同一输入只能算复现，不能再次称为独立验证。

```sh
bun scripts/endless-evolution-evidence.ts --candidate <完整候选目录> --experiment experiments/balance/endless-evolution/campaign-validation-v2.json --out <新证据文件.json>
```

## 历史 revision 1 协议

v1完整独立验证为276胜、323自然死亡、1预算未决，严格拒收；[拒收与深无尽审计](validation-endless-v1-audit.md)及所有原始记录保持不变。下文保留原v1协议和工作命令，勿覆盖既有目录或将旧policy1统计当作当前policy2的同策略对照。

使用真实 `World`、正式方案、固定步长和自然奖励选择；不改写角色状态，不把自动策略的结果解释为真人胜率。旧版基线与候选使用不同源码及方案指纹，分别保留原始记录；相同种子只用于配对输入，不保证决策分歧后的随机历史相同。

| 集合 | 主种子 | 每策略和布局的种子数 | 总局数 | 目标 | 单局上限 |
| --- | --- | --- | --- | --- | --- |
| campaign-selection | 2026102301 | 50 | 300 | 四关及最终奖励 | 900 秒 / 108000 步 |
| campaign-validation | 2026102302 | 100 | 600 | 四关及最终奖励 | 900 秒 / 108000 步 |
| endless | 2026102303 | 20 | 120 | 自然进入无尽并完成20层 | 7200 秒 / 864000 步 |

每组均包含 `random-auto`、`build-auto`、`build-active` 三种策略和450、1600两种逻辑宽度。验证集只用于候选冻结后的验证；出现失败后如再调参，必须声明验证集已被观察，不再宣称其独立。模拟器默认配置中的 `validationSeeds` 是保留值，本协议三个独立 `simulate` 命令只执行各文件的 `seeds` 队列。

候选稳定并完成必要检查后，分别运行；输出目录必须尚不存在：

```sh
bun run balance:simulate --profile official --experiment experiments/balance/endless-evolution/campaign-selection.json --out artifacts/balance/endless-evolution/candidate-campaign-selection
bun run balance:simulate --profile official --experiment experiments/balance/endless-evolution/campaign-validation.json --out artifacts/balance/endless-evolution/candidate-campaign-validation
bun run balance:simulate --profile official --experiment experiments/balance/endless-evolution/endless.json --out artifacts/balance/endless-evolution/candidate-endless
```

收集器要求显式指定旧基线与候选目录，示例：

```sh
bun scripts/endless-evolution-evidence.ts --baseline /root/Clouds/destiny-echo-web/artifacts/balance/endless-evolution/baseline-campaign-selection --candidate artifacts/balance/endless-evolution/candidate-campaign-selection --experiment experiments/balance/endless-evolution/campaign-selection.json --out experiments/balance/endless-evolution/selection-evidence.json
```

另外两组使用对应目录、实验文件及新的输出文件。不得覆盖既有证据。收集器核对输入矩阵、每个种子/策略/宽度、源码与方案指纹、原始记录数量、原始文件散列、数值及关卡汇总。所有样本必须明确胜负：`error`、非法数值、缺失、取消或预算耗尽均拒收，正常死亡是已决结果。候选源码指纹必须与收集时源码相同；基线维持其独立旧版指纹。

校准参考为普通构筑成功局的玩家侧战斗时间中位数480–720秒，按策略和宽度分别报告；死亡局和成功局时长分开解释，零成功样本没有中位数。数据不足、目标未达或深无尽进入率低时应如实记录，不将未到达的层级当成通过。

候选额外记录每关普通怪/小首领/主首领的出生、死亡、训练额度与 TTK 直方图，以及实际训练分来源、空等时间、危险技能预警/打断/释放、最大一秒生命损失及含护盾承伤。TTK 采用固定上界桶，桶计数准确；不能将桶上界当成精确中位数。融合消失的供体不算击杀。空等指 `Playing` 步开始时没有存活敌人和宝箱，包含设计中的段间喘息；冻结战斗时钟的清场余韵单列为 `presentationSeconds`。一秒集中承伤排除献祭自身扣血。

旧版基线没有上述新观测，报告中相应字段是 `null`，不可补零或推断。收集器拒绝候选生命周期缺失、无预警释放和提前释放。原始数据留在各输出目录，正式结论还需关联代码检查和浏览器表现验证；Wiki、PRE与PRO各自单独验证。
