import { describe, expect, it } from "vitest";
import { AppsInTossAdapter } from "../AppsInTossAdapter";
import { AppsInTossBridge } from "./AppsInTossBridge";

describe("Apps in Toss adapter contract", () => {
  it("normalizes a server-verified session without exposing a provider identifier", async () => {
    const adapter = new AppsInTossAdapter(
      new AppsInTossBridge({
        isAvailable: () => true,
        getVerifiedSession: async () => ({ internalUserId: "core-orbit-user", accessToken: "server-session" }),
      }),
    );

    await expect(adapter.login()).resolves.toEqual({ userId: "core-orbit-user", provider: "apps_in_toss" });
    await expect(adapter.getVerifiedSessionAccessToken()).resolves.toBe("server-session");
  });

  it("classifies private test context without persisting a full scheme URL", () => {
    const adapter = new AppsInTossAdapter(
      new AppsInTossBridge({
        isAvailable: () => true,
        runtimeHints: () => ({ protocol: "intoss-private:", deploymentId: "private-deployment" }),
      }),
    );

    expect(adapter.telemetryContext()).toEqual({
      runtime: "apps_in_toss",
      runtimeChannel: "toss_private_test",
      deploymentId: "private-deployment",
    });
  });
});
