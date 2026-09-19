import { describe, expect, it } from "vitest";
import { Hud, skillSlotLayout } from "./Hud";
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

interface ArcStroke {
  color: number;
  width: number;
  x: number;
  y: number;
  radius: number;
  start: number;
  end: number;
}

function arcStrokesOf(node: { children?: unknown[] }, color: number): ArcStroke[] {
  const graphics = childByLabel(node, "skill-slots");
  const instructions = graphics?.context?.instructions ?? [];
  return instructions.flatMap((instruction: any) => {
    if (instruction.action !== "stroke" || instruction.data?.style?.color !== color) return [];
    return (instruction.data?.path?.instructions ?? [])
      .filter((pathInstruction: any) => pathInstruction.action === "arc")
      .map((pathInstruction: any) => {
        const [x, y, radius, start, end] = pathInstruction.data;
        return { color, width: instruction.data.style.width, x, y, radius, start, end };
      });
  });
}

function roundRectStrokesOf(node: { children?: unknown[] }, color: number): Array<{ width: number; x: number }> {
  const graphics = childByLabel(node, "skill-slots");
  const instructions = graphics?.context?.instructions ?? [];
  return instructions.flatMap((instruction: any) => {
    if (instruction.action !== "stroke" || instruction.data?.style?.color !== color) return [];
    return (instruction.data?.path?.instructions ?? [])
      .filter((pathInstruction: any) => pathInstruction.action === "roundRect")
      .map((pathInstruction: any) => ({
        width: instruction.data.style.width,
        x: pathInstruction.data[0],
      }));
  });
}

function skillHudState(skillSlots: any[]) {
  return {
    energy: 100,
    maxEnergy: 100,
    score: 0,
    combo: 0,
    comboMult: 1,
    gauge: 0,
    gaugeCost: 100,
    skillReady: false,
    cooldownMs: 0,
    skillSlots,
    waveNumber: 1,
    waveProgressRatio: 0.1,
    nextWaveInMs: 6000,
    timeMs: 2000,
  };
}

describe("Hud", () => {
  it("hides the wave gauge label only when waveVisible is explicitly false", () => {
    const hud = new Hud();

    hud.update({ ...skillHudState([]), waveVisible: false } as any, 16);
    expect(textsOf(hud.container).some((text) => text.includes("웨이브"))).toBe(false);

    hud.update({ ...skillHudState([]), waveVisible: true } as any, 16);
    expect(textsOf(hud.container).some((text) => text.includes("웨이브"))).toBe(true);
  });

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

  it("renders full skill names above per-slot status text", () => {
    const hud = new Hud();

    hud.update(
      {
        energy: 100,
        maxEnergy: 100,
        score: 0,
        combo: 0,
        comboMult: 1,
        gauge: 75,
        gaugeCost: 100,
        skillReady: false,
        cooldownMs: 0,
        skillSlots: [
          {
            id: "gravity_slow",
            label: "그래비티 슬로우",
            ratio: 0.75,
            cooldownRatio: 0,
            cooldownProgressRatio: 1,
            ready: false,
            cooldownMs: 0,
            active: true,
            visualState: "charging",
          },
        ],
        waveNumber: 1,
        waveProgressRatio: 0.1,
        nextWaveInMs: 6000,
        timeMs: 2000,
      } as any,
      16,
    );

    const name = childByLabel(hud.container, "skill-slot-name-0");
    const status = childByLabel(hud.container, "skill-slot-status-0");
    expect(name.text).toBe("그래비티 슬로우");
    expect(status.text).toBe("75%");
    expect(name.y).toBeLessThan(status.y);
    expect(name.style.fontSize).toBeGreaterThanOrEqual(21);
    expect(name.style.wordWrap).toBe(true);
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

  it("keeps all five semantic skill slots and their shared gesture artwork", () => {
    const hud = new Hud();
    const skills = [
      ["solar_lance", "솔라 랜스"],
      ["gravity_slow", "그래비티 슬로우"],
      ["orbital_cut", "오비탈 컷"],
      ["delta_shield", "델타 실드"],
      ["nova_pulse", "노바 펄스"],
    ] as const;

    hud.update(
      {
        energy: 100,
        maxEnergy: 100,
        score: 0,
        combo: 0,
        comboMult: 1,
        gauge: 40,
        gaugeCost: 100,
        skillReady: false,
        cooldownMs: 0,
        skillSlots: skills.map(([id, label]) => ({
          id,
          label,
          ratio: 0.4,
          cooldownRatio: 0,
          cooldownProgressRatio: 0,
          ready: false,
          cooldownMs: 0,
          active: true,
          visualState: "charging",
        })),
        waveNumber: 1,
        waveProgressRatio: 0.1,
        nextWaveInMs: 6000,
        timeMs: 2000,
      },
      16,
    );

    const skillLayer = childByLabel(hud.container, "skill-slots");
    expect(skillLayer).toBeTruthy();
    skills.forEach(([, label], index) => {
      expect(childByLabel(hud.container, `skill-slot-name-${index}`).text).toBe(label);
      expect(childByLabel(hud.container, `skill-slot-status-${index}`).text).toBe("40%");
      const gesture = childByLabel(hud.container, `skill-slot-gesture-${index}`);
      expect(gesture).toBeTruthy();
      expect(gesture.visible).toBe(true);
    });
  });

  it("updates the cyan charge ring and status from empty through partial to ready", () => {
    const hud = new Hud();
    const slot = (ratio: number, visualState: "charging" | "ready") => ({
      id: "nova_pulse",
      label: "노바 펄스",
      ratio,
      cooldownRatio: 0,
      cooldownProgressRatio: 1,
      ready: visualState === "ready",
      cooldownMs: 0,
      active: true,
      visualState,
    });

    hud.update(skillHudState([slot(0, "charging")]), 16);
    expect(childByLabel(hud.container, "skill-slot-status-0").text).toBe("0%");
    expect(arcStrokesOf(hud.container, 0x3fd8ff)).toHaveLength(0);

    hud.update(skillHudState([slot(0.46, "charging")]), 16);
    expect(childByLabel(hud.container, "skill-slot-status-0").text).toBe("46%");
    const partialCharge = arcStrokesOf(hud.container, 0x3fd8ff);
    expect(partialCharge).toHaveLength(1);
    expect(partialCharge[0]!.end - partialCharge[0]!.start).toBeCloseTo(Math.PI * 2 * 0.46);

    hud.update(skillHudState([slot(1, "ready")]), 16);
    expect(childByLabel(hud.container, "skill-slot-status-0").text).toBe("준비");
    const fullCharge = arcStrokesOf(hud.container, 0x3fd8ff);
    expect(fullCharge).toHaveLength(1);
    expect(fullCharge[0]!.end - fullCharge[0]!.start).toBeCloseTo(Math.PI * 2);
  });

  it("reserves the gauge-insufficient copy for an explicit insufficient status", () => {
    const hud = new Hud();

    hud.update(
      skillHudState([
        {
          id: "nova_pulse",
          label: "노바 펄스",
          ratio: 0,
          cooldownRatio: 0,
          cooldownProgressRatio: 1,
          ready: false,
          cooldownMs: 0,
          active: true,
          visualState: "insufficient",
        },
      ]),
      16,
    );

    expect(childByLabel(hud.container, "skill-slot-status-0").text).toBe("게이지 부족");
  });

  it("draws cooldown progress on an inner orange ring without changing another ready slot", () => {
    const hud = new Hud();
    const layout = skillSlotLayout(2);
    const readySlot = (id: string, label: string) => ({
      id,
      label,
      ratio: 1,
      cooldownRatio: 0,
      cooldownProgressRatio: 1,
      ready: true,
      cooldownMs: 0,
      active: true,
      visualState: "ready" as const,
    });

    hud.update(
      skillHudState([
        readySlot("solar_lance", "솔라 랜스"),
        readySlot("nova_pulse", "노바 펄스"),
      ]),
      16,
    );

    expect(childByLabel(hud.container, "skill-slot-status-0").text).toBe("준비");
    expect(childByLabel(hud.container, "skill-slot-status-1").text).toBe("준비");
    expect(arcStrokesOf(hud.container, 0x3fd8ff)).toHaveLength(2);
    expect(roundRectStrokesOf(hud.container, 0xffc14d)).toHaveLength(2);

    hud.update(
      skillHudState([
        {
          id: "solar_lance",
          label: "솔라 랜스",
          ratio: 0,
          cooldownRatio: 0.5,
          cooldownProgressRatio: 0.5,
          ready: false,
          cooldownMs: 6_000,
          active: true,
          visualState: "cooldown",
        },
        readySlot("nova_pulse", "노바 펄스"),
      ]),
      16,
    );

    expect(childByLabel(hud.container, "skill-slot-status-0").text).toBe("6초");
    expect(childByLabel(hud.container, "skill-slot-status-1").text).toBe("준비");

    const chargeRings = arcStrokesOf(hud.container, 0x3fd8ff);
    expect(chargeRings).toHaveLength(1);
    expect(chargeRings[0]).toMatchObject({ x: layout[1]!.x, radius: 62 });

    const cooldownRings = arcStrokesOf(hud.container, 0xf97316);
    expect(cooldownRings).toHaveLength(1);
    expect(cooldownRings[0]).toMatchObject({ x: layout[0]!.x, radius: 50 });
    expect(cooldownRings[0]!.end - cooldownRings[0]!.start).toBeCloseTo(Math.PI);

    const readyStatus = childByLabel(hud.container, "skill-slot-status-1");
    const readyName = childByLabel(hud.container, "skill-slot-name-1");
    expect(readyStatus.style.fill).toBe(0xfff3c4);
    expect(readyName.style.fill).toBe(0xffd166);
    expect(roundRectStrokesOf(hud.container, 0xffc14d)).toEqual([
      { width: 4, x: layout[1]!.cardX },
    ]);
  });
});
