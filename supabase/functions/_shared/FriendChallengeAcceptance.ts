export type FriendChallengeClaim = { id: string };
export type FriendChallengeClaimResult = { ok: true; challengeId: string } | { ok: false; reason: "challenge_already_accepted" };

/** Converts a database conditional-update result into the only safe accept outcome. */
export async function claimFriendChallenge(claim: () => Promise<FriendChallengeClaim | null>): Promise<FriendChallengeClaimResult> {
  const claimed = await claim();
  if (!claimed?.id) return { ok: false, reason: "challenge_already_accepted" };
  return { ok: true, challengeId: claimed.id };
}
