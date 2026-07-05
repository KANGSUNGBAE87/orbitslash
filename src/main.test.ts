import { describe, expect, it } from "vitest";
import { bootstrap, type BootstrapDeps } from "./main";

describe("bootstrap", () => {
  it("mounts GameApp before waiting on remote config and visual preload", async () => {
    const events: string[] = [];
    const deps: BootstrapDeps = {
      getMount: () => ({ appendChild: () => undefined }) as unknown as HTMLElement,
      createGame: () => ({
        init: async (_mount, beforeReady) => {
          events.push("init");
          await beforeReady?.();
          events.push("ready");
        },
      }),
      remoteReady: async () => {
        events.push("remote");
      },
      preloadAssets: async () => {
        events.push("preload");
      },
    };

    await bootstrap(deps);

    expect(events).toEqual(["init", "remote", "preload", "ready"]);
  });
});
