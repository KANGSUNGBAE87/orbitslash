import { describe, expect, it } from "vitest";
import { shouldReserveLiveSlashForGravitySlow } from "./GravitySlowReserve";
import type { EarthRef, Point } from "./types";

const earth: EarthRef = { cx: 540, cy: 900, r: 58 };

const closedCircle = (): Point[] => [
  { x: 660, y: 900, t: 0 },
  { x: 625, y: 985, t: 40 },
  { x: 540, y: 1020, t: 80 },
  { x: 455, y: 985, t: 120 },
  { x: 420, y: 900, t: 160 },
  { x: 455, y: 815, t: 200 },
  { x: 540, y: 780, t: 240 },
  { x: 625, y: 815, t: 280 },
  { x: 660, y: 900, t: 320 },
];

const openSpiral = (): Point[] => [
  { x: 660, y: 900, t: 0 },
  { x: 625, y: 985, t: 40 },
  { x: 540, y: 1020, t: 80 },
  { x: 455, y: 985, t: 120 },
  { x: 420, y: 900, t: 160 },
  { x: 455, y: 815, t: 200 },
  { x: 540, y: 780, t: 240 },
  { x: 625, y: 815, t: 280 },
  { x: 980, y: 650, t: 320 },
];

describe("shouldReserveLiveSlashForGravitySlow", () => {
  it("reserves a closed earth-enclosing circle when the skill can fire", () => {
    expect(
      shouldReserveLiveSlashForGravitySlow(closedCircle(), earth, {
        strokeHadHit: false,
        skillReady: true,
        gauge: 100,
        gaugeCost: 70,
        infiniteGauge: false,
        circleTurnMinRad: 4.8,
        closeMaxRatio: 0.3,
      }),
    ).toBe(true);
  });

  it("does not reserve open spiral-like gestures", () => {
    expect(
      shouldReserveLiveSlashForGravitySlow(openSpiral(), earth, {
        strokeHadHit: false,
        skillReady: true,
        gauge: 100,
        gaugeCost: 70,
        infiniteGauge: false,
        circleTurnMinRad: 4.8,
        closeMaxRatio: 0.3,
      }),
    ).toBe(false);
  });
});
