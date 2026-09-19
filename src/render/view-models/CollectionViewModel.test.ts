import { describe, expect, it } from "vitest";
import type { ProgressSnapshot } from "../../game/ProgressStore";
import { buildCollectionViewModel } from "./CollectionViewModel";

const progress = {
  retention: {
    stageMedals: { "story-1": "gold", "story-2": "silver", "story-3": "bronze" },
    daily: { firstClearAwards: ["2026-07-11"], clearDayKeys: ["2026-07-11"] },
    claimedWeeklyKeys: [],
  },
} as unknown as ProgressSnapshot;

describe("buildCollectionViewModel", () => {
  it("summarizes non-degrading stage medals for the Collection screen", () => {
    expect(buildCollectionViewModel(progress).medals).toEqual({ gold: 1, silver: 1, bronze: 1, unearned: 29 });
    expect(buildCollectionViewModel(progress).dailyClearDays).toBe(1);
  });

  it("exposes only the active KST weekly goal and its claim state", () => {
    const weeklyProgress = {
      ...progress,
      retention: {
        ...progress.retention,
        daily: {
          ...progress.retention.daily,
          clearDayKeys: ["2031-02-03", "2031-02-04", "2031-02-05", "2031-02-06", "2031-02-07"],
        },
      },
    } as ProgressSnapshot;

    expect(buildCollectionViewModel(
      weeklyProgress,
      new Date("2031-02-08T03:00:00.000Z"),
      { stages: {}, weekly: { requiredDistinctClearDays: 5, titleId: "weekly_five_day" } } as never,
    ).weekly).toEqual({ weekKey: "2031-02-03", clearCount: 5, requiredClearDays: 5, claimable: true, claimed: false, titleId: "weekly_five_day" });
  });
});
