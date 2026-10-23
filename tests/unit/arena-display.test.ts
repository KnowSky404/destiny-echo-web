import { describe, expect, test } from "bun:test";
import { arenaDisplayMetrics, arenaLayout, arenaWidthForViewport } from "../../src/game/arena";

describe("arena display geometry", () => {
  test.each([
    { viewport: [393, 851], lanes: 4, minions: 24 },
    { viewport: [1920, 1080], lanes: 6, minions: 36 },
    { viewport: [2560, 1080], lanes: 8, minions: 48 },
    { viewport: [3840, 1080], lanes: 10, minions: 60 },
  ])("retains calibrated capacity for $viewport", ({ viewport, lanes, minions }) => {
    const arena = arenaLayout(arenaWidthForViewport(viewport[0] ?? 0, viewport[1] ?? 0));
    const metrics = arenaDisplayMetrics(arena, arena.width, arena.height);
    expect(metrics.laneCount).toBe(lanes);
    expect(metrics.minionCapacity).toBe(minions);
    expect(metrics.encounterCapacity).toBe(minions + 1);
    expect(metrics.rows).toBe(6);
    expect(metrics.cellWidthPx).toBe(68);
    expect(metrics.cellHeightPx).toBe(84);
  });

  test("actual canvas CSS dimensions give the same scale without stretching or applying DPR", () => {
    const arena = arenaLayout(1600);
    const metrics = arenaDisplayMetrics(arena, 1920, 960);
    expect(metrics.scale).toBeCloseTo(1.2);
    expect(metrics.widthPx).toBe(1920);
    expect(metrics.heightPx).toBe(960);
    expect(metrics.cellWidthPx).toBeCloseTo(81.6);
    expect(metrics.cellHeightPx).toBeCloseTo(100.8);
    expect(metrics.laneGapPx / arena.laneGap).toBeCloseTo(1.2);
  });

  test("wide and tall display areas fit both axes while retaining the original battle", () => {
    const arena = arenaLayout(1600);
    const initial = structuredClone(arena);
    const wide = arenaDisplayMetrics(arena, 1920, 600);
    const tall = arenaDisplayMetrics(arena, 800, 1000);
    expect([wide.widthPx, wide.heightPx]).toEqual([1200, 600]);
    expect([tall.widthPx, tall.heightPx]).toEqual([800, 400]);
    expect(wide.cellHeightPx).toBe(63);
    expect(tall.cellHeightPx).toBe(42);
    expect(wide.cellWidthPx / wide.cellHeightPx).toBeCloseTo(68 / 84);
    expect(tall.cellWidthPx / tall.cellHeightPx).toBeCloseTo(68 / 84);
    expect(arena).toEqual(initial);
    expect(wide.laneCount).toBe(tall.laneCount);
    expect(wide.minionCapacity).toBe(tall.minionCapacity);
  });

  test("phone rotation changes presentation without changing the four-lane arena", () => {
    const arena = arenaLayout(arenaWidthForViewport(393, 851));
    const portrait = arenaDisplayMetrics(arena, 337.5, 600);
    const landscape = arenaDisplayMetrics(arena, 851, 300);
    expect([portrait.widthPx, portrait.heightPx]).toEqual([337.5, 600]);
    expect([landscape.widthPx, landscape.heightPx]).toEqual([168.75, 300]);
    expect(portrait.cellWidthPx).toBe(51);
    expect(landscape.cellWidthPx).toBe(25.5);
    expect([portrait.laneCount, landscape.laneCount]).toEqual([4, 4]);
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects unavailable or invalid display dimension: %s",
    (size) => {
      const arena = arenaLayout();
      expect(() => arenaDisplayMetrics(arena, size, 800)).toThrow("Invalid arena display size");
      expect(() => arenaDisplayMetrics(arena, 450, size)).toThrow("Invalid arena display size");
    },
  );
});
