export type RankingPrimary = "supabase_verified";
export type RankingSecondary = "apps_in_toss_leaderboard_bridge";
export type RankingRuntime = "local" | "public";
export type RankingSubmissionTarget = "local_stub" | "server_verified_endpoint";

export interface RankingStrategy {
  primary: RankingPrimary;
  secondary: RankingSecondary;
}

export const RANKING_STRATEGY: RankingStrategy = {
  primary: "supabase_verified",
  secondary: "apps_in_toss_leaderboard_bridge",
};

export function rankingStrategyLabel(strategy: RankingStrategy = RANKING_STRATEGY): string {
  return `hybrid:${strategy.primary}+${strategy.secondary}`;
}

export function rankingSubmissionTarget(runtime: RankingRuntime): RankingSubmissionTarget {
  return runtime === "public" ? "server_verified_endpoint" : "local_stub";
}
