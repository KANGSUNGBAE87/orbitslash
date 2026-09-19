import cosmeticsJson from "../../data/cosmetics.json";

export type CosmeticSlot = "earth" | "slash" | "boss";
export interface CosmeticDefinition { id: string; slot: CosmeticSlot; product: "supporter_pack" | "ad_removal"; }

export const COSMETIC_CATALOG = cosmeticsJson.items as CosmeticDefinition[];

export function cosmeticById(id: string): CosmeticDefinition | undefined {
  return COSMETIC_CATALOG.find((item) => item.id === id);
}
