import type { SpawnSpec, EnemyTable, DifficultyTable, DifficultyDef, OrbitProfile } from "./types";
import type { IRng } from "./Rng";

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

  // 결정적 진행 상태: 다음에 생성할 스폰의 예정 시각과 이미 반환한 경계.
  private nextSpawnAtMs = 0;
  private lastReturnedUntilMs = 0;
  private idSeq = 0;

  constructor(
    rng: IRng,
    cfg: WaveConfig,
    enemies: EnemyTable,
    difficulty: DifficultyTable,
    orbits: OrbitProfile[],
  ) {
    this.rng = rng;
    this.cfg = cfg;
    this.enemies = enemies;
    this.difficulty = difficulty;
    this.enemyKeys = Object.keys(enemies);
    this.orbits = orbits.length > 0 ? orbits : [{ angularMul: 1, dir: 1 }];
    this.initFirstSpawn();
  }

  private initFirstSpawn(): void {
    this.nextSpawnAtMs = this.jitterInterval();
  }

  private intervalMs(): number {
    return this.cfg.spawnIntervalMs ?? DEFAULT_INTERVAL_MS;
  }

  /** 다음 스폰까지 간격 (결정적 지터: 평균 간격의 0.6~1.4배). */
  private jitterInterval(): number {
    const base = this.intervalMs();
    const factor = 0.6 + this.rng.next() * 0.8;
    return Math.round(base * factor);
  }

  /** 결정적으로 적 타입 하나 선택. */
  private pickEnemyType(): string {
    const idx = this.rng.nextInt(this.enemyKeys.length);
    return this.enemyKeys[idx] ?? this.enemyKeys[0]!;
  }

  private makeSpec(spawnAtMs: number): SpawnSpec {
    const enemyType = this.pickEnemyType();
    const def = this.enemies[enemyType]!;
    const startAngleRad = this.rng.next() * 2 * Math.PI;
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
      this.nextSpawnAtMs = spawnAt + this.jitterInterval();
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
    this.initFirstSpawn();
  }

  /** 디버그/검증용: 난이도 키 유효성. */
  hasDifficulty(): boolean {
    return this.cfg.difficulty in this.difficulty;
  }
}
