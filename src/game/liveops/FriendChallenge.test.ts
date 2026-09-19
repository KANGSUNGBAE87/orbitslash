import { describe, expect, it } from "vitest";
import { createFriendChallenge, validateFriendChallenge } from "./FriendChallenge";

const input = {
  seed: 34199,
  difficulty: "elite",
  rulesHash: "ranked-rules-20260711",
  rulesVersion: 4,
  configVersion: "remote-balance-1",
  expiresAt: "2026-08-01T00:00:00.000Z",
};

describe("FriendChallenge", () => {
  it("models a server-issued opaque token separately from the pinned challenge contract", () => {
    const opaqueToken = "osc1_server_random_8vF9lJ3qQx2YpK7mN4tR6wZaBcDeFgHi";
    const first = createFriendChallenge(input, () => opaqueToken);
    const second = createFriendChallenge(input, () => opaqueToken);

    expect(first).toEqual(second);
    expect(first).toMatchObject(input);
    expect(first.token).toBe(opaqueToken);
    for (const privateContractValue of [String(input.seed), input.difficulty, input.rulesHash, input.configVersion, input.expiresAt]) {
      expect(first.token).not.toContain(privateContractValue);
    }
  });

  it("validates server-stored contract without attempting to decode the opaque token", () => {
    const challenge = createFriendChallenge(input, () => "osc1_server_random_8vF9lJ3qQx2YpK7mN4tR6wZaBcDeFgHi");
    const tampered = `${challenge.token.slice(0, -1)}${challenge.token.endsWith("0") ? "1" : "0"}`;

    expect(validateFriendChallenge({ ...challenge, token: tampered }, {
      now: new Date("2026-07-15T00:00:00.000Z"),
      rulesHash: input.rulesHash,
      rulesVersion: input.rulesVersion,
      configVersion: input.configVersion,
    })).toEqual({ ok: true, challenge: { ...challenge, token: tampered } });
  });

  it("rejects expiry and incompatible rule or config contracts", () => {
    const challenge = createFriendChallenge(input, () => "osc1_server_random_8vF9lJ3qQx2YpK7mN4tR6wZaBcDeFgHi");

    expect(validateFriendChallenge(challenge, {
      now: new Date("2026-08-01T00:00:00.000Z"),
      rulesHash: input.rulesHash,
      rulesVersion: input.rulesVersion,
      configVersion: input.configVersion,
    })).toEqual({ ok: false, reason: "challenge_expired" });
    expect(validateFriendChallenge(challenge, {
      now: new Date("2026-07-15T00:00:00.000Z"),
      rulesHash: "other-rules",
      rulesVersion: input.rulesVersion,
      configVersion: input.configVersion,
    })).toEqual({ ok: false, reason: "rules_hash_mismatch" });
    expect(validateFriendChallenge(challenge, {
      now: new Date("2026-07-15T00:00:00.000Z"),
      rulesHash: input.rulesHash,
      rulesVersion: input.rulesVersion + 1,
      configVersion: input.configVersion,
    })).toEqual({ ok: false, reason: "rules_version_mismatch" });
    expect(validateFriendChallenge(challenge, {
      now: new Date("2026-07-15T00:00:00.000Z"),
      rulesHash: input.rulesHash,
      rulesVersion: input.rulesVersion,
      configVersion: "other-config",
    })).toEqual({ ok: false, reason: "config_version_mismatch" });
  });
});
