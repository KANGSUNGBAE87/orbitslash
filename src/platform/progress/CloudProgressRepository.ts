import type { ProgressSnapshot } from "../../game/ProgressStore";
import type { IdentityState } from "../identity/IdentityService";
import { mergeProgress } from "./ProgressMerge";
import type { LocalProgressRepository } from "./LocalProgressRepository";
import { ProgressMutationOutbox, type ProgressSyncMutation } from "./ProgressMutationQueue";
import type { ProgressSyncResult } from "./ProgressRepository";

export interface CloudProgressSyncPort {
  sync(input: {
    identity: Extract<IdentityState, { status: "linked" }>;
    snapshot: ProgressSnapshot;
    mutations: ProgressSyncMutation[];
  }): Promise<{ snapshot: ProgressSnapshot; acknowledgedMutationIds: string[] }>;
}

/**
 * Cloud is a best-effort replica. Local snapshot persistence completes before
 * this class runs, and a failed request leaves the mutation outbox untouched.
 */
export class CloudProgressRepository {
  constructor(
    private readonly local: LocalProgressRepository,
    private readonly outbox: ProgressMutationOutbox,
    private readonly identity: () => Promise<IdentityState>,
    private readonly cloud: CloudProgressSyncPort,
  ) {}

  async syncInBackground(): Promise<ProgressSyncResult> {
    const identity = await this.identity();
    if (identity.status !== "linked") return { status: "skipped", acknowledgedMutationIds: [] };
    const mutations = this.outbox.list();
    if (mutations.length === 0) return { status: "skipped", acknowledgedMutationIds: [] };
    try {
      const localSnapshot = await this.local.load();
      const remote = await this.cloud.sync({ identity, snapshot: localSnapshot, mutations });
      await this.local.replace(mergeProgress(localSnapshot, remote.snapshot));
      this.outbox.acknowledge(remote.acknowledgedMutationIds);
      return { status: "synced", acknowledgedMutationIds: remote.acknowledgedMutationIds };
    } catch {
      return { status: "retry", acknowledgedMutationIds: [] };
    }
  }
}
