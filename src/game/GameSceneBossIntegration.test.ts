import { describe, expect, it, vi } from "vitest";
import { GameScene } from "./GameScene";
import { RunSession } from "./RunSession";
import type { EarthRef, HitResult } from "./types";

const earth: EarthRef = { cx: 540, cy: 900, r: 58 };
const bossHit: HitResult = { enemyId: 1, band: "outer", accuracy: "bossWeak" };

function makeSceneStub() {
  const scene: any = Object.create(GameScene.prototype);
  scene.elapsedMs = 13000;
  scene.bossKills = 0;
  scene.defeatedBossIds = [];
  scene.gauge = 0;
  scene.runConfig = { modeId: "freeDefense", difficulty: "rookie" };
  scene.scoringCfg = { comboChainTimeoutMs: 650 };
  scene.scoring = {
    onHit: vi.fn(() => ({ gauge: 0, combo: 0, lastSave: false })),
  };
  scene.hud = { flashBanner: vi.fn(), flashBlockedWeakPoint: vi.fn() };
  scene.destructionBurst = { spawn: vi.fn() };
  scene.hitBurst = { spawn: vi.fn() };
  scene.earth = { flashLastSave: vi.fn() };
  scene.bossRuntime = { recordBossSpawned: vi.fn(), recordBossDefeated: vi.fn(), recordThreatPressure: vi.fn() };
  return scene;
}

describe("GameScene boss integration", () => {
  it("records boss defeat using run elapsed time rather than pointer timestamps", () => {
    const scene = makeSceneStub();

    scene.commitKills(
      [
        {
          hit: bossHit,
          score: 1600,
          type: "eclipse_core",
          x: 540,
          y: 300,
          hitAtMs: 999999,
          boss: true,
        },
      ],
      earth,
      true,
    );

    expect(scene.bossRuntime.recordBossDefeated).toHaveBeenCalledWith("eclipse_core", 13000);
    expect(scene.bossKills).toBe(1);
    expect(scene.defeatedBossIds).toEqual(["eclipse_core"]);
  });

  it("feeds kill groups into boss threat pressure with combo and Last Save context", () => {
    const scene = makeSceneStub();
    scene.scoring.onHit = vi.fn(() => ({ gauge: 12, combo: 5, lastSave: true }));

    scene.commitKills(
      [
        { hit: { enemyId: 1, band: "outer", accuracy: "normal" }, score: 100, type: "basic_meteor", x: 100, y: 100, hitAtMs: 1000 },
        { hit: { enemyId: 2, band: "lastSave", accuracy: "normal" }, score: 100, type: "fast_comet", x: 200, y: 200, hitAtMs: 1010 },
      ],
      earth,
      true,
    );

    expect(scene.bossRuntime.recordThreatPressure).toHaveBeenCalledWith({ kills: 2, combo: 5, lastSave: true, bossWeakHits: 0 });
  });

  it("adds an actual commitKills gauge reward to every skill without merging balances", () => {
    const scene = makeSceneStub();
    scene.skillCharges.set("solar_lance", 10);
    scene.skillCharges.set("nova_pulse", 40);
    scene.scoring.onHit = vi.fn(() => ({ gauge: 12, combo: 1, lastSave: false }));

    scene.commitKills(
      [{ hit: { enemyId: 1, band: "outer", accuracy: "normal" }, score: 100, type: "basic_meteor", x: 100, y: 100, hitAtMs: 1000 }],
      earth,
      true,
    );

    expect(scene.skillCharges.get("solar_lance")).toBe(22);
    expect(scene.skillCharges.get("nova_pulse")).toBe(52);
  });

  it("records shield-absorbed boss defeats through the same boss runtime path", () => {
    const scene = makeSceneStub();

    scene.recordBossDefeat("eclipse_core");

    expect(scene.bossRuntime.recordBossDefeated).toHaveBeenCalledWith("eclipse_core", 13000);
    expect(scene.bossKills).toBe(1);
  });

  it("delta shield absorbs a boss impact without counting it as a boss defeat", () => {
    const scene = makeSceneStub();
    scene.deltaShieldRemainingMs = 3000;
    scene.deltaShieldAbsorbs = 1;
    scene.objects = { kill: vi.fn() };
    scene.removeSprite = vi.fn();
    scene.triggerEnemyHitFeedback = vi.fn();
    scene.enemyVisualScale = vi.fn(() => 1);

    const boss = {
      id: 7,
      type: "ringed_destroyer",
      angle: 0,
      radius: 70,
      angularSpeed: 0,
      approachSpeed: 0,
      radiusPx: 200,
      earthImpactRadiusPx: 10,
      directional: false,
      hp: 50,
      maxHp: 50,
      damage: 20,
      score: 5000,
      boss: true,
      alive: true,
    };

    scene.applyDeltaShieldAbsorb(boss);

    expect(scene.bossRuntime.recordBossDefeated).not.toHaveBeenCalled();
    expect(scene.objects.kill).not.toHaveBeenCalled();
    expect(scene.removeSprite).not.toHaveBeenCalled();
    expect(scene.deltaShieldAbsorbs).toBe(0);
    expect(boss.radius).toBeGreaterThan(70);
  });

  it("does not damage or score blocked boss body hits", () => {
    const scene = makeSceneStub();
    scene.strokeHitTracker = { recordHit: vi.fn() };
    scene.runSession = { recordHit: vi.fn() };
    scene.triggerEnemyHitFeedback = vi.fn();
    scene.objects = {
      applyDamage: vi.fn(() => ({
        killed: false,
        enemy: {
          id: 1,
          spawnOrdinal: 7,
          type: "ringed_destroyer",
          angle: 0,
          radius: 300,
          angularSpeed: 0,
          approachSpeed: 0,
          radiusPx: 100,
          earthImpactRadiusPx: 10,
          directional: false,
          hp: 58,
          maxHp: 58,
          damage: 10,
          score: 3000,
          boss: true,
          alive: true,
        },
      })),
    };

    const kills = scene.applyHits(
      [{ enemyId: 1, band: "outer", accuracy: "normal", damageMultiplier: 0, blocked: true, blockReason: "boss_body_locked" }],
      1,
      2000,
      "slash",
    );

    expect(kills).toEqual([]);
    expect(scene.objects.applyDamage).not.toHaveBeenCalled();
    expect(scene.runSession.recordHit).not.toHaveBeenCalled();
    expect(scene.hud.flashBanner).toHaveBeenCalledWith(expect.any(String), 0xffc14d);
    expect(scene.hud.flashBlockedWeakPoint).toHaveBeenCalledWith(expect.stringContaining("약점"), expect.stringContaining("큰 피해"));
  });

  it("reuses the final hit semantic sequence when committing a ranked kill", () => {
    const scene = makeSceneStub();
    scene.strokeHitTracker = { recordHit: vi.fn() };
    const runSession = new RunSession({ difficulty: "rookie", runToken: "server-ranked-run-final-hit", seed: 42 });
    scene.runSession = runSession;
    scene.triggerEnemyHitFeedback = vi.fn();
    scene.removeSprite = vi.fn();
    scene.objects = {
      applyDamage: vi.fn(() => ({
        killed: true,
        enemy: {
          id: 5,
          spawnOrdinal: 9,
          type: "shard_meteor",
          angle: 0,
          radius: 900,
          angularSpeed: 0,
          approachSpeed: 0,
          radiusPx: 64,
          earthImpactRadiusPx: 10,
          directional: false,
          hp: 0,
          maxHp: 1,
          damage: 2,
          score: 35,
          alive: false,
        },
      })),
    };

    const kills = scene.applyHits(
      [{ enemyId: 5, band: "outer", accuracy: "normal" }],
      1,
      2_000,
      "slash",
      { a: { x: 1_400, y: 900, t: 1_984 }, b: { x: 1_500, y: 900, t: 2_000 } },
    );
    scene.commitKills(kills, earth, true);

    expect(runSession.replayTraceSnapshot()).toMatchObject({
      hitEvents: [{ spawnOrdinal: 9, eventSequence: 1 }],
      killEvents: [{ spawnOrdinal: 9, eventSequence: 1 }],
    });
  });

  it("exposes a deterministic blocked boss body QA preset", () => {
    const scene = makeSceneStub();
    scene.enemies = {
      ringed_destroyer: {
        angularSpeed: 0,
        approachSpeed: 0,
      },
    };
    scene.earth = { ref: vi.fn(() => earth), flashLastSave: vi.fn() };
    scene.spawnWithReplay = vi.fn((spawns) => spawns);
    scene.strokeHitTracker = { recordHit: vi.fn() };
    scene.triggerEnemyHitFeedback = vi.fn();
    scene.objects = {
      getAlive: vi.fn(() => [
        {
          id: 99,
          type: "ringed_destroyer",
          angle: -Math.PI / 2,
          radius: 390,
          angularSpeed: 0,
          approachSpeed: 0,
          radiusPx: 365,
          earthImpactRadiusPx: 10,
          directional: false,
          hp: 50,
          maxHp: 50,
          damage: 20,
          score: 5000,
          boss: true,
          alive: true,
        },
      ]),
      applyDamage: vi.fn(),
    };

    scene.spawnDevQaPreset("blockedBody");

    expect(scene.spawnWithReplay).toHaveBeenCalledWith([
      expect.objectContaining({
        enemyType: "ringed_destroyer",
        startAngleRad: -Math.PI / 2,
        startRadius: 390,
      }),
    ]);
    expect(scene.bossRuntime.recordBossSpawned).toHaveBeenCalledWith("ringed_destroyer");
    expect(scene.strokeHitTracker.recordHit).toHaveBeenCalledWith(99, 13000);
    expect(scene.objects.applyDamage).not.toHaveBeenCalled();
    expect(scene.hud.flashBanner).toHaveBeenCalledWith(expect.stringContaining("약점"), 0xffc14d);
    expect(scene.hud.flashBlockedWeakPoint).toHaveBeenCalledWith(expect.stringContaining("약점"), expect.stringContaining("큰 피해"));
    expect(scene.hitBurst.spawn).toHaveBeenCalledWith(540, 510, expect.stringContaining("약점"), 0xffc14d, 140, false, expect.any(Object));
  });

  it("renders a distinct wrong-angle burst for directional rejects without damage", () => {
    const scene = makeSceneStub();
    scene.strokeDirectionalRejects = new Set<number>();
    scene.strokeHitTracker = { canHit: vi.fn(() => true) };
    scene.enemyVisualScale = vi.fn(() => 1);
    scene.zones = { outer: 2.6, mid: 1.8, danger: 1.25, impact: 1 };
    scene.objects = {
      getAlive: vi.fn(() => [
        {
          id: 3,
          type: "directional_comet",
          angle: 0,
          radius: 300,
          angularSpeed: 0,
          approachSpeed: 0,
          radiusPx: 80,
          earthImpactRadiusPx: 10,
          directional: true,
          directionalSlashAngleRad: 0,
          directionalToleranceDeg: 24,
          hp: 11,
          maxHp: 11,
          damage: 10,
          score: 800,
          alive: true,
        },
      ]),
    };

    scene.spawnDirectionalRejectFeedback({ a: { x: 840, y: 760, t: 0 }, b: { x: 840, y: 1040, t: 16 } }, earth);

    expect(scene.destructionBurst.spawn).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.objectContaining({
      color: 0xff5a66,
      secondaryColor: 0x8ff3ff,
    }));
    expect(scene.hitBurst.spawn).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), "각도!", 0x8ff3ff, expect.any(Number), false, expect.objectContaining({
      labelScale: 0.72,
      ringWidth: 4,
      lifeMs: 420,
    }));
    expect(scene.objects.applyDamage).toBeUndefined();
  });

  it("builds spread shard spawns around an active boss", () => {
    const scene = makeSceneStub();
    scene.enemies = {
      shard_meteor: {
        startRadius: 620,
        approachSpeed: 120,
        angularSpeed: 0.08,
      },
    };

    const specs = scene.bossShardSpawnSpecs(
      {
        kind: "spawn",
        bossType: "ringed_destroyer",
        shardEnemyType: "shard_meteor",
        patternKind: "ring_shards",
        phaseLabel: "approach",
        count: 5,
        spreadDeg: 80,
        spawnRadiusOffset: 190,
        telegraphLeadMs: 1500,
      },
      {
        id: 99,
        type: "ringed_destroyer",
        angle: Math.PI / 2,
        radius: 380,
        angularSpeed: 0,
        approachSpeed: 0,
        radiusPx: 365,
        earthImpactRadiusPx: 10,
        directional: false,
        hp: 58,
        maxHp: 58,
        damage: 20,
        score: 5000,
        boss: true,
        alive: true,
      },
    );

    expect(specs).toHaveLength(5);
    expect(specs[0]).toMatchObject({ enemyType: "shard_meteor", spawnAtMs: 13000, startRadius: 570 });
    expect(specs[2]?.startAngleRad).toBeCloseTo(Math.PI / 2);
    expect(specs[0]!.startAngleRad).toBeLessThan(specs[4]!.startAngleRad);
  });

  it("routes boss phase-action bursts through replay-aware boss shard spawning", () => {
    const scene = makeSceneStub();
    scene.enemies = {
      fire_meteor: {
        startRadius: 620,
        approachSpeed: 120,
        angularSpeed: 0.08,
      },
    };
    scene.spawnWithReplay = vi.fn((specs) => specs);

    const boss = {
      id: 99,
      spawnOrdinal: 42,
      type: "lava_titan",
      angle: Math.PI / 2,
      radius: 380,
      angularSpeed: 0,
      approachSpeed: 0,
      radiusPx: 365,
      earthImpactRadiusPx: 10,
      directional: false,
      hp: 30,
      maxHp: 66,
      damage: 20,
      score: 5000,
      boss: true,
      alive: true,
    };

    scene.spawnBossShardEvent(
      {
        kind: "phase_action",
        bossType: "lava_titan",
        shardEnemyType: "fire_meteor",
        patternKind: "lane_pressure",
        phaseLabel: "pressure",
        count: 3,
        spreadDeg: 36,
        spawnRadiusOffset: 220,
        telegraphLeadMs: 0,
      },
      boss,
    );

    expect(scene.spawnWithReplay).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ enemyType: "fire_meteor", spawnAtMs: 13000 }),
    ]), expect.any(Function), 42);
  });

  it("applies active boss phase pressure to the normal wave interval multiplier", () => {
    const scene = makeSceneStub();
    scene.objects = {
      getAlive: vi.fn(() => [
        {
          type: "ringed_destroyer",
          hp: 10,
          maxHp: 58,
          boss: true,
        },
      ]),
    };

    expect(scene.bossWaveSpawnIntervalMultiplier()).toBeLessThan(1);
  });
});
