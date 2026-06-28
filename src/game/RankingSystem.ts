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
