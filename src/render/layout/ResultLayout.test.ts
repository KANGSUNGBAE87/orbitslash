import { describe, expect, it } from "vitest";
import type { ModeResult } from "../../game/ModeConfig";
import type { ProgressSnapshot } from "../../game/ProgressStore";
import { computeRootFit } from "../../game/coords";
import { reduceProgressAfterRun } from "../../game/progression/ProgressReducer";
import { buildResultViewModel } from "../view-models/ResultViewModel";
import { rectsOverlap, resultLayout, type ResultLayout, type ResultRect } from "./ResultLayout";

function initialProgress(): ProgressSnapshot {
  return {
    version: 4,
    profile: { totalRuns: 0, totalKills: 0, totalBossKills: 0, totalScore: 0 },
    records: {},
    unlocks: {
      modes: ["freeDefense", "story"],
      skills: ["solar_lance", "orbital_cut", "gravity_slow", "delta_shield"],
      bosses: [],
      storyStages: [1],
    },
    collection: { bossCodex: [], specialObjectCodex: [], titles: [] },
    story: { clearedStageIds: [] },
    daily: { completedModifierIds: [], clearCount: 0 },
    freeDefense: { dailyPlayDate: null, dailyPlayCount: 0 },
    onboarding: { version: 1, step: "not_started", startedAt: null, completedAt: null, lastUpdatedAt: null },
    retention: { stageMedals: {}, daily: { firstClearAwards: [], clearDayKeys: [] }, claimedWeeklyKeys: [] },
  };
}

function firstBossClear(): ModeResult {
  return {
    modeId: "freeDefense",
    difficulty: "rookie",
    endReason: "earth_destroyed",
    survivalMs: 60_000,
    score: 2_500,
    kills: 20,
    bossKills: 1,
    defeatedBossIds: ["ringed_destroyer"],
    maxCombo: 5,
    remainingEnergy: 20,
    rankingEligible: false,
    retryDestination: "sameRun",
  };
}

function activeRects(layout: ResultLayout): ResultRect[] {
  return [
    layout.header,
    layout.statGrid,
    layout.detailCard,
    layout.unlockCard,
    layout.unlockAction,
    layout.actions,
  ].filter((rect): rect is ResultRect => rect != null);
}

function expectInsidePanel(layout: ResultLayout): void {
  for (const rect of activeRects(layout)) {
    expect(rect.x).toBeGreaterThanOrEqual(layout.panel.x);
    expect(rect.y).toBeGreaterThanOrEqual(layout.panel.y);
    expect(rect.x + rect.w).toBeLessThanOrEqual(layout.panel.x + layout.panel.w);
    expect(rect.y + rect.h).toBeLessThanOrEqual(layout.panel.y + layout.panel.h);
  }
}

function expectPairwiseNonOverlapping(layout: ResultLayout): void {
  const rects = activeRects(layout);
  for (let left = 0; left < rects.length; left += 1) {
    for (let right = left + 1; right < rects.length; right += 1) {
      expect(rectsOverlap(rects[left]!, rects[right]!)).toBe(false);
    }
  }
}

describe("resultLayout", () => {
  it("keeps a summary-only result inside the panel without inactive detail or unlock regions", () => {
    const layout = resultLayout({ detailRows: 0, unlockCards: 0, safeBottom: 0 });

    expect(layout.detailCard).toBeUndefined();
    expect(layout.unlockCard).toBeUndefined();
    expect(layout.unlockAction).toBeUndefined();
    expectInsidePanel(layout);
    expectPairwiseNonOverlapping(layout);
  });

  it("keeps a dense Korean Boss Rush result non-overlapping above the safe bottom", () => {
    const safeBottom = 24;
    const layout = resultLayout({ detailRows: 3, unlockCards: 0, safeBottom });

    expect(layout.detailCard).toBeDefined();
    expect(layout.actions.y + layout.actions.h).toBeLessThanOrEqual(
      layout.panel.y + layout.panel.h - safeBottom,
    );
    expectInsidePanel(layout);
    expectPairwiseNonOverlapping(layout);
  });

  it("allocates all five detail rows without colliding with unlock or action regions", () => {
    const rootFitScale = computeRootFit(360, 800).scale;
    const fourRows = resultLayout({ detailRows: 4, unlockCards: 7, safeBottom: 48, rootFitScale });
    const fiveRows = resultLayout({ detailRows: 5, unlockCards: 7, safeBottom: 48, rootFitScale });

    expect(fiveRows.detailCard!.h).toBeGreaterThan(fourRows.detailCard!.h);
    expectInsidePanel(fiveRows);
    expectPairwiseNonOverlapping(fiveRows);
  });

  it("fits the seven-card first-boss unlock reveal and its CTA in a dense English result", () => {
    const safeBottom = 48;
    const touchHeight = 72;
    const layout = resultLayout({ detailRows: 3, unlockCards: 7, safeBottom, touchHeight });

    expect(layout.unlockCard).toBeDefined();
    expect(layout.unlockAction).toBeDefined();
    expect(layout.unlockAction!.h).toBeGreaterThanOrEqual(touchHeight);
    expect(layout.actions.h).toBeGreaterThanOrEqual(touchHeight);
    expect(layout.actions.y + layout.actions.h).toBeLessThanOrEqual(
      layout.panel.y + layout.panel.h - safeBottom,
    );
    expectInsidePanel(layout);
    expectPairwiseNonOverlapping(layout);
  });

  it.each([
    [360, 800],
    [390, 844],
    [430, 932],
  ])("keeps action rows at least 48 CSS px at a %sx%s viewport", (width, height) => {
    const rootFitScale = computeRootFit(width, height).scale;
    const layout = resultLayout({ detailRows: 2, unlockCards: 7, safeBottom: 24, rootFitScale });

    expect(layout.actions.h * rootFitScale).toBeGreaterThanOrEqual(48);
    expect(layout.unlockAction!.h * rootFitScale).toBeGreaterThanOrEqual(48);
    expectPairwiseNonOverlapping(layout);
  });

  it("applies the normalized safe bottom exactly once", () => {
    const base = resultLayout({ detailRows: 3, unlockCards: 7, safeBottom: 0 });
    const inset = resultLayout({ detailRows: 3, unlockCards: 7, safeBottom: 36 });

    expect(base.actions.y - inset.actions.y).toBe(36);
  });

  it("allocates another unlock row beyond eight cards", () => {
    const rootFitScale = computeRootFit(360, 800).scale;
    const eight = resultLayout({ detailRows: 3, unlockCards: 8, safeBottom: 48, rootFitScale });
    const nine = resultLayout({ detailRows: 3, unlockCards: 9, safeBottom: 48, rootFitScale });

    expect(nine.unlockCard!.h).toBeGreaterThan(eight.unlockCard!.h);
    expectInsidePanel(nine);
    expectPairwiseNonOverlapping(nine);
  });

  it("allocates a featured Nova guide separately from the ordinary unlock grid", () => {
    const withoutFeatured = resultLayout({
      detailRows: 3,
      unlockCards: 7,
      featuredUnlockCards: 0,
      safeBottom: 24,
    });
    const withFeatured = resultLayout({
      detailRows: 3,
      unlockCards: 7,
      featuredUnlockCards: 1,
      safeBottom: 24,
    });

    expect(withFeatured.unlockCard!.h).toBeGreaterThan(withoutFeatured.unlockCard!.h);
    expectInsidePanel(withFeatured);
    expectPairwiseNonOverlapping(withFeatured);
  });

  it.each([
    [360, 800],
    [390, 844],
    [430, 932],
  ])("fits one featured Nova guide plus nine dense unlocks at %sx%s", (width, height) => {
    const rootFitScale = computeRootFit(width, height).scale;
    const layout = resultLayout({
      detailRows: 5,
      unlockCards: 9,
      featuredUnlockCards: 1,
      safeBottom: 0,
      rootFitScale,
    });

    expect(layout.panel.y).toBeGreaterThanOrEqual(0);
    expect(layout.actions.h * rootFitScale).toBeGreaterThanOrEqual(48);
    expect(layout.unlockAction!.h * rootFitScale).toBeGreaterThanOrEqual(48);
    expectInsidePanel(layout);
    expectPairwiseNonOverlapping(layout);
  });

  it("fits the real first-boss reducer unlock outcome through the presentation pipeline", () => {
    const result = firstBossClear();
    const outcome = reduceProgressAfterRun(initialProgress(), result, new Date("2031-02-03T12:00:00.000Z"));
    const presentation = buildResultViewModel(outcome, result);
    const rootFitScale = computeRootFit(360, 800).scale;
    const layout = resultLayout({
      detailRows: presentation.details.length,
      unlockCards: presentation.unlockCards.length,
      safeBottom: 24,
      rootFitScale,
    });

    expect(presentation.unlockCards.length).toBeGreaterThanOrEqual(7);
    expectInsidePanel(layout);
    expectPairwiseNonOverlapping(layout);
  });
});
