import { describe, expect, it } from "vitest";
import { ProgressStore } from "../../game/ProgressStore";
import { WebStubAdapter } from "../WebStubAdapter";
import { CloudProgressRepository } from "./CloudProgressRepository";
import { LocalProgressRepository } from "./LocalProgressRepository";
import { ProgressMutationOutbox } from "./ProgressMutationQueue";

describe("CloudProgressRepository", () => {
  it("keeps local progress first, then merges an acknowledged remote snapshot", async () => {
    const local = new LocalProgressRepository(new ProgressStore(new WebStubAdapter()));
    const outbox = new ProgressMutationOutbox();
    outbox.enqueue({ id: "m-1", type: "snapshot_sync", createdAt: "2031-02-03T00:00:00.000Z" });
    const repository = new CloudProgressRepository(local, outbox, async () => ({ status: "linked", internalUserId: "core-user-1", provider: "google_play" }), {
      sync: async ({ snapshot, mutations }) => ({
        snapshot: { ...snapshot, unlocks: { ...snapshot.unlocks, modes: [...snapshot.unlocks.modes, "bossRush"] } },
        acknowledgedMutationIds: mutations.map((mutation) => mutation.id),
      }),
    });

    await expect(repository.syncInBackground()).resolves.toEqual({ status: "synced", acknowledgedMutationIds: ["m-1"] });
    await expect(local.load()).resolves.toMatchObject({ unlocks: { modes: expect.arrayContaining(["bossRush"]) } });
    expect(outbox.list()).toEqual([]);
  });

  it("does not discard local mutations when network sync fails", async () => {
    const local = new LocalProgressRepository(new ProgressStore(new WebStubAdapter()));
    const outbox = new ProgressMutationOutbox();
    outbox.enqueue({ id: "m-1", type: "snapshot_sync", createdAt: "2031-02-03T00:00:00.000Z" });
    const repository = new CloudProgressRepository(local, outbox, async () => ({ status: "linked", internalUserId: "core-user-1", provider: "google_play" }), {
      sync: async () => { throw new Error("offline"); },
    });

    await expect(repository.syncInBackground()).resolves.toEqual({ status: "retry", acknowledgedMutationIds: [] });
    expect(outbox.list().map((mutation) => mutation.id)).toEqual(["m-1"]);
  });
});
