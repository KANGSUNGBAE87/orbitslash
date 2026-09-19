import { describe, expect, it } from "vitest";
import { migrateProgressSnapshot } from "./ProgressMigration";

describe("migrateProgressSnapshot", () => {
  it("adds first-session state when loading a v2 snapshot", () => {
    const migrated = migrateProgressSnapshot({ version: 2, profile: { totalRuns: 3 } });

    expect(migrated).toMatchObject({
      version: 4,
      onboarding: { version: 1, step: "not_started", startedAt: null, completedAt: null },
    });
  });

  it("preserves an in-progress first session without a combat checkpoint", () => {
    const migrated = migrateProgressSnapshot({
      version: 4,
      onboarding: { version: 1, step: "solar_lance", startedAt: "2031-02-03T10:00:00.000Z", completedAt: null, lastUpdatedAt: "2031-02-03T10:01:00.000Z" },
    });

    expect(migrated.onboarding).toMatchObject({ step: "solar_lance", startedAt: "2031-02-03T10:00:00.000Z" });
    expect(migrated).not.toHaveProperty("combatCheckpoint");
  });
});
