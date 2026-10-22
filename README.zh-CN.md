<p align="center">
  <img src="docs/assets/brand/echoes-mark-v2.svg" width="160" alt="命运残响 Logo">
</p>
<h1 align="center">命运残响 · Echoes of Destiny</h1>
<p align="center"><em>在残响中，改写命运。</em></p>
<p align="center"><a href="README.md">English</a> · 简体中文</p>
<p align="center">
  <a href="https://destiny-echo-web.littlecontrol.workers.dev/">在线游玩</a> ·
  <a href="https://destiny-echo-web-pre.littlecontrol.workers.dev/">预览版 PRE</a> ·
  <a href="https://github.com/KnowSky404/destiny-echo-web/wiki/Home-zh-CN">中文 Wiki</a> ·
  <a href="https://github.com/KnowSky404/destiny-echo-web/wiki/Changelog-zh-CN">版本日志</a>
</p>

面向桌面与触屏的浏览器阵地防守 Roguelike。固定站位、自动射击、点选目标，通过 **51 张残响、12 条流派、8 项锻体**构筑本局能力。突破四关后，保留构筑挑战无尽。

## 核心玩法

- 点击或点按敌人与宝箱集中火力，战机无需移动。
- 每次选择一项奖励，选牌时战斗暂停；同流派达到 3 / 6 / 9 层激活羁绊。
- 击败首领并清空残敌才能过关；重新开始清空本局进度。

游戏支持**简体中文和英文**，点击顶部 **English / 中文** 切换；默认中文，可用本地存储时记住选择。切换语言保留当前战斗与奖励选项。需要 WebGL，没有账户或战斗存档。

## 开发

需要 **Bun 1.4.3 或更新版本**及支持 WebGL 的浏览器。

```sh
bun install --frozen-lockfile
bun run dev
```

本地服务保持 loopback，远程访问使用 SSH 隧道。提交前执行：

```sh
bun run docs:check
bun run typecheck
bun run lint
bun test
bun run build
```

`bun run build` 生成 `dist/`，`bun run build:pre` 生成 `dist-pre/`。PRE 提供仅保存在当前浏览器中的数值实验室。预览与生产分别发布。

操作配图、卡牌、敌人、完整机制、浏览器测试、部署、历史验证与版本日志请查阅 **[中文 Wiki](https://github.com/KnowSky404/destiny-echo-web/wiki/Home-zh-CN)**。离线阅读：[English guide](docs/game-guide/Home.md) · [中文指南](docs/game-guide/Home-zh-CN.md)。贡献流程见 [AGENTS.md](AGENTS.md)。

## 许可

代码采用 [GNU AGPL v3.0 or later](LICENSE)。Phaser 和字体见[第三方声明](public/THIRD_PARTY_NOTICES.txt)。[品牌素材与提示词](docs/assets/brand/README.md)保留文档 Logo 的版本与来源。

## 自动化数值实验

开发专用 [Balance Simulator V1](docs/balance-simulator.md) 在 Bun 中运行真实固定步长 World，直接读取 PRE 导出的方案，提供批量实验、配对比较、单因素扫描、确定性复现及 PRE 人工复核准备；不会自动应用数值或部署。

```sh
bun run balance:simulate --profile official --preset smoke --out artifacts/balance/smoke
bun run balance:simulate --profile official --preset standard --out artifacts/balance/baseline
bun run balance:compare --baseline official --candidate experiments/balance/example-candidate.json --preset smoke --out artifacts/balance/comparison
bun run balance:sweep --experiment experiments/balance/sweep.json --out artifacts/balance/sweep
bun run balance:replay --case artifacts/balance/smoke/cases/death.json
```

每次使用新输出目录。standard 每策略×布局100个种子，每方案600局；数据不等于真人通关率。实际证据见 [基线实验报告](experiments/balance/baseline-report.md)。
