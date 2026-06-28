import type { AccuracyKind, EnemyState, Segment } from "./types";

export function requiredDirectionalSlashAngleRad(enemy: EnemyState): number {
  return enemy.directionalSlashAngleRad ?? enemy.angle + Math.PI / 2;
}

export function slashMatchesDirectionalAngle(segment: Segment, requiredAngleRad: number, toleranceDeg: number): boolean {
  const slashAngle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
  const delta = orientationDeltaRad(slashAngle, requiredAngleRad);
  return delta <= (toleranceDeg * Math.PI) / 180;
}

export function directionalSlashAccuracy(segment: Segment, enemy: EnemyState): AccuracyKind | null {
  if (!enemy.directional) return "normal";

  return slashMatchesDirectionalAngle(segment, requiredDirectionalSlashAngleRad(enemy), enemy.directionalToleranceDeg ?? 30)
    ? "directional"
    : null;
}

function orientationDeltaRad(a: number, b: number): number {
  let diff = Math.abs(normalizeRad(a) - normalizeRad(b)) % Math.PI;
  if (diff > Math.PI / 2) diff = Math.PI - diff;
  return diff;
}

function normalizeRad(value: number): number {
  let out = value % (Math.PI * 2);
  if (out < 0) out += Math.PI * 2;
  return out;
}
