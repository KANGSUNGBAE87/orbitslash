import { describe, expect, it } from "vitest";
import { ObjectManager } from "./ObjectManager";
import type { EnemyState } from "./types";

const enemy = (overrides: Partial<EnemyState> = {}): EnemyState => ({
  id: 1,
  type: "heavy_asteroid",
  angle: 0,
  radius: 500,
  angularSpeed: 0,
  approachSpeed: 0,
  radiusPx: 58,
  hp: 3,
  damage: 12,
  score: 180,
  alive: true,
  ...overrides,
});

describe("ObjectManager.applyDamage", () => {
  it("피해를 누적하고 hp가 남은 적은 살려 둔다", () => {
    const objects = new ObjectManager();
    objects.add(enemy());

    const result = objects.applyDamage(1, 1);

    expect(result.killed).toBe(false);
    expect(result.enemy?.hp).toBe(2);
    expect(objects.getAlive()).toHaveLength(1);
  });

  it("hp가 0 이하가 된 적만 죽인다", () => {
    const objects = new ObjectManager();
    objects.add(enemy({ hp: 2 }));

    const first = objects.applyDamage(1, 1);
    const second = objects.applyDamage(1, 1);

    expect(first.killed).toBe(false);
    expect(second.killed).toBe(true);
    expect(second.enemy?.alive).toBe(false);
    expect(objects.getAlive()).toHaveLength(0);
  });

  it("없는 적에게 피해를 주면 killed=false를 반환한다", () => {
    const objects = new ObjectManager();

    expect(objects.applyDamage(999, 1)).toEqual({ killed: false });
  });
});
