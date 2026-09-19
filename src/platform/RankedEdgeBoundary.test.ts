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
    expect(leaderboardBlock).toContain("orbitslash_runs!inner(difficulty, week_key)");
    expect(leaderboardBlock).toContain("createdAt");
    expect(leaderboardBlock).not.toContain("provider_user_id");
  });

  it("requires a difficulty/week partition and orders the ranked board by survival, score, then creation", () => {
    const leaderboardBlock = edgeSource.slice(edgeSource.indexOf("async function publicLeaderboard"), edgeSource.indexOf("async function resolveCoreUserId"));

    expect(edgeSource).toContain("publicLeaderboard(supabase, body.difficulty, body.weekKey, body.limit)");
    expect(leaderboardBlock).toContain('.eq("orbitslash_runs.difficulty", difficulty)');
    expect(leaderboardBlock).toContain('.eq("orbitslash_runs.week_key", weekKey)');
    expect(leaderboardBlock.indexOf('.order("survival_ms", { ascending: false })')).toBeLessThan(
      leaderboardBlock.indexOf('.order("score", { ascending: false })'),
    );
    expect(leaderboardBlock.indexOf('.order("score", { ascending: false })')).toBeLessThan(
      leaderboardBlock.indexOf('.order("created_at", { ascending: true })'),
    );
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

  it("rejects stale or absent ranked rules contracts before beginning or submitting a run", () => {
    const beginBlock = edgeSource.slice(edgeSource.indexOf("async function beginRankedRun"), edgeSource.indexOf("async function submitRankedRun"));
    const submitBlock = edgeSource.slice(edgeSource.indexOf("async function submitRankedRun"), edgeSource.indexOf("async function rejectRankedRun"));

    expect(edgeSource).toContain('from "../_shared/orbitslash-ranked-core.generated.ts"');
    expect(edgeSource).toContain("RANKED_CORE_RULES_HASH");
    expect(edgeSource).toContain("RANKED_CORE_SCHEMA_VERSION");
    expect(edgeSource).toContain('reason: "ranked_rules_mismatch"');
    expect(edgeSource).toContain("body.rulesHash");
    expect(edgeSource).toContain("body.rulesVersion");
    expect(beginBlock).toContain("rulesHash");
    expect(beginBlock).toContain("rulesVersion");
    expect(submitBlock).toContain("rulesHash");
    expect(submitBlock).toContain("rulesVersion");
  });

  it("keeps Edge spawn generation delegated to generated ranked core", () => {
    expect(edgeSource).toContain('from "../_shared/ranked-core/spawn.ts"');
    expect(edgeSource).toContain("generateRankedCoreSpawns");
    for (const legacySpawnSymbol of [
      "ROOKIE_WAVES",
      "NORMAL_ENEMY_KEYS",
      "function createRng(",
      "function jitterInterval(",
      "function activeWaveBand(",
      "function pickEnemyType(",
      "function deriveServerReplaySpawns(",
      "function deriveBossSpawns(",
      "function deriveSplitSpawns(",
      "function assignServerSpawnOrdinals(",
      "function sameServerSpawnSequence(",
      "function generateBossSpawnsFromTrace(",
    ]) {
      expect(edgeSource).not.toContain(legacySpawnSymbol);
    }
  });

  it("derives ranked distance bands from the generated GameScene zone snapshot", () => {
    const geometryBlock = edgeSource.slice(edgeSource.indexOf("function distanceBand("), edgeSource.indexOf("function replayVisualScale("));

    expect(geometryBlock).toContain("RANKED_CORE_RULES.difficulty.zones");
    expect(geometryBlock).not.toContain("4 * EARTH_GAMEPLAY_RADIUS");
    expect(geometryBlock).not.toContain("3 * EARTH_GAMEPLAY_RADIUS");
  });

  it("keeps ranked replay score calculation inside the generated core without a legacy Edge score graph", () => {
    expect(edgeSource).toContain('from "../_shared/ranked-core/score.ts"');
    expect(edgeSource).toContain("replayRankedScore");
    for (const legacyScoreSymbol of [
      "const COMBO_TIMEOUT_MS",
      "function groupByComboTimeout",
      "function scoreFor",
      "function distanceMultiplierFor",
      "function accuracyMultiplierFor",
      "function comboMultiplierFor",
      "function multiCutBonus",
    ]) {
      expect(edgeSource).not.toContain(legacyScoreSymbol);
    }
  });
});
