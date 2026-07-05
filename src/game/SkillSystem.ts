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

  tryNovaPulse(g: GestureResult, ctx: SkillContext): NovaPulseActivation | null {
    const def = this.skills.nova_pulse;
    if (g.points.length < 2) return null;
    if (!this.isReady("nova_pulse")) return null;
    if (ctx.gauge < def.gaugeCost && !this.skills._debug.infiniteGauge) return null;
    if (straightness(g.points) < (def.straightnessMin ?? 0.72)) return null;

    const first = g.points[0]!;
    const last = g.points[g.points.length - 1]!;
    const { cx, cy, r } = ctx.earth;
    const startD = Math.hypot(first.x - cx, first.y - cy);
    const endD = Math.hypot(last.x - cx, last.y - cy);
    if (startD > (def.startNearEarthMaxR ?? 1.45) * r) return null;
    if (endD < (def.endpointOutsideR ?? 2.35) * r) return null;
    if (pathLength(g.points) < (def.minPathLengthR ?? 1.2) * r) return null;

    const durationMs = Math.max(0, last.t - first.t);
    if (durationMs > (def.durationMs ?? 650)) return null;

    this.cooldowns.nova_pulse = (def.cooldownSec ?? 18) * 1000;
    return {
      skillId: "nova_pulse",
      radiusPx: (def.radiusRatio ?? 2.7) * r,
      damage: def.hitDamage ?? 1,
      pushPx: def.pushPx ?? 170,
      targetCap: def.targetCap ?? 4,
    };
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
