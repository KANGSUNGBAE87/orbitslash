import type { FeedbackCue } from "./AudioPort";

export interface SynthCue {
  frequencyHz: number;
  durationMs: number;
  gain: number;
}

export const AUDIO_MANIFEST: Record<FeedbackCue, SynthCue> = {
  ui_tap: { frequencyHz: 440, durationMs: 35, gain: 0.035 },
  slash_hit: { frequencyHz: 560, durationMs: 45, gain: 0.045 },
  enemy_destroyed: { frequencyHz: 700, durationMs: 70, gain: 0.055 },
  last_save: { frequencyHz: 880, durationMs: 130, gain: 0.085 },
  friendly_hit: { frequencyHz: 180, durationMs: 110, gain: 0.06 },
  skill_fire: { frequencyHz: 640, durationMs: 100, gain: 0.065 },
  boss_enter: { frequencyHz: 150, durationMs: 160, gain: 0.08 },
  boss_phase: { frequencyHz: 240, durationMs: 130, gain: 0.075 },
  boss_defeat: { frequencyHz: 960, durationMs: 200, gain: 0.09 },
  reward_reveal: { frequencyHz: 760, durationMs: 150, gain: 0.08 },
};
