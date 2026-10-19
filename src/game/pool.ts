// Stable objects are recycled in both the simulation and the Phaser renderer.
export class Pool<T extends { active: boolean }> {
  readonly items: T[] = [];

  constructor(
    private readonly capacity: number,
    private readonly create: () => T,
  ) {}

  acquire(): T | undefined {
    let item = this.items.find((candidate) => !candidate.active);
    if (!item && this.items.length < this.capacity) {
      item = this.create();
      this.items.push(item);
    }
    if (item) item.active = true;
    return item;
  }

  clear(): void {
    for (const item of this.items) item.active = false;
  }
}
