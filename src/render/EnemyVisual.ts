import { Assets, Graphics, Texture } from "pixi.js";
import type { EnemyState } from "../game/types";

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
  shard_meteor: "./assets/enemies/shard-meteor.svg",
  small_meteor: "./assets/enemies/small-meteor.svg",
  basic_meteor: "./assets/enemies/basic-meteor.svg",
  fast_comet: "./assets/enemies/fast-comet.svg",
  iron_planet: "./assets/enemies/iron-planet.svg",
  directional_comet: "./assets/enemies/directional-comet.svg",
  heavy_asteroid: "./assets/enemies/heavy-asteroid.svg",
  ancient_planet: "./assets/enemies/ancient-planet.svg",
  eclipse_core: "./assets/enemies/eclipse-core.png",
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
  eclipse_core: { shape: "asteroid", fill: 0x111827, rim: 0xf59e0b, accent: 0xfef3c7, directionalGuide: false, crackColor: 0xff5a2e, sparkleColor: 0xffc14d, boss: true },
};

export function enemyVisualStyle(type: string): EnemyVisualStyle {
  return STYLES[type] ?? { shape: "meteor", fill: 0x8a8f9c, rim: 0xff7a2e, accent: 0xffffff, directionalGuide: false, crackColor: 0xfef3c7, sparkleColor: 0xff7a2e };
}

export function enemyAssetUrl(type: string): string {
  return ASSETS[type] ?? ASSETS.basic_meteor!;
}

const TEXTURE_CACHE = new Map<string, Texture>();
const TEXTURE_LOADING = new Set<string>();

export function enemyTexture(type: string): Texture | undefined {
  const url = enemyAssetUrl(type);
  const cached = TEXTURE_CACHE.get(url);
  if (cached) return cached;
  if (!TEXTURE_LOADING.has(url)) {
    TEXTURE_LOADING.add(url);
    void Assets.load<Texture>(url)
      .then((texture) => {
        TEXTURE_CACHE.set(url, texture);
      })
      .finally(() => {
        TEXTURE_LOADING.delete(url);
      });
  }
  return undefined;
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
