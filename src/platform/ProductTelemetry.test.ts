import { describe, expect, it } from "vitest";
import { ProductTelemetryQueue } from "./ProductTelemetry";

describe("ProductTelemetryQueue", () => {
  it("stores only allowlisted product payloads", () => {
    const queue = new ProductTelemetryQueue("trace-1");
    queue.track("tutorial_complete", { locale: "ko", freeText: "secret", score: 2000 } as never);

    expect(queue.peek()[0]).toMatchObject({ eventName: "tutorial_complete", props: { locale: "ko" } });
  });

  it("keeps a monotonically increasing local event sequence", () => {
    const queue = new ProductTelemetryQueue("trace-1");
    queue.track("app_open", { locale: "ko" });
    queue.track("primary_start", { modeId: "story" });

    expect(queue.peek().map((event) => event.eventSequence)).toEqual([1, 2]);
  });

  it("flushes accepted events and keeps an unsent tail for a retry", async () => {
    const queue = new ProductTelemetryQueue("trace-1");
    queue.track("app_open", { locale: "ko" });
    queue.track("primary_start", { modeId: "story" });
    const sent: string[] = [];

    const flushed = await queue.flush(async (event) => {
      sent.push(event.eventName);
      if (event.eventName === "primary_start") throw new Error("offline");
    });

    expect(flushed).toBe(1);
    expect(sent).toEqual(["app_open", "primary_start"]);
    expect(queue.peek().map((event) => event.eventName)).toEqual(["primary_start"]);
  });
});
