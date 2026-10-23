import Phaser from "phaser";
import { arenaDisplayMetrics } from "./arena";
import { CONFIG } from "./config";
import { BattleScene } from "./scenes/BattleScene";
import type { World } from "./world";

export function createGame(parent: HTMLElement, world: World, ready: () => void): Phaser.Game {
  document.body.classList.toggle("desktop-arena", world.arena.width > CONFIG.width);
  document.body.style.setProperty("--arena-aspect", `${world.arena.width} / ${world.arena.height}`);
  document.body.style.setProperty("--arena-ratio", String(world.arena.width / world.arena.height));
  const updateDisplayMetrics = () => {
    const canvas = parent.querySelector("canvas");
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const parentBounds = parent.getBoundingClientRect();
    const metrics = arenaDisplayMetrics(world.arena, bounds.width, bounds.height);
    const values = {
      laneCount: String(metrics.laneCount),
      rows: String(metrics.rows),
      minionCapacity: String(metrics.minionCapacity),
      logicalWidth: String(world.arena.width),
      logicalHeight: String(world.arena.height),
      laneGapPx: metrics.laneGapPx.toFixed(3),
      cellWidthPx: metrics.cellWidthPx.toFixed(3),
      cellHeightPx: metrics.cellHeightPx.toFixed(3),
    };
    for (const [key, value] of Object.entries(values)) {
      if (parent.dataset[key] !== value) parent.dataset[key] = value;
    }
    const properties: [string, string][] = [
      ["--arena-unit-px", metrics.scale.toFixed(4)],
      ["--arena-lane-gap-px", values.laneGapPx],
      ["--arena-cell-width-px", values.cellWidthPx],
      ["--arena-cell-height-px", values.cellHeightPx],
      // Native UI text follows the actual FIT canvas, including letterboxing.
      // Snap its anchor to CSS pixels without scaling the browser's glyphs.
      [
        "--defense-label-left",
        String(Math.round(bounds.left - parentBounds.left + 22 * metrics.scale)),
      ],
      [
        "--defense-label-top",
        String(Math.round(bounds.top - parentBounds.top + (CONFIG.defense.y + 36) * metrics.scale)),
      ],
      ["--defense-label-width", String(Math.floor(bounds.width - 22 * metrics.scale - 8))],
    ];
    for (const [name, value] of properties) {
      if (parent.style.getPropertyValue(name) !== `${value}px`)
        parent.style.setProperty(name, `${value}px`);
    }
  };
  const renderSize = () => {
    const bounds = parent.getBoundingClientRect();
    const displayScale = Math.min(
      bounds.width / world.arena.width,
      bounds.height / world.arena.height,
    );
    // Cover desktop CSS enlargement without letting DPR or repeated resize events
    // inflate the drawing buffer. Quarter steps avoid rebuilding it for every pixel.
    const scale = Math.max(1, Math.min(2, Math.ceil(displayScale * 4) / 4));
    return {
      width: Math.ceil(world.arena.width * scale),
      height: Math.ceil(world.arena.height * scale),
    };
  };
  const initialSize = renderSize();
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    ...initialSize,
    backgroundColor: "#0b1020",
    banner: false,
    audio: { noAudio: true },
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 60 },
    scene: new BattleScene(world, () => {
      updateDisplayMetrics();
      ready();
    }),
  });
  game.events.once(Phaser.Core.Events.READY, () => {
    game.scale.on(Phaser.Scale.Events.RESIZE, updateDisplayMetrics);
  });
  let resizeFrame = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (!game.isBooted) return;
      const size = renderSize();
      if (size.width !== game.scale.width || size.height !== game.scale.height)
        game.scale.setGameSize(size.width, size.height);
      updateDisplayMetrics();
    });
  });
  observer.observe(parent);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observer.disconnect();
    cancelAnimationFrame(resizeFrame);
    game.scale.off(Phaser.Scale.Events.RESIZE, updateDisplayMetrics);
  });
  return game;
}
