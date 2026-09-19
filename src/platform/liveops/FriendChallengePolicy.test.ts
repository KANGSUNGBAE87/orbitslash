import { describe, expect, it } from "vitest";
import {
  FRIEND_CHALLENGE_MAX_TTL_MS,
  FRIEND_CHALLENGE_MIN_TTL_MS,
  evaluateFriendChallengeAcceptability,
  resolveConditionalClaimFailure,
  resolveFriendChallengeStatus,
  validateFriendChallengeRequestedExpiry,
} from "../../../supabase/functions/_shared/FriendChallengePolicy";

const nowMs = Date.UTC(2026, 6, 11, 0, 0, 0);
const activeExpiry = new Date(nowMs + 60 * 60 * 1000).toISOString();

describe("friend challenge policy", () => {
  it("rejects a creator accepting their own challenge before any result write", () => {
    expect(evaluateFriendChallengeAcceptability({
      ownerCoreUserId: "creator-1",
      acceptingCoreUserId: "creator-1",
      status: "open",
      expiresAt: activeExpiry,
      nowMs,
    })).toEqual({ ok: false, reason: "challenge_owner_cannot_accept" });
  });

  it("bounds requested challenge TTL to seven days from server time", () => {
    expect(FRIEND_CHALLENGE_MAX_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(FRIEND_CHALLENGE_MIN_TTL_MS).toBe(60 * 1000);
    expect(validateFriendChallengeRequestedExpiry(new Date(nowMs + FRIEND_CHALLENGE_MIN_TTL_MS - 1).toISOString(), nowMs)).toEqual({
      ok: false,
      reason: "challenge_expiry_too_soon",
    });
    expect(validateFriendChallengeRequestedExpiry(new Date(nowMs + FRIEND_CHALLENGE_MAX_TTL_MS + 1).toISOString(), nowMs)).toEqual({
      ok: false,
      reason: "challenge_expiry_too_far",
    });
  });

  it("maps a zero-row conditional update to expiry or already-accepted deterministically", () => {
    expect(resolveConditionalClaimFailure(new Date(nowMs - 1).toISOString(), nowMs)).toEqual("challenge_expired");
    expect(resolveConditionalClaimFailure(activeExpiry, nowMs)).toEqual("challenge_already_accepted");
  });

  it("never exposes a past open row as active in a list", () => {
    expect(resolveFriendChallengeStatus("open", new Date(nowMs - 1).toISOString(), nowMs)).toBe("expired");
    expect(resolveFriendChallengeStatus("open", activeExpiry, nowMs)).toBe("open");
  });
});
