import { World } from "./game/world";
import { element, GameUI } from "./ui/GameUI";
import "./ui/style.css";

const world = new World();
const ui = new GameUI(world);

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

if (!supportsWebGL()) {
  ui.fail(
    "未能唤醒图形引擎",
    "游戏需要 WebGL。请启用浏览器硬件加速，并尝试更新 Chrome、Safari 或 Firefox 后重新加载。",
  );
} else {
  try {
    const { createGame } = await import("./game/createGame");
    const game = createGame(element("#game-canvas"), world, () => {
      ui.ready();
      element<HTMLCanvasElement>("#game-canvas canvas").addEventListener(
        "webglcontextlost",
        (event) => {
          event.preventDefault();
          ui.fail(
            "图形连接已中断",
            "战斗已经停止。请关闭占用图形资源的页面，然后重新加载开启新一局。",
          );
        },
      );
    });
    if (import.meta.hot)
      import.meta.hot.dispose(() => {
        game.destroy(true);
        ui.destroy();
      });
    // Read-only diagnostics exist only in the browser test server, never in production.
    if (import.meta.env.MODE === "test" && import.meta.env.DEV) {
      window.__ECHOES__ = () => world.snapshot();
    }
  } catch (error) {
    console.error("Game initialization failed", error);
    ui.fail("残响连接失败", "图形引擎未能启动。请检查网络、启用硬件加速后重新加载。");
  }
}

declare global {
  interface Window {
    __ECHOES__?: () => ReturnType<World["snapshot"]>;
  }
}
