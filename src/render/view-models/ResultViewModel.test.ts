import { describe, expect, it } from "vitest";
import type { ModeResult } from "../../game/ModeConfig";
import type { ProgressRecordOutcome } from "../../game/progression/ProgressReducer";
import en from "../../i18n/en.json";
import ko from "../../i18n/ko.json";
import { buildResultViewModel } from "./ResultViewModel";

const dictionaries = [ko, en] as Array<Record<string, string>>;

function emptyOutcome(): ProgressRecordOutcome {
  return {
    snapshot: {} as never,
    delta: {
      newModes: [],
      newSkills: [],
      newBosses: [],
      newStoryStages: [],
      newCollectionEntries: [],
    },
  };
}

describe("buildResultViewModel", () => {
  it("orders current run unlock cards by mode, skill, boss, then collection", () => {
    const outcome = {
      snapshot: {} as never,
      delta: {
        newModes: ["bossRush", "ranked"],
        newSkills: ["nova_pulse"],
        newBosses: ["ringed_destroyer"],
        newStoryStages: [2],
        newCollectionEntries: [
          { kind: "title" as const, id: "bossBreaker" },
          { kind: "boss" as const, id: "ringed_destroyer" },
        ],
      },
    } satisfies ProgressRecordOutcome;

    expect(buildResultViewModel(outcome).unlockCards).toEqual([
      { kind: "mode", id: "bossRush" },
      { kind: "mode", id: "ranked" },
      { kind: "skill", id: "nova_pulse" },
      { kind: "boss", id: "ringed_destroyer" },
      { kind: "collection", id: "boss:ringed_destroyer" },
      { kind: "collection", id: "title:bossBreaker" },
      { kind: "story", id: "story-2" },
    ]);
  });

  it("builds structured Boss Rush stats and details without raw IDs in user-facing values", () => {
    const result: ModeResult = {
      modeId: "bossRush",
      difficulty: "defender",
      endReason: "boss_sequence_complete",
      survivalMs: 97_800,
      score: 123_456.9,
      kills: 41,
      bossKills: 2,
      defeatedBossIds: ["ringed_destroyer", "lava_titan"],
      objectiveOutcome: "cleared",
      maxCombo: 12,
      remainingEnergy: 64.8,
      rankingEligible: false,
      retryDestination: "modeSelect",
    };

    const viewModel = buildResultViewModel(emptyOutcome(), result);

    expect(viewModel.tone).toBe("success");
    expect(viewModel.primaryAction).toBe("modeSelect");
    expect(viewModel.stats).toEqual([
      { id: "score", labelKey: "result.score", value: "123456" },
      { id: "time", labelKey: "result.time", value: "97" },
      { id: "combo", labelKey: "hud.combo", value: "x12" },
      { id: "energy", labelKey: "hud.energy", value: "64" },
    ]);
    expect(viewModel.details).toEqual([
      { id: "mode", labelKey: "mode.bossRush.title", value: "" },
      { id: "boss-progress", labelKey: "result.bossKills", value: "2" },
      { id: "objective", labelKey: "result.objective.cleared", value: "" },
    ]);
    expect(viewModel.details.map((row) => row.value).join(" ")).not.toMatch(
      /bossRush|ringed_destroyer|lava_titan|nova_pulse/,
    );
  });

  it.each([
    {
      name: "Story",
      result: {
        modeId: "story",
        activeStoryStageId: "story-2",
        activeDailyModifierId: undefined,
        objectiveOutcome: "cleared",
        rankingSubmissionState: "notEligible",
      },
      ids: ["mode", "boss-progress", "story-stage", "objective", "ranking"],
      keys: [
        "mode.story.title",
        "result.bossKills",
        "story.stage2",
        "result.objective.cleared",
        "ranking.state.notEligible",
      ],
    },
    {
      name: "Daily",
      result: {
        modeId: "daily",
        activeStoryStageId: undefined,
        activeDailyModifierId: "rescueDay",
        objectiveOutcome: "survived",
        rankingSubmissionState: "notEligible",
      },
      ids: ["mode", "boss-progress", "daily-modifier", "objective", "ranking"],
      keys: [
        "mode.daily.title",
        "result.bossKills",
        "daily.rescueDay",
        "result.objective.survived",
        "ranking.state.notEligible",
      ],
    },
  ] as const)("builds five localized $name detail rows", ({ result: patch, ids, keys }) => {
    const result: ModeResult = {
      difficulty: "rookie",
      endReason: "timer_expired",
      survivalMs: 42_000,
      score: 4_200,
      kills: 12,
      bossKills: 1,
      defeatedBossIds: ["ringed_destroyer"],
      maxCombo: 6,
      remainingEnergy: 35,
      rankingEligible: false,
      retryDestination: "modeSelect",
      ...patch,
    };

    const details = buildResultViewModel(emptyOutcome(), result).details;

    expect(details.map((row) => row.id)).toEqual(ids);
    expect(details.map((row) => row.labelKey)).toEqual(keys);
    for (const key of keys) {
      for (const dictionary of dictionaries) expect(dictionary[key], key).toBeTruthy();
    }
  });

  it("does not show boss progress for a non-Boss-Rush result without an actual boss kill", () => {
    const result: ModeResult = {
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 10_000,
      score: 900,
      kills: 3,
      bossKills: 0,
      defeatedBossIds: ["ringed_destroyer"],
      maxCombo: 2,
      remainingEnergy: 8,
      rankingEligible: false,
      retryDestination: "sameRun",
    };

    expect(buildResultViewModel(emptyOutcome(), result).details.map((row) => row.id)).toEqual(["mode"]);
  });

  it("falls back to defeated boss IDs when bossKills is absent", () => {
    const result: ModeResult = {
      modeId: "freeDefense",
      difficulty: "rookie",
      endReason: "earth_destroyed",
      survivalMs: 10_000,
      score: 900,
      kills: 3,
      defeatedBossIds: ["ringed_destroyer"],
      maxCombo: 2,
      remainingEnergy: 8,
      rankingEligible: false,
      retryDestination: "sameRun",
    };

    expect(buildResultViewModel(emptyOutcome(), result).details).toEqual([
      { id: "mode", labelKey: "mode.freeDefense.title", value: "" },
      { id: "boss-progress", labelKey: "result.bossKills", value: "1" },
    ]);
  });

  it.each([
    ["earth_destroyed", "sameRun", "failure", "retry"],
    ["timer_expired", "home", "survived", "home"],
  ] as const)(
    "maps %s results to %s presentation",
    (endReason, retryDestination, tone, primaryAction) => {
      const result: ModeResult = {
        modeId: "freeDefense",
        difficulty: "rookie",
        endReason,
        survivalMs: 10_000,
        score: 900,
        kills: 3,
        maxCombo: 2,
        remainingEnergy: 8,
        rankingEligible: false,
        retryDestination,
      };

      const viewModel = buildResultViewModel(emptyOutcome(), result);

      expect(viewModel.tone).toBe(tone);
      expect(viewModel.primaryAction).toBe(primaryAction);
    },
  );
});
