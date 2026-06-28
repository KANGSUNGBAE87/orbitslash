import type { SpawnSpec, EnemyTable, DifficultyTable, DifficultyDef, OrbitProfile, WaveBand, WaveTable } from "./types";
import type { IRng } from "./Rng";
import { EARTH_CENTER_Y } from "./coords";

// 결정적 시드 RNG로 스폰 명세 생성 (implementation-plan §3.5).
// 같은 seed+config → 동일 SpawnSpec[] → 랭킹 고정시드 재현/서버 검증의 핵심.
// 순수 로직 — PixiJS import 금지.

export interface WaveConfig {
  difficulty: string;
  durationMs?: number;
  spawnIntervalMs?: number; // 평균 스폰 간격 (기본 800ms)
}

const DEFAULT_INTERVAL_MS = 800;

export class WaveGenerator {
  private rng: IRng;
  private readonly cfg: WaveConfig;
  private readonly enemies: EnemyTable;
  private readonly difficulty: DifficultyTable;
  private readonly enemyKeys: string[];
  private readonly orbits: OrbitProfile[];
  private readonly waves?: WaveTable;

  // 결정적 진행 상태: 다음에 생성할 스폰의 예정 시각과 이미 반환한 경계.
  private nextSpawnAtMs = 0;
  private lastReturnedUntilMs = 0;
  private idSeq = 0;
  private lastEnemyType: string | undefined;
  private consecutiveEnemyCount = 0;

  constructor(
    rng: IRng,
    cfg: WaveConfig,
    enemies: EnemyTable,
    difficulty: DifficultyTable,
    orbits: OrbitProfile[],
    waves?: WaveTable,
  ) {
    this.rng = rng;
    this.cfg = cfg;
    this.enemies = enemies;
    this.difficulty = difficulty;
    this.enemyKeys = Object.keys(enemies);
    this.orbits = orbits.length > 0 ? orbits : [{ angularMul: 1, dir: 1 }];
    this.waves = waves;
    this.initFirstSpawn();
  }

  private initFirstSpawn(): void {
    this.nextSpawnAtMs = this.jitterInterval(0);
  }

  private intervalMs(elapsedMs: number): number {
    return this.cfg.spawnIntervalMs ?? activeWaveBand(this.waves, this.cfg.difficulty, elapsedMs)?.spawnIntervalMs ?? DEFAULT_INTERVAL_MS;
  }

  /** 다음 스폰까지 간격 (결정적 지터: 평균 간격의 0.6~1.4배). */
  private jitterInterval(elapsedMs: number): number {
    const base = this.intervalMs(elapsedMs);
    const factor = 0.6 + this.rng.next() * 0.8;
    return Math.round(base * factor);
  }

  /** 결정적으로 적 타입 하나 선택. */
  private pickEnemyType(elapsedMs: number): string {
    const band = activeWaveBand(this.waves, this.cfg.difficulty, elapsedMs);
    if (band) {
      const weighted = pickWeightedEnemyType(this.rng.next(), band, this.enemies, this.blockedEnemyTypes(band));
      if (weighted) return weighted;
    }
    const idx = this.rng.nextInt(this.enemyKeys.length);
    return this.enemyKeys[idx] ?? this.enemyKeys[0]!;
  }

  private blockedEnemyTypes(band: WaveBand): ReadonlySet<string> {
    const blocked = new Set<string>();
    const max = this.lastEnemyType ? band.maxConsecutive?.[this.lastEnemyType] : undefined;
    if (this.lastEnemyType && max != null && this.consecutiveEnemyCount >= max) {
      blocked.add(this.lastEnemyType);
    }
    return blocked;
  }

  private makeSpec(spawnAtMs: number): SpawnSpec {
    const enemyType = this.pickEnemyType(spawnAtMs);
    this.recordEnemyType(enemyType);
    const def = this.enemies[enemyType]!;
    const startAngleRad = safeStartAngleRad(this.rng.next() * 2 * Math.PI, def.startRadius);
    // 궤도 프로파일 결정적 선택 (~10종) → 곡률·회전방향만 다양화 (접근속도는 제외).
    const profile = this.orbits[this.rng.nextInt(this.orbits.length)] ?? this.orbits[0]!;
    // 접근속도는 난이도별 배율(별도 변수)로 스케일 — 난이도 상승 시 함께 증가.
    const diff = this.difficulty[this.cfg.difficulty] as DifficultyDef | undefined;
    const approachMul = diff?.approachSpeedMul ?? 1;
    this.idSeq += 1;
    return {
      enemyType,
      spawnAtMs,
      startAngleRad,
      startRadius: def.startRadius,
      angularSpeed: def.angularSpeed * profile.angularMul * profile.dir,
      approachSpeed: def.approachSpeed * approachMul,
    };
  }

  private recordEnemyType(enemyType: string): void {
    if (enemyType === this.lastEnemyType) {
      this.consecutiveEnemyCount += 1;
    } else {
      this.lastEnemyType = enemyType;
      this.consecutiveEnemyCount = 1;
    }
  }

  /**
   * 경과시간(elapsedMs)까지 등장해야 할 스폰 명세를 반환.
   * 누적: 이전 호출에서 반환한 경계 이후 ~ elapsedMs 까지의 스폰만 반환.
   * 같은 seed면 호출 분할 방식과 무관하게 동일한 전체 시퀀스를 만든다.
   */
  next(elapsedMs: number): SpawnSpec[] {
    const out: SpawnSpec[] = [];
    while (this.nextSpawnAtMs <= elapsedMs) {
      const spawnAt = this.nextSpawnAtMs;
      out.push(this.makeSpec(spawnAt));
      this.nextSpawnAtMs = spawnAt + this.jitterInterval(spawnAt);
    }
    this.lastReturnedUntilMs = Math.max(this.lastReturnedUntilMs, elapsedMs);
    return out;
  }

  /** 새 RNG로 초기화 (같은 seed면 처음과 동일 시퀀스 재생). */
  reset(rng: IRng): void {
    this.rng = rng;
    this.nextSpawnAtMs = 0;
    this.lastReturnedUntilMs = 0;
    this.idSeq = 0;
    this.lastEnemyType = undefined;
    this.consecutiveEnemyCount = 0;
    this.initFirstSpawn();
  }

  /** 디버그/검증용: 난이도 키 유효성. */
  hasDifficulty(): boolean {
    return this.cfg.difficulty in this.difficulty;
  }
}

export function activeWaveBand(waves: WaveTable | undefined, difficulty: string, elapsedMs: number): WaveBand | undefined {
  const bands = waves?.[difficulty] ?? waves?.default;
  if (!bands || bands.length === 0) return undefined;
  let active = bands[0];
  for (const band of bands) {
    if (band.fromMs <= elapsedMs && band.fromMs >= (active?.fromMs ?? -Infinity)) {
      active = band;
    }
  }
  return active;
}

export function pickWeightedEnemyType(
  rand: number,
  band: WaveBand,
  enemies: EnemyTable,
  blockedTypes: ReadonlySet<string> = new Set(),
): string | undefined {
  const entries = Object.entries(band.weights).filter(([key, weight]) => weight > 0 && enemies[key] && !blockedTypes.has(key));
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return undefined;
  let cursor = rand * total;
  for (const [key, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return key;
  }
  return entries[entries.length - 1]?.[0];
}

export function safeStartAngleRad(
  angleRad: number,
  startRadius: number,
  options: { earthY?: number; minY?: number } = {},
): number {
  const earthY = options.earthY ?? EARTH_CENTER_Y;
  const minY = options.minY ?? 230;
  const y = earthY + Math.sin(angleRad) * startRadius;
  if (y >= minY) return angleRad;

  const minSin = Math.max(-1, Math.min(1, (minY - earthY) / startRadius));
  const lower = Math.PI + Math.asin(-minSin);
  const upper = Math.PI * 2 - Math.asin(-minSin);
  const distToLower = angularDistance(angleRad, lower);
  const distToUpper = angularDistance(angleRad, upper);
  return distToLower <= distToUpper ? lower : upper;
}

function angularDistance(a: number, b: number): number {
  let diff = Math.abs((a - b) % (Math.PI * 2));
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff;
}
