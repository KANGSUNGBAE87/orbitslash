import { describe, expect, it } from "vitest";
import { SkillChargeBank } from "./SkillChargeBank";

describe("SkillChargeBank", () => {
  it("consumes only the requested active skill", () => {
    const bank = new SkillChargeBank(["solar_lance", "nova_pulse"]);
    bank.set("solar_lance", 80);
    bank.set("nova_pulse", 64);

    bank.consume("solar_lance");

    expect(bank.get("solar_lance")).toBe(0);
    expect(bank.get("nova_pulse")).toBe(64);
  });

  it("gains independently for every active skill and clamps at 100", () => {
    const bank = new SkillChargeBank(["solar_lance", "nova_pulse"]);
    bank.set("solar_lance", 95);
    bank.set("nova_pulse", 40);

    bank.gainAll(20);

    expect(bank.snapshot()).toEqual({ solar_lance: 100, nova_pulse: 60 });
  });

  it("keeps unknown and inactive ids safe and all stored values finite", () => {
    const bank = new SkillChargeBank(["solar_lance"]);

    bank.set("nova_pulse", 100);
    bank.set("solar_lance", Number.POSITIVE_INFINITY);
    bank.gainAll(Number.NaN);
    bank.consume("unknown_skill");

    expect(bank.get("nova_pulse")).toBe(0);
    expect(bank.get("unknown_skill")).toBe(0);
    expect(bank.get("solar_lance")).toBe(100);
    expect(Number.isFinite(bank.get("solar_lance"))).toBe(true);
  });

  it("normalizes invalid set values, preserves balances on invalid gain, and saturates positive infinity", () => {
    const bank = new SkillChargeBank(["solar_lance", "nova_pulse"]);
    bank.set("solar_lance", 65);
    bank.set("nova_pulse", 25);

    bank.set("solar_lance", undefined as never);
    expect(bank.get("solar_lance")).toBe(0);
    expect(Number.isFinite(bank.get("solar_lance"))).toBe(true);

    bank.set("solar_lance", 65);
    bank.gainAll(undefined as never);
    expect(bank.snapshot()).toEqual({ solar_lance: 65, nova_pulse: 25 });

    bank.gainAll(Number.POSITIVE_INFINITY);
    expect(bank.snapshot()).toEqual({ solar_lance: 100, nova_pulse: 100 });
    expect(Object.values(bank.snapshot()).every(Number.isFinite)).toBe(true);
  });
});
