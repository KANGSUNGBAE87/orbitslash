// Server issuance window: at least one minute for a client to start, at most seven days to bound pending rows.
export const FRIEND_CHALLENGE_MIN_TTL_MS = 60 * 1000;
export const FRIEND_CHALLENGE_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type FriendChallengeStatus = "open" | "accepted" | "expired";
export type FriendChallengeAcceptReason = "challenge_owner_cannot_accept" | "challenge_expired" | "challenge_already_accepted";

export function validateFriendChallengeRequestedExpiry(expiresAt: string, nowMs: number): { ok: true } | { ok: false; reason: "challenge_expiry_too_soon" | "challenge_expiry_too_far" } {
  const expiryMs = Date.parse(expiresAt);
  if (expiryMs < nowMs + FRIEND_CHALLENGE_MIN_TTL_MS) return { ok: false, reason: "challenge_expiry_too_soon" };
  if (expiryMs > nowMs + FRIEND_CHALLENGE_MAX_TTL_MS) return { ok: false, reason: "challenge_expiry_too_far" };
  return { ok: true };
}

export function evaluateFriendChallengeAcceptability(input: {
  ownerCoreUserId: string;
  acceptingCoreUserId: string;
  status: FriendChallengeStatus;
  expiresAt: string;
  nowMs: number;
}): { ok: true } | { ok: false; reason: FriendChallengeAcceptReason } {
  if (input.ownerCoreUserId === input.acceptingCoreUserId) return { ok: false, reason: "challenge_owner_cannot_accept" };
  if (resolveFriendChallengeStatus(input.status, input.expiresAt, input.nowMs) === "expired") return { ok: false, reason: "challenge_expired" };
  if (input.status !== "open") return { ok: false, reason: "challenge_already_accepted" };
  return { ok: true };
}

export function resolveConditionalClaimFailure(expiresAt: string, nowMs: number): "challenge_expired" | "challenge_already_accepted" {
  return Date.parse(expiresAt) <= nowMs ? "challenge_expired" : "challenge_already_accepted";
}

export function resolveFriendChallengeStatus(status: FriendChallengeStatus, expiresAt: string, nowMs: number): FriendChallengeStatus {
  return status === "open" && Date.parse(expiresAt) <= nowMs ? "expired" : status;
}
