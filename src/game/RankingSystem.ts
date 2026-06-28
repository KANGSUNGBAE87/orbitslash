// 랭킹 시스템 (implementation-plan §3.7). Phase 1은 로컬 스텁.
// 서버 검증(Run Token, 고정 시드, 기록 검증)은 Phase 6.
// TODO(Phase6): Supabase orbitslash_runs/scores + 서버 검증. product-plan §21.3.

export interface RunSubmission {
  runToken: string;
  seed: number;
  difficulty: string;
  survivalMs: number;
  score: number;
  kills: number;
  maxCombo: number;
  lastSaveCount: number;
  remainingEnergy: number;
  solarLanceCount?: number;
  gravitySlowCount?: number;
}

export interface RunSummary extends RunSubmission {
  skillUse: {
    solar_lance: number;
    gravity_slow: number;
  };
}

export type SubmissionValidation =
  | { ok: true }
  | { ok: false; reason: "score_negative" | "survival_negative" | "energy_out_of_range" };

export function createRunSummary(run: RunSubmission): RunSummary {
  return {
    ...run,
    skillUse: {
      solar_lance: run.solarLanceCount ?? 0,
      gravity_slow: run.gravitySlowCount ?? 0,
    },
  };
}

export function validateRunSubmission(run: Pick<RunSubmission, "score" | "survivalMs" | "remainingEnergy">): SubmissionValidation {
  if (run.score < 0) return { ok: false, reason: "score_negative" };
  if (run.survivalMs < 0) return { ok: false, reason: "survival_negative" };
  if (run.remainingEnergy < 0 || run.remainingEnergy > 100) return { ok: false, reason: "energy_out_of_range" };
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
