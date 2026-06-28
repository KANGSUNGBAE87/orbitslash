import { describe, expect, it } from "vitest";
import { directionalSlashAccuracy, requiredDirectionalSlashAngleRad, slashMatchesDirectionalAngle } from "./DirectionalCut";
import type { EnemyState, Segment } from "./types";

const segment = (ax: number, ay: number, bx: number, by: number): Segment => ({
  a: { x: ax, y: ay, t: 0 },
  b: { x: bx, y: by, t: 16 },
});

const enemy = (overrides: Partial<EnemyState> = {}): EnemyState => ({
  id: 1,
  type: "fast_comet",
  angle: 0,
  radius: 200,
  angularSpeed: 0,
  approachSpeed: 0,
  radiusPx: 66,
  earthImpactRadiusPx: 13,
  directional: true,
  directionalSlashAngleRad: 0,
  directionalToleranceDeg: 30,
  hp: 1,
  damage: 8,
  score: 130,
  alive: true,
  ...overrides,
});

describe("slashMatchesDirectionalAngle", () => {
  it("반대 방향으로 그어도 같은 절단 orientation이면 성공한다", () => {
    expect(slashMatchesDirectionalAngle(segment(100, 0, 0, 0), 0, 30)).toBe(true);
  });

  it("허용각 밖이면 실패한다", () => {
    expect(slashMatchesDirectionalAngle(segment(0, 0, 0, 100), 0, 30)).toBe(false);
  });
});

describe("directionalSlashAccuracy", () => {
  it("방향 적을 올바른 방향으로 베면 directional accuracy를 반환한다", () => {
    expect(directionalSlashAccuracy(segment(0, 0, 100, 0), enemy())).toBe("directional");
  });

  it("방향 적을 틀린 방향으로 베면 hit를 거부한다", () => {
    expect(directionalSlashAccuracy(segment(0, 0, 0, 100), enemy())).toBe(null);
  });

  it("일반 적은 방향 검사 없이 normal로 처리한다", () => {
    expect(directionalSlashAccuracy(segment(0, 0, 0, 100), enemy({ directional: false }))).toBe("normal");
  });

  it("고정 각도가 없으면 현재 공전 각도의 접선 방향을 요구한다", () => {
    const moving = enemy({ angle: 0, directionalSlashAngleRad: undefined });

    expect(requiredDirectionalSlashAngleRad(moving)).toBeCloseTo(Math.PI / 2, 6);
    expect(directionalSlashAccuracy(segment(0, 0, 0, 100), moving)).toBe("directional");
    expect(directionalSlashAccuracy(segment(0, 0, 100, 0), moving)).toBe(null);
  });
});
