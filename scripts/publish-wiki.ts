import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkGuide, ROOT, renderGuide, wikiMarkdown } from "./game-guide";

const repository = "https://github.com/KnowSky404/destiny-echo-web.wiki.git";

function git(args: string[], cwd: string): string {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0)
    throw new Error(`git ${args[0]} 失败：${result.stderr.toString().trim()}`);
  return result.stdout.toString().trim();
}

if ((await checkGuide()).length > 0)
  throw new Error("游戏说明与规则不同步，请先运行 bun run docs:generate 并核对文案。");

const pages = await renderGuide();
if (Bun.argv.includes("--dry-run")) {
  console.log(`待发布 ${Object.keys(pages).length} 个页面：${Object.keys(pages).join(", ")}。`);
} else {
  // Git uses the OS user's existing credential helper; never copy tokens into files.
  const directory = await mkdtemp(join(tmpdir(), "destiny-echo-wiki-"));
  git(["clone", repository, directory], ROOT);
  const branch = git(["branch", "--show-current"], directory);
  if (!branch) throw new Error("Wiki 默认分支不存在，请先在 GitHub 网页保存 Home 页面。");
  for (const [name, body] of Object.entries(pages))
    await writeFile(join(directory, `${name}.md`), wikiMarkdown(body));
  const filenames = Object.keys(pages).map((name) => `${name}.md`);
  git(["add", "--", ...filenames], directory);
  if (git(["diff", "--cached", "--name-only"], directory)) {
    // Match the source worktree's configured author without changing global Git config.
    const author = git(["config", "user.name"], ROOT);
    const email = git(["config", "user.email"], ROOT);
    git(
      [
        "-c",
        `user.name=${author}`,
        "-c",
        `user.email=${email}`,
        "commit",
        "-m",
        "docs(wiki): sync game reference",
      ],
      directory,
    );
    git(["push", "origin", `HEAD:${branch}`], directory);
  }
  const local = git(["rev-parse", "HEAD"], directory);
  const remote = git(["ls-remote", "origin", `refs/heads/${branch}`], directory).split(/\s/)[0];
  if (local !== remote) throw new Error("Wiki 远端提交与本地不一致。");
  console.log(`Wiki 已同步：${local}\nhttps://github.com/KnowSky404/destiny-echo-web/wiki`);
}
