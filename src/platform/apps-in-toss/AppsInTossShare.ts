import { getTossShareLink, share as shareInAppsInToss } from "@apps-in-toss/web-framework";
import type { PlatformSharePort } from "../share/ShareService";

export interface AppsInTossShareSdk {
  getTossShareLink(path: string): Promise<string>;
  share(options: { message: string }): Promise<void>;
}
export type InviteDeepLinkBuilder = (inviteCode: string) => string | Promise<string>;

export function createAppsInTossSharePort(
  sdk: AppsInTossShareSdk = { getTossShareLink, share: shareInAppsInToss },
  builder?: InviteDeepLinkBuilder,
): PlatformSharePort {
  return {
    getShareLink: async (inviteCode) => sdk.getTossShareLink(await resolveDeepLink(inviteCode, builder)),
    share: (options) => sdk.share(options),
  };
}

async function resolveDeepLink(
  inviteCode: string | undefined,
  builder: InviteDeepLinkBuilder | undefined,
): Promise<string> {
  const baseDeepLink = "intoss://orbitslash";
  if (inviteCode === undefined || !builder) return baseDeepLink;

  try {
    const candidate = normalizeText(await builder(inviteCode));
    return candidate && isOrbitSlashDeepLink(candidate) ? candidate : baseDeepLink;
  } catch {
    return baseDeepLink;
  }
}

function isOrbitSlashDeepLink(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return (
      url.protocol === "intoss:" &&
      url.hostname === "orbitslash" &&
      url.username === "" &&
      url.password === "" &&
      url.port === ""
    );
  } catch {
    return false;
  }
}

function normalizeText(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}
