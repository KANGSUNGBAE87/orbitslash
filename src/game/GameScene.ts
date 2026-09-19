import { Container, Graphics, Rectangle, Sprite, Texture, type FederatedPointerEvent } from "pixi.js";
import { BASE_WIDTH, BASE_HEIGHT, EARTH_BODY_RADIUS, EARTH_GAMEPLAY_RADIUS, distance, distanceBand } from "./coords";
import { LAYER } from "./layers";
import { Earth } from "./Earth";
import { RemoteConfig } from "./RemoteConfig";
import { createRng } from "./Rng";
import { waveHudState, WaveGenerator } from "./WaveGenerator";
import { ObjectManager } from "./ObjectManager";
import { OrbitSpawner } from "./OrbitSpawner";
import { GestureSystem } from "./GestureSystem";
import { enemyTouchesImpactZone, resolveLineHits, resolveLiveSegmentHits, resolveLiveSegmentDirectionalRejects, multiCutTier, segmentIntersectsCircle } from "./CollisionSystem";
import { ScoringSystem, comboMultiplierFor } from "./ScoringSystem";
import { EnergySystem } from "./EnergySystem";
import { resolveNovaPulseDefinition, SkillSystem } from "./SkillSystem";
import { RunSession } from "./RunSession";
import { Telemetry } from "./Telemetry";
import { gravitonPullMultiplierForEnemy, splitSpawnSpecsForEnemy, stepEnemy, enemyXY } from "./Enemy";
import { readDevNumberParam, readDevStringParam } from "./DevQa";
import { feedbackForHitBand } from "./HitFeedback";
import { requiredDirectionalSlashAngleRad } from "./DirectionalCut";
import { pathLength, trimPathToMaxLength } from "./gesture-helpers";
import { StrokeHitTracker } from "./StrokeHitTracker";
import { enemyHitShakeOffset } from "./HitShake";
import { shouldReserveLiveSlashForSolarLance } from "./SolarLanceReserve";
import { resolveSolarLanceSnapshot } from "./SolarLanceResolver";
import { createGuidedTutorialFlow, reduceTutorialFlow, type TutorialFlowState, type TutorialSignal, type TutorialStep } from "./onboarding/TutorialFlow";
import { guidedStoryScenario } from "./onboarding/GuidedStoryScenario";
import type { FeedbackController } from "../feedback/FeedbackController";
import { shouldReserveLiveSlashForGravitySlow } from "./GravitySlowReserve";
import { groupByComboTimeout } from "./ComboTiming";
import { buildSkillCooldownSlots } from "./SkillCooldownSlots";
import { SKILL_CHARGE_IDS, SkillChargeBank } from "./SkillChargeBank";
import { buildBossHudState } from "./BossHudState";
import { buildTutorialHudState } from "./TutorialHudState";
import { buildBossShardTelegraph, type BossShardTelegraph } from "./BossShardTelegraph";
import { buildRunConfig, type ModeResult, type RunConfig, type RunEndReason, type SkillId } from "./ModeConfig";
import { activeStoryStageForConfig, evaluateModeObjective, isProtectObjectiveObject, type ObjectiveSnapshot } from "./ModeObjectiveSystem";
import { BossEncounterRuntime, bossWaveSpawnIntervalMultiplierForEnemy, bossWeakPointLocalCircles, resolveBossWeakPointHit, type BossShardEvent } from "./BossSystem";
import { modeSpawnIntervalMultiplierAt, resolveModeRuntimeRules, type ModeRuntimeRules } from "./ModeRuleEngine";
import { SpecialObjectRuntime } from "./SpecialObjectRuntime";
import type { SpecialObjectHitEffect, SpecialObjectState, SpecialObjectType } from "./SpecialObjectSystem";
import {
  ENEMY_HIT_SHAKE_DURATION_MS,
  ENEMY_HIT_SHAKE_INTENSITY_PX,
  LIVE_SEGMENT_MIN_LENGTH_PX,
  MISS_COMMIT_DISTANCE_PX,
  NORMAL_SLASH_HIT_INFLATE_PX,
  SAME_STROKE_REHIT_COOLDOWN_MS,
  SAME_STROKE_REHIT_EXIT_MARGIN_PX,
  SOLAR_LANCE_HIT_INFLATE_PX,
  STROKE_TRAIL_MAX_LENGTH_PX,
} from "./input-tuning";
import { SlashTrail } from "../render/SlashTrail";
import { LaserVfx } from "../render/LaserVfx";
import { HitBurst } from "../render/HitBurst";
import { DestructionBurst } from "../render/DestructionBurst";
import { drawDirectionalGuide, drawEnemyVisual, enemyTexture, enemyVisualStyle } from "../render/EnemyVisual";
import { specialObjectAssetUrl } from "../render/SpecialVisual";
import { textureFromAsset } from "../render/TextureAssets";
import { enemySpriteMotion, enemyTravelAngleRad, type EnemySpriteMotion } from "../render/EnemyMotion";
import { Hud } from "../render/Hud";
import { ResultOverlay } from "../render/ResultOverlay";
import { multiCutLabel, lastSaveLabel, multiplierLabel } from "../ui/hud-labels";
import { t } from "../i18n";
import {
  createLocalRunStart,
  LocalBackendAdapter,
  validatePublicRankedStart,
  validatePublicRankedSubmission,
  type BackendAdapter,
  type RankedRunStart,
} from "../platform/BackendAdapter";
import type { PlatformTelemetryContext } from "../platform/PlatformAdapter";
import type { Point, EnemyState, EarthRef, ZoneTable, EnemyTable, ScoringConfig, DifficultyTable, SkillTable, OrbitProfile, WaveTable, HitResult, Segment, SpawnSpec, GestureResult } from "./types";
import type { RankedReplaySpawnEvent } from "./RankedReplayTrace";

// 한 판 플레이 씬 (implementation-plan §1, §4 게임 루프).
// 고정 update 순서 (§4.1): input(이벤트) → spawn → movement → collision(지구) → scoring(이벤트) → render.
//   슬래시 판정은 pointer-up 이벤트에서 즉시 확정(§2.3 Instant Judgment); 연출은 시각 전용.

const GAUGE_MAX = 100;
const NORMAL_SLASH_DAMAGE = 1;
export const DEV_QA_PRESETS = ["directional", "lastSave", "dense", "boss", "blockedBody", "special"] as const;
type DevQaPreset = (typeof DEV_QA_PRESETS)[number];
const DEV_QA_SPECIAL_TYPES: SpecialObjectType[] = ["friendlyRescue", "energyCapsule", "satellite", "empMine"];

const SPECIAL_PENALTY_LABEL_KEYS: Record<SpecialObjectType, string> = {
  friendlyRescue: "special.penalty.friendlyRescue",
  satellite: "special.penalty.satellite",
  energyCapsule: "special.penalty.energyCapsule",
  empMine: "special.penalty.empMine",
};

const SPECIAL_BENEFIT_LABEL_KEYS: Record<SpecialObjectType, string> = {
  friendlyRescue: "special.benefit.friendlyRescue",
  satellite: "special.benefit.satellite",
  energyCapsule: "special.benefit.energyCapsule",
  empMine: "special.benefit.empMine",
};

const SPECIAL_REWARD_LABEL_KEYS: Record<SpecialObjectType, string> = {
  friendlyRescue: "special.rescue.friendlyRescue",
  satellite: "special.rescue.satellite",
  energyCapsule: "special.rescue.energyCapsule",
  empMine: "special.rescue.empMine",
};

function specialPenaltyLabelKey(type?: SpecialObjectType): string {
  return type ? SPECIAL_PENALTY_LABEL_KEYS[type] : "special.penalty";
}

function specialBenefitLabelKey(type?: SpecialObjectType): string {
  return type ? SPECIAL_BENEFIT_LABEL_KEYS[type] : "special.benefit";
}

function specialRewardLabelKey(type?: SpecialObjectType): string {
  return type ? SPECIAL_REWARD_LABEL_KEYS[type] : "special.rescue";
}

interface PendingKill {
  hit: HitResult;
  damage: number;
  spawnOrdinal?: number;
  score: number;
  type: string;
  x: number;
  y: number;
  hitAtMs: number;
  boss?: boolean;
  source?: "slash" | "solar_lance" | "skill";
  skillId?: SkillId;
  segment?: Segment;
}

interface EnemyHitFeedbackState {
  elapsedMs: number;
  durationMs: number;
  intensityPx: number;
}

interface EnemySpriteNode {
  container: Container;
  image: Sprite;
  fallback: Graphics;
  overlay: Graphics;
  type?: string;
  textureReady: boolean;
}

// 적 깊이감: 멀리 0.6 → 가까이 1.3 (design §11.2)
function depthScale(radius: number, R: number, swell: number): number {
  const near = R * 1.2 * swell;
  const far = 950;
  const tt = Math.max(0, Math.min(1, (far - radius) / (far - near)));
  return 0.6 + tt * 0.7;
}

export class GameScene {
  readonly stage: Container;
  private earth: Earth;
  private enemyTrailLayer: Graphics;
  private bossTelegraphLayer: Graphics;
  private enemyLayer: Container;
  private specialLayer: Container;
  private specialGraphics: Graphics;
  private specialSprites = new Map<number, Sprite>();
  private slashTrail: SlashTrail;
  private laser: LaserVfx;
  private hitBurst: HitBurst;
  private destructionBurst: DestructionBurst;
  private hud: Hud;
  private result: ResultOverlay;

  // 데이터 테이블 (RemoteConfig 단일 통로)
  private readonly enemies: EnemyTable;
  private readonly scoringCfg: ScoringConfig;
  private readonly difficulty: DifficultyTable;
  private readonly skillTable: SkillTable;
  private readonly orbits: OrbitProfile[];
  private readonly waves: WaveTable;
  private readonly zones: ZoneTable;
  private runConfig: RunConfig;
  private readonly showResultOverlay: boolean;
  private readonly backend: BackendAdapter;
  private readonly platformTelemetryContext: PlatformTelemetryContext;
  private readonly feedback?: Pick<FeedbackController, "handle">;
  private readonly onUserGesture?: () => void;
  private pendingRunStart?: RankedRunStart;
  private currentRunStart!: RankedRunStart;

  // 시스템 (한 판마다 재생성)
  private objects!: ObjectManager;
  private spawner!: OrbitSpawner;
  private wave!: WaveGenerator;
  private bossRuntime!: BossEncounterRuntime;
  private modeRuntimeRules!: ModeRuntimeRules;
  private specialObjects!: SpecialObjectRuntime;
  private scoring!: ScoringSystem;
  private energy!: EnergySystem;
  private skills!: SkillSystem;
  private runSession!: RunSession;
  private gesture = new GestureSystem();
  onRunEnd: ((result: ModeResult) => void) | null = null;
  onRankedSubmissionUpdate: ((state: NonNullable<ModeResult["rankingSubmissionState"]>) => void) | null = null;
  onGuidedTutorialStep: ((step: TutorialStep) => void) | null = null;

  // 적 스프라이트 (간단 풀)
  private sprites = new Map<number, EnemySpriteNode>();
  private spritePool: EnemySpriteNode[] = [];

  // 런 상태
  private running = false;
  private elapsedMs = 0;
  private skillCharges = new SkillChargeBank([]);
  private gravitySlowRemainingMs = 0;
  private gravitySlowMultiplier = 1;
  private deltaShieldRemainingMs = 0;
  private deltaShieldAbsorbs = 0;
  private deltaShieldDurationMs = 0;
  private deltaShieldMaxAbsorbs = 0;
  private activePointerId: number | null = null;
  private livePoints: Point[] = [];
  private strokeHitTracker = new StrokeHitTracker({
    exitMarginPx: SAME_STROKE_REHIT_EXIT_MARGIN_PX,
    rehitCooldownMs: SAME_STROKE_REHIT_COOLDOWN_MS,
  });
  private strokeHadHit = false;
  private strokeKills: PendingKill[] = [];
  private strokeMoved = false;
  private strokeDirectionalRejects = new Set<number>();
  private enemyHitFeedback = new Map<number, EnemyHitFeedbackState>();
  private bossShardTelegraphs: BossShardTelegraph[] = [];
  private bossKills = 0;
  private defeatedBossIds: string[] = [];
  private protectedCount = 0;
  private failedProtectCount = 0;
  private spawnOrdinalSeq = 0;
  private telemetrySessionTraceId = createTelemetrySessionTraceId();
  private telemetryEventSequence = 0;
  private guidedTutorialFlow: TutorialFlowState | undefined;
  private guidedTutorialInitialStep: TutorialStep | undefined;
  private guidedScenarioEnemyIds = new Set<number>();
  private guidedScenarioSlotByEnemyId = new Map<number, number>();
  private novaPulseSucceeded = false;
  private reducedMotion = false;

  /** Legacy test/HUD bridge. Runtime gain and consume paths use skillCharges directly. */
  private get gauge(): number {
    return this.chargeBank().get("solar_lance");
  }

  private set gauge(value: number) {
    this.chargeBank().fillAll(value);
  }

  private chargeBank(): SkillChargeBank {
    if (!this.skillCharges) {
      this.skillCharges = new SkillChargeBank(this.runConfig?.rules?.enabledSkills ?? SKILL_CHARGE_IDS);
    }
    return this.skillCharges;
  }

  private gainAllSkillCharges(amount: number): void {
    this.chargeBank().gainAll(amount);
  }

  constructor(
    runConfig: RunConfig = buildRunConfig("freeDefense"),
    options: { showResultOverlay?: boolean; backend?: BackendAdapter; runStart?: RankedRunStart; platformTelemetryContext?: PlatformTelemetryContext; feedback?: Pick<FeedbackController, "handle">; onUserGesture?: () => void; reducedMotion?: boolean; guidedTutorialInitialStep?: TutorialStep } = {},
  ) {
    this.runConfig = runConfig;
    this.showResultOverlay = options.showResultOverlay ?? true;
    this.backend = options.backend ?? new LocalBackendAdapter();
    this.platformTelemetryContext = options.platformTelemetryContext ?? { runtime: "web_stub" };
    this.feedback = options.feedback;
    this.onUserGesture = options.onUserGesture;
    this.pendingRunStart = options.runStart;
    this.guidedTutorialInitialStep = options.guidedTutorialInitialStep;
    this.stage = new Container();
    this.stage.sortableChildren = true;

    // 데이터 로드
    this.enemies = RemoteConfig.getEnemies();
    this.scoringCfg = RemoteConfig.getScoring();
    this.difficulty = RemoteConfig.getDifficulty();
    this.skillTable = RemoteConfig.getSkills();
    this.orbits = RemoteConfig.getOrbits();
    this.waves = RemoteConfig.getWaves();
    this.zones = this.difficulty.zones;

    // L0 배경
    const bg = new Graphics();
    drawGameplayBackdrop(bg);
    bg.zIndex = LAYER.BACKGROUND_SPACE;
    this.stage.addChild(bg);

    // L1 별
    const stars = new Graphics();
    drawGameplayStars(stars);
    stars.zIndex = LAYER.STARS_NEBULA;
    this.stage.addChild(stars);

    const orbitGuide = new Graphics();
    drawGameplayOrbitGuide(orbitGuide);
    orbitGuide.zIndex = LAYER.ORBIT_GUIDE;
    this.stage.addChild(orbitGuide);

    // L3~L4 적 잔상/본체 레이어
    this.enemyTrailLayer = new Graphics();
    this.enemyTrailLayer.zIndex = LAYER.ENEMY_TRAILS;
    this.stage.addChild(this.enemyTrailLayer);

    this.bossTelegraphLayer = new Graphics();
    this.bossTelegraphLayer.zIndex = LAYER.EXPLOSION;
    this.stage.addChild(this.bossTelegraphLayer);

    this.enemyLayer = new Container();
    this.enemyLayer.zIndex = LAYER.ENEMIES;
    this.stage.addChild(this.enemyLayer);

    this.specialLayer = new Container();
    this.specialLayer.zIndex = LAYER.FRIENDLY;
    this.specialGraphics = new Graphics();
    this.specialLayer.addChild(this.specialGraphics);
    this.stage.addChild(this.specialLayer);

    // L7 지구
    this.earth = new Earth();
    this.earth.container.zIndex = LAYER.EARTH;
    this.stage.addChild(this.earth.container);

    // L9 슬래시/레이저 VFX
    this.slashTrail = new SlashTrail();
    this.laser = new LaserVfx();
    this.destructionBurst = new DestructionBurst();
    this.hitBurst = new HitBurst();
    this.stage.addChild(this.slashTrail.container, this.laser.container, this.destructionBurst.container, this.hitBurst.container);

    // L11~ HUD + 결과 오버레이
    this.hud = new Hud();
    this.result = new ResultOverlay();
    this.result.onRestart = () => this.restart();
    this.stage.addChild(this.hud.container, this.result.container);
    this.setReducedMotion(options.reducedMotion ?? false);

    // 포인터 입력 (게임필드 = 1080x1920 좌표계)
    this.stage.eventMode = "static";
    this.stage.hitArea = new Rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT);
    this.stage.on("pointerdown", this.onPointerDown, this);
    this.stage.on("pointermove", this.onPointerMove, this);
    this.stage.on("pointerup", this.onPointerUp, this);
    this.stage.on("pointerupoutside", this.onPointerUp, this);
    this.stage.on("pointercancel", this.onPointerCancel, this);

    this.startRun();
  }

  /** Gameplay remains intact; only non-essential time-based visual effects are suppressed. */
  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    const visible = !enabled;
    this.slashTrail.container.visible = visible;
    this.laser.container.visible = visible;
    this.destructionBurst.container.visible = visible;
    this.hitBurst.container.visible = visible;
  }

  // ── 런 수명주기 ───────────────────────────────────────────────────────────

  startWithRunConfig(runConfig: RunConfig, runStart?: RankedRunStart): void {
    this.runConfig = runConfig;
    this.pendingRunStart = runStart;
    this.restart();
  }

  private difficultyDef(): { earthEnergy: number; gravitySwell: number } {
    return this.difficulty[this.runConfig.difficulty] as unknown as { earthEnergy: number; gravitySwell: number };
  }

  private startRun(): void {
    this.guidedTutorialFlow = activeStoryStageForConfig(this.runConfig)?.id === "story-1"
      ? createGuidedTutorialFlow(this.guidedTutorialInitialStep)
      : undefined;
    this.guidedScenarioEnemyIds?.clear();
    this.guidedScenarioSlotByEnemyId?.clear();
    const diff = this.difficultyDef();
    let seedOverride: number | undefined;
    let gaugeOverride: number | undefined;
    let qaPreset: DevQaPreset | undefined;
    if (this.runConfig.rules.allowDevQaHarness && import.meta.env.DEV && typeof window !== "undefined") {
      const search = window.location.search;
      seedOverride = readDevNumberParam(search, "seed", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
      gaugeOverride = readDevNumberParam(search, "qaGauge", { min: 0, max: GAUGE_MAX });
      qaPreset = readDevStringParam(search, "qaPreset", DEV_QA_PRESETS);
    }
    this.objects = new ObjectManager();
    this.spawner = new OrbitSpawner(this.enemies, this.objects);
    const runStart = this.consumeRunStart(seedOverride);
    this.currentRunStart = runStart;
    this.runSession = new RunSession(runStart);
    this.telemetrySessionTraceId = createTelemetrySessionTraceId();
    this.telemetryEventSequence = 0;
    this.modeRuntimeRules = resolveModeRuntimeRules(this.runConfig);
    this.wave = new WaveGenerator(
      createRng(runStart.seed),
      {
        difficulty: runStart.difficulty,
        spawnIntervalMultiplierForElapsed: (elapsedMs) => modeSpawnIntervalMultiplierAt(this.modeRuntimeRules, elapsedMs) * this.bossWaveSpawnIntervalMultiplier(),
        enemyWeightBias: this.modeRuntimeRules.enemyWeightBias,
      },
      this.enemies,
      this.difficulty,
      this.orbits,
      this.waves,
    );
    this.bossRuntime = new BossEncounterRuntime({
      enabled: this.runConfig.rules.bossPolicy.enabled,
      bossEveryMs: this.modeRuntimeRules.periodicBossEveryMs ?? 0,
      bossEnemyType: this.runConfig.rules.bossPolicy.bossEnemyType,
      sequence: this.modeRuntimeRules.bossSequence,
      firstBossDelayMs: this.modeRuntimeRules.bossFirstDelayMs,
      respawnDelayMs: this.modeRuntimeRules.bossRespawnDelayMs,
    });
    const specialObjectPolicy =
      qaPreset === "special"
        ? { friendlyRescue: true, energyCapsule: true, satellite: true, empMine: true }
        : this.runConfig.rules.specialObjectPolicy;
    this.specialObjects = new SpecialObjectRuntime(createRng(runStart.seed ^ 0x9e3779b9), specialObjectPolicy, {
      maxActive: qaPreset === "special" ? DEV_QA_SPECIAL_TYPES.length : this.modeRuntimeRules.specialObjectMaxActive,
      ...(qaPreset === "special"
        ? {
            firstSpawnMs: 0,
            spawnIntervalMs: 1,
            forcedTypes: DEV_QA_SPECIAL_TYPES,
          }
        : {}),
    });
    this.scoring = new ScoringSystem(this.scoringCfg);
    this.energy = new EnergySystem(diff.earthEnergy);
    this.skills = new SkillSystem(this.skillTable);
    this.skillCharges = new SkillChargeBank(this.runConfig.rules.enabledSkills);
    this.skillCharges.fillAll(gaugeOverride ?? (this.skillTable._debug.instantFillGauge ? GAUGE_MAX : 0));
    this.novaPulseSucceeded = false;
    this.elapsedMs = 0;
    this.gravitySlowRemainingMs = 0;
    this.gravitySlowMultiplier = 1;
    this.deltaShieldRemainingMs = 0;
    this.deltaShieldAbsorbs = 0;
    this.deltaShieldDurationMs = 0;
    this.deltaShieldMaxAbsorbs = 0;
    this.bossKills = 0;
    this.defeatedBossIds = [];
    this.protectedCount = 0;
    this.failedProtectCount = 0;
    this.spawnOrdinalSeq = 0;
    this.activePointerId = null;
    this.livePoints = [];
    this.slashTrail.setLive(this.livePoints);
    this.running = true;
    this.enemyHitFeedback.clear();
    this.bossShardTelegraphs = [];
    this.enemyTrailLayer.clear();
    this.bossTelegraphLayer?.clear();
    this.specialGraphics?.clear();
    this.clearSpecialSprites();
    this.earth.setVisualState("healthy");
    this.resetStrokeState();
    this.spawnDevQaPreset(qaPreset);
    this.spawnGuidedStoryScenario();
  }

  private guidedStoryScenarioActive(): boolean {
    const stage = activeStoryStageForConfig(this.runConfig);
    return stage?.id === "story-1" && this.guidedTutorialFlow != null && this.guidedTutorialFlow.step !== "reward" && this.guidedTutorialFlow.step !== "complete";
  }

  /** Story 1 is intentionally scripted, so its teaching targets are not mixed with random waves. */
  private spawnGuidedStoryScenario(): void {
    const stage = activeStoryStageForConfig(this.runConfig);
    const flow = this.guidedTutorialFlow;
    if (stage?.id !== "story-1" || !flow) return;
    const scenario = guidedStoryScenario(stage.id).find((entry) => entry.step === flow.step);
    if (!scenario) return;
    const guidedAlive = this.guidedScenarioEnemies();
    const occupiedSlots = new Set(guidedAlive.flatMap((enemy) => {
      const slot = this.guidedScenarioSlotByEnemyId.get(enemy.id);
      return slot == null ? [] : [slot];
    }));
    const missingSlots = Array.from({ length: scenario.count }, (_, slot) => slot)
      .filter((slot) => !occupiedSlots.has(slot));
    if (scenario.target === "solar_line") this.skillCharges.set("solar_lance", GAUGE_MAX);
    if (missingSlots.length === 0) return;

    const make = (startAngleRad: number, startRadius: number): SpawnSpec => {
      const def = this.enemies.basic_meteor!;
      return {
        enemyType: "basic_meteor",
        spawnAtMs: this.elapsedMs,
        startAngleRad,
        startRadius,
        angularSpeed: def.angularSpeed,
        approachSpeed: def.approachSpeed,
      };
    };
    const spawns = missingSlots.map((slot) => scenario.target === "last_save_meteor"
      ? make(-Math.PI / 2, scenario.startRadius ?? 300)
      : scenario.target === "solar_line"
        ? make(slot % 2 === 0 ? 0 : Math.PI, 300)
        : make(-Math.PI / 2 + slot * 0.35, 420));
    const ordered = this.spawnWithReplay(spawns);
    const spawnedSlotByOrdinal = new Map<number, number>();
    ordered.forEach((spawn, index) => {
      const slot = missingSlots[index];
      if (spawn.spawnOrdinal != null && slot != null) spawnedSlotByOrdinal.set(spawn.spawnOrdinal, slot);
    });
    for (const enemy of this.objects.getAlive()) {
      if (enemy.spawnOrdinal == null) continue;
      const slot = spawnedSlotByOrdinal.get(enemy.spawnOrdinal);
      if (slot == null) continue;
      enemy.hp = 1;
      enemy.maxHp = 1;
      this.guidedScenarioEnemyIds.add(enemy.id);
      this.guidedScenarioSlotByEnemyId.set(enemy.id, slot);
    }
  }

  private clearGuidedStoryScenario(): void {
    for (const enemy of this.guidedScenarioEnemies()) {
      this.objects.kill(enemy.id);
      this.removeSprite(enemy.id);
    }
    this.guidedScenarioEnemyIds.clear();
    this.guidedScenarioSlotByEnemyId.clear();
    this.objects.prune();
  }

  private guidedScenarioEnemies(): EnemyState[] {
    const alive = this.objects.getAlive();
    const aliveById = new Map(alive.map((enemy) => [enemy.id, enemy] as const));
    for (const id of this.guidedScenarioEnemyIds) {
      if (!aliveById.has(id)) {
        this.guidedScenarioEnemyIds.delete(id);
        this.guidedScenarioSlotByEnemyId.delete(id);
      }
    }
    return [...this.guidedScenarioEnemyIds].flatMap((id) => {
      const enemy = aliveById.get(id);
      return enemy ? [enemy] : [];
    });
  }

  private consumeRunStart(seedOverride: number | undefined): RankedRunStart {
    const provided = this.pendingRunStart;
    this.pendingRunStart = undefined;
    if (provided) {
      const publicRanked = validatePublicRankedStart(provided);
      if (publicRanked.ok) {
        this.runConfig = buildRunConfig("ranked", {
          difficulty: provided.difficulty,
          seed: provided.seed,
          configVersion: provided.configVersion,
        });
        return provided;
      }
      return createLocalRunStart(this.runConfig.difficulty, seedOverride ?? provided.seed, this.runConfig.modeId);
    }
    return createLocalRunStart(this.runConfig.difficulty, seedOverride ?? this.runConfig.seed, this.runConfig.modeId);
  }

  private spawnDevQaPreset(preset: DevQaPreset | undefined): void {
    if (!preset) return;
    const make = (enemyType: string, startAngleRad: number, startRadius: number, spawnAtMs = 0): SpawnSpec => {
      const def = this.enemies[enemyType]!;
      return {
        enemyType,
        spawnAtMs,
        startAngleRad,
        startRadius,
        angularSpeed: def.angularSpeed,
        approachSpeed: def.approachSpeed,
      };
    };

    if (preset === "directional") {
      this.spawnWithReplay([
        make("directional_comet", 0, 360),
        make("basic_meteor", Math.PI * 0.7, 430),
      ]);
      return;
    }

    if (preset === "lastSave") {
      this.spawnWithReplay([make("basic_meteor", 0, EARTH_GAMEPLAY_RADIUS * 1.75)]);
      return;
    }

    if (preset === "boss") {
      this.spawnWithReplay([make("ringed_destroyer", -Math.PI / 2, 390)]);
      this.bossRuntime.recordBossSpawned("ringed_destroyer");
      return;
    }

    if (preset === "blockedBody") {
      const angle = -Math.PI / 2;
      const radius = 390;
      this.spawnWithReplay([make("ringed_destroyer", angle, radius)]);
      this.bossRuntime.recordBossSpawned("ringed_destroyer");
      const spawnedBoss = this.objects.getAlive().find((enemy) => enemy.type === "ringed_destroyer" && enemy.boss);
      if (spawnedBoss) {
        this.applyHits([
          {
            enemyId: spawnedBoss.id,
            band: "outer",
            accuracy: "normal",
            damageMultiplier: 0,
            blocked: true,
            blockReason: "boss_body_locked",
          },
        ], NORMAL_SLASH_DAMAGE, this.replayNowMs(), "slash");
      } else {
        const earth = this.earth.ref();
        this.triggerBlockedBossBodyFeedback(earth.cx + Math.cos(angle) * radius, earth.cy + Math.sin(angle) * radius);
      }
      return;
    }

    if (preset === "special") {
      this.specialObjects.next(0, { energy: this.energy.getEnergy(), maxEnergy: this.energy.getMax() });
      this.specialObjects.next(1, { energy: this.energy.getEnergy(), maxEnergy: this.energy.getMax() });
      this.specialObjects.next(2, { energy: this.energy.getEnergy(), maxEnergy: this.energy.getMax() });
      this.specialObjects.next(3, { energy: this.energy.getEnergy(), maxEnergy: this.energy.getMax() });
      return;
    }

    this.spawnWithReplay([
      make("small_meteor", 0, 420),
      make("basic_meteor", Math.PI * 0.35, 460),
      make("fast_comet", Math.PI * 0.72, 500),
      make("iron_planet", Math.PI * 0.92, 520),
      make("heavy_asteroid", Math.PI * 1.1, 520),
      make("directional_comet", Math.PI * 1.45, 560),
      make("ancient_planet", Math.PI * 1.75, 600),
    ]);
  }

  private withSpawnOrdinals(spawns: SpawnSpec[]): SpawnSpec[] {
    return spawns
      .map((spawn, index) => ({ spawn, index }))
      .sort((a, b) => a.spawn.spawnAtMs - b.spawn.spawnAtMs || a.index - b.index)
      .map(({ spawn }) => ({ ...spawn, spawnOrdinal: ++this.spawnOrdinalSeq }));
  }

  private spawnWithReplay(
    spawns: SpawnSpec[],
    sourceFor: (spawn: SpawnSpec) => RankedReplaySpawnEvent["source"] = (spawn) => this.replaySpawnSource(spawn),
    parentSpawnOrdinal?: number,
  ): SpawnSpec[] {
    const ordered = this.withSpawnOrdinals(spawns);
    this.recordReplaySpawns(ordered, sourceFor, parentSpawnOrdinal);
    this.spawner.spawn(ordered);
    return ordered;
  }

  private recordReplaySpawns(
    spawns: readonly SpawnSpec[],
    sourceFor: (spawn: SpawnSpec) => RankedReplaySpawnEvent["source"] = (spawn) => this.replaySpawnSource(spawn),
    parentSpawnOrdinal?: number,
  ): void {
    if (this.runConfig.modeId !== "ranked") return;
    for (const spawn of spawns) {
      if (spawn.spawnOrdinal == null) continue;
      this.runSession.recordSpawn({
        spawnOrdinal: spawn.spawnOrdinal,
        parentSpawnOrdinal,
        source: sourceFor(spawn),
        enemyType: spawn.enemyType,
        spawnAtMs: spawn.spawnAtMs,
        startAngleRad: spawn.startAngleRad,
        startRadius: spawn.startRadius,
        angularSpeed: spawn.angularSpeed,
        approachSpeed: spawn.approachSpeed,
      });
    }
  }

  private replaySpawnSource(spawn: SpawnSpec): RankedReplaySpawnEvent["source"] {
    return this.enemies[spawn.enemyType]?.boss ? "boss" : "wave";
  }

  private replayNowMs(): number {
    return Number.isFinite(this.elapsedMs) ? Math.max(0, this.elapsedMs) : 0;
  }

  private movementDtForEnemy(enemy: EnemyState, movementDtMs: number, aliveBeforeMovement: readonly EnemyState[]): number {
    const gravitonMultiplier = this.runConfig.modeId === "ranked" ? 1 : gravitonPullMultiplierForEnemy(enemy, aliveBeforeMovement);
    return movementDtMs * gravitonMultiplier;
  }

  private recordSkillUse(skillId: SkillId): void {
    if (Number.isFinite(this.elapsedMs)) {
      this.runSession.recordSkillUse(skillId, this.replayNowMs());
      return;
    }
    this.runSession.recordSkillUse(skillId);
  }

  private restart(): void {
    for (const [, g] of this.sprites) this.releaseSprite(g);
    this.sprites.clear();
    this.slashTrail.release([]);
    this.enemyTrailLayer.clear();
    this.result.hide();
    this.destructionBurst.clear();
    this.hitBurst.clear();
    Telemetry.flush();
    this.startRun();
  }

  private endRun(endReason: RunEndReason = "earth_destroyed"): void {
    this.running = false;
    const snap = this.scoring.snapshot();
    const finalEndReason = this.resolveObjectiveEndReason(endReason, snap);
    const summary = this.runSession.finish({
      survivalMs: this.elapsedMs,
      score: snap.score,
      kills: snap.kills,
      bossKills: this.bossKills,
      defeatedBossIds: this.defeatedBossIds,
      maxCombo: snap.maxCombo,
      lastSaveCount: snap.lastSaveCount,
      remainingEnergy: this.energy.getEnergy(),
      endReason: finalEndReason,
    });
    const rankedSubmission =
      summary.modeId === "ranked"
        ? validatePublicRankedSubmission(summary, this.currentRunStart, Date.now(), this.runSession.replayTraceSnapshot())
        : ({ ok: false, reason: "not_ranked_mode" } as const);
    const rankingEligible = this.runConfig.rules.rankingEligible && rankedSubmission.ok;
    if (summary.modeId === "ranked") {
      Telemetry.track("ranked_submission_validation", {
        ok: rankedSubmission.ok,
        reason: rankedSubmission.ok ? "ok" : rankedSubmission.reason,
        configVersion: this.runConfig.configVersion,
      });
      if (rankingEligible) {
        void this.backend
          .submitRankedRun(summary, this.runSession.replayTraceSnapshot())
          .then((result) => {
            Telemetry.track("ranked_submission_result", result);
            this.flushTelemetry();
            this.onRankedSubmissionUpdate?.(result.accepted ? "submitted" : "failed");
          })
          .catch(() => {
            Telemetry.track("ranked_submission_result", { accepted: false, reason: "ranked_submit_failed" });
            this.flushTelemetry();
            this.onRankedSubmissionUpdate?.("failed");
          });
      }
    }
    const modeResult: ModeResult = {
      modeId: summary.modeId,
      difficulty: this.runConfig.difficulty,
      endReason: finalEndReason,
      survivalMs: summary.survivalMs,
      score: summary.score,
      kills: summary.kills,
      bossKills: this.bossKills,
      defeatedBossIds: [...this.defeatedBossIds],
      lastSaveCount: summary.lastSaveCount,
      protectedCount: this.protectedCount,
      failedProtectCount: this.failedProtectCount,
      activeStoryStageId: activeStoryStageForConfig(this.runConfig)?.id,
      activeDailyModifierId: this.runConfig.rules.activeDailyModifierId,
      objectiveOutcome: this.objectiveOutcome(finalEndReason),
      rankingSubmissionState: this.rankingSubmissionState(summary.modeId, rankingEligible),
      maxCombo: summary.maxCombo,
      remainingEnergy: summary.remainingEnergy,
      rankingEligible,
      retryDestination:
        summary.modeId === "ranked" || finalEndReason === "timer_expired" || finalEndReason === "stage_objective_complete"
          ? "modeSelect"
          : "sameRun",
    };
    Telemetry.track("death", { modeId: summary.modeId, difficulty: summary.difficulty, score: summary.score, survivalMs: summary.survivalMs, endReason: finalEndReason });
    this.flushTelemetry();
    if (this.showResultOverlay) this.result.show(snap, this.elapsedMs);
    this.onRunEnd?.(modeResult);
  }

  private flushTelemetry(): void {
    const events = Telemetry.flush();
    const telemetryContext = this.platformTelemetryContext;
    for (const event of events) {
      void this.backend.trackEvent(event.event, {
        ...event.props,
        modeId: event.props.modeId ?? this.runConfig.modeId,
        difficulty: event.props.difficulty ?? this.runConfig.difficulty,
        runToken: this.currentRunStart?.runToken,
        sessionTraceId: this.telemetrySessionTraceId,
        screen: "game",
        ...telemetryContext,
        eventSequence: ++this.telemetryEventSequence,
      });
    }
  }

  private resolveObjectiveEndReason(endReason: RunEndReason, snap = this.scoring.snapshot()): RunEndReason {
    const objective = evaluateModeObjective(this.runConfig, this.objectiveSnapshot(snap, endReason));
    if (objective.status === "failed") return objective.endReason;
    if (objective.status === "passed" && endReason !== "earth_destroyed") return objective.endReason;
    return endReason;
  }

  private objectiveOutcome(endReason: RunEndReason): ModeResult["objectiveOutcome"] {
    if (endReason === "stage_objective_complete" || endReason === "boss_sequence_complete") return "cleared";
    if (endReason === "daily_challenge_failed" || endReason === "earth_destroyed") return "failed";
    if (endReason === "timer_expired") return "survived";
    return undefined;
  }

  private rankingSubmissionState(modeId: string, rankingEligible: boolean): ModeResult["rankingSubmissionState"] {
    if (modeId !== "ranked") return "notEligible";
    if (rankingEligible) return "pending";
    return "localOnly";
  }

  private currentObjectiveEndReason(): RunEndReason | null {
    const objective = evaluateModeObjective(this.runConfig, this.objectiveSnapshot(this.scoring.snapshot()));
    if (objective.status === "in_progress") return null;
    return objective.endReason;
  }

  private objectiveSnapshot(snap = this.scoring.snapshot(), endReason?: RunEndReason): ObjectiveSnapshot {
    return {
      elapsedMs: this.elapsedMs,
      ...(endReason ? { endReason } : {}),
      kills: snap.kills,
      maxCombo: snap.maxCombo,
      lastSaveCount: snap.lastSaveCount,
      remainingEnergy: this.energy.getEnergy(),
      skillUse: this.runSession.skillUseSnapshot(),
      protectedCount: this.protectedCount,
      failedProtectCount: this.failedProtectCount,
      bossKills: this.bossKills,
    };
  }

  // ── 포인터 입력 (Instant Judgment) ───────────────────────────────────────

  private toPoint(e: FederatedPointerEvent): Point {
    const local = e.getLocalPosition(this.stage);
    return { x: local.x, y: local.y, t: performance.now() };
  }

  private pointerId(e: FederatedPointerEvent): number {
    return e.pointerId ?? 0;
  }

  private isActivePointer(e: FederatedPointerEvent): boolean {
    return this.activePointerId !== null && this.activePointerId === this.pointerId(e);
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.running) return;
    if (this.activePointerId !== null) return;
    this.activePointerId = this.pointerId(e);
    this.onUserGesture?.();
    const p = this.toPoint(e);
    this.gesture.onPointerDown(p);
    this.resetStrokeState();
    this.livePoints = [p];
    this.slashTrail.setLive(this.livePoints);
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.running || !this.isActivePointer(e) || this.livePoints.length === 0) return;
    const p = this.toPoint(e);
    const prev = this.livePoints[this.livePoints.length - 1]!;
    this.gesture.onPointerMove(p);
    this.livePoints.push(p);
    this.livePoints = trimPathToMaxLength(this.livePoints, STROKE_TRAIL_MAX_LENGTH_PX);
    this.slashTrail.setLive(this.livePoints);

    const seg: Segment = { a: prev, b: p };
    if (Math.hypot(p.x - prev.x, p.y - prev.y) >= LIVE_SEGMENT_MIN_LENGTH_PX) {
      this.strokeMoved = true;
    }
    if (!this.strokeMoved) return;

    const earth = this.earth.ref();
    if (this.shouldReserveStrokeForSolarLance(this.livePoints, earth)) return;
    if (this.shouldReserveStrokeForGravitySlow(this.livePoints, earth)) return;
    this.resolveLiveSlashSegment(seg, earth);
  }

  private onPointerUp(e: FederatedPointerEvent): void {
    if (!this.isActivePointer(e)) return;
    if (!this.running || this.livePoints.length === 0) {
      this.activePointerId = null;
      return;
    }
    try {
      const earth = this.earth.ref();
      const g = this.gesture.onPointerUp(this.toPoint(e), earth);
      this.livePoints = [];
      this.slashTrail.release(g.points);
      this.resolveInput(g.points, earth);
      this.resetStrokeState();
    } finally {
      this.activePointerId = null;
    }
  }

  private onPointerCancel(e: FederatedPointerEvent): void {
    if (!this.isActivePointer(e)) return;
    this.cancelActivePointer();
  }

  /** Clears stale gesture state before a hidden WebView can resume. */
  cancelActivePointer(): void {
    this.activePointerId = null;
    this.livePoints = [];
    this.slashTrail.setLive(this.livePoints);
    this.resetStrokeState();
  }

  /** release-time 스킬/정산 판정. 일반 베기 contact hit는 pointer-move에서 처리한다. */
  private resolveInput(points: Point[], earth: EarthRef): void {
    const committedMovement = pathLength(points) >= MISS_COMMIT_DISTANCE_PX;
    const gesture = this.gestureResultFromPoints(points, earth);
    const act = this.skillEnabled("solar_lance") ? this.skills.trySolarLance(gesture, { earth, gauge: this.chargeBank().get("solar_lance"), screenShortSide: BASE_WIDTH }) : null;

    if (act) {
      const guidedSolarTraining = this.guidedTutorialFlow?.step === "solar_lance";
      const guidedTargetsBefore = guidedSolarTraining
        ? new Set(this.guidedScenarioEnemies().map((enemy) => enemy.id))
        : new Set<number>();
      if (!this.skillTable._debug.infiniteGauge) {
        this.chargeBank().consume("solar_lance");
      }
      this.recordSkillUse("solar_lance");
      Telemetry.track("skill_fire", { skillId: "solar_lance" });
      const aliveEnemies = this.objects.getAlive();
      const aliveSpecialObjects = this.specialObjects?.getAlive() ?? [];
      const lanceResolution = resolveSolarLanceSnapshot(
        act.vfxLine,
        aliveEnemies.map((enemy) => {
          const position = enemyXY(enemy);
          return { id: enemy.id, x: position.x, y: position.y, radiusPx: enemy.radiusPx * this.enemyVisualScale(enemy) };
        }),
        aliveSpecialObjects,
      );
      const allowedEnemyIds = new Set(lanceResolution.enemyIds);
      this.laser.fire(lanceResolution.vfxLine); // 연출과 판정은 같은 절단선 사용
      const lanceKills = this.applyHits(
        this.applyBossWeakPointAccuracy(resolveLineHits(lanceResolution.vfxLine, aliveEnemies, earth.cx, earth.cy, earth.r, this.zones, {
          hitRadiusInflatePx: SOLAR_LANCE_HIT_INFLATE_PX,
          hitRadiusScaleForEnemy: (enemy) => this.enemyVisualScale(enemy),
        }).filter((hit) => allowedEnemyIds.has(hit.enemyId)), lanceResolution.vfxLine, earth),
        this.skillTable.solar_lance.hitDamage ?? NORMAL_SLASH_DAMAGE,
        this.replayNowMs(),
        "solar_lance",
        lanceResolution.vfxLine,
        "solar_lance",
      );
      this.commitKills(lanceKills, earth, false);
      this.resolveSpecialIds(lanceResolution.specialObjectIds);
      this.objects.prune();
      if (guidedSolarTraining) {
        const killedGuidedTargets = lanceKills.filter((kill) => guidedTargetsBefore.has(kill.hit.enemyId)).length;
        if (guidedTargetsBefore.size > 0 && killedGuidedTargets === guidedTargetsBefore.size) {
          this.bossRuntime?.deferUntil(this.elapsedMs);
          this.specialObjects?.deferUntil(this.elapsedMs);
          this.advanceGuidedTutorial({ type: "skill_fired", skillId: "solar_lance" });
        } else {
          this.chargeBank().set("solar_lance", GAUGE_MAX);
          this.skills.resetCooldown("solar_lance");
          this.spawnGuidedStoryScenario();
        }
      }
      return;
    }

    const nova = this.skillEnabled("nova_pulse") ? (this.skills.tryNovaPulse?.(gesture, { earth, gauge: this.chargeBank().get("nova_pulse"), screenShortSide: BASE_WIDTH }) ?? null) : null;
    if (nova) {
      if (!this.skillTable._debug.infiniteGauge) {
        this.chargeBank().consume("nova_pulse");
      }
      this.novaPulseSucceeded = true;
      this.recordSkillUse("nova_pulse");
      Telemetry.track("skill_fire", { skillId: "nova_pulse" });
      const kills = this.applyHits(this.resolveNovaPulseHits(earth, nova.radiusPx, nova.pushPx, nova.targetCap), nova.damage, this.replayNowMs(), "skill", undefined, "nova_pulse");
      this.commitKills(kills, earth, false);
      this.destructionBurst.spawn(earth.cx, earth.cy, {
        color: 0x93f7ff,
        secondaryColor: 0xffffff,
        radius: nova.radiusPx,
        particleCount: 34,
        lifeMs: 620,
      });
      this.hitBurst.spawn(earth.cx, earth.cy, t("skill.nova_pulse"), 0x93f7ff, nova.radiusPx, false, {
        labelScale: 0.9,
        ringWidth: 5,
        lifeMs: 640,
      });
      this.hud.flashBanner(t("skill.nova_pulse"), 0x93f7ff);
      this.objects.prune();
      return;
    }

    const orbital = this.skillEnabled("orbital_cut") ? (this.skills.tryOrbitalCut?.(gesture, { earth, gauge: this.chargeBank().get("orbital_cut"), screenShortSide: BASE_WIDTH }) ?? null) : null;
    if (orbital) {
      if (!this.skillTable._debug.infiniteGauge) {
        this.chargeBank().consume("orbital_cut");
      }
      this.recordSkillUse("orbital_cut");
      Telemetry.track("skill_fire", { skillId: "orbital_cut" });
      const hits = this.resolveOrbitalCutHits(earth, orbital.radiusPx);
      const kills = this.applyHits(hits, orbital.damage, this.replayNowMs(), "skill", undefined, "orbital_cut");
      this.commitKills(kills, earth, false);
      this.destructionBurst.spawn(earth.cx, earth.cy, {
        color: 0xffc14d,
        secondaryColor: 0xffffff,
        radius: orbital.radiusPx,
        particleCount: 42,
        lifeMs: 760,
      });
      this.hitBurst.spawn(earth.cx, earth.cy, t("skill.orbital_cut"), 0xffc14d, orbital.radiusPx, false, {
        labelScale: 0.95,
        ringWidth: 7,
        lifeMs: 700,
      });
      this.hud.flashBanner(t("skill.orbital_cut"), 0xffc14d);
      this.objects.prune();
      return;
    }

    const shield = this.skillEnabled("delta_shield") ? (this.skills.tryDeltaShield?.(gesture, { earth, gauge: this.chargeBank().get("delta_shield"), screenShortSide: BASE_WIDTH }) ?? null) : null;
    if (shield) {
      if (!this.skillTable._debug.infiniteGauge) {
        this.chargeBank().consume("delta_shield");
      }
      this.deltaShieldRemainingMs = shield.durationMs;
      this.deltaShieldAbsorbs = shield.absorbCount;
      this.deltaShieldDurationMs = shield.durationMs;
      this.deltaShieldMaxAbsorbs = shield.absorbCount;
      this.recordSkillUse("delta_shield");
      Telemetry.track("skill_fire", { skillId: "delta_shield" });
      this.hitBurst.spawn(earth.cx, earth.cy, t("skill.delta_shield"), 0x93c5fd, EARTH_BODY_RADIUS * 2.1, false, {
        labelScale: 0.95,
        ringWidth: 5,
        lifeMs: 760,
      });
      this.hud.flashBanner(t("skill.delta_shield"), 0x93c5fd);
      this.objects.prune();
      return;
    }

    const slow = this.skillEnabled("gravity_slow") ? this.skills.tryGravitySlow(gesture, { earth, gauge: this.chargeBank().get("gravity_slow"), screenShortSide: BASE_WIDTH }) : null;
    if (slow) {
      if (!this.skillTable._debug.infiniteGauge) {
        this.chargeBank().consume("gravity_slow");
      }
      this.gravitySlowRemainingMs = slow.durationMs;
      this.gravitySlowMultiplier = slow.slowMultiplier;
      this.recordSkillUse("gravity_slow");
      Telemetry.track("skill_fire", { skillId: "gravity_slow" });
      this.hitBurst.spawn(earth.cx, earth.cy, t("skill.gravity_slow"), 0x7dd3fc, EARTH_BODY_RADIUS * 1.8, false, {
        labelScale: 0.95,
        ringWidth: 4,
        lifeMs: 700,
      });
      this.hud.flashBanner(t("skill.gravity_slow"), 0x7dd3fc);
      this.objects.prune();
      return;
    }

    this.showNovaPulseNearMiss(gesture, earth);

    if (this.strokeKills.length > 0) {
      this.commitKills(this.strokeKills, earth, true);
      if (committedMovement) this.advanceGuidedTutorial({ type: "slash_committed" });
    } else if (committedMovement && !this.strokeHadHit) {
      this.advanceGuidedTutorial({ type: "slash_committed" });
      this.scoring.onMiss(); // 탭/짧은 입력은 neutral, 의미 있는 빈 슬래시만 콤보 끊김.
      this.runSession.recordComboBreak("miss", this.replayNowMs());
      Telemetry.track("combo_break", { reason: "miss" });
    }
    this.objects.prune();
  }

  private showNovaPulseNearMiss(gesture: GestureResult, earth: EarthRef): void {
    if (!this.skillEnabled("nova_pulse") || this.novaPulseSucceeded) return;
    const evaluation = this.skills.evaluateNovaPulse?.(gesture, { earth, gauge: this.chargeBank().get("nova_pulse"), screenShortSide: BASE_WIDTH });
    if (!evaluation || evaluation.ok || !evaluation.candidate) return;
    this.hud.flashBanner(t(`skillTutorial.novaPulse.feedback.${evaluation.reason}`), 0x93f7ff);
  }

  private resetStrokeState(): void {
    this.strokeHitTracker.reset();
    this.strokeHadHit = false;
    this.strokeKills = [];
    this.strokeMoved = false;
    this.strokeDirectionalRejects.clear();
  }

  private resolveLiveSlashSegment(segment: Segment, earth: EarthRef): void {
    if (this.resolveSpecialSegment(segment)) return;
    const hits = resolveLiveSegmentHits(segment, this.objects.getAlive(), earth.cx, earth.cy, earth.r, this.zones, {
      minSegmentLengthPx: LIVE_SEGMENT_MIN_LENGTH_PX,
      hitRadiusInflatePx: NORMAL_SLASH_HIT_INFLATE_PX,
      hitRadiusScaleForEnemy: (enemy) => this.enemyVisualScale(enemy),
      canHitEnemy: (enemy) => this.strokeHitTracker.canHit(enemy.id, segment.b.t),
    });
    this.applyBossWeakPointAccuracy(hits, segment, earth);
    this.spawnDirectionalRejectFeedback(segment, earth);
    if (hits.length === 0) {
      this.updateStrokeHitRearm(segment);
      return;
    }

    const kills = this.applyHits(hits, NORMAL_SLASH_DAMAGE, this.replayNowMs(), "slash", segment);
    for (const kill of kills) {
      this.spawnKillFeedback(kill);
    }
    this.commitKills(kills, earth, true);
    this.updateStrokeHitRearm(segment);
    this.objects.prune();
  }

  private spawnDirectionalRejectFeedback(segment: Segment, earth: EarthRef): void {
    const rejects = resolveLiveSegmentDirectionalRejects(segment, this.objects.getAlive(), earth.cx, earth.cy, earth.r, this.zones, {
      minSegmentLengthPx: LIVE_SEGMENT_MIN_LENGTH_PX,
      hitRadiusInflatePx: NORMAL_SLASH_HIT_INFLATE_PX,
      hitRadiusScaleForEnemy: (enemy) => this.enemyVisualScale(enemy),
      canHitEnemy: (enemy) => this.strokeHitTracker.canHit(enemy.id, segment.b.t) && !this.strokeDirectionalRejects.has(enemy.id),
    });
    for (const reject of rejects) {
      this.strokeDirectionalRejects.add(reject.enemyId);
      const enemy = this.objects.getAlive().find((en) => en.id === reject.enemyId);
      if (!enemy) continue;
      Telemetry.track("directional_reject", { enemyType: enemy.type, band: reject.band });
      const pos = enemyXY(enemy);
      this.destructionBurst.spawn(pos.x, pos.y, {
        color: 0xff5a66,
        secondaryColor: 0x8ff3ff,
        radius: Math.max(28, enemy.radiusPx * this.enemyVisualScale(enemy) * 0.52),
        particleCount: 10,
        lifeMs: 280,
      });
      this.hitBurst.spawn(pos.x, pos.y, t("directional.wrongAngle"), 0x8ff3ff, Math.max(34, enemy.radiusPx * this.enemyVisualScale(enemy) * 0.72), false, {
        labelScale: 0.72,
        ringWidth: 4,
        lifeMs: 420,
      });
    }
  }

  private updateStrokeHitRearm(segment: Segment): void {
    for (const enemy of this.objects.getAlive()) {
      const pos = enemyXY(enemy);
      const hitRadiusPx = enemy.radiusPx * this.enemyVisualScale(enemy) + NORMAL_SLASH_HIT_INFLATE_PX;
      const outside = distance(segment.b.x, segment.b.y, pos.x, pos.y) > hitRadiusPx + SAME_STROKE_REHIT_EXIT_MARGIN_PX;
      this.strokeHitTracker.markExited(enemy.id, outside);
    }
  }

  private enemyVisualScale(enemy: EnemyState): number {
    const diff = this.difficultyDef();
    return depthScale(enemy.radius, EARTH_GAMEPLAY_RADIUS, diff.gravitySwell);
  }

  private resolveOrbitalCutHits(earth: EarthRef, radiusPx: number): HitResult[] {
    const hits: HitResult[] = [];
    for (const enemy of this.objects.getAlive()) {
      const pos = enemyXY(enemy);
      const visualRadius = enemy.radiusPx * this.enemyVisualScale(enemy);
      if (distance(pos.x, pos.y, earth.cx, earth.cy) <= radiusPx + visualRadius) {
        hits.push({
          enemyId: enemy.id,
          band: distanceBand(enemy.radius, earth.r, this.zones),
          accuracy: "normal",
        });
      }
    }
    return hits;
  }

  private resolveNovaPulseHits(earth: EarthRef, radiusPx: number, pushPx: number, targetCap: number): HitResult[] {
    const hits: HitResult[] = [];
    for (const enemy of this.objects.getAlive()) {
      const pos = enemyXY(enemy);
      const visualRadius = enemy.radiusPx * this.enemyVisualScale(enemy);
      if (distance(pos.x, pos.y, earth.cx, earth.cy) > radiusPx + visualRadius) continue;
      hits.push({
        enemyId: enemy.id,
        band: distanceBand(enemy.radius, earth.r, this.zones),
        accuracy: "normal",
      });
      if (!enemy.boss) enemy.radius += pushPx;
      if (hits.length >= targetCap) break;
    }
    return hits;
  }

  private resolveSpecialIds(ids: readonly number[]): boolean {
    if (!this.specialObjects) return false;
    let consumed = false;
    for (const id of ids) {
      const object = this.specialObjects.getAlive().find((candidate) => candidate.id === id);
      if (object) consumed = this.applySpecialHit(object) || consumed;
    }
    return consumed;
  }

  private resolveSpecialSegment(segment: Segment): boolean {
    if (!this.specialObjects) return false;
    if (Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y) < LIVE_SEGMENT_MIN_LENGTH_PX) return false;
    for (const object of this.specialObjects.getAlive()) {
      if (!segmentIntersectsCircle(segment, object.x, object.y, object.radiusPx)) continue;
      return this.applySpecialHit(object);
    }
    return false;
  }

  private applySpecialHit(object: SpecialObjectState): boolean {
    const effect = this.specialObjects.applyHit(object.id);
    if (!effect) return false;
    return this.applySpecialObjectEffect(effect, object.x, object.y, object.type);
  }

  private applySpecialObjectEffect(effect: SpecialObjectHitEffect, x: number, y: number, type?: SpecialObjectType): boolean {
    if (effect.kind === "penalty") {
      if (type && isProtectObjectiveObject(type)) this.failedProtectCount += 1;
      const result = this.energy.applyDamage(effect.damage);
      if (effect.comboBreak) this.scoring.onMiss();
      this.earth.setVisualState(this.energy.visualState());
      this.hitBurst.spawn(x, y, t(specialPenaltyLabelKey(type)), 0xff5a66, 96, false, { labelScale: 0.8, ringWidth: 4, lifeMs: 520 });
      if (result.gameOver) {
        this.endRun("earth_destroyed");
        return true;
      }
      return true;
    }

    if (effect.heal > 0) this.energy.heal(effect.heal);
    if (effect.score > 0) this.scoring.addBonus(effect.score);
    if (effect.gauge > 0) this.gainAllSkillCharges(effect.gauge);
    if (effect.slowMs > 0) {
      this.gravitySlowRemainingMs = Math.max(this.gravitySlowRemainingMs, effect.slowMs);
      this.gravitySlowMultiplier = Math.min(this.gravitySlowMultiplier, 0.55);
    }
    this.earth.setVisualState(this.energy.visualState());
    this.hitBurst.spawn(x, y, t(specialBenefitLabelKey(type)), 0x7dd3fc, 92, false, { labelScale: 0.8, ringWidth: 4, lifeMs: 520 });
    return true;
  }

  private triggerBlockedBossBodyFeedback(x: number, y: number): void {
    this.hud.flashBanner(t("boss.weakPointOnly"), 0xffc14d);
    this.hud.flashBlockedWeakPoint(t("boss.weakPointOnly"), t("boss.weakPointHint"));
    this.hitBurst.spawn(x, y, t("boss.weakPointOnly"), 0xffc14d, 140, false, { labelScale: 0.78, ringWidth: 5, lifeMs: 560 });
  }

  private applyHits(
    hits: HitResult[],
    damage: number,
    hitAtMs = this.replayNowMs(),
    source: "slash" | "solar_lance" | "skill" = "slash",
    segment?: Segment,
    skillId?: SkillId,
  ): PendingKill[] {
    const killed: PendingKill[] = [];
    for (const h of hits) {
      if (
        this.guidedTutorialFlow?.step === "solar_lance" &&
        source !== "solar_lance" &&
        this.guidedScenarioEnemyIds?.has(h.enemyId)
      ) continue;
      if (h.blocked) {
        this.strokeHadHit = true;
        this.strokeHitTracker.recordHit(h.enemyId, hitAtMs);
        this.triggerEnemyHitFeedback(h.enemyId);
        if (h.blockReason === "boss_body_locked") {
          const enemy = this.objects.getAlive?.().find((candidate) => candidate.id === h.enemyId);
          const pos = enemy ? enemyXY(enemy) : null;
          this.triggerBlockedBossBodyFeedback(pos?.x ?? 540, pos?.y ?? 900);
        }
        continue;
      }
      this.strokeHadHit = true;
      this.strokeHitTracker.recordHit(h.enemyId, hitAtMs);
      const hitDamage = Math.max(1, Math.ceil(damage * (h.damageMultiplier ?? 1)));
      const result = this.objects.applyDamage(h.enemyId, hitDamage);
      if (result.enemy) this.triggerEnemyHitFeedback(h.enemyId);
      if (result.enemy?.spawnOrdinal != null) {
        this.runSession.recordHit({
          spawnOrdinal: result.enemy.spawnOrdinal,
          hitAtMs,
          band: h.band,
          accuracy: h.accuracy,
          damage: result.absorbed ? 0 : hitDamage,
          absorbed: result.absorbedBy,
          damageMultiplier: h.damageMultiplier,
          source,
          skillId,
          segment: segment ? cloneSegment(segment) : undefined,
        });
      }
      if (!result.killed || !result.enemy) continue;

      this.guidedScenarioEnemyIds?.delete(h.enemyId);
      this.guidedScenarioSlotByEnemyId?.delete(h.enemyId);

      const splitSpawns = splitSpawnSpecsForEnemy(result.enemy, hitAtMs);
      if (splitSpawns.length > 0) {
        const orderedSplitSpawns = this.spawnWithReplay(splitSpawns, () => "split", result.enemy.spawnOrdinal);
        for (const spawn of orderedSplitSpawns) {
          Telemetry.track("spawn", { enemyType: spawn.enemyType, modeId: this.runConfig.modeId, difficulty: this.runConfig.difficulty, source: "split" });
        }
      }

      const pos = enemyXY(result.enemy);
      killed.push({
        hit: h,
        damage: hitDamage,
        score: result.enemy.score,
        spawnOrdinal: result.enemy.spawnOrdinal,
        type: result.enemy.type,
        x: pos.x,
        y: pos.y,
        hitAtMs,
        boss: result.enemy.boss,
        source,
        skillId,
        segment,
      });
      this.removeSprite(h.enemyId);
    }
    return killed;
  }

  private applyBossWeakPointAccuracy(hits: HitResult[], segment: Segment, earth: EarthRef): HitResult[] {
    for (const hit of hits) {
      const enemy = this.objects.getAlive().find((candidate) => candidate.id === hit.enemyId);
      if (!enemy?.boss) continue;
      const weak = resolveBossWeakPointHit(segment, enemy, earth.cx, earth.cy, this.enemyVisualScale(enemy));
      hit.accuracy = weak.accuracy;
      hit.damageMultiplier = weak.damageMultiplier;
      hit.blocked = weak.blocked;
      hit.blockReason = weak.blockReason;
    }
    return hits;
  }

  private commitKills(kills: PendingKill[], earth: EarthRef, visualsAlreadyShown: boolean): void {
    if (kills.length === 0) return;

    const scoreById = new Map(kills.map((k) => [k.hit.enemyId, k.score] as const));
    const typeById = new Map(kills.map((k) => [k.hit.enemyId, k.type] as const));
    const groups = groupByComboTimeout(kills, this.scoringCfg.comboChainTimeoutMs ?? 650);
    for (const kill of kills) {
      if (kill.spawnOrdinal != null) {
        this.runSession.recordKill({
          spawnOrdinal: kill.spawnOrdinal,
          hitAtMs: kill.hitAtMs,
          band: kill.hit.band,
          accuracy: kill.hit.accuracy,
          damageMultiplier: kill.hit.damageMultiplier,
          damage: kill.damage,
          source: kill.source,
          skillId: kill.skillId,
          segment: kill.segment ? cloneSegment(kill.segment) : undefined,
        });
      }
    }

    if (!visualsAlreadyShown) {
      for (const kill of kills) this.spawnKillFeedback(kill);
    }

    for (const group of groups) {
      const res = this.scoring.onHit(
        group.map((k) => k.hit),
        (id) => scoreById.get(id) ?? 0,
        (id) => typeById.get(id) ?? "",
        group[group.length - 1]?.hitAtMs,
      );
      this.bossRuntime?.recordThreatPressure({
        kills: group.length,
        combo: res.combo,
        lastSave: res.lastSave,
        bossWeakHits: group.filter((kill) => kill.hit.accuracy === "bossWeak").length,
      });
      this.gainAllSkillCharges(res.gauge);
      this.feedback?.handle({ type: res.lastSave ? "last_save" : "normal_hit", atMs: group[group.length - 1]?.hitAtMs ?? this.elapsedMs });

      const tier = multiCutTier(group.length);
      if (tier !== "none") this.hud.flashBanner(multiCutLabel(tier), 0xffc14d);
      if (res.lastSave) {
        this.advanceGuidedTutorial({ type: "enemy_killed", band: "lastSave" });
        this.destructionBurst.spawn(earth.cx, earth.cy, {
          color: 0x3fd8ff,
          secondaryColor: 0xffffff,
          radius: EARTH_BODY_RADIUS * 1.15,
          particleCount: 32,
          lifeMs: 920,
          isLastSave: true,
        });
        this.hitBurst.spawn(earth.cx, earth.cy, lastSaveLabel(), 0x3fd8ff, EARTH_BODY_RADIUS * 2.8, true, {
          labelScale: 1.25,
          ringWidth: 7,
          lifeMs: 920,
        });
        this.earth.flashLastSave();
        this.hud.flashBanner(lastSaveLabel(), 0x3fd8ff);
        Telemetry.track("last_save", { modeId: this.runConfig.modeId, difficulty: this.runConfig.difficulty });
      }
    }

    for (const kill of kills) {
      if (!kill.boss) continue;
      this.recordBossDefeat(kill.type);
    }
  }

  private recordBossDefeat(enemyType: string): void {
    this.bossKills += 1;
    if (!this.defeatedBossIds.includes(enemyType)) this.defeatedBossIds.push(enemyType);
    this.bossRuntime?.recordBossDefeated(enemyType, this.elapsedMs);
  }

  private applyDeltaShieldAbsorb(en: EnemyState): void {
    this.deltaShieldAbsorbs -= 1;
    Telemetry.track("delta_shield_absorb", { enemyType: en.type, remaining: this.deltaShieldAbsorbs, boss: Boolean(en.boss) });
    const pos = enemyXY(en);
    this.hitBurst.spawn(pos.x, pos.y, t("skill.delta_shield"), 0x93c5fd, Math.max(48, en.radiusPx * this.enemyVisualScale(en)), false, {
      labelScale: en.boss ? 0.78 : 0.7,
      ringWidth: en.boss ? 6 : 4,
      lifeMs: en.boss ? 560 : 420,
    });
    if (en.boss) {
      en.radius = Math.max(en.radius, EARTH_GAMEPLAY_RADIUS * 2.35);
      this.triggerEnemyHitFeedback(en.id);
    } else {
      this.objects.kill(en.id);
      this.removeSprite(en.id);
    }
    if (this.deltaShieldAbsorbs <= 0) this.deltaShieldRemainingMs = 0;
  }

  private spawnKillFeedback(kill: PendingKill): void {
    const feedback = feedbackForHitBand(kill.hit.band, this.scoringCfg);
    this.destructionBurst.spawn(kill.x, kill.y, {
      color: feedback.color,
      radius: feedback.radius,
      particleCount: feedback.particleCount,
      isLastSave: feedback.isLastSave,
    });
    this.hitBurst.spawn(kill.x, kill.y, multiplierLabel(feedback.multiplier), feedback.color, feedback.radius, feedback.isLastSave, {
      labelScale: feedback.labelScale,
      ringWidth: feedback.ringWidth,
      lifeMs: feedback.lifeMs,
    });
  }

  private triggerEnemyHitFeedback(enemyId: number): void {
    this.enemyHitFeedback.set(enemyId, {
      elapsedMs: 0,
      durationMs: ENEMY_HIT_SHAKE_DURATION_MS,
      intensityPx: ENEMY_HIT_SHAKE_INTENSITY_PX,
    });
  }

  private updateEnemyHitFeedback(dtMs: number): void {
    for (const [id, state] of this.enemyHitFeedback) {
      state.elapsedMs += dtMs;
      if (state.elapsedMs >= state.durationMs) this.enemyHitFeedback.delete(id);
    }
  }

  private shouldReserveStrokeForSolarLance(points: Point[], earth: EarthRef): boolean {
    if (!this.skillEnabled("solar_lance")) return false;
    return shouldReserveLiveSlashForSolarLance(points, earth, {
      skillReady: this.skills.isReady("solar_lance"),
      gauge: this.chargeBank().get("solar_lance"),
      gaugeCost: this.skillTable.solar_lance.gaugeCost,
      infiniteGauge: this.skillTable._debug.infiniteGauge,
      screenShortSide: BASE_WIDTH,
    });
  }

  private shouldReserveStrokeForGravitySlow(points: Point[], earth: EarthRef): boolean {
    if (!this.skillEnabled("gravity_slow")) return false;
    return shouldReserveLiveSlashForGravitySlow(points, earth, {
      skillReady: this.skills.isReady("gravity_slow"),
      gauge: this.chargeBank().get("gravity_slow"),
      gaugeCost: this.skillTable.gravity_slow.gaugeCost,
      infiniteGauge: this.skillTable._debug.infiniteGauge,
      circleTurnMinRad: this.skillTable.gravity_slow.circleTurnMinRad ?? 4.8,
      closeMaxRatio: this.skillTable.gravity_slow.closeMaxRatio ?? 0.3,
    });
  }

  /** GestureSystem 없이 점 배열만으로 분류 결과 생성 (Solar Lance 판정용). */
  private gestureResultFromPoints(points: Point[], earth: EarthRef) {
    return this.gesture.classify(points, earth);
  }

  // ── 적 스프라이트 풀 ──────────────────────────────────────────────────────

  private acquireSprite(): EnemySpriteNode {
    const node = this.spritePool.pop();
    if (node) {
      node.container.visible = true;
      return node;
    }
    const container = new Container();
    const image = new Sprite(Texture.EMPTY);
    image.anchor.set(0.5);
    const fallback = new Graphics();
    const overlay = new Graphics();
    container.addChild(fallback, image, overlay);
    return { container, image, fallback, overlay, textureReady: false };
  }

  private releaseSprite(node: EnemySpriteNode): void {
    node.fallback.clear();
    node.overlay.clear();
    node.container.visible = false;
    if (node.container.parent) node.container.parent.removeChild(node.container);
    this.spritePool.push(node);
  }

  private removeSprite(id: number): void {
    const g = this.sprites.get(id);
    if (g) {
      this.releaseSprite(g);
      this.sprites.delete(id);
    }
  }

  private drawEnemySprite(node: EnemySpriteNode, en: EnemyState): void {
    if (node.type !== en.type) {
      node.type = en.type;
      node.textureReady = false;
      node.image.texture = Texture.EMPTY;
    }
    const texture = enemyTexture(en.type);
    if (texture && !node.textureReady) {
      node.image.texture = texture;
      node.textureReady = true;
    }
    node.image.width = en.radiusPx * 2;
    node.image.height = en.radiusPx * 2;
    node.image.visible = node.textureReady;
    node.fallback.visible = !node.textureReady;
    if (!node.textureReady) {
      drawEnemyVisual(node.fallback, en);
    } else {
      node.fallback.clear();
    }
    this.drawEnemyOverlay(node.overlay, en);
  }

  private drawEnemyTrail(g: Graphics, en: EnemyState, pos: { x: number; y: number }, motion: EnemySpriteMotion, shakeScale: number, hitFeedback?: EnemyHitFeedbackState): void {
    const style = enemyVisualStyle(en.type);
    const scale = this.enemyVisualScale(en) * motion.visualScale * shakeScale;
    const visualRadius = en.radiusPx * scale;
    const travel = enemyTravelAngleRad(en);
    const back = travel + Math.PI;
    const alpha = Math.min(en.boss ? 0.16 : 0.18, motion.trailAlpha * 0.22);
    const glowAlpha = Math.min(en.boss ? 0.12 : 0.15, motion.glowAlpha);

    if (style.shape === "comet") {
      const len = motion.trailLengthPx * scale;
      const startX = pos.x + Math.cos(back) * visualRadius * 0.35;
      const startY = pos.y + Math.sin(back) * visualRadius * 0.35;
      const endX = pos.x + Math.cos(back) * len;
      const endY = pos.y + Math.sin(back) * len;
      g.moveTo(startX, startY).lineTo(endX, endY).stroke({
        width: Math.max(5, visualRadius * 0.46),
        color: style.rim,
        alpha,
        cap: "round",
      });
      g.moveTo(pos.x, pos.y).lineTo(endX, endY).stroke({
        width: Math.max(2, visualRadius * 0.15),
        color: style.sparkleColor,
        alpha: Math.min(0.2, alpha + 0.04),
        cap: "round",
      });
    }

    const hitT = hitFeedback ? 1 - Math.min(1, hitFeedback.elapsedMs / hitFeedback.durationMs) : 0;
    const ringAlpha = Math.min(0.22, glowAlpha + hitT * 0.18);
    if (ringAlpha > 0.03) {
      g.circle(pos.x, pos.y, visualRadius * (1.04 + hitT * 0.18)).stroke({
        width: Math.max(2, visualRadius * (en.boss ? 0.045 : 0.035)),
        color: hitFeedback ? style.sparkleColor : style.rim,
        alpha: ringAlpha,
      });
    }
  }

  private drawEnemyOverlay(g: Graphics, en: EnemyState, hitFeedback?: EnemyHitFeedbackState): void {
    g.clear();
    const r = en.radiusPx;
    const style = enemyVisualStyle(en.type);
    if (en.boss) {
      g.circle(0, 0, r + 54).stroke({ width: 3, color: style.rim, alpha: 0.16 });
      g.circle(0, 0, r + 36).stroke({ width: 6, color: style.sparkleColor, alpha: 0.18 });
      g.circle(0, 0, r + 14).stroke({ width: 10, color: style.sparkleColor, alpha: 0.66 });
      g.circle(0, 0, r + 30).stroke({ width: 4, color: 0xfef3c7, alpha: 0.34 });
      g.circle(0, 0, r * 0.28).stroke({ width: 8, color: 0xffffff, alpha: 0.22 });
      for (const weak of bossWeakPointLocalCircles(en, this.enemyVisualScale(en))) {
        g.circle(weak.x, weak.y, weak.r + 8).stroke({ width: Math.max(3, weak.strokeWidth + 2), color: weak.haloColor, alpha: 0.34 });
        g.circle(weak.x, weak.y, weak.r + 4).stroke({ width: weak.strokeWidth, color: weak.color, alpha: 0.78 });
        if (weak.markerKind === "ring_node") {
          g.circle(weak.x, weak.y, Math.max(4, weak.r * 0.38)).stroke({ width: Math.max(2, weak.strokeWidth * 0.48), color: weak.color, alpha: 0.9 });
        } else if (weak.markerKind === "body_crack") {
          const crack = Math.max(8, weak.r * 0.8);
          g.moveTo(weak.x - crack * 0.8, weak.y - crack * 0.18)
            .lineTo(weak.x - crack * 0.15, weak.y + crack * 0.16)
            .lineTo(weak.x + crack * 0.18, weak.y - crack * 0.2)
            .lineTo(weak.x + crack * 0.82, weak.y + crack * 0.18)
            .stroke({ width: Math.max(3, weak.strokeWidth * 0.55), color: weak.color, alpha: 0.92, cap: "round" });
          g.circle(weak.x, weak.y, Math.max(5, weak.r * 0.34)).fill({ color: weak.color, alpha: weak.fillAlpha });
        } else {
          g.circle(weak.x, weak.y, Math.max(5, weak.r * 0.48)).fill({ color: weak.color, alpha: weak.fillAlpha });
          g.circle(weak.x, weak.y, Math.max(8, weak.r * 0.82)).stroke({ width: Math.max(2, weak.strokeWidth * 0.4), color: 0xffffff, alpha: 0.44 });
        }
      }
    }
    drawDirectionalGuide(g, en, en.directional ? requiredDirectionalSlashAngleRad(en) : undefined, false);

    const maxHp = en.maxHp ?? en.hp;
    const missingHp = Math.max(0, maxHp - en.hp);
    if (maxHp > 1 && missingHp > 0) {
      const crackLevel = Math.min(5, Math.ceil((missingHp / maxHp) * 5));
      for (let i = 0; i < crackLevel; i += 1) {
        const angle = -Math.PI * 0.75 + i * 0.72;
        const inner = r * (0.18 + i * 0.045);
        const outer = r * (0.62 + i * 0.035);
        const bend = angle + 0.38;
        g.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
          .lineTo(Math.cos(bend) * (inner + outer) * 0.46, Math.sin(bend) * (inner + outer) * 0.46)
          .lineTo(Math.cos(angle + 0.14) * outer, Math.sin(angle + 0.14) * outer)
          .stroke({ width: Math.max(3, r * (en.boss ? 0.032 : 0.025)), color: style.crackColor, alpha: 0.34 + crackLevel * 0.09, cap: "round" });
      }
      if (missingHp >= Math.max(1, maxHp * 0.18)) {
        const sparkleCount = en.boss ? 6 : 3;
        for (let i = 0; i < sparkleCount; i += 1) {
          const angle = i * ((Math.PI * 2) / sparkleCount) + missingHp * 0.19;
          const x = Math.cos(angle) * r * (0.34 + (i % 2) * 0.22);
          const y = Math.sin(angle) * r * (0.34 + ((i + 1) % 2) * 0.2);
          const len = Math.max(8, r * (en.boss ? 0.07 : 0.055));
          g.moveTo(x - len, y).lineTo(x + len, y).stroke({ width: 3, color: style.sparkleColor, alpha: 0.45, cap: "round" });
          g.moveTo(x, y - len).lineTo(x, y + len).stroke({ width: 3, color: style.sparkleColor, alpha: 0.45, cap: "round" });
        }
      }
    }

    if (hitFeedback) {
      const t = 1 - Math.min(1, hitFeedback.elapsedMs / hitFeedback.durationMs);
      g.circle(0, 0, r + 10 + t * (en.boss ? 28 : 14)).stroke({ width: en.boss ? 10 : 6, color: 0xffffff, alpha: t * (en.boss ? 0.62 : 0.46) });
      g.circle(0, 0, Math.max(10, r * 0.22 + t * r * 0.18)).stroke({ width: en.boss ? 7 : 4, color: style.sparkleColor, alpha: t * 0.54 });
      const sparkCount = en.boss ? 8 : 5;
      for (let i = 0; i < sparkCount; i += 1) {
        const angle = i * ((Math.PI * 2) / sparkCount) + en.id * 0.37;
        const inner = r * (0.42 + t * 0.08);
        const outer = r * (0.74 + t * 0.18);
        g.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
          .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
          .stroke({ width: Math.max(2, r * 0.035), color: style.sparkleColor, alpha: t * 0.5, cap: "round" });
      }
    }
  }

  // ── 메인 update (RAF) ─────────────────────────────────────────────────────

  update(dtMs: number): void {
    if (this.running) {
      this.elapsedMs += dtMs;
      const objectiveEndReason = this.currentObjectiveEndReason();
      if (objectiveEndReason) {
        this.endRun(objectiveEndReason);
        return;
      }
      this.skills.tick(dtMs);
      if (this.gravitySlowRemainingMs > 0) {
        this.gravitySlowRemainingMs = Math.max(0, this.gravitySlowRemainingMs - dtMs);
        if (this.gravitySlowRemainingMs === 0) this.gravitySlowMultiplier = 1;
      }
      if (this.deltaShieldRemainingMs > 0) {
        this.deltaShieldRemainingMs = Math.max(0, this.deltaShieldRemainingMs - dtMs);
        if (this.deltaShieldRemainingMs === 0) this.deltaShieldAbsorbs = 0;
      }

      if (this.runConfig.rules.durationLimitMs !== null && this.elapsedMs >= this.runConfig.rules.durationLimitMs) {
        this.endRun("timer_expired");
        return;
      }

      // spawn
      const scriptedTutorial = this.guidedStoryScenarioActive();
      const scheduledSpawns = this.wave.next(this.elapsedMs);
      const spawns = scriptedTutorial ? [] : scheduledSpawns;
      if (scriptedTutorial) this.bossRuntime.deferUntil(this.elapsedMs);
      const bossRequests = scriptedTutorial ? [] : this.bossRuntime.nextSpawns(this.elapsedMs, this.objects.getAlive().some((enemy) => enemy.boss));
      const bossSpawns = bossRequests.map((request) => this.bossSpawnSpec(request.enemyType, request.spawnAtMs)).filter((spawn): spawn is SpawnSpec => Boolean(spawn));
      const orderedSpawns = this.spawnWithReplay([...spawns, ...bossSpawns]);
      for (const spawn of orderedSpawns) Telemetry.track("spawn", { enemyType: spawn.enemyType, modeId: this.runConfig.modeId, difficulty: this.runConfig.difficulty });
      for (const spawn of orderedSpawns.filter((spawn) => this.enemies[spawn.enemyType]?.boss)) this.bossRuntime.recordBossSpawned(spawn.enemyType);

      const activeBoss = this.objects.getAlive().find((enemy) => enemy.boss);
      if (activeBoss) {
        for (const event of this.bossRuntime.nextPhaseActionEvents(activeBoss, this.elapsedMs)) {
          this.spawnBossShardEvent(event, activeBoss);
        }
      }
      for (const event of this.bossRuntime.nextShardEvents(activeBoss, this.elapsedMs)) {
        if (event.kind === "warning") {
          const telegraph = activeBoss ? buildBossShardTelegraph(event, activeBoss, this.elapsedMs) : undefined;
          if (telegraph) this.bossShardTelegraphs.push(telegraph);
          this.hud.flashBanner(t("boss.shardWarning"), 0xffc14d);
          continue;
        }
        if (!activeBoss) continue;
        this.spawnBossShardEvent(event, activeBoss);
      }

      if (scriptedTutorial) this.specialObjects.deferUntil(this.elapsedMs);
      if (!scriptedTutorial) this.specialObjects.next(this.elapsedMs, { energy: this.energy.getEnergy(), maxEnergy: this.energy.getMax() });
      if (!scriptedTutorial) this.specialObjects.step(this.elapsedMs);
      for (const reward of scriptedTutorial ? [] : this.specialObjects.expire(this.elapsedMs)) {
        if (isProtectObjectiveObject(reward.type)) this.protectedCount += 1;
        this.scoring.addBonus(reward.score);
        this.gainAllSkillCharges(reward.gauge);
        if (reward.heal && reward.heal > 0) {
          this.energy.heal(reward.heal);
          this.earth.setVisualState(this.energy.visualState());
        }
        this.hud.flashBanner(t(specialRewardLabelKey(reward.type)), 0x7dd3fc);
      }

      // movement + 지구 충돌
      const diff = this.difficultyDef();
      const movementDtMs = this.gravitySlowRemainingMs > 0 ? dtMs * this.gravitySlowMultiplier : dtMs;
      const aliveBeforeMovement = this.objects.getAlive();
      let guidedScenarioImpacted = false;
      for (const en of aliveBeforeMovement) {
        stepEnemy(en, this.movementDtForEnemy(en, movementDtMs, aliveBeforeMovement));
        if (enemyTouchesImpactZone(en.radius, en.radiusPx, EARTH_GAMEPLAY_RADIUS, this.zones, diff.gravitySwell, en.earthImpactRadiusPx)) {
          if (scriptedTutorial && this.guidedScenarioEnemyIds.has(en.id)) {
            this.objects.kill(en.id);
            this.guidedScenarioEnemyIds.delete(en.id);
            this.guidedScenarioSlotByEnemyId.delete(en.id);
            this.removeSprite(en.id);
            guidedScenarioImpacted = true;
            continue;
          }
          if (this.deltaShieldRemainingMs > 0 && this.deltaShieldAbsorbs > 0) {
            this.applyDeltaShieldAbsorb(en);
            continue;
          }
          const r = this.energy.applyDamage(en.damage);
          this.scoring.onMiss(); // 지구 피격 = 콤보 끊김
          this.runSession.recordComboBreak("earth_hit", this.replayNowMs());
          Telemetry.track("combo_break", { reason: "earth_hit" });
          this.objects.kill(en.id);
          this.removeSprite(en.id);
          this.earth.setVisualState(this.energy.visualState());
          if (r.gameOver) {
            this.objects.prune();
            this.endRun("earth_destroyed");
            break;
          }
        }
      }
      this.objects.prune();
      if (guidedScenarioImpacted && this.guidedStoryScenarioActive()) {
        this.spawnGuidedStoryScenario();
      }
      if (this.modeRuntimeRules.endOnBossSequenceComplete && this.bossRuntime.sequenceComplete()) {
        this.endRun("boss_sequence_complete");
        return;
      }
      this.updateEnemyHitFeedback(dtMs);
      this.enemyTrailLayer.clear();
      this.drawBossShardTelegraphs();

      // render 적 스프라이트
      for (const en of this.objects.getAlive()) {
        let g = this.sprites.get(en.id);
        if (!g) {
          g = this.acquireSprite();
          this.drawEnemySprite(g, en);
          this.enemyLayer.addChild(g.container);
          this.sprites.set(en.id, g);
        } else if (en.directional || !g.textureReady) {
          this.drawEnemySprite(g, en);
        }
        const pos = enemyXY(en);
        const hitFeedback = this.enemyHitFeedback.get(en.id);
        const motion = enemySpriteMotion(en, this.elapsedMs);
        const shake = hitFeedback
          ? enemyHitShakeOffset(en.id, hitFeedback.elapsedMs, hitFeedback.intensityPx, hitFeedback.durationMs)
          : { x: 0, y: 0, scale: 1 };
        const visualPos = { x: pos.x + shake.x, y: pos.y + shake.y };
        this.drawEnemyTrail(this.enemyTrailLayer, en, visualPos, motion, shake.scale, hitFeedback);
        this.drawEnemyOverlay(g.overlay, en, hitFeedback);
        g.image.rotation = motion.rotationRad;
        g.fallback.rotation = motion.rotationRad;
        g.overlay.rotation = 0;
        g.container.position.set(pos.x + shake.x, pos.y + shake.y);
        g.container.scale.set(this.enemyVisualScale(en) * motion.visualScale * shake.scale);
      }
      this.drawSpecialObjects();
    } else {
      this.updateEnemyHitFeedback(dtMs);
      this.enemyTrailLayer.clear();
      this.drawBossShardTelegraphs();
      this.drawSpecialObjects();
    }

    // 시각 갱신 (running 무관)
    this.earth.update(dtMs);
    if (!this.reducedMotion) {
      this.slashTrail.update(dtMs);
      this.laser.update(dtMs);
      this.destructionBurst.update(dtMs);
      this.hitBurst.update(dtMs);
    }

    const snap = this.scoring.snapshot();
    const cost = this.skillTable.solar_lance.gaugeCost;
    const wave = waveHudState(this.elapsedMs, this.runConfig.rules.waveDurationMs);
    const bossEveryMs = this.runConfig.rules.bossPolicy.bossEveryMs > 0 ? this.runConfig.rules.bossPolicy.bossEveryMs : 60000;
    const boss = buildBossHudState(
      this.objects?.getAlive() ?? [],
      this.elapsedMs,
      bossEveryMs,
      undefined,
      this.bossRuntime?.nextBossInMs(this.elapsedMs),
      this.bossRuntime?.threatPercent(),
    );
    this.hud.update(
      {
        energy: this.energy?.getEnergy() ?? 0,
        maxEnergy: this.energy?.getMax() ?? 0,
        score: snap.score,
        combo: snap.combo,
        comboMult: comboMultiplierFor(snap.combo, this.scoringCfg),
        gauge: this.gauge,
        gaugeCost: cost,
        skillReady: this.skills?.isReady("solar_lance") ?? false,
        cooldownMs: this.skills?.cooldownRemaining("solar_lance") ?? 0,
        skillSlots: this.skillCooldownSlots(),
        waveNumber: wave.waveNumber,
        waveProgressRatio: wave.progressRatio,
        nextWaveInMs: wave.nextWaveInMs,
        waveVisible: !this.guidedStoryScenarioActive(),
        boss,
        shield: {
          active: this.deltaShieldRemainingMs > 0 && this.deltaShieldAbsorbs > 0,
          remainingMs: this.deltaShieldRemainingMs,
          durationMs: this.deltaShieldDurationMs,
          absorbsRemaining: this.deltaShieldAbsorbs,
          maxAbsorbs: this.deltaShieldMaxAbsorbs,
        },
        tutorial: buildTutorialHudState(this.runConfig, boss, this.elapsedMs, this.guidedTutorialFlow),
        timeMs: this.elapsedMs,
      },
      dtMs,
    );
  }

  private advanceGuidedTutorial(signal: TutorialSignal): void {
    if (!this.guidedTutorialFlow) return;
    const next = reduceTutorialFlow(this.guidedTutorialFlow, signal);
    if (next === this.guidedTutorialFlow) return;
    this.clearGuidedStoryScenario();
    this.guidedTutorialFlow = next;
    this.guidedTutorialInitialStep = next.step;
    this.spawnGuidedStoryScenario();
    this.onGuidedTutorialStep?.(next.step);
  }

  private skillCooldownSlots() {
    const enabled = new Set<SkillId>(this.runConfig.rules.enabledSkills);
    const novaDefinition = resolveNovaPulseDefinition(this.skillTable.nova_pulse);
    const defs = [
      { id: "solar_lance", label: t("skill.solar_lance"), cost: this.skillTable.solar_lance.gaugeCost, cooldownSec: this.skillTable.solar_lance.cooldownSec, active: enabled.has("solar_lance") },
      { id: "orbital_cut", label: t("skill.orbital_cut"), cost: this.skillTable.orbital_cut.gaugeCost, cooldownSec: this.skillTable.orbital_cut.cooldownSec, active: enabled.has("orbital_cut") },
      { id: "gravity_slow", label: t("skill.gravity_slow"), cost: this.skillTable.gravity_slow.gaugeCost, cooldownSec: this.skillTable.gravity_slow.cooldownSec, active: enabled.has("gravity_slow") },
      { id: "delta_shield", label: t("skill.delta_shield"), cost: this.skillTable.delta_shield.gaugeCost, cooldownSec: this.skillTable.delta_shield.cooldownSec, active: enabled.has("delta_shield") },
      { id: "nova_pulse", label: t("skill.nova_pulse"), cost: novaDefinition.gaugeCost, cooldownSec: novaDefinition.cooldownSec, active: enabled.has("nova_pulse") },
    ];
    return buildSkillCooldownSlots(defs, (skillId) => this.chargeBank().get(skillId), (skillId) => this.skills?.cooldownRemaining(skillId) ?? 0);
  }

  private skillEnabled(skillId: SkillId): boolean {
    const enabled = this.runConfig?.rules?.enabledSkills;
    return enabled ? enabled.includes(skillId) : true;
  }

  private bossSpawnSpec(enemyType: string, spawnAtMs: number): SpawnSpec | null {
    const def = this.enemies[enemyType];
    if (!def) return null;
    return {
      enemyType,
      spawnAtMs,
      startAngleRad: -Math.PI / 2,
      startRadius: def.startRadius,
      angularSpeed: def.angularSpeed,
      approachSpeed: def.approachSpeed,
    };
  }

  private bossShardSpawnSpecs(event: BossShardEvent, boss: EnemyState): SpawnSpec[] {
    const def = this.enemies[event.shardEnemyType];
    if (!def || event.count <= 0) return [];
    const count = Math.max(1, Math.floor(event.count));
    const spreadRad = (Math.max(0, event.spreadDeg) * Math.PI) / 180;
    const start = boss.angle - spreadRad / 2;
    const step = count === 1 ? 0 : spreadRad / (count - 1);
    const startRadius = Math.max(EARTH_GAMEPLAY_RADIUS * 1.6, boss.radius + event.spawnRadiusOffset);
    const spawns: SpawnSpec[] = [];
    for (let i = 0; i < count; i += 1) {
      spawns.push({
        enemyType: event.shardEnemyType,
        spawnAtMs: this.elapsedMs,
        startAngleRad: start + step * i,
        startRadius,
        angularSpeed: def.angularSpeed,
        approachSpeed: def.approachSpeed,
      });
    }
    return spawns;
  }

  private spawnBossShardEvent(event: BossShardEvent, boss: EnemyState): SpawnSpec[] {
    const shardSpawns = this.spawnWithReplay(this.bossShardSpawnSpecs(event, boss), () => "boss_shard", boss.spawnOrdinal);
    for (const spawn of shardSpawns) {
      Telemetry.track("spawn", {
        enemyType: spawn.enemyType,
        modeId: this.runConfig.modeId,
        difficulty: this.runConfig.difficulty,
        source: event.kind,
        bossType: event.bossType,
        bossPhase: event.phaseLabel,
        bossPattern: event.patternKind,
      });
    }
    return shardSpawns;
  }

  private bossWaveSpawnIntervalMultiplier(): number {
    const activeBoss = this.objects?.getAlive?.().find((enemy) => enemy.boss);
    if (!activeBoss) return 1;
    return bossWaveSpawnIntervalMultiplierForEnemy(activeBoss);
  }

  private drawBossShardTelegraphs(): void {
    this.bossTelegraphLayer.clear();
    this.bossShardTelegraphs = this.bossShardTelegraphs.filter((telegraph) => telegraph.expiresAtMs > this.elapsedMs);
    if (this.bossShardTelegraphs.length === 0) return;
    const earth = this.earth.ref();
    for (const telegraph of this.bossShardTelegraphs) {
      const remainingRatio = Math.max(0, Math.min(1, (telegraph.expiresAtMs - this.elapsedMs) / 1500));
      const alpha = 0.18 + remainingRatio * 0.28;
      const angles = [telegraph.startAngleRad, telegraph.centerAngleRad, telegraph.endAngleRad];
      for (const angle of angles) {
        const sx = earth.cx + Math.cos(angle) * telegraph.startRadius;
        const sy = earth.cy + Math.sin(angle) * telegraph.startRadius;
        const ex = earth.cx + Math.cos(angle) * telegraph.endRadius;
        const ey = earth.cy + Math.sin(angle) * telegraph.endRadius;
        this.bossTelegraphLayer.moveTo(sx, sy).lineTo(ex, ey).stroke({
          width: angle === telegraph.centerAngleRad ? telegraph.centerWidth : telegraph.edgeWidth,
          color: angle === telegraph.centerAngleRad ? telegraph.accentColor : telegraph.color,
          alpha: angle === telegraph.centerAngleRad ? Math.min(0.72, alpha + 0.16) : alpha,
          cap: "round",
        });
      }
      for (let i = 0; i < telegraph.count; i += 1) {
        const t = telegraph.count === 1 ? 0.5 : i / (telegraph.count - 1);
        const angle = telegraph.startAngleRad + (telegraph.endAngleRad - telegraph.startAngleRad) * t;
        const x = earth.cx + Math.cos(angle) * telegraph.startRadius;
        const y = earth.cy + Math.sin(angle) * telegraph.startRadius;
        this.bossTelegraphLayer.circle(x, y, telegraph.markerRadius).stroke({ width: 4, color: telegraph.accentColor, alpha: Math.min(0.78, alpha + 0.22) });
        this.bossTelegraphLayer.circle(x, y, Math.max(5, telegraph.markerRadius * 0.48)).fill({ color: telegraph.color, alpha: Math.min(0.28, alpha * 0.7) });
      }
    }
  }

  private drawSpecialObjects(): void {
    const graphics = this.specialGraphics;
    graphics.clear();
    const activeIds = new Set<number>();
    for (const object of this.specialObjects?.getAlive?.() ?? []) {
      activeIds.add(object.id);
      const color = specialObjectColor(object.type);
      if (object.motion.kind === "satelliteOrbit") {
        graphics.circle(object.motion.originX, object.motion.originY, object.motion.orbitRadiusPx).stroke({ width: 2, color, alpha: 0.18 });
      }
      if (object.motion.kind !== "static") {
        graphics.moveTo(object.previousX, object.previousY).lineTo(object.x, object.y).stroke({ width: 5, color, alpha: 0.24, cap: "round" });
      }
      graphics.circle(object.x + object.radiusPx * 0.08, object.y + object.radiusPx * 0.12, object.radiusPx * 1.08).fill({ color: 0x000000, alpha: 0.18 });
      graphics.circle(object.x, object.y, object.radiusPx).fill({ color, alpha: 0.24 });
      graphics.circle(object.x - object.radiusPx * 0.22, object.y - object.radiusPx * 0.26, object.radiusPx * 0.58).fill({ color: 0xffffff, alpha: 0.1 });
      graphics.circle(object.x, object.y, object.radiusPx).stroke({ width: 8, color, alpha: 0.82 });
      graphics.circle(object.x, object.y, object.radiusPx * 1.24).stroke({ width: 3, color: 0xffffff, alpha: 0.16 });
      graphics.circle(object.x, object.y, Math.max(8, object.radiusPx * 0.28)).fill({ color: 0xffffff, alpha: 0.54 });
      this.updateSpecialSprite(object);
      drawSpecialObjectSymbol(graphics, object, color);
    }
    this.pruneSpecialSprites(activeIds);
  }

  private updateSpecialSprite(object: SpecialObjectState): void {
    const texture = textureFromAsset(specialObjectAssetUrl(object.type));
    if (!texture) return;
    const sprites = this.specialSpriteMap();
    let sprite = sprites.get(object.id);
    if (!sprite) {
      sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprites.set(object.id, sprite);
      this.specialLayer.addChild(sprite);
    } else if (sprite.texture !== texture) {
      sprite.texture = texture;
    }
    sprite.position.set(object.x, object.y);
    sprite.width = object.radiusPx * 1.7;
    sprite.height = object.radiusPx * 1.7;
    sprite.alpha = 0.9;
  }

  private pruneSpecialSprites(activeIds: ReadonlySet<number>): void {
    const sprites = this.specialSpriteMap();
    for (const [id, sprite] of sprites) {
      if (activeIds.has(id)) continue;
      sprite.destroy();
      sprites.delete(id);
    }
  }

  private clearSpecialSprites(): void {
    this.pruneSpecialSprites(new Set());
  }

  /** Test harnesses may intentionally construct a partial scene without field initializers. */
  private specialSpriteMap(): Map<number, Sprite> {
    return this.specialSprites ?? (this.specialSprites = new Map<number, Sprite>());
  }
}

function drawGameplayBackdrop(g: Graphics): void {
  g.rect(0, 0, BASE_WIDTH, BASE_HEIGHT).fill({ color: 0x05060f });
  g.circle(BASE_WIDTH * 0.1, BASE_HEIGHT * 0.2, 430).fill({ color: 0x10245f, alpha: 0.16 });
  g.circle(BASE_WIDTH * 0.86, BASE_HEIGHT * 0.16, 360).fill({ color: 0x2b164f, alpha: 0.14 });
  g.circle(BASE_WIDTH * 0.72, BASE_HEIGHT * 0.72, 520).fill({ color: 0x06273a, alpha: 0.14 });
  g.circle(BASE_WIDTH * 0.28, BASE_HEIGHT * 0.62, 440).fill({ color: 0x1a0a2e, alpha: 0.1 });
  for (let i = 0; i < 7; i += 1) {
    const y = 180 + i * 230;
    const color = i % 2 === 0 ? 0x3fd8ff : 0xffc14d;
    const x0 = i % 2 === 0 ? -80 : BASE_WIDTH + 80;
    const x1 = i % 2 === 0 ? BASE_WIDTH * 0.48 : BASE_WIDTH * 0.54;
    g.moveTo(x0, y).lineTo(x1, y + 54).stroke({ width: 2, color, alpha: 0.055, cap: "round" });
  }
}

function drawGameplayStars(g: Graphics): void {
  let seed = 1337;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 190; i += 1) {
    const x = rand() * BASE_WIDTH;
    const y = rand() * BASE_HEIGHT;
    const size = 0.6 + rand() * (i % 17 === 0 ? 3.4 : 1.7);
    const warm = rand() > 0.86;
    g.circle(x, y, size).fill({ color: warm ? 0xffe3a3 : 0xffffff, alpha: 0.14 + rand() * 0.5 });
    if (i % 31 === 0) {
      g.moveTo(x - size * 3, y).lineTo(x + size * 3, y).stroke({ width: 1.4, color: warm ? 0xffc14d : 0x7dd3fc, alpha: 0.2, cap: "round" });
      g.moveTo(x, y - size * 3).lineTo(x, y + size * 3).stroke({ width: 1.4, color: warm ? 0xffc14d : 0x7dd3fc, alpha: 0.16, cap: "round" });
    }
  }
}

function drawGameplayOrbitGuide(g: Graphics): void {
  const cx = BASE_WIDTH / 2;
  const cy = 900;
  const lanes = [
    { rx: 270, ry: 78, alpha: 0.1, color: 0x3fd8ff },
    { rx: 440, ry: 128, alpha: 0.08, color: 0x7dd3fc },
    { rx: 620, ry: 184, alpha: 0.065, color: 0xffc14d },
    { rx: 820, ry: 244, alpha: 0.05, color: 0xa78bfa },
  ] as const;
  for (const lane of lanes) {
    g.ellipse(cx, cy, lane.rx, lane.ry).stroke({ width: 2, color: lane.color, alpha: lane.alpha });
    g.ellipse(cx, cy, lane.rx * 0.98, lane.ry * 0.98).stroke({ width: 1, color: 0xffffff, alpha: lane.alpha * 0.45 });
  }
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const x = cx + Math.cos(angle) * 610;
    const y = cy + Math.sin(angle) * 180;
    g.circle(x, y, i % 3 === 0 ? 3.5 : 2).fill({ color: i % 2 === 0 ? 0x3fd8ff : 0xffc14d, alpha: 0.12 });
  }
}

function specialObjectColor(type: SpecialObjectState["type"]): number {
  if (type === "friendlyRescue") return 0x60a5fa;
  if (type === "energyCapsule") return 0x4ade80;
  if (type === "empMine") return 0xa78bfa;
  return 0x7dd3fc;
}

function cloneSegment(segment: Segment): Segment {
  return {
    a: { ...segment.a },
    b: { ...segment.b },
  };
}

function createTelemetrySessionTraceId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `orbitslash-run-${random}`;
}

function drawSpecialObjectSymbol(g: Graphics, object: SpecialObjectState, color: number): void {
  const r = object.radiusPx;
  const x = object.x;
  const y = object.y;
  const w = Math.max(4, r * 0.14);

  if (object.type === "energyCapsule") {
    g.moveTo(x - r * 0.35, y).lineTo(x + r * 0.35, y).stroke({ width: w, color: 0xffffff, alpha: 0.88, cap: "round" });
    g.moveTo(x, y - r * 0.35).lineTo(x, y + r * 0.35).stroke({ width: w, color: 0xffffff, alpha: 0.88, cap: "round" });
    return;
  }

  if (object.type === "friendlyRescue") {
    g.moveTo(x, y - r * 0.38)
      .lineTo(x + r * 0.3, y - r * 0.08)
      .lineTo(x + r * 0.22, y + r * 0.35)
      .lineTo(x, y + r * 0.5)
      .lineTo(x - r * 0.22, y + r * 0.35)
      .lineTo(x - r * 0.3, y - r * 0.08)
      .lineTo(x, y - r * 0.38)
      .stroke({ width: w, color: 0xffffff, alpha: 0.9, cap: "round", join: "round" });
    return;
  }

  if (object.type === "empMine") {
    g.moveTo(x, y - r * 0.45)
      .lineTo(x + r * 0.42, y + r * 0.32)
      .lineTo(x - r * 0.42, y + r * 0.32)
      .lineTo(x, y - r * 0.45)
      .stroke({ width: w, color: 0xffffff, alpha: 0.9, cap: "round", join: "round" });
    g.moveTo(x, y - r * 0.18).lineTo(x, y + r * 0.12).stroke({ width: w, color: 0xffffff, alpha: 0.9, cap: "round" });
    g.circle(x, y + r * 0.27, Math.max(2, r * 0.05)).fill({ color: 0xffffff, alpha: 0.9 });
    return;
  }

  g.circle(x, y, r * 0.42).stroke({ width: w, color: 0xffffff, alpha: 0.86 });
  g.moveTo(x - r * 0.28, y + r * 0.12).lineTo(x + r * 0.28, y - r * 0.12).stroke({ width: w, color: color, alpha: 0.9, cap: "round" });
}
