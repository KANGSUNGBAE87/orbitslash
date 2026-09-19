import { createFirstSessionState, type FirstSessionState } from "../onboarding/FirstSessionState";

export interface ProgressMigrationFields {
  version: 4;
  onboarding: FirstSessionState;
}

export function migrateProgressSnapshot<T extends Record<string, unknown>>(input: T): T & ProgressMigrationFields {
  return {
    ...input,
    version: 4,
    onboarding: normalizeFirstSession(input.onboarding),
  };
}

function normalizeFirstSession(value: unknown): FirstSessionState {
  const base = createFirstSessionState();
  if (!isRecord(value)) return base;
  const step = value.step;
  if (step !== "not_started" && step !== "basic_slash" && step !== "last_save" && step !== "solar_lance" && step !== "reward" && step !== "complete") return base;
  return {
    version: 1,
    step,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
    lastUpdatedAt: typeof value.lastUpdatedAt === "string" ? value.lastUpdatedAt : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
