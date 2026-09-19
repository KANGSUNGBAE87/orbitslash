import { describe, expect, it } from "vitest";
import { createSeasonCatalog } from "./SeasonCatalog";

const activeSeason = {
  id: "aurora-01",
  startsAt: "2026-07-01T00:00:00.000Z",
  endsAt: "2026-08-01T00:00:00.000Z",
  supportedClientVersion: "1.0.0",
  configVersion: "remote-balance-1",
  cosmeticRewardIds: ["earth_aurora", "slash_comet"],
};

describe("SeasonCatalog", () => {
  it("stays safely disabled when live ops config is missing", () => {
    const catalog = createSeasonCatalog(undefined);

    expect(catalog.evaluate({
      seasonId: "aurora-01",
      now: new Date("2026-07-15T00:00:00.000Z"),
      clientVersion: "1.0.0",
      configVersion: "remote-balance-1",
    })).toEqual({ available: false, reason: "missing_config" });
  });

  it("activates only a time-valid season for the pinned client and config versions", () => {
    const catalog = createSeasonCatalog({ enabled: true, seasons: [activeSeason] });

    expect(catalog.evaluate({
      seasonId: "aurora-01",
      now: new Date("2026-07-15T00:00:00.000Z"),
      clientVersion: "1.0.0",
      configVersion: "remote-balance-1",
    })).toEqual({ available: true, season: activeSeason });
  });

  it.each([
    ["future", new Date("2026-06-30T23:59:59.000Z"), "1.0.0", "remote-balance-1", "not_started"],
    ["expired", new Date("2026-08-01T00:00:00.000Z"), "1.0.0", "remote-balance-1", "expired"],
    ["client mismatch", new Date("2026-07-15T00:00:00.000Z"), "1.0.1", "remote-balance-1", "client_unsupported"],
    ["config mismatch", new Date("2026-07-15T00:00:00.000Z"), "1.0.0", "remote-balance-2", "config_unsupported"],
  ])("rejects %s seasons", (_label, now, clientVersion, configVersion, reason) => {
    const catalog = createSeasonCatalog({ enabled: true, seasons: [activeSeason] });

    expect(catalog.evaluate({ seasonId: "aurora-01", now, clientVersion, configVersion })).toEqual({
      available: false,
      reason,
    });
  });

  it("disables malformed seasons and non-cosmetic reward input", () => {
    const catalog = createSeasonCatalog({
      enabled: true,
      seasons: [{ ...activeSeason, endsAt: activeSeason.startsAt, cosmeticRewardIds: ["supporter_pack"] }],
    });

    expect(catalog.evaluate({
      seasonId: "aurora-01",
      now: new Date("2026-07-15T00:00:00.000Z"),
      clientVersion: "1.0.0",
      configVersion: "remote-balance-1",
    })).toEqual({ available: false, reason: "invalid_config" });
  });
});
