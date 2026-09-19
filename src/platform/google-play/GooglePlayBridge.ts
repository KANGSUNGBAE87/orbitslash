import { Capacitor, registerPlugin } from "@capacitor/core";
import type {
  AdResult,
  PlatformAnalyticsEvent,
  PurchaseRestoreResult,
  PurchaseResult,
  RewardedAdCapability,
  SafeAreaInsets,
} from "../PlatformAdapter";

export type GooglePlayLifecycleEvent = "background" | "foreground";

type NativeSessionResult =
  | { status: "linked"; accessToken: string }
  | { status: "anonymous" | "unsupported" };

type NativePurchaseResult = {
  productId: string;
  state: "pending_verification" | "unsupported" | "cancelled" | "failed";
};

type NativeRestoreResult = {
  supported: boolean;
  productIds: string[];
};

type NativeSafeAreaInsets = Partial<SafeAreaInsets>;

export interface NativeGooglePlayPlugin {
  getVerifiedSession?: () => Promise<NativeSessionResult>;
  rewardedAdCapability?: () => Promise<RewardedAdCapability>;
  showRewardedAd?: () => Promise<AdResult>;
  purchase?: (input: { productId: string }) => Promise<NativePurchaseResult>;
  restorePurchases?: () => Promise<NativeRestoreResult>;
  storageGet?: (input: { key: string }) => Promise<{ value: string | null }>;
  storageSet?: (input: { key: string; value: string }) => Promise<void>;
  haptic?: (input: { kind: "light" | "medium" | "heavy" }) => Promise<void>;
  getSafeAreaInsets?: () => Promise<NativeSafeAreaInsets>;
  addListener?: (
    eventName: "lifecycle",
    listener: (event: { state?: string }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
}

export interface GooglePlayBridgeRuntime {
  isNativePlatform(): boolean;
  getPlugin(): NativeGooglePlayPlugin | undefined;
}

export interface GooglePlayBridgeContract {
  login?: () => Promise<{ internalUserId: string }>;
  getVerifiedSessionAccessToken?: () => Promise<string | null>;
  rewardedAdCapability?: () => Promise<RewardedAdCapability>;
  showRewardedAd?: () => Promise<AdResult>;
  purchase?: (productId: string) => Promise<PurchaseResult>;
  restorePurchases?: () => Promise<PurchaseRestoreResult>;
  storageGet?: (key: string) => Promise<string | null>;
  storageSet?: (key: string, value: string) => Promise<void>;
  haptic?: (kind: "light" | "medium" | "heavy") => void;
  safeAreaInsets?: () => Promise<SafeAreaInsets>;
  subscribeLifecycle?: (listener: (event: GooglePlayLifecycleEvent) => void) => Promise<() => Promise<void>>;
  trackAnalyticsEvent?: (event: PlatformAnalyticsEvent) => Promise<void>;
}

const ZERO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const SAFE_PRODUCT_ID = /^[a-zA-Z0-9._-]{1,128}$/;
const nativeGooglePlayPlugin = registerPlugin<NativeGooglePlayPlugin>("OrbitSlashGooglePlay");

/**
 * Capacitor boundary for the Google Play Android host. It carries only a
 * server-issued session token and verification-pending purchase state; raw
 * Google credentials and store receipts never cross into shared web code.
 */
export class GooglePlayBridge implements GooglePlayBridgeContract {
  constructor(private readonly runtime: GooglePlayBridgeRuntime = capacitorRuntime()) {}

  async getVerifiedSessionAccessToken(): Promise<string | null> {
    const session = await this.plugin()?.getVerifiedSession?.();
    return session?.status === "linked" && session.accessToken.trim() ? session.accessToken : null;
  }

  async rewardedAdCapability(): Promise<RewardedAdCapability> {
    return (await this.plugin()?.rewardedAdCapability?.()) ?? { supported: false, reason: "platform_not_supported" };
  }

  async showRewardedAd(): Promise<AdResult> {
    return (
      (await this.plugin()?.showRewardedAd?.()) ?? {
        shown: false,
        rewarded: false,
        rewardEarned: false,
        dismissed: false,
        reason: "platform_not_supported",
      }
    );
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    if (!SAFE_PRODUCT_ID.test(productId)) return { success: false, productId, reason: "purchase_failed" };
    const result = await this.plugin()?.purchase?.({ productId });
    if (!result || result.productId !== productId || result.state === "unsupported") {
      return { success: false, productId, reason: "platform_not_supported" };
    }
    if (result.state === "cancelled") return { success: false, productId, reason: "cancelled" };
    if (result.state === "pending_verification") return { success: false, productId, reason: "verification_required" };
    return { success: false, productId, reason: "purchase_failed" };
  }

  async restorePurchases(): Promise<PurchaseRestoreResult> {
    const result = await this.plugin()?.restorePurchases?.();
    if (!result?.supported) return { supported: false, productIds: [] };
    return { supported: true, productIds: result.productIds.filter((productId) => SAFE_PRODUCT_ID.test(productId)) };
  }

  async storageGet(key: string): Promise<string | null> {
    return (await this.plugin()?.storageGet?.({ key }))?.value ?? null;
  }

  async storageSet(key: string, value: string): Promise<void> {
    await this.plugin()?.storageSet?.({ key, value });
  }

  haptic(kind: "light" | "medium" | "heavy"): void {
    void this.plugin()?.haptic?.({ kind });
  }

  async safeAreaInsets(): Promise<SafeAreaInsets> {
    const insets = await this.plugin()?.getSafeAreaInsets?.();
    if (!insets) return ZERO_INSETS;
    return {
      top: finiteInset(insets.top),
      right: finiteInset(insets.right),
      bottom: finiteInset(insets.bottom),
      left: finiteInset(insets.left),
    };
  }

  async subscribeLifecycle(listener: (event: GooglePlayLifecycleEvent) => void): Promise<() => Promise<void>> {
    const plugin = this.plugin();
    if (!plugin?.addListener) return async () => undefined;
    const handle = await plugin.addListener("lifecycle", (event) => {
      if (event.state === "background" || event.state === "foreground") listener(event.state);
    });
    return () => handle.remove();
  }

  async trackAnalyticsEvent(_event: PlatformAnalyticsEvent): Promise<void> {
    // Product telemetry is routed through the existing server-backed adapter.
    // This native shell intentionally has no direct analytics SDK write path.
  }

  private plugin(): NativeGooglePlayPlugin | undefined {
    return this.runtime.isNativePlatform() ? this.runtime.getPlugin() : undefined;
  }
}

export function detectGooglePlayBridge(): GooglePlayBridge | undefined {
  const runtime = capacitorRuntime();
  return runtime.isNativePlatform() && runtime.getPlugin() ? new GooglePlayBridge(runtime) : undefined;
}

function capacitorRuntime(): GooglePlayBridgeRuntime {
  return {
    isNativePlatform: () => Capacitor.isNativePlatform(),
    getPlugin: () => (Capacitor.isPluginAvailable("OrbitSlashGooglePlay") ? nativeGooglePlayPlugin : undefined),
  };
}

function finiteInset(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(200, value)) : 0;
}
