import { describe, expect, it } from "vitest";
import {
  ICON_MAX_ABS_COORDINATE,
  ICON_MAX_RADIUS,
  buildSkillGestureIconGeometry,
  type SkillGestureCommand,
  type SkillGesturePoint,
} from "./SkillGestureIcon";

function expectPointClose(actual: SkillGesturePoint, expected: SkillGesturePoint): void {
  expect(actual[0]).toBeCloseTo(expected[0], 8);
  expect(actual[1]).toBeCloseTo(expected[1], 8);
}

function commandOfKind<K extends SkillGestureCommand["kind"]>(
  commands: readonly SkillGestureCommand[],
  kind: K,
  index = 0,
): Extract<SkillGestureCommand, { kind: K }> {
  return commands.filter((command): command is Extract<SkillGestureCommand, { kind: K }> => command.kind === kind)[index]!;
}

function numbersOf(command: SkillGestureCommand): number[] {
  const styleNumbers = [command.style.width, command.style.color, command.style.alpha];
  if (command.kind === "segments") return [...styleNumbers, ...command.segments.flat(2)];
  if (command.kind === "polyline") return [...styleNumbers, ...command.points.flat()];
  if (command.kind === "circle") return [...styleNumbers, ...command.center, command.radius];
  return [...styleNumbers, ...command.center, command.radius, command.startAngle, command.endAngle];
}

describe("buildSkillGestureIconGeometry", () => {
  it.each([
    ["solar_lance", ["segments", "segments"]],
    ["gravity_slow", ["arc", "segments"]],
    ["orbital_cut", ["polyline", "segments"]],
    ["delta_shield", ["polyline", "arc"]],
    ["nova_pulse", ["circle", "segments", "segments", "segments", "segments", "segments", "segments"]],
  ] as const)("builds the %s semantic primitive signature", (skillId, expectedKinds) => {
    const commands = buildSkillGestureIconGeometry(skillId, 120, 80, 30, 0x9fe9ff, 0.8);

    expect(commands.map((command) => command.kind)).toEqual(expectedKinds);
    expect(commands.every((command) => command.style.color === 0x9fe9ff)).toBe(true);
    expect(commands.every((command) => command.style.alpha > 0 && command.style.alpha <= 0.8)).toBe(true);
    expect(commands.flatMap(numbersOf).every(Number.isFinite)).toBe(true);
  });

  it("preserves Solar Lance shaft endpoints and arrow tip", () => {
    const x = 100;
    const y = 80;
    const radius = 40;
    const commands = buildSkillGestureIconGeometry("solar_lance", x, y, radius, 0xffffff, 1);

    const shaft = commandOfKind(commands, "segments", 0);
    expect(shaft.segments).toHaveLength(1);
    expectPointClose(shaft.segments[0]![0], [x - radius * 0.68, y + radius * 0.42]);
    expectPointClose(shaft.segments[0]![1], [x + radius * 0.72, y - radius * 0.46]);
    const arrow = commandOfKind(commands, "segments", 1);
    expect(arrow.segments).toHaveLength(2);
    arrow.segments.forEach(([tip]) => expectPointClose(tip, shaft.segments[0]![1]));
  });

  it("preserves Gravity Slow arc center, radius, angles, and arrow tip", () => {
    const x = 100;
    const y = 80;
    const radius = 40;
    const startAngle = -Math.PI * 0.88;
    const endAngle = Math.PI * 1.05;
    const commands = buildSkillGestureIconGeometry("gravity_slow", x, y, radius, 0xffffff, 1);

    const arc = commandOfKind(commands, "arc");
    expectPointClose(arc.center, [x, y]);
    expect(arc.radius).toBe(radius * 0.62);
    expect(arc.startAngle).toBe(startAngle);
    expect(arc.endAngle).toBe(endAngle);
    const expectedTip: SkillGesturePoint = [x + Math.cos(endAngle) * radius * 0.62, y + Math.sin(endAngle) * radius * 0.62];
    commandOfKind(commands, "segments").segments.forEach(([tip]) => expectPointClose(tip, expectedTip));
  });

  it("preserves Orbital Cut spiral samples and terminal arrow tip", () => {
    const x = 100;
    const y = 80;
    const radius = 40;
    const commands = buildSkillGestureIconGeometry("orbital_cut", x, y, radius, 0xffffff, 1);

    const spiral = commandOfKind(commands, "polyline");
    expect(spiral.points).toHaveLength(35);
    expectPointClose(spiral.points[0]!, [x, y]);
    const firstProgress = 1 / 34;
    const firstAngle = firstProgress * Math.PI * 4.25;
    const firstRadius = radius * 0.12 + radius * 0.57 * firstProgress;
    expectPointClose(spiral.points[1]!, [x + Math.cos(firstAngle) * firstRadius, y + Math.sin(firstAngle) * firstRadius]);
    const finalAngle = Math.PI * 4.25;
    const expectedTip: SkillGesturePoint = [x + Math.cos(finalAngle) * radius * 0.69, y + Math.sin(finalAngle) * radius * 0.69];
    expectPointClose(spiral.points.at(-1)!, expectedTip);
    commandOfKind(commands, "segments").segments.forEach(([tip]) => expectPointClose(tip, expectedTip));
  });

  it("preserves Delta Shield triangle and inner arc geometry", () => {
    const x = 100;
    const y = 80;
    const radius = 40;
    const commands = buildSkillGestureIconGeometry("delta_shield", x, y, radius, 0xffffff, 1);

    const triangle = commandOfKind(commands, "polyline");
    const expectedTriangle: SkillGesturePoint[] = [
      [x, y - radius * 0.62],
      [x + radius * 0.66, y + radius * 0.44],
      [x - radius * 0.66, y + radius * 0.44],
      [x, y - radius * 0.62],
    ];
    triangle.points.forEach((point, index) => expectPointClose(point, expectedTriangle[index]!));
    const arc = commandOfKind(commands, "arc");
    expectPointClose(arc.center, [x, y + radius * 0.05]);
    expect(arc.radius).toBe(radius * 0.28);
    expect(arc.startAngle).toBe(Math.PI * 0.08);
    expect(arc.endAngle).toBe(Math.PI * 1.9);
  });

  it("builds Nova Pulse from the central ring into three radial outward arrows", () => {
    const x = 100;
    const y = 100;
    const radius = 40;
    const commands = buildSkillGestureIconGeometry("nova_pulse", x, y, radius, 0xffffff, 1);

    const circle = commandOfKind(commands, "circle");
    expectPointClose(circle.center, [x, y]);
    expect(circle.radius).toBe(radius * 0.38);
    const segmentCommands = commands.filter((command): command is Extract<SkillGestureCommand, { kind: "segments" }> => command.kind === "segments");
    const directions = [-Math.PI / 2, Math.PI / 6, (Math.PI * 5) / 6];
    directions.forEach((angle, index) => {
      const shaft = segmentCommands[index * 2]!.segments[0]!;
      const arrow = segmentCommands[index * 2 + 1]!;
      expectPointClose(shaft[0], [x + Math.cos(angle) * radius * 0.34, y + Math.sin(angle) * radius * 0.34]);
      expectPointClose(shaft[1], [x + Math.cos(angle) * radius * 0.9, y + Math.sin(angle) * radius * 0.9]);
      const startRadius = Math.hypot(shaft[0][0] - x, shaft[0][1] - y) / radius;
      const endRadius = Math.hypot(shaft[1][0] - x, shaft[1][1] - y) / radius;
      const radialDot = (shaft[0][0] - x) * (shaft[1][0] - shaft[0][0])
        + (shaft[0][1] - y) * (shaft[1][1] - shaft[0][1]);
      expect(startRadius).toBeLessThanOrEqual(0.4);
      expect(endRadius).toBeGreaterThanOrEqual(0.7);
      expect(radialDot).toBeGreaterThan(0);
      arrow.segments.forEach(([tip]) => expectPointClose(tip, shaft[1]));
    });
  });

  it("does nothing for unsupported skills and invalid bounded geometry", () => {
    expect(buildSkillGestureIconGeometry("unsupported_skill", 100, 100, 40, 0xffffff, 1)).toEqual([]);
    expect(buildSkillGestureIconGeometry("solar_lance", Number.MAX_VALUE, 100, 40, 0xffffff, 1)).toEqual([]);
    expect(buildSkillGestureIconGeometry("solar_lance", 100, -Number.MAX_VALUE, 40, 0xffffff, 1)).toEqual([]);
    expect(buildSkillGestureIconGeometry("solar_lance", ICON_MAX_ABS_COORDINATE + 1, 100, 40, 0xffffff, 1)).toEqual([]);
    expect(buildSkillGestureIconGeometry("solar_lance", 100, 100, Number.MAX_VALUE, 0xffffff, 1)).toEqual([]);
    expect(buildSkillGestureIconGeometry("solar_lance", 100, 100, ICON_MAX_RADIUS + 1, 0xffffff, 1)).toEqual([]);
    expect(buildSkillGestureIconGeometry("solar_lance", 100, 100, 0, 0xffffff, 1)).toEqual([]);
    expect(buildSkillGestureIconGeometry("solar_lance", 100, 100, -1, 0xffffff, 1)).toEqual([]);
    expect(buildSkillGestureIconGeometry("solar_lance", 100, 100, 40, 0xffffff, Number.NaN)).toEqual([]);
    expect(buildSkillGestureIconGeometry("solar_lance", 100, 100, 40, 0xffffff, -0.1)).toEqual([]);
  });

  it.each([-1, 1.5, 0x1000000, Number.MAX_VALUE])("rejects invalid color %s instead of passing it to Pixi", (color) => {
    expect(buildSkillGestureIconGeometry("solar_lance", 100, 100, 40, color, 1)).toEqual([]);
  });

  it("accepts documented coordinate, radius, and color boundaries without non-finite output", () => {
    const black = buildSkillGestureIconGeometry(
      "solar_lance",
      ICON_MAX_ABS_COORDINATE,
      -ICON_MAX_ABS_COORDINATE,
      ICON_MAX_RADIUS,
      0x000000,
      1,
    );
    const white = buildSkillGestureIconGeometry("solar_lance", 0, 0, 1, 0xffffff, 1);

    expect(black).not.toEqual([]);
    expect(white).not.toEqual([]);
    expect([...black, ...white].flatMap(numbersOf).every(Number.isFinite)).toBe(true);
  });

  it("clamps a visible alpha above one in semantic styles", () => {
    const commands = buildSkillGestureIconGeometry("solar_lance", 100, 100, 40, 0xffffff, 2);

    expect(commands.map((command) => command.style.alpha)).toEqual([1, 1]);
  });
});
