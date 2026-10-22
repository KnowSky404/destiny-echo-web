import { officialProfile } from "../../data/balance/profile";
import { DebugWorld } from "../../game/debug/DebugWorld";
import { DebugPanel } from "./DebugPanel";
import { browserStore } from "./store";

export function createPreSession(width: number) {
  const store = browserStore();
  const world = new DebugWorld(width, store.active ?? officialProfile());
  let panel: DebugPanel | undefined;
  return {
    world,
    attach: () => {
      panel = new DebugPanel(world, store);
    },
    destroy: () => panel?.destroy(),
  };
}
