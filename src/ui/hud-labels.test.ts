import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "../i18n";
import { multiplierLabel } from "./hud-labels";

describe("multiplierLabel", () => {
  afterEach(() => setLocale("ko"));

  it("formats multiplier through the active locale", () => {
    setLocale("ko");
    expect(multiplierLabel(2.2)).toBe("x2.2");

    setLocale("en");
    expect(multiplierLabel(3.5)).toBe("x3.5");
  });
});
