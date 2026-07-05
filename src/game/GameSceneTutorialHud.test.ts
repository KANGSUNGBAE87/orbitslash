import { describe, expect, it } from "vitest";
import { GameScene } from "./GameScene";
import { buildRunConfig } from "./ModeConfig";
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
});
