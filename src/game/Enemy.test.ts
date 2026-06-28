import { describe, expect, it } from "vitest";
import { createEnemyState } from "./Enemy";
import { EARTH_ENEMY_IMPACT_RADIUS_PX } from "./coords";
import type { EnemyDef, SpawnSpec } from "./types";

const spec: SpawnSpec = {
  enemyType: "heavy_asteroid",
  spawnAtMs: 0,
  startAngleRad: 0,
  startRadius: 500,
  angularSpeed: 0.2,
  approachSpeed: 30,
};

const def: EnemyDef = {
  startRadius: 500,
  approachSpeed: 30,
  angularSpeed: 0.2,
  radiusPx: 128,
  hp: 3,
  damage: 12,
  score: 180,
  directional: false,
};

describe("createEnemyState", () => {
  it("visual/slash radius와 별도의 지구 충돌 contact radius를 기본 적용한다", () => {
    const enemy = createEnemyState(spec, def);

    expect(enemy.radiusPx).toBe(128);
    expect(enemy.earthImpactRadiusPx).toBe(EARTH_ENEMY_IMPACT_RADIUS_PX);
  });

  it("enemy def가 지구 충돌 radius를 명시하면 override한다", () => {
    const enemy = createEnemyState(spec, { ...def, earthImpactRadiusPx: 20 });

    expect(enemy.earthImpactRadiusPx).toBe(20);
  });
});
