export interface IncrementRunMutation {
  id: string;
  type: 'increment_run';
  createdAt: string;
}

export interface ProgressSyncMutation {
  id: string;
  type: "snapshot_sync";
  createdAt: string;
}

export interface MutationProgressState {
  totalRuns: number;
  appliedMutationIds: string[];
}

export class ProgressMutationOutbox {
  private readonly pending = new Map<string, ProgressSyncMutation>();

  enqueue(mutation: ProgressSyncMutation): boolean {
    if (this.pending.has(mutation.id)) return false;
    this.pending.set(mutation.id, mutation);
    return true;
  }

  list(): ProgressSyncMutation[] {
    return [...this.pending.values()];
  }

  acknowledge(ids: readonly string[]): void {
    for (const id of ids) this.pending.delete(id);
  }

  restore(value: unknown): void {
    this.pending.clear();
    if (!Array.isArray(value)) return;
    for (const candidate of value) {
      if (!isProgressMutation(candidate)) continue;
      this.pending.set(candidate.id, { ...candidate });
    }
  }
}

function isProgressMutation(value: unknown): value is ProgressSyncMutation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate.id)
    && candidate.type === "snapshot_sync"
    && typeof candidate.createdAt === "string"
    && Number.isFinite(Date.parse(candidate.createdAt));
}

/** Replaying an outbox is idempotent across process restarts and retry attempts. */
export function applyProgressMutations(
  current: MutationProgressState,
  mutations: readonly IncrementRunMutation[],
): MutationProgressState {
  const applied = new Set(current.appliedMutationIds);
  let totalRuns = current.totalRuns;
  for (const mutation of mutations) {
    if (applied.has(mutation.id)) continue;
    if (mutation.type === 'increment_run') totalRuns += 1;
    applied.add(mutation.id);
  }
  return { totalRuns, appliedMutationIds: [...applied] };
}
