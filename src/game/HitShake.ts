export interface HitShakeOffset {
  x: number;
  y: number;
  scale: number;
}

export function enemyHitShakeOffset(
  enemyId: number,
  elapsedMs: number,
  intensityPx: number,
  durationMs: number,
): HitShakeOffset {
  if (durationMs <= 0 || elapsedMs >= durationMs) return { x: 0, y: 0, scale: 1 };

  const t = Math.max(0, elapsedMs) / durationMs;
  const falloff = (1 - t) * (1 - t);
  const amplitude = intensityPx * falloff;
  const phase = enemyId * 1.618 + elapsedMs * 0.11;

  return {
    x: Math.cos(phase) * amplitude,
    y: Math.sin(phase * 1.31 + 0.7) * amplitude,
    scale: 1 + 0.16 * falloff,
  };
}
