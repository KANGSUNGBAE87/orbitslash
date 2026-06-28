import type {
  Point,
  Segment,
  EnemyState,
  HitResult,
  MultiCutTier,
  ZoneTable,
} from "./types";
import { distanceBand } from "./coords";

// 충돌 판정 (product-plan §6.2). 핵심 함수는 순수 — PixiJS import 금지.
// distanceBand는 coords.ts에서 re-export 하여 단일 출처 유지.
export { distanceBand };

/**
 * 선분-원 교차 판정 (product-plan §6.2 segmentIntersectsCircle).
 * 선분 위 가장 가까운 점과 원 중심의 거리가 반지름 이하면 교차(접점 포함).
 */
export function segmentIntersectsCircle(
  seg: Segment,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const ax = seg.a.x;
  const ay = seg.a.y;
  const bx = seg.b.x;
  const by = seg.b.y;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let closestX: number;
  let closestY: number;
  if (lenSq === 0) {
    // 길이 0 선분 = 점
    closestX = ax;
    closestY = ay;
  } else {
    // 점-선분 투영 파라미터 t를 [0,1]로 클램프
    let t = ((cx - ax) * dx + (cy - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    closestX = ax + t * dx;
    closestY = ay + t * dy;
  }
  const ddx = cx - closestX;
  const ddy = cy - closestY;
  return ddx * ddx + ddy * ddy <= r * r;
}

function segmentLength(seg: Segment): number {
  return Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
}

function enemyPosition(enemy: EnemyState, earthCx: number, earthCy: number): { x: number; y: number } {
  return {
    x: earthCx + Math.cos(enemy.angle) * enemy.radius,
    y: earthCy + Math.sin(enemy.angle) * enemy.radius,
  };
}

interface HitRadiusOptions {
  hitRadiusInflatePx?: number;
  hitRadiusScaleForEnemy?: (enemy: EnemyState) => number;
}

export interface LiveSegmentHitOptions extends HitRadiusOptions {
  minSegmentLengthPx: number;
  alreadyHitEnemyIds?: ReadonlySet<number>;
  canHitEnemy?: (enemy: EnemyState, hitRadiusPx: number) => boolean;
}

function hitRadiusForEnemy(enemy: EnemyState, options: HitRadiusOptions): number {
  const inflate = options.hitRadiusInflatePx ?? 0;
  const scale = options.hitRadiusScaleForEnemy?.(enemy) ?? 1;
  return enemy.radiusPx * scale + inflate;
}

/** Multi Cut 등급 (product-plan §6.3): 2 double / 3 triple / 5 mega / 7+ orbital_master. */
export function multiCutTier(count: number): MultiCutTier {
  if (count >= 7) return "orbital_master";
  if (count >= 5) return "mega";
  if (count >= 3) return "triple";
  if (count >= 2) return "double";
  return "none";
}

/** 적 외곽 원이 지구 impact zone에 닿았는지 판정한다. */
export function enemyTouchesImpactZone(
  enemyOrbitRadius: number,
  enemyRadiusPx: number,
  earthR: number,
  zones: ZoneTable,
  gravitySwell = 1,
  enemyImpactRadiusPx = enemyRadiusPx,
): boolean {
  const impactR = zones.impact * earthR * gravitySwell;
  return enemyOrbitRadius - enemyImpactRadiusPx <= impactR;
}

export function resolveLineHits(
  line: Segment,
  enemies: EnemyState[],
  earthCx: number,
  earthCy: number,
  earthR: number,
  zones: ZoneTable,
  options: HitRadiusOptions = {},
): HitResult[] {
  const hits: HitResult[] = [];
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const pos = enemyPosition(enemy, earthCx, earthCy);
    if (segmentIntersectsCircle(line, pos.x, pos.y, hitRadiusForEnemy(enemy, options))) {
      hits.push({
        enemyId: enemy.id,
        band: distanceBand(enemy.radius, earthR, zones),
        accuracy: "normal",
      });
    }
  }
  return hits;
}

export function resolveLiveSegmentHits(
  segment: Segment,
  enemies: EnemyState[],
  earthCx: number,
  earthCy: number,
  earthR: number,
  zones: ZoneTable,
  options: LiveSegmentHitOptions,
): HitResult[] {
  if (segmentLength(segment) < options.minSegmentLengthPx) return [];

  const hits: HitResult[] = [];
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (options.alreadyHitEnemyIds?.has(enemy.id)) continue;
    const pos = enemyPosition(enemy, earthCx, earthCy);
    const hitRadiusPx = hitRadiusForEnemy(enemy, options);
    if (options.canHitEnemy && !options.canHitEnemy(enemy, hitRadiusPx)) continue;
    if (segmentIntersectsCircle(segment, pos.x, pos.y, hitRadiusPx)) {
      hits.push({
        enemyId: enemy.id,
        band: distanceBand(enemy.radius, earthR, zones),
        accuracy: "normal",
      });
    }
  }
  return hits;
}

/**
 * 슬래시 폴리라인(points[])을 선분들로 보고 활성 적과 교차 판정 → 베인 적 HitResult[].
 * 베인 시점 적의 거리밴드로 거리배율 결정. accuracy는 Phase 1 전부 "normal".
 * 순수 함수: 입력만으로 결과 결정 → 서버 재현 가능.
 */
export function resolveSlash(
  points: Point[],
  enemies: EnemyState[],
  earthCx: number,
  earthCy: number,
  earthR: number,
  zones: ZoneTable,
): HitResult[] {
  const hits: HitResult[] = [];
  if (points.length < 2) return hits;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const pos = enemyPosition(enemy, earthCx, earthCy);
    let cut = false;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      if (!prev || !cur) continue;
      if (segmentIntersectsCircle({ a: prev, b: cur }, pos.x, pos.y, enemy.radiusPx)) {
        cut = true;
        break;
      }
    }
    if (cut) {
      hits.push({
        enemyId: enemy.id,
        band: distanceBand(enemy.radius, earthR, zones),
        accuracy: "normal",
      });
    }
  }
  return hits;
}
