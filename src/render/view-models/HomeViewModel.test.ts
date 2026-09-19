import { describe, expect, it } from "vitest";
import type { ProgressSnapshot } from "../../game/ProgressStore";
import { buildHomeViewModel } from "./HomeViewModel";

const progress: ProgressSnapshot = {
  version: 4,
  profile: { totalRuns: 1, totalKills: 10, totalBossKills: 1, totalScore: 1000 },
  records: {},
  unlocks: {
    modes: ["story", "freeDefense", "bossRush", "ranked"],
    skills: ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"],
    bosses: [],
    storyStages: [1, 2],
  },
  collection: { bossCodex: [], specialObjectCodex: [], titles: [] },
  story: { clearedStageIds: ["story-1"] },
  daily: { completedModifierIds: [], clearCount: 0 },
  freeDefense: { dailyPlayDate: null, dailyPlayCount: 0 },
  onboarding: { version: 1, step: "not_started", startedAt: null, completedAt: null, lastUpdatedAt: null },
  retention: { stageMedals: {}, daily: { firstClearAwards: [], clearDayKeys: [] }, claimedWeeklyKeys: [] },
};

describe("buildHomeViewModel", () => {
  it("uses the supplied persisted progress for the first home frame", () => {
    expect(buildHomeViewModel(progress)).toMatchObject({
      totalRuns: 1,
      unlockedModes: ["story", "freeDefense", "bossRush", "ranked"],
      unlockedSkills: ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield", "nova_pulse"],
    });
  });

  it("presents a truthful guided Story action for new and completed players", () => {
    expect(buildHomeViewModel(progress).primaryAction).toEqual({
      kind: "start_guided_story",
      labelKey: "home.primary.start",
      hintKey: "home.primary.startHint",
    });

    expect(buildHomeViewModel({
      ...progress,
      onboarding: { ...progress.onboarding, step: "complete", completedAt: "2031-02-03T10:00:00.000Z" },
    }).primaryAction).toEqual({
      kind: "open_recommended_mode",
      labelKey: "home.primary.modeSelect",
      hintKey: "home.primary.modeSelectHint",
    });
  });

  it.each([
    ["basic_slash", "story.guided.basic_slash"],
    ["last_save", "story.guided.last_save"],
    ["solar_lance", "story.guided.solar_lance"],
    ["reward", "story.guided.reward"],
  ] as const)("maps the %s resume step to its exact localized hint", (step, hintKey) => {
    expect(buildHomeViewModel({
      ...progress,
      onboarding: { ...progress.onboarding, step },
    }).primaryAction).toEqual({
      kind: "resume_guided_story",
      labelKey: "home.primary.resume",
      hintKey,
    });
  });

  it("treats missing progress as a new guided training session", () => {
    expect(buildHomeViewModel(undefined)).toMatchObject({
      totalRuns: 0,
      unlockedModes: [],
      unlockedSkills: [],
      primaryAction: {
        kind: "start_guided_story",
        labelKey: "home.primary.start",
        hintKey: "home.primary.startHint",
      },
    });
  });
});
