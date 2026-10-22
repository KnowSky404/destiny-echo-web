import { arenaWidthForViewport } from "./game/arena";
import { World } from "./game/world";
import { t } from "./i18n/locale";
import { initShell } from "./i18n/shell";
import { element, GameUI } from "./ui/GameUI";
import "./ui/style.css";

const destroyShell = initShell();
const width = arenaWidthForViewport(window.innerWidth, window.innerHeight);
const preSession =
  import.meta.env.MODE === "pre"
    ? await (await import("./ui/debug/entry")).createPreSession(width)
    : undefined;
const world = preSession?.world ?? new World(width);
const ui = new GameUI(world);
preSession?.attach();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    ui.destroy();
    destroyShell();
    preSession?.destroy();
  });

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
    () => t("未能唤醒图形引擎", "Graphics engine unavailable"),
    () =>
      t(
        "游戏需要 WebGL。请启用浏览器硬件加速，并尝试更新 Chrome、Safari 或 Firefox 后重新加载。",
        "This game requires WebGL. Enable hardware acceleration, update Chrome, Safari or Firefox, then reload.",
      ),
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
            () => t("图形连接已中断", "Graphics connection lost"),
            () =>
              t(
                "战斗已经停止。请关闭占用图形资源的页面，然后重新加载开启新一局。",
                "Combat has stopped. Close other pages using graphics resources, then reload to start a new run.",
              ),
          );
        },
      );
    });
    if (import.meta.hot)
      import.meta.hot.dispose(() => {
        game.destroy(true);
      });
    // Read-only snapshots are available in PRE and the test server, never in PRO.
    if (
      import.meta.env.MODE === "pre" ||
      (import.meta.env.MODE === "test" && import.meta.env.DEV)
    ) {
      window.__ECHOES__ = () => world.snapshot();
    }
  } catch (error) {
    console.error("Game initialization failed", error);
    ui.fail(
      () => t("残响连接失败", "Unable to connect to the echoes"),
      () =>
        t(
          "图形引擎未能启动。请检查网络、启用硬件加速后重新加载。",
          "The graphics engine could not start. Check your connection, enable hardware acceleration, then reload.",
        ),
    );
  }
}

declare global {
  interface Window {
    __ECHOES__?: () => ReturnType<World["snapshot"]>;
  }
}
