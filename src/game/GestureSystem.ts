import type { Point, GestureResult, GestureKind, EarthRef } from "./types";
import {
  straightness,
  trimPathToMaxLength,
  totalTurn,
  polygonEnclosesPoint,
  countSharpVertices,
} from "./gesture-helpers";
import { STROKE_BUFFER_HARD_CAP_PX } from "./input-tuning";

// GestureSystem (implementation-plan §3.2). Pure gesture math lives in
// gesture-helpers.ts; GameScene owns pointer wiring and slash trail rendering.

const SHARP_VERTEX_ANGLE = Math.PI / 4; // 45도 이상 = 큰 꺾임

export interface IGestureSystem {
  onPointerDown(p: Point): void;
  onPointerMove(p: Point): void;
  onPointerUp(p: Point, earth: EarthRef): GestureResult;
  classify(points: Point[], earth: EarthRef): GestureResult;
}

export class GestureSystem implements IGestureSystem {
  private points: Point[] = [];

  onPointerDown(p: Point): void {
    this.points = [p];
  }

  onPointerMove(p: Point): void {
    this.points.push(p);
    this.points = trimPathToMaxLength(this.points, STROKE_BUFFER_HARD_CAP_PX);
  }

  onPointerUp(p: Point, earth: EarthRef): GestureResult {
    this.points.push(p);
    this.points = trimPathToMaxLength(this.points, STROKE_BUFFER_HARD_CAP_PX);
    const result = this.classify(this.points, earth);
    this.points = [];
    return result;
  }

  /**
   * points[]를 분류 지표로 환산. Phase 1은 slash/line만 실분류 (kind 결정),
   * 나머지 지표(turn/enclose/vertex)는 계산만 해 두어 나중 Phase에서 매칭에 사용.
   */
  classify(points: Point[], earth: EarthRef): GestureResult {
    const s = straightness(points);
    const turn = totalTurn(points);
    const encloses = polygonEnclosesPoint(points, earth.cx, earth.cy);
    const vertices = countSharpVertices(points, SHARP_VERTEX_ANGLE);

    let kind: GestureKind = "none";
    if (points.length >= 2) {
      // Phase 1: 매우 직선 = line(Solar Lance 후보), 그 외 = slash.
      kind = s >= 0.88 ? "line" : "slash";
    }

    return {
      kind,
      points,
      straightness: s,
      totalTurnRad: turn,
      enclosesEarth: encloses,
      vertexCount: vertices,
      startEndGapRatio: s, // 시작-끝거리/경로총길이 (닫힘 판정과 동일 지표)
    };
  }
}
