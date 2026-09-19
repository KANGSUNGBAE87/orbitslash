import type { GestureResult, HitResult, Segment, SkillTable, EarthRef } from "./types";
import { pathLength, straightness } from "./gesture-helpers";

// 스킬 시스템 (implementation-plan §3.8 확장). canonical 스킬 = 5종
// (orbital_cut/solar_lance/gravity_slow/delta_shield/nova_pulse).
// 여기서는 제스처 조건, 게이지, 쿨타임 판정을 담당하고 GameScene이 적 목록/VFX와 연결한다.

export interface SkillContext {
  earth: EarthRef;
  gauge: number;
  screenShortSide: number;
}

export interface SolarLanceActivation {
  skillId: "solar_lance";
  judgedHits: HitResult[]; // pointer-up 시점 확정 대상 (이후 연출은 시각 전용)
  vfxLine: Segment; // 연출용 — 판정에 영향 없음
}

export interface GravitySlowActivation {
  skillId: "gravity_slow";
  durationMs: number;
  slowMultiplier: number;
}

export interface OrbitalCutActivation {
  skillId: "orbital_cut";
  radiusPx: number;
  damage: number;
}

export interface DeltaShieldActivation {
  skillId: "delta_shield";
  durationMs: number;
  absorbCount: number;
}

export interface NovaPulseActivation {
  skillId: "nova_pulse";
  radiusPx: number;
  damage: number;
  pushPx: number;
  targetCap: number;
}

export type NovaPulseFailureReason =
  | "cooldown"
  | "gauge"
  | "start_too_far"
  | "endpoint_too_close"
  | "too_short"
  | "not_straight"
  | "too_slow"
  | "not_candidate";

type NovaPulseCandidateFailureReason = Exclude<NovaPulseFailureReason, "not_candidate">;

/** Pure Nova 판정 결과. 실패 이유는 UI 피드백에서 쓰되 candidate=false는 조용히 무시한다. */
export type NovaPulseEvaluation =
  | { ok: true; activation: NovaPulseActivation }
  | { ok: false; reason: "not_candidate"; candidate: false }
  | { ok: false; reason: NovaPulseCandidateFailureReason; candidate: true };

export type SkillActivation =
  | SolarLanceActivation
  | OrbitalCutActivation
  | GravitySlowActivation
  | DeltaShieldActivation
  | NovaPulseActivation;

export class SkillSystem {
  private cooldowns: Record<string, number> = {};

  constructor(private readonly skills: SkillTable) {}

  /** 쿨타임 감소 (ms). */
  tick(dtMs: number): void {
    for (const key of Object.keys(this.cooldowns)) {
      this.cooldowns[key] = Math.max(0, (this.cooldowns[key] ?? 0) - dtMs);
    }
  }

  isReady(skillId: string): boolean {
    return (this.cooldowns[skillId] ?? 0) <= 0;
  }

  /**
   * Solar Lance 발동 조건 판정 (product-plan §9.2). 직선성/길이/지구 관통 검사.
   * 판정 통과 시 vfxLine만 반환하고, 실제 적 매칭은 GameScene collision 단계에서 처리한다.
   * 게이지/쿨타임 미충족이면 null.
   */
  trySolarLance(g: GestureResult, ctx: SkillContext): SolarLanceActivation | null {
    const def = this.skills.solar_lance;
    if (g.points.length < 2) return null;
    if (!this.isReady("solar_lance")) return null;
    if (ctx.gauge < def.gaugeCost && !this.skills._debug.infiniteGauge) return null;

    const first = g.points[0]!;
    const last = g.points[g.points.length - 1]!;

    // 직선성 (≥0.88)
    if (straightness(g.points) < (def.straightnessMin ?? 0.88)) return null;

    // 최소 길이 (화면 짧은 축의 minLengthRatio 이상)
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < (def.minLengthRatio ?? 0.6) * ctx.screenShortSide) return null;

    const { cx, cy, r } = ctx.earth;

    // 지구 관통: 선분-지구중심 거리 ≤ lineToEarthMaxR * R
    const earthToLine = pointToSegmentDistance(cx, cy, first.x, first.y, last.x, last.y);
    if (earthToLine > (def.lineToEarthMaxR ?? 0.6) * r) return null;

    // 양 끝점이 지구 반경 endpointOutsideR * R 바깥
    const outside = (def.endpointOutsideR ?? 1.5) * r;
    const d0 = Math.hypot(first.x - cx, first.y - cy);
    const d1 = Math.hypot(last.x - cx, last.y - cy);
    if (d0 < outside || d1 < outside) return null;

    this.cooldowns.solar_lance = (def.cooldownSec ?? 12) * 1000;
    return {
      skillId: "solar_lance",
      judgedHits: [], // GameScene: pointer-up 스냅샷으로 적 목록과 직선 교차해 채움
      vfxLine: { a: first, b: last },
    };
  }

  tryGravitySlow(g: GestureResult, ctx: SkillContext): GravitySlowActivation | null {
    const def = this.skills.gravity_slow;
    if (g.points.length < 3) return null;
    if (!this.isReady("gravity_slow")) return null;
    if (ctx.gauge < def.gaugeCost && !this.skills._debug.infiniteGauge) return null;
    if (!g.enclosesEarth) return null;
    if (g.totalTurnRad < (def.circleTurnMinRad ?? 4.8)) return null;
    if (g.startEndGapRatio > (def.closeMaxRatio ?? 0.35)) return null;

    this.cooldowns.gravity_slow = (def.cooldownSec ?? 24) * 1000;
    return {
      skillId: "gravity_slow",
      durationMs: def.durationMs ?? 2600,
      slowMultiplier: def.slowMultiplier ?? 0.45,
    };
  }

  tryOrbitalCut(g: GestureResult, ctx: SkillContext): OrbitalCutActivation | null {
    const def = this.skills.orbital_cut;
    if (g.points.length < 4) return null;
    if (!this.isReady("orbital_cut")) return null;
    if (ctx.gauge < def.gaugeCost && !this.skills._debug.infiniteGauge) return null;
    if (!g.enclosesEarth) return null;
    if (g.totalTurnRad < (def.orbitTurnMinRad ?? 7.2)) return null;
    if (g.startEndGapRatio > (def.closeMaxRatio ?? 0.55)) return null;

    this.cooldowns.orbital_cut = (def.cooldownSec ?? 18) * 1000;
    return {
      skillId: "orbital_cut",
      radiusPx: (def.radiusRatio ?? 4.2) * ctx.earth.r,
      damage: def.hitDamage ?? 2,
    };
  }

  /**
   * Nova Pulse를 상태 변경 없이 판정한다.
   *
   * 실패 우선순위는 candidate → cooldown → gauge → 시작점 → 끝점 → 길이 →
   * 직선성 → 속도 순으로 고정한다. UI가 같은 제스처에 항상 같은 안내를 보여주기 위함이다.
   */
  evaluateNovaPulse(g: GestureResult, ctx: SkillContext): NovaPulseEvaluation {
    if (!isValidNovaPulseInput(g, ctx.earth)) {
      return { ok: false, reason: "not_candidate", candidate: false };
    }

    const def = resolveNovaPulseDefinition(this.skills.nova_pulse);
    if (!isNovaPulseCandidate(g, ctx.earth, def)) {
      return { ok: false, reason: "not_candidate", candidate: false };
    }
    if (!this.isReady("nova_pulse")) {
      return { ok: false, reason: "cooldown", candidate: true };
    }
    if (!Number.isFinite(ctx.gauge) || (ctx.gauge < def.gaugeCost && !this.skills._debug.infiniteGauge)) {
      return { ok: false, reason: "gauge", candidate: true };
    }

    const first = g.points[0]!;
    const last = g.points[g.points.length - 1]!;
    const { cx, cy, r } = ctx.earth;
    const startD = Math.hypot(first.x - cx, first.y - cy);
    const endD = Math.hypot(last.x - cx, last.y - cy);
    if (startD > def.startNearEarthMaxR * r) {
      return { ok: false, reason: "start_too_far", candidate: true };
    }
    if (endD < def.endpointOutsideR * r) {
      return { ok: false, reason: "endpoint_too_close", candidate: true };
    }
    if (pathLength(g.points) < def.minPathLengthR * r) {
      return { ok: false, reason: "too_short", candidate: true };
    }
    if (straightness(g.points) < def.straightnessMin) {
      return { ok: false, reason: "not_straight", candidate: true };
    }

    const durationMs = Math.max(0, last.t - first.t);
    if (durationMs > def.durationMs) {
      return { ok: false, reason: "too_slow", candidate: true };
    }

    const radiusPx = def.radiusRatio * r;
    if (!Number.isFinite(radiusPx)) {
      return { ok: false, reason: "not_candidate", candidate: false };
    }

    return {
      ok: true,
      activation: {
        skillId: "nova_pulse",
        radiusPx,
        damage: def.hitDamage,
        pushPx: def.pushPx,
        targetCap: def.targetCap,
      },
    };
  }

  tryNovaPulse(g: GestureResult, ctx: SkillContext): NovaPulseActivation | null {
    const evaluation = this.evaluateNovaPulse(g, ctx);
    if (!evaluation.ok) return null;

    const def = resolveNovaPulseDefinition(this.skills.nova_pulse);
    this.cooldowns.nova_pulse = def.cooldownSec * 1000;
    return evaluation.activation;
  }

  tryDeltaShield(g: GestureResult, ctx: SkillContext): DeltaShieldActivation | null {
    const def = this.skills.delta_shield;
    if (g.points.length < 4) return null;
    if (!this.isReady("delta_shield")) return null;
    if (ctx.gauge < def.gaugeCost && !this.skills._debug.infiniteGauge) return null;
    if (!g.enclosesEarth) return null;
    if (g.vertexCount < (def.triangleVertexMin ?? 3)) return null;
    if (g.startEndGapRatio > (def.closeMaxRatio ?? 0.22)) return null;

    this.cooldowns.delta_shield = (def.cooldownSec ?? 28) * 1000;
    return {
      skillId: "delta_shield",
      durationMs: def.durationMs ?? 3200,
      absorbCount: def.absorbCount ?? 3,
    };
  }

  /** 남은 쿨타임(ms). HUD 표시용. */
  cooldownRemaining(skillId: string): number {
    return this.cooldowns[skillId] ?? 0;
  }

  /** Tutorial/practice retry hook. Normal gameplay never resets another skill. */
  resetCooldown(skillId: string): void {
    this.cooldowns[skillId] = 0;
  }
}

export interface ResolvedNovaPulseDefinition {
  gaugeCost: number;
  cooldownSec: number;
  hitDamage: number;
  radiusRatio: number;
  pushPx: number;
  targetCap: number;
  startNearEarthMaxR: number;
  endpointOutsideR: number;
  minPathLengthR: number;
  straightnessMin: number;
  durationMs: number;
}

export const NOVA_PULSE_SAFE_FALLBACK: Readonly<ResolvedNovaPulseDefinition> = Object.freeze({
  gaugeCost: 64,
  cooldownSec: 18,
  hitDamage: 1,
  radiusRatio: 2.7,
  pushPx: 170,
  targetCap: 4,
  startNearEarthMaxR: 1.45,
  endpointOutsideR: 2.35,
  minPathLengthR: 1.2,
  straightnessMin: 0.72,
  durationMs: 650,
});

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

/** Runtime/remote config 오염이 UI, activation, cooldown에 서로 다르게 번지지 않게 하는 공용 SSOT. */
export function resolveNovaPulseDefinition(definition: unknown): ResolvedNovaPulseDefinition {
  const value = (key: keyof ResolvedNovaPulseDefinition): unknown => (
    typeof definition === "object" && definition !== null
      ? (definition as Record<string, unknown>)[key]
      : undefined
  );
  const targetCap = boundedNumber(value("targetCap"), NOVA_PULSE_SAFE_FALLBACK.targetCap, 1, 100);
  return {
    gaugeCost: boundedNumber(value("gaugeCost"), NOVA_PULSE_SAFE_FALLBACK.gaugeCost, 0, 100),
    cooldownSec: boundedNumber(value("cooldownSec"), NOVA_PULSE_SAFE_FALLBACK.cooldownSec, 0, 300),
    hitDamage: boundedNumber(value("hitDamage"), NOVA_PULSE_SAFE_FALLBACK.hitDamage, 0, 1_000),
    radiusRatio: boundedNumber(value("radiusRatio"), NOVA_PULSE_SAFE_FALLBACK.radiusRatio, 0.01, 20),
    pushPx: boundedNumber(value("pushPx"), NOVA_PULSE_SAFE_FALLBACK.pushPx, 0, 2_000),
    targetCap: Number.isInteger(targetCap) ? targetCap : NOVA_PULSE_SAFE_FALLBACK.targetCap,
    startNearEarthMaxR: boundedNumber(value("startNearEarthMaxR"), NOVA_PULSE_SAFE_FALLBACK.startNearEarthMaxR, 0, 10),
    endpointOutsideR: boundedNumber(value("endpointOutsideR"), NOVA_PULSE_SAFE_FALLBACK.endpointOutsideR, 0, 20),
    minPathLengthR: boundedNumber(value("minPathLengthR"), NOVA_PULSE_SAFE_FALLBACK.minPathLengthR, 0, 20),
    straightnessMin: boundedNumber(value("straightnessMin"), NOVA_PULSE_SAFE_FALLBACK.straightnessMin, 0, 1),
    durationMs: boundedNumber(value("durationMs"), NOVA_PULSE_SAFE_FALLBACK.durationMs, 0, 60_000),
  };
}

function isValidNovaPulseInput(g: GestureResult, earth: EarthRef): boolean {
  if (![earth.cx, earth.cy, earth.r].every(Number.isFinite) || earth.r <= 0) return false;
  if (!Array.isArray(g.points)) return false;

  let previousTime = Number.NEGATIVE_INFINITY;
  for (const point of g.points) {
    if (![point.x, point.y, point.t].every(Number.isFinite)) return false;
    if (point.t < previousTime) return false;
    previousTime = point.t;
  }
  return true;
}

/**
 * 명백한 바깥쪽 방사형 시도만 Nova 후보로 올리는 완화 gate.
 * 실제 발동 임계보다 느슨하게 잡아 near-miss 이유가 도달 가능하면서, 일반 베기와
 * 지구를 가로지르는 Solar Lance에는 Nova 안내가 끼어들지 않게 한다.
 */
function isNovaPulseCandidate(
  g: GestureResult,
  earth: EarthRef,
  def: ResolvedNovaPulseDefinition,
): boolean {
  if (g.points.length < 2) return false;

  const first = g.points[0]!;
  const last = g.points[g.points.length - 1]!;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const displacement = Math.hypot(dx, dy);
  const strictMinimumDisplacementR = def.minPathLengthR * def.straightnessMin;
  const strictMinimumRadialGainR = Math.max(0, def.endpointOutsideR - def.startNearEarthMaxR);
  const candidateMoveR = Math.min(0.35, strictMinimumDisplacementR, strictMinimumRadialGainR);
  const minimumCandidateMove = earth.r * candidateMoveR;
  if (displacement <= 0) return false;
  if (displacement < minimumCandidateMove) return false;
  if (straightness(g.points) < Math.min(0.45, def.straightnessMin)) return false;

  const startX = first.x - earth.cx;
  const startY = first.y - earth.cy;
  const endX = last.x - earth.cx;
  const endY = last.y - earth.cy;
  const startDistance = Math.hypot(startX, startY);
  const endDistance = Math.hypot(endX, endY);
  const candidateStartMaxR = def.startNearEarthMaxR + 0.75;
  if (startDistance > candidateStartMaxR * earth.r + 1e-6) return false;
  if (endDistance <= startDistance) return false;
  if (endDistance - startDistance < minimumCandidateMove) return false;

  // 중심에서 시작하면 끝점 방향을 사용한다. 그 외에는 시작점 기준 바깥 방향과
  // 드래그 방향의 정렬도를 본다. 지구 관통 선은 이 값이 음수가 된다.
  const radialX = startDistance > earth.r * 0.05 ? startX / startDistance : endX / endDistance;
  const radialY = startDistance > earth.r * 0.05 ? startY / startDistance : endY / endDistance;
  const outwardAlignment = (dx * radialX + dy * radialY) / displacement;
  return outwardAlignment >= 0.55;
}

/** 점 (px,py)와 선분 (ax,ay)-(bx,by) 사이 최단 거리. */
function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
