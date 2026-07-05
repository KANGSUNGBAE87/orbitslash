export interface LeaderboardReadiness {
  rankedEdgeDeployed?: boolean;
  identityBoundAcceptedRuns?: boolean;
  publicLeaderboardEnabled?: boolean;
}

export type LeaderboardBoundaryReason =
  | "edge_not_deployed"
  | "identity_bound_runs_missing"
  | "public_leaderboard_disabled"
  | "ready";

export interface LeaderboardBoundaryState {
  publicAvailable: boolean;
  reason: LeaderboardBoundaryReason;
}

export function resolveLeaderboardBoundary(readiness: LeaderboardReadiness = {}): LeaderboardBoundaryState {
  if (!readiness.rankedEdgeDeployed) return { publicAvailable: false, reason: "edge_not_deployed" };
  if (!readiness.identityBoundAcceptedRuns) return { publicAvailable: false, reason: "identity_bound_runs_missing" };
  if (!readiness.publicLeaderboardEnabled) return { publicAvailable: false, reason: "public_leaderboard_disabled" };
  return { publicAvailable: true, reason: "ready" };
}
