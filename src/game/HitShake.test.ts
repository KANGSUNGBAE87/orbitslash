import { describe, expect, it } from "vitest";
import { enemyHitShakeOffset } from "./HitShake";

describe("enemyHitShakeOffset", () => {
  it("hit 직후에는 행성 위치와 scale에 눈에 보이는 흔들림을 만든다", () => {
    const offset = enemyHitShakeOffset(3, 40, 24, 180);

    expect(Math.abs(offset.x) + Math.abs(offset.y)).toBeGreaterThan(1);
    expect(offset.scale).toBeGreaterThan(1);
  });

  it("duration이 끝나면 원위치/원스케일로 수렴한다", () => {
    const offset = enemyHitShakeOffset(3, 180, 24, 180);

    expect(offset).toEqual({ x: 0, y: 0, scale: 1 });
  });
});
