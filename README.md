# 命运残响 · Echoes of Destiny

**运行于桌面与移动浏览器的原创固定阵地防守 Roguelike。首发主题：圣杯失控中 / Grail Gone Rogue。**

> 每一场命运的轮回，都可能出现意料之外的展开。

战机固定在战场底部，自动索敌，也可点选优先目标。在敌人抵达防线并完成蓄力前消灭威胁，击破金色宝箱，从三张卡牌中选择强化，最后迎战失控圣杯。严肃的幻想氛围下，祷言可以分岔，圣杯可以续杯。每局强化独立，死亡或胜利后都能重新开始。

**当前状态：固定阵地战斗规则迭代。** 使用原创程序化几何美术，无登录、数据库或后端 API。可玩性、操作手感和稳定性优先于内容数量；原创角色、异常事件、互联网梗与更多荒诞组合将在后续扩展。

## 技术选择

2026-10-20 验证仓库锁定版本，在 Ubuntu 24.04.4 / Linux ARM64 上开发和验证：

| 工具 | 实际版本 | 用途 |
| --- | --- | --- |
| Bun | **1.4.3** | 开发工具运行时、依赖管理、单元测试 |
| TypeScript | 7.0.2 | strict 类型检查 |
| Vite | 8.3.4 | 开发、构建、本地静态预览 |
| Phaser | **4.2.1** | WebGL、场景、缩放、精灵渲染 |
| Biome | 2.5.15 | 代码规范与格式化 |
| Playwright Test | 1.64.1 | 浏览器交互与静态产物验证 |
| Cloudflare CLI / Wrangler | 1.0.0-beta.17 / 4.151.0 | Workers 发布与静态资源打包 |
| Node.js | 24.16.0 | Cloudflare 部署工具所需的运行时 |

依赖由 `bun.lock` 锁定；游戏与前端构建工具使用稳定版，Cloudflare CLI 当前为固定版本的 beta。`engines.bun` 要求 `>=1.4.3`，不设置未来主版本上限；`packageManager` 记录本次验证版本。升级稳定 Bun 后需重新运行检查。Bun 只运行开发工具，浏览器代码不依赖 Bun 服务端 API。前端 JS CLI 使用 `bunx --bun`；Cloudflare 的配置加载器暂不支持 Bun，部署命令由工具自身的 Node.js 启动器运行，需要 Node.js `>=22.18.0`，不影响游戏构建与运行。

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

- **固定阵地：** 战机始终保持在逻辑坐标 `(225, 736)`，WASD、方向键和拖动均不移动。生命、护盾和受击后的短暂无敌仍然有效。
- **自动索敌：** 蓝色弹幕追踪横向移动的敌人与宝箱。默认优先 Boss、准备／攻击阶段的敌人，其次是危险区域内的推进敌人、宝箱和其余敌人；同一优先级保持锁定，目标死亡或消失后自动重选。
- **点选目标：** 鼠标或触屏点击敌人／宝箱可设为优先目标，金色标识表示手动锁定；点击空白取消。自动攻击不需要连点。聚焦战场后可用 `T` 切换目标、`C` 恢复自动，Tab 保留正常焦点行为。
- **防线：** 敌人推进时不攻击。抵达底部金色交战区域后停止，金环蓄力完成才进入红环攻击阶段。先击杀可阻止释放；已经发射的粉色弹幕仍然危险。两排七列停驻点限制堆叠，最多 14 个敌人。
- **奖励：** 击破非中央金色宝箱后，全部战斗与计时冻结，从三张不同且有效的卡牌中选一张。名称、强化预览与层数均可查看。
- **暂停：** 右上角按钮或 Esc / P；进入后台或失去焦点会暂停，回来后手动继续，不能跳过奖励。
- **终局：** 第 52 秒 Boss 从上方推进，约六秒后抵达防线，再准备两秒。金色连线与进度条表示特殊蓄力：两秒内造成 90 伤害可打断，半血后改为 1.7 秒内 120 伤害。集中火力和构筑可以反制，护盾／生命帮助承伤。88 秒前击败它获胜；生命耗尽或超时失败。目标为 60–90 秒战斗，早期死亡可提前结束，暂停与选牌不计时。
- **重开：** 结算后「再次共鸣」恢复固定位置、初始生命与火力，清除所有目标、卡牌、敌人、攻击状态、奖励和得分。没有跨局存档。

| 卡牌 | 即时生效的强化 | 叠加上限 |
| --- | --- | --- |
| 过载刻印 | 弹幕伤害 +4 | 无固定层数上限，受单局奖励数量限制 |
| 急速咏唱 | 攻击间隔 ×0.88，最低 0.13s | 6 层 |
| 分岔祷言 | 每轮增加一道副弹，主弹 60% 伤害，优先分配其他目标 | 4 层，最多 5 枚 |
| 因果贯穿 | 额外穿透 +1 个目标，同一弹幕不重复伤害同一目标 | 3 层 |
| 续杯仪式 | 最大生命 +20，恢复 30 生命 | 无固定层数上限 |
| 防线裁决 | 对 `Attacking` 敌人额外伤害 +20%，推进／准备阶段不生效 | 3 层，最多 +60% |
| 守夜契约 | 护盾 +24，优先吸收伤害 | 无固定层数上限 |

达到上限的卡牌不再进入候选，始终保留至少三种可选卡牌。奖励只能领取一次，多枚弹幕同时击中或连续点击不会重复发放。

## 已实现与路线图

- [x] 游戏页面、原创几何场景、HUD、暂停、胜负结算与重开。
- [x] 固定阵地、稳定自动索敌、鼠标／触屏优先目标、两种普通敌人与防线攻防阶段。
- [x] 可打断蓄力、半血强化的 Boss，真实弹幕伤害、渐进波次与完整胜负循环。
- [x] 可攻击宝箱、三选一奖励、7 种叠加强化、局内构筑展示。
- [x] Menu / Playing / Paused / RewardSelection / Victory / GameOver 状态和后台暂停。
- [x] 固定时间步进、扫掠碰撞、无敌时间、有界对象复用。
- [x] 手机竖屏布局、画布缩放、触屏点选、高 DPR 开销限制、安全区域与窄屏卡牌。
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
    config.ts             逻辑尺寸、固定阵地、防线、波次与对象预算
    world.ts              实体、自动攻击、波次、奖励与完整对局
    state.ts              可验证的状态转换
    input.ts              触屏／鼠标点选、缩放坐标和键盘切换目标
    pool.ts / random.ts   有界对象复用、局内随机种子
    systems/              索敌、防线阶段、攻击许可、碰撞与伤害
    scenes/               Phaser 场景、程序化纹理
  ui/                     DOM HUD、卡牌、结算与样式
public/                   favicon、字体与第三方许可
tests/unit/              Bun 逻辑测试
tests/browser/           Playwright 桌面、触屏和静态产物验证
docs/architecture.md     状态、奖励、性能与浏览器契约
```

长期规范见 [AGENTS.md](AGENTS.md)，战斗规则与一次性奖励契约见 [架构说明](docs/architecture.md)。

## 验证与已知限制

自动验证覆盖固定位置、30/60/144 Hz 一致性、横向索敌和非中央宝箱、手动锁定与失效恢复、多弹实际伤害、穿透去重、防线抵达／蓄力／重复攻击／死亡取消、未来区域攻击策略、Boss 推进与蓄力打断、七张卡牌、三选一、状态冻结与重开。`tests/unit/run.test.ts` 用正常目标选择和真实候选卡牌验证自然完整对局，不修改生命、输出、时钟或敌人。

本次本地验证结果（2026-10-20）：

| 检查 | 结果 |
| --- | --- |
| `bun run typecheck` / `bun run lint` | 通过 |
| `bun test` | 42 项通过 |
| `bun run build` | 通过 |
| Chromium 桌面（无头软件 WebGL） | 14 项通过，含自然完整胜利／失败与重开 |
| Chromium 触屏 | 3 项通过，412 × 839 / 320 × 568，DPR 2.625 |
| Firefox / WebKit | 各 12 项通过，分别跳过两项重复长局 |

平衡样本使用种子 1–20：每半秒优先宝箱、正常选牌的策略 12 胜／8 负，胜利约 63.2–69.9 秒；同一选牌策略仅用自动索敌时 10 胜／10 负。种子 3 的完整主动策略局约 69.9 秒胜利，有普通敌人攻击、玩家掉血和 Boss 蓄力打断，取得五次宝箱奖励。种子 14 的目标决策可改变胜负。这些是固定策略的回归样本，不代表真实玩家胜率；只堆生存而不补输出仍有失败风险。

浏览器用例分批合计 41 项通过、4 项重复自然长局跳过。页面身份、非空画面、无错误遮罩、应用控制台、截图与实际输入／选牌／结算交互均完成核对。

浏览器插件不可用，改用仓库 Playwright。浏览器测试实际加载 WebGL 并执行点击、原生触屏、暂停、选牌和结算；自然完整局与战斗夹具分别标记，截图和 trace 写入系统临时目录。Firefox／WebKit 使用 Xvfb 与软件 WebGL；Chromium 使用无头软件 WebGL。全项目有界面尝试中，Chromium 的 crashpad 在受限目录启动失败，因此该模式未通过，改用无头配置补验。测试时钟在加载后手动推进，缩放后核对真实画布边界；只读诊断不进入生产构建。

- Phaser 4 依赖 WebGL；不可用时显示恢复提示，不提供 Canvas 降级。图形上下文丢失会停止战斗。
- 桌面居中、手机竖屏优先；小高度窗口允许页面滚动。真实 iOS Safari / Android、温度、电量与长时间性能仍需人工验收。
- 无音频、账户、云服务或持久化；刷新会丢失当前局。
- 首次加载包含 Phaser 引擎，约 1.37 MB minified / 357 KB gzip。弱网和低端机仍需后续优化；静态托管应启用 gzip/Brotli。
- 难度和随机卡牌需要更多玩家调优，未宣称达到商业发行质量或真机全浏览器认证。

## 构建与基础部署

`bun run build` 产出 **`dist/`**。将其完整内容上传到任意静态 HTTPS 托管、CDN 或 VPS 静态文件目录，包括 `assets/`、`fonts/` 和许可文件；无需 Bun 常驻服务。`base: "./"` 支持根路径或子目录部署，必须通过 HTTP(S) 提供文件，不能直接双击 HTML。

`bun run preview` 用于本地验证，不作为公网生产服务器。

### Cloudflare Workers

使用 Workers Static Assets 托管完整静态产物，无 Worker 服务端入口、绑定或应用密钥。`cloudflare.config.ts` 固定目标账户与 Worker 名称；`wrangler.config.ts` 只声明 `dist/` 的打包路径，发布入口统一使用 `cf`。发布其他账户前应修改配置并核对目标。

```sh
bun install --frozen-lockfile
bunx cf auth whoami              # 优先复用当前系统登录
bunx cf auth login --no-browser   # 仅在缺少有效登录时进行设备授权
bun run deploy:check             # 构建并检查发布包，不上传
bun run deploy                   # 重新构建，上传并发布到 workers.dev
```

`build:workers` 先执行现有的类型检查与 Vite 构建，再调用锁定版本的 Wrangler 本地打包器生成 `.cloudflare/output/v0/`；`cf` 以 `--prebuilt` 发布该产物。直接运行 `cf build` 会检测到普通 Vite 并跳过此打包步骤，因此使用仓库脚本。这保留了纯 Vite 的开发／预览方式，不需要引入 Cloudflare Vite 插件。该输出目录与本地认证辅助文件不提交 Git。只有发布工具使用 Node.js，不需要在线运行 Bun 或 Node.js 服务。配置语法与运行时要求见 [Cloudflare 配置文档](https://developers.cloudflare.com/cf/projects/cloudflare-config/)，预构建发布流程见 [cf 部署文档](https://developers.cloudflare.com/cf/projects/#deploy-a-prebuilt-build)。

`public/_headers` 为首页配置重新验证缓存，为带 hash 的 `assets/` 配置一年不可变缓存，并设置内容类型保护与 Referrer Policy。未配置 SPA 回退，缺失资源应返回 404。首次发布后须分别核对首页、JS／字体、缓存响应头和实际浏览器交互；本地构建或 dry run 通过不代表公网验收通过。

## License

项目代码采用 **GNU AGPL v3**，本项目声明为 `AGPL-3.0-only`，详见已有 [LICENSE](LICENSE)；本次未修改或替换许可证。

Phaser 按 MIT 许可分发，构建携带 [第三方声明](public/THIRD_PARTY_NOTICES.txt)。自托管 Noto Serif SC 字体子集使用 [SIL Open Font License 1.1](public/fonts/OFL.txt)。游戏美术是原创程序化几何图形。未来第三方美术和音乐必须单独确认授权，其资源许可与项目代码许可分别记录。

*Echoes of Destiny — 命运可以安排，但这局怎么整活，由你决定。*
