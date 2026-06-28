import { createRunSummary, type RunSummary } from "./RankingSystem";

export interface RunSessionStart {
  difficulty: string;
  runToken: string;
  seed: number;
}

export interface RunFinishInput {
  survivalMs: number;
  score: number;
  kills: number;
  maxCombo: number;
  lastSaveCount: number;
  remainingEnergy: number;
}

export class RunSession {
  private solarLanceCount = 0;
  private gravitySlowCount = 0;

  constructor(private readonly start: RunSessionStart) {}

  recordSkillUse(skillId: "solar_lance" | "gravity_slow"): void {
    if (skillId === "solar_lance") this.solarLanceCount += 1;
    if (skillId === "gravity_slow") this.gravitySlowCount += 1;
  }

  finish(input: RunFinishInput): RunSummary {
    return createRunSummary({
      ...this.start,
      ...input,
      solarLanceCount: this.solarLanceCount,
      gravitySlowCount: this.gravitySlowCount,
    });
  }
}
