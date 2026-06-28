import type {
  IPlatformAdapter,
  AuthResult,
  AdResult,
  PurchaseResult,
} from "./PlatformAdapter";

// 로컬 개발용 noop 어댑터 (implementation-plan §6). Apps in Toss/Play는 LATER.
// storage는 localStorage 백킹(브라우저), 없으면 메모리.

export class WebStubAdapter implements IPlatformAdapter {
  private mem = new Map<string, string>();

  async login(): Promise<AuthResult> {
    return { userId: "local-dev", provider: "web-stub" };
  }

  async showRewardedAd(): Promise<AdResult> {
    return { shown: false, rewarded: false };
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    return { success: false, productId };
  }

  async storageGet(key: string): Promise<string | null> {
    try {
      if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    } catch {
      // localStorage 접근 실패 시 메모리 폴백
    }
    return this.mem.get(key) ?? null;
  }

  async storageSet(key: string, value: string): Promise<void> {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
        return;
      }
    } catch {
      // 폴백
    }
    this.mem.set(key, value);
  }

  haptic(_kind: "light" | "medium" | "heavy"): void {
    // noop — Apps in Toss haptics 어댑터에서 구현
  }
}
