import { describe, expect, it } from "vitest";
import { scanReleaseBoundary } from "./ReleaseBoundary";

describe("scanReleaseBoundary", () => {
  it("flags platform SDK imports from game code", () => {
    const result = scanReleaseBoundary([
      {
        path: "src/game/Bad.ts",
        content: 'import { createClient } from "@supabase/supabase-js";',
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.violations[0]?.reason).toBe("forbidden_import_in_game_code");
  });

  it("flags server-only secret names in client code", () => {
    const result = scanReleaseBoundary([
      {
        path: "src/platform/Bad.ts",
        content: "const key = 'SUPABASE_SERVICE_ROLE_KEY';",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.violations[0]?.reason).toBe("server_secret_in_client_code");
  });
});
