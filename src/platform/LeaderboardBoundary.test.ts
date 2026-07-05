import { describe, expect, it } from "vitest";
import { resolveLeaderboardBoundary } from "./LeaderboardBoundary";

describe("LeaderboardBoundary", () => {
  it("keeps the public leaderboard locked before the server ranking path is deployed", () => {
    expect(resolveLeaderboardBoundary()).toMatchObject({
      publicAvailable: false,
      reason: "edge_not_deployed",
    });
  });

  it("still requires identity-bound accepted runs before exposing public rows", () => {
    expect(resolveLeaderboardBoundary({ rankedEdgeDeployed: true })).toMatchObject({
      publicAvailable: false,
      reason: "identity_bound_runs_missing",
    });
  });

  it("opens the public leaderboard only when all release gates are explicitly ready", () => {
    expect(
      resolveLeaderboardBoundary({
        rankedEdgeDeployed: true,
        identityBoundAcceptedRuns: true,
        publicLeaderboardEnabled: true,
      }),
    ).toMatchObject({ publicAvailable: true, reason: "ready" });
  });
});
