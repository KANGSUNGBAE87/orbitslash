import { describe, expect, it } from "vitest";
import { FeedbackController } from "./FeedbackController";

describe("FeedbackController", () => {
  it("throttles frequent hit haptics but keeps a last-save cue", () => {
    const haptics: Array<"light" | "medium" | "heavy"> = [];
    const audio: string[] = [];
    const controller = new FeedbackController(
      () => ({ bgmEnabled: true, sfxEnabled: true, hapticEnabled: true, reducedMotion: false }),
      { haptic: (kind) => haptics.push(kind), play: (cue) => audio.push(cue) },
    );

    controller.handle({ type: "normal_hit", atMs: 100 });
    controller.handle({ type: "normal_hit", atMs: 120 });
    controller.handle({ type: "last_save", atMs: 140 });

    expect(haptics).toEqual(["light", "heavy"]);
    expect(audio).toEqual(["slash_hit", "slash_hit", "last_save"]);
  });

  it("respects disabled sfx and haptics independently", () => {
    const haptics: string[] = [];
    const audio: string[] = [];
    const controller = new FeedbackController(
      () => ({ bgmEnabled: false, sfxEnabled: false, hapticEnabled: false, reducedMotion: false }),
      { haptic: (kind) => haptics.push(kind), play: (cue) => audio.push(cue) },
    );

    controller.handle({ type: "boss_phase", atMs: 100 });

    expect(haptics).toEqual([]);
    expect(audio).toEqual([]);
  });
});
