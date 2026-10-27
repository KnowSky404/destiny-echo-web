import { describe, expect, test } from "bun:test";
import { BossPercentLimiter } from "../../src/game/systems/boss-damage";

describe("shared boss percentage damage allowance", () => {
  test("different percentage sources share one post-bonus burst allowance", () => {
    const limiter = new BossPercentLimiter();
    limiter.advance(0, 1000, 0.025);
    const direct = limiter.consume(4);
    const pulse = limiter.consume(20);
    const explosion = limiter.consume(30);
    expect(direct).toBe(4);
    expect(pulse).toBe(2.25);
    expect(explosion).toBe(0);
    expect(direct + pulse + explosion).toBe(6.25);
  });

  test("fixed-step refills accumulate between volleys instead of vanishing each step", () => {
    const limiter = new BossPercentLimiter();
    limiter.advance(0, 1000, 0.025);
    limiter.consume(1000);
    for (let index = 0; index < 12; index++) limiter.advance(1 / 120, 1000, 0.025);
    expect(limiter.consume(1000)).toBeCloseTo(2.5, 10);
    for (let index = 0; index < 12; index++) limiter.advance(1 / 120, 1000, 0.025);
    expect(limiter.consume(1000)).toBeCloseTo(2.5, 10);
  });

  test("long idle times never bank more than a quarter-second burst", () => {
    const limiter = new BossPercentLimiter();
    limiter.advance(0, 1000, 0.025);
    limiter.consume(1000);
    limiter.advance(3600, 1000, 0.025);
    expect(limiter.consume(1000)).toBe(6.25);
    expect(limiter.consume(1000)).toBe(0);
  });

  test("weakness changes the live rate without resetting or minting allowance", () => {
    const limiter = new BossPercentLimiter();
    limiter.advance(0, 1000, 0.025);
    limiter.consume(1000);
    for (let index = 0; index < 20; index++) {
      limiter.advance(0, 1000, 0.05);
      expect(limiter.consume(1000)).toBe(0);
      limiter.advance(0, 1000, 0.025);
      expect(limiter.consume(1000)).toBe(0);
    }
    limiter.advance(0.1, 1000, 0.05);
    expect(limiter.consume(1000)).toBe(5);
    limiter.advance(0.1, 1000, 0.025);
    expect(limiter.consume(1000)).toBe(2.5);
  });

  test("separate enemies cannot spend each other's percentage allowance", () => {
    const main = new BossPercentLimiter();
    const mini = new BossPercentLimiter();
    main.advance(0, 1000, 0.025);
    mini.advance(0, 1000, 0.05);
    expect(main.consume(1000)).toBe(6.25);
    expect(mini.consume(1000)).toBe(12.5);
    expect(main.consume(1000)).toBe(0);
  });

  test("invalid clocks, damage and rates never corrupt or refill an existing budget", () => {
    const limiter = new BossPercentLimiter();
    limiter.advance(0, 1000, 0.025);
    limiter.consume(4);
    const before = limiter.snapshot();
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      limiter.advance(invalid, 1000, 0.025);
      limiter.advance(1, invalid, 0.025);
      limiter.advance(1, 1000, invalid);
      expect(limiter.consume(invalid)).toBe(0);
      expect(limiter.snapshot()).toEqual(before);
    }
    limiter.advance(1, Number.MAX_VALUE, Number.MAX_VALUE);
    expect(limiter.snapshot()).toEqual(before);
    expect(limiter.consume(1000)).toBe(2.25);
  });
});
