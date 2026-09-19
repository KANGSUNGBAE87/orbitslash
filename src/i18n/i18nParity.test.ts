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
      "skillTutorial.title",
      "skillTutorial.summary",
      "skillTutorial.novaPulse.opening",
      "skillTutorial.novaPulse.feedback.cooldown",
      "skillTutorial.novaPulse.feedback.gauge",
      "skillTutorial.novaPulse.feedback.start_too_far",
      "skillTutorial.novaPulse.feedback.endpoint_too_close",
      "skillTutorial.novaPulse.feedback.too_short",
      "skillTutorial.novaPulse.feedback.not_straight",
      "skillTutorial.novaPulse.feedback.too_slow",
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
      "lifecyclePause.title",
      "lifecyclePause.body",
      "lifecyclePause.resume",
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
      "result.unlockCategory.boss",
      "result.unlockCategory.bossCodex",
      "result.unlockNova.instruction",
      "result.unlockNova.meta",
      "result.unlockNova.contrast",
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
      "home.primary.start",
      "home.primary.startHint",
      "home.primary.resume",
      "home.primary.modeSelect",
      "home.primary.modeSelectHint",
      "story.guided.basic_slash",
      "story.guided.last_save",
      "story.guided.solar_lance",
      "story.guided.reward",
      "unit.secondsSuffix",
    ];

    for (const key of keys) {
      expect(koDict[key], `ko ${key}`).toBeTruthy();
      expect(enDict[key], `en ${key}`).toBeTruthy();
    }
  });

  it("keeps lifecycle pause overlay copy localized in English", () => {
    expect(enDict["lifecyclePause.title"]).toBe("Game Paused");
    expect(enDict["lifecyclePause.body"]).toBe("The app was in the background.\nResume when you are ready.");
    expect(enDict["lifecyclePause.resume"]).toBe("Resume");
  });

  it("keeps the featured Nova unlock guide equivalent in both locales", () => {
    expect(koDict["result.unlockNova.instruction"]).toBe("지구 표면 가까이에서 시작해\n바깥쪽으로 빠르고 곧게 플릭");
    expect(koDict["result.unlockNova.meta"]).toBe("게이지 {cost} · 쿨타임 {seconds}초");
    expect(koDict["result.unlockNova.contrast"]).toBe("솔라 랜스는 지구를 가로지르는 긴 직선");
    expect(enDict["result.unlockNova.instruction"]).toBe("Start close to Earth's surface,\nthen flick outward fast and straight");
    expect(enDict["result.unlockNova.meta"]).toBe("Gauge {cost} · Cooldown {seconds}s");
    expect(enDict["result.unlockNova.contrast"]).toBe("Solar Lance is a long line that crosses Earth");
  });
});
