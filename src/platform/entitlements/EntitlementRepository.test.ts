import { describe, expect, it } from "vitest";
import { EntitlementRepository } from "./EntitlementRepository";

describe("EntitlementRepository", () => {
  it("exposes supporter cosmetics without granting gameplay advantages", async () => {
    const repository = new EntitlementRepository({ list: async () => ["supporter_pack"] });

    await expect(repository.load()).resolves.toEqual({ products: ["supporter_pack"], cosmeticIds: ["earth_aurora", "slash_comet", "boss_nebula"] });
  });
});
