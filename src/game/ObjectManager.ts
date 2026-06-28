import type { EnemyState } from "./types";

// 활성 오브젝트 컬렉션 + 풀링 (implementation-plan §4.2, product-plan §23.3).
// Phase 1은 적 상태 컬렉션 관리만. 스프라이트 풀/파티클 풀 배선은 Subagent B.
// TODO(Phase1-B): PixiJS 스프라이트 풀 연동(destroy 대신 풀 반환), 파티클 풀.

export class ObjectManager {
  private enemies: EnemyState[] = [];

  add(enemy: EnemyState): void {
    this.enemies.push(enemy);
  }

  getEnemies(): EnemyState[] {
    return this.enemies;
  }

  getAlive(): EnemyState[] {
    return this.enemies.filter((e) => e.alive);
  }

  kill(id: number): void {
    const e = this.enemies.find((x) => x.id === id);
    if (e) e.alive = false;
  }

  applyDamage(id: number, amount = 1): { enemy?: EnemyState; killed: boolean } {
    const e = this.enemies.find((x) => x.id === id && x.alive);
    if (!e) return { killed: false };

    e.hp = Math.max(0, e.hp - Math.max(0, amount));
    if (e.hp <= 0) {
      e.alive = false;
      return { enemy: e, killed: true };
    }
    return { enemy: e, killed: false };
  }

  /** 죽은/지구 통과한 적 제거 (풀 반환 지점). */
  prune(): void {
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  clear(): void {
    this.enemies = [];
  }

  count(): number {
    return this.enemies.length;
  }
}
