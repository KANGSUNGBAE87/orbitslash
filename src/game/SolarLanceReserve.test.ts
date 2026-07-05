import { describe, expect, it } from "vitest";
import { shouldReserveLiveSlashForSolarLance } from "./SolarLanceReserve";
import type { EarthRef, Point } from "./types";

const earth: EarthRef = { cx: 540, cy: 900, r: 58 };

const lineThroughEarth = (): Point[] => [
  { x: 120, y: 900, t: 0 },
  { x: 960, y: 900, t: 100 },
];

const lineAwayFromEarth = (): Point[] => [
  { x: 120, y: 700, t: 0 },
  { x: 960, y: 700, t: 100 },
];

describe("shouldReserveLiveSlashForSolarLance", () => {
  it("full-gauge straight Earth-crossing stroke는 live slash를 잠시 보류한다", () => {
    expect(
      shouldReserveLiveSlashForSolarLance(lineThroughEarth(), earth, {
        skillReady: true,
        gauge: 100,
        gaugeCost: 80,
        infiniteGauge: false,
        screenShortSide: 1080,
      }),
    ).toBe(true);
  });

  it("최종 직선 제스처가 지구를 관통하지 않으면 Solar Lance 예약을 하지 않는다", () => {
    expect(
      shouldReserveLiveSlashForSolarLance(lineAwayFromEarth(), earth, {
        skillReady: true,
        gauge: 100,
        gaugeCost: 80,
        infiniteGauge: false,
        screenShortSide: 1080,
      }),
    ).toBe(false);
  });
});
