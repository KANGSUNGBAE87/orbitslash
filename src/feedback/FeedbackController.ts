import type { FeedbackCue } from "./AudioPort";

export type FeedbackEvent =
  | { type: "normal_hit"; atMs: number }
  | { type: "enemy_destroyed"; atMs: number }
  | { type: "last_save"; atMs: number }
  | { type: "friendly_hit"; atMs: number }
  | { type: "skill_fire"; atMs: number }
  | { type: "boss_enter"; atMs: number }
  | { type: "boss_phase"; atMs: number }
  | { type: "boss_defeat"; atMs: number }
  | { type: "reward_reveal"; atMs: number }
  | { type: "ui_tap"; atMs: number };

export interface FeedbackPreferences {
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  hapticEnabled: boolean;
  reducedMotion: boolean;
}

export interface FeedbackPorts {
  haptic(kind: "light" | "medium" | "heavy"): void;
  play(cue: FeedbackCue): void;
}

const HAPTIC_THROTTLE_MS = 80;

export class FeedbackController {
  private lastNormalHitAtMs = -Infinity;

  constructor(
    private readonly preferences: () => FeedbackPreferences,
    private readonly ports: FeedbackPorts,
  ) {}

  handle(event: FeedbackEvent): void {
    const cue = cueFor(event.type);
    const preference = this.preferences();
    if (preference.sfxEnabled) this.ports.play(cue);
    const haptic = hapticFor(event.type);
    if (!preference.hapticEnabled || !haptic) return;
    if (event.type === "normal_hit") {
      if (event.atMs - this.lastNormalHitAtMs < HAPTIC_THROTTLE_MS) return;
      this.lastNormalHitAtMs = event.atMs;
    }
    this.ports.haptic(haptic);
  }
}

function cueFor(type: FeedbackEvent["type"]): FeedbackCue {
  const cues: Record<FeedbackEvent["type"], FeedbackCue> = {
    normal_hit: "slash_hit",
    enemy_destroyed: "enemy_destroyed",
    last_save: "last_save",
    friendly_hit: "friendly_hit",
    skill_fire: "skill_fire",
    boss_enter: "boss_enter",
    boss_phase: "boss_phase",
    boss_defeat: "boss_defeat",
    reward_reveal: "reward_reveal",
    ui_tap: "ui_tap",
  };
  return cues[type];
}

function hapticFor(type: FeedbackEvent["type"]): "light" | "medium" | "heavy" | undefined {
  if (type === "normal_hit") return "light";
  if (type === "last_save" || type === "boss_defeat") return "heavy";
  if (type === "friendly_hit" || type === "boss_enter" || type === "boss_phase") return "medium";
  return undefined;
}
