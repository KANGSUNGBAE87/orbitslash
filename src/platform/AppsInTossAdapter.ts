import type {
  AdResult,
  AuthResult,
  IPlatformAdapter,
  PlatformAnalyticsEvent,
  PlatformRuntimeChannel,
  PlatformTelemetryContext,
  PurchaseResult,
  RewardedAdCapability,
} from "./PlatformAdapter";

export interface AppsInTossRuntimeHints {
  href?: string;
  protocol?: string;
  host?: string;
  search?: string;
  deploymentId?: string;
  operationalEnvironment?: string;
  runtimeChannel?: PlatformRuntimeChannel;
}

export interface AppsInTossBridge {
  login?: () => Promise<{ internalUserId: string }>;
  runtimeHints?: () => AppsInTossRuntimeHints;
  rewardedAdCapability?: () => Promise<RewardedAdCapability>;
  showRewardedAd?: () => Promise<AdResult>;
  purchase?: (productId: string) => Promise<PurchaseResult>;
  storageGet?: (key: string) => Promise<string | null>;
  storageSet?: (key: string, value: string) => Promise<void>;
  haptic?: (kind: "light" | "medium" | "heavy") => void;
  trackAnalyticsEvent?: (event: PlatformAnalyticsEvent) => Promise<void>;
}

export class AppsInTossAdapter implements IPlatformAdapter {
  private readonly mem = new Map<string, string>();

  constructor(private readonly bridge: AppsInTossBridge = {}) {}

  async login(): Promise<AuthResult> {
    const result = await this.bridge.login?.();
    return {
      userId: result?.internalUserId ?? "apps-in-toss-anonymous",
      provider: "apps_in_toss",
    };
  }

  telemetryContext(): PlatformTelemetryContext {
    const hints = {
      ...browserRuntimeHints(),
      ...this.bridge.runtimeHints?.(),
    };
    return {
      runtime: "apps_in_toss",
      runtimeChannel: resolveAppsInTossRuntimeChannel(hints),
      operationalEnvironment: hints.operationalEnvironment,
      deploymentId: hints.deploymentId,
    };
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

export function resolveAppsInTossRuntimeChannel(hints: AppsInTossRuntimeHints = {}): PlatformRuntimeChannel {
  if (hints.runtimeChannel) return hints.runtimeChannel;

  const operationalEnvironment = hints.operationalEnvironment?.toLowerCase();
  if (operationalEnvironment === "sandbox") return "sandbox";

  const href = hints.href ?? "";
  const protocol = hints.protocol ?? "";
  const host = hints.host ?? "";
  const search = hints.search ?? "";
  if (
    href.includes("intoss-private://") ||
    protocol === "intoss-private:" ||
    /private-apps\.tossmini\.com/i.test(host) ||
    search.includes("_deploymentId=") ||
    Boolean(hints.deploymentId)
  ) {
    return "toss_private_test";
  }

  if (href.includes("intoss://") || protocol === "intoss:" || /^apps\.tossmini\.com$/i.test(host)) {
    return "toss_live";
  }

  return "sandbox";
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
