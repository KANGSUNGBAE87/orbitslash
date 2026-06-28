import { describe, expect, it, vi } from "vitest";
import { GameScene } from "./GameScene";
import type { EarthRef, EnemyState, Segment, ZoneTable } from "./types";

function makeSceneStub(enemy: EnemyState) {
  const scene: any = Object.create(GameScene.prototype);
  const alive = [enemy];
  const commitKills = vi.fn();
  scene.objects = {
    getAlive: () => alive,
    applyDamage: vi.fn(() => {
      enemy.alive = false;
      return { enemy, killed: true };
    }),
    prune: vi.fn(),
  };
  scene.zones = { outer: 4, mid: 3, danger: 2, lastSave: 1.3, impact: 1.2 } satisfies ZoneTable;
  scene.strokeHitTracker = {
    canHit: vi.fn(() => true),
    recordHit: vi.fn(),
    markExited: vi.fn(),
  };
  scene.enemyVisualScale = vi.fn(() => 1);
  scene.spawnDirectionalRejectFeedback = vi.fn();
  scene.updateStrokeHitRearm = vi.fn();
  scene.spawnKillFeedback = vi.fn();
  scene.triggerEnemyHitFeedback = vi.fn();
  scene.removeSprite = vi.fn();
  scene.commitKills = commitKills;
  scene.strokeKills = [];
  scene.strokeHadHit = false;
  return { scene, commitKills };
}

describe("GameScene live slash rewards", () => {
  it("commits score and gauge immediately when a live slash kills an enemy", () => {
    const enemy: EnemyState = {
      id: 1,
      type: "shard_meteor",
      angle: 0,
      radius: 300,
      angularSpeed: 0,
      approachSpeed: 0,
      radiusPx: 64,
      earthImpactRadiusPx: 0,
      directional: false,
      hp: 1,
      damage: 1,
      score: 35,
      alive: true,
    };
    const { scene, commitKills } = makeSceneStub(enemy);
    const earth: EarthRef = { cx: 540, cy: 900, r: 50 };
    const segment: Segment = {
      a: { x: 840, y: 820, t: 100 },
      b: { x: 840, y: 980, t: 100 },
    };

    scene.resolveLiveSlashSegment(segment, earth);

    expect(commitKills).toHaveBeenCalledTimes(1);
    const [kills, rewardEarth, isLiveSegment] = commitKills.mock.calls[0]!;
    expect(kills).toHaveLength(1);
    expect(rewardEarth).toBe(earth);
    expect(isLiveSegment).toBe(true);
    expect(scene.strokeKills).toEqual([]);
  });
});
