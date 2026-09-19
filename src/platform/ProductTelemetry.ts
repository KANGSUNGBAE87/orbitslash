export type ProductEventName =
  | "app_open"
  | "home_view"
  | "primary_start"
  | "tutorial_step_started"
  | "tutorial_step_completed"
  | "tutorial_complete"
  | "run_end"
  | "retry_selected"
  | "unlock_reveal"
  | "collection_open"
  | "weekly_reward_claimed"
  | "return_next_day";

export interface ProductTelemetryEvent {
  clientEventId: string;
  sessionTraceId: string;
  eventName: ProductEventName;
  eventSequence: number;
  props: Record<string, string | number | boolean>;
}

export const ALLOWED_PRODUCT_PROPS: Record<ProductEventName, readonly string[]> = {
  app_open: ["locale", "runtime"],
  home_view: ["locale"],
  primary_start: ["modeId", "storyStageId"],
  tutorial_step_started: ["tutorialStep"],
  tutorial_step_completed: ["tutorialStep"],
  tutorial_complete: ["locale"],
  run_end: ["modeId", "storyStageId", "tutorialStep"],
  retry_selected: ["modeId"],
  unlock_reveal: ["unlockCount"],
  collection_open: ["source"],
  weekly_reward_claimed: ["weekKey", "titleId"],
  return_next_day: ["dayKey"],
};

export class ProductTelemetryQueue {
  private sequence = 0;
  private readonly events: ProductTelemetryEvent[] = [];

  constructor(private readonly sessionTraceId: string) {}

  track(eventName: ProductEventName, props: Record<string, unknown>): ProductTelemetryEvent {
    const eventSequence = ++this.sequence;
    const event: ProductTelemetryEvent = {
      clientEventId: `${this.sessionTraceId}:${eventSequence}`,
      sessionTraceId: this.sessionTraceId,
      eventName,
      eventSequence,
      props: pickAllowedProps(eventName, props),
    };
    this.events.push(event);
    return event;
  }

  peek(): readonly ProductTelemetryEvent[] {
    return this.events;
  }

  /**
   * Sends in order and preserves the failed event plus every later event. This
   * makes network retries safe without exposing arbitrary product payloads.
   */
  async flush(send: (event: ProductTelemetryEvent) => Promise<void>): Promise<number> {
    const pending = this.events.splice(0);
    let sent = 0;
    for (let index = 0; index < pending.length; index += 1) {
      try {
        await send(pending[index]!);
        sent += 1;
      } catch {
        this.events.unshift(...pending.slice(index));
        return sent;
      }
    }
    return sent;
  }
}

function pickAllowedProps(eventName: ProductEventName, input: Record<string, unknown>): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  for (const key of ALLOWED_PRODUCT_PROPS[eventName]) {
    const value = input[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") output[key] = value;
  }
  return output;
}

export function sanitizeProductTelemetryEvent(event: ProductTelemetryEvent): ProductTelemetryEvent {
  return { ...event, props: pickAllowedProps(event.eventName, event.props) };
}
