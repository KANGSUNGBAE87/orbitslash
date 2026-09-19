import { describe, expect, it, vi } from "vitest";
import { GameScene } from "./GameScene";
import type { EarthRef, GestureResult, Point, ZoneTable } from "./types";

const earth: EarthRef = { cx: 540, cy: 900, r: 58 };
const linePoints: Point[] = [
  { x: 120, y: 900, t: 0 },
  { x: 960, y: 900, t: 100 },
];

const gesture: GestureResult = {
  kind: "line",
  points: linePoints,
  straightness: 1,
  totalTurnRad: 0,
  enclosesEarth: false,
  vertexCount: 0,
  startEndGapRatio: 1,
};

function makeSceneStub() {
  const scene: any = Object.create(GameScene.prototype);
  scene.strokeHadHit = true;
  scene.strokeKills = [];
  scene.gauge = 100;
  scene.zones = { outer: 4, mid: 3, danger: 2, lastSave: 1.3, impact: 1.2 } satisfies ZoneTable;
  scene.skillTable = {
    _debug: { infiniteGauge: false },
    solar_lance: { gaugeCost: 80, hitDamage: 20 },
    gravity_slow: { gaugeCost: 70 },
  };
  scene.objects = {
    getAlive: vi.fn(() => []),
    prune: vi.fn(),
  };
  scene.gestureResultFromPoints = vi.fn(() => gesture);
  scene.enemyVisualScale = vi.fn(() => 1);
  scene.applyHits = vi.fn(() => []);
  scene.commitKills = vi.fn();
  scene.runSession = { recordSkillUse: vi.fn() };
  scene.laser = { fire: vi.fn() };
  scene.hitBurst = { spawn: vi.fn() };
  scene.hud = { flashBanner: vi.fn() };
  scene.scoring = { onMiss: vi.fn() };
  scene.advanceGuidedTutorial = vi.fn();
  return scene;
}

describe("GameScene release-time skill gestures", () => {
  it("fires Solar Lance from the final gesture even when this stroke already hit an enemy", () => {
    const scene = makeSceneStub();
    const trySolarLance = vi.fn(() => ({
      skillId: "solar_lance",
      judgedHits: [],
      vfxLine: { a: linePoints[0]!, b: linePoints[1]! },
    }));
    scene.skills = {
      trySolarLance,
      tryGravitySlow: vi.fn(),
    };

    scene.resolveInput(linePoints, earth);

    expect(trySolarLance).toHaveBeenCalledTimes(1);
    expect(scene.laser.fire).toHaveBeenCalledTimes(1);
    expect(scene.runSession.recordSkillUse).toHaveBeenCalledWith("solar_lance");
  });

  it("consumes only Solar Lance charge and preserves Nova Pulse charge", () => {
    const scene = makeSceneStub();
    scene.skills = {
      trySolarLance: vi.fn(() => ({
        skillId: "solar_lance",
        judgedHits: [],
        vfxLine: { a: linePoints[0]!, b: linePoints[1]! },
      })),
      tryGravitySlow: vi.fn(),
    };

    scene.resolveInput(linePoints, earth);

    expect(scene.skillCharges?.get("solar_lance")).toBe(0);
    expect(scene.skillCharges?.get("nova_pulse")).toBe(100);
  });

  it("resolves the live Solar Lance snapshot before advancing and clearing guided targets", () => {
    const scene = makeSceneStub();
    const order: string[] = [];
    const guidedTarget = { id: 17 };
    scene.guidedTutorialFlow = { step: "solar_lance" };
    scene.guidedScenarioEnemies = vi.fn(() => [guidedTarget]);
    scene.objects.getAlive.mockImplementation(() => {
      order.push("snapshot");
      return [];
    });
    scene.applyHits.mockReturnValue([{ hit: { enemyId: guidedTarget.id } }]);
    scene.advanceGuidedTutorial.mockImplementation(() => {
      order.push("advance");
    });
    scene.skills = {
      trySolarLance: vi.fn(() => ({
        skillId: "solar_lance",
        judgedHits: [],
        vfxLine: { a: linePoints[0]!, b: linePoints[1]! },
      })),
      tryGravitySlow: vi.fn(),
    };

    scene.resolveInput(linePoints, earth);

    expect(order).toEqual(["snapshot", "advance"]);
    expect(scene.commitKills.mock.invocationCallOrder[0]).toBeLessThan(scene.advanceGuidedTutorial.mock.invocationCallOrder[0]);
  });

  it("fires Gravity Slow from the final gesture even when this stroke already hit an enemy", () => {
    const scene = makeSceneStub();
    const tryGravitySlow = vi.fn(() => ({
      skillId: "gravity_slow",
      durationMs: 2600,
      slowMultiplier: 0.45,
    }));
    scene.skills = {
      trySolarLance: vi.fn(() => null),
      tryGravitySlow,
    };

    scene.resolveInput(linePoints, earth);

    expect(tryGravitySlow).toHaveBeenCalledTimes(1);
    expect(scene.gravitySlowRemainingMs).toBe(2600);
    expect(scene.gravitySlowMultiplier).toBe(0.45);
    expect(scene.runSession.recordSkillUse).toHaveBeenCalledWith("gravity_slow");
  });

  it("does not evaluate release skills that are disabled by the run config", () => {
    const scene = makeSceneStub();
    scene.runConfig = { rules: { enabledSkills: [] } };
    scene.skills = {
      trySolarLance: vi.fn(() => ({
        skillId: "solar_lance",
        judgedHits: [],
        vfxLine: { a: linePoints[0]!, b: linePoints[1]! },
      })),
      tryNovaPulse: vi.fn(() => ({ skillId: "nova_pulse", radiusPx: 500, damage: 1, pushPx: 120, targetCap: 12 })),
      tryOrbitalCut: vi.fn(() => ({ skillId: "orbital_cut", radiusPx: 260, damage: 2 })),
      tryDeltaShield: vi.fn(() => ({ skillId: "delta_shield", durationMs: 3200, absorbCount: 3 })),
      tryGravitySlow: vi.fn(() => ({ skillId: "gravity_slow", durationMs: 2600, slowMultiplier: 0.45 })),
    };

    scene.resolveInput(linePoints, earth);

    expect(scene.skills.trySolarLance).not.toHaveBeenCalled();
    expect(scene.skills.tryNovaPulse).not.toHaveBeenCalled();
    expect(scene.skills.tryOrbitalCut).not.toHaveBeenCalled();
    expect(scene.skills.tryDeltaShield).not.toHaveBeenCalled();
    expect(scene.skills.tryGravitySlow).not.toHaveBeenCalled();
    expect(scene.runSession.recordSkillUse).not.toHaveBeenCalled();
  });
});
