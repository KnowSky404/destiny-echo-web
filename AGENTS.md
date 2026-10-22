# 开发工作流

## 1. 独立 worktree 与分支

- 所有改动（包括代码、测试、文档、配置及本文件）都必须新建独立 worktree 和工作分支，从最新的 `origin/main` 开始；不要直接在 `main` 上开发，也不要复用其他任务的分支。
- 开始前检查当前分支、工作区、远端和已有 worktree，保留用户及其他任务的修改。不要擅自重置、暂存隐藏、清理或强推这些修改。
- 除非用户明确限制交付范围，默认完成本文件规定的开发、验证、提交、推送、PR、审阅、rebase 合并及清理全过程；无需在每个已授权步骤重复询问。

## 2. 玩法说明与 Wiki 同步

- 涉及玩法设计、战斗规则、卡牌、敌人、流派、奖励、关卡或其他游戏机制时，必须同步更新游戏说明和对应 Wiki 信息。
- 先核对 `scripts/game-guide.ts` 中的人工说明，再运行 `bun run docs:generate`。实现、说明源和生成的 `docs/game-guide/` 必须放在同一个原子提交中，并保持 README、游戏内帮助和相关设计规格一致。仅重新生成文件不能替代语义核对。
- 提交前必须通过 `bun run docs:check` 和下文的必要检查；输入、渲染或响应式行为受影响时，还需按 README 完成相应浏览器验证。
- 玩法 PR 经审阅并合并后，从干净、已验证且与合并结果一致的 `main` 版本运行 `bun run wiki:publish`，核对远端 Wiki 提交和页面。Wiki 同步属于此类改动的默认交付范围；若权限不足或发布失败，应报告原因并与用户确认解决方式，不得宣称同步完成。
- Wiki 是独立仓库，保留自建页面和并发编辑，不强推。Wiki 更新不等于 PRE 或 PRO 已部署。发布细节见 `docs/wiki-publishing.md`。

## 3. 提交、PR 与 Codex 审阅

- 必要验证通过后创建原子的 Conventional Commits 提交，只包含本次任务的文件；推送工作分支，向 `main` 创建 PR。PR 说明应包含改动目的、验证结果，以及适用的游戏说明、Wiki 和部署状态。
- 使用 GitHub CLI 创建或修改 PR 描述、评论时，正文优先写入临时文件并通过 `--body-file` 传入；不要把多行 Markdown 内联到 shell 命令中。
- 如仓库启用了 Codex 机器审阅或本次 PR 已触发审阅，必须等待其完成，并核对 reviews、行内意见、讨论及相关检查。以 PR 当前最新 head SHA 的结果为准；旧提交的通过结果、审阅仍在进行或暂时没有评论，都不算本次审阅通过。
- 对有效审阅问题修复、验证并推送后，等待最新提交重新审阅；未自动触发时，通过仓库已配置的审阅入口请求重新审阅，直到没有未解决的有效问题且所有必要检查通过。对审阅意见有疑问或分歧时，先与用户确认，不擅自忽略。
- 仅在确认仓库未启用且本次 PR 未触发 Codex 审阅时，可在说明此状态后继续流程；无法判断是否启用、审阅不可用或结果不明确时，先与用户确认，不把缺少结果当作通过。

## 4. Rebase 合并与清理

- 审阅及检查通过后，默认直接以 **rebase** 方式合并 PR；不要改用 squash 或 merge commit，也不要绕过仓库保护或必要检查。
- 合并前重新核对 PR 的 head SHA、审阅及检查状态，使用匹配该 SHA 的合并操作，避免合并未经审阅的新提交。GitHub CLI 示例：`gh pr merge <PR> --rebase --match-head-commit <SHA>`。
- 确认远端 PR 已合并并核对 `origin/main` 中的合并结果，再同步本地 `main`（仅快进，不覆盖本地修改）。Rebase 可能改变提交 SHA，应核对实际内容，不能仅凭原分支提交是否为 `main` 的祖先判断是否合并。
- 完成适用的 Wiki 同步后，删除本次任务已经合并的远端和本地分支，并移除对应 worktree。清理前确认 worktree 干净且分支没有审阅后新增、未合并的提交；如有意外变化，保留现场并先与用户确认。不要强制删除含用户文件或其他任务内容的 worktree。
- 交付时报告 PR、合并结果、检查结果、清理状态，以及适用的 Wiki / PRE / PRO 状态；未完成的步骤必须说明实际阻碍。

## 5. Cloudflare 环境与发布边界

| 简称 | 环境 | 独立 Cloudflare Worker | 现有发布脚本 |
| --- | --- | --- | --- |
| PRO | Production，生产环境；默认发布目标 | `destiny-echo-web` | `bun run deploy:pro`（等同 `bun run deploy`） |
| PRE | Preview，预览环境 | `destiny-echo-web-pre` | `bun run deploy:pre` |

- 两个环境的映射由 `cloudflare.config.ts` 定义；PRE 使用 `pre` mode，PRO 使用默认 mode。`bun run preview` 是本地 Vite 预览，不代表 Cloudflare PRE。
- 保持现有项目发布入口：仓库脚本使用锁定版本的 Wrangler 打包，再由 `cf` 发布。不要仅为统一 CLI 名称而改写现有构建发布流程。
- 环境简称和默认目标不构成自动部署授权。按用户已明确要求的发布范围操作；不要仅因推送、合并 PR 或发布 Wiki 就自动部署游戏。
- 获得部署授权后，核对账户、Worker、环境及提交，先完成本地检查和对应 dry-run；PRO 发布前先验证 PRE，并发布同一已验证版本。环境、版本或授权范围有歧义时，先确认。
- 本地检查、浏览器验证、PRE 发布、Wiki 同步和 PRO 上线是不同结果，分别核验和报告；不要相互替代。

## 6. Cloudflare 凭据与权限

- 优先复用当前 OS 用户已有的全局 CLI 认证，包括保存的 OAuth 会话、profile 和环境凭据；遵循 CLI 的凭据优先级，不因项目目录或新 worktree 改变就要求重新登录或新建项目令牌。
- 先通过只读身份、账户及权限信息核对操作目标和所需权限。允许 CLI 自动刷新过期的短期访问令牌，并继续使用原有持久凭据位置；不要打印令牌、刷新令牌、密码或 Cookie。
- 如果受执行环境限制而无法保存刷新凭据，使用已授权的适当执行权限，不把认证目录迁移到一次性目录。
- 如果缺少权限，明确说明目标账户、受阻操作及缺少的权限，提供为现有登录补充授权或调整令牌最小权限的具体步骤，并与用户确认。区分凭据缺失、刷新失败、授权撤销、权限不足、网络及文件系统问题；不要未经诊断就要求重新登录。
- CLI 登录不等于应用密钥，也不扩大部署或其他远端写入的授权范围。不要把登录凭据写入项目、提交 Git 或作为 Worker secret 上传。

## 7. 疑问先确认

- 对需求、玩法语义、审阅意见、环境、权限、发布范围或清理安全性有任何疑问，直接与用户确认后再执行受影响步骤；不要擅自选择、扩大范围或绕过约束。
- 需要用户确认时，明确标注推荐方案，简要说明推荐理由，并列出其他可行方案及其主要取舍；选项应具体、易于比较，避免只提出问题而不给建议。
- 等待答复时可继续已经明确授权且不依赖该答复的工作；没有回复或等待超时不代表同意。

# Development principles

- Use Bun for dependencies, tool execution and tests. Run JS CLIs with `bunx --bun`; commit `bun.lock`. Validate new stable Bun releases without an upper major-version restriction.
- Keep TypeScript strict. Browser modules must not import Bun-only or server-only APIs.
- Keep simulation rules in `src/game`, content in `src/data`, Phaser rendering in `src/game/scenes`, and DOM presentation in `src/ui`.
- Define cards and enemies as data. Use seconds, the fixed-step simulation, bounded pools and independent input coordinates; do not couple movement to frame counts or CSS pixels.
- Preserve touch controls, safe areas, narrow reward layouts, pause on background, and keyboard access. Keep rendering resolution independent of device DPR.
- Maintain meaningful Bun tests for changes to combat, cards, rewards, states and restart behavior. Use browser tests for input, rendering and responsive behavior.
- Keep README claims and validation boundaries aligned with the implementation. Use original or appropriately licensed assets; preserve `LICENSE` and third-party notices.
- Gameplay/card/enemy changes must follow the guide and Wiki synchronization workflow above; the guide and Wiki share `scripts/game-guide.ts`. See `docs/wiki-publishing.md` for publishing details.
- This is a static frontend. Do not introduce accounts, databases or backend services without a concrete requirement.
- Keep dev / preview servers on loopback unless a protected access path is explicitly configured. Do not change firewall, DNS or production configuration as part of routine development.

Before committing: `bun run typecheck`, `bun run lint`, `bun test`, `bun run build`. For browser verification, build first, install the matching Playwright browsers, then run `bun run test:browser`. See README for environment and browser limitations.
