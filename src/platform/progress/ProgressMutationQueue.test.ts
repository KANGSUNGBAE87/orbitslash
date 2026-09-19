import { describe, expect, it } from "vitest";
import { applyProgressMutations, ProgressMutationOutbox } from "./ProgressMutationQueue";

describe("ProgressMutationQueue", () => {
  it("applies the same mutation id once", () => {
    const mutation = { id: "m-1", type: "increment_run" as const, createdAt: "2031-02-03T00:00:00.000Z" };
    const result = applyProgressMutations({ totalRuns: 0, appliedMutationIds: [] }, [mutation, mutation]);

    expect(result.totalRuns).toBe(1);
    expect(result.appliedMutationIds).toEqual(["m-1"]);
  });

  it("keeps an unacknowledged mutation for an offline retry", () => {
    const outbox = new ProgressMutationOutbox();
    outbox.enqueue({ id: "m-1", type: "snapshot_sync", createdAt: "2031-02-03T00:00:00.000Z" });
    outbox.acknowledge([]);

    expect(outbox.list().map((mutation) => mutation.id)).toEqual(["m-1"]);
  });
});
