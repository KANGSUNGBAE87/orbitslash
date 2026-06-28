import { describe, it, expect } from "vitest";
import {
  enemyTouchesImpactZone,
  resolveLineHits,
  resolveLiveSegmentHits,
  resolveLiveSegmentDirectionalRejects,
  segmentIntersectsCircle,
  multiCutTier,
} from "./CollisionSystem";
import { distanceBand } from "./coords";
import type { EnemyState, Point, Segment, ZoneTable } from "./types";

const p = (x: number, y: number, t = 0): Point => ({ x, y, t });
const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({
  a: p(ax, ay),
  b: p(bx, by),
});
const enemyAt = (id: number, x: number, y: number, radiusPx = 10): EnemyState => ({
  id,
  type: "basic_meteor",
  angle: Math.atan2(y, x),
  radius: Math.hypot(x, y),
  angularSpeed: 0,
  approachSpeed: 0,
  radiusPx,
  earthImpactRadiusPx: 13,
  directional: false,
  hp: 1,
  damage: 5,
  score: 100,
  alive: true,
});

describe("segmentIntersectsCircle", () => {
  it("선분이 원을 관통하면 true", () => {
    expect(segmentIntersectsCircle(seg(-10, 0, 10, 0), 0, 0, 5)).toBe(true);
  });

  it("선분이 원에서 멀면 false", () => {
    expect(segmentIntersectsCircle(seg(-10, 100, 10, 100), 0, 0, 5)).toBe(false);
  });

  it("접점(tangent): 선분이 원에 정확히 접하면 true (경계 포함)", () => {
    // y=5 수평선, 반지름 5인 원에 정확히 접함
    expect(segmentIntersectsCircle(seg(-10, 5, 10, 5), 0, 0, 5)).toBe(true);
  });

  it("접선보다 살짝 바깥이면 false", () => {
    expect(segmentIntersectsCircle(seg(-10, 5.0001, 10, 5.0001), 0, 0, 5)).toBe(false);
  });

  it("양 끝점이 모두 원 안이면 true", () => {
    expect(segmentIntersectsCircle(seg(-2, 0, 2, 0), 0, 0, 5)).toBe(true);
  });

  it("한 끝점은 안, 한 끝점은 밖이면 true", () => {
    expect(segmentIntersectsCircle(seg(0, 0, 100, 0), 0, 0, 5)).toBe(true);
  });

  it("선분이 원 가까이 지나가지만 양 끝점이 원 밖이고 가장 가까운 점이 선분 밖에 있으면 false", () => {
    // 선분이 원 한쪽에서 끝나고, 원은 선분의 연장선 너머에 있음
    expect(segmentIntersectsCircle(seg(20, 0, 40, 0), 0, 0, 5)).toBe(false);
  });

  it("길이 0 선분(점)이 원 안이면 true", () => {
    expect(segmentIntersectsCircle(seg(1, 1, 1, 1), 0, 0, 5)).toBe(true);
  });

  it("길이 0 선분(점)이 원 밖이면 false", () => {
    expect(segmentIntersectsCircle(seg(100, 100, 100, 100), 0, 0, 5)).toBe(false);
  });
});

describe("distanceBand (product-plan §4.2 경계: 4.0R/3.0R/2.0R/1.3R/1.2R)", () => {
  const R = 100;
  const zones: ZoneTable = { outer: 4.0, mid: 3.0, danger: 2.0, lastSave: 1.3, impact: 1.2 };

  it("4.0R 이상 → outer (경계 포함)", () => {
    expect(distanceBand(400, R, zones)).toBe("outer");
    expect(distanceBand(450, R, zones)).toBe("outer");
  });

  it("3.0R~4.0R → mid", () => {
    expect(distanceBand(300, R, zones)).toBe("mid");
    expect(distanceBand(399, R, zones)).toBe("mid");
  });

  it("2.0R~3.0R → danger", () => {
    expect(distanceBand(200, R, zones)).toBe("danger");
    expect(distanceBand(299, R, zones)).toBe("danger");
  });

  it("1.3R~2.0R → lastSave", () => {
    expect(distanceBand(130, R, zones)).toBe("lastSave");
    expect(distanceBand(199, R, zones)).toBe("lastSave");
  });

  it("1.3R 미만 → impact", () => {
    expect(distanceBand(129, R, zones)).toBe("impact");
    expect(distanceBand(50, R, zones)).toBe("impact");
  });
});

describe("multiCutTier (product-plan §6.3: 2/3/5/7)", () => {
  it("1마리 → none", () => expect(multiCutTier(1)).toBe("none"));
  it("2마리 → double", () => expect(multiCutTier(2)).toBe("double"));
  it("3마리 → triple", () => expect(multiCutTier(3)).toBe("triple"));
  it("4마리 → triple (3~4 같은 등급)", () => expect(multiCutTier(4)).toBe("triple"));
  it("5마리 → mega", () => expect(multiCutTier(5)).toBe("mega"));
  it("6마리 → mega", () => expect(multiCutTier(6)).toBe("mega"));
  it("7마리 → orbital_master", () => expect(multiCutTier(7)).toBe("orbital_master"));
  it("10마리 → orbital_master", () => expect(multiCutTier(10)).toBe("orbital_master"));
  it("0마리 → none", () => expect(multiCutTier(0)).toBe("none"));
});

describe("enemyTouchesImpactZone", () => {
  const zones: ZoneTable = { outer: 4.0, mid: 3.0, danger: 2.0, lastSave: 1.3, impact: 1.2 };

  it("적 중심이 impact 반경 밖이어도 적 외곽이 닿으면 지구 피격으로 본다", () => {
    // R=50, impact=60, heavy radiusPx=58 → 중심거리 110이면 외곽은 52까지 들어와 impact zone에 닿음.
    expect(enemyTouchesImpactZone(110, 58, 50, zones, 1)).toBe(true);
  });

  it("적 외곽이 impact zone 밖이면 아직 피격이 아니다", () => {
    expect(enemyTouchesImpactZone(119, 58, 50, zones, 1)).toBe(false);
  });

  it("gravitySwell은 impact zone 자체를 확장한다", () => {
    // impactR = 60 * 1.25 = 75, enemy edge = 130 - 58 = 72.
    expect(enemyTouchesImpactZone(130, 58, 50, zones, 1.25)).toBe(true);
  });

  it("별도 earth impact radius를 쓰면 커진 시각 반경이 지구 피격을 앞당기지 않는다", () => {
    // visual/slash radius 128이어도 지구 충돌은 중심 기준 작은 contact radius만 사용한다.
    expect(enemyTouchesImpactZone(100, 128, 50, zones, 1, 13)).toBe(false);
    expect(enemyTouchesImpactZone(72, 128, 50, zones, 1, 13)).toBe(true);
  });
});

describe("resolveLineHits", () => {
  const zones: ZoneTable = { outer: 4.0, mid: 3.0, danger: 2.0, lastSave: 1.3, impact: 1.2 };

  it("첫점-끝점 직선 경로 위 적만 맞춘다", () => {
    const line = seg(0, 0, 100, 0);
    const enemies = [
      enemyAt(1, 50, 0),
      enemyAt(2, 50, 35),
    ];

    expect(resolveLineHits(line, enemies, 0, 0, 50, zones).map((h) => h.enemyId)).toEqual([1]);
  });

  it("죽은 적은 판정에서 제외한다", () => {
    const line = seg(0, 0, 100, 0);
    const enemies = [enemyAt(1, 50, 0)];
    enemies[0]!.alive = false;

    expect(resolveLineHits(line, enemies, 0, 0, 50, zones)).toEqual([]);
  });

  it("Solar Lance line hit도 방향 적의 절단 방향을 검사한다", () => {
    const enemies = [
      {
        ...enemyAt(1, 170, 0, 10),
        directional: true,
        directionalSlashAngleRad: 0,
        directionalToleranceDeg: 30,
      },
    ];

    expect(resolveLineHits(seg(100, 0, 240, 0), enemies, 0, 0, 50, zones)).toEqual([
      { enemyId: 1, band: "mid", accuracy: "directional" },
    ]);
    expect(resolveLineHits(seg(170, -80, 170, 80), enemies, 0, 0, 50, zones)).toEqual([]);
  });
});

describe("resolveLiveSegmentHits", () => {
  const zones: ZoneTable = { outer: 4.0, mid: 3.0, danger: 2.0, lastSave: 1.3, impact: 1.2 };

  it("탭/짧은 이동은 적에 닿아도 일반 베기로 보지 않는다", () => {
    const enemies = [enemyAt(1, 5, 0, 20)];

    expect(
      resolveLiveSegmentHits(seg(0, 0, 8, 0), enemies, 0, 0, 50, zones, {
        minSegmentLengthPx: 12,
        hitRadiusInflatePx: 12,
        alreadyHitEnemyIds: new Set(),
      }),
    ).toEqual([]);
  });

  it("이동 중 최근 선분이 inflated hitbox에 닿으면 즉시 hit를 반환한다", () => {
    const enemies = [enemyAt(1, 50, 21, 10)];

    expect(
      resolveLiveSegmentHits(seg(0, 0, 100, 0), enemies, 0, 0, 50, zones, {
        minSegmentLengthPx: 12,
        hitRadiusInflatePx: 12,
        alreadyHitEnemyIds: new Set(),
      }).map((h) => h.enemyId),
    ).toEqual([1]);
  });

  it("visual scale이 적용된 sprite bounds까지 live hitbox로 본다", () => {
    const enemies = [enemyAt(1, 50, 14, 10)];

    expect(
      resolveLiveSegmentHits(seg(0, 0, 100, 0), enemies, 0, 0, 50, zones, {
        minSegmentLengthPx: 12,
        hitRadiusInflatePx: 0,
        hitRadiusScaleForEnemy: () => 1.5,
      }).map((h) => h.enemyId),
    ).toEqual([1]);
  });

  it("방향 적은 맞는 절단 방향일 때만 directional hit를 반환한다", () => {
    const enemies = [
      {
        ...enemyAt(1, 170, 0, 10),
        directional: true,
        directionalSlashAngleRad: 0,
        directionalToleranceDeg: 30,
      },
    ];

    const correct = resolveLiveSegmentHits(seg(100, 0, 240, 0), enemies, 0, 0, 50, zones, {
      minSegmentLengthPx: 12,
    });
    const wrong = resolveLiveSegmentHits(seg(170, -80, 170, 80), enemies, 0, 0, 50, zones, {
      minSegmentLengthPx: 12,
    });

    expect(correct).toEqual([{ enemyId: 1, band: "mid", accuracy: "directional" }]);
    expect(wrong).toEqual([]);
  });

  it("방향 적에 닿았지만 방향이 틀리면 reject 피드백 대상을 반환한다", () => {
    const enemies = [
      {
        ...enemyAt(1, 170, 0, 10),
        directional: true,
        directionalSlashAngleRad: 0,
        directionalToleranceDeg: 30,
      },
    ];

    expect(
      resolveLiveSegmentDirectionalRejects(seg(170, -80, 170, 80), enemies, 0, 0, 50, zones, {
        minSegmentLengthPx: 12,
      }),
    ).toEqual([{ enemyId: 1, band: "mid" }]);
  });

  it("같은 선분에 정상 hit가 섞여도 방향 틀린 적은 reject 대상으로 남긴다", () => {
    const enemies = [
      enemyAt(1, 100, 0, 10),
      {
        ...enemyAt(2, 170, 0, 10),
        directional: true,
        directionalSlashAngleRad: Math.PI / 2,
        directionalToleranceDeg: 30,
      },
    ];

    expect(
      resolveLiveSegmentHits(seg(0, 0, 240, 0), enemies, 0, 0, 50, zones, {
        minSegmentLengthPx: 12,
      }).map((h) => h.enemyId),
    ).toEqual([1]);
    expect(
      resolveLiveSegmentDirectionalRejects(seg(0, 0, 240, 0), enemies, 0, 0, 50, zones, {
        minSegmentLengthPx: 12,
      }),
    ).toEqual([{ enemyId: 2, band: "mid" }]);
  });

  it("같은 stroke에서 이미 맞은 적은 중복 데미지 대상에서 제외한다", () => {
    const enemies = [enemyAt(1, 50, 0, 10), enemyAt(2, 80, 0, 10)];

    expect(
      resolveLiveSegmentHits(seg(0, 0, 100, 0), enemies, 0, 0, 50, zones, {
        minSegmentLengthPx: 12,
        hitRadiusInflatePx: 12,
        alreadyHitEnemyIds: new Set([1]),
      }).map((h) => h.enemyId),
    ).toEqual([2]);
  });
});
