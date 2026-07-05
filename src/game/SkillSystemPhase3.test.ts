import { describe, expect, it } from "vitest";
import { SkillSystem } from "./SkillSystem";
import skillsJson from "../data/skills.json";
import type { EarthRef, GestureResult, Point, SkillTable } from "./types";

const skills = skillsJson as unknown as SkillTable;
const earth: EarthRef = { cx: 540, cy: 900, r: 58 };

function gesture(points: Point[], overrides: Partial<GestureResult> = {}): GestureResult {
  return {
    kind: "slash",
    points,
    straightness: 0.2,
    totalTurnRad: Math.PI * 2,
    enclosesEarth: true,
    vertexCount: 0,
    startEndGapRatio: 0.1,
    ...overrides,
  };
}

describe("SkillSystem Phase 3 skills", () => {
  it("activates Orbital Cut on a long earth-enclosing spiral gesture", () => {
    const system = new SkillSystem(skills);
    const points: Point[] = [
      { x: 690, y: 900, t: 0 },
      { x: 540, y: 1050, t: 80 },
      { x: 390, y: 900, t: 160 },
      { x: 540, y: 750, t: 240 },
      { x: 720, y: 890, t: 320 },
      { x: 540, y: 1080, t: 400 },
    ];

    const activation = system.tryOrbitalCut(gesture(points, { totalTurnRad: 7.4 }), { earth, gauge: 100, screenShortSide: 1080 });

    expect(activation).toMatchObject({
      skillId: "orbital_cut",
      damage: skills.orbital_cut.hitDamage,
    });
    expect(activation?.radiusPx).toBeGreaterThan(earth.r * 3);
    expect(system.cooldownRemaining("orbital_cut")).toBe((skills.orbital_cut.cooldownSec ?? 0) * 1000);
  });

  it("activates Delta Shield from a closed earth-enclosing triangle", () => {
    const system = new SkillSystem(skills);
    const triangle: Point[] = [
      { x: 540, y: 700, t: 0 },
      { x: 740, y: 1040, t: 100 },
      { x: 340, y: 1040, t: 200 },
      { x: 540, y: 700, t: 300 },
    ];

    const activation = system.tryDeltaShield(
      gesture(triangle, {
        totalTurnRad: Math.PI * 2,
        vertexCount: 3,
        startEndGapRatio: 0,
      }),
      { earth, gauge: 100, screenShortSide: 1080 },
    );

    expect(activation).toMatchObject({
      skillId: "delta_shield",
      durationMs: skills.delta_shield.durationMs,
      absorbCount: skills.delta_shield.absorbCount,
    });
    expect(system.cooldownRemaining("delta_shield")).toBe((skills.delta_shield.cooldownSec ?? 0) * 1000);
  });
});
