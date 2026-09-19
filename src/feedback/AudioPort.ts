export type FeedbackCue =
  | "ui_tap"
  | "slash_hit"
  | "enemy_destroyed"
  | "last_save"
  | "friendly_hit"
  | "skill_fire"
  | "boss_enter"
  | "boss_phase"
  | "boss_defeat"
  | "reward_reveal";

export interface AudioPort {
  attemptAutoplay(): Promise<boolean>;
  unlockFromUserGesture(): void;
  play(cue: FeedbackCue): void;
  pause(): void;
}
