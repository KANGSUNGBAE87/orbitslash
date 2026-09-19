import { describe, expect, expectTypeOf, it } from "vitest";
import { resolveNovaPulseDefinition, SkillSystem } from "./SkillSystem";
import type { NovaPulseEvaluation } from "./SkillSystem";
import skillsJson from "../data/skills.json";
import type { EarthRef, GestureResult, Point, SkillTable } from "./types";

const skills = skillsJson as unknown as SkillTable;
const earth: EarthRef = { cx: 540, cy: 900, r: 58 };
const context = (gauge = 100) => ({ earth, gauge, screenShortSide: 1080 });

function novaGesture(points?: Point[], overrides: Partial<GestureResult> = {}): GestureResult {
  return {
    kind: "line",
    points: points ?? [
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
  };
}

function radialLine(startR: number, endR: number, durationMs = 320): GestureResult {
  return novaGesture([
    { x: earth.cx + earth.r * startR, y: earth.cy, t: 0 },
    { x: earth.cx + earth.r * endR, y: earth.cy, t: durationMs },
  ]);
}

describe("SkillSystem nova_pulse evaluation", () => {
  it("keeps valid active Nova cost and cooldown values", () => {
    expect(resolveNovaPulseDefinition({
      ...skills.nova_pulse,
      gaugeCost: 73,
      cooldownSec: 21,
    })).toMatchObject({ gaugeCost: 73, cooldownSec: 21 });
  });

  it("uses the same valid active Nova cost and cooldown in gameplay", () => {
    const configuredSkills: SkillTable = {
      ...skills,
      nova_pulse: { ...skills.nova_pulse, gaugeCost: 73, cooldownSec: 21 },
    };
    const system = new SkillSystem(configuredSkills);

    expect(system.evaluateNovaPulse(novaGesture(), context(72))).toEqual({
      ok: false,
      reason: "gauge",
      candidate: true,
    });
    expect(system.tryNovaPulse(novaGesture(), context(73))).not.toBeNull();
    expect(system.cooldownRemaining("nova_pulse")).toBe(21_000);
  });

  it.each([
    ["string", "invalid"],
    ["null", null],
    ["negative", { ...skills.nova_pulse, gaugeCost: -1, cooldownSec: -1 }],
    ["NaN", { ...skills.nova_pulse, gaugeCost: Number.NaN, cooldownSec: Number.NaN }],
    ["overlarge", { ...skills.nova_pulse, gaugeCost: 1_000_000_001, cooldownSec: 86_401 }],
  ])("uses shipped-safe Nova fallback values for %s config", (_label, definition) => {
    expect(resolveNovaPulseDefinition(definition)).toMatchObject({ gaugeCost: 64, cooldownSec: 18 });
  });

  it("exports failure variants whose reason and candidate flag cannot disagree", () => {
    const assertFailureShape = (evaluation: NovaPulseEvaluation) => {
      if (evaluation.ok) return;
      if (evaluation.reason === "not_candidate") {
        expectTypeOf(evaluation.candidate).toEqualTypeOf<false>();
      } else {
        expectTypeOf(evaluation.candidate).toEqualTypeOf<true>();
      }
    };

    assertFailureShape({ ok: false, reason: "not_candidate", candidate: false });
    assertFailureShape({ ok: false, reason: "gauge", candidate: true });
  });

  it("purely evaluates a valid flick without starting cooldown", () => {
    const system = new SkillSystem(skills);

    const first = system.evaluateNovaPulse(novaGesture(), context());
    const second = system.evaluateNovaPulse(novaGesture(), context());

    expect(first).toEqual(second);
    expect(first).toEqual({
      ok: true,
      activation: {
        skillId: "nova_pulse",
        radiusPx: (skills.nova_pulse.radiusRatio ?? 2.7) * earth.r,
        damage: skills.nova_pulse.hitDamage,
        pushPx: skills.nova_pulse.pushPx,
        targetCap: skills.nova_pulse.targetCap,
      },
    });
    expect(system.cooldownRemaining("nova_pulse")).toBe(0);
  });

  it.each([
    [
      "start_too_far",
      radialLine(1.8, 3.2),
    ],
    [
      "endpoint_too_close",
      radialLine(0.4, 1.5),
    ],
    [
      "too_short",
      radialLine(1.4, 2.4),
    ],
    [
      "not_straight",
      novaGesture([
        { x: earth.cx + earth.r * 0.5, y: earth.cy, t: 0 },
        { x: earth.cx + earth.r * 1.5, y: earth.cy + earth.r * 2, t: 150 },
        { x: earth.cx + earth.r * 3.1, y: earth.cy, t: 300 },
      ]),
    ],
    [
      "too_slow",
      radialLine(0.5, 3.1, 700),
    ],
  ] as const)("returns candidate=true with %s for a recognisable radial near miss", (reason, gesture) => {
    const evaluation = new SkillSystem(skills).evaluateNovaPulse(gesture, context());

    expect(evaluation).toEqual({ ok: false, reason, candidate: true });
  });

  it("reports cooldown before gauge and geometry failures once a gesture is a candidate", () => {
    const system = new SkillSystem(skills);
    expect(system.tryNovaPulse(novaGesture(), context())).not.toBeNull();

    expect(system.evaluateNovaPulse(radialLine(1.8, 3.2), context(0))).toEqual({
      ok: false,
      reason: "cooldown",
      candidate: true,
    });
  });

  it("reports gauge before geometry failures when ready", () => {
    const system = new SkillSystem(skills);

    expect(system.evaluateNovaPulse(radialLine(1.8, 3.2), context(0))).toEqual({
      ok: false,
      reason: "gauge",
      candidate: true,
    });
    expect(system.cooldownRemaining("nova_pulse")).toBe(0);
  });

  it("keeps a moderately misplaced near-Earth start as an actionable candidate", () => {
    const relaxedStartLimitR = (skills.nova_pulse.startNearEarthMaxR ?? 1.45) + 0.75;

    expect(new SkillSystem(skills).evaluateNovaPulse(radialLine(relaxedStartLimitR, 3.8), context())).toEqual({
      ok: false,
      reason: "start_too_far",
      candidate: true,
    });
  });

  it("does not mistake a far-field outward slash for a Nova candidate", () => {
    const relaxedStartLimitR = (skills.nova_pulse.startNearEarthMaxR ?? 1.45) + 0.75;

    expect(new SkillSystem(skills).evaluateNovaPulse(radialLine(relaxedStartLimitR + 0.01, 4), context())).toEqual({
      ok: false,
      reason: "not_candidate",
      candidate: false,
    });
    expect(new SkillSystem(skills).evaluateNovaPulse(radialLine(3, 4.5), context())).toEqual({
      ok: false,
      reason: "not_candidate",
      candidate: false,
    });
  });

  it.each([
    ["NaN intermediate x", novaGesture([
      { x: earth.cx + earth.r * 0.5, y: earth.cy, t: 0 },
      { x: Number.NaN, y: earth.cy, t: 100 },
      { x: earth.cx + earth.r * 3.1, y: earth.cy, t: 200 },
    ]), earth],
    ["infinite coordinate", novaGesture([
      { x: earth.cx + earth.r * 0.5, y: earth.cy, t: 0 },
      { x: Number.POSITIVE_INFINITY, y: earth.cy, t: 200 },
    ]), earth],
    ["NaN timestamp", novaGesture([
      { x: earth.cx + earth.r * 0.5, y: earth.cy, t: 0 },
      { x: earth.cx + earth.r * 3.1, y: earth.cy, t: Number.NaN },
    ]), earth],
    ["decreasing timestamps", novaGesture([
      { x: earth.cx + earth.r * 0.5, y: earth.cy, t: 200 },
      { x: earth.cx + earth.r * 3.1, y: earth.cy, t: 100 },
    ]), earth],
    ["zero Earth radius", novaGesture(), { ...earth, r: 0 }],
    ["negative Earth radius", novaGesture(), { ...earth, r: -1 }],
    ["non-finite Earth radius", novaGesture(), { ...earth, r: Number.POSITIVE_INFINITY }],
    ["non-finite Earth center", novaGesture(), { ...earth, cx: Number.NaN }],
  ] as const)("rejects invalid input as a silent non-candidate: %s", (_label, gesture, invalidEarth) => {
    const system = new SkillSystem(skills);

    expect(system.evaluateNovaPulse(gesture, { ...context(), earth: invalidEarth })).toEqual({
      ok: false,
      reason: "not_candidate",
      candidate: false,
    });
    expect(system.tryNovaPulse(gesture, { ...context(), earth: invalidEarth })).toBeNull();
    expect(system.cooldownRemaining("nova_pulse")).toBe(0);
  });

  it("treats NaN gauge as gauge failure instead of bypassing the cost", () => {
    const system = new SkillSystem(skills);

    expect(system.evaluateNovaPulse(novaGesture(), context(Number.NaN))).toEqual({
      ok: false,
      reason: "gauge",
      candidate: true,
    });
    expect(system.tryNovaPulse(novaGesture(), context(Number.NaN))).toBeNull();
    expect(system.cooldownRemaining("nova_pulse")).toBe(0);
  });

  it("keeps strict-valid outward geometry eligible when active thresholds are looser than coaching defaults", () => {
    const relaxedSkills: SkillTable = {
      ...skills,
      nova_pulse: {
        ...skills.nova_pulse,
        startNearEarthMaxR: 1.8,
        endpointOutsideR: 2,
        minPathLengthR: 0.2,
        straightnessMin: 0.2,
      },
    };
    const gesture = radialLine(1.75, 2.05, 200);

    expect(new SkillSystem(relaxedSkills).evaluateNovaPulse(gesture, context())).toMatchObject({ ok: true });
  });

  it("falls back safely when Nova numeric config contains non-finite or invalid values", () => {
    const invalidSkills = {
      ...skills,
      nova_pulse: {
        ...skills.nova_pulse,
        gaugeCost: Number.NaN,
        cooldownSec: Number.NaN,
        hitDamage: Number.POSITIVE_INFINITY,
        radiusRatio: Number.NaN,
        pushPx: Number.NEGATIVE_INFINITY,
        targetCap: -4,
        startNearEarthMaxR: Number.NaN,
        endpointOutsideR: Number.POSITIVE_INFINITY,
        minPathLengthR: -1,
        straightnessMin: 4,
        durationMs: Number.NaN,
      },
    } as unknown as SkillTable;
    const system = new SkillSystem(invalidSkills);

    expect(system.evaluateNovaPulse(novaGesture(), context())).toEqual({
      ok: true,
      activation: {
        skillId: "nova_pulse",
        radiusPx: 2.7 * earth.r,
        damage: 1,
        pushPx: 170,
        targetCap: 4,
      },
    });
    expect(system.tryNovaPulse(novaGesture(), context())).not.toBeNull();
    expect(system.cooldownRemaining("nova_pulse")).toBe(18_000);
  });

  it.each([
    ["solar line through Earth", radialLine(-2.2, 3.1)],
    [
      "circle",
      novaGesture([
        { x: earth.cx + earth.r, y: earth.cy, t: 0 },
        { x: earth.cx, y: earth.cy + earth.r, t: 80 },
        { x: earth.cx - earth.r, y: earth.cy, t: 160 },
        { x: earth.cx, y: earth.cy - earth.r, t: 240 },
        { x: earth.cx + earth.r, y: earth.cy, t: 320 },
      ], { kind: "circle", totalTurnRad: Math.PI * 2, enclosesEarth: true }),
    ],
    [
      "spiral",
      novaGesture([
        { x: earth.cx + earth.r * 0.7, y: earth.cy, t: 0 },
        { x: earth.cx, y: earth.cy + earth.r * 1.2, t: 80 },
        { x: earth.cx - earth.r * 1.7, y: earth.cy, t: 160 },
        { x: earth.cx, y: earth.cy - earth.r * 2.3, t: 240 },
        { x: earth.cx + earth.r * 3, y: earth.cy, t: 320 },
      ], { kind: "spiral", totalTurnRad: Math.PI * 2 }),
    ],
    [
      "triangle",
      novaGesture([
        { x: earth.cx, y: earth.cy - earth.r * 2, t: 0 },
        { x: earth.cx + earth.r * 2, y: earth.cy + earth.r * 2, t: 100 },
        { x: earth.cx - earth.r * 2, y: earth.cy + earth.r * 2, t: 200 },
        { x: earth.cx, y: earth.cy - earth.r * 2, t: 300 },
      ], { kind: "triangle", vertexCount: 3, enclosesEarth: true }),
    ],
    ["ordinary short slash", radialLine(0.5, 0.7, 100)],
  ] as const)("keeps %s silent as not_candidate", (_label, gesture) => {
    expect(new SkillSystem(skills).evaluateNovaPulse(gesture, context())).toEqual({
      ok: false,
      reason: "not_candidate",
      candidate: false,
    });
  });
});

describe("SkillSystem nova_pulse activation state", () => {
  it("starts cooldown only after a successful try", () => {
    const system = new SkillSystem(skills);

    expect(system.tryNovaPulse(novaGesture(), context())).toMatchObject({ skillId: "nova_pulse" });
    expect(system.cooldownRemaining("nova_pulse")).toBe((skills.nova_pulse.cooldownSec ?? 18) * 1000);
  });

  it("does not start cooldown after a failed try", () => {
    const system = new SkillSystem(skills);

    expect(system.tryNovaPulse(novaGesture(), context(0))).toBeNull();
    expect(system.cooldownRemaining("nova_pulse")).toBe(0);
  });

  it("keeps the infinite-gauge debug override", () => {
    const debugSkills: SkillTable = {
      ...skills,
      _debug: { ...skills._debug, infiniteGauge: true },
    };
    const system = new SkillSystem(debugSkills);

    expect(system.evaluateNovaPulse(novaGesture(), context(0))).toMatchObject({ ok: true });
    expect(system.tryNovaPulse(novaGesture(), context(0))).toMatchObject({ skillId: "nova_pulse" });
  });
});
