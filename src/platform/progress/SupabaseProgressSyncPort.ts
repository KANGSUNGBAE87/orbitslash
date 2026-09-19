import type { CloudProgressSyncPort } from "./CloudProgressRepository";

type FetchFn = typeof fetch;

/** Public-anon client for the progress Edge Function. Identity is only asserted by its auth token server-side. */
export class SupabaseProgressSyncPort implements CloudProgressSyncPort {
  constructor(
    private readonly endpointUrl: string,
    private readonly anonKey: string,
    private readonly fetchFn: FetchFn = fetch,
    private readonly accessToken?: string,
    private readonly accessTokenProvider?: () => Promise<string | null>,
  ) {}

  async sync(input: Parameters<CloudProgressSyncPort["sync"]>[0]): ReturnType<CloudProgressSyncPort["sync"]> {
    const issuedToken = await this.accessTokenProvider?.();
    const authorizationToken = typeof issuedToken === "string" && issuedToken.trim().length > 0 ? issuedToken : this.accessToken ?? this.anonKey;
    const response = await this.fetchFn(this.endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: this.anonKey, Authorization: `Bearer ${authorizationToken}` },
      body: JSON.stringify({
        action: "sync",
        snapshot: input.snapshot,
        mutations: input.mutations.map(({ id, type, createdAt }) => ({ id, type, createdAt })),
      }),
    });
    const body = await response.json() as { ok?: boolean; reason?: string; snapshot?: unknown; acknowledgedMutationIds?: unknown };
    if (!response.ok || body.ok !== true || !body.snapshot || !Array.isArray(body.acknowledgedMutationIds)) {
      throw new Error(body.reason ?? "progress_sync_failed");
    }
    return { snapshot: body.snapshot as Awaited<ReturnType<CloudProgressSyncPort["sync"]>>["snapshot"], acknowledgedMutationIds: body.acknowledgedMutationIds.filter((id): id is string => typeof id === "string") };
  }
}
