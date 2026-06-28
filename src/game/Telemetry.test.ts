import { describe, expect, it } from "vitest";
import { LocalTelemetry } from "./Telemetry";

describe("LocalTelemetry", () => {
  it("keeps only allowed gameplay events and drops unknown event names", () => {
    const telemetry = new LocalTelemetry();

    telemetry.track("skill_fire", { skillId: "gravity_slow", rawMemo: "should-drop" });
    telemetry.track("free_text_event", { value: "nope" });

    expect(telemetry.flush()).toEqual([
      {
        event: "skill_fire",
        props: { skillId: "gravity_slow" },
      },
    ]);
  });

  it("keeps a bounded queue to avoid long-run memory growth", () => {
    const telemetry = new LocalTelemetry(3);

    telemetry.track("spawn", { enemyType: "small_meteor" });
    telemetry.track("spawn", { enemyType: "basic_meteor" });
    telemetry.track("spawn", { enemyType: "fast_comet" });
    telemetry.track("spawn", { enemyType: "heavy_asteroid" });

    expect(telemetry.flush().map((event) => event.props.enemyType)).toEqual([
      "basic_meteor",
      "fast_comet",
      "heavy_asteroid",
    ]);
    expect(telemetry.flush()).toEqual([]);
  });
});
