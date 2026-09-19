import {
  SafeAreaInsets,
  Storage,
  generateHapticFeedback,
  getOperationalEnvironment,
} from "@apps-in-toss/web-framework";
import type {
  AdResult,
  PlatformAnalyticsEvent,
  PurchaseResult,
  RewardedAdCapability,
  SafeAreaInsets as PlatformSafeAreaInsets,
} from "../PlatformAdapter";
import type { AppsInTossRuntimeHints } from "../AppsInTossAdapter";

export type AppsInTossLifecycleEvent = "background" | "foreground";

export interface AppsInTossVerifiedSession {
  /** Internal identifier resolved by the server after Apps in Toss proof verification. */
  internalUserId: string;
  /** Server-issued app session token; never a provider identifier or auth code. */
  accessToken: string;
}

export interface RewardedAdCallbacks {
  onRewardEarned(): void;
  onDismissed(): void;
  onFailedToShow?(): void;
}

/**
 * The only low-level contract that knows about Apps in Toss APIs. In production
 * `getVerifiedSession` is provided by the server-exchange integration; raw
 * authorization codes never leave this boundary or enter shared game state.
 */
export interface AppsInTossSdkRuntime {
  isAvailable(): boolean;
  getVerifiedSession?(): Promise<AppsInTossVerifiedSession | null>;
  runtimeHints?(): AppsInTossRuntimeHints;
  storageGet?(key: string): Promise<string | null>;
  storageSet?(key: string, value: string): Promise<void>;
  haptic?(kind: "light" | "medium" | "heavy"): void;
  safeAreaInsets?(): PlatformSafeAreaInsets;
  subscribeLifecycle?(listener: (event: AppsInTossLifecycleEvent) => void): () => void;
  rewardedAdCapability?(): Promise<RewardedAdCapability>;
  showRewardedAd?(callbacks: RewardedAdCallbacks): Promise<void>;
}

export interface AppsInTossBridgeContract {
  login?: () => Promise<{ internalUserId: string } | undefined>;
  getVerifiedSessionAccessToken?: () => Promise<string | null>;
  runtimeHints?: () => AppsInTossRuntimeHints;
  rewardedAdCapability?: () => Promise<RewardedAdCapability>;
  showRewardedAd?: () => Promise<AdResult>;
  purchase?: (productId: string) => Promise<PurchaseResult>;
  storageGet?: (key: string) => Promise<string | null>;
  storageSet?: (key: string, value: string) => Promise<void>;
  haptic?: (kind: "light" | "medium" | "heavy") => void;
  safeAreaInsets?: () => Promise<PlatformSafeAreaInsets>;
  subscribeLifecycle?: (listener: (event: AppsInTossLifecycleEvent) => void) => Promise<() => Promise<void>>;
  trackAnalyticsEvent?: (event: PlatformAnalyticsEvent) => Promise<void>;
}

const ZERO_INSETS: PlatformSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export class AppsInTossBridge implements AppsInTossBridgeContract {
  constructor(private readonly runtime: AppsInTossSdkRuntime = createSdkRuntime()) {}

  async login(): Promise<{ internalUserId: string } | undefined> {
    const session = await this.verifiedSession();
    return session ? { internalUserId: session.internalUserId } : undefined;
  }

  async getVerifiedSessionAccessToken(): Promise<string | null> {
    return (await this.verifiedSession())?.accessToken ?? null;
  }

  runtimeHints(): AppsInTossRuntimeHints {
    return this.runtime.runtimeHints?.() ?? browserRuntimeHints();
  }

  async rewardedAdCapability(): Promise<RewardedAdCapability> {
    if (!this.runtime.isAvailable()) return { supported: false, reason: "platform_not_supported" };
    return (await this.runtime.rewardedAdCapability?.()) ?? { supported: false, reason: "platform_not_supported" };
  }

  async showRewardedAd(): Promise<AdResult> {
    if (!this.runtime.isAvailable() || !this.runtime.showRewardedAd) return unsupportedAdResult();

    let rewardEarned = false;
    let dismissed = false;
    let failedToShow = false;
    try {
      await (this.runtime.showRewardedAd?.({
          onRewardEarned: () => {
            rewardEarned = true;
          },
          onDismissed: () => {
            dismissed = true;
          },
          onFailedToShow: () => {
            failedToShow = true;
          },
        }) ?? Promise.resolve());
    } catch {
      failedToShow = true;
    }

    if (failedToShow) {
      return { shown: false, rewarded: false, rewardEarned: false, dismissed: false, reason: "show_failed" };
    }
    if (!dismissed) {
      return { shown: true, rewarded: rewardEarned, rewardEarned, dismissed: false };
    }
    return rewardEarned
      ? { shown: true, rewarded: true, rewardEarned: true, dismissed: true }
      : { shown: true, rewarded: false, rewardEarned: false, dismissed: true, reason: "dismissed_without_reward" };
  }

  async storageGet(key: string): Promise<string | null> {
    if (!this.runtime.isAvailable()) return null;
    return this.runtime.storageGet?.(key) ?? null;
  }

  async storageSet(key: string, value: string): Promise<void> {
    if (!this.runtime.isAvailable()) return;
    await this.runtime.storageSet?.(key, value);
  }

  haptic(kind: "light" | "medium" | "heavy"): void {
    if (this.runtime.isAvailable()) this.runtime.haptic?.(kind);
  }

  async safeAreaInsets(): Promise<PlatformSafeAreaInsets> {
    return this.runtime.isAvailable() ? this.runtime.safeAreaInsets?.() ?? ZERO_INSETS : ZERO_INSETS;
  }

  async subscribeLifecycle(listener: (event: AppsInTossLifecycleEvent) => void): Promise<() => Promise<void>> {
    if (!this.runtime.isAvailable()) return async () => undefined;
    const unsubscribe = this.runtime.subscribeLifecycle?.(listener);
    return async () => unsubscribe?.();
  }

  async trackAnalyticsEvent(_event: PlatformAnalyticsEvent): Promise<void> {
    // Analytics stays on the existing server-backed ProductTelemetry boundary.
  }

  private async verifiedSession(): Promise<AppsInTossVerifiedSession | null> {
    if (!this.runtime.isAvailable()) return null;
    const session = await this.runtime.getVerifiedSession?.();
    if (!session?.internalUserId.trim() || !session.accessToken.trim()) return null;
    return session;
  }
}

/** Detects only safe Apps in Toss capabilities. Identity remains anonymous until a server exchange is wired. */
export function detectAppsInTossBridge(): AppsInTossBridge | undefined {
  const runtime = createSdkRuntime();
  return runtime.isAvailable() ? new AppsInTossBridge(runtime) : undefined;
}

function createSdkRuntime(): AppsInTossSdkRuntime {
  return {
    isAvailable: () => {
      const candidate = typeof window === "undefined" ? undefined : (window as unknown as { ReactNativeWebView?: unknown });
      return Boolean(candidate?.ReactNativeWebView);
    },
    runtimeHints: () => ({
      ...browserRuntimeHints(),
      operationalEnvironment: safeOperationalEnvironment(),
      deploymentId: safeDeploymentId(),
    }),
    storageGet: (key) => Storage.getItem(key),
    storageSet: (key, value) => Storage.setItem(key, value),
    haptic: (kind) => {
      void generateHapticFeedback({ type: hapticTypeFor(kind) });
    },
    safeAreaInsets: () => normalizeInsets(SafeAreaInsets.get()),
    subscribeLifecycle: (listener) => subscribeBrowserLifecycle(listener),
  };
}

function unsupportedAdResult(): AdResult {
  return { shown: false, rewarded: false, rewardEarned: false, dismissed: false, reason: "platform_not_supported" };
}

function browserRuntimeHints(): AppsInTossRuntimeHints {
  if (typeof window === "undefined") return {};
  return {
    href: window.location.href,
    protocol: window.location.protocol,
    host: window.location.host,
    search: window.location.search,
  };
}

function safeOperationalEnvironment(): string | undefined {
  try {
    return getOperationalEnvironment();
  } catch {
    return undefined;
  }
}

function safeDeploymentId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const search = new URLSearchParams(window.location.search);
  return search.get("_deploymentId") ?? undefined;
}

function normalizeInsets(insets: unknown): PlatformSafeAreaInsets {
  const value = insets as Partial<PlatformSafeAreaInsets> | undefined;
  return {
    top: finiteInset(value?.top),
    right: finiteInset(value?.right),
    bottom: finiteInset(value?.bottom),
    left: finiteInset(value?.left),
  };
}

function finiteInset(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(200, value)) : 0;
}

function hapticTypeFor(kind: "light" | "medium" | "heavy"): "tickWeak" | "basicMedium" | "success" {
  if (kind === "light") return "tickWeak";
  if (kind === "medium") return "basicMedium";
  return "success";
}

function subscribeBrowserLifecycle(listener: (event: AppsInTossLifecycleEvent) => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  const onVisibilityChange = () => listener(document.visibilityState === "hidden" ? "background" : "foreground");
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => document.removeEventListener("visibilitychange", onVisibilityChange);
}
