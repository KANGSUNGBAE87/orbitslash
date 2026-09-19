import { describe, expect, it } from "vitest";
import { WebStubAdapter } from "../platform/WebStubAdapter";
import { PlayerPreferencesStore } from "./PlayerPreferencesStore";

describe("PlayerPreferencesStore", () => {
  it("persists the player's accessible feedback choices", async () => {
    const adapter = new WebStubAdapter();
    const store = new PlayerPreferencesStore(adapter);

    await store.save({ bgmEnabled: false, sfxEnabled: false, hapticEnabled: false, reducedMotion: true, locale: "en" });

    await expect(new PlayerPreferencesStore(adapter).load()).resolves.toEqual({
      version: 1,
      bgmEnabled: false,
      sfxEnabled: false,
      hapticEnabled: false,
      reducedMotion: true,
      locale: "en",
    });
  });
});
