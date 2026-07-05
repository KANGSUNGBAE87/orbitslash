import type { EnemyState, SpawnSpec, EnemyDef } from "./types";
import { EARTH_CENTER_X, EARTH_CENTER_Y, EARTH_ENEMY_IMPACT_RADIUS_PX } from "./coords";

// 적 엔티티 (implementation-plan §1 [P1]). 나선 이동 로직은 순수하게 둔다.
// Pixi sprite creation/pooling happens in GameScene/render modules.

let idSeq = 0;

/** SpawnSpec + enemies.json def → 초기 EnemyState 생성. */
export function createEnemyState(spec: SpawnSpec, def: EnemyDef): EnemyState {
  idSeq += 1;
  return {
    id: idSeq,
    spawnOrdinal: spec.spawnOrdinal,
    type: spec.enemyType,
    angle: spec.startAngleRad,
    radius: spec.startRadius,
    angularSpeed: spec.angularSpeed, // 궤도 프로파일 적용된 최종값 (부호=방향)
    approachSpeed: spec.approachSpeed,
    radiusPx: def.radiusPx,
    earthImpactRadiusPx: def.earthImpactRadiusPx ?? EARTH_ENEMY_IMPACT_RADIUS_PX,
    maxHp: def.hp,
    directional: def.directional,
    directionalSlashAngleRad: def.directional && def.directionalSlashAngleDeg != null ? directionalSlashAngleRad(def.directionalSlashAngleDeg) : undefined,
    directionalToleranceDeg: def.directional ? (def.directionalToleranceDeg ?? 30) : undefined,
    hp: def.hp,
    damage: def.damage,
    score: def.score,
    boss: def.boss,
    attribute: def.attribute,
    behavior: def.behavior,
    splitInto: def.splitInto,
    splitCount: def.splitCount,
    precisionBonus: def.precisionBonus,
    shieldHits: def.shieldHits,
    empOnWrongHit: def.empOnWrongHit,
    gravityPullRadiusPx: def.gravityPullRadiusPx,
    visibility: def.visibility,
    armorHits: def.armorHits,
    alive: true,
  };
}

function directionalSlashAngleRad(angleDeg: number): number {
  return (angleDeg * Math.PI) / 180;
}

/**
 * 나선 궤도 한 스텝 갱신 (product-plan §15.1). dtMs 단위.
 * angle += angularSpeed*dt; radius -= approachSpeed*dt. 순수 — 테스트/서버 재현 가능.
 */
export function stepEnemy(state: EnemyState, dtMs: number): void {
  const dt = dtMs / 1000;
  state.angle += state.angularSpeed * dt;
  state.radius -= state.approachSpeed * dt;
}

/** 적의 현재 화면 좌표 (지구 중심 기준 나선). */
export function enemyXY(state: EnemyState): { x: number; y: number } {
  return {
    x: EARTH_CENTER_X + Math.cos(state.angle) * state.radius,
    y: EARTH_CENTER_Y + Math.sin(state.angle) * state.radius,
  };
}

export function splitSpawnSpecsForEnemy(enemy: EnemyState, hitAtMs: number): SpawnSpec[] {
  if (!enemy.splitInto || !enemy.splitCount || enemy.splitCount <= 0) return [];
  const count = Math.max(0, Math.floor(enemy.splitCount));
  const spread = Math.PI / Math.max(3, count + 1);
  const start = enemy.angle - spread * (count - 1) * 0.5;
  return Array.from({ length: count }, (_, index) => ({
    enemyType: enemy.splitInto!,
    spawnAtMs: hitAtMs,
    startAngleRad: normalizeAngle(start + spread * index),
    startRadius: Math.max(180, enemy.radius + 34 + index * 8),
    angularSpeed: enemy.angularSpeed * (index % 2 === 0 ? 1.1 : -0.95),
    approachSpeed: Math.max(20, enemy.approachSpeed * 1.08),
  }));
}

export function gravitonPullMultiplierForEnemy(enemy: EnemyState, candidates: readonly EnemyState[]): number {
  if (!enemy.alive || enemy.boss || enemy.behavior === "orbit_pull") return 1;
  for (const core of candidates) {
    if (!core.alive || core.behavior !== "orbit_pull" || !core.gravityPullRadiusPx) continue;
    if (Math.abs(enemy.radius - core.radius) <= core.gravityPullRadiusPx) return 1.25;
  }
  return 1;
}

function normalizeAngle(angle: number): number {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}
