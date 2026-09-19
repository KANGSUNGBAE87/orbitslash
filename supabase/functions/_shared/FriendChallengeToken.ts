/** SHA-256 lookup key: raw share tokens are never persisted. */
export async function opaqueChallengeTokenLookupKey(token: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
