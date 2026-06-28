// 공용 타입 (implementation-plan §3.1). PixiJS 무관 — 순수 로직과 렌더가 공유.

export interface Point {
  x: number;
  y: number;
  t: number; // t = ms timestamp
}

export interface Segment {
  a: Point;
  b: Point;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type DistanceBand = "outer" | "mid" | "danger" | "lastSave" | "impact";

export type GestureKind = "slash" | "line" | "circle" | "triangle" | "spiral" | "none";

/** 거리밴드 경계 (R 배수). difficulty.json.zones에서 주입. */
export interface ZoneTable {
  outer: number; // 4.0
  mid: number; // 3.0
  danger: number; // 2.0
  lastSave: number; // 1.3
  impact: number; // 1.2
}

/** WaveGenerator → OrbitSpawner. 렌더 무관, 서버 재현 가능. */
export interface SpawnSpec {
  enemyType: string; // enemies.json 키
  spawnAtMs: number; // 판 시작 기준 등장 시각
  startAngleRad: number; // 결정적 RNG로 생성
  startRadius: number;
  angularSpeed: number; // 궤도 프로파일 적용 후 최종값 (부호 = 회전방향)
  approachSpeed: number; // 궤도 프로파일 적용 후 최종값
}

/** 나선 궤도 프로파일 (orbits.json). 곡률·회전방향만 다양화. 접근속도는 난이도 변수로 분리. */
export interface OrbitProfile {
  angularMul: number; // 회전속도 배율 (곡률)
  dir: number; // 회전방향 +1(시계) / -1(반시계)
}

export interface EnemyState {
  id: number;
  type: string;
  angle: number; // 나선 궤도 상태 (§15.1)
  radius: number;
  angularSpeed: number;
  approachSpeed: number;
  radiusPx: number;
  hp: number;
  damage: number;
  score: number;
  alive: boolean;
}

// ── 데이터 테이블 타입 (RemoteConfig 반환) ────────────────────────────────

export interface EnemyDef {
  startRadius: number;
  approachSpeed: number;
  angularSpeed: number;
  radiusPx: number;
  hp: number;
  damage: number;
  score: number;
  directional: boolean;
}
export type EnemyTable = Record<string, EnemyDef>;

export interface ComboTier {
  min: number;
  mult: number;
}
export interface ScoringConfig {
  distanceMultiplier: Record<DistanceBand | "outer" | "mid" | "danger" | "lastSave", number>;
  accuracyMultiplier: Record<"normal" | "directional" | "weakCenter" | "bossWeak", number>;
  comboMultiplier: ComboTier[];
  comboGainPerSlashCap: number | null;
  multiCutBonus: { double: number; triple: number; mega: number; orbital_master: number };
  gaugeGain: Record<string, number>;
}

export interface DifficultyDef {
  earthEnergy: number;
  gravitySwell: number;
  approachSpeedMul: number; // 난이도별 접근속도 배율 (난이도 상승 시 증가)
}
export interface DifficultyTable {
  rookie: DifficultyDef;
  defender: DifficultyDef;
  elite: DifficultyDef;
  master: DifficultyDef;
  zones: ZoneTable;
  [key: string]: DifficultyDef | ZoneTable;
}

export interface SkillDef {
  gaugeCost: number;
  cooldownSec: number;
  hitDamage?: number;
  minLengthRatio?: number;
  straightnessMin?: number;
  lineToEarthMaxR?: number;
  endpointOutsideR?: number;
  _phase?: string;
}
export interface SkillTable {
  solar_lance: SkillDef;
  orbital_cut: SkillDef;
  gravity_slow: SkillDef;
  delta_shield: SkillDef;
  _debug: { instantFillGauge: boolean; infiniteGauge: boolean };
}

// ── 판정/제스처 결과 ──────────────────────────────────────────────────────

export type AccuracyKind = "normal" | "directional" | "weakCenter" | "bossWeak";

export interface HitResult {
  enemyId: number;
  band: DistanceBand; // 베인 시점 적의 거리밴드 → 거리배율
  accuracy: AccuracyKind;
}

export type MultiCutTier = "double" | "triple" | "mega" | "orbital_master" | "none";

export interface GestureResult {
  kind: GestureKind;
  points: Point[];
  straightness: number; // 시작-끝거리 / 경로총길이 (1.0=직선)
  totalTurnRad: number; // 누적 회전각 (circle/spiral 판정)
  enclosesEarth: boolean; // 경로 폴리곤이 지구중심 포함 (circle/triangle)
  vertexCount: number; // 큰 꺾임 수 (triangle 판정)
  startEndGapRatio: number; // 시작-끝 거리 / 경로총길이 (닫힘 판정)
}

export interface EarthRef {
  cx: number;
  cy: number;
  r: number;
}
