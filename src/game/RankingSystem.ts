import type { ModeId, RunEndReason, SkillId } from "./ModeConfig";

export type RunStartVerification = "local_stub" | "server_stub" | "server_verified";

// 랭킹 제출 요약 (implementation-plan §3.7, product-plan §21.3).
// Server validation lives behind BackendAdapter/Supabase Edge drafts.

export interface RunSubmission {
  modeId?: ModeId;
  runToken: string;
  seed: number;
  difficulty: string;
  configVersion?: string;
  rankingEligible?: boolean;
  verification?: RunStartVerification;
  issuedAtMs?: number;
  expiresAtMs?: number;
  endReason?: RunEndReason;
  survivalMs: number;
  score: number;
  kills: number;
  maxCombo: number;
  lastSaveCount: number;
  remainingEnergy: number;
  solarLanceCount?: number;
  gravitySlowCount?: number;
  skillUse?: Partial<Record<SkillId, number>>;
}

export interface RunSummary extends RunSubmission {
  modeId: ModeId;
  endReason: RunEndReason;
  skillUse: Record<SkillId, number>;
}

export type SubmissionValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "score_negative"
        | "survival_negative"
        | "energy_out_of_range"
        | "count_negative"
        | "count_not_integer"
        | "skill_use_negative"
        | "invalid_token"
        | "invalid_seed";
    };

export function createRunSummary(run: RunSubmission): RunSummary {
  const skillUse = {
    solar_lance: run.skillUse?.solar_lance ?? run.solarLanceCount ?? 0,
    orbital_cut: run.skillUse?.orbital_cut ?? 0,
    gravity_slow: run.skillUse?.gravity_slow ?? run.gravitySlowCount ?? 0,
    delta_shield: run.skillUse?.delta_shield ?? 0,
    nova_pulse: run.skillUse?.nova_pulse ?? 0,
  };
  return {
    ...run,
    modeId: run.modeId ?? "freeDefense",
    endReason: run.endReason ?? "earth_destroyed",
    skillUse,
  };
}

export function validateRunSubmission(
  run: Pick<RunSubmission, "score" | "survivalMs" | "remainingEnergy"> &
    Partial<
      Pick<
        RunSubmission,
        "runToken" | "seed" | "kills" | "maxCombo" | "lastSaveCount" | "solarLanceCount" | "gravitySlowCount" | "skillUse"
      >
    >,
): SubmissionValidation {
  if (run.runToken !== undefined && run.runToken.trim().length === 0) return { ok: false, reason: "invalid_token" };
  if (run.seed !== undefined && (!Number.isSafeInteger(run.seed) || run.seed < 0)) return { ok: false, reason: "invalid_seed" };
  if (run.score < 0) return { ok: false, reason: "score_negative" };
  if (run.survivalMs < 0) return { ok: false, reason: "survival_negative" };
  if (run.remainingEnergy < 0 || run.remainingEnergy > 100) return { ok: false, reason: "energy_out_of_range" };
  for (const count of [run.kills, run.maxCombo, run.lastSaveCount, run.solarLanceCount, run.gravitySlowCount]) {
    if (count === undefined) continue;
    if (!Number.isInteger(count)) return { ok: false, reason: "count_not_integer" };
    if (count < 0) return { ok: false, reason: "count_negative" };
  }
  if (run.skillUse) {
    for (const count of Object.values(run.skillUse)) {
      if (count === undefined) continue;
      if (!Number.isInteger(count)) return { ok: false, reason: "count_not_integer" };
      if (count < 0) return { ok: false, reason: "skill_use_negative" };
    }
  }
  return { ok: true };
}

export interface IRankingSystem {
  beginRun(difficulty: string): Promise<{ runToken: string; seed: number }>;
  submit(run: RunSubmission): Promise<void>;
}

class LocalStubRankingSystem implements IRankingSystem {
  async beginRun(_difficulty: string): Promise<{ runToken: string; seed: number }> {
    // 스텁: 로컬 토큰 + 현재 시각 기반 seed. 랭킹 부착 시 서버 발급 seed로 교체.
    return { runToken: `local-${Date.now()}`, seed: Date.now() >>> 0 };
  }
  async submit(_run: RunSubmission): Promise<void> {
    // noop
  }
}

export const RankingSystem: IRankingSystem = new LocalStubRankingSystem();
