import { describe, expect, it } from "vitest";
import { Hud } from "./Hud";
import type { BossHudState } from "../game/BossHudState";

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

function childByLabel<T extends { label?: string; children?: unknown[] }>(node: T, label: string): any {
  let found: any;
  const visit = (value: unknown) => {
    if (found || !value || typeof value !== "object") return;
    const candidate = value as { label?: string; children?: unknown[] };
    if (candidate.label === label) {
      found = candidate;
      return;
    }
    candidate.children?.forEach(visit);
  };
  visit(node);
  return found;
}

function baseBossState(partial: Partial<BossHudState>): BossHudState {
  return {
    active: false,
    warning: false,
    nextBossInMs: 30000,
    hp: 0,
    maxHp: 0,
    hitsRemaining: 0,
    hpRatio: 0,
    ...partial,
    threatPercent: partial.threatPercent ?? 50,
  };
}

describe("Hud", () => {
  it("shows an always-on threat gauge before boss warning state", () => {
    const hud = new Hud();

    hud.update(
      {
        energy: 100,
        maxEnergy: 100,
        score: 0,
        combo: 0,
        comboMult: 1,
        gauge: 0,
        gaugeCost: 100,
        skillReady: false,
        cooldownMs: 0,
        skillSlots: [],
        waveNumber: 2,
        waveProgressRatio: 0.4,
        nextWaveInMs: 4000,
        boss: baseBossState({ nextBossInMs: 30000 }),
        timeMs: 10000,
      },
      16,
    );

    expect(textsOf(hud.container).some((text) => text.includes("위협"))).toBe(true);
  });

  it("keeps active boss objectives in a separate compact line", () => {
    const hud = new Hud();

    hud.update(
      {
        energy: 100,
        maxEnergy: 100,
        score: 0,
        combo: 0,
        comboMult: 1,
        gauge: 0,
        gaugeCost: 100,
        skillReady: false,
        cooldownMs: 0,
        skillSlots: [],
        waveNumber: 1,
        waveProgressRatio: 0.4,
        nextWaveInMs: 4000,
        boss: baseBossState({
          active: true,
          hp: 58,
          maxHp: 58,
          hitsRemaining: 58,
          hpRatio: 1,
          objectiveKey: "boss.objective.ringed_destroyer.ring",
        }),
        timeMs: 10000,
      },
      16,
    );

    const objective = childByLabel(hud.container, "boss-objective-text");
    expect(objective.text).toBe("고리 약점을 파괴");
    expect(objective.style.wordWrap).toBe(true);
    expect(objective.style.wordWrapWidth).toBeGreaterThan(520);
    expect(textsOf(hud.container).filter((text) => text.includes("고리 약점"))).toHaveLength(1);
  });

  it("renders gameplay tutorial callouts without using flash banners", () => {
    const hud = new Hud();

    hud.update(
      {
        energy: 100,
        maxEnergy: 100,
        score: 0,
        combo: 0,
        comboMult: 1,
        gauge: 0,
        gaugeCost: 100,
        skillReady: false,
        cooldownMs: 0,
        skillSlots: [],
        waveNumber: 1,
        waveProgressRatio: 0.1,
        nextWaveInMs: 6000,
        tutorial: {
          title: "Story 6 · Tutorial",
          message: "Practice the boss weak point before it closes",
          tone: "boss",
        },
        timeMs: 2000,
      } as any,
      16,
    );

    const texts = textsOf(hud.container);
    expect(texts).toContain("Story 6 · Tutorial");
    expect(texts).toContain("Practice the boss weak point before it closes");
  });

  it("renders a persistent blocked weak-point callout separately from generic banners", () => {
    const hud = new Hud();

    hud.flashBlockedWeakPoint("약점만 피해", "빛나는 약점이 열릴 때만 큰 피해가 들어갑니다");
    hud.update(
      {
        energy: 90,
        maxEnergy: 90,
        score: 0,
        combo: 0,
        comboMult: 1,
        gauge: 0,
        gaugeCost: 100,
        skillReady: false,
        cooldownMs: 0,
        skillSlots: [],
        waveNumber: 1,
        waveProgressRatio: 0.1,
        nextWaveInMs: 6000,
        timeMs: 2000,
      } as any,
      16,
    );

    const texts = textsOf(hud.container);
    expect(texts).toContain("약점만 피해");
    expect(texts).toContain("빛나는 약점이 열릴 때만 큰 피해가 들어갑니다");
    expect(childByLabel(hud.container, "blocked-weak-point-panel")).toBeTruthy();
    expect(childByLabel(hud.container, "blocked-weak-point-message").style.wordWrap).toBe(true);
    expect(childByLabel(hud.container, "blocked-weak-point-message").style.wordWrapWidth).toBeLessThan(720);
  });

  it("keeps blocked weak-point callouts visible longer than generic flash banners", () => {
    const hud = new Hud();

    hud.flashBlockedWeakPoint("Weak points only", "Heavy damage lands only while a glowing weak point is open");
    hud.update(
      {
        energy: 90,
        maxEnergy: 90,
        score: 0,
        combo: 0,
        comboMult: 1,
        gauge: 0,
        gaugeCost: 100,
        skillReady: false,
        cooldownMs: 0,
        skillSlots: [],
        waveNumber: 1,
        waveProgressRatio: 0.1,
        nextWaveInMs: 6000,
        timeMs: 2000,
      } as any,
      16,
    );
    hud.update(
      {
        energy: 90,
        maxEnergy: 90,
        score: 0,
        combo: 0,
        comboMult: 1,
        gauge: 0,
        gaugeCost: 100,
        skillReady: false,
        cooldownMs: 0,
        skillSlots: [],
        waveNumber: 1,
        waveProgressRatio: 0.1,
        nextWaveInMs: 6000,
        timeMs: 2900,
      } as any,
      884,
    );
    expect(childByLabel(hud.container, "blocked-weak-point-title").alpha).toBeGreaterThan(0.3);
    expect(childByLabel(hud.container, "blocked-weak-point-message").alpha).toBeGreaterThan(0.3);

    hud.update(
      {
        energy: 90,
        maxEnergy: 90,
        score: 0,
        combo: 0,
        comboMult: 1,
        gauge: 0,
        gaugeCost: 100,
        skillReady: false,
        cooldownMs: 0,
        skillSlots: [],
        waveNumber: 1,
        waveProgressRatio: 0.1,
        nextWaveInMs: 6000,
        timeMs: 3600,
      } as any,
      700,
    );
    expect(childByLabel(hud.container, "blocked-weak-point-title").alpha).toBe(0);
    expect(childByLabel(hud.container, "blocked-weak-point-message").alpha).toBe(0);
  });
});
