import type { DifficultyId } from "../game/ModeConfig";
import type { RunSummary } from "../game/RankingSystem";
import type { RankedReplayTrace } from "../game/RankedReplayTrace";
import { RANKING_STRATEGY, type RankingStrategy } from "./RankingStrategy";
import type {
  BackendAdapter,
  FriendChallengeAcceptResult,
  FriendChallengeCreateResult,
  FriendChallengeListItem,
  FriendChallengeListResult,
  FriendChallengeResultMetadata,
  GameplayTelemetryEvent,
  GameplayTelemetryStatus,
  PublicLeaderboardResult,
  PublicLeaderboardRow,
  RankedRunStart,
  RewardedAdTelemetryEvent,
  RewardedAdTelemetryStatus,
  ProductTelemetryStatus,
  PublicLeaderboardQuery,
} from "./BackendAdapter";
import { currentPublicLeaderboardQuery } from "./BackendAdapter";
import { resolveLeaderboardBoundary, type LeaderboardBoundaryState } from "./LeaderboardBoundary";
import { sanitizeProductTelemetryEvent, type ProductTelemetryEvent } from "./ProductTelemetry";
import type { PlatformTelemetryContext } from "./PlatformAdapter";
import { CURRENT_RANKED_RULES_CONTRACT } from "../game/RankedRulesContract";
import type { FriendChallengeContract } from "../game/liveops/FriendChallenge";

type FetchFn = typeof fetch;

export interface SupabaseEdgeBackendAdapterOptions {
  /** Runtime-only provider for a server-issued session token. Takes precedence over legacy static test wiring. */
  accessTokenProvider?: () => Promise<string | null>;
  accessToken?: string;
  rankedEdgeRemoteEnabled?: boolean;
  adTelemetryEndpointUrl?: string;
  adTelemetryRemoteEnabled?: boolean;
  adTelemetryRemoteVerified?: boolean;
  gameplayTelemetryEndpointUrl?: string;
  gameplayTelemetryRemoteEnabled?: boolean;
  gameplayTelemetryRemoteVerified?: boolean;
  productTelemetryEndpointUrl?: string;
  productTelemetryRemoteEnabled?: boolean;
  productTelemetryRemoteVerified?: boolean;
  friendChallengeEndpointUrl?: string;
  friendChallengeRemoteEnabled?: boolean;
  liveOpsEvidenceVerified?: boolean;
  publicLeaderboardEnabled?: boolean;
}

interface RankedBeginResponse {
  ok: true;
  start: RankedRunStart;
}

interface RankedSubmitResponse {
  ok: true;
  accepted: true;
}

interface RankedErrorResponse {
  ok: false;
  reason?: string;
}

interface PublicLeaderboardResponse {
  ok: true;
  rows: unknown[];
}

interface FriendChallengeEdgeResponse {
  ok: boolean;
  reason?: string;
  challengeId?: unknown;
  token?: unknown;
  challenges?: unknown;
  accepted?: unknown;
  result?: unknown;
}

const GAMEPLAY_EVENT_NAMES = new Set([
  "spawn",
  "directional_reject",
  "combo_break",
  "last_save",
  "skill_fire",
  "death",
  "run_submit",
  "ranked_submission_validation",
  "ranked_submission_result",
  "delta_shield_absorb",
  "wave_start",
  "earth_hit",
  "boss_hit",
  "boss_phase",
]);

const GAMEPLAY_TRACK_PROP_KEYS = new Set([
  "sessionTraceId",
  "screen",
  "modeId",
  "difficulty",
  "runtime",
  "runtimeChannel",
  "runToken",
  "enemyType",
  "skillId",
  "reason",
  "band",
  "score",
  "survivalMs",
  "combo",
  "eventSequence",
  "appVersion",
  "buildVersion",
  "deploymentId",
  "ok",
  "accepted",
  "endReason",
]);

export class SupabaseEdgeBackendAdapter implements BackendAdapter {
  private adTelemetryWriteVerified = false;
  private gameplayTelemetryWriteVerified = false;
  private productTelemetryWriteVerified = false;

  constructor(
    private readonly endpointUrl: string,
    private readonly anonKey: string,
    private readonly fetchFn: FetchFn = fetch,
    private readonly options: SupabaseEdgeBackendAdapterOptions = {},
  ) {}

  async beginRankedRun(difficulty: DifficultyId): Promise<RankedRunStart> {
    if (this.options.rankedEdgeRemoteEnabled !== true) {
      throw new Error("ranked_edge_remote_not_enabled");
    }
    const response = await this.post<RankedBeginResponse | RankedErrorResponse>({
      action: "begin",
      difficulty,
      ...CURRENT_RANKED_RULES_CONTRACT,
    });
    if (!response.ok || !("start" in response)) {
      throw new Error(response.reason ?? "ranked_begin_failed");
    }
    return response.start;
  }

  async submitRankedRun(summary: RunSummary, replayTrace?: RankedReplayTrace): Promise<{ accepted: boolean; reason?: string }> {
    if (this.options.rankedEdgeRemoteEnabled !== true) return { accepted: false, reason: "ranked_edge_remote_not_enabled" };
    try {
      const response = await this.post<RankedSubmitResponse | RankedErrorResponse>({
        action: "submit",
        summary,
        replayTrace,
        ...CURRENT_RANKED_RULES_CONTRACT,
      });
      if (!response.ok) return { accepted: false, reason: response.reason ?? "ranked_submit_failed" };
      return { accepted: response.accepted };
    } catch {
      return { accepted: false, reason: "ranked_submit_network_failed" };
    }
  }

  async leaderboardStatus(): Promise<LeaderboardBoundaryState> {
    if (this.options.rankedEdgeRemoteEnabled !== true) return resolveLeaderboardBoundary();
    return resolveLeaderboardBoundary({ rankedEdgeDeployed: true });
  }

  async publicLeaderboardRows(query: PublicLeaderboardQuery = currentPublicLeaderboardQuery()): Promise<PublicLeaderboardResult> {
    if (this.options.rankedEdgeRemoteEnabled !== true) {
      return {
        status: resolveLeaderboardBoundary(),
        rows: [],
      };
    }
    if (this.options.publicLeaderboardEnabled !== true) {
      return {
        status: resolveLeaderboardBoundary({ rankedEdgeDeployed: true, identityBoundAcceptedRuns: true }),
        rows: [],
      };
    }
    try {
      const response = await this.post<PublicLeaderboardResponse | RankedErrorResponse>({
        action: "leaderboard",
        difficulty: query.difficulty,
        weekKey: query.weekKey,
        limit: query.limit ?? 10,
      });
      if (!response.ok) {
        return {
          status: resolveLeaderboardBoundary({
            rankedEdgeDeployed: true,
            identityBoundAcceptedRuns: response.reason !== "identity_bound_runs_missing",
            publicLeaderboardEnabled: false,
          }),
          rows: [],
        };
      }
      const rows = this.sanitizePublicLeaderboardRows(response.rows);
      return {
        status: resolveLeaderboardBoundary({
          rankedEdgeDeployed: true,
          identityBoundAcceptedRuns: rows.length > 0,
          publicLeaderboardEnabled: rows.length > 0,
        }),
        rows,
      };
    } catch {
      return {
        status: resolveLeaderboardBoundary({ rankedEdgeDeployed: true }),
        rows: [],
      };
    }
  }

  async rewardedAdTelemetryStatus(): Promise<RewardedAdTelemetryStatus> {
    const endpointConfigured = Boolean(this.options.adTelemetryEndpointUrl);
    const remoteEnabled = this.options.adTelemetryRemoteEnabled === true;
    const remoteVerified = this.options.adTelemetryRemoteVerified === true || this.adTelemetryWriteVerified;
    if (!endpointConfigured) {
      return {
        ready: false,
        reason: "endpoint_not_configured",
        endpointConfigured,
        remoteEnabled: false,
        remoteVerified: false,
      };
    }
    if (!remoteEnabled) {
      return {
        ready: false,
        reason: "remote_not_enabled",
        endpointConfigured,
        remoteEnabled,
        remoteVerified: false,
      };
    }
    if (!remoteVerified) {
      return {
        ready: false,
        reason: "remote_unverified",
        endpointConfigured,
        remoteEnabled,
        remoteVerified,
      };
    }
    return {
      ready: true,
      reason: "ready",
      endpointConfigured,
      remoteEnabled,
      remoteVerified,
    };
  }

  async recordRewardedAdEvent(_event: RewardedAdTelemetryEvent): Promise<{ accepted: boolean; reason?: string }> {
    if (!this.options.adTelemetryEndpointUrl) return { accepted: false, reason: "telemetry_not_configured" };
    if (this.options.adTelemetryRemoteEnabled !== true) return { accepted: false, reason: "ad_telemetry_remote_not_enabled" };
    try {
      const response = await this.postTo<RankedErrorResponse | { ok: true; accepted: boolean }>(this.options.adTelemetryEndpointUrl, {
        action: "record",
        events: [this.withRewardedAdTelemetryDefaults(_event)],
      });
      if (!response.ok) return { accepted: false, reason: response.reason ?? "ad_telemetry_failed" };
      if (response.accepted === true) this.adTelemetryWriteVerified = true;
      return { accepted: response.accepted === true };
    } catch {
      return { accepted: false, reason: "ad_telemetry_network_failed" };
    }
  }

  async gameplayTelemetryStatus(): Promise<GameplayTelemetryStatus> {
    const endpointConfigured = Boolean(this.options.gameplayTelemetryEndpointUrl);
    const remoteEnabled = this.options.gameplayTelemetryRemoteEnabled === true;
    const remoteVerified = this.options.gameplayTelemetryRemoteVerified === true || this.gameplayTelemetryWriteVerified;
    if (!endpointConfigured) {
      return {
        ready: false,
        reason: "endpoint_not_configured",
        endpointConfigured,
        remoteEnabled: false,
        remoteVerified: false,
      };
    }
    if (!remoteEnabled) {
      return {
        ready: false,
        reason: "remote_not_enabled",
        endpointConfigured,
        remoteEnabled,
        remoteVerified: false,
      };
    }
    if (!remoteVerified) {
      return {
        ready: false,
        reason: "remote_unverified",
        endpointConfigured,
        remoteEnabled,
        remoteVerified,
      };
    }
    return {
      ready: true,
      reason: "ready",
      endpointConfigured,
      remoteEnabled,
      remoteVerified,
    };
  }

  async recordGameplayEvent(_event: GameplayTelemetryEvent): Promise<{ accepted: boolean; reason?: string }> {
    if (!this.options.gameplayTelemetryEndpointUrl) return { accepted: false, reason: "telemetry_not_configured" };
    if (this.options.gameplayTelemetryRemoteEnabled !== true) return { accepted: false, reason: "gameplay_telemetry_remote_not_enabled" };
    try {
      const response = await this.postTo<RankedErrorResponse | { ok: true; accepted: boolean }>(this.options.gameplayTelemetryEndpointUrl, {
        action: "record",
        events: [this.withGameplayTelemetryDefaults(_event)],
      });
      if (!response.ok) return { accepted: false, reason: response.reason ?? "gameplay_telemetry_failed" };
      if (response.accepted === true) this.gameplayTelemetryWriteVerified = true;
      return { accepted: response.accepted === true };
    } catch {
      return { accepted: false, reason: "gameplay_telemetry_network_failed" };
    }
  }

  async productTelemetryStatus(): Promise<ProductTelemetryStatus> {
    const endpointConfigured = Boolean(this.options.productTelemetryEndpointUrl);
    const remoteEnabled = this.options.productTelemetryRemoteEnabled === true;
    const remoteVerified = this.options.productTelemetryRemoteVerified === true || this.productTelemetryWriteVerified;
    if (!endpointConfigured) return { ready: false, reason: "endpoint_not_configured", endpointConfigured, remoteEnabled: false, remoteVerified: false };
    if (!remoteEnabled) return { ready: false, reason: "remote_not_enabled", endpointConfigured, remoteEnabled, remoteVerified: false };
    if (!remoteVerified) return { ready: false, reason: "remote_unverified", endpointConfigured, remoteEnabled, remoteVerified };
    return { ready: true, reason: "ready", endpointConfigured, remoteEnabled, remoteVerified };
  }

  async recordProductEvent(event: ProductTelemetryEvent, context: PlatformTelemetryContext): Promise<{ accepted: boolean; reason?: string }> {
    if (!this.options.productTelemetryEndpointUrl) return { accepted: false, reason: "telemetry_not_configured" };
    if (this.options.productTelemetryRemoteEnabled !== true) return { accepted: false, reason: "product_telemetry_remote_not_enabled" };
    try {
      const response = await this.postTo<RankedErrorResponse | { ok: true; accepted: boolean }>(this.options.productTelemetryEndpointUrl, {
        action: "record",
        events: [{
          ...sanitizeProductTelemetryEvent(event),
          runtime: context.runtime,
          runtimeChannel: context.runtimeChannel,
          deploymentId: context.deploymentId,
          clientAt: new Date().toISOString(),
        }],
      });
      if (!response.ok) return { accepted: false, reason: response.reason ?? "product_telemetry_failed" };
      if (response.accepted === true) this.productTelemetryWriteVerified = true;
      return { accepted: response.accepted === true };
    } catch {
      return { accepted: false, reason: "product_telemetry_network_failed" };
    }
  }

  async createFriendChallenge(contract: FriendChallengeContract): Promise<FriendChallengeCreateResult> {
    if (!this.friendChallengeReady()) return { accepted: false, reason: "friend_challenge_remote_not_enabled" };
    try {
      const response = await this.postTo<FriendChallengeEdgeResponse>(this.options.friendChallengeEndpointUrl!, {
        action: "create",
        ...friendChallengeContractPayload(contract),
      });
      if (!response.ok || typeof response.challengeId !== "string" || typeof response.token !== "string") {
        return { accepted: false, reason: response.reason ?? "friend_challenge_create_failed" };
      }
      return { accepted: true, challengeId: response.challengeId, token: response.token };
    } catch {
      return { accepted: false, reason: "friend_challenge_network_failed" };
    }
  }

  async listFriendChallenges(): Promise<FriendChallengeListResult> {
    if (!this.friendChallengeReady()) return { available: false, challenges: [], reason: "friend_challenge_remote_not_enabled" };
    try {
      const response = await this.postTo<FriendChallengeEdgeResponse>(this.options.friendChallengeEndpointUrl!, { action: "list" });
      if (!response.ok || !Array.isArray(response.challenges)) return { available: false, challenges: [], reason: response.reason ?? "friend_challenge_list_failed" };
      return { available: true, challenges: response.challenges.flatMap(parseFriendChallengeListItem) };
    } catch {
      return { available: false, challenges: [], reason: "friend_challenge_network_failed" };
    }
  }

  async acceptFriendChallenge(token: string, runToken: string): Promise<FriendChallengeAcceptResult> {
    if (!this.friendChallengeReady()) return { accepted: false, reason: "friend_challenge_remote_not_enabled" };
    try {
      const response = await this.postTo<FriendChallengeEdgeResponse>(this.options.friendChallengeEndpointUrl!, { action: "accept", token, runToken });
      if (!response.ok || response.accepted !== true) return { accepted: false, reason: response.reason ?? "friend_challenge_accept_failed" };
      const result = parseFriendChallengeResult(response.result);
      return result ? { accepted: true, result } : { accepted: false, reason: "friend_challenge_result_invalid" };
    } catch {
      return { accepted: false, reason: "friend_challenge_network_failed" };
    }
  }

  async trackEvent(event: string, props: Record<string, unknown> = {}): Promise<void> {
    if (!GAMEPLAY_EVENT_NAMES.has(event)) return;
    await this.recordGameplayEvent({
      eventName: event as GameplayTelemetryEvent["eventName"],
      atMs: Date.now(),
      ...sanitizeGameplayTrackProps(props),
    });
  }

  async fetchRemoteConfigVersion(): Promise<string> {
    return "edge";
  }

  rankingStrategy(): RankingStrategy {
    return RANKING_STRATEGY;
  }

  private friendChallengeReady(): boolean {
    return Boolean(this.options.friendChallengeEndpointUrl)
      && this.options.friendChallengeRemoteEnabled === true
      && this.options.liveOpsEvidenceVerified === true;
  }

  private async post<T>(payload: unknown): Promise<T> {
    return this.postTo<T>(this.endpointUrl, payload);
  }

  private withRewardedAdTelemetryDefaults(event: RewardedAdTelemetryEvent): RewardedAdTelemetryEvent {
    return {
      ...event,
      clientEventId: event.clientEventId ?? createClientEventId("rewarded-ad", event.sessionTraceId ?? "local-session", event.atMs, event.eventName),
      sessionTraceId: event.sessionTraceId ?? "local-session",
      clientAt: event.clientAt ?? new Date(event.atMs).toISOString(),
      screen: event.screen ?? "unknown",
      runtime: event.runtime ?? "web_stub",
      eventSequence: event.eventSequence ?? 1,
    };
  }

  private withGameplayTelemetryDefaults(event: GameplayTelemetryEvent): GameplayTelemetryEvent {
    return {
      ...event,
      clientEventId: event.clientEventId ?? createClientEventId("gameplay", event.sessionTraceId ?? "local-session", event.atMs, event.eventName),
      sessionTraceId: event.sessionTraceId ?? "local-session",
      clientAt: event.clientAt ?? new Date(event.atMs).toISOString(),
      screen: event.screen ?? "unknown",
      runtime: event.runtime ?? "web_stub",
      eventSequence: event.eventSequence ?? 1,
    };
  }

  private sanitizePublicLeaderboardRows(rows: unknown[]): PublicLeaderboardRow[] {
    return rows.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const value = row as Record<string, unknown>;
      const difficulty = value.difficulty;
      if (difficulty !== "rookie" && difficulty !== "defender" && difficulty !== "elite" && difficulty !== "master") return [];
      const parsed: PublicLeaderboardRow = {
        rank: Number(value.rank),
        score: Number(value.score),
        survivalMs: Number(value.survivalMs),
        kills: Number(value.kills),
        maxCombo: Number(value.maxCombo),
        difficulty,
        createdAt: String(value.createdAt ?? ""),
      };
      if (
        !Number.isSafeInteger(parsed.rank) ||
        !Number.isSafeInteger(parsed.score) ||
        !Number.isSafeInteger(parsed.survivalMs) ||
        !Number.isSafeInteger(parsed.kills) ||
        !Number.isSafeInteger(parsed.maxCombo) ||
        !parsed.createdAt
      ) {
        return [];
      }
      return [parsed];
    });
  }

  private async postTo<T>(url: string, payload: unknown): Promise<T> {
    const accessToken = await this.resolveAccessToken();
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.anonKey,
        Authorization: `Bearer ${accessToken ?? this.anonKey}`,
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as T;
    if (!response.ok && typeof body === "object" && body && "ok" in body) return body;
    return body;
  }

  private async resolveAccessToken(): Promise<string | null> {
    try {
      const runtimeToken = await this.options.accessTokenProvider?.();
      if (typeof runtimeToken === "string" && runtimeToken.trim().length > 0) return runtimeToken;
    } catch {
      // Missing/expired runtime session remains anonymous and therefore non-ranked.
    }
    return this.options.accessToken ?? null;
  }
}

function sanitizeGameplayTrackProps(props: Record<string, unknown>): Partial<GameplayTelemetryEvent> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!GAMEPLAY_TRACK_PROP_KEYS.has(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out as Partial<GameplayTelemetryEvent>;
}

function friendChallengeContractPayload(contract: FriendChallengeContract): FriendChallengeContract {
  return {
    seed: contract.seed,
    difficulty: contract.difficulty,
    rulesHash: contract.rulesHash,
    rulesVersion: contract.rulesVersion,
    configVersion: contract.configVersion,
    expiresAt: contract.expiresAt,
  };
}

function parseFriendChallengeListItem(value: unknown): FriendChallengeListItem[] {
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  const status = item.status;
  if (typeof item.id !== "string" || typeof item.seed !== "number" || !Number.isSafeInteger(item.seed) || typeof item.difficulty !== "string" || typeof item.rulesHash !== "string" || typeof item.rulesVersion !== "number" || !Number.isInteger(item.rulesVersion) || typeof item.configVersion !== "string" || typeof item.expiresAt !== "string" || (status !== "open" && status !== "accepted" && status !== "expired")) return [];
  const result = parseFriendChallengeResult(item.result);
  return [{
    id: item.id,
    seed: item.seed,
    difficulty: item.difficulty,
    rulesHash: item.rulesHash,
    rulesVersion: item.rulesVersion,
    configVersion: item.configVersion,
    expiresAt: item.expiresAt,
    status,
    ...(typeof item.acceptedAt === "string" ? { acceptedAt: item.acceptedAt } : {}),
    ...(result ? { result } : {}),
  }];
}

function parseFriendChallengeResult(value: unknown): FriendChallengeResultMetadata | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  if (typeof result.score !== "number" || !Number.isSafeInteger(result.score) || typeof result.survivalMs !== "number" || !Number.isSafeInteger(result.survivalMs) || typeof result.kills !== "number" || !Number.isSafeInteger(result.kills) || typeof result.maxCombo !== "number" || !Number.isSafeInteger(result.maxCombo) || typeof result.verifiedAt !== "string") return null;
  return { score: result.score, survivalMs: result.survivalMs, kills: result.kills, maxCombo: result.maxCombo, verifiedAt: result.verifiedAt };
}

function createClientEventId(prefix: string, sessionTraceId: string, atMs: number, eventName: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${sessionTraceId}-${atMs}-${eventName}-${random}`;
}
