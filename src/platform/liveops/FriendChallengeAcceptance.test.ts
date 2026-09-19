import { describe, expect, it } from "vitest";
import { claimFriendChallenge } from "../../../supabase/functions/_shared/FriendChallengeAcceptance";

describe("claimFriendChallenge", () => {
  it("returns not accepted for a deterministic second claim race", async () => {
    const rpcResults: Array<{ id: string; status: "accepted" } | null> = [
      { id: "challenge-1", status: "accepted" },
      null,
    ];
    const conditionalClaim = async () => rpcResults.shift() ?? null;

    await expect(claimFriendChallenge(conditionalClaim)).resolves.toEqual({ ok: true, challengeId: "challenge-1" });
    await expect(claimFriendChallenge(conditionalClaim)).resolves.toEqual({ ok: false, reason: "challenge_already_accepted" });
  });
});
