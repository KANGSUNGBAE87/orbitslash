import { describe, expect, it } from "vitest";
import type { EnemyState } from "../game/types";
import { enemySpriteMotion, enemyTravelAngleRad } from "./EnemyMotion";

function enemy(partial: Partial<EnemyState> = {}): EnemyState {
  return {
    id: 7,
    type: "basic_meteor",
    angle: 0,
    radius: 420,
    angularSpeed: 0,
    approachSpeed: 80,
    radiusPx: 28,
    earthImpactRadiusPx: 28,
    maxHp: 3,
    directional: false,
    hp: 3,
    damage: 10,
    score: 100,
    alive: true,
    ...partial,
  };
}

describe("enemyTravelAngleRad", () => {
  it("points inward when an enemy on the right approaches Earth without orbiting", () => {
    expect(enemyTravelAngleRad(enemy({ angle: 0, angularSpeed: 0, approachSpeed: 90 }))).toBeCloseTo(Math.PI, 5);
  });

  it("includes orbital tangent direction when angular speed is present", () => {
    const angle = enemyTravelAngleRad(enemy({ angle: 0, radius: 400, angularSpeed: 0.5, approachSpeed: 0 }));

    expect(angle).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe("enemySpriteMotion", () => {
  it("keeps comet sprites aligned to their travel direction with a small living wobble", () => {
    const en = enemy({ type: "fast_comet", angle: 0.4, angularSpeed: 0.24, approachSpeed: 150 });
    const travel = enemyTravelAngleRad(en);
    const motion = enemySpriteMotion(en, 1200);

    expect(Math.abs(motion.rotationRad - travel)).toBeLessThan(0.2);
    expect(motion.trailAlpha).toBeGreaterThan(0.45);
    expect(motion.trailLengthPx).toBeGreaterThan(en.radiusPx);
  });

  it("spins asteroid-like sprites over time instead of locking them to movement", () => {
    const en = enemy({ type: "heavy_asteroid", angularSpeed: -0.2 });

    expect(enemySpriteMotion(en, 0).rotationRad).not.toBeCloseTo(enemySpriteMotion(en, 1000).rotationRad, 3);
  });

  it("bounds breathing scale so the visual stays close to the gameplay hit radius", () => {
    const en = enemy({ type: "ancient_planet", radiusPx: 54 });
    const samples = [0, 250, 500, 750, 1000, 1250].map((elapsedMs) => enemySpriteMotion(en, elapsedMs).visualScale);

    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.98);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1.03);
  });
}
);
