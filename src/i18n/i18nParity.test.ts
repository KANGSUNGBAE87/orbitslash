import { describe, expect, it } from "vitest";
import ko from "./ko.json";
import en from "./en.json";
import { BOSS_DEFINITIONS } from "../game/BossDefinitions";
import { DAILY_MODIFIERS, FREE_DEFENSE_PRESETS, modeDefinitions, STORY_CHAPTERS, STORY_STAGE_PLAN } from "../game/ModeConfig";

const koDict = ko as Record<string, string>;
const enDict = en as Record<string, string>;

describe("i18n parity", () => {
  it("contains localized tutorial keys for every Story stage", () => {
    for (const stage of STORY_STAGE_PLAN) {
      expect(koDict[stage.tutorialKey]).toBeTruthy();
      expect(enDict[stage.tutorialKey]).toBeTruthy();
    }
  });

  it("contains localized Boss Rush tutorial and boss objective keys", () => {
    const keys = [
      "bossRush.tutorial.title",
      "bossRush.tutorial.prepare",
      "bossRush.tutorial.incomingTitle",
      "bossRush.tutorial.incoming",
      "bossRush.tutorial.weakPoint",
      "boss.weakPointOnly",
      "boss.weakPointHint",
      ...Object.values(BOSS_DEFINITIONS).map((definition) => definition.labelKey),
      ...Object.values(BOSS_DEFINITIONS).flatMap((definition) => definition.phases.map((phase) => phase.objectiveKey)),
    ].filter((key): key is string => Boolean(key));

    for (const key of keys) {
      expect(koDict[key]).toBeTruthy();
      expect(enDict[key]).toBeTruthy();
    }
  });

  it("contains localized app shell, mode, progress, and result keys", () => {
    const keys = [
      ...modeDefinitions().flatMap((mode) => [mode.labelKey, mode.descriptionKey]),
      ...STORY_CHAPTERS.map((chapter) => chapter.titleKey),
      ...DAILY_MODIFIERS.map((modifier) => modifier.labelKey),
      ...FREE_DEFENSE_PRESETS.flatMap((preset) => [preset.labelKey, preset.descriptionKey]),
      "freeDefense.practiceBoss",
      "freeDefense.adRevive.locked",
      "freeDefense.adRevive.ready",
      "freeDefense.dailyLimit.locked",
      "label.kills",
      "boot.readying",
      "loading.title",
      "loading.progress",
      "status.locked",
      "status.comingSoon",
      "settings.language",
      "settings.locale.ko",
      "settings.locale.en",
      "records.title",
      "records.storyClear",
      "records.dailyClear",
      "records.rankingPending",
      "records.rankingHint",
      "records.leaderboardLocked",
      "records.leaderboardRequirement",
      "records.leaderboardPublic",
      "records.leaderboardReadyHint",
      "collection.bosses",
      "collection.modes",
      "collection.specialObjects",
      "collection.titles",
      "collection.unlocked",
      "collection.locked",
      "collection.special.friendlyRescue",
      "collection.special.satellite",
      "collection.special.energyCapsule",
      "collection.special.empMine",
      "collection.title.bossBreaker",
      "collection.title.dailyClear",
      "collection.title.blitzSurvivor",
      "collection.title.comboPilot",
      "result.bossKills",
      "result.defeated",
      "result.objective",
      "result.objective.cleared",
      "result.objective.failed",
      "result.objective.survived",
      "result.cleared",
      "result.survivedTitle",
      "result.ranking",
      "result.qaProgressOff",
      "ranking.state.notEligible",
      "ranking.state.pending",
      "ranking.state.submitted",
      "ranking.state.localOnly",
      "ranking.state.failed",
      "progress.bestScore",
      "progress.noRecord",
      "progress.firstPlay",
      "progress.plays",
      "progress.rankedPending",
      "progress.dailyWaiting",
      "progress.bossReady",
      "progress.noBossKill",
      "progress.bestBoss",
      "devQa.title",
      "devQa.body",
      "devQa.touchHud",
      "devQa.boss",
      "devQa.special",
      "devQa.blitz",
      "devQa.pass",
      "devQa.pending",
      "special.benefit.friendlyRescue",
      "special.benefit.satellite",
      "special.benefit.energyCapsule",
      "special.benefit.empMine",
      "special.penalty.friendlyRescue",
      "special.penalty.satellite",
      "special.penalty.energyCapsule",
      "special.penalty.empMine",
      "special.rescue.friendlyRescue",
      "special.rescue.satellite",
      "special.rescue.energyCapsule",
      "special.rescue.empMine",
      "directional.wrongAngle",
      "story.chapterStageCount",
      "unit.secondsSuffix",
    ];

    for (const key of keys) {
      expect(koDict[key], `ko ${key}`).toBeTruthy();
      expect(enDict[key], `en ${key}`).toBeTruthy();
    }
  });
});
