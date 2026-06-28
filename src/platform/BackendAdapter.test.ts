import { describe, expect, it } from "vitest";
import { LocalBackendAdapter } from "./BackendAdapter";

describe("LocalBackendAdapter", () => {
  it("begins ranked runs without server-only secrets", async () => {
    const backend = new LocalBackendAdapter(1234);

    const run = await backend.beginRankedRun("rookie");

    expect(run).toMatchObject({ runToken: "local-1234", seed: 1234, difficulty: "rookie" });
    expect(JSON.stringify(run)).not.toMatch(/SERVICE_ROLE|SUPABASE_DB_PASSWORD|DEEPSEEK_API_KEY/);
  });

  it("can create a deterministic local run start through the adapter boundary", () => {
    const backend = new LocalBackendAdapter(1234);

    expect(backend.beginLocalRun("rookie", 99)).toMatchObject({
      runToken: "local-99",
      seed: 99,
      difficulty: "rookie",
    });
  });

  it("exposes the selected hybrid ranking strategy", () => {
    const backend = new LocalBackendAdapter(1234);

    expect(backend.rankingStrategy()).toMatchObject({
      primary: "supabase_verified",
      secondary: "apps_in_toss_leaderboard_bridge",
    });
  });
});
