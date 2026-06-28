import type { DistanceBand, ScoringConfig } from "./types";

export interface HitFeedback {
  multiplier: number;
  color: number;
  radius: number;
  isLastSave: boolean;
  particleCount: number;
  labelScale: number;
  ringWidth: number;
}

const BAND_STYLE: Record<
  DistanceBand,
  { color: number; radius: number; isLastSave: boolean; particleCount: number; labelScale: number; ringWidth: number }
> = {
  outer: { color: 0x9fe9ff, radius: 34, isLastSave: false, particleCount: 10, labelScale: 0.92, ringWidth: 3 },
  mid: { color: 0x3fd8ff, radius: 40, isLastSave: false, particleCount: 13, labelScale: 1.0, ringWidth: 3 },
  danger: { color: 0xffc14d, radius: 50, isLastSave: false, particleCount: 17, labelScale: 1.12, ringWidth: 4 },
  lastSave: { color: 0x3fd8ff, radius: 72, isLastSave: true, particleCount: 26, labelScale: 1.24, ringWidth: 6 },
  impact: { color: 0x9fe9ff, radius: 34, isLastSave: false, particleCount: 10, labelScale: 0.92, ringWidth: 3 },
};

export function feedbackForHitBand(band: DistanceBand, cfg: ScoringConfig): HitFeedback {
  const style = BAND_STYLE[band];
  const mult = cfg.distanceMultiplier[band] ?? cfg.distanceMultiplier.outer ?? 1;
  return {
    multiplier: mult,
    color: style.color,
    radius: style.radius,
    isLastSave: style.isLastSave,
    particleCount: style.particleCount,
    labelScale: style.labelScale,
    ringWidth: style.ringWidth,
  };
}
