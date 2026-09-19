export interface ShareRequest {
  message: string;
  title?: string;
  webUrl: string;
  inviteCode?: string;
}

export type ShareResult =
  | { status: "shared"; method: "apps_in_toss" | "native" | "clipboard" }
  | { status: "cancelled" }
  | { status: "unavailable"; reason: "share_unavailable" };

interface NativeShareData {
  title?: string;
  text?: string;
  url?: string;
}

export interface PlatformSharePort {
  getShareLink(inviteCode?: string): Promise<string>;
  share(options: { message: string }): Promise<void>;
}

export interface ShareRuntime {
  appsInToss?: PlatformSharePort;
  nativeShare?: (data: NativeShareData) => Promise<void>;
  writeClipboard?: (text: string) => Promise<void>;
}

interface BrowserNavigatorLike {
  share?: (data: NativeShareData) => Promise<void>;
  clipboard?: {
    writeText(text: string): Promise<void>;
  };
}

export function createBrowserShareRuntime(
  browserNavigator: BrowserNavigatorLike | null | undefined = defaultBrowserNavigator(),
): ShareRuntime {
  return {
    nativeShare:
      typeof browserNavigator?.share === "function"
        ? (data) => browserNavigator.share!.call(browserNavigator, data)
        : undefined,
    writeClipboard:
      typeof browserNavigator?.clipboard?.writeText === "function"
        ? (text) => browserNavigator.clipboard!.writeText.call(browserNavigator.clipboard, text)
        : undefined,
  };
}

export class ShareService {
  constructor(private readonly runtime: ShareRuntime = createBrowserShareRuntime()) {}

  async share(request: ShareRequest): Promise<ShareResult> {
    if (this.runtime.appsInToss) {
      try {
        const tossLink = normalizeText(await this.runtime.appsInToss.getShareLink(request.inviteCode));
        if (!tossLink) throw new Error("empty_apps_in_toss_share_link");
        await this.runtime.appsInToss.share({ message: composeMessage(request.message, tossLink) });
        return { status: "shared", method: "apps_in_toss" };
      } catch (error) {
        if (isShareCancellation(error)) return { status: "cancelled" };
        // Continue through the browser capability fallbacks.
      }
    }

    const title = normalizeText(request.title);
    const text = normalizeText(request.message);
    const url = normalizePublicWebUrl(request.webUrl);

    if (this.runtime.nativeShare && (title || text || url)) {
      try {
        await this.runtime.nativeShare(compactNativeShareData({ title, text, url }));
        return { status: "shared", method: "native" };
      } catch (error) {
        if (isShareCancellation(error)) return { status: "cancelled" };
        // Continue to clipboard fallback.
      }
    }

    const clipboardText = composeMessage(text, url);
    if (this.runtime.writeClipboard && clipboardText) {
      try {
        await this.runtime.writeClipboard(clipboardText);
        return { status: "shared", method: "clipboard" };
      } catch {
        // Return only a stable capability failure below.
      }
    }

    return { status: "unavailable", reason: "share_unavailable" };
  }
}

function composeMessage(...pieces: unknown[]): string {
  return pieces
    .map(normalizeText)
    .filter((piece): piece is string => piece !== undefined)
    .join("\n");
}

function compactNativeShareData(data: NativeShareData): NativeShareData {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizePublicWebUrl(value: unknown): string | undefined {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:" ? normalized : undefined;
  } catch {
    return undefined;
  }
}

function defaultBrowserNavigator(): BrowserNavigatorLike | undefined {
  return typeof navigator === "undefined" ? undefined : navigator;
}

function isShareCancellation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
