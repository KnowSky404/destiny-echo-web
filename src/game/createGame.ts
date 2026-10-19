import Phaser from "phaser";
import { CONFIG } from "./config";
import { BattleScene } from "./scenes/BattleScene";
import type { World } from "./world";

export function createGame(parent: HTMLElement, world: World, ready: () => void): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: CONFIG.width,
    height: CONFIG.height,
    backgroundColor: "#0b1020",
    banner: false,
    audio: { noAudio: true },
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 60 },
    scene: new BattleScene(world, ready),
  });
}
