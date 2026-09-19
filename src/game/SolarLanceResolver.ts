import type { Segment } from "./types";
import type { SpecialObjectType } from "./SpecialObjectSystem";

export interface SolarLanceEnemyTarget {
  id: number;
  x: number;
  y: number;
  radiusPx: number;
}

export interface SolarLanceSpecialTarget {
  id: number;
  type: SpecialObjectType;
  x: number;
  y: number;
  radiusPx: number;
}

export interface SolarLanceResolution {
  vfxLine: Segment;
  enemyIds: number[];
  specialObjectIds: number[];
  stop?: { objectId: number; type: SpecialObjectType; lineT: number };
}

const TIE_EPSILON = 0.000001;

export function resolveSolarLanceSnapshot(
  line: Segment,
  enemies: readonly SolarLanceEnemyTarget[],
  specialObjects: readonly SolarLanceSpecialTarget[],
): SolarLanceResolution {
  const specialHits = specialObjects
    .map((object) => ({ object, lineT: hitLineT(line, object) }))
    .filter((candidate): candidate is { object: SolarLanceSpecialTarget; lineT: number } => candidate.lineT != null)
    .sort((left, right) => left.lineT - right.lineT || left.object.id - right.object.id);
  const protectedHit = specialHits.find(({ object }) => isProtectedObject(object.type));
  const stop = protectedHit
    ? { objectId: protectedHit.object.id, type: protectedHit.object.type, lineT: protectedHit.lineT }
    : undefined;
  const stopT = stop?.lineT ?? 1;
  const enemyIds = enemies
    .map((enemy) => ({ enemy, lineT: hitLineT(line, enemy) }))
    .filter((candidate): candidate is { enemy: SolarLanceEnemyTarget; lineT: number } => candidate.lineT != null && candidate.lineT < stopT - TIE_EPSILON)
    .sort((left, right) => left.lineT - right.lineT || left.enemy.id - right.enemy.id)
    .map(({ enemy }) => enemy.id);
  const specialObjectIds = specialHits
    .filter(({ lineT }) => lineT <= stopT + TIE_EPSILON)
    .map(({ object }) => object.id);
  return {
    vfxLine: stop ? truncateLine(line, stop.lineT) : cloneLine(line),
    enemyIds,
    specialObjectIds,
    stop,
  };
}

function isProtectedObject(type: SpecialObjectType): boolean {
  return type === "friendlyRescue" || type === "satellite";
}

function hitLineT(line: Segment, target: { x: number; y: number; radiusPx: number }): number | null {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(target.x - line.a.x, target.y - line.a.y) <= target.radiusPx ? 0 : null;
  const unclamped = ((target.x - line.a.x) * dx + (target.y - line.a.y) * dy) / lengthSquared;
  const lineT = Math.max(0, Math.min(1, unclamped));
  const closestX = line.a.x + dx * lineT;
  const closestY = line.a.y + dy * lineT;
  return Math.hypot(target.x - closestX, target.y - closestY) <= target.radiusPx ? lineT : null;
}

function truncateLine(line: Segment, lineT: number): Segment {
  return {
    a: { ...line.a },
    b: {
      x: line.a.x + (line.b.x - line.a.x) * lineT,
      y: line.a.y + (line.b.y - line.a.y) * lineT,
      t: line.a.t + (line.b.t - line.a.t) * lineT,
    },
  };
}

function cloneLine(line: Segment): Segment {
  return { a: { ...line.a }, b: { ...line.b } };
}
