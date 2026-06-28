import type { RunSummary } from "../game/RankingSystem";
import { RANKING_STRATEGY, type RankingStrategy } from "./RankingStrategy";

export interface RankedRunStart {
  runToken: string;
  seed: number;
  difficulty: string;
}

export interface BackendAdapter {
  beginRankedRun(difficulty: string): Promise<RankedRunStart>;
  submitRankedRun(summary: RunSummary): Promise<{ accepted: boolean; reason?: string }>;
  trackEvent(event: string, props?: Record<string, unknown>): Promise<void>;
  fetchRemoteConfigVersion(): Promise<string>;
  rankingStrategy(): RankingStrategy;
}

export function createLocalRunStart(difficulty: string, seed = Date.now() >>> 0): RankedRunStart {
  return {
    runToken: `local-${seed}`,
    seed,
    difficulty,
  };
}

export class LocalBackendAdapter implements BackendAdapter {
  constructor(private readonly seed = Date.now() >>> 0) {}

  beginLocalRun(difficulty: string, seed = this.seed): RankedRunStart {
    return createLocalRunStart(difficulty, seed);
  }

  async beginRankedRun(difficulty: string): Promise<RankedRunStart> {
    return this.beginLocalRun(difficulty);
  }

  async submitRankedRun(_summary: RunSummary): Promise<{ accepted: boolean; reason?: string }> {
    return { accepted: false, reason: "local_stub" };
  }

  async trackEvent(_event: string, _props?: Record<string, unknown>): Promise<void> {
    // noop: server telemetry must be added behind this adapter.
  }

  async fetchRemoteConfigVersion(): Promise<string> {
    return "local";
  }

  rankingStrategy(): RankingStrategy {
    return RANKING_STRATEGY;
  }
}
