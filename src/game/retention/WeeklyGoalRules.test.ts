import { describe, expect, it } from "vitest";
import { claimWeeklyGoal, kstDayKey, weekKeyFor, weeklyGoalStatus } from "./WeeklyGoalRules";

describe("Weekly goals", () => {
  it("uses Monday 06:00 KST week keys", () => {
    expect(weekKeyFor(new Date("2031-02-02T20:59:00.000Z"))).toBe("2031-01-27");
    expect(weekKeyFor(new Date("2031-02-02T21:00:00.000Z"))).toBe("2031-02-03");
  });

  it("derives KST day keys without depending on the device timezone", () => {
    expect(kstDayKey(new Date("2031-02-02T15:30:00.000Z"))).toBe("2031-02-03");
  });

  it("requires five distinct daily clears and does not duplicate a claim", () => {
    expect(weeklyGoalStatus(["a", "b", "c", "d", "e"], false)).toMatchObject({ complete: true, claimable: true });
    expect(weeklyGoalStatus(["a", "b", "c", "d", "e"], true)).toMatchObject({ complete: true, claimable: false });
  });

  it("counts only clears inside the current KST weekly window", () => {
    const status = weeklyGoalStatus(
      ["2031-01-27", "2031-01-28", "2031-01-29", "2031-01-30", "2031-01-31"],
      [],
      new Date("2031-02-08T03:00:00.000Z"),
      { requiredDistinctClearDays: 5, titleId: "weekly_five_day" },
    );

    expect(status).toMatchObject({ weekKey: "2031-02-03", clearCount: 0, complete: false, claimable: false });
  });

  it("claims one weekly title exactly once for the active KST week", () => {
    const now = new Date("2031-02-08T03:00:00.000Z");
    const clearDayKeys = ["2031-02-03", "2031-02-04", "2031-02-05", "2031-02-06", "2031-02-07"];
    const rule = { requiredDistinctClearDays: 5, titleId: "weekly_five_day" };

    const first = claimWeeklyGoal({ clearDayKeys, claimedWeekKeys: [] }, now, rule);
    const second = claimWeeklyGoal({ clearDayKeys, claimedWeekKeys: first.claimedWeekKeys }, now, rule);

    expect(first).toEqual({ claimed: true, weekKey: "2031-02-03", titleId: "weekly_five_day", claimedWeekKeys: ["2031-02-03"] });
    expect(second).toEqual({ claimed: false, weekKey: "2031-02-03", claimedWeekKeys: ["2031-02-03"] });
  });
});
