import type { GestureResult, HitResult, Segment, SkillTable, EarthRef } from "./types";
import { straightness } from "./gesture-helpers";

// 스킬 시스템 (implementation-plan §3.8). Phase 1: Solar Lance 직선 판정 골격만.
// canonical 스킬 = 정확히 4종 (orbital_cut/solar_lance/gravity_slow/delta_shield).
// 게이지/쿨타임 골격 + Solar Lance 직선성 검사는 여기. pointer-up 스냅샷 판정 결과를
// 실제 적 목록과 매칭해 VFX를 띄우는 게임플레이 wiring은 Subagent B.
// TODO(Phase1-B): Solar Lance 발동 시 직선 경로 위 적 판정(pointer-up 스냅샷),
//   레이저 VFX(시각 전용, 판정 불변), 게이지 충전/소모, 쿨타임 tick를 GameScene에 wiring.
// TODO(Phase2+): orbital_cut/gravity_slow/delta_shield 제스처 매칭 + 효과.

export interface SkillContext {
  earth: EarthRef;
  gauge: number;
  screenShortSide: number;
}

export interface SkillActivation {
  skillId: "solar_lance";
  judgedHits: HitResult[]; // pointer-up 시점 확정 대상 (이후 연출은 시각 전용)
  vfxLine: Segment; // 연출용 — 판정에 영향 없음
}

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
   * 판정 통과 시 vfxLine만 채워 반환 (judgedHits 매칭은 Subagent B가 적 목록과 함께).
   * 게이지/쿨타임 미충족이면 null.
   */
  trySolarLance(g: GestureResult, ctx: SkillContext): SkillActivation | null {
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
