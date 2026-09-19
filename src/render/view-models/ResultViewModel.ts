import { modeDefinitions, type ModeResult } from "../../game/ModeConfig";
import type { ProgressRecordOutcome } from "../../game/progression/ProgressReducer";

export interface ResultStatCard {
  id: "score" | "time" | "combo" | "energy";
  labelKey: string;
  value: string;
}

export interface ResultDetailRow {
  id: string;
  labelKey: string;
  value: string;
}

export interface ResultUnlockCard {
  kind: "mode" | "skill" | "boss" | "collection" | "story";
  id: string;
}

export interface ResultPresentation {
  tone: "failure" | "success" | "survived";
  primaryAction: "retry" | "modeSelect" | "home";
  stats: ResultStatCard[];
  details: ResultDetailRow[];
  unlockCards: ResultUnlockCard[];
}

export type ResultViewModel = ResultPresentation;

export function buildResultViewModel(
  outcome: ProgressRecordOutcome | undefined,
  result?: ModeResult,
): ResultPresentation {
  const unlockCards = outcome ? buildUnlockCards(outcome) : [];
  if (!result) {
    return {
      tone: "failure",
      primaryAction: "retry",
      stats: [],
      details: [],
      unlockCards,
    };
  }

  return {
    tone: resultTone(result),
    primaryAction: primaryActionFor(result.retryDestination),
    stats: [
      { id: "score", labelKey: "result.score", value: String(Math.floor(result.score)) },
      { id: "time", labelKey: "result.time", value: String(Math.floor(result.survivalMs / 1000)) },
      { id: "combo", labelKey: "hud.combo", value: `x${result.maxCombo}` },
      { id: "energy", labelKey: "hud.energy", value: String(Math.floor(result.remainingEnergy)) },
    ],
    details: resultDetails(result),
    unlockCards,
  };
}

function buildUnlockCards(outcome: ProgressRecordOutcome): ResultUnlockCard[] {
  const { delta } = outcome;
  const collectionEntries = [...delta.newCollectionEntries].sort((left, right) => collectionOrder(left.kind) - collectionOrder(right.kind));
  return [
    ...delta.newModes.map((id) => ({ kind: "mode" as const, id })),
    ...delta.newSkills.map((id) => ({ kind: "skill" as const, id })),
    ...delta.newBosses.map((id) => ({ kind: "boss" as const, id })),
    ...collectionEntries.map((entry) => ({ kind: "collection" as const, id: `${entry.kind}:${entry.id}` })),
    ...delta.newStoryStages.map((stage) => ({ kind: "story" as const, id: `story-${stage}` })),
  ];
}

function resultDetails(result: ModeResult): ResultDetailRow[] {
  const details: ResultDetailRow[] = [];
  const mode = modeDefinitions().find((candidate) => candidate.id === result.modeId);
  const bossCount = result.bossKills ?? result.defeatedBossIds?.length ?? 0;
  details.push({ id: "mode", labelKey: mode?.labelKey ?? "mode.freeDefense", value: "" });

  if (result.modeId === "bossRush" || bossCount > 0) {
    details.push({
      id: "boss-progress",
      labelKey: "result.bossKills",
      value: String(bossCount),
    });
  }
  if (result.activeStoryStageId) {
    details.push({ id: "story-stage", labelKey: storyStageLabelKey(result.activeStoryStageId), value: "" });
  }
  if (result.activeDailyModifierId) {
    details.push({ id: "daily-modifier", labelKey: `daily.${result.activeDailyModifierId}`, value: "" });
  }
  if (result.objectiveOutcome) {
    details.push({ id: "objective", labelKey: `result.objective.${result.objectiveOutcome}`, value: "" });
  }
  if (result.rankingSubmissionState) {
    details.push({ id: "ranking", labelKey: `ranking.state.${result.rankingSubmissionState}`, value: "" });
  }
  return details;
}

function resultTone(result: ModeResult): ResultPresentation["tone"] {
  if (result.objectiveOutcome === "cleared" || result.endReason === "stage_objective_complete" || result.endReason === "boss_sequence_complete") {
    return "success";
  }
  if (result.objectiveOutcome === "survived" || result.endReason === "timer_expired") return "survived";
  return "failure";
}

function primaryActionFor(destination: ModeResult["retryDestination"]): ResultPresentation["primaryAction"] {
  if (destination === "modeSelect") return "modeSelect";
  if (destination === "home") return "home";
  return "retry";
}

function storyStageLabelKey(stageId: NonNullable<ModeResult["activeStoryStageId"]>): string {
  return `story.stage${stageId.slice("story-".length)}`;
}

function collectionOrder(kind: ProgressRecordOutcome["delta"]["newCollectionEntries"][number]["kind"]): number {
  if (kind === "boss") return 0;
  if (kind === "specialObject") return 1;
  return 2;
}
