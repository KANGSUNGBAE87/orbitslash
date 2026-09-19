import { describe, expect, it } from "vitest";
import { applyDailyClear, dailyBoard } from "./DailyRetentionRules";

describe("Daily retention", () => {
  it("grants one first-clear per day", () => {
    const once = applyDailyClear({ firstClearAwards: [], clearDayKeys: [] }, "2031-02-03");
    expect(applyDailyClear(once, "2031-02-03").firstClearAwards).toEqual(["2031-02-03"]);
  });

  it("builds a seven-day activity board", () => {
    expect(dailyBoard(["2031-02-01", "2031-02-03"], "2031-02-03")).toEqual([false, false, false, false, true, false, true]);
  });
});
