import type { RevivePolicy, RunConfig } from "./ModeConfig";

export interface AdReviveReadiness {
  adsAdapterReady?: boolean;
  platformSupportsRewardedAd?: boolean;
  rewardedTelemetryReady?: boolean;
}

export type ReviveAvailabilityReason =
  | "policy_not_ad_revive"
  | "ads_adapter_missing"
  | "platform_not_supported"
  | "rewarded_telemetry_missing"
  | "ready";

export interface ReviveAvailability {
  enabled: boolean;
  policy: RevivePolicy;
  reason: ReviveAvailabilityReason;
}

export function resolveReviveAvailability(config: Pick<RunConfig, "rules">, readiness: AdReviveReadiness = {}): ReviveAvailability {
  const policy = config.rules.revivePolicy;
  if (policy !== "adRevive") return { enabled: false, policy, reason: "policy_not_ad_revive" };
  if (!readiness.adsAdapterReady) return { enabled: false, policy, reason: "ads_adapter_missing" };
  if (!readiness.platformSupportsRewardedAd) return { enabled: false, policy, reason: "platform_not_supported" };
  if (!readiness.rewardedTelemetryReady) return { enabled: false, policy, reason: "rewarded_telemetry_missing" };
  return { enabled: true, policy, reason: "ready" };
}
