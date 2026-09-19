import { describe, expect, it } from "vitest";
import { buildRunConfig } from "../ModeConfig";
import { applyCosmetic, resolveCosmeticLoadout } from "./CosmeticLoadout";

describe("CosmeticLoadout", () => {
  it("never changes gameplay rules from a cosmetic loadout", () => {
    const base = buildRunConfig("ranked", { seed: 7 });
    const loadout = resolveCosmeticLoadout(["earth_aurora", "slash_comet"], { earth: "earth_aurora", slash: "slash_comet" });

    expect(applyCosmetic(base, loadout)).toEqual(base);
  });

  it("drops an unowned cosmetic selection", () => {
    expect(resolveCosmeticLoadout([], { earth: "earth_aurora" })).toEqual({ earth: undefined, slash: undefined, boss: undefined });
  });
});
