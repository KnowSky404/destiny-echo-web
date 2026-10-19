import { CONFIG } from "./config";
import type { InputFrame, Vec2 } from "./types";
import type { World } from "./world";

export class InputController {
  private readonly keys = new Set<string>();
  private target: Vec2 | undefined;
  private drag: { id: number; offset: Vec2 } | undefined;
  private readonly abort = new AbortController();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    world: World,
  ) {
    // Clear old input synchronously at transitions, before new Playing input
    // arrives. A render-frame reset can discard a fresh key or drag on resume.
    this.unsubscribe = world.state.subscribe(() => this.reset());
    const options = { signal: this.abort.signal };
    window.addEventListener(
      "keydown",
      (event) => {
        if (
          world.phase !== "Playing" ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          !["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(
            event.key.toLowerCase(),
          )
        )
          return;
        event.preventDefault();
        this.keys.add(event.key.toLowerCase());
        this.target = undefined;
      },
      options,
    );
    window.addEventListener(
      "keyup",
      (event) => {
        this.keys.delete(event.key.toLowerCase());
      },
      options,
    );
    window.addEventListener("blur", () => this.reset(), options);
    canvas.addEventListener(
      "pointerdown",
      (event) => {
        if (world.phase !== "Playing" || this.drag || !event.isPrimary || event.button !== 0)
          return;
        event.preventDefault();
        const position = this.toLogical(event);
        this.drag = {
          id: event.pointerId,
          offset: { x: world.player.x - position.x, y: world.player.y - position.y },
        };
        this.target = { x: world.player.x, y: world.player.y };
        canvas.setPointerCapture(event.pointerId);
      },
      options,
    );
    canvas.addEventListener(
      "pointermove",
      (event) => {
        if (this.drag?.id !== event.pointerId || world.phase !== "Playing") return;
        event.preventDefault();
        const position = this.toLogical(event);
        this.target = { x: position.x + this.drag.offset.x, y: position.y + this.drag.offset.y };
      },
      options,
    );
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
      canvas.addEventListener(
        name,
        (event) => {
          if (this.drag?.id !== event.pointerId) return;
          this.drag = undefined;
          this.target = undefined;
        },
        options,
      );
    }
  }

  private toLogical(event: PointerEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CONFIG.width,
      y: ((event.clientY - rect.top) / rect.height) * CONFIG.height,
    };
  }

  frame(): InputFrame {
    return {
      x:
        Number(this.keys.has("d") || this.keys.has("arrowright")) -
        Number(this.keys.has("a") || this.keys.has("arrowleft")),
      y:
        Number(this.keys.has("s") || this.keys.has("arrowdown")) -
        Number(this.keys.has("w") || this.keys.has("arrowup")),
      target: this.target,
    };
  }

  reset(): void {
    this.keys.clear();
    if (this.drag && this.canvas.hasPointerCapture(this.drag.id))
      this.canvas.releasePointerCapture(this.drag.id);
    this.drag = undefined;
    this.target = undefined;
  }

  destroy(): void {
    this.unsubscribe();
    this.reset();
    this.abort.abort();
  }
}
