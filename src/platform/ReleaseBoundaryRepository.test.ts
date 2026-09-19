import { describe, expect, it } from "vitest";
import { scanReleaseBoundary, scanMisleadingReleaseClaims, scanTargetSpecificBoundary } from "./ReleaseBoundary";

const sources = import.meta.glob<string>([
  "/src/**/*.{ts,tsx,js,jsx,json}",
  "!/src/**/*.test.{ts,tsx,js,jsx}",
  "!/src/**/*.spec.{ts,tsx,js,jsx}",
  "!/src/platform/ReleaseBoundary.ts",
], { query: "?raw", import: "default", eager: true });
const files = Object.entries(sources).map(([path, content]) => ({ path: path.slice(1), content }));

describe("actual repository release boundaries", () => {
  it("checks current production sources, including newly added modules", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(scanReleaseBoundary(files).violations).toEqual([]);
    expect(scanMisleadingReleaseClaims(files).violations).toEqual([]);
  });
  it.each(["google_play", "apps_in_toss"] as const)("checks %s source boundaries", (target) => {
    expect(scanTargetSpecificBoundary(files, target).violations).toEqual([]);
  });
  it("distinguishes account labels from SDK imports", () => {
    expect(scanReleaseBoundary([{ path: "src/render/Account.ts", content: 'const provider = "apps_in_toss";' }]).ok).toBe(true);
  });
  it.each([
    'export { createClient } from "@supabase/supabase-js";',
    'const sdk = import("@supabase/supabase-js");',
    'const sdk = require("@supabase/supabase-js");',
  ])("still rejects SDK module access: %s", (content) => {
    expect(scanReleaseBoundary([{ path: "src/game/Bad.ts", content }]).violations)
      .toContainEqual(expect.objectContaining({ reason: "forbidden_import_in_game_code" }));
  });
  it("allows only reviewed transient invite boundaries, never storage or logs", () => {
    const path = "src/platform/share/ShareService.ts";
    expect(scanReleaseBoundary([{ path, content: "interface ShareRequest { inviteCode?: string }" }]).ok).toBe(true);
    for (const content of [
      "console.log(request.inviteCode)",
      "localStorage.setItem('invite', request.inviteCode)",
      "fetch('/events', { body: request.inviteCode })",
      "const raw = payload.userKey",
      "const key = 'SUPABASE_SERVICE_ROLE_KEY'",
    ]) expect(scanReleaseBoundary([{ path, content }]).ok).toBe(false);
    expect(scanReleaseBoundary([{ path: "src/platform/Other.ts", content: "const inviteCode = input" }]).ok).toBe(false);
  });
});
