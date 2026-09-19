import type { ProgressRecordOutcome } from "../../game/progression/ProgressReducer";
import type { ProgressSnapshot, ProgressStore } from "../../game/ProgressStore";

/** Local storage is the source of immediate UI truth, even when cloud is offline. */
export class LocalProgressRepository {
  constructor(private readonly store: Pick<ProgressStore, "load" | "replace">) {}

  load(): Promise<ProgressSnapshot> {
    return this.store.load();
  }

  async saveLocal(outcome: ProgressRecordOutcome): Promise<void> {
    await this.store.replace(outcome.snapshot);
  }

  async replace(snapshot: ProgressSnapshot): Promise<void> {
    await this.store.replace(snapshot);
  }
}
