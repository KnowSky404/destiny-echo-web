/**
 * Percentage-derived damage shares a quarter-second burst budget per enemy.
 * Advance once per active simulation step, then consume after all damage bonuses.
 * Fixed damage uses the ordinary damage path and never spends this allowance.
 */
export class BossPercentLimiter {
  private available = 0;
  private capacity = 0;
  private initialized = false;

  advance(delta: number, maxHp: number, perSecond: number): void {
    if (
      !Number.isFinite(delta) ||
      delta < 0 ||
      !Number.isFinite(maxHp) ||
      maxHp < 0 ||
      !Number.isFinite(perSecond) ||
      perSecond < 0
    )
      return;
    const refill = maxHp * perSecond;
    const capacity = refill * 0.25;
    if (!Number.isFinite(refill) || !Number.isFinite(capacity)) return;
    this.capacity = capacity;
    if (!this.initialized) {
      this.available = capacity;
      this.initialized = true;
    } else {
      // Changing vulnerability or profile rates never grants a fresh burst.
      this.available = Math.min(capacity, this.available + refill * delta);
    }
  }

  consume(requestedDamage: number): number {
    if (!Number.isFinite(requestedDamage) || requestedDamage <= 0) return 0;
    const accepted = Math.min(requestedDamage, this.available);
    this.available = Math.max(0, this.available - accepted);
    return accepted;
  }

  snapshot(): { available: number; capacity: number } {
    return { available: this.available, capacity: this.capacity };
  }
}
