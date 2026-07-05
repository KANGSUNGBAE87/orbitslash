import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH, EARTH_BODY_DIAMETER } from "../game/coords";
import { hudLayoutMetrics, skillSlotLayout } from "./Hud";

describe("skillSlotLayout", () => {
  it("lays out five large bottom skill slots across the screen width", () => {
    const layout = skillSlotLayout(5);

    expect(layout).toHaveLength(5);
    expect(layout[0]!.radius * 2).toBeGreaterThanOrEqual(EARTH_BODY_DIAMETER - 10);
    expect(layout[0]!.x - layout[0]!.radius).toBeGreaterThanOrEqual(32);
    expect(layout[4]!.x + layout[4]!.radius).toBeLessThanOrEqual(BASE_WIDTH - 32);
  });

  it("keeps slots in one horizontal row inside the bottom skill zone", () => {
    const layout = skillSlotLayout(5);
    const y = layout[0]!.y;

    expect(layout.every((slot) => slot.y === y)).toBe(true);
    expect(y - layout[0]!.radius).toBeGreaterThanOrEqual(1560);
    expect(y + layout[0]!.radius).toBeLessThanOrEqual(1840);
  });

  it("promotes time to top center and keeps the wave bar visibly thicker", () => {
    const metrics = hudLayoutMetrics();

    expect(metrics.time.x).toBe(BASE_WIDTH / 2);
    expect(metrics.time.anchorX).toBe(0.5);
    expect(metrics.waveBar.h).toBeGreaterThanOrEqual(44);
    expect(metrics.waveBar.y + metrics.waveBar.h).toBeLessThan(metrics.bossBar.y);
  });

  it("uses a very thick near-full-width bottom Earth energy bar", () => {
    const metrics = hudLayoutMetrics();

    expect(metrics.earthEnergyBar.w).toBeGreaterThanOrEqual(BASE_WIDTH - 80);
    expect(metrics.earthEnergyBar.h).toBeGreaterThanOrEqual(44);
    expect(metrics.earthEnergyBar.y).toBeGreaterThan(BASE_HEIGHT - 120);
    expect(metrics.earthEnergyBar.y + metrics.earthEnergyBar.h).toBeLessThanOrEqual(BASE_HEIGHT - 24);
  });

  it("reserves a persistent shield status bar between boss and energy HUD", () => {
    const metrics = hudLayoutMetrics();

    expect(metrics.shieldBar.w).toBeGreaterThanOrEqual(300);
    expect(metrics.shieldBar.y).toBeGreaterThan(metrics.bossBar.y + metrics.bossBar.h);
    expect(metrics.shieldBar.y + metrics.shieldBar.h).toBeLessThan(metrics.earthEnergyBar.y);
  });

  it("keeps tutorial and blocked weak-point panels out of the skill and energy zones", () => {
    const metrics = hudLayoutMetrics();

    expect(metrics.blockedPanel.y).toBeGreaterThan(metrics.bossBar.y + metrics.bossBar.h);
    expect(metrics.blockedPanel.y + metrics.blockedPanel.h).toBeLessThan(metrics.tutorialPanel.y);
    expect(metrics.tutorialPanel.y + metrics.tutorialPanel.h).toBeLessThan(metrics.skillRow.y);
    expect(metrics.skillRow.y + metrics.skillRow.h).toBeLessThan(metrics.earthEnergyBar.y);
  });

  it("keeps tutorial and blocked weak-point panels horizontally readable on the base stage", () => {
    const metrics = hudLayoutMetrics();

    for (const panel of [metrics.tutorialPanel, metrics.blockedPanel]) {
      expect(panel.x).toBeGreaterThanOrEqual(72);
      expect(panel.x + panel.w).toBeLessThanOrEqual(BASE_WIDTH - 72);
      expect(panel.w).toBeGreaterThanOrEqual(680);
    }
  });
});
