export type SpecialObjectType = "friendlyRescue" | "satellite" | "energyCapsule" | "empMine";

export interface SpecialObjectDef {
  type: SpecialObjectType;
  radiusPx: number;
  ttlMs: number;
  heal?: number;
  gauge?: number;
  score?: number;
  damage?: number;
  expireHeal?: number;
  expireGauge?: number;
  expireScore?: number;
  slowMs?: number;
  comboBreak?: boolean;
}

export type SpecialObjectMotionKind = "static" | "rescueDrift" | "satelliteOrbit";

export interface SpecialObjectMotionState {
  kind: SpecialObjectMotionKind;
  originX: number;
  originY: number;
  targetX?: number;
  targetY?: number;
  phaseRad: number;
  orbitRadiusPx: number;
  radialSpeedPxPerSec: number;
  angularSpeedRadPerSec: number;
  verticalScale: number;
}

export interface SpecialObjectState {
  id: number;
  type: SpecialObjectType;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  radiusPx: number;
  createdAtMs: number;
  expiresAtMs: number;
  motion: SpecialObjectMotionState;
  alive: boolean;
}

export type SpecialObjectHitEffect =
  | { kind: "benefit"; heal: number; gauge: number; score: number; slowMs: number }
  | { kind: "penalty"; damage: number; comboBreak: boolean };

export const SPECIAL_OBJECT_DEFINITIONS: Record<SpecialObjectType, SpecialObjectDef> = {
  friendlyRescue: {
    type: "friendlyRescue",
    radiusPx: 46,
    ttlMs: 6200,
    damage: 10,
    comboBreak: true,
  },
  satellite: {
    type: "satellite",
    radiusPx: 38,
    ttlMs: 7000,
    damage: 8,
    comboBreak: true,
    expireScore: 120,
    expireGauge: 6,
  },
  energyCapsule: {
    type: "energyCapsule",
    radiusPx: 44,
    ttlMs: 5400,
    damage: 0,
    comboBreak: false,
    expireHeal: 14,
    expireGauge: 14,
    expireScore: 60,
  },
  empMine: {
    type: "empMine",
    radiusPx: 52,
    ttlMs: 5000,
    damage: 6,
    comboBreak: true,
  },
};

export function createSpecialObject(input: {
  id: number;
  type: SpecialObjectType;
  x: number;
  y: number;
  nowMs: number;
  motion?: SpecialObjectMotionState;
}): SpecialObjectState {
  const def = SPECIAL_OBJECT_DEFINITIONS[input.type];
  return {
    id: input.id,
    type: input.type,
    x: input.x,
    y: input.y,
    previousX: input.x,
    previousY: input.y,
    radiusPx: def.radiusPx,
    createdAtMs: input.nowMs,
    expiresAtMs: input.nowMs + def.ttlMs,
    motion: input.motion ?? staticSpecialObjectMotion(input.x, input.y),
    alive: true,
  };
}

export function staticSpecialObjectMotion(x: number, y: number): SpecialObjectMotionState {
  return {
    kind: "static",
    originX: x,
    originY: y,
    phaseRad: 0,
    orbitRadiusPx: 0,
    radialSpeedPxPerSec: 0,
    angularSpeedRadPerSec: 0,
    verticalScale: 1,
  };
}

export function applySpecialObjectHit(object: Pick<SpecialObjectState, "type">): SpecialObjectHitEffect {
  const def = SPECIAL_OBJECT_DEFINITIONS[object.type];
  if (object.type === "friendlyRescue" || object.type === "satellite" || object.type === "energyCapsule" || object.type === "empMine") {
    return {
      kind: "penalty",
      damage: def.damage ?? 0,
      comboBreak: def.comboBreak ?? false,
    };
  }
  return {
    kind: "benefit",
    heal: def.heal ?? 0,
    gauge: def.gauge ?? 0,
    score: def.score ?? 0,
    slowMs: def.slowMs ?? 0,
  };
}
