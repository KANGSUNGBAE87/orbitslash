import { describe, it, expect } from "vitest";
import { safeStartAngleRad, WaveGenerator } from "./WaveGenerator";
import { createRng } from "./Rng";
import enemiesJson from "../data/enemies.json";
import difficultyJson from "../data/difficulty.json";
import orbitsJson from "../data/orbits.json";
import wavesJson from "../data/waves.json";
import type { EnemyTable, DifficultyTable, SpawnSpec, OrbitProfile, WaveTable } from "./types";

const enemies = enemiesJson as unknown as EnemyTable;
const difficulty = difficultyJson as unknown as DifficultyTable;
const orbits = (orbitsJson as unknown as { profiles: OrbitProfile[] }).profiles;
const waves = wavesJson as unknown as WaveTable;

function collectUntil(gen: WaveGenerator, elapsedMs: number): SpawnSpec[] {
  return gen.next(elapsedMs);
}

describe("WaveGenerator 결정성 (랭킹 재현 보장의 핵심)", () => {
  it("같은 seed+config → 동일 SpawnSpec[]", () => {
    const a = new WaveGenerator(createRng(2026), { difficulty: "rookie" }, enemies, difficulty, orbits);
    const b = new WaveGenerator(createRng(2026), { difficulty: "rookie" }, enemies, difficulty, orbits);
    expect(collectUntil(a, 30000)).toEqual(collectUntil(b, 30000));
  });

  it("다른 seed → 다른 SpawnSpec[] (적어도 일부)", () => {
    const a = new WaveGenerator(createRng(1), { difficulty: "rookie" }, enemies, difficulty, orbits);
    const b = new WaveGenerator(createRng(999), { difficulty: "rookie" }, enemies, difficulty, orbits);
    expect(collectUntil(a, 30000)).not.toEqual(collectUntil(b, 30000));
  });

  it("reset(rng) 후 같은 seed면 처음과 동일 시퀀스 재생", () => {
    const gen = new WaveGenerator(createRng(55), { difficulty: "rookie" }, enemies, difficulty, orbits);
    const first = collectUntil(gen, 20000);
    gen.reset(createRng(55));
    const second = collectUntil(gen, 20000);
    expect(second).toEqual(first);
  });

  it("next는 누적 — elapsed 증가 시 새 스폰만 추가로 반환", () => {
    const gen = new WaveGenerator(createRng(7), { difficulty: "rookie" }, enemies, difficulty, orbits);
    const early = gen.next(2000);
    const later = gen.next(10000);
    // 이미 반환한 스폰은 다시 안 줌. spawnAtMs는 2000~10000 사이만.
    for (const s of later) {
      expect(s.spawnAtMs).toBeGreaterThan(2000);
      expect(s.spawnAtMs).toBeLessThanOrEqual(10000);
    }
    // early의 마지막 spawnAtMs는 2000 이하
    for (const s of early) {
      expect(s.spawnAtMs).toBeLessThanOrEqual(2000);
    }
  });

  it("SpawnSpec 필드는 유효 범위 (enemyType는 테이블 키, angle [0,2π))", () => {
    const gen = new WaveGenerator(createRng(123), { difficulty: "rookie" }, enemies, difficulty, orbits);
    const specs = gen.next(30000);
    expect(specs.length).toBeGreaterThan(0);
    const keys = Object.keys(enemies);
    for (const s of specs) {
      expect(keys).toContain(s.enemyType);
      expect(s.startAngleRad).toBeGreaterThanOrEqual(0);
      expect(s.startAngleRad).toBeLessThan(2 * Math.PI);
      expect(s.startRadius).toBeGreaterThan(0);
      expect(s.spawnAtMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("wave table can keep directional enemies out of the opening seconds", () => {
    const gen = new WaveGenerator(createRng(99), { difficulty: "rookie" }, enemies, difficulty, orbits, waves);

    expect(gen.next(25000).map((s) => s.enemyType)).not.toContain("directional_comet");
  });

  it("wave table introduces directional enemies after the opening band", () => {
    const testWaves: WaveTable = {
      rookie: [
        { fromMs: 0, spawnIntervalMs: 500, weights: { small_meteor: 1 } },
        { fromMs: 1000, spawnIntervalMs: 500, weights: { directional_comet: 1 } },
      ],
    };
    const gen = new WaveGenerator(createRng(7), { difficulty: "rookie" }, enemies, difficulty, orbits, testWaves);

    const specs = gen.next(2500);
    expect(specs.some((s) => s.spawnAtMs < 1000 && s.enemyType === "small_meteor")).toBe(true);
    expect(specs.some((s) => s.spawnAtMs >= 1000 && s.enemyType === "directional_comet")).toBe(true);
  });

  it("prevents configured enemy types from appearing too many times in a row", () => {
    const testWaves: WaveTable = {
      rookie: [
        {
          fromMs: 0,
          spawnIntervalMs: 1,
          weights: { directional_comet: 99, small_meteor: 1 },
          maxConsecutive: { directional_comet: 2 },
        },
      ],
    };
    const gen = new WaveGenerator(createRng(1), { difficulty: "rookie" }, enemies, difficulty, orbits, testWaves);

    const specs = gen.next(30).map((s) => s.enemyType);

    for (let i = 2; i < specs.length; i += 1) {
      expect(specs.slice(i - 2, i + 1)).not.toEqual(["directional_comet", "directional_comet", "directional_comet"]);
    }
  });

  it("keeps initial spawn positions out of the top HUD band", () => {
    const angle = (Math.PI * 3) / 2;
    const safe = safeStartAngleRad(angle, 900, { earthY: 900, minY: 230 });
    const y = 900 + Math.sin(safe) * 900;

    expect(y).toBeGreaterThanOrEqual(230);
  });
});
