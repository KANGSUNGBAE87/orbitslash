import { describe, it, expect } from "vitest";
import {
  straightness,
  pathLength,
  trimPathToMaxLength,
  totalTurn,
  polygonEnclosesPoint,
  countSharpVertices,
} from "./gesture-helpers";
import type { Point } from "./types";

const p = (x: number, y: number, t = 0): Point => ({ x, y, t });

describe("straightness (시작-끝거리 / 경로총길이)", () => {
  it("완전 직선 → ≈1.0", () => {
    const pts = [p(0, 0), p(10, 0), p(20, 0), p(30, 0)];
    expect(straightness(pts)).toBeCloseTo(1.0, 5);
  });

  it("지그재그 → 낮음 (<0.88, Solar Lance 임계 미달)", () => {
    const pts = [p(0, 0), p(10, 10), p(20, 0), p(30, 10), p(40, 0)];
    expect(straightness(pts)).toBeLessThan(0.88);
  });

  it("거의 직선(작은 흔들림) → 0.88 이상", () => {
    const pts = [p(0, 0), p(10, 0.5), p(20, 0), p(30, 0.5), p(40, 0)];
    expect(straightness(pts)).toBeGreaterThanOrEqual(0.88);
  });

  it("점이 2개 미만이면 0", () => {
    expect(straightness([p(0, 0)])).toBe(0);
    expect(straightness([])).toBe(0);
  });

  it("닫힌 경로(시작=끝)면 0에 가까움", () => {
    const pts = [p(0, 0), p(10, 0), p(10, 10), p(0, 10), p(0, 0)];
    expect(straightness(pts)).toBeCloseTo(0, 1);
  });
});

describe("pathLength / trimPathToMaxLength", () => {
  it("경로 누적 길이를 계산한다", () => {
    expect(pathLength([p(0, 0), p(10, 0), p(10, 10)])).toBe(20);
  });

  it("최근 stroke 구간만 남기고 max 길이 경계점은 보간한다", () => {
    const trimmed = trimPathToMaxLength([p(0, 0), p(30, 0), p(60, 0), p(90, 0)], 50);

    expect(trimmed.map((pt) => pt.x)).toEqual([40, 60, 90]);
    expect(pathLength(trimmed)).toBe(50);
  });

  it("max 길이보다 짧으면 원본 점들을 유지한다", () => {
    const points = [p(0, 0), p(20, 0), p(30, 0)];

    expect(trimPathToMaxLength(points, 50)).toEqual(points);
  });
});

describe("totalTurn (누적 회전각, 라디안)", () => {
  it("직선 → ≈0", () => {
    const pts = [p(0, 0), p(10, 0), p(20, 0), p(30, 0)];
    expect(totalTurn(pts)).toBeCloseTo(0, 5);
  });

  it("사각형 한 바퀴 → ≈2π (약 6.28)", () => {
    const pts = [p(0, 0), p(10, 0), p(10, 10), p(0, 10), p(0, 0), p(10, 0)];
    expect(totalTurn(pts)).toBeGreaterThan(Math.PI); // 충분한 누적 회전
  });

  it("180도 꺾임(spiral 부착 대비) 감지", () => {
    // 반원 근사
    const pts: Point[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (Math.PI * i) / 10;
      pts.push(p(Math.cos(a) * 50, Math.sin(a) * 50));
    }
    expect(totalTurn(pts)).toBeGreaterThan(Math.PI * 0.8);
  });
});

describe("polygonEnclosesPoint (경로가 지구 중심 포함?)", () => {
  it("원이 지구 둘러쌈 → true", () => {
    const pts: Point[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (2 * Math.PI * i) / 16;
      pts.push(p(540 + Math.cos(a) * 200, 900 + Math.sin(a) * 200));
    }
    expect(polygonEnclosesPoint(pts, 540, 900)).toBe(true);
  });

  it("원이 지구 안 둘러쌈(옆으로 빗나감) → false", () => {
    const pts: Point[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (2 * Math.PI * i) / 16;
      pts.push(p(100 + Math.cos(a) * 50, 100 + Math.sin(a) * 50));
    }
    expect(polygonEnclosesPoint(pts, 540, 900)).toBe(false);
  });

  it("삼각형이 지구 포함 → true", () => {
    const pts = [p(340, 700), p(740, 700), p(540, 1100), p(340, 700)];
    expect(polygonEnclosesPoint(pts, 540, 900)).toBe(true);
  });

  it("점 3개 미만이면 false", () => {
    expect(polygonEnclosesPoint([p(0, 0), p(1, 1)], 0, 0)).toBe(false);
  });
});

describe("countSharpVertices (큰 꺾임 수, triangle 판정)", () => {
  it("직선 → 0", () => {
    const pts = [p(0, 0), p(10, 0), p(20, 0), p(30, 0)];
    expect(countSharpVertices(pts, Math.PI / 4)).toBe(0);
  });

  it("삼각형 → 3 꼭짓점", () => {
    // 닫힌 삼각형: 세 꼭짓점에서 큰 꺾임
    const pts = [p(0, 0), p(100, 0), p(50, 100), p(0, 0)];
    expect(countSharpVertices(pts, Math.PI / 4)).toBe(3);
  });

  it("L자(한 번 꺾임) → 1", () => {
    const pts = [p(0, 0), p(100, 0), p(100, 100)];
    expect(countSharpVertices(pts, Math.PI / 4)).toBe(1);
  });
});
