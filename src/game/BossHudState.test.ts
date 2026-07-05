import { describe, expect, it } from "vitest";
import { buildBossHudState } from "./BossHudState";

describe("buildBossHudState", () => {
  it("warns during the final 3 seconds before the next boss spawn", () => {
    const state = buildBossHudState([], 57500, 60000);

    expect(state).toMatchObject({
      active: false,
      warning: true,
      nextBossInMs: 2500,
    });
  });

  it("does not warn while no boss is near", () => {
    const state = buildBossHudState([], 20000, 60000);

    expect(state).toMatchObject({
      active: false,
      warning: false,
      nextBossInMs: 40000,
    });
  });

  it("reports active boss remaining hits and hp ratio", () => {
    const state = buildBossHudState(
      [
        { boss: true, alive: true, hp: 34, maxHp: 50 },
        { boss: false, alive: true, hp: 1, maxHp: 1 },
      ],
      61000,
      60000,
    );

    expect(state).toMatchObject({
      active: true,
      warning: false,
      hp: 34,
      maxHp: 50,
      hitsRemaining: 34,
      hpRatio: 0.68,
    });
  });

  it("reports Ringed Destroyer phase objective keys for HUD copy", () => {
    const ring = buildBossHudState([{ type: "ringed_destroyer", boss: true, alive: true, hp: 58, maxHp: 58 }], 61000, 60000);
    const body = buildBossHudState([{ type: "ringed_destroyer", boss: true, alive: true, hp: 20, maxHp: 58 }], 61000, 60000);

    expect(ring).toMatchObject({
      active: true,
      bossType: "ringed_destroyer",
      phaseLabel: "approach",
      objectiveKey: "boss.objective.ringed_destroyer.ring",
    });
    expect(body).toMatchObject({
      active: true,
      phaseLabel: "pressure",
      objectiveKey: "boss.objective.ringed_destroyer.body",
    });
  });
});
