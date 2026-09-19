import type { BackendAdapter } from "./BackendAdapter";
import { LocalBackendAdapter } from "./BackendAdapter";
import { SupabaseEdgeBackendAdapter } from "./SupabaseEdgeBackendAdapter";

export interface BackendEnv {
  [key: string]: unknown;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_RANKED_EDGE_REMOTE_ENABLED?: string | boolean;
  VITE_REWARDED_AD_TELEMETRY_REMOTE_ENABLED?: string | boolean;
  VITE_REWARDED_AD_TELEMETRY_REMOTE_VERIFIED?: string | boolean;
  VITE_GAMEPLAY_TELEMETRY_REMOTE_ENABLED?: string | boolean;
  VITE_GAMEPLAY_TELEMETRY_REMOTE_VERIFIED?: string | boolean;
  VITE_PRODUCT_TELEMETRY_REMOTE_ENABLED?: string | boolean;
  VITE_PRODUCT_TELEMETRY_REMOTE_VERIFIED?: string | boolean;
  VITE_PROGRESS_SYNC_REMOTE_ENABLED?: string | boolean;
  VITE_FRIEND_CHALLENGE_REMOTE_ENABLED?: string | boolean;
  VITE_LIVEOPS_EVIDENCE_VERIFIED?: string | boolean;
  VITE_PUBLIC_LEADERBOARD_ENABLED?: string | boolean;
  fetch?: typeof fetch;
}

export interface BackendRuntimeSession {
  /** Runtime-only server-issued session provider. It must not come from VITE env. */
  accessTokenProvider?: () => Promise<string | null>;
}

export function createDefaultBackendAdapter(
  env: BackendEnv = import.meta.env,
  runtimeSession: BackendRuntimeSession = {},
): BackendAdapter {
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
    const functionsBase = `${env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;
    return new SupabaseEdgeBackendAdapter(`${functionsBase}/orbitslash-ranked-run`, env.VITE_SUPABASE_ANON_KEY, env.fetch ?? fetch, {
      rankedEdgeRemoteEnabled: env.VITE_RANKED_EDGE_REMOTE_ENABLED === true || env.VITE_RANKED_EDGE_REMOTE_ENABLED === "true",
      accessTokenProvider: runtimeSession.accessTokenProvider,
      adTelemetryEndpointUrl: `${functionsBase}/orbitslash-rewarded-ad-telemetry`,
      adTelemetryRemoteEnabled: env.VITE_REWARDED_AD_TELEMETRY_REMOTE_ENABLED === true || env.VITE_REWARDED_AD_TELEMETRY_REMOTE_ENABLED === "true",
      adTelemetryRemoteVerified: env.VITE_REWARDED_AD_TELEMETRY_REMOTE_VERIFIED === true || env.VITE_REWARDED_AD_TELEMETRY_REMOTE_VERIFIED === "true",
      gameplayTelemetryEndpointUrl: `${functionsBase}/orbitslash-gameplay-telemetry`,
      gameplayTelemetryRemoteEnabled: env.VITE_GAMEPLAY_TELEMETRY_REMOTE_ENABLED === true || env.VITE_GAMEPLAY_TELEMETRY_REMOTE_ENABLED === "true",
      gameplayTelemetryRemoteVerified: env.VITE_GAMEPLAY_TELEMETRY_REMOTE_VERIFIED === true || env.VITE_GAMEPLAY_TELEMETRY_REMOTE_VERIFIED === "true",
      productTelemetryEndpointUrl: `${functionsBase}/orbitslash-product-telemetry`,
      productTelemetryRemoteEnabled: env.VITE_PRODUCT_TELEMETRY_REMOTE_ENABLED === true || env.VITE_PRODUCT_TELEMETRY_REMOTE_ENABLED === "true",
      productTelemetryRemoteVerified: env.VITE_PRODUCT_TELEMETRY_REMOTE_VERIFIED === true || env.VITE_PRODUCT_TELEMETRY_REMOTE_VERIFIED === "true",
      friendChallengeEndpointUrl: `${functionsBase}/orbitslash-friend-challenge`,
      friendChallengeRemoteEnabled: env.VITE_FRIEND_CHALLENGE_REMOTE_ENABLED === true || env.VITE_FRIEND_CHALLENGE_REMOTE_ENABLED === "true",
      liveOpsEvidenceVerified: env.VITE_LIVEOPS_EVIDENCE_VERIFIED === true || env.VITE_LIVEOPS_EVIDENCE_VERIFIED === "true",
      publicLeaderboardEnabled: env.VITE_PUBLIC_LEADERBOARD_ENABLED === true || env.VITE_PUBLIC_LEADERBOARD_ENABLED === "true",
    });
  }
  return new LocalBackendAdapter();
}
