import type { SpecialObjectType } from "../game/SpecialObjectSystem";

const SPECIAL_OBJECT_ASSETS: Record<SpecialObjectType, string> = {
  friendlyRescue: "./assets/special/friendly-rescue.svg",
  energyCapsule: "./assets/special/energy-capsule.svg",
  satellite: "./assets/special/satellite.svg",
  empMine: "./assets/special/emp-mine.svg",
};

export function specialObjectAssetUrl(type: SpecialObjectType): string {
  return SPECIAL_OBJECT_ASSETS[type];
}

export function allSpecialObjectAssetUrls(): string[] {
  return Object.values(SPECIAL_OBJECT_ASSETS);
}
