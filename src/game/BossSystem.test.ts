import { describe, expect, it } from "vitest";
import { BOSS_DEFINITIONS } from "./BossDefinitions";
import {
  BossEncounterRuntime,
  bossPhaseForEnemy,
  bossPatternForEnemy,
  bossWaveSpawnIntervalMultiplierForEnemy,
  bossWeakPointLocalCircles,
  resolveBossWeakPointHit,
} from "./BossSystem";

describe("BossEncounterRuntime", () => {
  it("defers an overdue periodic boss without activating it", () => {
    const runtime = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 60_000,
      bossEnemyType: "eclipse_core",
    });

    runtime.deferUntil(60_000);

    expect(runtime.nextSpawns(60_000, false)).toEqual([]);
    expect(runtime.nextSpawns(119_999, false)).toEqual([]);
    expect(runtime.nextSpawns(120_000, false)).toEqual([{ enemyType: "eclipse_core", spawnAtMs: 120_000 }]);
  });

  it("starts boss rush with a sequence boss and waits for defeat before the next boss", () => {
    const runtime = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 0,
      bossEnemyType: "eclipse_core",
      sequence: ["eclipse_core", "ringed_destroyer"],
      firstBossDelayMs: 1500,
      respawnDelayMs: 8000,
    });

    expect(runtime.nextSpawns(1499, false)).toEqual([]);
    expect(runtime.nextSpawns(1500, false)).toEqual([{ enemyType: "eclipse_core", spawnAtMs: 1500 }]);

    runtime.recordBossSpawned("eclipse_core");
    expect(runtime.nextSpawns(9000, true)).toEqual([]);

    runtime.recordBossDefeated("eclipse_core", 5000);
    expect(runtime.nextSpawns(12999, false)).toEqual([]);
    expect(runtime.nextSpawns(13000, false)).toEqual([{ enemyType: "ringed_destroyer", spawnAtMs: 13000 }]);
  });

  it("marks the sequence complete after the final boss is defeated", () => {
    const runtime = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 0,
      bossEnemyType: "eclipse_core",
      sequence: ["eclipse_core"],
      firstBossDelayMs: 1500,
      respawnDelayMs: 8000,
    });

    runtime.nextSpawns(1500, false);
    runtime.recordBossSpawned("eclipse_core");
    runtime.recordBossDefeated("eclipse_core", 3000);

    expect(runtime.sequenceComplete()).toBe(true);
    expect(runtime.defeatedBosses()).toEqual(["eclipse_core"]);
  });

  it("reports runtime countdown for boss rush respawns", () => {
    const runtime = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 0,
      bossEnemyType: "eclipse_core",
      sequence: ["eclipse_core", "ringed_destroyer"],
      firstBossDelayMs: 1500,
      respawnDelayMs: 8000,
    });

    expect(runtime.nextBossInMs(1000)).toBe(500);
    runtime.nextSpawns(1500, false);
    runtime.recordBossSpawned("eclipse_core");
    runtime.recordBossDefeated("eclipse_core", 3000);
    expect(runtime.nextBossInMs(8000)).toBe(3000);
  });

  it("lets skillful play advance periodic boss threat without changing boss-rush sequencing", () => {
    const runtime = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 60000,
      bossEnemyType: "eclipse_core",
    });

    runtime.tick(10000);
    expect(runtime.nextBossInMs(10000)).toBe(50000);

    runtime.recordThreatPressure({ kills: 3, combo: 4, lastSave: true });

    expect(runtime.nextBossInMs(10000)).toBeLessThan(50000);
    expect(runtime.threatPercent()).toBeGreaterThan(16);

    const rush = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 0,
      bossEnemyType: "eclipse_core",
      sequence: ["ringed_destroyer", "lava_titan"],
      firstBossDelayMs: 1500,
    });
    rush.tick(500);
    rush.recordThreatPressure({ kills: 8, combo: 10, lastSave: true });

    expect(rush.nextBossInMs(500)).toBe(1000);
  });

  it("maps boss hp ratio into approach, pressure, and enrage phases", () => {
    expect(bossPhaseForEnemy({ type: "eclipse_core", hp: 50, maxHp: 50, boss: true })?.label).toBe("approach");
    expect(bossPhaseForEnemy({ type: "eclipse_core", hp: 30, maxHp: 50, boss: true })?.label).toBe("pressure");
    expect(bossPhaseForEnemy({ type: "eclipse_core", hp: 10, maxHp: 50, boss: true })?.label).toBe("enrage");
  });

  it("resolves boss weak-point hits from world-space slash segments", () => {
    const enemy = {
      id: 1,
      type: "eclipse_core",
      angle: 0,
      radius: 300,
      radiusPx: 100,
      hp: 50,
      maxHp: 50,
      boss: true,
    };

    expect(resolveBossWeakPointHit(
      { a: { x: 850, y: 900, t: 0 }, b: { x: 950, y: 900, t: 16 } },
      enemy,
      540,
      900,
      1,
    )).toMatchObject({ accuracy: "bossWeak", weakPointIndex: 0, damageMultiplier: 1.35 });

    expect(resolveBossWeakPointHit(
      { a: { x: 810, y: 760, t: 0 }, b: { x: 810, y: 820, t: 16 } },
      enemy,
      540,
      900,
      1,
    )).toMatchObject({ accuracy: "normal" });
  });

  it("exposes a phase pattern for the active boss phase", () => {
    expect(bossPatternForEnemy({ type: "eclipse_core", hp: 50, maxHp: 50, boss: true })?.kind).toBe("ring_shards");
    expect(bossPatternForEnemy({ type: "eclipse_core", hp: 12, maxHp: 50, boss: true })?.kind).toBe("core_open");
  });

  it("translates boss phase spawn weight into conservative wave pressure", () => {
    const noBoss = bossWaveSpawnIntervalMultiplierForEnemy({ type: "basic_meteor", hp: 1, maxHp: 1, boss: false });
    const approach = bossWaveSpawnIntervalMultiplierForEnemy({ type: "ringed_destroyer", hp: 58, maxHp: 58, boss: true });
    const pressure = bossWaveSpawnIntervalMultiplierForEnemy({ type: "ringed_destroyer", hp: 30, maxHp: 58, boss: true });
    const enrage = bossWaveSpawnIntervalMultiplierForEnemy({ type: "ringed_destroyer", hp: 10, maxHp: 58, boss: true });

    expect(noBoss).toBe(1);
    expect(approach).toBe(1);
    expect(pressure).toBeLessThan(approach);
    expect(enrage).toBeLessThan(pressure);
    expect(enrage).toBeGreaterThanOrEqual(0.76);
  });

  it("locks Ringed Destroyer body damage until the body phase opens", () => {
    const enemy = {
      type: "ringed_destroyer",
      angle: 0,
      radius: 300,
      radiusPx: 100,
      hp: 58,
      maxHp: 58,
      boss: true,
    };

    expect(resolveBossWeakPointHit(
      { a: { x: 800, y: 860, t: 0 }, b: { x: 820, y: 940, t: 16 } },
      enemy,
      540,
      900,
      1,
    )).toMatchObject({ accuracy: "normal", blocked: true, blockReason: "boss_body_locked", damageMultiplier: 0 });

    const bodyOpenEnemy = { ...enemy, hp: 20 };
    expect(resolveBossWeakPointHit(
      { a: { x: 800, y: 860, t: 0 }, b: { x: 820, y: 940, t: 16 } },
      bodyOpenEnemy,
      540,
      900,
      1,
    )).toMatchObject({ accuracy: "bossWeak", weakPointZone: "body" });
  });

  it("exposes only Ringed Destroyer ring weak points before the body phase", () => {
    const ringPhase = bossWeakPointLocalCircles({ type: "ringed_destroyer", radiusPx: 100, hp: 58, maxHp: 58, boss: true });
    const bodyPhase = bossWeakPointLocalCircles({ type: "ringed_destroyer", radiusPx: 100, hp: 20, maxHp: 58, boss: true });

    expect(ringPhase.map((circle) => circle.zone)).toEqual(["ring", "ring"]);
    expect(bodyPhase.map((circle) => circle.zone)).toEqual(["body"]);
  });

  it("adds readable marker styles to active boss weak points", () => {
    const ringPhase = bossWeakPointLocalCircles({ type: "ringed_destroyer", radiusPx: 100, hp: 58, maxHp: 58, boss: true });
    const bodyPhase = bossWeakPointLocalCircles({ type: "ringed_destroyer", radiusPx: 100, hp: 20, maxHp: 58, boss: true });
    const lavaCores = bossWeakPointLocalCircles({ type: "lava_titan", radiusPx: 100, hp: 66, maxHp: 66, boss: true });

    expect(ringPhase[0]).toMatchObject({
      markerKind: "ring_node",
      color: BOSS_DEFINITIONS.ringed_destroyer.visualTheme.weakRingColor,
      haloColor: BOSS_DEFINITIONS.ringed_destroyer.visualTheme.weakHaloColor,
    });
    expect(bodyPhase[0]).toMatchObject({
      markerKind: "body_crack",
      color: BOSS_DEFINITIONS.ringed_destroyer.visualTheme.weakBodyColor,
    });
    expect(lavaCores.map((circle) => circle.markerKind)).toEqual(["core_orb", "core_orb", "core_orb"]);
    expect(lavaCores[0]?.strokeWidth).toBeGreaterThan(3);
    expect(lavaCores[0]?.fillAlpha).toBeGreaterThan(0.3);
  });

  it("emits Ringed Destroyer shard warning and spawn events while active", () => {
    const runtime = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 0,
      bossEnemyType: "ringed_destroyer",
      sequence: ["ringed_destroyer"],
      firstBossDelayMs: 1000,
    });

    runtime.nextSpawns(1000, false);
    runtime.recordBossSpawned("ringed_destroyer", 1000);

    expect(runtime.nextShardEvents({ type: "ringed_destroyer", hp: 58, maxHp: 58, boss: true }, 5999)).toEqual([]);
    expect(runtime.nextShardEvents({ type: "ringed_destroyer", hp: 58, maxHp: 58, boss: true }, 6000)).toMatchObject([
      { kind: "warning", bossType: "ringed_destroyer", shardEnemyType: "shard_meteor" },
    ]);
    expect(runtime.nextShardEvents({ type: "ringed_destroyer", hp: 58, maxHp: 58, boss: true }, 7500)).toMatchObject([
      { kind: "spawn", bossType: "ringed_destroyer", count: 5, patternKind: "ring_shards", phaseLabel: "approach" },
    ]);
  });

  it("applies active phase pattern profiles to boss shard attacks", () => {
    const approachRuntime = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 0,
      bossEnemyType: "lava_titan",
      sequence: ["lava_titan"],
      firstBossDelayMs: 1000,
    });
    approachRuntime.nextSpawns(1000, false);
    approachRuntime.recordBossSpawned("lava_titan", 1000);

    expect(approachRuntime.nextShardEvents({ type: "lava_titan", hp: 66, maxHp: 66, boss: true }, 5400)).toMatchObject([
      {
        kind: "warning",
        bossType: "lava_titan",
        shardEnemyType: "fire_meteor",
        patternKind: "core_open",
        phaseLabel: "approach",
        count: 8,
        spreadDeg: 300,
      },
    ]);

    const pressureRuntime = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 0,
      bossEnemyType: "lava_titan",
      sequence: ["lava_titan"],
      firstBossDelayMs: 1000,
    });
    pressureRuntime.nextSpawns(1000, false);
    pressureRuntime.recordBossSpawned("lava_titan", 1000);

    const pressureEvents = pressureRuntime.nextShardEvents({ type: "lava_titan", hp: 30, maxHp: 66, boss: true }, 5400);
    expect(pressureEvents).toMatchObject([
      {
        kind: "warning",
        bossType: "lava_titan",
        shardEnemyType: "fire_meteor",
        patternKind: "lane_pressure",
        phaseLabel: "pressure",
        count: 9,
      },
    ]);
    expect(pressureEvents[0]?.spreadDeg).toBeCloseTo(52.8);
  });

  it("keeps Ice and Dark boss shard attacks visually distinct", () => {
    const ice = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 0,
      bossEnemyType: "ice_colossus",
      sequence: ["ice_colossus"],
      firstBossDelayMs: 1000,
    });
    ice.nextSpawns(1000, false);
    ice.recordBossSpawned("ice_colossus", 1000);

    expect(ice.nextShardEvents({ type: "ice_colossus", hp: 72, maxHp: 72, boss: true }, 6700)).toMatchObject([
      { kind: "warning", shardEnemyType: "ice_comet", patternKind: "lane_pressure", phaseLabel: "approach" },
    ]);

    const dark = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 0,
      bossEnemyType: "dark_planet",
      sequence: ["dark_planet"],
      firstBossDelayMs: 1000,
    });
    dark.nextSpawns(1000, false);
    dark.recordBossSpawned("dark_planet", 1000);

    expect(dark.nextShardEvents({ type: "dark_planet", hp: 20, maxHp: 84, boss: true }, 5700)).toMatchObject([
      { kind: "warning", shardEnemyType: "dark_meteor", patternKind: "ring_shards", phaseLabel: "enrage" },
    ]);
  });

  it("emits one phase-action burst and resets the shard timer when a boss changes phase", () => {
    const runtime = new BossEncounterRuntime({
      enabled: true,
      bossEveryMs: 0,
      bossEnemyType: "lava_titan",
      sequence: ["lava_titan"],
      firstBossDelayMs: 1000,
    });
    runtime.nextSpawns(1000, false);
    runtime.recordBossSpawned("lava_titan", 1000);

    expect(runtime.nextPhaseActionEvents({ type: "lava_titan", hp: 66, maxHp: 66, boss: true }, 2000)).toEqual([]);
    expect(runtime.nextPhaseActionEvents({ type: "lava_titan", hp: 30, maxHp: 66, boss: true }, 3000)).toMatchObject([
      {
        kind: "phase_action",
        bossType: "lava_titan",
        shardEnemyType: "fire_meteor",
        patternKind: "lane_pressure",
        phaseLabel: "pressure",
        count: 9,
      },
    ]);
    expect(runtime.nextPhaseActionEvents({ type: "lava_titan", hp: 30, maxHp: 66, boss: true }, 3001)).toEqual([]);
    expect(runtime.nextShardEvents({ type: "lava_titan", hp: 30, maxHp: 66, boss: true }, 7399)).toEqual([]);
    expect(runtime.nextShardEvents({ type: "lava_titan", hp: 30, maxHp: 66, boss: true }, 7400)).toMatchObject([
      { kind: "warning", phaseLabel: "pressure", patternKind: "lane_pressure" },
    ]);

    expect(runtime.nextPhaseActionEvents({ type: "lava_titan", hp: 18, maxHp: 66, boss: true }, 9000)).toMatchObject([
      {
        kind: "phase_action",
        bossType: "lava_titan",
        shardEnemyType: "fire_meteor",
        patternKind: "ring_shards",
        phaseLabel: "enrage",
      },
    ]);
  });

  it("gives Lava, Ice, and Dark bosses distinct weak-point and objective contracts", () => {
    expect(BOSS_DEFINITIONS.lava_titan.phases.map((phase) => phase.objectiveKey)).toContain("boss.objective.lava_titan.cores");
    expect(bossWeakPointLocalCircles({ type: "lava_titan", radiusPx: 100, hp: 50, maxHp: 50, boss: true })).toHaveLength(3);
    expect(resolveBossWeakPointHit(
      { a: { x: 830, y: 890, t: 0 }, b: { x: 850, y: 910, t: 16 } },
      { type: "lava_titan", angle: 0, radius: 300, radiusPx: 100, hp: 66, maxHp: 66, boss: true },
      540,
      900,
      1,
    )).toMatchObject({ blocked: true, blockReason: "boss_body_locked", damageMultiplier: 0 });
    expect(resolveBossWeakPointHit(
      { a: { x: 830, y: 850, t: 0 }, b: { x: 850, y: 858, t: 16 } },
      { type: "lava_titan", angle: 0, radius: 300, radiusPx: 100, hp: 66, maxHp: 66, boss: true },
      540,
      900,
      1,
    )).toMatchObject({ accuracy: "bossWeak", weakPointId: "lava-core-c", weakPointZone: "core" });
    expect(bossWeakPointLocalCircles({ type: "lava_titan", radiusPx: 100, hp: 30, maxHp: 66, boss: true }).map((circle) => circle.id)).toEqual(["lava-heart"]);

    expect(BOSS_DEFINITIONS.ice_colossus.requiresWeakPointDamage).toBe(true);
    expect(resolveBossWeakPointHit(
      { a: { x: 800, y: 860, t: 0 }, b: { x: 820, y: 940, t: 16 } },
      { type: "ice_colossus", angle: 0, radius: 300, radiusPx: 100, hp: 50, maxHp: 50, boss: true },
      540,
      900,
      1,
    )).toMatchObject({ blocked: true, blockReason: "boss_body_locked" });

    expect(BOSS_DEFINITIONS.dark_planet.phases.map((phase) => phase.objectiveKey)).toContain("boss.objective.dark_planet.falseWeak");
    expect(BOSS_DEFINITIONS.dark_planet.requiresWeakPointDamage).toBe(true);
    expect(BOSS_DEFINITIONS.dark_planet.weakPoints.some((weak) => weak.activePhaseLabels?.includes("enrage"))).toBe(true);
    expect(resolveBossWeakPointHit(
      { a: { x: 840, y: 880, t: 0 }, b: { x: 840, y: 920, t: 16 } },
      { type: "dark_planet", angle: 0, radius: 300, radiusPx: 100, hp: 40, maxHp: 84, boss: true },
      540,
      900,
      1,
    )).toMatchObject({ blocked: true, blockReason: "boss_body_locked", damageMultiplier: 0 });
  });
});
