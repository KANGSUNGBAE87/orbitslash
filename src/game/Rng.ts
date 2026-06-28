// 결정적 시드 RNG (mulberry32). 랭킹 고정시드 재현의 기반 (implementation-plan §3.5).
// 순수 로직 — PixiJS import 금지.

export interface IRng {
  next(): number; // [0, 1)
  nextInt(maxExclusive: number): number; // [0, maxExclusive)
}

/**
 * mulberry32: 32-bit 시드 PRNG. 같은 seed → 동일 시퀀스.
 * 서버가 동일 seed로 웨이브를 재현해 클라 기록을 검증할 수 있게 한다.
 */
export function createRng(seed: number): IRng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt(maxExclusive: number): number {
      return Math.floor(next() * maxExclusive);
    },
  };
}
