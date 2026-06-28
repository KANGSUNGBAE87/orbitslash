import { pathLength, straightness } from "./gesture-helpers";
import type { EarthRef, Point } from "./types";

export interface SolarLanceReserveOptions {
  strokeHadHit: boolean;
  skillReady: boolean;
  gauge: number;
  gaugeCost: number;
  infiniteGauge: boolean;
  screenShortSide: number;
}

export function shouldReserveLiveSlashForSolarLance(
  points: Point[],
  earth: EarthRef,
  options: SolarLanceReserveOptions,
): boolean {
  if (options.strokeHadHit) return false;
  if (!options.skillReady) return false;
  if (options.gauge < options.gaugeCost && !options.infiniteGauge) return false;
  if (points.length < 2 || pathLength(points) < options.screenShortSide * 0.18) return false;
  if (straightness(points) < 0.9) return false;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const lineDist = pointToSegmentDistance(earth.cx, earth.cy, first.x, first.y, last.x, last.y);
  return lineDist <= earth.r * 0.9;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
