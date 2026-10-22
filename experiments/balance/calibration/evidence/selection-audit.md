V5 Selection 独立审计（不含holdout）。

严格collector通过6/6 cells、1200/1200局；源码359b7c2478e4e28cc99996b7a6b6cdab9993e901493c95a9e4c67ff7089226e0，候选e33fe7cbc2c26362482762303b3b93aa6d2fed0dcc4b776cdef0d883543df102。全阶段重新核账无integrity error，无预算耗尽、错误、取消或缺失。唯一V4→V5参数变化为第3关health8.1→4.5/Boss28000→16000，第4关health16.2→9/Boss56000→32000；damage保持原值。

| 策略 / 宽度 | 基线胜局/100 | 候选胜局/100（Wilson95%） | 首清 基线→候选 | 配对改善/退步 |
| --- | ---: | --- | ---: | ---: |
| random-auto/450 | 1 | 28 (20.1%–37.5%) | 1→35 | 28/1 |
| random-auto/1600 | 5 | 20 (13.3%–28.9%) | 5→67 | 17/2 |
| build-auto/450 | 41 | 77 (67.8%–84.2%) | 41→86 | 42/6 |
| build-auto/1600 | 37 | 79 (70.0%–85.8%) | 37→99 | 42/0 |
| build-active/450 | 45 | 77 (67.8%–84.2%) | 45→89 | 39/7 |
| build-active/1600 | 39 | 76 (66.8%–83.3%) | 39→95 | 38/1 |

候选逐关实际压力（全部进入者累计；外伤排除bloodpact，不将清关后满血等同没有受到压力）：

| 策略 / 宽度 | 关 | 进入/清关 | 出手局数 | 外伤HP | 自损HP | 盾吸收 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| random-auto/450 | 1 | 100/35 | 99 | 7922.32 | 0.00 | 0.00 |
| random-auto/450 | 2 | 35/28 | 18 | 1063.63 | 21.00 | 11.53 |
| random-auto/450 | 3 | 28/28 | 5 | 430.30 | 84.00 | 0.00 |
| random-auto/450 | 4 | 28/28 | 4 | 1207.14 | 171.00 | 327.36 |
| random-auto/1600 | 1 | 100/67 | 97 | 7186.28 | 0.00 | 0.00 |
| random-auto/1600 | 2 | 67/20 | 59 | 5437.73 | 36.00 | 27.45 |
| random-auto/1600 | 3 | 20/20 | 9 | 892.50 | 114.00 | 24.00 |
| random-auto/1600 | 4 | 20/20 | 8 | 641.26 | 210.00 | 138.74 |
| build-auto/450 | 1 | 100/86 | 80 | 2517.37 | 0.00 | 0.00 |
| build-auto/450 | 2 | 86/77 | 29 | 1923.14 | 129.00 | 201.40 |
| build-auto/450 | 3 | 77/77 | 11 | 1186.61 | 345.00 | 253.79 |
| build-auto/450 | 4 | 77/77 | 18 | 3187.38 | 744.00 | 588.12 |
| build-auto/1600 | 1 | 100/99 | 46 | 1787.58 | 0.00 | 0.00 |
| build-auto/1600 | 2 | 99/79 | 46 | 5739.88 | 126.00 | 328.07 |
| build-auto/1600 | 3 | 79/79 | 26 | 1849.42 | 393.00 | 571.18 |
| build-auto/1600 | 4 | 79/79 | 22 | 2222.27 | 837.00 | 1532.23 |
| build-active/450 | 1 | 100/89 | 80 | 2385.88 | 0.00 | 0.00 |
| build-active/450 | 2 | 89/77 | 32 | 2576.10 | 279.00 | 210.35 |
| build-active/450 | 3 | 77/77 | 15 | 2319.24 | 579.00 | 691.56 |
| build-active/450 | 4 | 77/77 | 17 | 3751.69 | 1032.00 | 2351.81 |
| build-active/1600 | 1 | 100/95 | 44 | 2152.05 | 0.00 | 0.00 |
| build-active/1600 | 2 | 95/76 | 43 | 3471.07 | 126.00 | 477.47 |
| build-active/1600 | 3 | 76/76 | 17 | 686.96 | 399.00 | 312.74 |
| build-active/1600 | 4 | 76/76 | 17 | 1060.54 | 876.00 | 664.46 |

全阶段告警（由全部1200份原始记录重新summarize，包含跨布局比较）：
- stage_drop: selection/当前正式数值/random-auto/450 — 存在进入后的关卡清关断崖
- stage_drop: selection/当前正式数值/random-auto/1600 — 存在进入后的关卡清关断崖
- stage_drop: selection/当前正式数值/build-auto/450 — 存在进入后的关卡清关断崖
- stage_drop: selection/当前正式数值/build-auto/1600 — 存在进入后的关卡清关断崖
- stage_drop: selection/当前正式数值/build-active/450 — 存在进入后的关卡清关断崖
- stage_drop: selection/当前正式数值/build-active/1600 — 存在进入后的关卡清关断崖
- stage_drop: selection/Stage calibration 2026-10-22/random-auto/450 — 存在进入后的关卡清关断崖
- stage_drop: selection/Stage calibration 2026-10-22/random-auto/1600 — 存在进入后的关卡清关断崖
- build_concentration: selection/Stage calibration 2026-10-22/build-auto/450 — 至少一种流派在多数终局构筑中达到3层；受策略与存活时间偏差影响
- build_concentration: selection/Stage calibration 2026-10-22/build-auto/1600 — 至少一种流派在多数终局构筑中达到3层；受策略与存活时间偏差影响
- build_concentration: selection/Stage calibration 2026-10-22/build-active/450 — 至少一种流派在多数终局构筑中达到3层；受策略与存活时间偏差影响
- build_concentration: selection/Stage calibration 2026-10-22/build-active/1600 — 至少一种流派在多数终局构筑中达到3层；受策略与存活时间偏差影响

候选跨布局差异（desktop−portrait，百分点；条件率涉及不同存活构筑，不是同构筑因果结论）：

| 策略 | 战役 | 首关清关 | 第2关条件清关 |
| --- | ---: | ---: | ---: |
| random-auto | -8.0 | 32.0 | -50.1 |
| build-auto | 2.0 | 13.0 | -9.7 |
| build-active | -1.0 | 6.0 | -6.5 |

候选胜局与Boss时长尾部（秒；Boss分布使用实际击杀该Boss的所有记录）：

| 策略 / 宽度 | 战役P50 / P95 / max | 第3Boss P95 / max | 第4Boss P95 / max |
| --- | ---: | ---: | ---: |
| random-auto/450 | 230.46 / 287.41 / 299.64 | 14.11 / 22.15 | 15.84 / 18.52 |
| random-auto/1600 | 227.30 / 275.79 / 324.93 | 17.01 / 34.77 | 18.28 / 21.95 |
| build-auto/450 | 217.43 / 255.73 / 366.30 | 10.48 / 32.29 | 10.71 / 38.78 |
| build-auto/1600 | 220.66 / 280.46 / 343.79 | 14.60 / 37.03 | 10.98 / 31.84 |
| build-active/450 | 217.59 / 274.93 / 342.16 | 17.89 / 37.17 | 15.62 / 45.32 |
| build-active/1600 | 218.97 / 271.79 / 285.57 | 11.09 / 22.30 | 9.07 / 21.96 |

末关清关与Boss后清理尾部（正式已清局条件分布，秒）：

| 策略/宽度 | 末关P50/P95/max | Boss后P50/P95/max |
| --- | ---: | ---: |
| random-auto/450 | 53.93/73.81/80.17 | 0.21/6.06/13.63 |
| random-auto/1600 | 53.53/69.68/73.80 | 1.13/3.44/5.03 |
| build-auto/450 | 55.37/68.30/122.58 | 0.42/4.75/31.29 |
| build-auto/1600 | 55.49/69.92/102.22 | 0.77/3.28/22.37 |
| build-active/450 | 55.49/76.36/104.37 | 0.48/7.16/11.04 |
| build-active/1600 | 55.47/67.22/79.01 | 0.59/2.47/9.04 |

预先软区间核对：
- build-auto/450: 首清86.0%，位于65–95%；战役77.0%，超出25–75%。
- build-auto/1600: 首清99.0%，超出65–95%；战役79.0%，超出25–75%。
- build-active/450: 首清89.0%，位于65–95%；战役77.0%，超出25–75%。
- build-active/1600: 首清95.0%，位于65–95%；战役76.0%，超出25–75%。

配对退步种子完整保留：
- random-auto/450: 1437975313。
- random-auto/1600: 1587657984, 3584956826。
- build-auto/450: 3687043510, 1437975313, 3584956826, 789001697, 318288313, 1241171501。
- build-auto/1600: 无。
- build-active/450: 1566436483, 3687043510, 459791165, 3584956826, 789001697, 318288313, 1241171501。
- build-active/1600: 2437618375。

历史预算失败种子553415033的正式V5运行：campaign_victory，334.20秒，预算仍650秒；第4关61.72秒。此为本轮正式矩阵中的运行，不是替换原证据的扩预算诊断。

解释边界：
- 首关人口/初始伤害按车道放大，但Boss血量与5000分锻体阈值不按人口缩放；宝箱36HP对应初始3/2次命中。此前已调查的random首清布局差与第2关漏斗与已知结构和存活选择效应一致；尚未隔离因果贡献，不能说每关难度等价。
- 第1→2关计划小怪生命预算约7.5倍，Boss生命4.3倍；这是显式难度重新分布。随机弱构筑在第2关淘汰不能全归因于布局机制。
- 固定策略种子下的random代理不是跨策略种子平均，也不代表真人新手；全阶段绿色完整性检查不等于没有设计告警。
- 当前仅selection证据；独立validation、无尽和策略/布局敏感性尚须另行完整验证，未读取其结果。真人体验、真机触控和长局舒适度未获证明。


独立判断：
建议仅将冻结V5原样推进到预先保留的独立验证；本选择阶段不能采用或发布。1200/1200正常终止（525战役胜利、675死亡），预算耗尽、错误、取消均为0；数值源359b7c、候选e33fe7、collector76c911一致，独立验证master20261028/每组300种子尚未查看。
候选六组战役胜率为28%、20%、77%、79%、77%、76%，首关清关率35%、67%、86%、99%、89%、95%。必须显式接受四个构筑组战役点估计均超过原25–75%软区间，且build-auto宽屏首清99%超过65–95%软区间；Wilson区间包含75%不能视为满足软区间。这些是设计观察项，并非硬CI通过标准。
随机策略首清宽屏高32个百分点、第二关条件清关低50.15个百分点仍需保留为已调查的布局现象；与已知布局/奖励结构及存活选择效应一致，但本实验没有隔离因果。第二关是构筑策略的主要过滤点：候选243次死亡分别在首关129、第二关114；全部357名第三关进入者与末关进入者均清关。后两关更符合成型构筑回报，不能宣称普遍、均匀的后期挑战。
实际敌方压力在部分局存在，但六组第三、四关外伤HP及外伤HP+盾中位数全部为0；必须使用包含零值的全部进入者分母。外伤HP排除bloodpact，盾单列，恢复不会抹掉已发生伤害。末关联合受伤局数依次4/28、8/20、16/77、14/79、16/77、10/76，不能用这些条件子集代替全部幸存者。
相对原始基线，206局改善和17局退步分别保留完整种子，不以净改善掩盖伤害；12条原始警告全部保留（基线6条stage_drop、候选2条stage_drop及4条build_concentration）。相对V4候选全部353旧胜局保留，另救回4局；共同胜局282加速、71增慢，最大增慢19.44秒，全部增慢记录另附，不只列最快改善。
候选胜局最长366.30秒，比650秒硬预算有283.70秒样本内余量；各组末关最大清关时长80.17/73.80/122.58/102.22/104.38/79.01秒，Boss后清理最大13.63/5.03/31.29/22.37/11.04/9.04秒。此为已完成选择样本的条件时长，不保证未见种子或无尽尾部；475秒只曾是探索目标，未替代650秒正式硬门槛。
跨轮600条基线完整结果、600条候选前两关摘要/奖励/事件前缀逐值一致，来源SHA均核对。所有1200局已正常结束，rightCensoredAtTarget为0；全部60个Wilson区间、完整配对种子、逐关压力/血量/时长及原始来源哈希随审计保存。
继续理由是硬门槛和已知尾部余量满足、旧胜局未丢失、首两关与布局行为未意外漂移；代价是构筑战役胜率偏高及后两关典型压力偏低。独立验证、有限自然无尽与策略/布局敏感性仍须完成，并由根代理综合审阅后决定采用。所有秒数为玩家侧战斗时间，不含奖励思考或真人墙钟时间；模拟策略结果不能当作真人胜率或实体设备长期体验证明。

完整配对改善种子与退步种子（基线→V5；两者分别保留，不以净值代替）：
- selection-random-auto-portrait: 改善28个 [549862174, 1041096425, 1564870657, 1697619556, 3974883632, 2536325632, 1522565275, 823816499, 2457051956, 4036502962, 690941975, 459791165, 184701048, 2952449219, 3260729948, 1989223751, 2267440289, 57767583, 3280259359, 3584956826, 300208060, 3790078184, 3122359941, 3610644521, 3353825173, 1909972809, 2451194854, 1241171501]；退步1个 [1437975313]。
- selection-random-auto-desktop: 改善17个 [2498284726, 2660982281, 1415047739, 3748993695, 3688510726, 3802021277, 2457051956, 13895363, 3999029063, 1437975313, 2049196492, 3983004663, 406919480, 57767583, 3280259359, 3653956872, 3682834787]；退步2个 [1587657984, 3584956826]。
- selection-build-auto-portrait: 改善42个 [2401570752, 939868294, 1587657984, 549862174, 1605257493, 2498284726, 1697619556, 273707710, 3383302201, 3314983253, 1415047739, 3076862624, 3748993695, 3057963394, 743105183, 3794691057, 2536325632, 823816499, 3802021277, 2774854168, 3190054314, 3999029063, 2622117182, 4036502962, 947461381, 1474201129, 2096918712, 2213114050, 184701048, 2613161785, 3983004663, 4215184953, 1884496788, 1365816041, 2267440289, 3631070021, 3459782343, 57767583, 2497068266, 3122359941, 2888170526, 3682834787]；退步6个 [3687043510, 1437975313, 3584956826, 789001697, 318288313, 1241171501]。
- selection-build-auto-desktop: 改善42个 [2401570752, 939868294, 2398684595, 1587657984, 1605257493, 1041096425, 2009424590, 1010499993, 451496315, 273707710, 3974883632, 3314983253, 1415047739, 3057963394, 1099727622, 2536325632, 3688510726, 1522565275, 823816499, 3802021277, 1566436483, 1610706512, 2457051956, 13895363, 404998562, 454402817, 2622117182, 3687043510, 459791165, 2213114050, 553415033, 3459782343, 57767583, 3584956826, 300208060, 789001697, 691133420, 2497068266, 3790078184, 2888170526, 2451194854, 3682834787]；退步0个 []。
- selection-build-active-portrait: 改善39个 [2401570752, 939868294, 2398684595, 549862174, 3176762491, 1563182499, 3182306692, 2498284726, 1697619556, 273707710, 3383302201, 3314983253, 1415047739, 3076862624, 3748993695, 3057963394, 743105183, 2536325632, 823816499, 3802021277, 454402817, 3999029063, 2622117182, 947461381, 2096918712, 2213114050, 184701048, 2613161785, 3983004663, 4215184953, 1884496788, 406919480, 2267440289, 3631070021, 3459782343, 57767583, 2497068266, 3122359941, 2888170526]；退步7个 [1566436483, 3687043510, 459791165, 3584956826, 789001697, 318288313, 1241171501]。
- selection-build-active-desktop: 改善38个 [2401570752, 2398684595, 1587657984, 1605257493, 1041096425, 2009424590, 1010499993, 451496315, 273707710, 3974883632, 3383302201, 3314983253, 3057963394, 1099727622, 2536325632, 3688510726, 1522565275, 823816499, 3802021277, 1566436483, 1610706512, 13895363, 404998562, 2622117182, 459791165, 1437975313, 57767583, 3584956826, 300208060, 789001697, 2497068266, 318288313, 3790078184, 3368200636, 2888170526, 2451194854, 3682834787, 2288945874]；退步1个 [2437618375]。

跨轮确定性与变化核对：
- V4基线完整结果600/600逐值hash相同；候选前两关stage摘要600/600、奖励600/600、事件600/600均相同。档案raw SHA与新strict来源匹配；候选第三、四关允许变化。
- 相对V4候选，新救回4局、新失去0局；共同胜局353中282加速、71增慢、0相同，时长差中位-3.34秒，最大增慢19.44秒。

候选逐关压力分布（全部进入者，包含零值；外伤HP不含bloodpact；盾另计；此表n为进入数而非受伤数）：

| 策略/宽度 | 关/n | 外伤HP p50/p95/max | 外伤为零 | 盾 p50/p95/max | 外伤+盾 p50/p95/max | 联合为零 | 出手局/进入 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| random-auto/450 | 1/100 | 100.00/105.07/129.07 | 1/100 | 0.00/0.00/0.00 | 100.00/105.07/129.07 | 1/100 | 99/100 |
| random-auto/450 | 2/35 | 0.00/119.23/140.80 | 18/35 | 0.00/0.16/11.00 | 11.00/119.23/140.80 | 17/35 | 18/35 |
| random-auto/450 | 3/28 | 0.00/128.37/140.40 | 24/28 | 0.00/0.00/0.00 | 0.00/128.37/140.40 | 24/28 | 5/28 |
| random-auto/450 | 4/28 | 0.00/160.76/907.08 | 24/28 | 0.00/41.22/263.94 | 0.00/332.32/970.50 | 24/28 | 4/28 |
| random-auto/1600 | 1/100 | 78.65/108.57/128.39 | 3/100 | 0.00/0.00/0.00 | 78.65/108.57/128.39 | 3/100 | 97/100 |
| random-auto/1600 | 2/67 | 80.00/190.61/264.20 | 8/67 | 0.00/0.00/24.00 | 80.00/190.61/288.20 | 8/67 | 59/67 |
| random-auto/1600 | 3/20 | 0.00/165.95/280.80 | 13/20 | 0.00/1.20/24.00 | 0.00/179.53/280.80 | 13/20 | 9/20 |
| random-auto/1600 | 4/20 | 0.00/112.88/262.50 | 13/20 | 0.00/28.01/104.24 | 0.00/188.40/262.50 | 12/20 | 8/20 |
| build-auto/450 | 1/100 | 7.70/100.00/128.06 | 26/100 | 0.00/0.00/0.00 | 7.70/100.00/128.06 | 26/100 | 80/100 |
| build-auto/450 | 2/86 | 0.00/118.06/235.40 | 63/86 | 0.00/11.00/60.00 | 0.00/121.73/235.40 | 57/86 | 29/86 |
| build-auto/450 | 3/77 | 0.00/40.50/807.30 | 71/77 | 0.00/13.00/161.49 | 0.00/56.68/807.30 | 67/77 | 11/77 |
| build-auto/450 | 4/77 | 0.00/118.80/1464.00 | 71/77 | 0.00/46.50/235.50 | 0.00/249.60/1464.00 | 61/77 | 18/77 |
| build-auto/1600 | 1/100 | 0.00/78.35/105.05 | 56/100 | 0.00/0.00/0.00 | 0.00/78.35/105.05 | 56/100 | 46/100 |
| build-auto/1600 | 2/99 | 0.00/184.85/607.20 | 53/99 | 0.00/25.38/60.00 | 0.00/236.72/607.20 | 53/99 | 46/99 |
| build-auto/1600 | 3/79 | 0.00/80.86/641.75 | 64/79 | 0.00/60.00/121.35 | 0.00/118.56/763.10 | 56/79 | 26/79 |
| build-auto/1600 | 4/79 | 0.00/33.65/1044.27 | 72/79 | 0.00/68.10/642.00 | 0.00/138.60/1276.50 | 65/79 | 22/79 |
| build-active/450 | 1/100 | 7.70/100.00/127.62 | 25/100 | 0.00/0.00/0.00 | 7.70/100.00/127.62 | 25/100 | 80/100 |
| build-active/450 | 2/89 | 0.00/146.52/227.70 | 62/89 | 0.00/23.20/60.00 | 0.00/146.52/240.90 | 57/89 | 32/89 |
| build-active/450 | 3/77 | 0.00/126.88/759.24 | 70/77 | 0.00/39.00/344.50 | 0.00/206.18/825.50 | 63/77 | 15/77 |
| build-active/450 | 4/77 | 0.00/345.30/1201.69 | 70/77 | 0.00/75.90/960.00 | 0.00/668.70/1357.50 | 61/77 | 17/77 |
| build-active/1600 | 1/100 | 0.00/103.05/156.06 | 56/100 | 0.00/0.00/0.00 | 0.00/103.05/156.06 | 56/100 | 44/100 |
| build-active/1600 | 2/95 | 0.00/144.25/244.47 | 55/95 | 0.00/32.97/170.23 | 0.00/144.25/414.70 | 54/95 | 43/95 |
| build-active/1600 | 3/76 | 0.00/30.22/413.40 | 67/76 | 0.00/38.67/81.74 | 0.00/59.80/413.40 | 62/76 | 17/76 |
| build-active/1600 | 4/76 | 0.00/19.05/924.00 | 70/76 | 0.00/33.75/372.76 | 0.00/56.25/924.00 | 66/76 | 17/76 |

全体、胜局和死亡时长（秒；各条件子集分别标明，不能将胜局尾部分布当全部运行分布）：

| 策略/宽度 | 全体 n/p50/p95/max | 胜局 n/p50/p95/max | 死亡 n/p50/p95/max |
| --- | ---: | ---: | ---: |
| random-auto/450 | 100/77.11/244.08/299.64 | 28/230.46/287.41/299.64 | 72/67.82/102.35/136.95 |
| random-auto/1600 | 100/96.89/257.29/324.93 | 20/227.30/275.79/324.93 | 80/93.64/139.05/162.28 |
| build-auto/450 | 100/213.31/252.67/366.30 | 77/217.43/255.73/366.30 | 23/76.84/134.40/136.18 |
| build-auto/1600 | 100/215.90/266.92/343.79 | 79/220.66/280.46/343.79 | 21/105.13/120.65/139.83 |
| build-active/450 | 100/213.15/270.21/342.16 | 77/217.59/274.93/342.16 | 23/97.13/139.08/140.43 |
| build-active/1600 | 100/213.01/264.62/285.57 | 76/218.97/271.79/285.57 | 24/110.23/133.32/145.51 |

候选逐关时长、Boss到达和通关血量（时长为全部进入者；通关前血量为已清局子集，恢复不抵消压力记录）：

| 策略/宽度 | 关 | 进入/清/Boss到达 | 全进入时长 p50/p95/max | 清关前HP比例 p50/p95 |
| --- | ---: | ---: | ---: | ---: |
| random-auto/450 | 1 | 100/35/100 | 67.66/83.49/97.40 | 0.72/0.96 |
| random-auto/450 | 2 | 35/28/29 | 55.83/69.42/81.40 | 0.95/1.00 |
| random-auto/450 | 3 | 28/28/28 | 53.25/67.09/73.58 | 1.00/1.00 |
| random-auto/450 | 4 | 28/28/28 | 53.93/73.81/80.17 | 1.00/1.00 |
| random-auto/1600 | 1 | 100/67/99 | 74.30/84.32/86.75 | 0.37/0.95 |
| random-auto/1600 | 2 | 67/20/29 | 26.78/77.71/85.75 | 0.98/1.00 |
| random-auto/1600 | 3 | 20/20/20 | 51.79/67.63/82.62 | 1.00/1.00 |
| random-auto/1600 | 4 | 20/20/20 | 53.53/69.68/73.80 | 1.00/1.00 |
| build-auto/450 | 1 | 100/86/100 | 59.22/76.57/84.46 | 0.88/1.00 |
| build-auto/450 | 2 | 86/77/82 | 54.84/68.95/80.19 | 1.00/1.00 |
| build-auto/450 | 3 | 77/77/77 | 51.44/62.56/100.26 | 1.00/1.00 |
| build-auto/450 | 4 | 77/77/77 | 55.37/68.30/122.58 | 1.00/1.00 |
| build-auto/1600 | 1 | 100/99/100 | 58.42/82.78/87.19 | 0.84/1.00 |
| build-auto/1600 | 2 | 99/79/82 | 53.38/80.68/103.55 | 1.00/1.00 |
| build-auto/1600 | 3 | 79/79/79 | 52.62/68.20/88.21 | 1.00/1.00 |
| build-auto/1600 | 4 | 79/79/79 | 55.49/69.92/102.22 | 1.00/1.00 |
| build-active/450 | 1 | 100/89/100 | 59.03/78.61/82.01 | 0.88/1.00 |
| build-active/450 | 2 | 89/77/85 | 55.07/70.94/79.29 | 1.00/1.00 |
| build-active/450 | 3 | 77/77/77 | 51.44/70.87/93.98 | 1.00/1.00 |
| build-active/450 | 4 | 77/77/77 | 55.49/76.36/104.37 | 1.00/1.00 |
| build-active/1600 | 1 | 100/95/100 | 58.42/90.48/97.12 | 0.89/1.00 |
| build-active/1600 | 2 | 95/76/80 | 53.71/70.34/88.39 | 1.00/1.00 |
| build-active/1600 | 3 | 76/76/76 | 52.12/60.26/75.32 | 1.00/1.00 |
| build-active/1600 | 4 | 76/76/76 | 55.47/67.22/79.01 | 1.00/1.00 |

相对V4的全部共同胜局增慢记录（不截断；JSON另保留全部600配对）：
- {"cell":"selection-build-auto-portrait","seed":4036502962,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":235.18333333328377,"v5Seconds":254.62499999993275,"bothWin":true,"deltaSecondsBothWin":19.441666666648985,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":3176762491,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":234.52499999995104,"v5Seconds":249.2666666666043,"bothWin":true,"deltaSecondsBothWin":14.74166666665326,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-random-auto-portrait","seed":3260729948,"strategy":"random-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":229.2083333332892,"v5Seconds":243.80833333327593,"bothWin":true,"deltaSecondsBothWin":14.599999999986721,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":939868294,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":225.9416666666255,"v5Seconds":240.09166666661264,"bothWin":true,"deltaSecondsBothWin":14.14999999998713,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":939868294,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":225.9749999999588,"v5Seconds":240.09166666661264,"bothWin":true,"deltaSecondsBothWin":14.116666666653828,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":2536325632,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":214.04166666663633,"v5Seconds":228.03333333329027,"bothWin":true,"deltaSecondsBothWin":13.991666666653941,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":3314983253,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":226.10833333329202,"v5Seconds":240.09166666661264,"bothWin":true,"deltaSecondsBothWin":13.983333333320616,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":2536325632,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":214.5499999999692,"v5Seconds":228.03333333329027,"bothWin":true,"deltaSecondsBothWin":13.48333333332107,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-random-auto-desktop","seed":3682834787,"strategy":"random-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":212.88333333330405,"v5Seconds":225.89999999995888,"bothWin":true,"deltaSecondsBothWin":13.016666666654828,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":3314983253,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":227.99999999995697,"v5Seconds":240.14999999994592,"bothWin":true,"deltaSecondsBothWin":12.14999999998895,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":13895363,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":206.24999999997675,"v5Seconds":216.09166666663447,"bothWin":true,"deltaSecondsBothWin":9.841666666657716,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":13895363,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":206.24999999997675,"v5Seconds":216.0666666666345,"bothWin":true,"deltaSecondsBothWin":9.816666666657738,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":1415047739,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":222.56666666662858,"v5Seconds":230.31666666662153,"bothWin":true,"deltaSecondsBothWin":7.749999999992951,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":1522565275,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":224.59999999996006,"v5Seconds":231.5083333332871,"bothWin":true,"deltaSecondsBothWin":6.90833333332705,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":3190054314,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":230.9833333332876,"v5Seconds":237.4583333332817,"bothWin":true,"deltaSecondsBothWin":6.474999999994111,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":3059965010,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":225.94999999995883,"v5Seconds":231.80833333328684,"bothWin":true,"deltaSecondsBothWin":5.858333333328005,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":3755622495,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":224.99166666662637,"v5Seconds":230.59166666662128,"bothWin":true,"deltaSecondsBothWin":5.599999999994907,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":3059965010,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":226.22499999995858,"v5Seconds":231.7666666666202,"bothWin":true,"deltaSecondsBothWin":5.5416666666616266,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":3631070021,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":214.79999999996897,"v5Seconds":219.99999999996425,"bothWin":true,"deltaSecondsBothWin":5.199999999995271,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":300208060,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":261.1499999999268,"v5Seconds":266.33333333325544,"bothWin":true,"deltaSecondsBothWin":5.183333333328619,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":947461381,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":207.44999999997566,"v5Seconds":212.36666666663785,"bothWin":true,"deltaSecondsBothWin":4.916666666662195,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":947461381,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":207.44999999997566,"v5Seconds":212.36666666663785,"bothWin":true,"deltaSecondsBothWin":4.916666666662195,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":3459782343,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":273.35833333324905,"v5Seconds":278.0249999999115,"bothWin":true,"deltaSecondsBothWin":4.666666666662422,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":1683842690,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":218.29166666663247,"v5Seconds":222.78333333329505,"bothWin":true,"deltaSecondsBothWin":4.4916666666625815,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":1683842690,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":218.28333333329914,"v5Seconds":222.56666666662858,"bothWin":true,"deltaSecondsBothWin":4.283333333329438,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":404998562,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":205.44999999997748,"v5Seconds":209.5666666666404,"bothWin":true,"deltaSecondsBothWin":4.116666666662923,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":404998562,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":205.50833333331076,"v5Seconds":209.5666666666404,"bothWin":true,"deltaSecondsBothWin":4.058333333329642,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":3190054314,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":231.67499999995363,"v5Seconds":235.20833333328375,"bothWin":true,"deltaSecondsBothWin":3.53333333333012,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":823816499,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":237.37499999994844,"v5Seconds":240.87499999994526,"bothWin":true,"deltaSecondsBothWin":3.4999999999968168,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":1041096425,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":211.59166666663856,"v5Seconds":214.69999999996907,"bothWin":true,"deltaSecondsBothWin":3.1083333333305063,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":184701048,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":210.68333333330605,"v5Seconds":213.79166666663656,"bothWin":true,"deltaSecondsBothWin":3.1083333333305063,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":3260729948,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":221.97499999996245,"v5Seconds":225.08333333329296,"bothWin":true,"deltaSecondsBothWin":3.1083333333305063,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":2267440289,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":214.60833333330248,"v5Seconds":217.5916666666331,"bothWin":true,"deltaSecondsBothWin":2.98333333333062,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":2267440289,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":214.60833333330248,"v5Seconds":217.5916666666331,"bothWin":true,"deltaSecondsBothWin":2.98333333333062,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":3748993695,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":217.8166666666329,"v5Seconds":220.65833333329698,"bothWin":true,"deltaSecondsBothWin":2.841666666664082,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-random-auto-portrait","seed":3610644521,"strategy":"random-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":227.08333333329114,"v5Seconds":229.8499999999553,"bothWin":true,"deltaSecondsBothWin":2.7666666666641504,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-random-auto-desktop","seed":3999029063,"strategy":"random-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":240.6916666666121,"v5Seconds":243.349999999943,"bothWin":true,"deltaSecondsBothWin":2.6583333333309156,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":1522565275,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":206.04999999997693,"v5Seconds":208.6916666666412,"bothWin":true,"deltaSecondsBothWin":2.641666666664264,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":1522565275,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":206.0749999999769,"v5Seconds":208.6916666666412,"bothWin":true,"deltaSecondsBothWin":2.616666666664287,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":318288313,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":239.2333333332801,"v5Seconds":241.78333333327777,"bothWin":true,"deltaSecondsBothWin":2.549999999997681,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":3182306692,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":206.43333333330992,"v5Seconds":208.77499999997445,"bothWin":true,"deltaSecondsBothWin":2.341666666664537,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":3182306692,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":206.43333333330992,"v5Seconds":208.77499999997445,"bothWin":true,"deltaSecondsBothWin":2.341666666664537,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":3057963394,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":235.43333333328354,"v5Seconds":237.66666666661484,"bothWin":true,"deltaSecondsBothWin":2.233333333331302,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":3057963394,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":235.43333333328354,"v5Seconds":237.66666666661484,"bothWin":true,"deltaSecondsBothWin":2.233333333331302,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":406919480,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":255.81666666659834,"v5Seconds":257.95833333326306,"bothWin":true,"deltaSecondsBothWin":2.141666666664719,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":3459782343,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":230.89999999995433,"v5Seconds":233.00833333328575,"bothWin":true,"deltaSecondsBothWin":2.108333333331416,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":3755622495,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":225.23333333329282,"v5Seconds":226.89166666662464,"bothWin":true,"deltaSecondsBothWin":1.658333333331825,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":1365816041,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":221.42499999996295,"v5Seconds":223.01666666662817,"bothWin":true,"deltaSecondsBothWin":1.591666666665219,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":2457051956,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":263.26666666659156,"v5Seconds":264.7666666665902,"bothWin":true,"deltaSecondsBothWin":1.4999999999986358,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-random-auto-portrait","seed":1697619556,"strategy":"random-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":230.22499999995495,"v5Seconds":231.4999999999538,"bothWin":true,"deltaSecondsBothWin":1.2749999999988404,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":3054558489,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":211.9249999999716,"v5Seconds":213.13333333330382,"bothWin":true,"deltaSecondsBothWin":1.2083333333322344,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":3054558489,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":211.9249999999716,"v5Seconds":213.13333333330382,"bothWin":true,"deltaSecondsBothWin":1.2083333333322344,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":404998562,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":206.3666666666433,"v5Seconds":207.56666666664222,"bothWin":true,"deltaSecondsBothWin":1.1999999999989086,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":404998562,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":206.37499999997664,"v5Seconds":207.56666666664222,"bothWin":true,"deltaSecondsBothWin":1.1916666666655829,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":2498284726,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":206.0416666666436,"v5Seconds":206.99166666664274,"bothWin":true,"deltaSecondsBothWin":0.949999999999136,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":2498284726,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":206.0416666666436,"v5Seconds":206.99166666664274,"bothWin":true,"deltaSecondsBothWin":0.949999999999136,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":1474201129,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":208.6916666666412,"v5Seconds":209.633333333307,"bothWin":true,"deltaSecondsBothWin":0.9416666666658102,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":2398684595,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":272.7916666665829,"v5Seconds":273.68333333324875,"bothWin":true,"deltaSecondsBothWin":0.8916666666658557,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":184701048,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":210.54999999997284,"v5Seconds":211.3166666666388,"bothWin":true,"deltaSecondsBothWin":0.7666666666659694,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":553415033,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":250.58333333326976,"v5Seconds":251.26666666660248,"bothWin":true,"deltaSecondsBothWin":0.6833333333327118,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":553415033,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":250.5666666666031,"v5Seconds":251.19999999993587,"bothWin":true,"deltaSecondsBothWin":0.6333333333327573,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":3794691057,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":237.77499999994808,"v5Seconds":238.34166666661423,"bothWin":true,"deltaSecondsBothWin":0.5666666666661513,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":1522565275,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":233.06666666661903,"v5Seconds":233.59166666661855,"bothWin":true,"deltaSecondsBothWin":0.5249999999995225,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-portrait","seed":1909972809,"strategy":"build-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":223.01666666662817,"v5Seconds":223.32499999996122,"bothWin":true,"deltaSecondsBothWin":0.3083333333330529,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-portrait","seed":1909972809,"strategy":"build-active","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":223.07499999996145,"v5Seconds":223.32499999996122,"bothWin":true,"deltaSecondsBothWin":0.24999999999977263,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":3353825173,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":202.95833333331308,"v5Seconds":203.14999999997957,"bothWin":true,"deltaSecondsBothWin":0.19166666666649235,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":3353825173,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":202.95833333331308,"v5Seconds":203.14999999997957,"bothWin":true,"deltaSecondsBothWin":0.19166666666649235,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-auto-desktop","seed":4186552558,"strategy":"build-auto","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":205.69166666664393,"v5Seconds":205.84999999997711,"bothWin":true,"deltaSecondsBothWin":0.15833333333318933,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-random-auto-portrait","seed":2451194854,"strategy":"random-auto","width":450,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":231.3749999999539,"v5Seconds":231.49166666662046,"bothWin":true,"deltaSecondsBothWin":0.11666666666656056,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":4186552558,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":205.79166666664383,"v5Seconds":205.84999999997711,"bothWin":true,"deltaSecondsBothWin":0.05833333333328028,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}
- {"cell":"selection-build-active-desktop","seed":1909972809,"strategy":"build-active","width":1600,"v4Termination":"campaign_victory","v5Termination":"campaign_victory","v4Seconds":207.70833333330876,"v5Seconds":207.71666666664208,"bothWin":true,"deltaSecondsBothWin":0.008333333333325754,"rescued":false,"lostWin":false,"v5DeathStage":null,"v5FatalSource":null}

右删失检查：全部1200局为正常战役胜利或死亡；各关rightCensoredAtTarget均为0。Boss与Boss后清理时长只包含真实击杀/已清的局，不能据此外推未进入者或未测无尽。

来源（字节SHA256，之后补充须另建annex，不覆盖本审计）：
- strict: /root/Clouds/destiny-echo-web/.worktrees/stage-balance-calibration/artifacts/balance/calibration-selection-v5-evidence.json，SHA256 64aae05034f7ebe9cc1e1d531360f72fa64e1b7ba1bedfd8f9bcd48a627fa3f5。
- base: /tmp/destiny-calibration-selection-v5-analysis.json，SHA256 e4b3900dff2b912d82f1968210bb075eacfe72808858927e194475f6be5453e4。
- pressure: /tmp/destiny-calibration-selection-v5-pressure.json，SHA256 ed38e216c3bcf87bb55491f03aabacaad484a60a0e84fd1796e7f9eb3bf8e8cd。
- cross: /tmp/destiny-calibration-v5-cross-round.json，SHA256 ea3796b331e115f32cfb9b9518e1a500e99822989924c63292d7bae23669052f。
- crossComplete: /tmp/destiny-calibration-v5-cross-round-complete-pairs.json，SHA256 92333010ff7fde69c390928034a57ae1e55c728c027ccc453cb0c74c76f2931e。
- judgment: /tmp/destiny-calibration-selection-v5-judgment.json，SHA256 4fa40ef3c25081ec2af2fbbab60d5a3fd1bb50a960908c0ac129bbe025a3947c。
