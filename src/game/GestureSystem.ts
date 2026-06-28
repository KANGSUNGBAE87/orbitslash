import type { Point, GestureResult, GestureKind, EarthRef } from "./types";
import {
  straightness,
  totalTurn,
  polygonEnclosesPoint,
  countSharpVertices,
} from "./gesture-helpers";

// GestureSystem 클래스 셸 (implementation-plan §3.2). 순수 분류 헬퍼는 gesture-helpers.ts.
// pointer 이벤트 누적/배선 + 슬래시 trail 렌더는 Subagent B.
// TODO(Phase1-B): PixiJS stage pointer 이벤트(onPointerDown/Move/Up)를 이 클래스에 wiring,
//   pointer-up에서 classify() 호출 → GameScene input 단계로 GestureResult 전달,
//   L9 슬래시 trail 렌더. (product-plan §2.3 Instant Judgment = pointer-up 판정)

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
  }

  onPointerUp(p: Point, earth: EarthRef): GestureResult {
    this.points.push(p);
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
