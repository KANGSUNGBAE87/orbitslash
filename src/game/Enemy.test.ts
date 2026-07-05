import { describe, expect, it } from "vitest";
import { createEnemyState, gravitonPullMultiplierForEnemy, splitSpawnSpecsForEnemy } from "./Enemy";
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

  it("directional enemy는 기본적으로 현재 공전 접선 방향을 사용한다", () => {
    const enemy = createEnemyState(
      { ...spec, startAngleRad: Math.PI / 4 },
      { ...def, directional: true, directionalToleranceDeg: 24 },
    );

    expect(enemy.directional).toBe(true);
    expect(enemy.directionalSlashAngleRad).toBeUndefined();
    expect(enemy.directionalToleranceDeg).toBe(24);
  });

  it("directional angle이 데이터에 있으면 고정 절단 방향으로 사용한다", () => {
    const enemy = createEnemyState(spec, { ...def, directional: true, directionalSlashAngleDeg: 45 });

    expect(enemy.directionalSlashAngleRad).toBeCloseTo(Math.PI / 4, 6);
  });

  it("carries authored advanced behavior metadata into runtime enemy state", () => {
    const enemy = createEnemyState(spec, {
      ...def,
      attribute: "ice",
      behavior: "split",
      splitInto: "shard_meteor",
      splitCount: 3,
    });

    expect(enemy.attribute).toBe("ice");
    expect(enemy.behavior).toBe("split");
    expect(enemy.splitInto).toBe("shard_meteor");
    expect(enemy.splitCount).toBe(3);
  });

  it("creates deterministic split spawn specs near the defeated enemy orbit", () => {
    const enemy = createEnemyState(
      { ...spec, spawnAtMs: 1234, startAngleRad: Math.PI / 2, startRadius: 420 },
      { ...def, behavior: "split", splitInto: "shard_meteor", splitCount: 3 },
    );

    const splits = splitSpawnSpecsForEnemy(enemy, 5555);

    expect(splits).toHaveLength(3);
    expect(splits.map((split) => split.enemyType)).toEqual(["shard_meteor", "shard_meteor", "shard_meteor"]);
    expect(splits.map((split) => split.spawnAtMs)).toEqual([5555, 5555, 5555]);
    expect(splits[0]?.startRadius).toBeGreaterThan(enemy.radius);
    expect(splits[1]?.startAngleRad).not.toBe(splits[0]?.startAngleRad);
  });

  it("adds a pull multiplier for enemies close to active graviton cores", () => {
    const target = createEnemyState({ ...spec, startRadius: 500 }, def);
    const graviton = createEnemyState(
      { ...spec, enemyType: "graviton_core", startRadius: 560 },
      { ...def, behavior: "orbit_pull", gravityPullRadiusPx: 120 },
    );

    expect(gravitonPullMultiplierForEnemy(target, [graviton])).toBeGreaterThan(1);
    expect(gravitonPullMultiplierForEnemy(graviton, [graviton])).toBe(1);
    graviton.alive = false;
    expect(gravitonPullMultiplierForEnemy(target, [graviton])).toBe(1);
  });
});
