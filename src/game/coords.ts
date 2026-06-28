import type { DistanceBand, ZoneTable } from "./types";

// 좌표/스케일 헬퍼 (design §2.3, §3). 내부 좌표계는 1080x1920 고정.

export const BASE_WIDTH = 1080;
export const BASE_HEIGHT = 1920;

// 게임 화면 지구 기준 좌표 (design §2.3 v1.2). Owner 지시(2026-06-28)로 기존 1/3 축소.
// body 100px = radius 50. 더 넓은 플레이 공간 확보.
export const EARTH_CENTER_X = 540;
export const EARTH_CENTER_Y = 900;
export const EARTH_BODY_DIAMETER = 100; // 기존 300의 1/3 (design §2.2 v1.2 갱신)
export const EARTH_BODY_RADIUS = EARTH_BODY_DIAMETER / 2; // 50 = R
export const EARTH_SHIELD_DIAMETER = 140;
export const EARTH_SHIELD_RADIUS = EARTH_SHIELD_DIAMETER / 2;
export const LAST_SAVE_RING_DIAMETER = 174;
export const LAST_SAVE_RING_RADIUS = LAST_SAVE_RING_DIAMETER / 2;

/** 반응형 스케일 = min(sw/BASE_W, sh/BASE_H). design §3. */
export function computeScale(screenWidth: number, screenHeight: number): number {
  return Math.min(screenWidth / BASE_WIDTH, screenHeight / BASE_HEIGHT);
}

/** 두 점 사이 거리. */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 지구 중심으로부터의 거리(px). */
export function distanceFromEarth(x: number, y: number, cx = EARTH_CENTER_X, cy = EARTH_CENTER_Y): number {
  return distance(x, y, cx, cy);
}

/**
 * 거리(px)와 지구 반지름 R, zone 테이블로 거리밴드를 판정한다 (product-plan §4.2).
 * zones는 R 배수 경계: outer 4.0R / mid 3.0R / danger 2.0R / lastSave 1.3R / impact 1.2R.
 * radius >= 4.0R → outer, 3.0R~4.0R → mid, 2.0R~3.0R → danger, 1.3R~2.0R → lastSave,
 * < 1.3R → impact. 경계값은 더 바깥 밴드에 포함(>=).
 */
export function distanceBand(radius: number, R: number, zones: ZoneTable): DistanceBand {
  if (radius >= zones.outer * R) return "outer";
  if (radius >= zones.mid * R) return "mid";
  if (radius >= zones.danger * R) return "danger";
  if (radius >= zones.lastSave * R) return "lastSave";
  return "impact";
}

/** 나선 궤도 좌표 (§15.1): x = cx + cos(angle)*radius, y = cy + sin(angle)*radius. */
export function orbitToXY(
  angle: number,
  radius: number,
  cx = EARTH_CENTER_X,
  cy = EARTH_CENTER_Y,
): { x: number; y: number } {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}
