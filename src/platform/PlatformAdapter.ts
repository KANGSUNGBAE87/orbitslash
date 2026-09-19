// 플랫폼 어댑터 경계 (implementation-plan §6, CLAUDE.md app platform 규칙).
// product/domain 로직이 Apps in Toss / Google Play SDK를 직접 import 하지 않도록
// login/ads/iap/storage/haptics를 추상화한다.
// Runtime selection happens through PlatformAdapterFactory; product logic should
// depend only on this interface.

export interface AuthResult {
  userId: string;
  provider: string;
}

export interface AdResult {
  shown: boolean;
  rewarded: boolean;
  rewardEarned: boolean;
  dismissed: boolean;
  reason?: "platform_not_supported" | "load_failed" | "show_failed" | "dismissed_without_reward";
}

export interface RewardedAdCapability {
  supported: boolean;
  reason?: "platform_not_supported" | "telemetry_not_ready" | "ready";
}

export type PlatformRuntimeName = "web_stub" | "apps_in_toss" | "google_play";
export type PlatformRuntimeChannel = "sandbox" | "toss_private_test" | "toss_live";

export interface PlatformTelemetryContext {
  runtime: PlatformRuntimeName;
  runtimeChannel?: PlatformRuntimeChannel;
  operationalEnvironment?: string;
  deploymentId?: string;
}

export interface PurchaseResult {
  success: boolean;
  productId: string;
  reason?: "platform_not_supported" | "purchase_failed" | "cancelled" | "verification_required";
}

export interface PurchaseRestoreResult {
  supported: boolean;
  productIds: string[];
}

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlatformAnalyticsEvent {
  eventName: string;
  atMs: number;
  screen?: string;
  modeId?: string;
  reason?: string;
}

export interface IPlatformAdapter {
  login(): Promise<AuthResult>;
  /**
   * Returns only a server-issued app session token after the platform proof has
   * already been verified by a backend boundary. Never return a raw provider
   * identifier or synthesize a token from a platform user id.
   */
  getVerifiedSessionAccessToken?(): Promise<string | null>;
  telemetryContext(): PlatformTelemetryContext;
  rewardedAdCapability(): Promise<RewardedAdCapability>;
  showRewardedAd(): Promise<AdResult>;
  purchase(productId: string): Promise<PurchaseResult>;
  restorePurchases?(): Promise<PurchaseRestoreResult>;
  storageGet(key: string): Promise<string | null>;
  storageSet(key: string, value: string): Promise<void>;
  haptic(kind: "light" | "medium" | "heavy"): void;
  safeAreaInsets?(): Promise<SafeAreaInsets>;
  subscribeLifecycle?(listener: (event: "background" | "foreground") => void): Promise<() => Promise<void>>;
  trackAnalyticsEvent(event: PlatformAnalyticsEvent): Promise<void>;
}
