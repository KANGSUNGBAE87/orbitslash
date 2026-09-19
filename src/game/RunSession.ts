import { createRunSummary, type RunStartVerification, type RunSummary } from "./RankingSystem";
import type { ModeId, RunEndReason, SkillId } from "./ModeConfig";
import {
  emptyRankedReplayTrace,
  type RankedReplayHitEvent,
  type RankedReplayKillEvent,
  type RankedReplaySpawnEvent,
  type RankedReplayTrace,
} from "./RankedReplayTrace";

export interface RunSessionStart {
  modeId?: ModeId;
  difficulty: string;
  runToken: string;
  seed: number;
  configVersion?: string;
  rankingEligible?: boolean;
  verification?: RunStartVerification;
  issuedAtMs?: number;
  expiresAtMs?: number;
}

export interface RunFinishInput {
  survivalMs: number;
  score: number;
  kills: number;
  bossKills?: number;
  defeatedBossIds?: string[];
  maxCombo: number;
  lastSaveCount: number;
  remainingEnergy: number;
  endReason?: RunEndReason;
}

export class RunSession {
  private skillUse: Partial<Record<SkillId, number>> = {};
  private replayTrace: RankedReplayTrace = emptyRankedReplayTrace();
  private nextSemanticEventSequence = 1;
  private latestHitSequenceBySpawnOrdinal = new Map<number, number>();

  constructor(private readonly start: RunSessionStart) {}

  recordSkillUse(skillId: SkillId, atMs = 0): number {
    const eventSequence = this.issueSemanticEventSequence();
    this.skillUse[skillId] = (this.skillUse[skillId] ?? 0) + 1;
    this.replayTrace.skillEvents.push({ skillId, atMs: Math.max(0, atMs), eventSequence });
    return eventSequence;
  }

  recordSpawn(event: RankedReplaySpawnEvent): void {
    this.replayTrace.spawnEvents ??= [];
    this.replayTrace.spawnEvents.push({ ...event });
  }

  recordHit(event: RankedReplayHitEvent): number {
    const eventSequence = this.issueSemanticEventSequence();
    this.replayTrace.hitEvents.push(cloneHitEvent({ ...event, eventSequence }));
    this.latestHitSequenceBySpawnOrdinal.set(event.spawnOrdinal, eventSequence);
    return eventSequence;
  }

  recordKill(event: Omit<RankedReplayKillEvent, "eventSequence">): number {
    const eventSequence = this.latestHitSequenceBySpawnOrdinal.get(event.spawnOrdinal);
    if (eventSequence == null) {
      throw new Error(`Replay kill for spawn ${event.spawnOrdinal} requires a recorded hit`);
    }
    this.replayTrace.killEvents.push(cloneKillEvent({ ...event, eventSequence }));
    this.latestHitSequenceBySpawnOrdinal.delete(event.spawnOrdinal);
    return eventSequence;
  }

  recordComboBreak(reason: "miss" | "earth_hit", atMs = 0): void {
    this.replayTrace.comboBreakEvents.push({ reason, atMs: Math.max(0, atMs) });
  }

  skillUseSnapshot(): Partial<Record<SkillId, number>> {
    return { ...this.skillUse };
  }

  replayTraceSnapshot(): RankedReplayTrace {
    return {
      spawnEvents: (this.replayTrace.spawnEvents ?? []).map((event) => ({ ...event })),
      hitEvents: this.replayTrace.hitEvents.map(cloneHitEvent),
      killEvents: this.replayTrace.killEvents.map(cloneKillEvent),
      comboBreakEvents: this.replayTrace.comboBreakEvents.map((event) => ({ ...event })),
      skillEvents: this.replayTrace.skillEvents.map((event) => ({ ...event })),
    };
  }

  finish(input: RunFinishInput): RunSummary {
    return createRunSummary({
      ...this.start,
      ...input,
      skillUse: this.skillUse,
    });
  }

  private issueSemanticEventSequence(): number {
    const eventSequence = this.nextSemanticEventSequence;
    this.nextSemanticEventSequence += 1;
    return eventSequence;
  }
}

function cloneHitEvent(event: RankedReplayHitEvent): RankedReplayHitEvent {
  return {
    ...event,
    segment: cloneSegment(event.segment),
  };
}

function cloneKillEvent(event: RankedReplayKillEvent): RankedReplayKillEvent {
  return {
    ...event,
    segment: cloneSegment(event.segment),
  };
}

function cloneSegment<T extends { a: { x: number; y: number; t?: number }; b: { x: number; y: number; t?: number } } | undefined>(
  segment: T,
): T {
  return (segment
    ? {
        a: { ...segment.a },
        b: { ...segment.b },
      }
    : undefined) as T;
}
