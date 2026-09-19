import { describe, expect, it } from "vitest";
import { GameScene } from "./GameScene";

describe("GameScene independent skill charge rewards", () => {
  it("adds the same reward to every active skill without merging their balances", () => {
    const scene: any = Object.create(GameScene.prototype);
    scene.gauge = 0;
    scene.skillCharges.set("solar_lance", 95);
    scene.skillCharges.set("nova_pulse", 40);

    scene.gainAllSkillCharges(20);

    expect(scene.skillCharges.get("solar_lance")).toBe(100);
    expect(scene.skillCharges.get("nova_pulse")).toBe(60);
  });
});
