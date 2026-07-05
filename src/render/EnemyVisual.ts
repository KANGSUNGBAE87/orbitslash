import { Graphics, Texture } from "pixi.js";
import type { EnemyState } from "../game/types";
import { loadTextureForAsset, preloadTextures, textureFromAsset } from "./TextureAssets";

export type EnemyVisualShape = "meteor" | "comet" | "asteroid";

export interface EnemyVisualStyle {
  shape: EnemyVisualShape;
  fill: number;
  rim: number;
  accent: number;
  directionalGuide: boolean;
  crackColor: number;
  sparkleColor: number;
  boss?: boolean;
}

const ASSETS: Record<string, string> = {
  shard_meteor: "./assets/enemies/shard-meteor.png",
  small_meteor: "./assets/enemies/small-meteor.png",
  basic_meteor: "./assets/enemies/basic-meteor.png",
  fast_comet: "./assets/enemies/fast-comet.png",
  iron_planet: "./assets/enemies/iron-planet.png",
  directional_comet: "./assets/enemies/directional-comet.png",
  heavy_asteroid: "./assets/enemies/heavy-asteroid.png",
  ancient_planet: "./assets/enemies/ancient-planet.png",
  fire_meteor: "./assets/enemies/fire-meteor.svg",
  ice_comet: "./assets/enemies/ice-comet.svg",
  crystal_meteor: "./assets/enemies/crystal-meteor.svg",
  shield_rock: "./assets/enemies/shield-rock.svg",
  electric_meteor: "./assets/enemies/electric-meteor.svg",
  graviton_core: "./assets/enemies/graviton-core.svg",
  dark_meteor: "./assets/enemies/dark-meteor.svg",
  armored_fragment: "./assets/enemies/armored-fragment.svg",
  eclipse_core: "./assets/enemies/eclipse-core.png",
  ringed_destroyer: "./assets/enemies/ringed-destroyer.svg",
  lava_titan: "./assets/enemies/lava-titan.svg",
  ice_colossus: "./assets/enemies/ice-colossus.svg",
  dark_planet: "./assets/enemies/dark-planet.svg",
};

const STYLES: Record<string, EnemyVisualStyle> = {
  shard_meteor: { shape: "meteor", fill: 0x9ca3af, rim: 0xffb86b, accent: 0xffffff, directionalGuide: false, crackColor: 0xf8fafc, sparkleColor: 0xffb86b },
  small_meteor: { shape: "meteor", fill: 0x8a8f9c, rim: 0xff8a3d, accent: 0xffffff, directionalGuide: false, crackColor: 0xfef3c7, sparkleColor: 0xff8a3d },
  basic_meteor: { shape: "meteor", fill: 0x7c8493, rim: 0xff7a2e, accent: 0xffffff, directionalGuide: false, crackColor: 0xfef3c7, sparkleColor: 0xff7a2e },
  fast_comet: { shape: "comet", fill: 0xffae5c, rim: 0xff5a2e, accent: 0xffe0b0, directionalGuide: false, crackColor: 0xfff7ed, sparkleColor: 0xff5a2e },
  iron_planet: { shape: "asteroid", fill: 0x64748b, rim: 0x93c5fd, accent: 0xdbeafe, directionalGuide: false, crackColor: 0x93c5fd, sparkleColor: 0xdbeafe },
  directional_comet: { shape: "comet", fill: 0x5bc7ff, rim: 0xffc14d, accent: 0x8ff3ff, directionalGuide: true, crackColor: 0x8ff3ff, sparkleColor: 0xffc14d },
  heavy_asteroid: { shape: "asteroid", fill: 0x6b7280, rim: 0xff6b2e, accent: 0xd1d5db, directionalGuide: false, crackColor: 0xfef3c7, sparkleColor: 0xff6b2e },
  ancient_planet: { shape: "asteroid", fill: 0x4c1d95, rim: 0xfbbf24, accent: 0xfef3c7, directionalGuide: false, crackColor: 0xfef3c7, sparkleColor: 0xfbbf24 },
  fire_meteor: { shape: "comet", fill: 0xff6b2e, rim: 0xffd166, accent: 0xffedd5, directionalGuide: false, crackColor: 0xffedd5, sparkleColor: 0xffd166 },
  ice_comet: { shape: "comet", fill: 0x7dd3fc, rim: 0xe0f2fe, accent: 0xffffff, directionalGuide: false, crackColor: 0xe0f2fe, sparkleColor: 0x38bdf8 },
  crystal_meteor: { shape: "meteor", fill: 0xa78bfa, rim: 0xf0abfc, accent: 0xffffff, directionalGuide: false, crackColor: 0xf5d0fe, sparkleColor: 0xf0abfc },
  shield_rock: { shape: "asteroid", fill: 0x334155, rim: 0x67e8f9, accent: 0xdbeafe, directionalGuide: false, crackColor: 0x67e8f9, sparkleColor: 0x22d3ee },
  electric_meteor: { shape: "comet", fill: 0x2563eb, rim: 0xfacc15, accent: 0xffffff, directionalGuide: true, crackColor: 0xfef08a, sparkleColor: 0xfacc15 },
  graviton_core: { shape: "asteroid", fill: 0x581c87, rim: 0xc084fc, accent: 0xf5d0fe, directionalGuide: false, crackColor: 0xe9d5ff, sparkleColor: 0xc084fc },
  dark_meteor: { shape: "meteor", fill: 0x0f172a, rim: 0x818cf8, accent: 0x312e81, directionalGuide: false, crackColor: 0xc7d2fe, sparkleColor: 0x818cf8 },
  armored_fragment: { shape: "asteroid", fill: 0x3f3f46, rim: 0xf59e0b, accent: 0xfef3c7, directionalGuide: false, crackColor: 0xfcd34d, sparkleColor: 0xf59e0b },
  eclipse_core: { shape: "asteroid", fill: 0x111827, rim: 0xf59e0b, accent: 0xfef3c7, directionalGuide: false, crackColor: 0xff5a2e, sparkleColor: 0xffc14d, boss: true },
  ringed_destroyer: { shape: "asteroid", fill: 0x1f2937, rim: 0xf97316, accent: 0x67e8f9, directionalGuide: false, crackColor: 0xffedd5, sparkleColor: 0xfb923c, boss: true },
  lava_titan: { shape: "asteroid", fill: 0x3b0a0a, rim: 0xef4444, accent: 0xfbbf24, directionalGuide: false, crackColor: 0xfef3c7, sparkleColor: 0xf97316, boss: true },
  ice_colossus: { shape: "asteroid", fill: 0x164e63, rim: 0xbae6fd, accent: 0xffffff, directionalGuide: false, crackColor: 0xe0f2fe, sparkleColor: 0x7dd3fc, boss: true },
  dark_planet: { shape: "asteroid", fill: 0x020617, rim: 0xa855f7, accent: 0xf0abfc, directionalGuide: false, crackColor: 0xe9d5ff, sparkleColor: 0xc084fc, boss: true },
};

export function enemyVisualStyle(type: string): EnemyVisualStyle {
  return STYLES[type] ?? { shape: "meteor", fill: 0x8a8f9c, rim: 0xff7a2e, accent: 0xffffff, directionalGuide: false, crackColor: 0xfef3c7, sparkleColor: 0xff7a2e };
}

export function enemyAssetUrl(type: string): string {
  return ASSETS[type] ?? ASSETS.basic_meteor!;
}

export function allEnemyAssetUrls(): string[] {
  return Array.from(new Set(Object.values(ASSETS)));
}

export function enemyTexture(type: string): Texture | undefined {
  return textureFromAsset(enemyAssetUrl(type));
}

export function preloadEnemyTextures(types: readonly string[] = Object.keys(ASSETS)): Promise<void> {
  return preloadTextures(types.map((type) => enemyAssetUrl(type)));
}

export function loadEnemyTexture(type: string): Promise<Texture | undefined> {
  return loadTextureForAsset(enemyAssetUrl(type));
}

export function drawDirectionalGuide(g: Graphics, en: EnemyState, requiredAngleRad?: number, clear = true): void {
  if (clear) g.clear();
  const style = enemyVisualStyle(en.type);
  if (!style.directionalGuide || requiredAngleRad == null) return;
  const r = en.radiusPx;
  const dx = Math.cos(requiredAngleRad) * r * 0.72;
  const dy = Math.sin(requiredAngleRad) * r * 0.72;
  g.moveTo(-dx, -dy).lineTo(dx, dy).stroke({ width: Math.max(5, r * 0.08), color: 0x8ff3ff, alpha: 0.95 });
}

export function drawEnemyVisual(g: Graphics, en: EnemyState, requiredAngleRad?: number): void {
  const style = enemyVisualStyle(en.type);
  const r = en.radiusPx;
  g.clear();

  if (style.shape === "comet") {
    g.ellipse(-r * 0.28, 0, r * 0.72, r * 0.38).fill({ color: style.rim, alpha: 0.28 });
    g.circle(0, 0, r).fill({ color: style.fill });
    g.circle(0, 0, r).stroke({ width: 3, color: style.rim, alpha: 0.9 });
    g.circle(-r * 0.34, -r * 0.28, r * 0.2).fill({ color: style.accent, alpha: 0.18 });
  } else if (style.shape === "asteroid") {
    g.circle(0, 0, r).fill({ color: style.fill });
    g.circle(-r * 0.24, -r * 0.16, r * 0.23).fill({ color: 0x111827, alpha: 0.18 });
    g.circle(r * 0.26, r * 0.22, r * 0.16).fill({ color: 0x111827, alpha: 0.14 });
    g.circle(0, 0, r).stroke({ width: 4, color: style.rim, alpha: 0.9 });
  } else {
    g.circle(0, 0, r).fill({ color: style.fill });
    g.circle(0, 0, r).stroke({ width: 3, color: style.rim, alpha: 0.85 });
    g.circle(-r * 0.3, -r * 0.3, r * 0.25).fill({ color: style.accent, alpha: 0.08 });
  }

  drawDirectionalGuide(g, en, requiredAngleRad, false);
}
