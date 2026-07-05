import type {
  AdResult,
  AuthResult,
  IPlatformAdapter,
  PlatformAnalyticsEvent,
  PlatformTelemetryContext,
  PurchaseResult,
  RewardedAdCapability,
} from "./PlatformAdapter";

export interface GooglePlayBridge {
  login?: () => Promise<{ internalUserId: string }>;
  rewardedAdCapability?: () => Promise<RewardedAdCapability>;
  showRewardedAd?: () => Promise<AdResult>;
  purchase?: (productId: string) => Promise<PurchaseResult>;
  storageGet?: (key: string) => Promise<string | null>;
  storageSet?: (key: string, value: string) => Promise<void>;
  haptic?: (kind: "light" | "medium" | "heavy") => void;
  trackAnalyticsEvent?: (event: PlatformAnalyticsEvent) => Promise<void>;
}

export class GooglePlayAdapter implements IPlatformAdapter {
  private readonly mem = new Map<string, string>();

  constructor(private readonly bridge: GooglePlayBridge = {}) {}

  async login(): Promise<AuthResult> {
    const result = await this.bridge.login?.();
    return {
      userId: result?.internalUserId ?? "google-play-anonymous",
      provider: "google_play",
    };
  }

  telemetryContext(): PlatformTelemetryContext {
    return { runtime: "google_play" };
  }

  async rewardedAdCapability(): Promise<RewardedAdCapability> {
    return this.bridge.rewardedAdCapability?.() ?? { supported: false, reason: "platform_not_supported" };
  }

  async showRewardedAd(): Promise<AdResult> {
    return (
      (await this.bridge.showRewardedAd?.()) ?? {
        shown: false,
        rewarded: false,
        rewardEarned: false,
        dismissed: false,
        reason: "platform_not_supported",
      }
    );
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    return (await this.bridge.purchase?.(productId)) ?? { success: false, productId, reason: "platform_not_supported" };
  }

  async storageGet(key: string): Promise<string | null> {
    if (this.bridge.storageGet) return this.bridge.storageGet(key);
    return this.mem.get(key) ?? null;
  }

  async storageSet(key: string, value: string): Promise<void> {
    if (this.bridge.storageSet) {
      await this.bridge.storageSet(key, value);
      return;
    }
    this.mem.set(key, value);
  }

  haptic(kind: "light" | "medium" | "heavy"): void {
    this.bridge.haptic?.(kind);
  }

  async trackAnalyticsEvent(event: PlatformAnalyticsEvent): Promise<void> {
    await this.bridge.trackAnalyticsEvent?.(event);
  }
}
