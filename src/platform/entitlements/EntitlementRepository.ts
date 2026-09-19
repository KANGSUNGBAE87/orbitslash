import { COSMETIC_CATALOG } from "../../game/cosmetics/CosmeticCatalog";

export type EntitlementProduct = "supporter_pack" | "ad_removal";

export interface EntitlementPort {
  list(): Promise<EntitlementProduct[]>;
}

export interface EntitlementState {
  products: EntitlementProduct[];
  cosmeticIds: string[];
}

/** Entitlements only unlock presentation; no run config or scoring fields are exposed here. */
export class EntitlementRepository {
  constructor(private readonly port: EntitlementPort) {}

  async load(): Promise<EntitlementState> {
    const products = [...new Set(await this.port.list())];
    const entitled = new Set(products);
    return {
      products,
      cosmeticIds: COSMETIC_CATALOG.filter((cosmetic) => entitled.has(cosmetic.product)).map((cosmetic) => cosmetic.id),
    };
  }
}
