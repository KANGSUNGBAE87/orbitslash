import enemiesJson from "../data/enemies.json";
import scoringJson from "../data/scoring.json";
import difficultyJson from "../data/difficulty.json";
import skillsJson from "../data/skills.json";
import orbitsJson from "../data/orbits.json";
import type {
  EnemyTable,
  ScoringConfig,
  DifficultyTable,
  SkillTable,
  OrbitProfile,
} from "./types";

// Remote Config (implementation-plan §3.6). 모든 시스템의 데이터 진입 단일 통로.
// 지금: 로컬 /data JSON 반환. 나중: 원격 fetch로 교체 (ready()가 비동기 로드 지점).
// TODO(Phase6): 원격 fetch + 캐시 + 버전 핀. product-plan §23.5.

export interface IRemoteConfig {
  get<T = unknown>(key: string): T;
  getEnemies(): EnemyTable;
  getScoring(): ScoringConfig;
  getDifficulty(): DifficultyTable;
  getSkills(): SkillTable;
  getOrbits(): OrbitProfile[];
  ready(): Promise<void>;
}

const tables: Record<string, unknown> = {
  enemies: enemiesJson,
  scoring: scoringJson,
  difficulty: difficultyJson,
  skills: skillsJson,
  orbits: orbitsJson,
};

class LocalRemoteConfig implements IRemoteConfig {
  get<T = unknown>(key: string): T {
    return tables[key] as T;
  }
  getEnemies(): EnemyTable {
    return enemiesJson as unknown as EnemyTable;
  }
  getScoring(): ScoringConfig {
    return scoringJson as unknown as ScoringConfig;
  }
  getDifficulty(): DifficultyTable {
    return difficultyJson as unknown as DifficultyTable;
  }
  getSkills(): SkillTable {
    return skillsJson as unknown as SkillTable;
  }
  getOrbits(): OrbitProfile[] {
    return (orbitsJson as unknown as { profiles: OrbitProfile[] }).profiles;
  }
  ready(): Promise<void> {
    // 원격 도입 전: 즉시 resolve.
    return Promise.resolve();
  }
}

export const RemoteConfig: IRemoteConfig = new LocalRemoteConfig();
