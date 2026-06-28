import type { SpawnSpec, EnemyTable } from "./types";
import { createEnemyState } from "./Enemy";
import { ObjectManager } from "./ObjectManager";

// WaveGenerator가 뱉은 SpawnSpec → 적 생성 → ObjectManager (implementation-plan §1 [P1]).
// 스폰 명세→상태 변환은 여기. 스프라이트 생성/씬 추가는 Subagent B가 GameScene에서.
// TODO(Phase1-B): 스폰 시 스프라이트 생성 + L4 레이어 배치, OrbitSpawner→GameScene wiring.

export class OrbitSpawner {
  constructor(
    private readonly enemies: EnemyTable,
    private readonly objects: ObjectManager,
  ) {}

  /** SpawnSpec 목록을 적 상태로 변환해 ObjectManager에 추가. */
  spawn(specs: SpawnSpec[]): void {
    for (const spec of specs) {
      const def = this.enemies[spec.enemyType];
      if (!def) continue;
      this.objects.add(createEnemyState(spec, def));
    }
  }
}
