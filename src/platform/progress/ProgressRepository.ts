import type { ProgressRecordOutcome } from "../../game/progression/ProgressReducer";
import type { ProgressSnapshot } from "../../game/ProgressStore";
import type { ProgressSyncMutation } from "./ProgressMutationQueue";

export interface ProgressRepository {
  load(): Promise<ProgressSnapshot>;
  saveLocal(outcome: ProgressRecordOutcome): Promise<void>;
  replace(snapshot: ProgressSnapshot): Promise<void>;
  enqueueMutation(mutation: ProgressSyncMutation): Promise<void>;
  syncInBackground(): Promise<ProgressSyncResult>;
}

export interface ProgressSyncResult {
  status: "skipped" | "synced" | "retry";
  acknowledgedMutationIds: string[];
}
