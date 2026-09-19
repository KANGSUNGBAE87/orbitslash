import { describe, expect, it } from "vitest";
import type { ProgressRecordOutcome } from "../../game/progression/ProgressReducer";
import { resultFlowFor } from "./ResultFlowState";

describe("resultFlowFor", () => {
  it("orders summary, unlock reveal, then collection choice", () => {
    const outcome = {
      snapshot: {} as never,
      delta: {
        newModes: [],
        newSkills: ["nova_pulse"],
        newBosses: [],
        newStoryStages: [],
        newCollectionEntries: [],
      },
    } satisfies ProgressRecordOutcome;

    expect(resultFlowFor(outcome).steps).toEqual(["summary", "unlock_reveal", "collection_choice"]);
  });

  it("keeps an ordinary result to the summary step", () => {
    expect(resultFlowFor({ snapshot: {} as never, delta: { newModes: [], newSkills: [], newBosses: [], newStoryStages: [], newCollectionEntries: [] } }).steps).toEqual(["summary"]);
  });
});
