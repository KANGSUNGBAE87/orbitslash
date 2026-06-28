import { describe, expect, it } from "vitest";
import { shouldReserveLiveSlashForSolarLance } from "./SolarLanceReserve";
import type { EarthRef, Point } from "./types";

const earth: EarthRef = { cx: 540, cy: 900, r: 58 };

const lineThroughEarth = (): Point[] => [
  { x: 120, y: 900, t: 0 },
  { x: 960, y: 900, t: 100 },
];

describe("shouldReserveLiveSlashForSolarLance", () => {
  it("full-gauge straight Earth-crossing stroke는 live slash를 잠시 보류한다", () => {
    expect(
      shouldReserveLiveSlashForSolarLance(lineThroughEarth(), earth, {
        strokeHadHit: false,
        skillReady: true,
        gauge: 100,
        gaugeCost: 80,
        infiniteGauge: false,
        screenShortSide: 1080,
      }),
    ).toBe(true);
  });

  it("이미 live hit가 난 stroke는 이후 Solar Lance 예약으로 일반 hit/rehit를 막지 않는다", () => {
    expect(
      shouldReserveLiveSlashForSolarLance(lineThroughEarth(), earth, {
        strokeHadHit: true,
        skillReady: true,
        gauge: 100,
        gaugeCost: 80,
        infiniteGauge: false,
        screenShortSide: 1080,
      }),
    ).toBe(false);
  });
});
