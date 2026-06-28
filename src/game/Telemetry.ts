// Telemetry (implementation-plan §3.7). 로컬 큐 + allowlist.
// 서버 전송은 BackendAdapter/Edge Function 경계 뒤에서만 붙인다.

export interface ITelemetry {
  track(event: string, props?: Record<string, unknown>): void;
  flush(): TelemetryEvent[];
}

export type TelemetryEventName =
  | "spawn"
  | "directional_reject"
  | "combo_break"
  | "last_save"
  | "skill_fire"
  | "death"
  | "run_submit";

export interface TelemetryEvent {
  event: TelemetryEventName;
  props: Record<string, unknown>;
}

const ALLOWED_EVENTS = new Set<TelemetryEventName>([
  "spawn",
  "directional_reject",
  "combo_break",
  "last_save",
  "skill_fire",
  "death",
  "run_submit",
]);

const ALLOWED_PROPS = new Set([
  "enemyType",
  "skillId",
  "difficulty",
  "score",
  "survivalMs",
  "reason",
  "combo",
  "band",
  "runtime",
]);

export class LocalTelemetry implements ITelemetry {
  private events: TelemetryEvent[] = [];

  constructor(private readonly maxEvents = 240) {}

  track(event: string, props: Record<string, unknown> = {}): void {
    if (!ALLOWED_EVENTS.has(event as TelemetryEventName)) return;
    this.events.push({
      event: event as TelemetryEventName,
      props: sanitizeProps(props),
    });
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  flush(): TelemetryEvent[] {
    const out = [...this.events];
    this.events = [];
    return out;
  }
}

function sanitizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROPS.has(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

export const Telemetry: ITelemetry = new LocalTelemetry();
