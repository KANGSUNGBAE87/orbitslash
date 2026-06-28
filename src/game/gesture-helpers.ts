import type { Point } from "./types";

// 제스처 분류 순수 헬퍼 (implementation-plan §3.2). PixiJS 무관, vitest 대상.
// Phase 1은 slash/line만 실분류. circle/triangle/spiral 지표는 미리 계산해 두어
// 나중 Phase에서 SkillSystem이 임계값 매칭만 추가하면 되게 한다.

function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 경로 총 길이(누적 선분 길이). */
export function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) len += dist(a, b);
  }
  return len;
}

/** 최근 입력을 유지하면서 경로 길이를 maxLengthPx 이하로 자른다. */
export function trimPathToMaxLength(points: Point[], maxLengthPx: number): Point[] {
  if (points.length <= 1) return points;
  if (maxLengthPx <= 0) return [points[points.length - 1]!];

  const total = pathLength(points);
  if (total <= maxLengthPx) return points;

  const out: Point[] = [points[points.length - 1]!];
  let remaining = maxLengthPx;
  for (let i = points.length - 1; i > 0; i--) {
    const b = points[i]!;
    const a = points[i - 1]!;
    const len = dist(a, b);
    if (len === 0) continue;

    if (remaining >= len) {
      out.unshift(a);
      remaining -= len;
      continue;
    }

    const keepRatio = remaining / len;
    out.unshift({
      x: b.x + (a.x - b.x) * keepRatio,
      y: b.y + (a.y - b.y) * keepRatio,
      t: b.t + (a.t - b.t) * keepRatio,
    });
    break;
  }

  return out;
}

/**
 * 직선성 = 시작-끝 직선거리 / 경로 총 길이 (1.0 근접 = 직선).
 * Solar Lance 임계는 skills.json에서 조정한다. 점 2개 미만이면 0.
 */
export function straightness(points: Point[]): number {
  if (points.length < 2) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 0;
  const total = pathLength(points);
  if (total === 0) return 0;
  return dist(first, last) / total;
}

/**
 * 누적 회전각(라디안). 연속 세 점이 이루는 방향 변화의 절댓값 합.
 * circle/spiral 판정 지표 (회전 270도+ → circle, 180도+ → spiral).
 */
export function totalTurn(points: Point[]): number {
  if (points.length < 3) return 0;
  let total = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    if (!a || !b || !c) continue;
    const a1 = Math.atan2(b.y - a.y, b.x - a.x);
    const a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let diff = a2 - a1;
    // [-π, π]로 정규화
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    total += Math.abs(diff);
  }
  return total;
}

/**
 * 경로 폴리곤이 점(cx,cy)을 포함하는지 (ray casting, even-odd rule).
 * circle/triangle 스킬의 "지구 둘러쌈" 판정 (product-plan §9.1, §9.4).
 */
export function polygonEnclosesPoint(points: Point[], cx: number, cy: number): boolean {
  if (points.length < 3) return false;
  let inside = false;
  const n = points.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = points[i];
    const pj = points[j];
    if (!pi || !pj) continue;
    const intersect =
      pi.y > cy !== pj.y > cy &&
      cx < ((pj.x - pi.x) * (cy - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 큰 꺾임(꼭짓점) 수. 연속 세 점의 방향 변화가 minAngleRad 이상이면 1 꼭짓점.
 * triangle 판정(=3), line(=0) (product-plan §9.4 Delta Shield 부착 대비).
 */
export function countSharpVertices(points: Point[], minAngleRad: number): number {
  if (points.length < 3) return 0;

  // 닫힌 경로(시작=끝)면 중복 끝점을 제거하고 wrap-around로 모든 꼭짓점을 검사한다.
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const closed = first.x === last.x && first.y === last.y;
  const verts = closed ? points.slice(0, -1) : points;
  const n = verts.length;
  if (n < 3) return 0;

  const isSharp = (a: Point, b: Point, c: Point): boolean => {
    const a1 = Math.atan2(b.y - a.y, b.x - a.x);
    const a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let diff = Math.abs(a2 - a1);
    while (diff > Math.PI) diff = 2 * Math.PI - diff;
    return diff >= minAngleRad;
  };

  let count = 0;
  if (closed) {
    // 모든 꼭짓점을 순환 이웃으로 검사 (삼각형 → 3)
    for (let i = 0; i < n; i++) {
      const a = verts[(i - 1 + n) % n]!;
      const b = verts[i]!;
      const c = verts[(i + 1) % n]!;
      if (isSharp(a, b, c)) count += 1;
    }
  } else {
    // 열린 경로: 양 끝점은 꺾임 정의 불가 → 내부 점만
    for (let i = 1; i < n - 1; i++) {
      const a = verts[i - 1]!;
      const b = verts[i]!;
      const c = verts[i + 1]!;
      if (isSharp(a, b, c)) count += 1;
    }
  }
  return count;
}
