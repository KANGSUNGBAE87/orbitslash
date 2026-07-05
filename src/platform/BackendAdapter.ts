import type { DifficultyId, ModeId } from "../game/ModeConfig";
import type { RunSummary } from "../game/RankingSystem";
import { validateRunSubmission } from "../game/RankingSystem";
import type { RankedReplayTrace } from "../game/RankedReplayTrace";
import { resolveLeaderboardBoundary, type LeaderboardBoundaryState } from "./LeaderboardBoundary";
import { validateRankedReplaySubmission } from "../game/RankedReplayValidator";
import { RANKING_STRATEGY, type RankingStrategy } from "./RankingStrategy";

export type RankedRunVerification = "local_stub" | "server_stub" | "server_verified";

export interface RankedRunStart {
  modeId?: ModeId;
  runToken: string;
  seed: number;
  difficulty: DifficultyId;
  configVersion?: string;
  rankingEligible?: boolean;
  verification?: RankedRunVerification;
  identityBound?: boolean;
  issuedAtMs?: number;
  expiresAtMs?: number;
}

export interface BackendAdapter {
  beginRankedRun(difficulty: DifficultyId): Promise<RankedRunStart>;
  submitRankedRun(summary: RunSummary, replayTrace?: RankedReplayTrace): Promise<{ accepted: boolean; reason?: string }>;
  leaderboardStatus(): Promise<LeaderboardBoundaryState>;
  publicLeaderboardRows(limit?: number): Promise<PublicLeaderboardResult>;
  rewardedAdTelemetryStatus(): Promise<RewardedAdTelemetryStatus>;
  recordRewardedAdEvent(event: RewardedAdTelemetryEvent): Promise<{ accepted: boolean; reason?: string }>;
  gameplayTelemetryStatus(): Promise<GameplayTelemetryStatus>;
  recordGameplayEvent(event: GameplayTelemetryEvent): Promise<{ accepted: boolean; reason?: string }>;
  trackEvent(event: string, props?: Record<string, unknown>): Promise<void>;
  fetchRemoteConfigVersion(): Promise<string>;
  rankingStrategy(): RankingStrategy;
}

export type RewardedAdTelemetryEventName =
  | "preload_started"
  | "loaded"
  | "show_requested"
  | "shown"
  | "impression"
  | "user_earned_reward"
  | "dismissed"
  | "failed";

export type RewardedAdPlacement = "free_defense_revive" | "free_defense_extra_play" | "story_retry" | "ranked_retry_ticket" | "boss_rush_retry";

export interface PublicLeaderboardRow {
  rank: number;
  score: number;
  survivalMs: number;
  kills: number;
  maxCombo: number;
  difficulty: DifficultyId;
  createdAt: string;
}

export interface PublicLeaderboardResult {
  status: LeaderboardBoundaryState;
  rows: PublicLeaderboardRow[];
}

export type RewardedAdTelemetryStatusReason = "local_stub" | "endpoint_not_configured" | "remote_not_enabled" | "remote_unverified" | "ready";

export interface RewardedAdTelemetryStatus {
  ready: boolean;
  reason: RewardedAdTelemetryStatusReason;
  endpointConfigured: boolean;
  remoteEnabled: boolean;
  remoteVerified?: boolean;
}

export type GameplayTelemetryStatusReason = "local_stub" | "endpoint_not_configured" | "remote_not_enabled" | "remote_unverified" | "ready";

export interface GameplayTelemetryStatus {
  ready: boolean;
  reason: GameplayTelemetryStatusReason;
  endpointConfigured: boolean;
  remoteEnabled: boolean;
  remoteVerified?: boolean;
}

export type GameplayTelemetryEventName =
  | "spawn"
  | "directional_reject"
  | "combo_break"
  | "last_save"
  | "skill_fire"
  | "death"
  | "run_submit"
  | "ranked_submission_validation"
  | "ranked_submission_result"
  | "delta_shield_absorb"
  | "wave_start"
  | "earth_hit"
  | "boss_hit"
  | "boss_phase";

export interface GameplayTelemetryEvent {
  clientEventId?: string;
  sessionTraceId?: string;
  eventName: GameplayTelemetryEventName;
  atMs: number;
  clientAt?: string;
  screen?: string;
  modeId?: ModeId;
  difficulty?: DifficultyId;
  runtime?: "web_stub" | "apps_in_toss" | "google_play";
  runtimeChannel?: "sandbox" | "toss_private_test" | "toss_live";
  runToken?: string;
  enemyType?: string;
  skillId?: string;
  reason?: string;
  band?: string;
  score?: number;
  survivalMs?: number;
  combo?: number;
  eventSequence?: number;
  appVersion?: string;
  buildVersion?: string;
  deploymentId?: string;
  extra?: Record<string, unknown>;
}

export interface RewardedAdTelemetryEvent {
  clientEventId?: string;
  sessionTraceId?: string;
  eventName: RewardedAdTelemetryEventName;
  placement: RewardedAdPlacement;
  atMs: number;
  clientAt?: string;
  screen?: string;
  modeId?: ModeId;
  runtime?: "web_stub" | "apps_in_toss" | "google_play";
  runtimeChannel?: "sandbox" | "toss_private_test" | "toss_live";
  runToken?: string;
  sdkEventType?: string;
  placementKey?: string;
  placementId?: string;
  adGroupId?: string;
  reason?: string;
  shown?: boolean;
  rewardEarned?: boolean;
  dismissed?: boolean;
  showToRewardMs?: number;
  rewardToDismissMs?: number;
  showToDismissMs?: number;
  eventSequence?: number;
  finalEvent?: "user_earned_reward" | "dismissed" | "failed";
  appVersion?: string;
  buildVersion?: string;
  deploymentId?: string;
  extra?: Record<string, unknown>;
}

export type PublicRankedStartValidationReason =
  | "not_ranked_mode"
  | "not_server_verified"
  | "not_ranking_eligible"
  | "invalid_token"
  | "invalid_seed"
  | "invalid_config_version"
  | "identity_not_bound"
  | "missing_expiry"
  | "expired"
  | "issued_in_future";

export type PublicRankedStartValidation =
  | { ok: true }
  | {
      ok: false;
      reason: PublicRankedStartValidationReason;
    };

export type PublicRankedSubmissionValidationReason =
  | PublicRankedStartValidationReason
  | "summary_not_ranked"
  | "run_token_mismatch"
  | "seed_mismatch"
  | "difficulty_mismatch"
  | "score_negative"
  | "survival_negative"
  | "energy_out_of_range"
  | "count_negative"
  | "count_not_integer"
  | "skill_use_negative"
  | "invalid_seed"
  | "replay_not_ranked"
  | "replay_invalid_difficulty"
  | "replay_invalid_survival"
  | "replay_survival_exceeds_token_ttl"
  | "replay_kills_exceed_spawned"
  | "replay_last_save_exceeds_kills"
  | "replay_score_exceeds_bound"
  | "replay_skill_use_exceeds_bound"
  | "replay_trace_missing"
  | "replay_trace_invalid_time"
  | "replay_trace_unknown_spawn"
  | "replay_trace_duplicate_kill"
  | "replay_trace_kill_before_spawn"
  | "replay_trace_invalid_geometry"
  | "replay_trace_summary_mismatch";

export type PublicRankedSubmissionValidation =
  | { ok: true }
  | {
      ok: false;
      reason: PublicRankedSubmissionValidationReason;
    };

const PUBLIC_RANKED_TOKEN_PREFIX = "server-ranked-";
const CLOCK_SKEW_ALLOWANCE_MS = 60_000;
const RANKED_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RANKED_WEEK_START_EPOCH_MS = Date.UTC(2026, 0, 4, 21, 0, 0); // 2026-01-05 06:00 KST.

export function createRankedWeeklySeed(difficulty: DifficultyId, now: Date | number = Date.now()): number {
  const nowMs = now instanceof Date ? now.getTime() : now;
  const weekIndex = Math.floor((nowMs - RANKED_WEEK_START_EPOCH_MS) / RANKED_WEEK_MS);
  return hashRankedSeed(`orbitslash-ranked-v1:${weekIndex}:${difficulty}`);
}

function hashRankedSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

export function createLocalRunStart(difficulty: DifficultyId, seed = Date.now() >>> 0, modeId?: ModeId): RankedRunStart {
  return {
    modeId,
    runToken: `local-${seed}`,
    seed,
    difficulty,
    rankingEligible: false,
    verification: "local_stub",
  };
}

export function createRankedServerStubStart(difficulty: DifficultyId, seed: number, configVersion: string): RankedRunStart {
  return {
    modeId: "ranked",
    runToken: `server-stub-${configVersion}-${seed}`,
    seed,
    difficulty,
    configVersion,
    rankingEligible: false,
    verification: "server_stub",
  };
}

export function createServerVerifiedRankedStart(params: {
  difficulty: DifficultyId;
  seed: number;
  runToken: string;
  configVersion: string;
  issuedAtMs: number;
  expiresAtMs: number;
  identityBound?: boolean;
}): RankedRunStart {
  return {
    modeId: "ranked",
    runToken: params.runToken,
    seed: params.seed,
    difficulty: params.difficulty,
    configVersion: params.configVersion,
    rankingEligible: true,
    verification: "server_verified",
    identityBound: params.identityBound ?? true,
    issuedAtMs: params.issuedAtMs,
    expiresAtMs: params.expiresAtMs,
  };
}

export function validatePublicRankedStart(start: RankedRunStart, nowMs = Date.now()): PublicRankedStartValidation {
  if (start.modeId !== "ranked") return { ok: false, reason: "not_ranked_mode" };
  if (start.verification !== "server_verified") return { ok: false, reason: "not_server_verified" };
  if (start.rankingEligible !== true) return { ok: false, reason: "not_ranking_eligible" };
  if (!start.runToken.startsWith(PUBLIC_RANKED_TOKEN_PREFIX)) return { ok: false, reason: "invalid_token" };
  if (!Number.isSafeInteger(start.seed) || start.seed <= 0) return { ok: false, reason: "invalid_seed" };
  if (!start.configVersion?.startsWith(PUBLIC_RANKED_TOKEN_PREFIX)) {
    return { ok: false, reason: "invalid_config_version" };
  }
  if (start.identityBound !== true) return { ok: false, reason: "identity_not_bound" };
  if (!Number.isFinite(start.issuedAtMs ?? NaN) || !Number.isFinite(start.expiresAtMs ?? NaN)) {
    return { ok: false, reason: "missing_expiry" };
  }
  if (start.issuedAtMs! > nowMs + CLOCK_SKEW_ALLOWANCE_MS) return { ok: false, reason: "issued_in_future" };
  if (start.expiresAtMs! <= nowMs) return { ok: false, reason: "expired" };
  return { ok: true };
}

export function validatePublicRankedSubmission(
  summary: RunSummary,
  start: RankedRunStart,
  nowMs = Date.now(),
  replayTrace?: RankedReplayTrace,
): PublicRankedSubmissionValidation {
  const startValidation = validatePublicRankedStart(start, nowMs);
  if (!startValidation.ok) return startValidation;
  const baseValidation = validateRunSubmission(summary);
  if (!baseValidation.ok) return baseValidation;
  if (summary.modeId !== "ranked") return { ok: false, reason: "summary_not_ranked" };
  if (summary.runToken !== start.runToken) return { ok: false, reason: "run_token_mismatch" };
  if (summary.seed !== start.seed) return { ok: false, reason: "seed_mismatch" };
  if (summary.difficulty !== start.difficulty) return { ok: false, reason: "difficulty_mismatch" };
  const replayValidation = validateRankedReplaySubmission(summary, replayTrace);
  if (!replayValidation.ok) return { ok: false, reason: replayValidation.reason };
  return { ok: true };
}

export class LocalBackendAdapter implements BackendAdapter {
  constructor(private readonly seed = Date.now() >>> 0) {}

  beginLocalRun(difficulty: DifficultyId, seed = this.seed, modeId?: ModeId): RankedRunStart {
    return createLocalRunStart(difficulty, seed, modeId);
  }

  async beginRankedRun(difficulty: DifficultyId): Promise<RankedRunStart> {
    return this.beginLocalRun(difficulty, this.seed, "ranked");
  }

  async submitRankedRun(_summary: RunSummary, _replayTrace?: RankedReplayTrace): Promise<{ accepted: boolean; reason?: string }> {
    return { accepted: false, reason: "local_stub" };
  }

  async leaderboardStatus(): Promise<LeaderboardBoundaryState> {
    return resolveLeaderboardBoundary();
  }

  async publicLeaderboardRows(_limit = 10): Promise<PublicLeaderboardResult> {
    return {
      status: resolveLeaderboardBoundary(),
      rows: [],
    };
  }

  async rewardedAdTelemetryStatus(): Promise<RewardedAdTelemetryStatus> {
    return {
      ready: false,
      reason: "local_stub",
      endpointConfigured: false,
      remoteEnabled: false,
      remoteVerified: false,
    };
  }

  async recordRewardedAdEvent(_event: RewardedAdTelemetryEvent): Promise<{ accepted: boolean; reason?: string }> {
    return { accepted: false, reason: "telemetry_not_configured" };
  }

  async gameplayTelemetryStatus(): Promise<GameplayTelemetryStatus> {
    return {
      ready: false,
      reason: "local_stub",
      endpointConfigured: false,
      remoteEnabled: false,
      remoteVerified: false,
    };
  }

  async recordGameplayEvent(_event: GameplayTelemetryEvent): Promise<{ accepted: boolean; reason?: string }> {
    return { accepted: false, reason: "telemetry_not_configured" };
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
