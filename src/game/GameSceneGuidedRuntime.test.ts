import { describe, expect, it, vi } from "vitest";
import { GameScene } from "./GameScene";
import { buildRunConfig } from "./ModeConfig";
import { EARTH_ENEMY_IMPACT_RADIUS_PX, EARTH_GAMEPLAY_RADIUS } from "./coords";
import { enemyXY } from "./Enemy";
import type { EarthRef, Point } from "./types";

const earth: EarthRef = { cx: 540, cy: 900, r: EARTH_GAMEPLAY_RADIUS };
const horizontalLance: Point[] = [
  { x: 120, y: 900, t: 0 },
  { x: 960, y: 900, t: 100 },
];

describe("GameScene guided runtime integration", () => {
  it("kills both live Solar Lance targets through scoring and replay before entering reward", () => {
    const scene = new GameScene(
      buildRunConfig("story", { storyStageId: "story-1" }),
      { showResultOverlay: false, guidedTutorialInitialStep: "solar_lance" },
    );
    const runtime = scene as any;
    const targetOrdinals = runtime.objects.getAlive().map((enemy: { spawnOrdinal: number }) => enemy.spawnOrdinal);
    const onStep = vi.fn();
    scene.onGuidedTutorialStep = onStep;

    runtime.resolveInput(horizontalLance, earth);

    const score = runtime.scoring.snapshot();
    const replay = runtime.runSession.replayTraceSnapshot();
    expect(runtime.guidedTutorialFlow.step).toBe("reward");
    expect(runtime.objects.getAlive()).toHaveLength(0);
    expect(score.kills).toBe(2);
    expect(score.score).toBeGreaterThan(0);
    expect(replay.hitEvents).toHaveLength(2);
    expect(replay.hitEvents.every((event: { source?: string }) => event.source === "solar_lance")).toBe(true);
    expect(replay.killEvents).toHaveLength(2);
    expect(replay.killEvents.map((event: { spawnOrdinal: number }) => event.spawnOrdinal).sort()).toEqual([...targetOrdinals].sort());
    expect(runtime.skillCharges.get("solar_lance")).toBeLessThan(100);
    expect(runtime.skills.cooldownRemaining("solar_lance")).toBeGreaterThan(0);
    expect(onStep).toHaveBeenCalledOnce();
  });

  it("keeps Solar training on miss, refunds charge/cooldown, and restores two targets idempotently", () => {
    const scene = new GameScene(buildRunConfig("story", { storyStageId: "story-1" }), {
      showResultOverlay: false,
      guidedTutorialInitialStep: "solar_lance",
    });
    const runtime = scene as any;
    const initialIds = [...runtime.guidedScenarioEnemyIds];
    const onStep = vi.fn();
    scene.onGuidedTutorialStep = onStep;

    runtime.resolveInput([{ x: 540, y: 480, t: 0 }, { x: 540, y: 1320, t: 100 }], earth);
    runtime.spawnGuidedStoryScenario();

    expect(runtime.guidedTutorialFlow.step).toBe("solar_lance");
    expect(runtime.skillCharges.get("solar_lance")).toBe(100);
    expect(runtime.skills.cooldownRemaining("solar_lance")).toBe(0);
    expect([...runtime.guidedScenarioEnemyIds].sort()).toEqual(initialIds.sort());
    expect(runtime.guidedScenarioEnemyIds.size).toBe(2);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("keeps Solar training on a partial hit, preserves the survivor, and replenishes only one target", () => {
    const scene = new GameScene(buildRunConfig("story", { storyStageId: "story-1" }), {
      showResultOverlay: false,
      guidedTutorialInitialStep: "solar_lance",
    });
    const runtime = scene as any;
    const targets = runtime.objects.getAlive();
    const survivor = targets[1];
    survivor.angle = Math.PI / 2;
    const onStep = vi.fn();
    scene.onGuidedTutorialStep = onStep;

    runtime.resolveInput(horizontalLance, earth);

    expect(runtime.guidedTutorialFlow.step).toBe("solar_lance");
    expect(runtime.scoring.snapshot().kills).toBe(1);
    expect(runtime.skillCharges.get("solar_lance")).toBe(100);
    expect(runtime.skills.cooldownRemaining("solar_lance")).toBe(0);
    expect(runtime.guidedScenarioEnemyIds.size).toBe(2);
    expect(runtime.guidedScenarioEnemyIds.has(survivor.id)).toBe(true);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("replenishes the missing Solar side instead of overlapping the surviving slot", () => {
    const scene = new GameScene(buildRunConfig("story", { storyStageId: "story-1" }), {
      showResultOverlay: false,
      guidedTutorialInitialStep: "solar_lance",
    });
    const runtime = scene as any;
    const targets = runtime.objects.getAlive();
    const rightSlotSurvivor = targets.find((enemy: { angle: number }) => Math.cos(enemy.angle) > 0.5);
    rightSlotSurvivor.angle = Math.PI / 2;

    runtime.resolveInput(horizontalLance, earth);

    const cohort = runtime.guidedScenarioEnemies();
    const replacement = cohort.find((enemy: { id: number }) => enemy.id !== rightSlotSurvivor.id);
    expect(cohort).toHaveLength(2);
    expect(Math.abs(Math.abs(replacement.angle) - Math.PI)).toBeLessThan(0.01);
  });

  it("does not let a normal slash remove a Solar training target before the Solar cast", () => {
    const scene = new GameScene(buildRunConfig("story", { storyStageId: "story-1" }), {
      showResultOverlay: false,
      guidedTutorialInitialStep: "solar_lance",
    });
    const runtime = scene as any;
    const target = runtime.objects.getAlive()[0];
    const position = enemyXY(target);

    runtime.resolveLiveSlashSegment({
      a: { x: position.x, y: position.y - 70, t: 10 },
      b: { x: position.x, y: position.y + 70, t: 30 },
    }, earth);

    expect(runtime.objects.getAlive()).toHaveLength(2);
    expect(runtime.scoring.snapshot().kills).toBe(0);
    expect(runtime.runSession.replayTraceSnapshot().hitEvents).toHaveLength(0);

    runtime.resolveInput(horizontalLance, earth);
    expect(runtime.guidedTutorialFlow.step).toBe("reward");
    expect(runtime.scoring.snapshot().kills).toBe(2);
  });

  it("tracks guided targets as an isolated cohort across foreign enemies, impact, clear, and stale ids", () => {
    const scene = new GameScene(buildRunConfig("story", { storyStageId: "story-1" }), {
      showResultOverlay: false,
      guidedTutorialInitialStep: "solar_lance",
    });
    const runtime = scene as any;
    runtime.spawnWithReplay([{
      enemyType: "basic_meteor",
      spawnAtMs: 0,
      startAngleRad: Math.PI / 2,
      startRadius: 500,
      angularSpeed: 0,
      approachSpeed: 0,
    }]);
    const foreign = runtime.objects.getAlive().find((enemy: { id: number }) => !runtime.guidedScenarioEnemyIds.has(enemy.id));
    const [impactedId, survivorId] = [...runtime.guidedScenarioEnemyIds] as number[];
    const impacted = runtime.objects.getAlive().find((enemy: { id: number }) => enemy.id === impactedId);
    impacted.radius = EARTH_GAMEPLAY_RADIUS * runtime.zones.impact + EARTH_ENEMY_IMPACT_RADIUS_PX;

    scene.update(16);

    expect(runtime.objects.getAlive().some((enemy: { id: number }) => enemy.id === foreign.id)).toBe(true);
    expect(runtime.guidedScenarioEnemyIds.size).toBe(2);
    expect(runtime.guidedScenarioEnemyIds.has(impactedId)).toBe(false);
    expect(runtime.guidedScenarioEnemyIds.has(survivorId)).toBe(true);

    runtime.clearGuidedStoryScenario();
    expect(runtime.objects.getAlive().map((enemy: { id: number }) => enemy.id)).toEqual([foreign.id]);
    expect(runtime.guidedScenarioEnemyIds.size).toBe(0);

    runtime.spawnGuidedStoryScenario();
    const staleId = [...runtime.guidedScenarioEnemyIds][0] as number;
    runtime.objects.kill(staleId);
    runtime.objects.prune();
    runtime.spawnGuidedStoryScenario();
    expect(runtime.guidedScenarioEnemyIds.size).toBe(2);
    expect(runtime.guidedScenarioEnemyIds.has(staleId)).toBe(false);
    expect(runtime.objects.getAlive()).toHaveLength(3);
  });

  it("kills a moved one-hp Last Save target through the real live segment path and advances once", () => {
    const scene = new GameScene(buildRunConfig("story", { storyStageId: "story-1" }), {
      showResultOverlay: false,
      guidedTutorialInitialStep: "last_save",
    });
    const runtime = scene as any;
    const target = runtime.objects.getAlive()[0];
    const onStep = vi.fn();
    scene.onGuidedTutorialStep = onStep;
    expect(target).toMatchObject({ hp: 1, maxHp: 1 });

    scene.update(3_000);
    const current = enemyXY(target);
    runtime.resolveLiveSlashSegment({
      a: { x: current.x - 90, y: current.y, t: 3_000 },
      b: { x: current.x + 90, y: current.y, t: 3_100 },
    }, earth);

    const replay = runtime.runSession.replayTraceSnapshot();
    expect(runtime.guidedTutorialFlow.step).toBe("solar_lance");
    expect(runtime.scoring.snapshot().kills).toBe(1);
    expect(replay.hitEvents).toHaveLength(1);
    expect(replay.killEvents).toHaveLength(1);
    expect(runtime.objects.getAlive()).toHaveLength(2);
    expect(runtime.objects.getAlive().every((enemy: { hp: number; maxHp: number }) => enemy.hp === 1 && enemy.maxHp === 1)).toBe(true);
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith("solar_lance");
  });

  it("defers guided special and boss backlog past reward instead of spawning it immediately", () => {
    const scene = new GameScene(buildRunConfig("story", { storyStageId: "story-1" }), {
      showResultOverlay: false,
      guidedTutorialInitialStep: "solar_lance",
    });
    const runtime = scene as any;
    const bossDefer = vi.spyOn(runtime.bossRuntime, "deferUntil");
    const specialDefer = vi.spyOn(runtime.specialObjects, "deferUntil");

    scene.update(60_000);
    expect(bossDefer).toHaveBeenCalledWith(60_000);
    expect(specialDefer).toHaveBeenCalledWith(60_000);
    runtime.resolveInput(horizontalLance, earth);
    expect(runtime.guidedTutorialFlow.step).toBe("reward");

    scene.update(1);
    expect(runtime.objects.getAlive().some((enemy: { boss?: boolean }) => enemy.boss)).toBe(false);
    expect(runtime.specialObjects.getAlive()).toEqual([]);
    expect(runtime.bossRuntime.nextBossInMs(runtime.elapsedMs)).toBeGreaterThan(0);
  });

  it("defers a boss that becomes due during the final Solar settlement before leaving the script", () => {
    const scene = new GameScene(buildRunConfig("story", { storyStageId: "story-1" }), {
      showResultOverlay: false,
      guidedTutorialInitialStep: "solar_lance",
    });
    const runtime = scene as any;
    runtime.bossRuntime.nextBossAtMs = runtime.elapsedMs;
    const bossDefer = vi.spyOn(runtime.bossRuntime, "deferUntil");

    runtime.resolveInput(horizontalLance, earth);

    expect(runtime.guidedTutorialFlow.step).toBe("reward");
    expect(bossDefer).toHaveBeenCalledWith(runtime.elapsedMs);
    expect(runtime.bossRuntime.nextBossInMs(runtime.elapsedMs)).toBeGreaterThan(0);
    scene.update(1);
    expect(runtime.objects.getAlive().some((enemy: { boss?: boolean }) => enemy.boss)).toBe(false);
  });

  it("discards ten seconds of guided waves, then emits only newly scheduled normal spawns", () => {
    const scene = new GameScene(
      buildRunConfig("story", { storyStageId: "story-1" }),
      { showResultOverlay: false, guidedTutorialInitialStep: "last_save" },
    );
    const runtime = scene as any;

    scene.update(10_000);
    runtime.advanceGuidedTutorial({ type: "enemy_killed", band: "lastSave" });
    runtime.advanceGuidedTutorial({ type: "skill_fired", skillId: "solar_lance" });
    runtime.advanceGuidedTutorial({ type: "reward_claimed" });
    const recordedBeforeNormalWaves = runtime.spawnOrdinalSeq;
    const waveNext = vi.spyOn(runtime.wave, "next");

    scene.update(1);
    expect(waveNext.mock.results.at(-1)?.value).toEqual([]);
    expect(runtime.spawnOrdinalSeq).toBe(recordedBeforeNormalWaves);

    scene.update(2_000);
    const normalSpawns = waveNext.mock.results.at(-1)?.value ?? [];
    expect(normalSpawns.length).toBeGreaterThan(0);
    expect(normalSpawns.every((event: { spawnAtMs: number }) => event.spawnAtMs > 10_000)).toBe(true);
    expect(runtime.spawnOrdinalSeq).toBe(recordedBeforeNormalWaves + normalSpawns.length);
    expect(runtime.objects.getAlive().length).toBeGreaterThanOrEqual(normalSpawns.length);
  });

  it("keeps the moving Last Save target alive for 2499ms and retries its later impact without damage", () => {
    const scene = new GameScene(
      buildRunConfig("story", { storyStageId: "story-1" }),
      { showResultOverlay: false, guidedTutorialInitialStep: "last_save" },
    );
    const runtime = scene as any;
    const firstTarget = runtime.objects.getAlive()[0];

    scene.update(2_499);
    expect(runtime.objects.getAlive()).toHaveLength(1);
    expect(runtime.objects.getAlive()[0].id).toBe(firstTarget.id);
    expect(runtime.energy.getEnergy()).toBe(100);

    scene.update(1_010);
    expect(runtime.objects.getAlive()).toHaveLength(1);
    expect(runtime.objects.getAlive()[0].id).not.toBe(firstTarget.id);
    expect(runtime.objects.getAlive()[0].radius).toBe(300);
    expect(runtime.energy.getEnergy()).toBe(100);
    expect(runtime.runSession.replayTraceSnapshot().comboBreakEvents).toEqual([]);
  });

  it("preserves normal-mode wave, boss, special, and damaging earth-impact branches", () => {
    const scene = new GameScene(buildRunConfig("freeDefense"), { showResultOverlay: false });
    const runtime = scene as any;
    const bossNext = vi.spyOn(runtime.bossRuntime, "nextSpawns");
    const specialNext = vi.spyOn(runtime.specialObjects, "next");

    scene.update(2_000);
    const enemy = runtime.objects.getAlive()[0];
    expect(enemy).toBeTruthy();
    expect(bossNext).toHaveBeenCalled();
    expect(specialNext).toHaveBeenCalled();

    const energyBefore = runtime.energy.getEnergy();
    enemy.radius = EARTH_GAMEPLAY_RADIUS * runtime.zones.impact + EARTH_ENEMY_IMPACT_RADIUS_PX;
    scene.update(16);

    expect(runtime.energy.getEnergy()).toBe(energyBefore - enemy.damage);
    expect(runtime.runSession.replayTraceSnapshot().comboBreakEvents).toContainEqual({ reason: "earth_hit", atMs: 2_016 });
  });
});
