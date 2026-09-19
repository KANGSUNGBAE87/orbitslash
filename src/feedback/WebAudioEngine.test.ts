import { describe, expect, it, vi } from "vitest";
import { WebAudioEngine } from "./WebAudioEngine";

function createAudioContext(started: string[] = []) {
  return {
    destination: {},
    currentTime: 0,
    resume: () => Promise.resolve(),
    createOscillator: () => ({
      type: "sine",
      frequency: { value: 0 },
      connect: () => {},
      start: () => started.push("start"),
      stop: () => {},
    }),
    createGain: () => ({
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
    }),
  };
}

function createAudioElement(play: () => Promise<void> = () => Promise.resolve()) {
  return {
    src: "",
    loop: false,
    preload: "none",
    volume: 1,
    currentTime: 0,
    play: vi.fn(play),
    pause: vi.fn(),
  };
}

describe("WebAudioEngine", () => {
  it("keeps SFX silent until a user gesture unlocks WebAudio", () => {
    const started: string[] = [];
    const engine = new WebAudioEngine(() => createAudioContext(started), () => createAudioElement());

    engine.play("slash_hit");
    expect(started).toEqual([]);

    engine.unlockFromUserGesture();
    engine.play("slash_hit");
    expect(started).toEqual(["start"]);
  });

  it("configures one looping preloaded BGM element", async () => {
    const audio = createAudioElement();
    const createAudio = vi.fn(() => audio);
    const engine = new WebAudioEngine(() => createAudioContext(), createAudio);

    engine.setBgmEnabled(true);
    await engine.attemptAutoplay();

    expect(createAudio).toHaveBeenCalledTimes(1);
    expect(audio.src).toBe("/assets/audio/orbit-siege-120s.m4a");
    expect(audio.loop).toBe(true);
    expect(audio.preload).toBe("auto");
    expect(audio.volume).toBeGreaterThan(0);
    expect(audio.volume).toBeLessThanOrEqual(0.35);
  });

  it("attempts autoplay explicitly and reports success", async () => {
    const audio = createAudioElement();
    const engine = new WebAudioEngine(() => createAudioContext(), () => audio);

    engine.setBgmEnabled(true);

    await expect(engine.attemptAutoplay()).resolves.toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("returns false for rejected autoplay and retries on user unlock", async () => {
    const audio = createAudioElement();
    audio.play.mockRejectedValueOnce(new DOMException("Autoplay denied", "NotAllowedError"));
    const engine = new WebAudioEngine(() => createAudioContext(), () => audio);

    engine.setBgmEnabled(true);
    await expect(engine.attemptAutoplay()).resolves.toBe(false);

    engine.unlockFromUserGesture();
    await Promise.resolve();

    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("pauses BGM when disabled or paused and can resume it", async () => {
    const audio = createAudioElement();
    const engine = new WebAudioEngine(() => createAudioContext(), () => audio);

    engine.setBgmEnabled(true);
    await engine.attemptAutoplay();
    engine.setBgmEnabled(false);
    expect(audio.pause).toHaveBeenCalledTimes(1);

    engine.setBgmEnabled(true);
    await engine.attemptAutoplay();
    engine.pause();
    expect(audio.pause).toHaveBeenCalledTimes(2);

    engine.unlockFromUserGesture();
    await Promise.resolve();
    expect(audio.play).toHaveBeenCalledTimes(3);
  });

  it("deduplicates the audio element and in-flight playback attempts", async () => {
    let resolvePlay: (() => void) | undefined;
    const audio = createAudioElement(() => new Promise<void>((resolve) => { resolvePlay = resolve; }));
    const createAudio = vi.fn(() => audio);
    const engine = new WebAudioEngine(() => createAudioContext(), createAudio);

    engine.setBgmEnabled(true);
    const first = engine.attemptAutoplay();
    const second = engine.attemptAutoplay();
    engine.unlockFromUserGesture();

    expect(createAudio).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledTimes(1);

    resolvePlay?.();
    await Promise.all([first, second]);
    await expect(engine.attemptAutoplay()).resolves.toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("retries once when a stale pending play rejects after pause and unlock", async () => {
    let rejectFirstPlay: ((reason?: unknown) => void) | undefined;
    const audio = createAudioElement();
    audio.play.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => { rejectFirstPlay = reject; }),
    ).mockRejectedValueOnce(new DOMException("Retry denied", "NotAllowedError"));
    const engine = new WebAudioEngine(() => createAudioContext(), () => audio);

    engine.setBgmEnabled(true);
    engine.pause();
    engine.unlockFromUserGesture();
    expect(audio.play).toHaveBeenCalledTimes(1);

    rejectFirstPlay?.(new DOMException("Playback interrupted", "AbortError"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(audio.play).toHaveBeenCalledTimes(2);
  });
});
