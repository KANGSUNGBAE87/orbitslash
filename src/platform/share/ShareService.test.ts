import { describe, expect, it, vi } from "vitest";
import { createBrowserShareRuntime, ShareService, type ShareRuntime } from "./ShareService";

import { createAppsInTossSharePort, type AppsInTossShareSdk, type InviteDeepLinkBuilder } from "../apps-in-toss/AppsInTossShare";

const request = {
  message: "오빗 슬래시를 함께 플레이해요!",
  title: "Orbit Slash",
  webUrl: "https://orbitslash.example/play",
};

function createRuntime(overrides: Partial<Omit<ShareRuntime, "appsInToss">> & {
  appsInToss?: AppsInTossShareSdk;
  inviteDeepLinkBuilder?: InviteDeepLinkBuilder;
} = {}): ShareRuntime {
  const sdk = overrides.appsInToss ?? {
    getTossShareLink: vi.fn(async () => "https://toss.im/share/orbitslash"),
    share: vi.fn(async () => undefined),
  };
  return {
    nativeShare: vi.fn(async () => undefined),
    writeClipboard: vi.fn(async () => undefined),
    ...overrides,
    appsInToss: createAppsInTossSharePort(sdk, overrides.inviteDeepLinkBuilder),
  };
}

describe("ShareService", () => {
  it("uses Apps in Toss first with the default deep link and composed localized message", async () => {
    const order: string[] = [];
    const getTossShareLink = vi.fn(async (path: string) => {
      order.push(`link:${path}`);
      return "https://toss.im/share/orbitslash";
    });
    const appsShare = vi.fn(async ({ message }: { message: string }) => {
      order.push(`share:${message}`);
    });
    const nativeShare = vi.fn(async () => undefined);
    const writeClipboard = vi.fn(async () => undefined);
    const service = new ShareService(
      createRuntime({ appsInToss: { getTossShareLink, share: appsShare }, nativeShare, writeClipboard }),
    );

    await expect(service.share(request)).resolves.toEqual({ status: "shared", method: "apps_in_toss" });
    expect(order).toEqual([
      "link:intoss://orbitslash",
      "share:오빗 슬래시를 함께 플레이해요!\nhttps://toss.im/share/orbitslash",
    ]);
    expect(getTossShareLink).toHaveBeenCalledWith("intoss://orbitslash");
    expect(appsShare).toHaveBeenCalledWith({
      message: "오빗 슬래시를 함께 플레이해요!\nhttps://toss.im/share/orbitslash",
    });
    expect(nativeShare).not.toHaveBeenCalled();
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it("falls back to native share when Apps in Toss link creation fails", async () => {
    const nativeShare = vi.fn(async () => undefined);
    const writeClipboard = vi.fn(async () => undefined);
    const service = new ShareService(
      createRuntime({
        appsInToss: {
          getTossShareLink: vi.fn(async () => {
            throw new Error("raw Apps in Toss failure");
          }),
          share: vi.fn(async () => undefined),
        },
        nativeShare,
        writeClipboard,
      }),
    );

    await expect(service.share(request)).resolves.toEqual({ status: "shared", method: "native" });
    expect(nativeShare).toHaveBeenCalledWith({
      title: "Orbit Slash",
      text: "오빗 슬래시를 함께 플레이해요!",
      url: "https://orbitslash.example/play",
    });
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it("falls back when Apps in Toss returns an empty share link", async () => {
    const appsShare = vi.fn(async () => undefined);
    const nativeShare = vi.fn(async () => undefined);
    const service = new ShareService(
      createRuntime({
        appsInToss: {
          getTossShareLink: vi.fn(async () => "   "),
          share: appsShare,
        },
        nativeShare,
      }),
    );

    await expect(service.share(request)).resolves.toEqual({ status: "shared", method: "native" });
    expect(appsShare).not.toHaveBeenCalled();
    expect(nativeShare).toHaveBeenCalledOnce();
  });

  it("falls back when an Apps in Toss SDK call throws synchronously", async () => {
    const nativeShare = vi.fn(async () => undefined);
    const service = new ShareService(
      createRuntime({
        appsInToss: {
          getTossShareLink: vi.fn(() => {
            throw new Error("synchronous SDK failure");
          }),
          share: vi.fn(async () => undefined),
        },
        nativeShare,
      }),
    );

    await expect(service.share(request)).resolves.toEqual({ status: "shared", method: "native" });
    expect(nativeShare).toHaveBeenCalledOnce();
  });

  it("falls back to native share when the Apps in Toss share call fails", async () => {
    const order: string[] = [];
    const nativeShare = vi.fn(async () => {
      order.push("native");
    });
    const service = new ShareService(
      createRuntime({
        appsInToss: {
          getTossShareLink: vi.fn(async () => {
            order.push("link");
            return "https://toss.im/share/orbitslash";
          }),
          share: vi.fn(async () => {
            order.push("apps-share");
            throw new Error("raw Apps share failure");
          }),
        },
        nativeShare,
      }),
    );

    await expect(service.share(request)).resolves.toEqual({ status: "shared", method: "native" });
    expect(order).toEqual(["link", "apps-share", "native"]);
  });

  it("falls back to clipboard when native share fails", async () => {
    const order: string[] = [];
    const writeClipboard = vi.fn(async (text: string) => {
      order.push(`clipboard:${text}`);
    });
    const service = new ShareService(
      createRuntime({
        appsInToss: {
          getTossShareLink: vi.fn(async () => {
            order.push("apps");
            throw new Error("unavailable");
          }),
          share: vi.fn(async () => undefined),
        },
        nativeShare: vi.fn(async () => {
          order.push("native");
          throw new Error("cancelled");
        }),
        writeClipboard,
      }),
    );

    await expect(service.share(request)).resolves.toEqual({ status: "shared", method: "clipboard" });
    expect(order).toEqual([
      "apps",
      "native",
      "clipboard:오빗 슬래시를 함께 플레이해요!\nhttps://orbitslash.example/play",
    ]);
  });

  it("uses clipboard when native share is unavailable", async () => {
    const writeClipboard = vi.fn(async () => undefined);
    const service = new ShareService(
      createRuntime({
        appsInToss: {
          getTossShareLink: vi.fn(async () => {
            throw new Error("unavailable");
          }),
          share: vi.fn(async () => undefined),
        },
        nativeShare: undefined,
        writeClipboard,
      }),
    );

    await expect(service.share(request)).resolves.toEqual({ status: "shared", method: "clipboard" });
    expect(writeClipboard).toHaveBeenCalledWith(
      "오빗 슬래시를 함께 플레이해요!\nhttps://orbitslash.example/play",
    );
  });

  it("returns a stable unavailable result when every ordered attempt fails", async () => {
    const order: string[] = [];
    const service = new ShareService(createRuntime({
      appsInToss: {
        getTossShareLink: async () => {
          order.push("apps");
          throw new Error("raw apps error");
        },
        share: async () => undefined,
      },
      nativeShare: async () => {
        order.push("native");
        throw new Error("raw native error");
      },
      writeClipboard: async () => {
        order.push("clipboard");
        throw new Error("raw clipboard error");
      },
    }));

    const result = await service.share(request);

    expect(result).toEqual({ status: "unavailable", reason: "share_unavailable" });
    expect(JSON.stringify(result)).not.toContain("raw");
    expect(order).toEqual(["apps", "native", "clipboard"]);
  });

  it("keeps invite sharing disabled by default even when an invite code is supplied", async () => {
    const getTossShareLink = vi.fn(async () => "https://toss.im/share/orbitslash");
    const appsShare = vi.fn(async () => undefined);
    const service = new ShareService(
      createRuntime({
        appsInToss: { getTossShareLink, share: appsShare },
      }),
    );

    await service.share({ ...request, inviteCode: "A B/?&한글" });

    expect(getTossShareLink).toHaveBeenCalledWith("intoss://orbitslash");
    expect(appsShare).toHaveBeenCalledWith({
      message: "오빗 슬래시를 함께 플레이해요!\nhttps://toss.im/share/orbitslash",
    });
    expect(JSON.stringify(appsShare.mock.calls)).not.toContain("A B/?&한글");
  });

  it("uses a future invite deep-link builder only when the capability is injected", async () => {
    const inviteDeepLinkBuilder = vi.fn(
      (code: string) => `intoss://orbitslash/invite?code=${encodeURIComponent(code)}`,
    );
    const getTossShareLink = vi.fn(async () => "https://toss.im/share/future-invite");
    const service = new ShareService(
      createRuntime({
        appsInToss: { getTossShareLink, share: vi.fn(async () => undefined) },
        inviteDeepLinkBuilder,
      }),
    );

    await service.share({ ...request, inviteCode: "A B/?&한글" });

    expect(inviteDeepLinkBuilder).toHaveBeenCalledWith("A B/?&한글");
    expect(getTossShareLink).toHaveBeenCalledWith(
      "intoss://orbitslash/invite?code=A%20B%2F%3F%26%ED%95%9C%EA%B8%80",
    );
  });

  it("ignores a non-intoss invite builder result and uses the base deep link", async () => {
    const getTossShareLink = vi.fn(async () => "https://toss.im/share/orbitslash");
    const service = new ShareService(
      createRuntime({
        appsInToss: { getTossShareLink, share: vi.fn(async () => undefined) },
        inviteDeepLinkBuilder: vi.fn(() => "javascript:alert('unsafe')"),
      }),
    );

    await service.share({ ...request, inviteCode: "secret-code" });

    expect(getTossShareLink).toHaveBeenCalledWith("intoss://orbitslash");
  });

  it.each([
    "intoss://other-app/invite?code=secret-code",
    "intoss://orbitslash.evil/invite?code=secret-code",
    "intoss://orbitslash-evil/invite?code=secret-code",
    "intoss://attacker@orbitslash/invite?code=secret-code",
    "intoss://orbitslash:123/invite?code=secret-code",
  ])("rejects an invite builder URL outside the exact Orbit Slash authority: %s", async (candidate) => {
    const getTossShareLink = vi.fn(async () => "https://toss.im/share/orbitslash");
    const service = new ShareService(
      createRuntime({
        appsInToss: { getTossShareLink, share: vi.fn(async () => undefined) },
        inviteDeepLinkBuilder: vi.fn(() => candidate),
      }),
    );

    await service.share({ ...request, inviteCode: "secret-code" });

    expect(getTossShareLink).toHaveBeenCalledWith("intoss://orbitslash");
  });

  it("omits a malformed public URL from native and clipboard fallbacks", async () => {
    const nativeShare = vi.fn(async () => {
      throw new Error("native unavailable");
    });
    const writeClipboard = vi.fn(async () => undefined);
    const service = new ShareService(
      createRuntime({
        appsInToss: {
          getTossShareLink: vi.fn(async () => {
            throw new Error("Apps unavailable");
          }),
          share: vi.fn(async () => undefined),
        },
        nativeShare,
        writeClipboard,
      }),
    );

    await expect(
      service.share({ ...request, webUrl: "javascript:alert('unsafe')" }),
    ).resolves.toEqual({ status: "shared", method: "clipboard" });
    expect(nativeShare).toHaveBeenCalledWith({
      title: "Orbit Slash",
      text: "오빗 슬래시를 함께 플레이해요!",
    });
    expect(writeClipboard).toHaveBeenCalledWith("오빗 슬래시를 함께 플레이해요!");
  });

  it("returns unavailable without invoking final fallbacks when no safe content remains", async () => {
    const nativeShare = vi.fn(async () => undefined);
    const writeClipboard = vi.fn(async () => undefined);
    const service = new ShareService(
      createRuntime({
        appsInToss: {
          getTossShareLink: vi.fn(() => {
            throw new Error("Apps unavailable");
          }),
          share: vi.fn(async () => undefined),
        },
        nativeShare,
        writeClipboard,
      }),
    );

    await expect(
      service.share({ message: "   ", title: "   ", webUrl: "file:///private/data" }),
    ).resolves.toEqual({ status: "unavailable", reason: "share_unavailable" });
    expect(nativeShare).not.toHaveBeenCalled();
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it("constructs an SSR-safe browser runtime without navigator capabilities", () => {
    const runtime = createBrowserShareRuntime(null);

    expect(runtime.appsInToss).toBeUndefined();
    expect(runtime.nativeShare).toBeUndefined();
    expect(runtime.writeClipboard).toBeUndefined();
    expect(() => new ShareService(runtime)).not.toThrow();
  });
});


describe("share cancellation", () => {
  it("stops without clipboard fallback when native sharing is cancelled", async () => {
    const writeClipboard = vi.fn(async () => undefined);
    const service = new ShareService({
      nativeShare: async () => { throw new DOMException("cancelled", "AbortError"); },
      writeClipboard,
    });
    await expect(service.share(request)).resolves.toEqual({ status: "cancelled" });
    expect(writeClipboard).not.toHaveBeenCalled();
  });
  it("stops without browser fallback when the platform reports cancellation", async () => {
    const nativeShare = vi.fn(async () => undefined);
    const service = new ShareService(createRuntime({
      appsInToss: {
        getTossShareLink: async () => "https://toss.im/share/orbitslash",
        share: async () => { throw new DOMException("cancelled", "AbortError"); },
      },
      nativeShare,
    }));
    await expect(service.share(request)).resolves.toEqual({ status: "cancelled" });
    expect(nativeShare).not.toHaveBeenCalled();
  });
});
