import { BASE_HEIGHT, BASE_WIDTH, EARTH_CENTER_Y } from "./coords";
import type { IRng } from "./Rng";
import type { SpecialObjectPolicy } from "./ModeConfig";
import {
  applySpecialObjectHit,
  createSpecialObject,
  SPECIAL_OBJECT_DEFINITIONS,
  staticSpecialObjectMotion,
  type SpecialObjectHitEffect,
  type SpecialObjectMotionState,
  type SpecialObjectState,
  type SpecialObjectType,
} from "./SpecialObjectSystem";

export interface SpecialObjectRuntimeOptions {
  firstSpawnMs?: number;
  spawnIntervalMs?: number;
  maxActive?: number;
  forcedTypes?: SpecialObjectType[];
}

export interface SpecialObjectContext {
  energy: number;
  maxEnergy: number;
}

export interface SpecialObjectExpireReward {
  id: number;
  type: SpecialObjectType;
  score: number;
  gauge: number;
  heal?: number;
}

const DEFAULT_FIRST_SPAWN_MS = 12000;
const DEFAULT_SPAWN_INTERVAL_MS = 14000;
const DEFAULT_MAX_ACTIVE = 2;

export class SpecialObjectRuntime {
  private active: SpecialObjectState[] = [];
  private nextSpawnAtMs: number;
  private idSeq = 0;
  private forcedIndex = 0;

  constructor(
    private readonly rng: IRng,
    private readonly policy: SpecialObjectPolicy,
    private readonly options: SpecialObjectRuntimeOptions = {},
  ) {
    this.nextSpawnAtMs = options.firstSpawnMs ?? DEFAULT_FIRST_SPAWN_MS;
  }

  next(elapsedMs: number, context: SpecialObjectContext): SpecialObjectState[] {
    this.prune();
    const spawned: SpecialObjectState[] = [];
    if (elapsedMs < this.nextSpawnAtMs) return spawned;
    if (this.active.length >= (this.options.maxActive ?? DEFAULT_MAX_ACTIVE)) return spawned;

    const type = this.pickType(context);
    if (!type) return spawned;

    this.idSeq += 1;
    const x = 150 + this.rng.next() * (BASE_WIDTH - 300);
    const y = 410 + this.rng.next() * (BASE_HEIGHT - 760);
    const object = createSpecialObject({
      id: this.idSeq,
      type,
      x,
      y,
      nowMs: elapsedMs,
      motion: this.motionForType(type, x, y),
    });
    this.active.push(object);
    spawned.push(object);

    const base = this.options.spawnIntervalMs ?? DEFAULT_SPAWN_INTERVAL_MS;
    const jitter = 0.75 + this.rng.next() * 0.5;
    this.nextSpawnAtMs = elapsedMs + Math.round(base * jitter);
    return spawned;
  }

  getAlive(): SpecialObjectState[] {
    return this.active.filter((object) => object.alive);
  }

  step(nowMs: number): void {
    for (const object of this.active) {
      if (!object.alive || object.motion.kind === "static") continue;
      object.previousX = object.x;
      object.previousY = object.y;
      const ageSec = Math.max(0, (nowMs - object.createdAtMs) / 1000);
      if (object.motion.kind === "rescueDrift") {
        this.stepRescueDrift(object, ageSec);
        continue;
      }
      if (object.motion.kind === "satelliteOrbit") {
        this.stepSatelliteOrbit(object, ageSec);
      }
    }
  }

  applyHit(id: number): SpecialObjectHitEffect | null {
    const object = this.active.find((candidate) => candidate.id === id && candidate.alive);
    if (!object) return null;
    object.alive = false;
    const effect = applySpecialObjectHit(object);
    this.prune();
    return effect;
  }

  expire(nowMs: number): SpecialObjectExpireReward[] {
    const rewards: SpecialObjectExpireReward[] = [];
    for (const object of this.active) {
      if (!object.alive || object.expiresAtMs > nowMs) continue;
      object.alive = false;
      const def = SPECIAL_OBJECT_DEFINITIONS[object.type];
      const score = object.type === "friendlyRescue" ? 80 : def.expireScore ?? 0;
      const gauge = object.type === "friendlyRescue" ? 5 : def.expireGauge ?? 0;
      const heal = def.expireHeal ?? 0;
      if (score > 0 || gauge > 0 || heal > 0) {
        rewards.push({ id: object.id, type: object.type, score, gauge, ...(heal > 0 ? { heal } : {}) });
      }
    }
    this.prune();
    return rewards;
  }

  prune(): void {
    this.active = this.active.filter((object) => object.alive);
  }

  private pickType(context: SpecialObjectContext): SpecialObjectType | null {
    const forced = this.options.forcedTypes?.[this.forcedIndex];
    if (forced && this.policy[forced]) {
      this.forcedIndex += 1;
      return forced;
    }

    if (this.policy.energyCapsule && context.energy / Math.max(1, context.maxEnergy) <= 0.65) {
      return "energyCapsule";
    }

    const enabled = (Object.keys(this.policy) as SpecialObjectType[]).filter((type) => this.policy[type]);
    if (enabled.length === 0) return null;
    return enabled[this.rng.nextInt(enabled.length)] ?? null;
  }

  private motionForType(type: SpecialObjectType, x: number, y: number): SpecialObjectMotionState {
    const phaseRad = this.rng.next() * Math.PI * 2;
    if (type === "friendlyRescue") {
      return {
        kind: "rescueDrift",
        originX: x,
        originY: y,
        targetX: BASE_WIDTH / 2,
        targetY: EARTH_CENTER_Y,
        phaseRad,
        orbitRadiusPx: 0,
        radialSpeedPxPerSec: 38 + this.rng.next() * 16,
        angularSpeedRadPerSec: 0,
        verticalScale: 1,
      };
    }

    if (type === "satellite") {
      const orbitRadiusPx = 28 + this.rng.next() * 12;
      const verticalScale = 0.55;
      return {
        kind: "satelliteOrbit",
        originX: x - Math.cos(phaseRad) * orbitRadiusPx,
        originY: y - Math.sin(phaseRad) * orbitRadiusPx * verticalScale,
        phaseRad,
        orbitRadiusPx,
        radialSpeedPxPerSec: 0,
        angularSpeedRadPerSec: (0.9 + this.rng.next() * 0.35) * (this.rng.next() < 0.5 ? -1 : 1),
        verticalScale,
      };
    }

    return staticSpecialObjectMotion(x, y);
  }

  private stepRescueDrift(object: SpecialObjectState, ageSec: number): void {
    const targetX = object.motion.targetX ?? object.motion.originX;
    const targetY = object.motion.targetY ?? object.motion.originY;
    const dx = targetX - object.motion.originX;
    const dy = targetY - object.motion.originY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const travel = Math.min(distance * 0.68, object.motion.radialSpeedPxPerSec * ageSec);
    const wobble = Math.sin(ageSec * 2.2 + object.motion.phaseRad) * 9;
    const nx = -dy / distance;
    const ny = dx / distance;
    object.x = clampScreenX(object.motion.originX + (dx / distance) * travel + nx * wobble, object.radiusPx);
    object.y = clampScreenY(object.motion.originY + (dy / distance) * travel + ny * wobble, object.radiusPx);
  }

  private stepSatelliteOrbit(object: SpecialObjectState, ageSec: number): void {
    const angle = object.motion.phaseRad + object.motion.angularSpeedRadPerSec * ageSec;
    const pulse = Math.sin(ageSec * 2.4 + object.motion.phaseRad) * 4;
    const radius = Math.max(8, object.motion.orbitRadiusPx + pulse);
    object.x = clampScreenX(object.motion.originX + Math.cos(angle) * radius, object.radiusPx);
    object.y = clampScreenY(object.motion.originY + Math.sin(angle) * radius * object.motion.verticalScale, object.radiusPx);
  }
}

function clampScreenX(value: number, radiusPx: number): number {
  return Math.max(radiusPx + 10, Math.min(BASE_WIDTH - radiusPx - 10, value));
}

function clampScreenY(value: number, radiusPx: number): number {
  return Math.max(260 + radiusPx, Math.min(BASE_HEIGHT - radiusPx - 120, value));
}
