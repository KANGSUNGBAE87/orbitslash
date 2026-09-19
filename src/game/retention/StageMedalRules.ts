export type StageMedal = "none" | "bronze" | "silver" | "gold";

export interface StageMedalInput {
  cleared: boolean;
  score: number;
  remainingEnergy: number;
  maxCombo: number;
}

export interface StageMedalThresholds {
  silverScore: number;
  goldScore: number;
  goldEnergy?: number;
  goldCombo?: number;
}

export function evaluateMedal(input: StageMedalInput, thresholds: StageMedalThresholds): StageMedal {
  if (!input.cleared) return "none";
  const gold = input.score >= thresholds.goldScore
    && (thresholds.goldEnergy == null || input.remainingEnergy >= thresholds.goldEnergy)
    && (thresholds.goldCombo == null || input.maxCombo >= thresholds.goldCombo);
  if (gold) return "gold";
  if (input.score >= thresholds.silverScore) return "silver";
  return "bronze";
}

export function bestMedal(current: StageMedal, candidate: StageMedal): StageMedal {
  const rank: Record<StageMedal, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };
  return rank[candidate] > rank[current] ? candidate : current;
}
