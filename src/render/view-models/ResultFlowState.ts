import type { ProgressRecordOutcome } from "../../game/progression/ProgressReducer";

export type ResultFlowStep = "summary" | "unlock_reveal" | "collection_choice";

export function resultFlowFor(outcome: ProgressRecordOutcome): { steps: ResultFlowStep[] } {
  const { delta } = outcome;
  const hasUnlock = delta.newModes.length + delta.newSkills.length + delta.newBosses.length + delta.newStoryStages.length + delta.newCollectionEntries.length > 0;
  return { steps: hasUnlock ? ["summary", "unlock_reveal", "collection_choice"] : ["summary"] };
}
