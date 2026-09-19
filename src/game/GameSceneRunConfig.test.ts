import { describe, expect, it, vi } from "vitest";
import { GameScene } from "./GameScene";
import { buildRunConfig } from "./ModeConfig";
import { createRankedServerStubStart, createServerVerifiedRankedStart, LocalBackendAdapter } from "../platform/BackendAdapter";
import enemiesJson from "../data/enemies.json";
import difficultyJson from "../data/difficulty.json";
import scoringJson from "../data/scoring.json";
import skillsJson from "../data/skills.json";
import orbitsJson from "../data/orbits.json";
import wavesJson from "../data/waves.json";
import type { DifficultyTable, EnemyTable, OrbitProfile, ScoringConfig, SkillTable, WaveTable } from "./types";
import type { EnemyState } from "./types";

function makeStartRunStub(modeId = "ranked" as const) {
  const difficulty = difficultyJson as unknown as DifficultyTable;
  const scene: any = Object.create(GameScene.prototype);
  scene.enemies = enemiesJson as unknown as EnemyTable;
  scene.scoringCfg = scoringJson as unknown as ScoringConfig;
  scene.difficulty = difficulty;
  scene.skillTable = skillsJson as unknown as SkillTable;
  scene.orbits = (orbitsJson as unknown as { profiles: OrbitProfile[] }).profiles;
  scene.waves = wavesJson as unknown as WaveTable;
  scene.zones = difficulty.zones;
  scene.backend = new LocalBackendAdapter(12345);
  scene.runConfig = buildRunConfig(modeId, { difficulty: "elite", seed: 12345 });
  scene.pendingRunStart = undefined;
  scene.slashTrail = { setLive: vi.fn() };
  scene.enemyHitFeedback = new Map();
  scene.enemyTrailLayer = { clear: vi.fn() };
  scene.earth = { setVisualState: vi.fn() };
  scene.resetStrokeState = vi.fn();
  scene.spawnDevQaPreset = vi.fn();
  return scene;
}

function enemyState(partial: Partial<EnemyState>): EnemyState {
  return {
    id: 1,
    type: "basic_meteor",
    angle: 0,
    radius: 500,
    angularSpeed: 0,
    approachSpeed: 30,
    radiusPx: 80,
    earthImpactRadiusPx: 10,
    directional: false,
    hp: 1,
    damage: 1,
    score: 10,
    alive: true,
    ...partial,
  };
}

describe("GameScene RunConfig integration", () => {
  it("starts a run from the configured mode, difficulty, and seed", () => {
    const scene = makeStartRunStub();

    scene.startRun();
    const summary = scene.runSession.finish({
      survivalMs: 1200,
      score: 10,
      kills: 1,
      maxCombo: 1,
      lastSaveCount: 0,
      remainingEnergy: 90,
      endReason: "manual_restart",
    });

    expect(scene.wave.hasDifficulty()).toBe(true);
    expect(summary).toMatchObject({
      modeId: "ranked",
      difficulty: "elite",
      seed: 12345,
      endReason: "manual_restart",
    });
    expect(scene.runConfig.rules.rankingEligible).toBe(false);
  });

  it("upgrades ranked config only when a server-verified start is provided", () => {
    const scene = makeStartRunStub();
    scene.pendingRunStart = createServerVerifiedRankedStart({
      difficulty: "defender",
      seed: 777,
      runToken: "server-ranked-run-777",
      configVersion: "server-ranked-2026w27",
      issuedAtMs: Date.now() - 1000,
      expiresAtMs: Date.now() + 60_000,
    });

    scene.startRun();
    const summary = scene.runSession.finish({
      survivalMs: 1200,
      score: 10,
      kills: 1,
      maxCombo: 1,
      lastSaveCount: 0,
      remainingEnergy: 90,
      endReason: "manual_restart",
    });

    expect(summary).toMatchObject({
      runToken: "server-ranked-run-777",
      seed: 777,
      difficulty: "defender",
    });
    expect(scene.runConfig.configVersion).toBe("server-ranked-2026w27");
    expect(scene.runConfig.rules.rankingEligible).toBe(true);
  });

  it("keeps ranked server stubs local-only", () => {
    const scene = makeStartRunStub();
    scene.pendingRunStart = createRankedServerStubStart("elite", 777, "server-preview-2026w27");

    scene.startRun();
    const summary = scene.runSession.finish({
      survivalMs: 1200,
      score: 10,
      kills: 1,
      maxCombo: 1,
      lastSaveCount: 0,
      remainingEnergy: 90,
      endReason: "manual_restart",
    });

    expect(summary).toMatchObject({
      runToken: "local-777",
      seed: 777,
      difficulty: "elite",
    });
    expect(scene.runConfig.rules.rankingEligible).toBe(false);
  });

  it("keeps graviton pull disabled for ranked replay determinism", () => {
    const target = enemyState({ id: 1, radius: 500 });
    const graviton = enemyState({
      id: 2,
      type: "graviton_core",
      radius: 560,
      behavior: "orbit_pull",
      gravityPullRadiusPx: 120,
    });
    const alive = [target, graviton];
    const ranked: any = Object.create(GameScene.prototype);
    ranked.runConfig = buildRunConfig("ranked", { seed: 777 });
    const freeDefense: any = Object.create(GameScene.prototype);
    freeDefense.runConfig = buildRunConfig("freeDefense", { seed: 777 });

    expect(ranked.movementDtForEnemy(target, 1000, alive)).toBe(1000);
    expect(freeDefense.movementDtForEnemy(target, 1000, alive)).toBeGreaterThan(1000);
    expect(freeDefense.movementDtForEnemy(graviton, 1000, alive)).toBe(1000);
  });

  it("suppresses time-based visual effects when reduced motion is requested", () => {
    const scene = new GameScene(buildRunConfig("freeDefense"), { showResultOverlay: false, reducedMotion: true } as never);

    expect((scene as any).slashTrail.container.visible).toBe(false);
    expect((scene as any).laser.container.visible).toBe(false);
    expect((scene as any).destructionBurst.container.visible).toBe(false);
    expect((scene as any).hitBurst.container.visible).toBe(false);
  });
});
