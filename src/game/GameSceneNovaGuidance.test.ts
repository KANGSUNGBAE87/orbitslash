import { describe, expect, it, vi } from "vitest";
import { t } from "../i18n";
import { GameScene } from "./GameScene";
import { buildRunConfig, type SkillId } from "./ModeConfig";
import type { EarthRef, GestureResult, Point, ZoneTable } from "./types";

const earth: EarthRef = { cx: 540, cy: 900, r: 58 };
const linePoints: Point[] = [
  { x: 540, y: 958, t: 0 },
  { x: 540, y: 1_140, t: 180 },
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

const enabledSkills: SkillId[] = ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"];

function makeSceneStub(reason = "gauge") {
  const scene: any = Object.create(GameScene.prototype);
  scene.strokeHadHit = false;
  scene.strokeKills = [];
  scene.gauge = 100;
  scene.novaPulseSucceeded = false;
  scene.runConfig = { rules: { enabledSkills: [...enabledSkills] } };
  scene.zones = { outer: 4, mid: 3, danger: 2, lastSave: 1.3, impact: 1.2 } satisfies ZoneTable;
  scene.skillTable = {
    _debug: { infiniteGauge: false },
    solar_lance: { gaugeCost: 80, cooldownSec: 12, hitDamage: 20 },
    orbital_cut: { gaugeCost: 58, cooldownSec: 10 },
    gravity_slow: { gaugeCost: 70, cooldownSec: 14 },
    delta_shield: { gaugeCost: 62, cooldownSec: 16 },
    nova_pulse: { gaugeCost: 64, cooldownSec: 18 },
  };
  scene.skills = {
    trySolarLance: vi.fn(() => null),
    tryNovaPulse: vi.fn(() => null),
    evaluateNovaPulse: vi.fn(() => ({
      ok: false,
      reason,
      candidate: reason !== "not_candidate",
    })),
    tryOrbitalCut: vi.fn(() => null),
    tryDeltaShield: vi.fn(() => null),
    tryGravitySlow: vi.fn(() => null),
    cooldownRemaining: vi.fn(() => 0),
  };
  scene.objects = { getAlive: vi.fn(() => []), prune: vi.fn() };
  scene.gestureResultFromPoints = vi.fn(() => gesture);
  scene.enemyVisualScale = vi.fn(() => 1);
  scene.applyHits = vi.fn(() => []);
  scene.commitKills = vi.fn();
  scene.resolveNovaPulseHits = vi.fn(() => []);
  scene.resolveOrbitalCutHits = vi.fn(() => []);
  scene.runSession = {
    recordSkillUse: vi.fn(),
    recordComboBreak: vi.fn(),
  };
  scene.replayNowMs = vi.fn(() => 200);
  scene.laser = { fire: vi.fn() };
  scene.hitBurst = { spawn: vi.fn() };
  scene.destructionBurst = { spawn: vi.fn() };
  scene.hud = { flashBanner: vi.fn() };
  scene.scoring = { onMiss: vi.fn() };
  scene.advanceGuidedTutorial = vi.fn();
  return scene;
}

describe("GameScene Nova Pulse config and guidance", () => {
  it("uses active RemoteConfig values for Nova gauge spend and HUD cooldown", () => {
    const scene = makeSceneStub();
    scene.skillTable.nova_pulse = { gaugeCost: 73, cooldownSec: 21 };
    scene.skills.tryNovaPulse.mockReturnValue({ skillId: "nova_pulse", radiusPx: 500, damage: 1, pushPx: 120, targetCap: 4 });

    scene.resolveInput(linePoints, earth);
    const slot = scene.skillCooldownSlots().find((candidate: { id: string }) => candidate.id === "nova_pulse");

    expect(scene.skillCharges.get("nova_pulse")).toBe(0);
    expect(scene.gauge).toBe(100);
    expect(slot).toMatchObject({ cost: 73, cooldownSec: 21 });
  });

  it("falls back to 64 gauge and 18 seconds for malformed Nova config without producing NaN", () => {
    const scene = makeSceneStub();
    scene.skillTable.nova_pulse = { gaugeCost: "NaN", cooldownSec: -1 };
    scene.skills.tryNovaPulse.mockReturnValue({ skillId: "nova_pulse", radiusPx: 500, damage: 1, pushPx: 120, targetCap: 4 });

    scene.resolveInput(linePoints, earth);
    const slot = scene.skillCooldownSlots().find((candidate: { id: string }) => candidate.id === "nova_pulse");

    expect(scene.skillCharges.get("nova_pulse")).toBe(0);
    expect(scene.gauge).toBe(100);
    expect(Number.isFinite(scene.skillCharges.get("nova_pulse"))).toBe(true);
    expect(slot).toMatchObject({ cost: 64, cooldownSec: 18 });
  });

  it.each([
    ["cooldown", "skillTutorial.novaPulse.feedback.cooldown"],
    ["gauge", "skillTutorial.novaPulse.feedback.gauge"],
    ["start_too_far", "skillTutorial.novaPulse.feedback.start_too_far"],
    ["endpoint_too_close", "skillTutorial.novaPulse.feedback.endpoint_too_close"],
    ["too_short", "skillTutorial.novaPulse.feedback.too_short"],
    ["not_straight", "skillTutorial.novaPulse.feedback.not_straight"],
    ["too_slow", "skillTutorial.novaPulse.feedback.too_slow"],
  ])("maps the %s near-miss reason to one localized flash", (reason, key) => {
    const scene = makeSceneStub(reason);

    scene.resolveInput(linePoints, earth);

    expect(scene.hud.flashBanner).toHaveBeenCalledTimes(1);
    expect(scene.hud.flashBanner).toHaveBeenCalledWith(t(key), expect.any(Number));
  });

  it("keeps not-candidate Nova gestures silent", () => {
    const scene = makeSceneStub("not_candidate");

    scene.resolveInput(linePoints, earth);

    expect(scene.hud.flashBanner).not.toHaveBeenCalled();
  });

  it("keeps slash kill commit after showing a Nova near-miss", () => {
    const scene = makeSceneStub("too_slow");
    const kill = { enemyId: 7, enemyType: "basic_meteor", band: "outer" };
    scene.strokeHadHit = true;
    scene.strokeKills = [kill];

    scene.resolveInput(linePoints, earth);

    expect(scene.hud.flashBanner).toHaveBeenCalledTimes(1);
    expect(scene.commitKills).toHaveBeenCalledWith([kill], earth, true);
    expect(scene.advanceGuidedTutorial).toHaveBeenCalledWith({ type: "slash_committed" });
  });

  it("keeps miss combo-break after showing a Nova near-miss", () => {
    const scene = makeSceneStub("too_slow");

    scene.resolveInput(linePoints, earth);

    expect(scene.hud.flashBanner).toHaveBeenCalledTimes(1);
    expect(scene.scoring.onMiss).toHaveBeenCalledTimes(1);
    expect(scene.runSession.recordComboBreak).toHaveBeenCalledWith("miss", 200);
    expect(scene.advanceGuidedTutorial).toHaveBeenCalledWith({ type: "slash_committed" });
  });

  it.each(["orbital_cut", "delta_shield", "gravity_slow"] as const)("suppresses Nova feedback when %s succeeds", (skillId) => {
    const scene = makeSceneStub("too_slow");
    if (skillId === "orbital_cut") {
      scene.skills.tryOrbitalCut.mockReturnValue({ skillId, radiusPx: 260, damage: 2 });
    } else if (skillId === "delta_shield") {
      scene.skills.tryDeltaShield.mockReturnValue({ skillId, durationMs: 3_200, absorbCount: 3 });
    } else {
      scene.skills.tryGravitySlow.mockReturnValue({ skillId, durationMs: 2_600, slowMultiplier: 0.45 });
    }

    scene.resolveInput(linePoints, earth);

    expect(scene.skills.evaluateNovaPulse).not.toHaveBeenCalled();
  });

  it("does not call Nova try or evaluator while the skill is disabled", () => {
    const scene = makeSceneStub("too_slow");
    scene.runConfig.rules.enabledSkills = enabledSkills.filter((skillId) => skillId !== "nova_pulse");

    scene.resolveInput(linePoints, earth);

    expect(scene.skills.tryNovaPulse).not.toHaveBeenCalled();
    expect(scene.skills.evaluateNovaPulse).not.toHaveBeenCalled();
  });

  it("suppresses later near-miss evaluation after the first successful Nova in a run", () => {
    const scene = makeSceneStub("too_slow");
    scene.skills.tryNovaPulse
      .mockReturnValueOnce({ skillId: "nova_pulse", radiusPx: 500, damage: 1, pushPx: 120, targetCap: 4 })
      .mockReturnValue(null);

    scene.resolveInput(linePoints, earth);
    scene.hud.flashBanner.mockClear();
    scene.resolveInput(linePoints, earth);

    expect(scene.skills.evaluateNovaPulse).not.toHaveBeenCalled();
    expect(scene.hud.flashBanner).not.toHaveBeenCalled();
  });

  it("resets Nova guidance suppression when the run restarts", () => {
    const scene: any = new GameScene(buildRunConfig("freeDefense"), { showResultOverlay: false });
    scene.novaPulseSucceeded = true;

    scene.restart();

    expect(scene.novaPulseSucceeded).toBe(false);
  });
});
