import { describe, expect, it } from "vitest";
import { ProgressStore } from "../../game/ProgressStore";
import { WebStubAdapter } from "../WebStubAdapter";
import { LocalProgressRepository } from "./LocalProgressRepository";

describe("LocalProgressRepository", () => {
  it("makes a merged snapshot durable before any cloud sync", async () => {
    const store = new ProgressStore(new WebStubAdapter());
    const repository = new LocalProgressRepository(store);
    const snapshot = await repository.load();

    await repository.replace({ ...snapshot, profile: { ...snapshot.profile, totalRuns: 9 } });

    await expect(repository.load()).resolves.toMatchObject({ profile: { totalRuns: 9 } });
  });
});
