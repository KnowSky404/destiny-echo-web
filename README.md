# 命运残响 · Echoes of Destiny

**运行于桌面与移动浏览器的原创弹幕射击 Roguelike。首发主题：圣杯失控中 / Grail Gone Rogue。**

> 每一场命运的轮回，都可能出现意料之外的展开。

在战场底部躲避弹幕，自动攻击敌潮，击破金色宝箱，从三张卡牌中选择强化，最后迎战失控圣杯。严肃的幻想氛围下，祷言可以分岔，圣杯可以续杯。每局强化独立，死亡或胜利后都能重新开始。

**当前状态：首个可玩 MVP。** 使用原创程序化几何美术，无登录、数据库或后端 API。可玩性、操作手感和稳定性优先于内容数量；原创角色、异常事件、互联网梗与更多荒诞组合将在后续扩展。

## 技术选择

2026-10-19 核验稳定版本，在 Ubuntu 24.04.4 / Linux ARM64 上开发和验证：

| 工具 | 实际版本 | 用途 |
| --- | --- | --- |
| Bun | **1.4.3** | 开发工具运行时、依赖管理、单元测试 |
| TypeScript | 7.0.2 | strict 类型检查 |
| Vite | 8.3.4 | 开发、构建、本地静态预览 |
| Phaser | **4.2.1** | WebGL、场景、缩放、精灵渲染 |
| Biome | 2.5.15 | 代码规范与格式化 |
| Playwright Test | 1.64.1 | 浏览器交互与静态产物验证 |

依赖由 `bun.lock` 锁定，未采用预发布版。`engines.bun` 要求 `>=1.4.3`，不设置未来主版本上限；`packageManager` 记录本次验证版本。升级稳定 Bun 后需重新运行检查。Bun 只运行开发工具，浏览器代码不依赖 Bun 服务端 API。JS CLI 均使用 `bunx --bun`，无需 Node.js 开发工作流。

| 方案 | 手机兼容与弹幕渲染 | 碰撞、维护与扩展 |
| --- | --- | --- |
| **A. Phaser 4 + TS + Vite（采用）** | WebGL 批处理、精灵、输入和缩放基础完整 | 引擎有游戏场景和物理基础；本项目将弹幕碰撞独立为可测试规则，扩展武器和首领成本适中 |
| B. PixiJS + 自建逻辑 | 高效 WebGL / WebGPU 渲染与指针事件 | 渲染控制灵活，需补充游戏状态、波次与碰撞系统 |
| C. 原生 Canvas 2D + TS | API 广泛可用，小规模足够；大量弹幕需要自行优化 | 依赖最少，场景、碰撞、输入缩放和资源管理都需维护，长期成本较高 |

维护成本是本项目的工程判断，不是性能基准。采用原生 HTML/CSS 实现菜单、HUD、卡牌和结算，无 React/Vue 等 UI 框架。API 经 Context7 和安装包类型核对；参考 [Bun 1.4.3](https://bun.com/blog/bun-v1.4.3)、[Phaser 4 发布列表](https://phaser.io/download/phaser4)、[Phaser 文档](https://docs.phaser.io/)、[PixiJS 文档](https://pixijs.com/8.x/guides/getting-started/intro)。

## 安装与运行

安装 [Bun 稳定版](https://bun.com/docs/installation)，在仓库根目录执行：

```sh
bun --version
bun install --frozen-lockfile
bun run dev
```

开发服务默认监听 `127.0.0.1:5173`，预览监听 `127.0.0.1:4173`。在本机浏览器打开相应端口。VPS 开发通过已有受保护代理或 SSH 隧道访问，例如在自己的电脑执行：

```sh
ssh -N -L 5173:127.0.0.1:5173 root@oc-de-fra-1.knowsky.uk
```

随后在本地浏览器访问映射后的 5173 端口。不要将 Vite 开发服务器直接暴露到公网。项目不会修改防火墙、代理、DNS 或生产配置。

```sh
bun run typecheck   # strict 类型检查，包括测试代码
bun run lint        # Biome 检查
bun run format      # 格式化及安全修复
bun test            # Bun 核心逻辑测试
bun run build       # 类型检查 + 生产构建
bun run preview     # 本机预览 dist/
```

浏览器验证需要安装匹配版本的 Playwright 浏览器：

```sh
bunx --bun playwright install chromium firefox webkit
bun run build
bun run test:browser
```

Linux 缺少图形库时按 Playwright 的依赖提示处理。无图形设备的环境可能无法启动 Firefox / WebKit 的 WebGL，可在支持 Mesa 的环境使用虚拟显示执行有界面测试；也可先运行 `bun run test:browser --project=chromium --project=mobile-chromium`。浏览器可通过 `PLAYWRIGHT_BROWSERS_PATH` 安装到可写缓存。测试服务器由 Playwright 启停，只监听回环地址；截图、失败 trace 和结果写入系统临时目录。

本 VPS 的 Firefox / WebKit 使用以下方式访问软件 WebGL：

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/destiny-echo-browsers LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 xvfb-run -a bun run test:browser --project=firefox --project=webkit --headed
```

自定义缓存路径须与安装浏览器时一致；其他机器可使用默认浏览器缓存并省略该变量。

## 基本玩法

- **移动：** WASD / 方向键；手机触屏或鼠标按住战场拖动。相对拖动避免跳到触点，活动区域为底部 28%，可通过 `src/game/config.ts` 调整。角色中心白色亮点是实际受击点。
- **攻击：** 持续自动向上发射弹幕，无需点击。移动到敌人或金色宝箱下方即可攻击。
- **奖励：** 击破宝箱后战斗和计时停止，从三张不同卡牌中选一张。名称、强化数值和已收集层数均可查看。
- **暂停：** 右上角按钮或 Esc / P；进入后台或失去焦点会暂停，回来后手动继续；不能跳过奖励。
- **终局：** 第 52 秒 Boss 登场，使用瞄准扇形、环形弹幕和带金色预警的纵向攻击。88 秒前击败圣杯即胜利；生命耗尽或仪式超时则失败。目标为约 60–90 秒战斗时间，早期死亡可提前结束，暂停与选牌不计时。
- **重开：** 结算后「再次共鸣」，生命、卡牌、计时、敌人和得分全部重置。没有跨局存档。

| 卡牌 | 即时生效的强化 | 叠加上限 |
| --- | --- | --- |
| 过载刻印 | 弹幕伤害 +4 | 无固定层数上限，受单局奖励数量限制 |
| 急速咏唱 | 攻击间隔 ×0.88，最低 0.13s | 6 层 |
| 分岔祷言 | 每次发射弹幕 +1 | 4 层，最多 5 枚 |
| 因果贯穿 | 额外穿透 +1 个目标，同一弹幕不重复伤害同一目标 | 3 层 |
| 续杯仪式 | 最大生命 +20，恢复 30 生命 | 无固定层数上限 |
| 星轨偏移 | 移速 +30 | 4 层，最高 380 |
| 守夜契约 | 护盾 +24，优先吸收伤害 | 无固定层数上限 |

达到上限的卡牌不再进入候选，始终保留至少三种可选卡牌。奖励只能领取一次，多枚弹幕同时击中或连续点击不会重复发放。

## 已实现与路线图

- [x] 游戏页面、原创几何场景、HUD、暂停、胜负结算与重开。
- [x] 底部移动、自动射击、两种普通敌人、敌方弹幕、渐进波次和带特殊攻击的 Boss。
- [x] 可攻击宝箱、三选一奖励、7 种叠加强化、局内构筑展示。
- [x] Menu / Playing / Paused / RewardSelection / Victory / GameOver 状态和后台暂停。
- [x] 固定时间步进、扫掠碰撞、无敌时间、有界对象复用。
- [x] 手机竖屏布局、画布缩放、触屏拖动、高 DPR 开销限制、安全区域与窄屏卡牌。
- [ ] 更多武器、原创角色、协同流派、异常事件和难度选项。
- [ ] 经验升级、跨局进度、排行榜或存档（本次不包含）。
- [ ] 原创音乐/音效、正式角色美术、更多首领与剧情。
- [ ] 真机长时间性能与操控调优、正式静态站点发布。

继续遵循浏览器优先、跨设备、玩法优先、模块化、数据驱动与原创资源六项原则。只将已有实现标记为完成；浏览器模拟不等于真机验收。

## 核心目录

```text
src/
  main.ts                 浏览器入口、WebGL 检测与错误恢复
  data/                   卡牌定义与效果、敌人参数
  game/
    config.ts             逻辑尺寸、活动区域、波次与对象预算
    world.ts              实体、自动攻击、波次、奖励与完整对局
    state.ts              可验证的状态转换
    input.ts              键盘、触屏与鼠标坐标转换
    pool.ts / random.ts   有界对象复用、局内随机种子
    systems/              移动、碰撞与伤害
    scenes/               Phaser 场景、程序化纹理
  ui/                     DOM HUD、卡牌、结算与样式
public/                   favicon、字体与第三方许可
tests/unit/              Bun 逻辑测试
tests/browser/           Playwright 桌面、触屏和静态产物验证
docs/architecture.md     状态、奖励、性能与浏览器契约
```

长期规范见 [AGENTS.md](AGENTS.md)，战斗规则与一次性奖励契约见 [架构说明](docs/architecture.md)。

## 验证与已知限制

自动验证覆盖移动边界、30/60/144 Hz 一致性、伤害/护盾、穿透、卡牌效果和叠加上限、三张不同奖励、防重领、状态转换与重开清理。浏览器测试实际加载 WebGL，执行键盘/拖动、暂停、宝箱选牌、完整结算和重开，并验证静态产物。

本次本地验证结果（2026-10-19，分批执行并复验修复后的场景）：

| 检查 | 结果 |
| --- | --- |
| `bun run typecheck` / `bun run lint` | 通过 |
| `bun test` | 21 项通过 |
| `bun run build` | 通过，静态预览加载成功 |
| Chromium 桌面 | 9 项通过 |
| Chromium 触屏 | 2 项通过，412 × 839 / 320 × 568，DPR 2.625 |
| Firefox / WebKit | 各 8 项通过、1 项重复长局跳过 |
| 默认 dev / preview 命令 | 页面 HTTP 200，仅监听回环地址 |

浏览器插件不可用，使用 Playwright；Firefox / WebKit 在 Xvfb 与软件 WebGL 下验证。完整未修改规则的胜利局由 Bun 仿真回归验证，种子 1337 约 61 秒获胜；浏览器完整自然局覆盖失败与重开，另用接近被击败的 Boss 场景验证真实射击触发胜利、计分和重开。测试时钟在加载后手动推进，缩放后先核对画布实际边界。浏览器验证也覆盖失焦与暂停点击竞态、跨 HUD 刷新长按按钮，以及恢复后立即移动。

- Phaser 4 依赖 WebGL；不可用时显示恢复提示，不提供 Canvas 降级。图形上下文丢失会停止战斗。
- 桌面居中、手机竖屏优先；小高度窗口允许页面滚动。真实 iOS Safari / Android、温度、电量与长时间性能仍需人工验收。
- 无音频、账户、云服务或持久化；刷新会丢失当前局。
- 首次加载包含 Phaser 引擎，约 1.37 MB minified / 357 KB gzip。弱网和低端机仍需后续优化；静态托管应启用 gzip/Brotli。
- 难度和随机卡牌需要更多玩家调优，未宣称达到商业发行质量或真机全浏览器认证。

## 构建与基础部署

`bun run build` 产出 **`dist/`**。将其完整内容上传到任意静态 HTTPS 托管、CDN 或 VPS 静态文件目录，包括 `assets/`、`fonts/` 和许可文件；无需 Bun 常驻服务。`base: "./"` 支持根路径或子目录部署，必须通过 HTTP(S) 提供文件，不能直接双击 HTML。

`bun run preview` 用于本地验证，不作为公网生产服务器。正式托管建议 HTML 不长期缓存、带 hash 的 `assets/` 长期缓存，并开启压缩。本任务未自动推送远程或修改生产配置。

## License

项目代码采用 **GNU AGPL v3**，本项目声明为 `AGPL-3.0-only`，详见已有 [LICENSE](LICENSE)；本次未修改或替换许可证。

Phaser 按 MIT 许可分发，构建携带 [第三方声明](public/THIRD_PARTY_NOTICES.txt)。自托管 Noto Serif SC 字体子集使用 [SIL Open Font License 1.1](public/fonts/OFL.txt)。游戏美术是原创程序化几何图形。未来第三方美术和音乐必须单独确认授权，其资源许可与项目代码许可分别记录。

*Echoes of Destiny — 命运可以安排，但这局怎么整活，由你决定。*
