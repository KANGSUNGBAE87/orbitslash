import { describe, expect, it } from "vitest";
import { LocalTelemetry } from "./Telemetry";

describe("LocalTelemetry", () => {
  it("keeps only allowed gameplay events and drops unknown event names", () => {
    const telemetry = new LocalTelemetry();

    telemetry.track("skill_fire", { skillId: "gravity_slow", rawMemo: "should-drop" });
    telemetry.track("ranked_submission_result", { accepted: true, freeText: "drop-me" });
    telemetry.track("delta_shield_absorb", { enemyType: "lava_titan", boss: true, remaining: 1 });
    telemetry.track("free_text_event", { value: "nope" });

    expect(telemetry.flush()).toEqual([
      {
        event: "skill_fire",
        props: { skillId: "gravity_slow" },
      },
      {
        event: "ranked_submission_result",
        props: { accepted: true },
      },
      {
        event: "delta_shield_absorb",
        props: { enemyType: "lava_titan", boss: true, remaining: 1 },
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
