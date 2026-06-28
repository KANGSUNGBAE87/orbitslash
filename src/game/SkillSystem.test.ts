import { describe, expect, it } from "vitest";
import { SkillSystem } from "./SkillSystem";
import skillsJson from "../data/skills.json";
import type { EarthRef, GestureResult, SkillTable } from "./types";

const skills = skillsJson as unknown as SkillTable;
const earth: EarthRef = { cx: 540, cy: 900, r: 50 };

const circleGesture = (overrides: Partial<GestureResult> = {}): GestureResult => ({
  kind: "circle",
  points: [
    { x: 600, y: 900, t: 0 },
    { x: 540, y: 960, t: 80 },
    { x: 480, y: 900, t: 160 },
    { x: 540, y: 840, t: 240 },
    { x: 600, y: 900, t: 320 },
  ],
  straightness: 0,
  totalTurnRad: Math.PI * 2,
  enclosesEarth: true,
  vertexCount: 0,
  startEndGapRatio: 0,
  ...overrides,
});

describe("SkillSystem gravity_slow", () => {
  it("activates on an earth-enclosing circle when gauge and cooldown allow it", () => {
    const system = new SkillSystem(skills);

    const activation = system.tryGravitySlow(circleGesture(), { earth, gauge: 100, screenShortSide: 1080 });

    expect(activation).toMatchObject({
      skillId: "gravity_slow",
      durationMs: skills.gravity_slow.durationMs,
      slowMultiplier: skills.gravity_slow.slowMultiplier,
    });
    expect(system.cooldownRemaining("gravity_slow")).toBe((skills.gravity_slow.cooldownSec ?? 0) * 1000);
  });

  it("rejects gestures that do not enclose earth", () => {
    const system = new SkillSystem(skills);

    expect(system.tryGravitySlow(circleGesture({ enclosesEarth: false }), { earth, gauge: 100, screenShortSide: 1080 })).toBeNull();
  });

  it("rejects open spiral-like gestures even when they enclose earth", () => {
    const system = new SkillSystem(skills);

    expect(system.tryGravitySlow(circleGesture({ startEndGapRatio: 0.31 }), { earth, gauge: 100, screenShortSide: 1080 })).toBeNull();
  });
});
