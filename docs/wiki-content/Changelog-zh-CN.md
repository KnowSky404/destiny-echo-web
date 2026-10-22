# 版本日志

## 未发布 — Balance Simulator V1

- 新增直接运行正式 World 的 Bun 固定种子自然对局 CLI，支持策略与逻辑布局分组、JSON/CSV/Markdown 报告、配对比较、有界单因素扫描和确定性单局复现。
- PRE 增加已保存方案导出、实验摘要/case 校验及同方案同种子人工复核准备；人工重开不是策略自动回放，既有草稿和保存版本继续隔离。
- 正式游戏规则与 `src/data/balance/official.json` 未改；候选只保存为独立实验方案，工具不会自动应用、推送或部署数值。
- [使用说明](https://github.com/KnowSky404/destiny-echo-web/blob/main/docs/balance-simulator.md)与[本地验收及基线报告](https://github.com/KnowSky404/destiny-echo-web/blob/main/experiments/balance/baseline-report.md)保留原先仅限本地的验收范围。后续推送、PR 审阅合并、Wiki 同步与 PRE→PRO 发布属于新增授权下的独立交付，不改写原始实验事实。
- 源码：功能提交 `080fab5`，PR/合并提交待核验；发布检查另行记录。Wiki：待发布；PRE：待部署核验；PRO：待同一版本 PRE 验证通过后部署核验。

## 未发布 — 文档与品牌

- README 与 Wiki 默认英文，增加完整简体中文对应页面和语言跳转。
- 完善配图指南、高分辨率版本化截图、可缩放文档 Logo、AI 概念原图及完整提示词。
- 开发、发布和历史验收记录从 README 移至 Wiki。
- 本轮为文档更新：不修改游戏行为、界面语言或游戏美术，不发布 PRE/PRO。

## 后续计划

- **游戏中英文界面：**覆盖菜单、HUD、卡牌、敌人、帮助及无障碍标签，确定语言选择和回退，并验证桌面与触屏两种语言。当前尚未实现。
- 游戏美术和 Logo 的游戏内应用后续与维护者单独讨论。

## 源码变更历史

以下根据合并记录整理，不是虚构的版本号。2026-10-22 建立日志时，仓库尚无 GitHub Release。本轮未重新审计 PRE/PRO 历史部署，提交日期不代表上线日期；实际交付记录见对应提交与 PR。

| 日期 | 源码依据 | 变化 |
| --- | --- | --- |
| 2026-10-22 | [330b433](https://github.com/KnowSky404/destiny-echo-web/commit/330b433)、[PR 9](https://github.com/KnowSky404/destiny-echo-web/pull/9) | 修正无尽攻击格增长，保证至少 30% 成功出生小怪进入已开放攻击区 |
| 2026-10-22 | [adad790](https://github.com/KnowSky404/destiny-echo-web/commit/adad790)、[PR 8](https://github.com/KnowSky404/destiny-echo-web/pull/8) | PRE 数值实验室：本地方案、玩家/构筑/敌人编辑、关卡控制、导入导出、冲突保护和版本修复 |
| 2026-10-22 | [189bd35](https://github.com/KnowSky404/destiny-echo-web/commit/189bd35)、[PR 7](https://github.com/KnowSky404/destiny-echo-web/pull/7) | 桌面/手机车道预算，巨人杀手与侵蚀流派，攻击区扩展，中毒/重伤及无尽平衡 |
| 2026-10-22 | [44dbd06](https://github.com/KnowSky404/destiny-echo-web/commit/44dbd06)、[PR 6](https://github.com/KnowSky404/destiny-echo-web/pull/6) | 桌面宽战场、顶部构筑/帮助面板、独立逻辑尺寸、分数锻体 |
| 2026-10-21 | [8f9307e](https://github.com/KnowSky404/destiny-echo-web/commit/8f9307e)、[PR 5](https://github.com/KnowSky404/destiny-echo-web/pull/5) | 人口容量与浓缩、融合、敌人主动技能、护盾联动和混合首领奖励 |
| 2026-10-21 | [d2f6f2b](https://github.com/KnowSky404/destiny-echo-web/commit/d2f6f2b)、[d443d80](https://github.com/KnowSky404/destiny-echo-web/commit/d443d80) | 遗世庇护净化与时停、史诗卡、同步玩家说明 |
| 2026-10-20 | [c380ebc](https://github.com/KnowSky404/destiny-echo-web/commit/c380ebc) | 固定阵地防守与初次静态 Workers 发布基础设施 |

## 后续每次发版模板

在 `docs/wiki-content` 的两种语言源中填写并重新生成；尚未核验发布前保留「未发布」。

```text
## YYYY-MM-DD — vX.Y.Z 或提交 <SHA>
源码：<tag / PR / 不变提交链接>
新增：
调整：
修复：
迁移/兼容：<按需>
验证：<命令、浏览器/设备范围、证据链接>
Wiki：<发布提交或待发布>
PRE：<版本/提交与核验日期，或未部署>
PRO：<版本/提交与核验日期，或未部署>
```

PR 合并、Wiki 更新、游戏部署相互独立。核对实际环境版本后再修改 PRE/PRO 状态，不能复用历史测试数量作为新版本验收证明。
