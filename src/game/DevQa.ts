import { MODE_IDS, type ModeId } from "./ModeConfig";

export type DevQaLaunchPreset = "dense" | "boss" | "blockedBody" | "special";
export const DEV_QA_SCENARIO_IDS = ["touchHud", "boss", "special", "blitz"] as const;
export type DevQaScenarioId = (typeof DEV_QA_SCENARIO_IDS)[number];
export type DevQaResults = Record<DevQaScenarioId, boolean>;

export interface DevQaScenario {
  id: DevQaScenarioId;
  label: string;
  labelKey: string;
  modeId: ModeId;
  preset: DevQaLaunchPreset;
  passCriteria: readonly string[];
}

export const DEV_QA_SCENARIOS: Record<DevQaScenarioId, DevQaScenario> = {
  touchHud: {
    id: "touchHud",
    label: "Touch/HUD",
    labelKey: "devQa.touchHud",
    modeId: "freeDefense",
    preset: "dense",
    passCriteria: [
      "safe-area 안 잘림 없음",
      "조작 중 HUD 오터치/가림 없음",
      "프레임 드랍 체감 없음",
    ],
  },
  boss: {
    id: "boss",
    label: "Boss Weak",
    labelKey: "devQa.boss",
    modeId: "bossRush",
    preset: "blockedBody",
    passCriteria: [
      "약점 위치 1초 내 식별 가능",
      "일반 히트와 약점 히트 피드백 구분 가능",
      "실제 약점만 점수/판정 유효",
    ],
  },
  special: {
    id: "special",
    label: "Special",
    labelKey: "devQa.special",
    modeId: "freeDefense",
    preset: "special",
    passCriteria: [
      "보호/회피 대상과 절단 대상 즉시 구분 가능",
      "잘못 자르면 불이익이 명확",
      "보상/만료 피드백 명확",
    ],
  },
  blitz: {
    id: "blitz",
    label: "Blitz",
    labelKey: "devQa.blitz",
    modeId: "blitz60",
    preset: "dense",
    passCriteria: [
      "60초 내 6개 밴드 체감 구분 가능",
      "후반 밀도 상승이 불공정 스파이크로 느껴지지 않음",
      "HUD 가독성 유지",
    ],
  },
};

export const DEV_QA_SCENARIO_LIST = DEV_QA_SCENARIO_IDS.map((id) => DEV_QA_SCENARIOS[id]);

interface NumberParamBounds {
  min: number;
  max: number;
  integer?: boolean;
}

export function createDefaultDevQaResults(): DevQaResults {
  return {
    touchHud: false,
    boss: false,
    special: false,
    blitz: false,
  };
}

export function normalizeDevQaResults(value: unknown): DevQaResults {
  const result = createDefaultDevQaResults();
  if (!value || typeof value !== "object") return result;

  for (const id of DEV_QA_SCENARIO_IDS) {
    result[id] = (value as Partial<Record<DevQaScenarioId, unknown>>)[id] === true;
  }
  return result;
}

export function parseDevQaResults(value: string | null): DevQaResults {
  if (!value) return createDefaultDevQaResults();
  try {
    return normalizeDevQaResults(JSON.parse(value));
  } catch {
    return createDefaultDevQaResults();
  }
}

export function readDevNumberParam(search: string, key: string, bounds: NumberParamBounds): number | undefined {
  const raw = new URLSearchParams(search).get(key);
  if (raw == null || raw.trim() === "") return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;

  const bounded = Math.max(bounds.min, Math.min(bounds.max, parsed));
  return bounds.integer ? Math.floor(bounded) : bounded;
}

export function readDevStringParam<const T extends readonly string[]>(search: string, key: string, allowed: T): T[number] | undefined {
  const raw = new URLSearchParams(search).get(key);
  if (raw == null) return undefined;
  return allowed.includes(raw) ? raw : undefined;
}

export function readDevModeParam(search: string, key: string): ModeId | undefined {
  return readDevStringParam(search, key, MODE_IDS);
}
