import { describe, expect, it } from "vitest";
import { AppLifecycle } from "./AppLifecycle";

describe("AppLifecycle", () => {
  it("requires an explicit resume after the app becomes hidden", () => {
    const lifecycle = new AppLifecycle();

    lifecycle.hidden();
    lifecycle.shown();

    expect(lifecycle.canAdvance()).toBe(false);
    expect(lifecycle.resumeRequired()).toBe(true);

    lifecycle.resume();
    expect(lifecycle.canAdvance()).toBe(true);
  });
});
