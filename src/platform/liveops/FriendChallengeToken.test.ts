import { describe, expect, it } from "vitest";
import { opaqueChallengeTokenLookupKey } from "../../../supabase/functions/_shared/FriendChallengeToken";

describe("opaque challenge token lookup", () => {
  it("cannot look up a server-stored challenge after any token change", async () => {
    const token = "osc1_server_random_8vF9lJ3qQx2YpK7mN4tR6wZaBcDeFgHi";
    const changed = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;
    const stored = new Map([[await opaqueChallengeTokenLookupKey(token), { id: "challenge-1" }]]);

    expect(stored.get(await opaqueChallengeTokenLookupKey(token))).toEqual({ id: "challenge-1" });
    expect(stored.get(await opaqueChallengeTokenLookupKey(changed))).toBeUndefined();
  });
});
