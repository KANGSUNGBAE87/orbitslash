import type { SkillId } from "./ModeConfig";
import type { AccuracyKind, DistanceBand, Segment } from "./types";

export interface RankedReplayTrace {
  spawnEvents?: RankedReplaySpawnEvent[];
  hitEvents: RankedReplayHitEvent[];
  killEvents: RankedReplayKillEvent[];
  comboBreakEvents: RankedReplayComboBreakEvent[];
  skillEvents: RankedReplaySkillEvent[];
}

export interface RankedReplaySpawnEvent {
  spawnOrdinal: number;
  enemyType: string;
  spawnAtMs: number;
  startAngleRad: number;
  startRadius: number;
  angularSpeed: number;
  approachSpeed: number;
  source: "wave" | "boss" | "split" | "boss_shard";
  parentSpawnOrdinal?: number;
}

export interface RankedReplayHitEvent {
  eventSequence?: number;
  spawnOrdinal: number;
  hitAtMs: number;
  band: DistanceBand;
  accuracy: AccuracyKind;
  damage: number;
  absorbed?: "shield" | "armor";
  damageMultiplier?: number;
  source?: "slash" | "solar_lance" | "skill";
  skillId?: SkillId;
  segment?: Segment;
}

export interface RankedReplayKillEvent extends Omit<RankedReplayHitEvent, "damage"> {
  damage?: number;
  absorbed?: never;
}

export interface RankedReplayComboBreakEvent {
  atMs: number;
  reason: "miss" | "earth_hit";
}

export interface RankedReplaySkillEvent {
  eventSequence?: number;
  skillId: SkillId;
  atMs: number;
}

export function emptyRankedReplayTrace(): RankedReplayTrace {
  return {
    spawnEvents: [],
    hitEvents: [],
    killEvents: [],
    comboBreakEvents: [],
    skillEvents: [],
  };
}
