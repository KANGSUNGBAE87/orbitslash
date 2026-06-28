import { GestureSystem } from "./GestureSystem";
import type { EarthRef, Point } from "./types";

export interface GravitySlowReserveOptions {
  strokeHadHit: boolean;
  skillReady: boolean;
  gauge: number;
  gaugeCost: number;
  infiniteGauge: boolean;
  circleTurnMinRad: number;
  closeMaxRatio: number;
}

export function shouldReserveLiveSlashForGravitySlow(
  points: Point[],
  earth: EarthRef,
  options: GravitySlowReserveOptions,
): boolean {
  if (options.strokeHadHit) return false;
  if (!options.skillReady) return false;
  if (options.gauge < options.gaugeCost && !options.infiniteGauge) return false;
  if (points.length < 8) return false;

  const gesture = new GestureSystem().classify(points, earth);
  return (
    gesture.enclosesEarth &&
    gesture.totalTurnRad >= options.circleTurnMinRad &&
    gesture.startEndGapRatio <= options.closeMaxRatio
  );
}
