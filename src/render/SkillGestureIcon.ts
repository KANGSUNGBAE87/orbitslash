import type { Graphics } from "pixi.js";

// Far above the 1080x1920 logical canvas, while keeping every derived point below 1.2M.
export const ICON_MAX_ABS_COORDINATE = 1_000_000;
export const ICON_MAX_RADIUS = 100_000;

const SUPPORTED_SKILL_IDS = new Set<string>([
  "solar_lance",
  "gravity_slow",
  "orbital_cut",
  "delta_shield",
  "nova_pulse",
]);

export type SkillGesturePoint = readonly [number, number];
export type SkillGestureSegment = readonly [SkillGesturePoint, SkillGesturePoint];

export interface SkillGestureStrokeStyle {
  readonly width: number;
  readonly color: number;
  readonly alpha: number;
  readonly cap?: "round";
  readonly join?: "round";
}

export type SkillGestureCommand =
  | {
      readonly kind: "segments";
      readonly segments: readonly SkillGestureSegment[];
      readonly style: SkillGestureStrokeStyle;
    }
  | {
      readonly kind: "polyline";
      readonly points: readonly SkillGesturePoint[];
      readonly style: SkillGestureStrokeStyle;
    }
  | {
      readonly kind: "arc";
      readonly center: SkillGesturePoint;
      readonly radius: number;
      readonly startAngle: number;
      readonly endAngle: number;
      readonly style: SkillGestureStrokeStyle;
    }
  | {
      readonly kind: "circle";
      readonly center: SkillGesturePoint;
      readonly radius: number;
      readonly style: SkillGestureStrokeStyle;
    };

export function buildSkillGestureIconGeometry(
  skillId: string,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
): readonly SkillGestureCommand[] {
  if (!isValidIconInput(skillId, x, y, radius, color, alpha)) return [];

  const visibleAlpha = Math.min(1, alpha);
  const lineStyle = strokeStyle(6, color, visibleAlpha, true);

  if (skillId === "solar_lance") {
    const start: SkillGesturePoint = [x - radius * 0.68, y + radius * 0.42];
    const end: SkillGesturePoint = [x + radius * 0.72, y - radius * 0.46];
    return [segmentsCommand([[start, end]], lineStyle), arrowCommand(start, end, radius * 0.24, color, visibleAlpha)];
  }

  if (skillId === "gravity_slow") {
    const startAngle = -Math.PI * 0.88;
    const endAngle = Math.PI * 1.05;
    const arrowStart: SkillGesturePoint = [
      x + Math.cos(endAngle - 0.24) * radius * 0.62,
      y + Math.sin(endAngle - 0.24) * radius * 0.62,
    ];
    const arrowEnd: SkillGesturePoint = [
      x + Math.cos(endAngle) * radius * 0.62,
      y + Math.sin(endAngle) * radius * 0.62,
    ];
    return [
      {
        kind: "arc",
        center: [x, y],
        radius: radius * 0.62,
        startAngle,
        endAngle,
        style: lineStyle,
      },
      arrowCommand(arrowStart, arrowEnd, radius * 0.2, color, visibleAlpha),
    ];
  }

  if (skillId === "orbital_cut") {
    const points: SkillGesturePoint[] = [[x, y]];
    for (let i = 1; i <= 34; i += 1) {
      const progress = i / 34;
      const angle = progress * Math.PI * 4.25;
      const spiralRadius = radius * 0.12 + radius * 0.57 * progress;
      points.push([x + Math.cos(angle) * spiralRadius, y + Math.sin(angle) * spiralRadius]);
    }
    const beforeAngle = (33 / 34) * Math.PI * 4.25;
    const beforeRadius = radius * 0.12 + radius * 0.57 * (33 / 34);
    const arrowStart: SkillGesturePoint = [
      x + Math.cos(beforeAngle) * beforeRadius,
      y + Math.sin(beforeAngle) * beforeRadius,
    ];
    return [
      { kind: "polyline", points, style: { ...lineStyle, join: "round" } },
      arrowCommand(arrowStart, points.at(-1)!, radius * 0.18, color, visibleAlpha),
    ];
  }

  if (skillId === "delta_shield") {
    const top: SkillGesturePoint = [x, y - radius * 0.62];
    const right: SkillGesturePoint = [x + radius * 0.66, y + radius * 0.44];
    const left: SkillGesturePoint = [x - radius * 0.66, y + radius * 0.44];
    return [
      { kind: "polyline", points: [top, right, left, top], style: { ...lineStyle, join: "round" } },
      {
        kind: "arc",
        center: [x, y + radius * 0.05],
        radius: radius * 0.28,
        startAngle: Math.PI * 0.08,
        endAngle: Math.PI * 1.9,
        style: strokeStyle(4, color, visibleAlpha * 0.7, true),
      },
    ];
  }

  const directions = [-Math.PI / 2, Math.PI / 6, (Math.PI * 5) / 6] as const;
  const commands: SkillGestureCommand[] = [
    {
      kind: "circle",
      center: [x, y],
      radius: radius * 0.38,
      style: strokeStyle(4, color, visibleAlpha * 0.68),
    },
  ];
  for (const angle of directions) {
    const start: SkillGesturePoint = [
      x + Math.cos(angle) * radius * 0.34,
      y + Math.sin(angle) * radius * 0.34,
    ];
    const end: SkillGesturePoint = [
      x + Math.cos(angle) * radius * 0.9,
      y + Math.sin(angle) * radius * 0.9,
    ];
    commands.push(segmentsCommand([[start, end]], lineStyle));
    commands.push(arrowCommand(start, end, radius * 0.18, color, visibleAlpha));
  }
  return commands;
}

export function drawSkillGestureIcon(
  graphics: Graphics,
  skillId: string,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
): void {
  for (const command of buildSkillGestureIconGeometry(skillId, x, y, radius, color, alpha)) {
    if (command.kind === "segments") {
      for (const [start, end] of command.segments) {
        graphics.moveTo(start[0], start[1]).lineTo(end[0], end[1]);
      }
      graphics.stroke(command.style);
      continue;
    }

    if (command.kind === "polyline") {
      const first = command.points[0];
      if (!first) continue;
      graphics.moveTo(first[0], first[1]);
      for (const point of command.points.slice(1)) graphics.lineTo(point[0], point[1]);
      graphics.stroke(command.style);
      continue;
    }

    if (command.kind === "arc") {
      graphics
        .arc(command.center[0], command.center[1], command.radius, command.startAngle, command.endAngle)
        .stroke(command.style);
      continue;
    }

    graphics.circle(command.center[0], command.center[1], command.radius).stroke(command.style);
  }
}

function isValidIconInput(
  skillId: string,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
): boolean {
  return SUPPORTED_SKILL_IDS.has(skillId)
    && Number.isFinite(x)
    && Math.abs(x) <= ICON_MAX_ABS_COORDINATE
    && Number.isFinite(y)
    && Math.abs(y) <= ICON_MAX_ABS_COORDINATE
    && Number.isFinite(radius)
    && radius > 0
    && radius <= ICON_MAX_RADIUS
    && Number.isInteger(color)
    && color >= 0
    && color <= 0xffffff
    && Number.isFinite(alpha)
    && alpha > 0;
}

function strokeStyle(
  width: number,
  color: number,
  alpha: number,
  rounded = false,
): SkillGestureStrokeStyle {
  return rounded ? { width, color, alpha, cap: "round" } : { width, color, alpha };
}

function segmentsCommand(
  segments: readonly SkillGestureSegment[],
  style: SkillGestureStrokeStyle,
): Extract<SkillGestureCommand, { kind: "segments" }> {
  return { kind: "segments", segments, style };
}

function arrowCommand(
  start: SkillGesturePoint,
  end: SkillGesturePoint,
  size: number,
  color: number,
  alpha: number,
): Extract<SkillGestureCommand, { kind: "segments" }> {
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const left = angle + Math.PI * 0.82;
  const right = angle - Math.PI * 0.82;
  return segmentsCommand(
    [
      [end, [end[0] + Math.cos(left) * size, end[1] + Math.sin(left) * size]],
      [end, [end[0] + Math.cos(right) * size, end[1] + Math.sin(right) * size]],
    ],
    strokeStyle(Math.max(3, size * 0.18), color, alpha, true),
  );
}
