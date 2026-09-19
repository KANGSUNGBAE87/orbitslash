import type { AuthResult } from "../PlatformAdapter";

export type IdentityState =
  | { status: "anonymous" }
  | { status: "loading" }
  | { status: "error"; reason: "sign_in_failed" }
  | { status: "linked"; internalUserId: string; provider: string };

const ANONYMOUS_PLATFORM_IDENTITIES = new Set([
  "google_play:google-play-anonymous",
  "apps_in_toss:apps-in-toss-anonymous",
  "web-stub:local-dev",
]);

/**
 * Product code receives only an adapter-normalized internal identifier. Provider
 * credential verification and `core_user_id` mapping stay in the server boundary.
 */
export class IdentityService {
  private state: IdentityState = { status: "anonymous" };
  private signInAttempt: Promise<IdentityState> | null = null;

  constructor(private readonly auth: Pick<AuthPort, "login" | "getVerifiedSessionAccessToken">) {}

  getState(): IdentityState {
    return this.state;
  }

  signIn(): Promise<IdentityState> {
    if (this.state.status === "linked") return Promise.resolve(this.state);
    if (this.signInAttempt) return this.signInAttempt;

    this.state = { status: "loading" };
    const attempt = this.completeSignIn();
    this.signInAttempt = attempt;
    void attempt.finally(() => {
      if (this.signInAttempt === attempt) this.signInAttempt = null;
    });
    return attempt;
  }

  private async completeSignIn(): Promise<IdentityState> {
    try {
      const result: unknown = await this.auth.login();
      const identity = normalizeAuthResult(result);
      if (!identity) {
        this.state = { status: "error", reason: "sign_in_failed" };
        return this.state;
      }
      if (ANONYMOUS_PLATFORM_IDENTITIES.has(`${identity.provider}:${identity.userId}`)) {
        this.state = { status: "anonymous" };
        return this.state;
      }
      this.state = { status: "linked", internalUserId: identity.userId, provider: identity.provider };
      return this.state;
    } catch {
      this.state = { status: "error", reason: "sign_in_failed" };
      return this.state;
    }
  }

  async getVerifiedSessionAccessToken(): Promise<string | null> {
    try {
      const token = await this.auth.getVerifiedSessionAccessToken?.();
      return typeof token === "string" && token.trim().length > 0 ? token : null;
    } catch {
      return null;
    }
  }
}

interface AuthPort {
  login(): Promise<AuthResult>;
  getVerifiedSessionAccessToken?(): Promise<string | null>;
}

function normalizeAuthResult(result: unknown): AuthResult | null {
  if (typeof result !== "object" || result === null) return null;

  const candidate = result as Record<string, unknown>;
  if (typeof candidate.userId !== "string" || typeof candidate.provider !== "string") return null;

  const userId = candidate.userId.trim();
  const provider = candidate.provider.trim();
  return userId && provider ? { userId, provider } : null;
}
