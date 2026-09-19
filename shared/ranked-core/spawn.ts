import type { RankedCoreRules, RankedDifficultyId, RankedSpawnSpec, RankedSpawnSummary, RankedWaveBand } from "./types";

function createRng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return { next, nextInt: (maxExclusive: number) => Math.floor(next() * maxExclusive) };
}

function activeWaveBand(rules: RankedCoreRules, difficulty: string, elapsedMs: number): RankedWaveBand | undefined {
  const bands = rules.waves[difficulty] ?? rules.waves.default;
  if (!bands?.length) return undefined;
  let active = bands[0];
  for (const band of bands) {
    if (band.fromMs <= elapsedMs && band.fromMs >= (active?.fromMs ?? -Infinity)) active = band;
  }
  return active;
}

function angularDistance(a: number, b: number) {
  let difference = Math.abs((a - b) % (Math.PI * 2));
  if (difference > Math.PI) difference = Math.PI * 2 - difference;
  return difference;
}

function safeStartAngleForEnemy(angleRad: number, startRadius: number, radiusPx: number, rules: RankedCoreRules) {
  const minY = rules.ranked.topHudSafeY + radiusPx * rules.ranked.startVisualRadiusSafeScale;
  const y = rules.ranked.earthCenterY + Math.sin(angleRad) * startRadius;
  if (y >= minY) return angleRad;
  const minSin = Math.max(-1, Math.min(1, (minY - rules.ranked.earthCenterY) / startRadius));
  const lower = Math.PI + Math.asin(-minSin);
  const upper = Math.PI * 2 - Math.asin(-minSin);
  return angularDistance(angleRad, lower) <= angularDistance(angleRad, upper) ? lower : upper;
}

function weightedEnemy(rngValue: number, band: RankedWaveBand | undefined, blocked: ReadonlySet<string>, rules: RankedCoreRules) {
  if (!band) return undefined;
  const entries = Object.entries(band.weights).filter(([type, weight]) => weight > 0 && rules.enemies[type] && !rules.enemies[type]?.boss && !blocked.has(type));
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return undefined;
  let cursor = rngValue * total;
  for (const [type, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return type;
  }
  return entries[entries.length - 1]?.[0];
}

function assignSpawnOrdinals(spawns: RankedSpawnSpec[]): RankedSpawnSpec[] {
  return spawns
    .map((spawn, index) => ({ spawn, index }))
    .sort((a, b) => a.spawn.spawnAtMs - b.spawn.spawnAtMs || a.index - b.index)
    .map(({ spawn }, index) => ({ ...spawn, spawnOrdinal: index + 1 }));
}

/** Same mulberry32/wave rules as player runtime, with fixed ranked modifiers. */
export function generateRankedCoreSpawns(summary: RankedSpawnSummary, rules: RankedCoreRules): RankedSpawnSpec[] {
  const difficulty = summary.difficulty as RankedDifficultyId;
  const rng = createRng(summary.seed);
  const fallbackTypes = Object.keys(rules.enemies).filter((type) => !rules.enemies[type]?.boss);
  const normal: RankedSpawnSpec[] = [];
  let lastEnemyType: string | undefined;
  let consecutive = 0;
  const interval = (elapsedMs: number) => {
    const band = activeWaveBand(rules, difficulty, elapsedMs);
    const base = band?.spawnIntervalMs ?? 800;
    return Math.max(120, Math.round(base * rules.ranked.rankedSpawnIntervalMultiplier));
  };
  const jitter = (elapsedMs: number) => Math.round(interval(elapsedMs) * (0.6 + rng.next() * 0.8));
  let nextSpawnAtMs = jitter(0);

  while (nextSpawnAtMs <= summary.survivalMs) {
    const band = activeWaveBand(rules, difficulty, nextSpawnAtMs);
    const blocked = new Set<string>();
    const max = lastEnemyType ? band?.maxConsecutive?.[lastEnemyType] : undefined;
    if (lastEnemyType && max != null && consecutive >= max) blocked.add(lastEnemyType);
    const type = weightedEnemy(rng.next(), band, blocked, rules) ?? fallbackTypes[rng.nextInt(fallbackTypes.length)]!;
    if (type === lastEnemyType) consecutive += 1;
    else {
      lastEnemyType = type;
      consecutive = 1;
    }
    const def = rules.enemies[type]!;
    // Keep player WaveGenerator's RNG draw order: type → angle → orbit profile.
    const startAngleRad = safeStartAngleForEnemy(rng.next() * Math.PI * 2, def.startRadius, def.radiusPx, rules);
    const profile = rules.orbits[rng.nextInt(rules.orbits.length)] ?? { angularMul: 1, dir: 1 };
    const diff = rules.difficulty[difficulty] as { approachSpeedMul?: number } | undefined;
    const approachMul = def.ignoreSpeedScale ? 1 : (diff?.approachSpeedMul ?? 1) * (band?.approachSpeedMul ?? 1);
    normal.push({
      source: "wave",
      enemyType: type,
      spawnAtMs: nextSpawnAtMs,
      startAngleRad,
      startRadius: def.startRadius,
      angularSpeed: def.angularSpeed * profile.angularMul * profile.dir,
      approachSpeed: def.approachSpeed * approachMul,
    });
    nextSpawnAtMs += jitter(nextSpawnAtMs);
  }

  const bosses: RankedSpawnSpec[] = [];
  for (let spawnAtMs = rules.ranked.periodicBossEveryMs; spawnAtMs <= summary.survivalMs; spawnAtMs += rules.ranked.periodicBossEveryMs) {
    const def = rules.enemies[rules.ranked.bossEnemyType];
    if (!def) break;
    bosses.push({
      source: "boss",
      enemyType: rules.ranked.bossEnemyType,
      spawnAtMs,
      startAngleRad: -Math.PI / 2,
      startRadius: def.startRadius,
      angularSpeed: def.angularSpeed,
      approachSpeed: def.approachSpeed,
    });
  }
  return assignSpawnOrdinals([...normal, ...bosses]);
}

/** Conservative bounds include every possible child of a split-capable enemy. */
export function withPotentialRankedSplitSpawns(spawns: readonly RankedSpawnSpec[], rules: RankedCoreRules): RankedSpawnSpec[] {
  const out = [...spawns];
  for (const spawn of spawns) {
    const def = rules.enemies[spawn.enemyType];
    if (!def?.splitInto || !def.splitCount || def.splitCount <= 0) continue;
    for (let index = 0; index < Math.floor(def.splitCount); index += 1) {
      out.push({
        source: "split",
        parentSpawnOrdinal: spawn.spawnOrdinal,
        enemyType: def.splitInto,
        spawnAtMs: spawn.spawnAtMs,
        startAngleRad: spawn.startAngleRad,
        startRadius: spawn.startRadius,
        angularSpeed: spawn.angularSpeed,
        approachSpeed: spawn.approachSpeed,
      });
    }
  }
  return out;
}

export { activeWaveBand, assignSpawnOrdinals };
