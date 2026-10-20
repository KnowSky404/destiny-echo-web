import { CONFIG } from "./config";
import type { Vec2 } from "./types";
import type { World } from "./world";

export class InputController {
  private contact: { id: number; start: Vec2; moved: boolean } | undefined;
  private readonly abort = new AbortController();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    world: World,
  ) {
    this.unsubscribe = world.state.subscribe(() => this.reset());
    const options = { signal: this.abort.signal };
    window.addEventListener("blur", () => this.reset(), options);
    canvas.addEventListener(
      "keydown",
      (event) => {
        if (
          world.phase !== "Playing" ||
          event.repeat ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        const key = event.key.toLowerCase();
        if (key === "t") world.cycleTarget();
        else if (key === "c") world.clearTarget();
        else return;
        event.preventDefault();
      },
      options,
    );
    canvas.addEventListener(
      "pointerdown",
      (event) => {
        if (world.phase !== "Playing" || this.contact || !event.isPrimary || event.button !== 0)
          return;
        event.preventDefault();
        canvas.focus({ preventScroll: true });
        this.contact = {
          id: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
          moved: false,
        };
        canvas.setPointerCapture(event.pointerId);
      },
      options,
    );
    canvas.addEventListener(
      "pointermove",
      (event) => {
        const contact = this.contact;
        if (!contact || contact.id !== event.pointerId) return;
        if (Math.hypot(event.clientX - contact.start.x, event.clientY - contact.start.y) > 12)
          contact.moved = true;
      },
      options,
    );
    canvas.addEventListener(
      "pointerup",
      (event) => {
        const contact = this.contact;
        if (!contact || contact.id !== event.pointerId) return;
        const rect = canvas.getBoundingClientRect();
        if (
          !contact.moved &&
          world.phase === "Playing" &&
          rect.width > 0 &&
          rect.height > 0 &&
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          // Use CSS pixels for touch tolerance, logical pixels for the simulation; never DPR.
          world.selectTargetAt(
            {
              x: ((event.clientX - rect.left) / rect.width) * CONFIG.width,
              y: ((event.clientY - rect.top) / rect.height) * CONFIG.height,
            },
            ((event.pointerType === "touch" ? 22 : 10) / rect.width) * CONFIG.width,
          );
        }
        this.reset();
      },
      options,
    );
    for (const name of ["pointercancel", "lostpointercapture"] as const) {
      canvas.addEventListener(
        name,
        (event) => {
          if (this.contact?.id === event.pointerId) this.reset();
        },
        options,
      );
    }
  }

  reset(): void {
    const id = this.contact?.id;
    this.contact = undefined;
    if (id !== undefined && this.canvas.hasPointerCapture(id))
      this.canvas.releasePointerCapture(id);
  }

  destroy(): void {
    this.unsubscribe();
    this.reset();
    this.abort.abort();
  }
}
