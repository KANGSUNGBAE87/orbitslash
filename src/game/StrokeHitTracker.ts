interface StrokeEnemyHitState {
  armed: boolean;
  lastHitAtMs: number;
}

export interface StrokeHitTrackerOptions {
  exitMarginPx: number;
  rehitCooldownMs: number;
}

export class StrokeHitTracker {
  private readonly rehitCooldownMs: number;
  private readonly states = new Map<number, StrokeEnemyHitState>();

  constructor(readonly options: StrokeHitTrackerOptions) {
    this.rehitCooldownMs = Math.max(0, options.rehitCooldownMs);
  }

  reset(): void {
    this.states.clear();
  }

  canHit(enemyId: number, nowMs: number): boolean {
    const state = this.states.get(enemyId);
    if (!state) return true;
    return state.armed && nowMs - state.lastHitAtMs >= this.rehitCooldownMs;
  }

  recordHit(enemyId: number, nowMs: number): void {
    this.states.set(enemyId, {
      armed: false,
      lastHitAtMs: nowMs,
    });
  }

  markExited(enemyId: number, isOutsideExitMargin: boolean): void {
    const state = this.states.get(enemyId);
    if (!state || state.armed || !isOutsideExitMargin) return;
    state.armed = true;
  }
}
