import type { RunConfig } from "../ModeConfig";
import { cosmeticById, type CosmeticSlot } from "./CosmeticCatalog";

export interface CosmeticLoadout {
  earth?: string;
  slash?: string;
  boss?: string;
}

export function resolveCosmeticLoadout(ownedIds: readonly string[], requested: CosmeticLoadout): CosmeticLoadout {
  const owned = new Set(ownedIds);
  const resolved: CosmeticLoadout = { earth: undefined, slash: undefined, boss: undefined };
  for (const slot of ["earth", "slash", "boss"] as const) {
    const id = requested[slot];
    if (!id || !owned.has(id) || cosmeticById(id)?.slot !== slot) continue;
    resolved[slot] = id;
  }
  return resolved;
}

/** Cosmetic presentation is intentionally excluded from deterministic game rules. */
export function applyCosmetic<T extends RunConfig>(config: T, _loadout: CosmeticLoadout): T {
  return config;
}

export function cosmeticSlots(): CosmeticSlot[] {
  return ["earth", "slash", "boss"];
}
