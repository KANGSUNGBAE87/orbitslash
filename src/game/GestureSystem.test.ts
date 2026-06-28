import { describe, expect, it } from "vitest";
import { GestureSystem } from "./GestureSystem";
import type { EarthRef, Point } from "./types";

const earth: EarthRef = { cx: 540, cy: 900, r: 50 };

describe("GestureSystem", () => {
  it("reports start/end gap as a ratio of path length for closed circle gestures", () => {
    const system = new GestureSystem();
    const points: Point[] = [
      { x: 640, y: 900, t: 0 },
      { x: 540, y: 1000, t: 80 },
      { x: 440, y: 900, t: 160 },
      { x: 540, y: 800, t: 240 },
      { x: 640, y: 900, t: 320 },
    ];

    const result = system.classify(points, earth);

    expect(result.startEndGapRatio).toBe(0);
  });

  it("reports a large start/end gap for open spiral-like gestures", () => {
    const system = new GestureSystem();
    const points: Point[] = [
      { x: 650, y: 900, t: 0 },
      { x: 540, y: 1010, t: 80 },
      { x: 430, y: 900, t: 160 },
      { x: 540, y: 790, t: 240 },
      { x: 850, y: 760, t: 320 },
    ];

    const result = system.classify(points, earth);

    expect(result.startEndGapRatio).toBeGreaterThan(0.3);
  });
});
