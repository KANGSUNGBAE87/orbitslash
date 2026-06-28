import { describe, expect, it } from "vitest";
import { RANKING_STRATEGY, rankingStrategyLabel, rankingSubmissionTarget } from "./RankingStrategy";

describe("RankingStrategy", () => {
  it("uses Supabase verified ranking as primary while keeping Apps in Toss bridge-ready", () => {
    expect(RANKING_STRATEGY.primary).toBe("supabase_verified");
    expect(RANKING_STRATEGY.secondary).toBe("apps_in_toss_leaderboard_bridge");
    expect(rankingStrategyLabel()).toBe("hybrid:supabase_verified+apps_in_toss_leaderboard_bridge");
  });

  it("keeps public submissions server-side only", () => {
    expect(rankingSubmissionTarget("public")).toBe("server_verified_endpoint");
    expect(rankingSubmissionTarget("local")).toBe("local_stub");
  });
});
