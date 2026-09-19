import { describe, expect, it } from "vitest";
import { AdLoadCoordinator } from "./AdLoadCoordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("AdLoadCoordinator", () => {
  it("never overlaps banner work with rewarded work", async () => {
    const coordinator = new AdLoadCoordinator();
    const first = deferred<void>();
    const order: string[] = [];

    const banner = coordinator.run("banner", async () => {
      order.push("banner:start");
      await first.promise;
      order.push("banner:end");
    });
    const rewarded = coordinator.run("rewarded", async () => {
      order.push("rewarded:start");
      order.push("rewarded:end");
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(["banner:start"]);

    first.resolve();
    await Promise.all([banner, rewarded]);
    expect(order).toEqual(["banner:start", "banner:end", "rewarded:start", "rewarded:end"]);
  });

  it("releases the queue after a failed ad load", async () => {
    const coordinator = new AdLoadCoordinator();
    const failure = coordinator.run("fullscreen", async () => {
      throw new Error("no_fill");
    });
    const following = coordinator.run("banner", async () => "ready");

    await expect(failure).rejects.toThrow("no_fill");
    await expect(following).resolves.toBe("ready");
  });
});
