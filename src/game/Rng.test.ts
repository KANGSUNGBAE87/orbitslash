import { describe, it, expect } from "vitest";
import { createRng } from "./Rng";

describe("Rng (mulberry32)", () => {
  it("같은 seed → 동일 시퀀스 (결정성)", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("다른 seed → 다른 시퀀스", () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("next()는 [0, 1) 범위", () => {
    const r = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("nextInt(max)는 [0, max) 정수", () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it("nextInt 시퀀스도 seed에 결정적", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.nextInt(100));
    const seqB = Array.from({ length: 20 }, () => b.nextInt(100));
    expect(seqA).toEqual(seqB);
  });
});
