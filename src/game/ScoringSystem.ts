import type {
  ScoringConfig,
  HitResult,
  DistanceBand,
  AccuracyKind,
} from "./types";
import { multiCutTier } from "./CollisionSystem";

// 점수 시스템 (product-plan §13). 순수/결정적 — 렌더·시간 의존 없음 → 서버 재계산 검증 가능.
// PixiJS import 금지.

export interface ScoreInput {
  baseScore: number; // enemies.json.score (SSOT)
  band: DistanceBand;
  accuracy: AccuracyKind;
  combo: number;
  specialBonus?: number;
}

export interface OnHitResult {
  gained: number;
  combo: number;
  multiCut: number;
  gauge: number;
  lastSave: boolean;
}

export interface ScoringSnapshot {
  score: number;
  maxCombo: number;
  combo: number;
  lastSaveCount: number;
  kills: number;
}

/** 콤보 값 → 배율 (product-plan §13.3). 가장 높은 충족 tier의 mult. */
export function comboMultiplierFor(combo: number, cfg: ScoringConfig): number {
  let mult = 1.0;
  for (const tier of cfg.comboMultiplier) {
    if (combo >= tier.min) mult = tier.mult;
  }
  return mult;
}

/** 거리밴드 → 거리배율. impact는 distanceMultiplier에 없으므로 outer로 fallback. */
function distanceMultiplierFor(band: DistanceBand, cfg: ScoringConfig): number {
  const dm = cfg.distanceMultiplier as Record<string, number>;
  return dm[band] ?? dm.outer ?? 1.0;
}

/** 점수 공식: 기본 × 거리 × 정확도 × 콤보 + 특수보너스 (product-plan §13.1). */
export function scoreFor(input: ScoreInput, cfg: ScoringConfig): number {
  const distance = distanceMultiplierFor(input.band, cfg);
  const accuracy = cfg.accuracyMultiplier[input.accuracy] ?? 1.0;
  const combo = comboMultiplierFor(input.combo, cfg);
  const base = input.baseScore * distance * accuracy * combo;
  return base + (input.specialBonus ?? 0);
}

type BaseScoreFn = (enemyId: number) => number;
type EnemyTypeFn = (enemyId: number) => string;

/**
 * 한 슬래시의 HitResult[]를 받아 점수/콤보/게이지/Last Save를 갱신한다.
 * - 콤보 += hits.length (cap = comboGainPerSlashCap, null=무제한)
 * - Multi Cut tier 보너스 1회 가산 (콤보와 독립)
 * - 게이지 += Σ gaugeGain(적별) + comboKill + lastSave
 * - baseScore는 주입된 콜백(enemies.json.score)에서 취득
 */
export class ScoringSystem {
  private cfg: ScoringConfig;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private lastSaveCount = 0;
  private kills = 0;
  private lastComboHitAtMs: number | null = null;

  constructor(cfg: ScoringConfig) {
    this.cfg = cfg;
  }

  onHit(hits: HitResult[], baseScoreOf: BaseScoreFn, enemyTypeOf: EnemyTypeFn, hitAtMs?: number): OnHitResult {
    if (hits.length === 0) {
      return { gained: 0, combo: this.combo, multiCut: 0, gauge: 0, lastSave: false };
    }

    const timeoutMs = this.cfg.comboChainTimeoutMs;
    if (
      timeoutMs != null &&
      hitAtMs != null &&
      this.lastComboHitAtMs != null &&
      hitAtMs - this.lastComboHitAtMs >= timeoutMs
    ) {
      this.combo = 0;
    }

    // 콤보 증가량: 처치 마릿수, cap 적용
    const cap = this.cfg.comboGainPerSlashCap;
    const comboGain = cap == null ? hits.length : Math.min(hits.length, cap);
    this.kills += hits.length;
    this.combo += comboGain;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    // 점수: 각 적별 점수 합산. 콤보 배율은 갱신된 현재 콤보 기준.
    let gained = 0;
    let gauge = 0;
    let lastSave = false;
    for (const h of hits) {
      const base = baseScoreOf(h.enemyId);
      gained += scoreFor({ baseScore: base, band: h.band, accuracy: h.accuracy, combo: this.combo }, this.cfg);
      // 게이지: 적 타입별 gaugeGain
      const type = enemyTypeOf(h.enemyId);
      gauge += this.cfg.gaugeGain[type] ?? 0;
      if (h.accuracy === "directional") {
        gauge += this.cfg.gaugeGain.directionalCut ?? 0;
      }
      if (h.band === "lastSave") {
        lastSave = true;
        this.lastSaveCount += 1;
        gauge += this.cfg.gaugeGain.lastSave ?? 0;
      }
    }

    // 콤보 처치(2마리 이상) 게이지
    if (hits.length >= 2) {
      gauge += this.cfg.gaugeGain.comboKill ?? 0;
    }

    // Multi Cut flat 보너스 (등급당 1회)
    const tier = multiCutTier(hits.length);
    const multiCut = tier === "none" ? 0 : this.cfg.multiCutBonus[tier];
    gained += multiCut;

    this.score += gained;
    if (hitAtMs != null) this.lastComboHitAtMs = hitAtMs;
    return { gained, combo: this.combo, multiCut, gauge, lastSave };
  }

  onMiss(): void {
    this.combo = 0;
    this.lastComboHitAtMs = null;
  }

  reset(): void {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastSaveCount = 0;
    this.kills = 0;
    this.lastComboHitAtMs = null;
  }

  snapshot(): ScoringSnapshot {
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      combo: this.combo,
      lastSaveCount: this.lastSaveCount,
      kills: this.kills,
    };
  }
}
