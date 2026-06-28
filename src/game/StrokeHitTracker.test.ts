import { describe, expect, it } from "vitest";
import { resolveLiveSegmentHits } from "./CollisionSystem";
import { StrokeHitTracker } from "./StrokeHitTracker";
import type { EnemyState, Point, Segment, ZoneTable } from "./types";

const zones: ZoneTable = { outer: 4.0, mid: 3.0, danger: 2.0, lastSave: 1.3, impact: 1.2 };
const p = (x: number, y: number, t = 0): Point => ({ x, y, t });
const seg = (ax: number, ay: number, bx: number, by: number, t = 0): Segment => ({
  a: p(ax, ay, t),
  b: p(bx, by, t),
});
const heavy = (): EnemyState => ({
  id: 7,
  type: "heavy_asteroid",
  angle: 0,
  radius: 0,
  angularSpeed: 0,
  approachSpeed: 0,
  radiusPx: 128,
  earthImpactRadiusPx: 13,
  hp: 3,
  damage: 12,
  score: 180,
  alive: true,
});

describe("StrokeHitTracker", () => {
  it("같은 stroke에서 hitbox 안에 머무르는 동안 같은 적을 다시 때리지 않는다", () => {
    const tracker = new StrokeHitTracker({ exitMarginPx: 12, rehitCooldownMs: 60 });

    expect(tracker.canHit(7, 0)).toBe(true);

    tracker.recordHit(7, 0);
    tracker.markExited(7, false);

    expect(tracker.canHit(7, 120)).toBe(false);
  });

  it("hitbox 밖으로 충분히 나갔다가 cooldown 뒤 다시 들어오면 같은 stroke에서도 다시 때릴 수 있다", () => {
    const tracker = new StrokeHitTracker({ exitMarginPx: 12, rehitCooldownMs: 60 });

    tracker.recordHit(7, 0);
    tracker.markExited(7, true);

    expect(tracker.canHit(7, 59)).toBe(false);
    expect(tracker.canHit(7, 60)).toBe(true);
  });

  it("stroke가 끝나면 이전 hit state를 비운다", () => {
    const tracker = new StrokeHitTracker({ exitMarginPx: 12, rehitCooldownMs: 60 });

    tracker.recordHit(7, 0);
    tracker.reset();

    expect(tracker.canHit(7, 1)).toBe(true);
  });

  it("heavy hitbox에서도 같은 stroke의 exit segment는 추가 히트가 아니고, 이후 re-enter만 다시 히트한다", () => {
    const tracker = new StrokeHitTracker({ exitMarginPx: 12, rehitCooldownMs: 80 });
    const enemies = [heavy()];

    const firstHit = resolveLiveSegmentHits(seg(-180, 0, 0, 0, 0), enemies, 0, 0, 50, zones, {
      minSegmentLengthPx: 12,
      canHitEnemy: (enemy) => tracker.canHit(enemy.id, 0),
    });
    expect(firstHit.map((h) => h.enemyId)).toEqual([7]);
    tracker.recordHit(7, 0);

    const exitSegment = seg(0, 0, 150, 0, 40);
    const exitHit = resolveLiveSegmentHits(exitSegment, enemies, 0, 0, 50, zones, {
      minSegmentLengthPx: 12,
      canHitEnemy: (enemy) => tracker.canHit(enemy.id, 40),
    });
    expect(exitHit).toEqual([]);
    tracker.markExited(7, true);

    const reenterHit = resolveLiveSegmentHits(seg(150, 0, 0, 0, 100), enemies, 0, 0, 50, zones, {
      minSegmentLengthPx: 12,
      canHitEnemy: (enemy) => tracker.canHit(enemy.id, 100),
    });
    expect(reenterHit.map((h) => h.enemyId)).toEqual([7]);
  });
});
