import { describe, expect, it } from "vitest";
import edgeSource from "../../supabase/functions/orbitslash-ranked-run/index.ts?raw";

describe("ranked Edge boundary source guard", () => {
  it("rejects null core_user_id before inserting public scores", () => {
    const guardIndex = edgeSource.indexOf('reason: "identity_not_bound"');
    const insertIndex = edgeSource.indexOf('.from("orbitslash_scores").insert');

    expect(guardIndex).toBeGreaterThan(0);
    expect(insertIndex).toBeGreaterThan(guardIndex);
    expect(edgeSource).toContain('typeof run.core_user_id !== "string"');
  });

  it("exposes a gated leaderboard action without returning raw identity columns", () => {
    const leaderboardBlock = edgeSource.slice(edgeSource.indexOf("async function publicLeaderboard"), edgeSource.indexOf("async function resolveCoreUserId"));

    expect(edgeSource).toContain('body.action === "leaderboard"');
    expect(leaderboardBlock).toContain('Deno.env.get("PUBLIC_LEADERBOARD_ENABLED")');
    expect(leaderboardBlock).toContain('.not("core_user_id", "is", null)');
    expect(leaderboardBlock).toContain("orbitslash_runs!inner(difficulty)");
    expect(leaderboardBlock).toContain("createdAt");
    expect(leaderboardBlock).not.toContain("provider_user_id");
  });

  it("exposes admin-only rejected-run diagnostics without raw identity columns", () => {
    const debugBlock = edgeSource.slice(edgeSource.indexOf("async function adminRejectedRuns"), edgeSource.indexOf("async function resolveCoreUserId"));

    expect(edgeSource).toContain('body.action === "debugRejectedRuns"');
    expect(edgeSource).toContain('status: "rejected"');
    expect(edgeSource).toContain("rejectRankedRun");
    expect(debugBlock).toContain('Deno.env.get("ADMIN_DEBUG_TOKEN")');
    expect(debugBlock).toContain('.eq("status", "rejected")');
    expect(debugBlock).toContain("rejectionReason");
    expect(debugBlock).not.toContain("provider_user_id");
    expect(debugBlock).not.toContain("run_token");
  });
});
