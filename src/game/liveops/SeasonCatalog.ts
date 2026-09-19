import { cosmeticById } from "../cosmetics/CosmeticCatalog";

export interface SeasonDefinition {
  id: string;
  startsAt: string;
  endsAt: string;
  supportedClientVersion: string;
  configVersion: string;
  cosmeticRewardIds: string[];
}

export interface LiveOpsConfig {
  enabled: boolean;
  seasons: SeasonDefinition[];
}

export interface SeasonEvaluationInput {
  seasonId: string;
  now: Date;
  clientVersion: string;
  configVersion: string;
}

export type SeasonUnavailableReason =
  | "missing_config"
  | "invalid_config"
  | "disabled"
  | "season_not_found"
  | "not_started"
  | "expired"
  | "client_unsupported"
  | "config_unsupported";

export type SeasonEvaluation =
  | { available: true; season: SeasonDefinition }
  | { available: false; reason: SeasonUnavailableReason };

export interface SeasonCatalog {
  readonly config: LiveOpsConfig;
  evaluate(input: SeasonEvaluationInput): SeasonEvaluation;
}

type CatalogState = "missing" | "invalid" | "disabled" | "ready";

export function disabledLiveOpsConfig(): LiveOpsConfig {
  return { enabled: false, seasons: [] };
}

/**
 * Remote config is untrusted. A live-ops table becomes available only when its
 * complete season contract validates against cosmetics shipped in this client.
 */
export function parseLiveOpsConfig(value: unknown): LiveOpsConfig | null {
  if (!isRecord(value) || typeof value.enabled !== "boolean" || !Array.isArray(value.seasons)) return null;
  if (!value.enabled) return value.seasons.length === 0 ? disabledLiveOpsConfig() : null;
  const seasons: SeasonDefinition[] = [];
  for (const candidate of value.seasons) {
    const season = parseSeason(candidate);
    if (!season) return null;
    seasons.push(season);
  }
  if (new Set(seasons.map((season) => season.id)).size !== seasons.length) return null;
  return { enabled: true, seasons };
}

export function createSeasonCatalog(value: unknown): SeasonCatalog {
  const state: CatalogState = value === undefined
    ? "missing"
    : parseLiveOpsConfig(value) === null
      ? "invalid"
      : parseLiveOpsConfig(value)?.enabled
        ? "ready"
        : "disabled";
  const parsed = parseLiveOpsConfig(value);
  const config = parsed ?? disabledLiveOpsConfig();

  return {
    config,
    evaluate(input: SeasonEvaluationInput): SeasonEvaluation {
      if (state === "missing") return { available: false, reason: "missing_config" };
      if (state === "invalid") return { available: false, reason: "invalid_config" };
      if (state === "disabled") return { available: false, reason: "disabled" };
      const season = config.seasons.find((candidate) => candidate.id === input.seasonId);
      if (!season) return { available: false, reason: "season_not_found" };
      const nowMs = input.now.getTime();
      if (!Number.isFinite(nowMs)) return { available: false, reason: "invalid_config" };
      if (nowMs < Date.parse(season.startsAt)) return { available: false, reason: "not_started" };
      if (nowMs >= Date.parse(season.endsAt)) return { available: false, reason: "expired" };
      if (input.clientVersion !== season.supportedClientVersion) return { available: false, reason: "client_unsupported" };
      if (input.configVersion !== season.configVersion) return { available: false, reason: "config_unsupported" };
      return { available: true, season };
    },
  };
}

function parseSeason(value: unknown): SeasonDefinition | null {
  if (!isRecord(value)) return null;
  const id = shortText(value.id);
  const startsAt = canonicalIso(value.startsAt);
  const endsAt = canonicalIso(value.endsAt);
  const supportedClientVersion = shortText(value.supportedClientVersion);
  const configVersion = shortText(value.configVersion);
  if (!id || !startsAt || !endsAt || !supportedClientVersion || !configVersion || !Array.isArray(value.cosmeticRewardIds)) return null;
  if (Date.parse(startsAt) >= Date.parse(endsAt)) return null;
  const cosmeticRewardIds = value.cosmeticRewardIds.map(shortText);
  if (cosmeticRewardIds.some((rewardId) => !rewardId || !cosmeticById(rewardId))) return null;
  if (new Set(cosmeticRewardIds).size !== cosmeticRewardIds.length) return null;
  return { id, startsAt, endsAt, supportedClientVersion, configVersion, cosmeticRewardIds: cosmeticRewardIds as string[] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shortText(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(value) ? value : null;
}

function canonicalIso(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
}
