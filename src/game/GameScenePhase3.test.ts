import { describe, expect, it, vi } from "vitest";
import { GameScene } from "./GameScene";
import type { EarthRef, GestureResult, Point, ZoneTable } from "./types";
import { t } from "../i18n";

const earth: EarthRef = { cx: 540, cy: 900, r: 58 };
const points: Point[] = [
  { x: 690, y: 900, t: 0 },
  { x: 540, y: 1050, t: 100 },
  { x: 390, y: 900, t: 200 },
  { x: 540, y: 750, t: 300 },
  { x: 690, y: 900, t: 400 },
];

const gesture: GestureResult = {
  kind: "circle",
  points,
  straightness: 0.1,
  totalTurnRad: 7.4,
  enclosesEarth: true,
  vertexCount: 0,
  startEndGapRatio: 0,
};

function makeSceneStub() {
  const scene: any = Object.create(GameScene.prototype);
  scene.gauge = 100;
  scene.strokeHadHit = false;
  scene.strokeKills = [];
  scene.zones = { outer: 4, mid: 3, danger: 2, lastSave: 1.3, impact: 1.2 } satisfies ZoneTable;
  scene.skillTable = {
    _debug: { infiniteGauge: false },
    solar_lance: { gaugeCost: 72, hitDamage: 5 },
    orbital_cut: { gaugeCost: 92, hitDamage: 2 },
    gravity_slow: { gaugeCost: 70 },
    delta_shield: { gaugeCost: 82 },
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
  scene.destructionBurst = { spawn: vi.fn() };
  scene.hud = { flashBanner: vi.fn() };
  scene.scoring = { onMiss: vi.fn() };
  scene.earth = { flashLastSave: vi.fn() };
  return scene;
}

describe("GameScene Phase 3 skill effects", () => {
  it("fires Orbital Cut before Gravity Slow when the gesture is a long orbit", () => {
    const scene = makeSceneStub();
    scene.skills = {
      trySolarLance: vi.fn(() => null),
      tryOrbitalCut: vi.fn(() => ({ skillId: "orbital_cut", radiusPx: 260, damage: 2 })),
      tryGravitySlow: vi.fn(() => ({ skillId: "gravity_slow", durationMs: 2600, slowMultiplier: 0.45 })),
      tryDeltaShield: vi.fn(() => null),
    };

    scene.resolveInput(points, earth);

    expect(scene.runSession.recordSkillUse).toHaveBeenCalledWith("orbital_cut");
    expect(scene.commitKills).toHaveBeenCalledTimes(1);
    expect(scene.hud.flashBanner).toHaveBeenCalledWith(expect.stringContaining("오비탈"), 0xffc14d);
    expect(scene.skills.tryGravitySlow).not.toHaveBeenCalled();
  });

  it("arms Delta Shield from the release gesture", () => {
    const scene = makeSceneStub();
    scene.skills = {
      trySolarLance: vi.fn(() => null),
      tryOrbitalCut: vi.fn(() => null),
      tryGravitySlow: vi.fn(() => null),
      tryDeltaShield: vi.fn(() => ({ skillId: "delta_shield", durationMs: 3200, absorbCount: 3 })),
    };

    scene.resolveInput(points, earth);

    expect(scene.deltaShieldRemainingMs).toBe(3200);
    expect(scene.deltaShieldAbsorbs).toBe(3);
    expect(scene.runSession.recordSkillUse).toHaveBeenCalledWith("delta_shield");
  });

  it("labels special-object hit feedback by object type", () => {
    const scene = makeSceneStub();
    scene.energy = {
      applyDamage: vi.fn(() => ({ gameOver: false })),
      visualState: vi.fn(() => "healthy"),
    };
    scene.scoring = { onMiss: vi.fn(), addBonus: vi.fn() };
    scene.earth = { flashLastSave: vi.fn(), setVisualState: vi.fn() };

    scene.applySpecialObjectEffect({ kind: "penalty", damage: 8, comboBreak: true }, 100, 200, "satellite");
    scene.applySpecialObjectEffect({ kind: "penalty", damage: 0, comboBreak: false }, 150, 240, "energyCapsule");

    expect(scene.hitBurst.spawn).toHaveBeenNthCalledWith(1, 100, 200, t("special.penalty.satellite"), 0xff5a66, 96, false, expect.any(Object));
    expect(scene.hitBurst.spawn).toHaveBeenNthCalledWith(2, 150, 240, t("special.penalty.energyCapsule"), 0xff5a66, 96, false, expect.any(Object));
    expect(scene.scoring.onMiss).toHaveBeenCalledTimes(1);
  });
});
