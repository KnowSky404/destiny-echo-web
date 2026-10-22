import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseProfile } from "../src/data/balance/profile";

const args = process.argv.slice(2);
const command = args[0];
const file = args[1];
if ((command !== "validate" && command !== "apply") || !file || args.length !== 2) {
  console.error("用法：bun run balance:validate <配置.json> 或 bun run balance:apply <配置.json>");
  process.exitCode = 1;
} else {
  try {
    const text = await readFile(file, "utf8");
    if (text.length > 2_000_000) throw new Error("配置文件不能超过 2 MB");
    const profile = parseProfile(JSON.parse(text));
    if (command === "apply") {
      await writeFile(
        fileURLToPath(new URL("../src/data/balance/official.json", import.meta.url)),
        `${JSON.stringify(profile, null, 2)}\n`,
      );
      console.log(
        `已应用 ${profile.name} v${profile.revision} 到仓库正式配置。请核对文案、生成说明、验证并提交；尚未部署任何环境。`,
      );
    } else console.log(`配置有效：${profile.name} v${profile.revision}（${profile.baseline}）`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
