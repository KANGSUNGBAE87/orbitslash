import type {
  AdResult,
  AuthResult,
  IPlatformAdapter,
  PlatformAnalyticsEvent,
  PlatformTelemetryContext,
  PurchaseRestoreResult,
  PurchaseResult,
  RewardedAdCapability,
  SafeAreaInsets,
} from "./PlatformAdapter";
import type { GooglePlayBridgeContract } from "./google-play/GooglePlayBridge";

export type GooglePlayBridge = GooglePlayBridgeContract;

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

  async getVerifiedSessionAccessToken(): Promise<string | null> {
    return this.bridge.getVerifiedSessionAccessToken?.() ?? null;
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

  async restorePurchases(): Promise<PurchaseRestoreResult> {
    return (await this.bridge.restorePurchases?.()) ?? { supported: false, productIds: [] };
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

  async safeAreaInsets(): Promise<SafeAreaInsets> {
    return (await this.bridge.safeAreaInsets?.()) ?? { top: 0, right: 0, bottom: 0, left: 0 };
  }

  async subscribeLifecycle(listener: (event: "background" | "foreground") => void): Promise<() => Promise<void>> {
    return (await this.bridge.subscribeLifecycle?.(listener)) ?? (async () => undefined);
  }

  async trackAnalyticsEvent(event: PlatformAnalyticsEvent): Promise<void> {
    await this.bridge.trackAnalyticsEvent?.(event);
  }
}
