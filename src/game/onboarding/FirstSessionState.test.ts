import { describe, expect, it } from "vitest";
import { createFirstSessionState, reduceFirstSession } from "./FirstSessionState";

describe("FirstSessionState", () => {
  it("does not advance on an unrelated signal", () => {
    const state = { ...createFirstSessionState(), step: "last_save" as const };

    expect(reduceFirstSession(state, { type: "enemy_killed" }, "2031-02-03T10:00:00.000Z").step).toBe("last_save");
  });

  it("advances slash, Last Save, then Solar Lance in order", () => {
    const started = createFirstSessionState();
    const afterSlash = reduceFirstSession(started, { type: "slash_committed" }, "2031-02-03T10:00:00.000Z");
    const afterSave = reduceFirstSession(afterSlash, { type: "last_save" }, "2031-02-03T10:01:00.000Z");
    const afterLance = reduceFirstSession(afterSave, { type: "solar_lance_fired" }, "2031-02-03T10:02:00.000Z");

    expect(afterSlash.step).toBe("last_save");
    expect(afterSave.step).toBe("solar_lance");
    expect(afterLance.step).toBe("reward");
  });
});
