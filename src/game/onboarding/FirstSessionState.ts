export type FirstSessionStep = "not_started" | "basic_slash" | "last_save" | "solar_lance" | "reward" | "complete";

export interface FirstSessionState {
  version: 1;
  step: FirstSessionStep;
  startedAt: string | null;
  completedAt: string | null;
  lastUpdatedAt: string | null;
}

export type FirstSessionSignal =
  | { type: "start" }
  | { type: "slash_committed" }
  | { type: "last_save" }
  | { type: "solar_lance_fired" }
  | { type: "reward_claimed" }
  | { type: "enemy_killed" };

export function createFirstSessionState(): FirstSessionState {
  return { version: 1, step: "not_started", startedAt: null, completedAt: null, lastUpdatedAt: null };
}

export function reduceFirstSession(current: FirstSessionState, signal: FirstSessionSignal, now: string): FirstSessionState {
  const nextStep = transition(current.step, signal.type);
  if (nextStep === current.step) return current;
  return {
    ...current,
    step: nextStep,
    startedAt: current.startedAt ?? now,
    completedAt: nextStep === "complete" ? now : current.completedAt,
    lastUpdatedAt: now,
  };
}

function transition(step: FirstSessionStep, signal: FirstSessionSignal["type"]): FirstSessionStep {
  if (step === "not_started" && (signal === "start" || signal === "slash_committed")) return signal === "start" ? "basic_slash" : "last_save";
  if (step === "basic_slash" && signal === "slash_committed") return "last_save";
  if (step === "last_save" && signal === "last_save") return "solar_lance";
  if (step === "solar_lance" && signal === "solar_lance_fired") return "reward";
  if (step === "reward" && signal === "reward_claimed") return "complete";
  return step;
}
