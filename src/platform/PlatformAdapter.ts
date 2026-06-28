// 플랫폼 어댑터 경계 (implementation-plan §6, CLAUDE.md app platform 규칙).
// product/domain 로직이 Apps in Toss / Google Play SDK를 직접 import 하지 않도록
// login/ads/iap/storage/haptics를 추상화한다.
// TODO(Phase B+): AppsInTossAdapter / GooglePlayAdapter 구현. Phase 1은 WebStubAdapter.

export interface AuthResult {
  userId: string;
  provider: string;
}

export interface AdResult {
  shown: boolean;
  rewarded: boolean;
}

export interface PurchaseResult {
  success: boolean;
  productId: string;
}

export interface IPlatformAdapter {
  login(): Promise<AuthResult>;
  showRewardedAd(): Promise<AdResult>;
  purchase(productId: string): Promise<PurchaseResult>;
  storageGet(key: string): Promise<string | null>;
  storageSet(key: string, value: string): Promise<void>;
  haptic(kind: "light" | "medium" | "heavy"): void;
}
