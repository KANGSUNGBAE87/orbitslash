import type { DistanceBand, ScoringConfig } from "./types";

export interface HitFeedback {
  multiplier: number;
  color: number;
  radius: number;
  isLastSave: boolean;
}

const BAND_STYLE: Record<DistanceBand, { color: number; radius: number; isLastSave: boolean }> = {
  outer: { color: 0x9fe9ff, radius: 34, isLastSave: false },
  mid: { color: 0x3fd8ff, radius: 40, isLastSave: false },
  danger: { color: 0xffc14d, radius: 46, isLastSave: false },
  lastSave: { color: 0x3fd8ff, radius: 64, isLastSave: true },
  impact: { color: 0x9fe9ff, radius: 34, isLastSave: false },
};

export function feedbackForHitBand(band: DistanceBand, cfg: ScoringConfig): HitFeedback {
  const style = BAND_STYLE[band];
  const mult = cfg.distanceMultiplier[band] ?? cfg.distanceMultiplier.outer ?? 1;
  return {
    multiplier: mult,
    color: style.color,
    radius: style.radius,
    isLastSave: style.isLastSave,
  };
}
