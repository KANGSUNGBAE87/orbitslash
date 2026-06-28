import type { EnemyState, SpawnSpec, EnemyDef } from "./types";
import { EARTH_CENTER_X, EARTH_CENTER_Y } from "./coords";

// 적 엔티티 (implementation-plan §1 [P1]). 나선 이동 로직은 순수하게 둔다.
// 렌더(스프라이트) 배선 + 씬 연결은 Subagent B.
// TODO(Phase1-B): Enemy 스프라이트 생성/풀 반환, GameScene movement 단계에 wiring.

let idSeq = 0;

/** SpawnSpec + enemies.json def → 초기 EnemyState 생성. */
export function createEnemyState(spec: SpawnSpec, def: EnemyDef): EnemyState {
  idSeq += 1;
  return {
    id: idSeq,
    type: spec.enemyType,
    angle: spec.startAngleRad,
    radius: spec.startRadius,
    angularSpeed: spec.angularSpeed, // 궤도 프로파일 적용된 최종값 (부호=방향)
    approachSpeed: spec.approachSpeed,
    radiusPx: def.radiusPx,
    hp: def.hp,
    damage: def.damage,
    score: def.score,
    alive: true,
  };
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
