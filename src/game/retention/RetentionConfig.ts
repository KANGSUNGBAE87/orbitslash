import retentionJson from "../../data/retention.json";
import type { StageMedalThresholds } from "./StageMedalRules";
import type { WeeklyGoalRule } from "./WeeklyGoalRules";

export interface RetentionConfig {
  stages: Record<string, StageMedalThresholds>;
  weekly: WeeklyGoalRule;
}

const SUPPORTED_WEEKLY_TITLE_IDS = ["weekly_five_day"] as const;

export function parseRetentionConfig(value: unknown): RetentionConfig | null {
  if (!isRecord(value) || !isRecord(value.stages) || !isRecord(value.weekly)) return null;
  const stages: Record<string, StageMedalThresholds> = {};
  for (const [stageId, thresholds] of Object.entries(value.stages)) {
    if (!/^story-[1-9][0-9]*$/.test(stageId) || !isStageThresholds(thresholds)) return null;
    stages[stageId] = thresholds;
  }
  if (Object.keys(stages).length === 0 || !isWeeklyRule(value.weekly)) return null;
  return { stages, weekly: value.weekly };
}

const parsedLocalRetentionConfig = parseRetentionConfig(retentionJson);
if (!parsedLocalRetentionConfig) throw new Error("retention_config_invalid");

export const LOCAL_RETENTION_CONFIG: RetentionConfig = parsedLocalRetentionConfig;

export function stageMedalThresholds(config: RetentionConfig, stageId: string): StageMedalThresholds | null {
  return config.stages[stageId] ?? LOCAL_RETENTION_CONFIG.stages[stageId] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStageThresholds(value: unknown): value is StageMedalThresholds {
  if (!isRecord(value)) return false;
  const { silverScore, goldScore, goldEnergy, goldCombo } = value;
  return finitePositive(silverScore)
    && finitePositive(goldScore)
    && Number(goldScore) >= Number(silverScore)
    && (goldEnergy === undefined || finiteNonNegative(goldEnergy))
    && (goldCombo === undefined || finiteNonNegative(goldCombo));
}

function isWeeklyRule(value: unknown): value is WeeklyGoalRule {
  return isRecord(value)
    && Number.isInteger(value.requiredDistinctClearDays)
    && Number(value.requiredDistinctClearDays) >= 1
    && Number(value.requiredDistinctClearDays) <= 7
    && typeof value.titleId === "string"
    && (SUPPORTED_WEEKLY_TITLE_IDS as readonly string[]).includes(value.titleId);
}

function finitePositive(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
