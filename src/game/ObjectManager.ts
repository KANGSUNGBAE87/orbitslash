import type { EnemyState } from "./types";

// 활성 오브젝트 컬렉션 (implementation-plan §4.2, product-plan §23.3).
// Pixi sprite/particle pooling stays in render/GameScene layers.

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

  applyDamage(id: number, amount = 1): { enemy?: EnemyState; killed: boolean; absorbed?: boolean; absorbedBy?: "shield" | "armor" } {
    const e = this.enemies.find((x) => x.id === id && x.alive);
    if (!e) return { killed: false };

    if ((e.shieldHits ?? 0) > 0) {
      e.shieldHits = Math.max(0, (e.shieldHits ?? 0) - 1);
      return { enemy: e, killed: false, absorbed: true, absorbedBy: "shield" };
    }

    if ((e.armorHits ?? 0) > 0) {
      e.armorHits = Math.max(0, (e.armorHits ?? 0) - 1);
      return { enemy: e, killed: false, absorbed: true, absorbedBy: "armor" };
    }

    e.hp = Math.max(0, e.hp - Math.max(0, amount));
    if (e.hp <= 0) {
      e.alive = false;
      return { enemy: e, killed: true, absorbed: false };
    }
    return { enemy: e, killed: false, absorbed: false };
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
