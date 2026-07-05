import { describe, expect, it } from "vitest";
import { SkillSystem } from "./SkillSystem";
import skillsJson from "../data/skills.json";
import type { EarthRef, GestureResult, SkillTable } from "./types";

const skills = skillsJson as unknown as SkillTable;
const earth: EarthRef = { cx: 540, cy: 900, r: 58 };

const novaGesture = (overrides: Partial<GestureResult> = {}): GestureResult => ({
  kind: "line",
  points: [
    { x: earth.cx + earth.r * 0.5, y: earth.cy, t: 0 },
    { x: earth.cx + earth.r * 1.7, y: earth.cy, t: 160 },
    { x: earth.cx + earth.r * 3.1, y: earth.cy, t: 320 },
  ],
  straightness: 0.96,
  totalTurnRad: 0,
  enclosesEarth: false,
  vertexCount: 0,
  startEndGapRatio: 0.96,
  ...overrides,
});

describe("SkillSystem nova_pulse", () => {
  it("activates from a fast radial flick that starts near Earth and ends outward", () => {
    const system = new SkillSystem(skills);

    const activation = system.tryNovaPulse(novaGesture(), { earth, gauge: 100, screenShortSide: 1080 });

    expect(activation).toMatchObject({
      skillId: "nova_pulse",
      damage: skills.nova_pulse.hitDamage,
      pushPx: skills.nova_pulse.pushPx,
    });
    expect(activation?.radiusPx).toBeCloseTo((skills.nova_pulse.radiusRatio ?? 2.7) * earth.r);
    expect(system.cooldownRemaining("nova_pulse")).toBe((skills.nova_pulse.cooldownSec ?? 0) * 1000);
  });

  it("rejects outward lines that start too far away from Earth", () => {
    const system = new SkillSystem(skills);

    const activation = system.tryNovaPulse(
      novaGesture({
        points: [
          { x: earth.cx + earth.r * 1.8, y: earth.cy, t: 0 },
          { x: earth.cx + earth.r * 3.2, y: earth.cy, t: 220 },
        ],
      }),
      { earth, gauge: 100, screenShortSide: 1080 },
    );

    expect(activation).toBeNull();
  });

  it("rejects radial flicks without enough gauge", () => {
    const system = new SkillSystem(skills);

    expect(system.tryNovaPulse(novaGesture(), { earth, gauge: 10, screenShortSide: 1080 })).toBeNull();
  });
});
