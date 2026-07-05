import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import ko from "./ko.json";
import en from "./en.json";

const dictionaries = {
  ko: ko as Record<string, string>,
  en: en as Record<string, string>,
};

const forbiddenCopyClaims: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /global\s+(leaderboard|ranking)/i, reason: "global leaderboard is not live" },
  { pattern: /world\s+(leaderboard|ranking)/i, reason: "world leaderboard is not live" },
  { pattern: /online\s+(leaderboard|ranking)/i, reason: "online leaderboard is not live" },
  { pattern: /cloud\s+sync/i, reason: "cross-device sync is not implemented" },
  { pattern: /cross-device/i, reason: "cross-device sync is not implemented" },
  { pattern: /buy\s+now|purchase\s+now|billing\s+ready/i, reason: "IAP is not live" },
  { pattern: /전세계\s*랭킹|글로벌\s*랭킹|온라인\s*랭킹/, reason: "public leaderboard is not live" },
  { pattern: /클라우드\s*동기화|기기\s*간\s*동기화/, reason: "cross-device sync is not implemented" },
  { pattern: /구매하기|결제\s*가능/, reason: "IAP is not live" },
  { pattern: /광고\s*보고\s*부활/, reason: "ad revive is not live" },
];

describe("release copy claims", () => {
  it("does not claim global ranking, live ads, IAP, or cross-device sync before those gates open", () => {
    for (const [locale, dict] of Object.entries(dictionaries)) {
      for (const [key, value] of Object.entries(dict)) {
        for (const claim of forbiddenCopyClaims) {
          expect(claim.pattern.test(value), `${locale}.${key}: ${claim.reason}`).toBe(false);
        }
      }
    }
  });

  it("keeps package metadata aligned with the current non-store-ready state", () => {
    expect(packageJson.description).toMatch(/local web playable/i);
    expect(packageJson.description).toMatch(/release prep/i);
    expect(packageJson.description).not.toMatch(/store release ready|google play-first ready|apps in toss ready/i);
  });

  it("keeps ranked and leaderboard copy explicitly gated", () => {
    expect(dictionaries.ko["mode.ranked.description"]).toMatch(/서버 검증|준비/);
    expect(dictionaries.en["mode.ranked.description"]).toMatch(/server-verified|prep/i);

    expect(dictionaries.ko["records.rankingHint"]).toMatch(/서버 검증|대기/);
    expect(dictionaries.en["records.rankingHint"]).toMatch(/server-verified|waiting/i);

    expect(dictionaries.ko["records.leaderboardLocked"]).toMatch(/잠김|검증/);
    expect(dictionaries.en["records.leaderboardLocked"]).toMatch(/locked|verified/i);

    expect(dictionaries.ko["records.leaderboardRequirement"]).toMatch(/서버 검증|계정 연결|공개/);
    expect(dictionaries.en["records.leaderboardRequirement"]).toMatch(/server validation|account-linked|public/i);
    expect(dictionaries.ko["records.leaderboardReadyHint"]).not.toMatch(/대기|준비/);
    expect(dictionaries.en["records.leaderboardReadyHint"]).not.toMatch(/waiting|prep/i);

    expect(dictionaries.ko["bossRush.detail.localRecord"]).toMatch(/랭킹 제외|로컬/);
    expect(dictionaries.en["bossRush.detail.localRecord"]).toMatch(/unranked|local/i);
  });

  it("keeps ad revive copy locked until telemetry and platform adapters are ready", () => {
    expect(dictionaries.ko["freeDefense.adRevive.locked"]).toMatch(/준비 중|텔레메트리|플랫폼/);
    expect(dictionaries.en["freeDefense.adRevive.locked"]).toMatch(/locked|telemetry|platform/i);
  });

  it("does not expose internal implementation terms in user-facing copy", () => {
    const combinedCopy = Object.values(dictionaries.ko).concat(Object.values(dictionaries.en)).join("\n");

    expect(combinedCopy).not.toMatch(/identity-bound|progress off/i);
  });
});
