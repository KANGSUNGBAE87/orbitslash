// Telemetry (implementation-plan §3.7). Phase 1은 noop.
// TODO(Phase6): 실제 분석 수집 (product-plan §25 지표).

export interface ITelemetry {
  track(event: string, props?: Record<string, unknown>): void;
}

class NoopTelemetry implements ITelemetry {
  track(_event: string, _props?: Record<string, unknown>): void {
    // noop
  }
}

export const Telemetry: ITelemetry = new NoopTelemetry();
