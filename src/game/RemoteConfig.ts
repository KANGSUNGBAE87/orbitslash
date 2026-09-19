import enemiesJson from "../data/enemies.json";
import scoringJson from "../data/scoring.json";
import difficultyJson from "../data/difficulty.json";
import skillsJson from "../data/skills.json";
import orbitsJson from "../data/orbits.json";
import wavesJson from "../data/waves.json";
import { disabledLiveOpsConfig, parseLiveOpsConfig, type LiveOpsConfig } from "./liveops/SeasonCatalog";
import { LOCAL_RETENTION_CONFIG, parseRetentionConfig, type RetentionConfig } from "./retention/RetentionConfig";
import type {
  EnemyTable,
  ScoringConfig,
  DifficultyTable,
  SkillTable,
  OrbitProfile,
  WaveTable,
} from "./types";

// Remote Config (implementation-plan §3.6). 모든 시스템의 데이터 진입 단일 통로.
// 원격 config는 명시 env flag가 켜졌을 때만 fetch하고, 실패/부분 응답은 로컬 JSON으로 즉시 fallback한다.

export type RemoteConfigStatus =
  | { source: "local"; version: "local"; reason: "remote_disabled" | "missing_endpoint" | "fetch_failed" | "invalid_payload" | "not_loaded" }
  | { source: "remote"; version: string; reason?: undefined };

export interface RemoteConfigOptions {
  enabled?: boolean;
  endpointUrl?: string;
  fetchFn?: typeof fetch;
}

interface RemoteConfigPayload {
  version?: string;
  tables?: Partial<Record<ConfigTableKey, unknown>>;
}

export interface IRemoteConfig {
  get<T = unknown>(key: string): T;
  getEnemies(): EnemyTable;
  getScoring(): ScoringConfig;
  getDifficulty(): DifficultyTable;
  getSkills(): SkillTable;
  getOrbits(): OrbitProfile[];
  getWaves(): WaveTable;
  getLiveOps(): LiveOpsConfig;
  getRetention(): RetentionConfig;
  status(): RemoteConfigStatus;
  ready(): Promise<void>;
}

const TABLE_KEYS = ["enemies", "scoring", "difficulty", "skills", "orbits", "waves", "liveops", "retention"] as const;
type ConfigTableKey = (typeof TABLE_KEYS)[number];

const tables: Record<ConfigTableKey, unknown> = {
  enemies: enemiesJson,
  scoring: scoringJson,
  difficulty: difficultyJson,
  skills: skillsJson,
  orbits: orbitsJson,
  waves: wavesJson,
  liveops: disabledLiveOpsConfig(),
  retention: LOCAL_RETENTION_CONFIG,
};

class LocalRemoteConfig implements IRemoteConfig {
  private activeTables: Record<ConfigTableKey, unknown> = { ...tables };
  private readyPromise: Promise<void> | null = null;
  private currentStatus: RemoteConfigStatus;

  constructor(private readonly options: RemoteConfigOptions = {}) {
    this.currentStatus = this.initialStatus();
  }

  get<T = unknown>(key: string): T {
    return (this.isTableKey(key) ? this.activeTables[key] : undefined) as T;
  }

  getEnemies(): EnemyTable {
    return this.activeTables.enemies as EnemyTable;
  }

  getScoring(): ScoringConfig {
    return this.activeTables.scoring as ScoringConfig;
  }

  getDifficulty(): DifficultyTable {
    return this.activeTables.difficulty as DifficultyTable;
  }

  getSkills(): SkillTable {
    return this.activeTables.skills as SkillTable;
  }

  getOrbits(): OrbitProfile[] {
    return (this.activeTables.orbits as { profiles: OrbitProfile[] }).profiles;
  }

  getWaves(): WaveTable {
    return this.activeTables.waves as WaveTable;
  }

  getLiveOps(): LiveOpsConfig {
    return this.activeTables.liveops as LiveOpsConfig;
  }

  getRetention(): RetentionConfig {
    return this.activeTables.retention as RetentionConfig;
  }

  status(): RemoteConfigStatus {
    return this.currentStatus;
  }

  ready(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.loadRemote();
    return this.readyPromise;
  }

  private async loadRemote(): Promise<void> {
    if (!this.options.enabled) {
      this.currentStatus = { source: "local", version: "local", reason: "remote_disabled" };
      return;
    }
    if (!this.options.endpointUrl) {
      this.currentStatus = { source: "local", version: "local", reason: "missing_endpoint" };
      return;
    }
    const fetchFn = this.options.fetchFn ?? globalThis.fetch;
    if (!fetchFn) {
      this.currentStatus = { source: "local", version: "local", reason: "fetch_failed" };
      return;
    }

    try {
      const response = await fetchFn(this.options.endpointUrl, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`remote_config_http_${response.status}`);
      const payload = await response.json() as RemoteConfigPayload;
      if (!isRemoteConfigPayload(payload)) {
        this.currentStatus = { source: "local", version: "local", reason: "invalid_payload" };
        return;
      }
      const nextTables: Record<ConfigTableKey, unknown> = { ...tables };
      for (const key of TABLE_KEYS) {
        const value = payload.tables?.[key];
        if (key === "liveops") {
          if (value !== undefined) nextTables.liveops = parseLiveOpsConfig(value) ?? disabledLiveOpsConfig();
          continue;
        }
        if (key === "retention") {
          if (value !== undefined) nextTables.retention = parseRetentionConfig(value) ?? LOCAL_RETENTION_CONFIG;
          continue;
        }
        if (isPlainObject(value)) nextTables[key] = value;
      }
      this.activeTables = nextTables;
      this.currentStatus = { source: "remote", version: payload.version || "remote" };
    } catch {
      this.activeTables = { ...tables };
      this.currentStatus = { source: "local", version: "local", reason: "fetch_failed" };
    }
  }

  private initialStatus(): RemoteConfigStatus {
    if (!this.options.enabled) return { source: "local", version: "local", reason: "remote_disabled" };
    if (!this.options.endpointUrl) return { source: "local", version: "local", reason: "missing_endpoint" };
    return { source: "local", version: "local", reason: "not_loaded" };
  }

  private isTableKey(key: string): key is ConfigTableKey {
    return (TABLE_KEYS as readonly string[]).includes(key);
  }
}

export function createRemoteConfig(options: RemoteConfigOptions = {}): IRemoteConfig {
  return new LocalRemoteConfig(options);
}

export function createRemoteConfigFromEnv(env: Record<string, string | boolean | undefined> = import.meta.env): IRemoteConfig {
  const enabled = env.VITE_REMOTE_CONFIG_ENABLED === true || env.VITE_REMOTE_CONFIG_ENABLED === "true";
  return createRemoteConfig({
    enabled,
    endpointUrl: typeof env.VITE_REMOTE_CONFIG_URL === "string" ? env.VITE_REMOTE_CONFIG_URL : undefined,
  });
}

function isRemoteConfigPayload(value: unknown): value is RemoteConfigPayload {
  if (!isPlainObject(value)) return false;
  const tablesValue = (value as { tables?: unknown }).tables;
  return tablesValue === undefined || isPlainObject(tablesValue);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const RemoteConfig: IRemoteConfig = createRemoteConfigFromEnv();
