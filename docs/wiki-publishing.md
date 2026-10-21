# 游戏说明与 GitHub Wiki 维护

玩家入口：[完整游戏说明](game-guide/Home.md)、[在线 Wiki](https://github.com/KnowSky404/destiny-echo-web/wiki)。两者共用 `scripts/game-guide.ts`，包括全部卡牌、怪物、流派、关卡及战斗机制。

## 每次玩法迭代

1. 修改 `src/data` 或 `src/game` 后，核对生成器中的机制文案，并同步游戏内帮助、README 和相关规格。
2. 运行 `bun run docs:generate`，将 `docs/game-guide/` 与实现放在同一个原子提交中。
3. 运行 `bun run docs:check` 及仓库全部必要检查。构建也会执行同步检查。
4. 在 Wiki 发布已获授权时，运行 `bun run wiki:publish`，核对脚本输出的提交和 Wiki 页面。

卡片名、稀有度、上限、初始强化预览、敌人基础属性、关卡表、羁绊效果从运行时数据生成。说明正文保留人工可读的规则解释，需要随语义变化一起修改；重新生成不能替代内容核对。生成文件带规则源码摘要，战斗实现变化而遗漏文档生成时，检查和构建都会失败。

```sh
bun run docs:generate
bun run docs:check
bun run typecheck
bun run lint
bun test
bun run build
# 浏览器安装与运行方式见 README
bun run test:browser
```

## Wiki 发布

原生 Wiki 是独立 Git 仓库 `https://github.com/KnowSky404/destiny-echo-web.wiki.git`。第一次需要在 GitHub 网页保存 Home 页面；此后发布脚本自动克隆其默认分支并同步。

```sh
bun run wiki:publish --dry-run  # 仅检查并列出页面，不访问或修改远端
bun run wiki:publish            # 创建 Wiki 提交并推送，核对远端 SHA
```

脚本只管理 `Home.md`、`Cards.md`、`Builds.md`、`Enemies.md`、`Stages.md`、`Mechanics.md`、`_Sidebar.md`、`_Footer.md`，保留其他自建页面。发布前必须通过文档同步检查；没有内容变化时不创建空提交。仓库内的 `.md` 链接会转换为原生 Wiki 页面链接；侧栏和页脚也一起同步。

认证复用当前 OS 用户的 Git credential helper / 已登录的 GitHub CLI；不把令牌写入项目，不引入新的密钥。没有写权限时应报告具体错误。使用正常推送，不强推；如果发布期间远端有新提交，重新检查并重新运行，以保留并发编辑。

Wiki 发布与主仓库推送、PRE 和生产部署是独立动作；Wiki 已更新不代表网页游戏已上线新规则。不要因为运行文档生成或构建就自动部署游戏。

GitHub 操作依据：[官方 Wiki 编辑文档](https://docs.github.com/en/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages)。
