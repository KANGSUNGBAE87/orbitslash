import { describe, expect, it, vi } from "vitest";
import { GameScene } from "./GameScene";
import { buildRunConfig } from "./ModeConfig";
import { EARTH_ENEMY_IMPACT_RADIUS_PX, EARTH_GAMEPLAY_RADIUS } from "./coords";
import { enemyXY } from "./Enemy";
import { t } from "../i18n";

function textsOf(node: { children?: unknown[]; text?: string }): string[] {
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as { text?: string; children?: unknown[] };
    if (typeof candidate.text === "string") out.push(candidate.text);
    candidate.children?.forEach(visit);
  };
  visit(node);
  return out;
}

describe("GameScene tutorial HUD", () => {
  it("renders the selected Story stage tutorial during gameplay", () => {
    const scene = new GameScene(buildRunConfig("story", { storyStageId: "story-6" }), { showResultOverlay: false });

    scene.update(16);
    const text = textsOf(scene.stage).join("\n");

    expect(text).toContain(`${t("story.stage6")} · ${t("story.tutorial.label")}`);
    expect(text).toContain(t("story.tutorial.6"));
  });

  it("renders the first Boss Rush weak-point tutorial when Ringed Destroyer starts", () => {
    const scene = new GameScene(buildRunConfig("bossRush"), { showResultOverlay: false });

    scene.update(1600);
    const text = textsOf(scene.stage).join("\n");

    expect(text).toContain(t("bossRush.tutorial.title"));
    expect(text).toContain(t("boss.objective.ringed_destroyer.ring"));
  });

  it("resumes Story 1 from the persisted guided tutorial step", () => {
    const scene = new GameScene(
      buildRunConfig("story", { storyStageId: "story-1" }),
      { showResultOverlay: false, guidedTutorialInitialStep: "solar_lance" } as never,
    );

    scene.update(16);
    const text = textsOf(scene.stage).join("\n");

    expect(text).toContain(t("story.guided.solar_lance"));
    expect(text).not.toContain(t("story.guided.basic_slash"));
  });

  it("spawns the persisted Story 1 scenario target before normal waves", () => {
    const scene = new GameScene(
      buildRunConfig("story", { storyStageId: "story-1" }),
      { showResultOverlay: false, guidedTutorialInitialStep: "solar_lance" } as never,
    );

    expect((scene as any).objects.getAlive()).toHaveLength(2);
    expect((scene as any).objects.getAlive().every((enemy: { type: string }) => enemy.type === "basic_meteor")).toBe(true);
  });

  it("starts persisted Last Save at full energy with one moving target and idempotent spawn", () => {
    const scene = new GameScene(
      buildRunConfig("story", { storyStageId: "story-1" }),
      { showResultOverlay: false, guidedTutorialInitialStep: "last_save" },
    );
    const runtime = scene as any;

    runtime.spawnGuidedStoryScenario();
    runtime.spawnGuidedStoryScenario();

    expect(runtime.energy.getEnergy()).toBe(100);
    expect(runtime.energy.getMax()).toBe(100);
    expect(runtime.objects.getAlive()).toHaveLength(1);
    expect(runtime.objects.getAlive()[0]).toMatchObject({ type: "basic_meteor", radius: 300, approachSpeed: 62 });
  });

  it("replenishes an impacted guided target exactly once without energy, combo, or replay damage", () => {
    const scene = new GameScene(
      buildRunConfig("story", { storyStageId: "story-1" }),
      { showResultOverlay: false, guidedTutorialInitialStep: "last_save" },
    );
    const runtime = scene as any;
    const firstTarget = runtime.objects.getAlive()[0];
    firstTarget.radius = EARTH_GAMEPLAY_RADIUS * runtime.zones.impact + EARTH_ENEMY_IMPACT_RADIUS_PX;
    const applyDamage = vi.spyOn(runtime.energy, "applyDamage");
    const onMiss = vi.spyOn(runtime.scoring, "onMiss");
    const recordComboBreak = vi.spyOn(runtime.runSession, "recordComboBreak");

    scene.update(16);
    runtime.spawnGuidedStoryScenario();

    const alive = runtime.objects.getAlive();
    expect(applyDamage).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();
    expect(recordComboBreak).not.toHaveBeenCalled();
    expect(runtime.energy.getEnergy()).toBe(100);
    expect(runtime.guidedTutorialFlow.step).toBe("last_save");
    expect(alive).toHaveLength(1);
    expect(alive[0].id).not.toBe(firstTarget.id);
    expect(alive[0].radius).toBe(300);
  });

  it("discards overdue waves while guided targets remain active and hides the wave HUD", () => {
    const scene = new GameScene(
      buildRunConfig("story", { storyStageId: "story-1" }),
      { showResultOverlay: false, guidedTutorialInitialStep: "last_save" },
    );
    const runtime = scene as any;
    const waveNext = vi.spyOn(runtime.wave, "next");
    const bossNext = vi.spyOn(runtime.bossRuntime, "nextSpawns");
    const specialNext = vi.spyOn(runtime.specialObjects, "next");

    scene.update(10_000);

    expect(waveNext).toHaveBeenCalledWith(10_000);
    expect(bossNext).not.toHaveBeenCalled();
    expect(specialNext).not.toHaveBeenCalled();
    expect(runtime.objects.getAlive()).toHaveLength(1);
    expect(textsOf(scene.stage).some((text) => text.includes(t("hud.wave")))).toBe(false);
  });

  it("advances a real Last Save slash once and replaces it with exactly two Solar Lance targets", () => {
    const scene = new GameScene(
      buildRunConfig("story", { storyStageId: "story-1" }),
      { showResultOverlay: false, guidedTutorialInitialStep: "last_save" },
    );
    const runtime = scene as any;
    const onStep = vi.fn();
    scene.onGuidedTutorialStep = onStep;
    const target = runtime.objects.getAlive()[0];
    scene.update(3_000);
    const current = enemyXY(target);
    runtime.resolveLiveSlashSegment({
      a: { x: current.x - 90, y: current.y, t: 3_000 },
      b: { x: current.x + 90, y: current.y, t: 3_100 },
    }, { cx: 540, cy: 900, r: EARTH_GAMEPLAY_RADIUS });

    expect(runtime.guidedTutorialFlow.step).toBe("solar_lance");
    expect(runtime.objects.getAlive()).toHaveLength(2);
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith("solar_lance");
  });
});
