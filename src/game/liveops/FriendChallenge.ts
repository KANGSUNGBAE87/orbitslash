export interface FriendChallengeContract {
  seed: number;
  difficulty: string;
  rulesHash: string;
  rulesVersion: number;
  configVersion: string;
  expiresAt: string;
}

/** A token is issued by the Edge Function; the client never derives it from a contract. */
export interface FriendChallenge extends FriendChallengeContract {
  token: string;
}

export interface FriendChallengeValidationOptions {
  now: Date;
  rulesHash: string;
  rulesVersion: number;
  configVersion: string;
}

export type FriendChallengeValidation =
  | { ok: true; challenge: FriendChallenge }
  | { ok: false; reason: "contract_invalid" | "challenge_expired" | "rules_hash_mismatch" | "rules_version_mismatch" | "config_version_mismatch" };

/**
 * Test/model helper only. Production receives the opaque token from the Edge
 * create response; it must not be generated or decoded on the client.
 */
export function createFriendChallenge(input: FriendChallengeContract, issueOpaqueToken: () => string): FriendChallenge {
  const contract = parseContract(input);
  const token = issueOpaqueToken();
  if (!contract || !isOpaqueToken(token)) throw new TypeError("friend_challenge_contract_invalid");
  return { ...contract, token };
}

/** Validates only the server-stored/pinned contract. Token lookup belongs to the Edge Function. */
export function validateFriendChallenge(challenge: FriendChallenge, options: FriendChallengeValidationOptions): FriendChallengeValidation {
  const contract = parseContract(challenge);
  if (!contract || !isOpaqueToken(challenge.token)) return { ok: false, reason: "contract_invalid" };
  const nowMs = options.now.getTime();
  if (!Number.isFinite(nowMs) || nowMs >= Date.parse(contract.expiresAt)) return { ok: false, reason: "challenge_expired" };
  if (contract.rulesHash !== options.rulesHash) return { ok: false, reason: "rules_hash_mismatch" };
  if (contract.rulesVersion !== options.rulesVersion) return { ok: false, reason: "rules_version_mismatch" };
  if (contract.configVersion !== options.configVersion) return { ok: false, reason: "config_version_mismatch" };
  return { ok: true, challenge };
}

function parseContract(value: unknown): FriendChallengeContract | null {
  if (!isRecord(value)) return null;
  const seed = value.seed;
  const difficulty = shortText(value.difficulty);
  const rulesHash = shortText(value.rulesHash);
  const configVersion = shortText(value.configVersion);
  const expiresAt = canonicalIso(value.expiresAt);
  const rulesVersion = value.rulesVersion;
  if (typeof seed !== "number" || !Number.isSafeInteger(seed) || seed < 0 || !difficulty || !rulesHash || !configVersion || !expiresAt) return null;
  if (typeof rulesVersion !== "number" || !Number.isInteger(rulesVersion) || rulesVersion < 1 || rulesVersion > 1000) return null;
  return { seed, difficulty, rulesHash, rulesVersion, configVersion, expiresAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shortText(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9._-]{1,160}$/.test(value) ? value : null;
}

function canonicalIso(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
}

function isOpaqueToken(value: unknown): value is string {
  return typeof value === "string" && /^osc1_[A-Za-z0-9_-]{24,}$/.test(value);
}
