import { Container, Graphics, Rectangle, Sprite, Texture, type FederatedPointerEvent } from "pixi.js";
import { BASE_WIDTH, BASE_HEIGHT, EARTH_BODY_RADIUS, EARTH_GAMEPLAY_RADIUS, distance } from "./coords";
import { LAYER } from "./layers";
import { Earth } from "./Earth";
import { RemoteConfig } from "./RemoteConfig";
import { createRng } from "./Rng";
import { waveHudState, WaveGenerator } from "./WaveGenerator";
import { ObjectManager } from "./ObjectManager";
import { OrbitSpawner } from "./OrbitSpawner";
import { GestureSystem } from "./GestureSystem";
import { enemyTouchesImpactZone, resolveLineHits, resolveLiveSegmentHits, resolveLiveSegmentDirectionalRejects, multiCutTier } from "./CollisionSystem";
import { ScoringSystem, comboMultiplierFor } from "./ScoringSystem";
import { EnergySystem } from "./EnergySystem";
import { SkillSystem } from "./SkillSystem";
import { RunSession } from "./RunSession";
import { Telemetry } from "./Telemetry";
import { stepEnemy, enemyXY } from "./Enemy";
import { readDevNumberParam, readDevStringParam } from "./DevQa";
import { feedbackForHitBand } from "./HitFeedback";
import { requiredDirectionalSlashAngleRad } from "./DirectionalCut";
import { pathLength, trimPathToMaxLength } from "./gesture-helpers";
import { StrokeHitTracker } from "./StrokeHitTracker";
import { enemyHitShakeOffset } from "./HitShake";
import { shouldReserveLiveSlashForSolarLance } from "./SolarLanceReserve";
import { shouldReserveLiveSlashForGravitySlow } from "./GravitySlowReserve";
import { groupByComboTimeout } from "./ComboTiming";
import { buildSkillCooldownSlots } from "./SkillCooldownSlots";
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
import { Hud } from "../render/Hud";
import { ResultOverlay } from "../render/ResultOverlay";
import { multiCutLabel, lastSaveLabel, multiplierLabel } from "../ui/hud-labels";
import { t } from "../i18n";
import { LocalBackendAdapter } from "../platform/BackendAdapter";
import type { Point, EnemyState, EarthRef, ZoneTable, EnemyTable, ScoringConfig, DifficultyTable, SkillTable, OrbitProfile, WaveTable, HitResult, Segment, SpawnSpec } from "./types";

// 한 판 플레이 씬 (implementation-plan §1, §4 게임 루프).
// 고정 update 순서 (§4.1): input(이벤트) → spawn → movement → collision(지구) → scoring(이벤트) → render.
//   슬래시 판정은 pointer-up 이벤트에서 즉시 확정(§2.3 Instant Judgment); 연출은 시각 전용.

const DIFFICULTY = "rookie"; // Phase 1: 단일 난이도 (오픈이슈 #2)
const GAUGE_MAX = 100;
const NORMAL_SLASH_DAMAGE = 1;
const BOSS_EVERY_MS = 60000;
const BOSS_ENEMY_TYPE = "eclipse_core";
const DEV_QA_PRESETS = ["directional", "lastSave", "dense"] as const;
type DevQaPreset = (typeof DEV_QA_PRESETS)[number];

interface PendingKill {
  hit: HitResult;
  score: number;
  type: string;
  x: number;
  y: number;
  hitAtMs: number;
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
  private enemyLayer: Container;
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

  // 시스템 (한 판마다 재생성)
  private objects!: ObjectManager;
  private spawner!: OrbitSpawner;
  private wave!: WaveGenerator;
  private scoring!: ScoringSystem;
  private energy!: EnergySystem;
  private skills!: SkillSystem;
  private runSession!: RunSession;
  private readonly backend = new LocalBackendAdapter();
  private gesture = new GestureSystem();

  // 적 스프라이트 (간단 풀)
  private sprites = new Map<number, EnemySpriteNode>();
  private spritePool: EnemySpriteNode[] = [];

  // 런 상태
  private running = false;
  private elapsedMs = 0;
  private gauge = 0;
  private gravitySlowRemainingMs = 0;
  private gravitySlowMultiplier = 1;
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

  constructor() {
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
    bg.rect(0, 0, BASE_WIDTH, BASE_HEIGHT).fill({ color: 0x05060f });
    bg.zIndex = LAYER.BACKGROUND_SPACE;
    this.stage.addChild(bg);

    // L1 별
    const stars = new Graphics();
    let seed = 1337;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 140; i++) {
      stars.circle(rand() * BASE_WIDTH, rand() * BASE_HEIGHT, 0.6 + rand() * 1.6).fill({ color: 0xffffff, alpha: 0.15 + rand() * 0.5 });
    }
    stars.zIndex = LAYER.STARS_NEBULA;
    this.stage.addChild(stars);

    // L4 적 레이어
    this.enemyLayer = new Container();
    this.enemyLayer.zIndex = LAYER.ENEMIES;
    this.stage.addChild(this.enemyLayer);

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

    // 포인터 입력 (게임필드 = 1080x1920 좌표계)
    this.stage.eventMode = "static";
    this.stage.hitArea = new Rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT);
    this.stage.on("pointerdown", this.onPointerDown, this);
    this.stage.on("pointermove", this.onPointerMove, this);
    this.stage.on("pointerup", this.onPointerUp, this);
    this.stage.on("pointerupoutside", this.onPointerUp, this);

    this.startRun();
  }

  // ── 런 수명주기 ───────────────────────────────────────────────────────────

  private startRun(): void {
    const diff = this.difficulty[DIFFICULTY] as unknown as { earthEnergy: number; gravitySwell: number };
    let seedOverride: number | undefined;
    let gaugeOverride: number | undefined;
    let qaPreset: DevQaPreset | undefined;
    if (import.meta.env.DEV && typeof window !== "undefined") {
      const search = window.location.search;
      seedOverride = readDevNumberParam(search, "seed", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
      gaugeOverride = readDevNumberParam(search, "qaGauge", { min: 0, max: GAUGE_MAX });
      qaPreset = readDevStringParam(search, "qaPreset", DEV_QA_PRESETS);
    }
    this.objects = new ObjectManager();
    this.spawner = new OrbitSpawner(this.enemies, this.objects);
    const runStart = this.backend.beginLocalRun(DIFFICULTY, seedOverride ?? (Date.now() >>> 0));
    this.runSession = new RunSession(runStart);
    this.wave = new WaveGenerator(
      createRng(runStart.seed),
      { difficulty: runStart.difficulty, bossEveryMs: BOSS_EVERY_MS, bossEnemyType: BOSS_ENEMY_TYPE },
      this.enemies,
      this.difficulty,
      this.orbits,
      this.waves,
    );
    this.scoring = new ScoringSystem(this.scoringCfg);
    this.energy = new EnergySystem(diff.earthEnergy);
    this.skills = new SkillSystem(this.skillTable);
    this.gauge = gaugeOverride ?? (this.skillTable._debug.instantFillGauge ? GAUGE_MAX : 0);
    this.elapsedMs = 0;
    this.gravitySlowRemainingMs = 0;
    this.gravitySlowMultiplier = 1;
    this.running = true;
    this.enemyHitFeedback.clear();
    this.earth.setVisualState("healthy");
    this.resetStrokeState();
    this.spawnDevQaPreset(qaPreset);
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
      this.spawner.spawn([
        make("directional_comet", 0, 360),
        make("basic_meteor", Math.PI * 0.7, 430),
      ]);
      return;
    }

    if (preset === "lastSave") {
      this.spawner.spawn([make("basic_meteor", 0, EARTH_GAMEPLAY_RADIUS * 1.75)]);
      return;
    }

    this.spawner.spawn([
      make("small_meteor", 0, 420),
      make("basic_meteor", Math.PI * 0.35, 460),
      make("fast_comet", Math.PI * 0.72, 500),
      make("iron_planet", Math.PI * 0.92, 520),
      make("heavy_asteroid", Math.PI * 1.1, 520),
      make("directional_comet", Math.PI * 1.45, 560),
      make("ancient_planet", Math.PI * 1.75, 600),
    ]);
  }

  private restart(): void {
    for (const [, g] of this.sprites) this.releaseSprite(g);
    this.sprites.clear();
    this.slashTrail.release([]);
    this.result.hide();
    this.destructionBurst.clear();
    this.hitBurst.clear();
    Telemetry.flush();
    this.startRun();
  }

  private endRun(): void {
    this.running = false;
    const snap = this.scoring.snapshot();
    const summary = this.runSession.finish({
      survivalMs: this.elapsedMs,
      score: snap.score,
      kills: snap.kills,
      maxCombo: snap.maxCombo,
      lastSaveCount: snap.lastSaveCount,
      remainingEnergy: this.energy.getEnergy(),
    });
    Telemetry.track("death", { difficulty: summary.difficulty, score: summary.score, survivalMs: summary.survivalMs });
    Telemetry.flush();
    this.result.show(snap, this.elapsedMs);
  }

  // ── 포인터 입력 (Instant Judgment) ───────────────────────────────────────

  private toPoint(e: FederatedPointerEvent): Point {
    const local = e.getLocalPosition(this.stage);
    return { x: local.x, y: local.y, t: performance.now() };
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.running) return;
    const p = this.toPoint(e);
    this.gesture.onPointerDown(p);
    this.resetStrokeState();
    this.livePoints = [p];
    this.slashTrail.setLive(this.livePoints);
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.running || this.livePoints.length === 0) return;
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
    if (!this.running || this.livePoints.length === 0) return;
    const earth = this.earth.ref();
    const g = this.gesture.onPointerUp(this.toPoint(e), earth);
    this.livePoints = [];
    this.slashTrail.release(g.points);
    this.resolveInput(g.points, earth);
    this.resetStrokeState();
  }

  /** release-time 스킬/정산 판정. 일반 베기 contact hit는 pointer-move에서 처리한다. */
  private resolveInput(points: Point[], earth: EarthRef): void {
    const committedMovement = pathLength(points) >= MISS_COMMIT_DISTANCE_PX;
    const gesture = this.gestureResultFromPoints(points, earth);
    const act = !this.strokeHadHit ? this.skills.trySolarLance(gesture, { earth, gauge: this.gauge, screenShortSide: BASE_WIDTH }) : null;

    if (act) {
      if (!this.skillTable._debug.infiniteGauge) {
        this.gauge = Math.max(0, this.gauge - this.skillTable.solar_lance.gaugeCost);
      }
      this.runSession.recordSkillUse("solar_lance");
      Telemetry.track("skill_fire", { skillId: "solar_lance" });
      this.laser.fire(act.vfxLine); // 연출 — 판정 불변
      const lanceKills = this.applyHits(
        resolveLineHits(act.vfxLine, this.objects.getAlive(), earth.cx, earth.cy, earth.r, this.zones, {
          hitRadiusInflatePx: SOLAR_LANCE_HIT_INFLATE_PX,
          hitRadiusScaleForEnemy: (enemy) => this.enemyVisualScale(enemy),
        }),
        this.skillTable.solar_lance.hitDamage ?? NORMAL_SLASH_DAMAGE,
        points[points.length - 1]?.t ?? performance.now(),
      );
      this.commitKills(lanceKills, earth, false);
      this.objects.prune();
      return;
    }

    const slow = !this.strokeHadHit ? this.skills.tryGravitySlow(gesture, { earth, gauge: this.gauge, screenShortSide: BASE_WIDTH }) : null;
    if (slow) {
      if (!this.skillTable._debug.infiniteGauge) {
        this.gauge = Math.max(0, this.gauge - this.skillTable.gravity_slow.gaugeCost);
      }
      this.gravitySlowRemainingMs = slow.durationMs;
      this.gravitySlowMultiplier = slow.slowMultiplier;
      this.runSession.recordSkillUse("gravity_slow");
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

    if (this.strokeKills.length > 0) {
      this.commitKills(this.strokeKills, earth, true);
    } else if (committedMovement && !this.strokeHadHit) {
      this.scoring.onMiss(); // 탭/짧은 입력은 neutral, 의미 있는 빈 슬래시만 콤보 끊김.
      Telemetry.track("combo_break", { reason: "miss" });
    }
    this.objects.prune();
  }

  private resetStrokeState(): void {
    this.strokeHitTracker.reset();
    this.strokeHadHit = false;
    this.strokeKills = [];
    this.strokeMoved = false;
    this.strokeDirectionalRejects.clear();
  }

  private resolveLiveSlashSegment(segment: Segment, earth: EarthRef): void {
    const hits = resolveLiveSegmentHits(segment, this.objects.getAlive(), earth.cx, earth.cy, earth.r, this.zones, {
      minSegmentLengthPx: LIVE_SEGMENT_MIN_LENGTH_PX,
      hitRadiusInflatePx: NORMAL_SLASH_HIT_INFLATE_PX,
      hitRadiusScaleForEnemy: (enemy) => this.enemyVisualScale(enemy),
      canHitEnemy: (enemy) => this.strokeHitTracker.canHit(enemy.id, segment.b.t),
    });
    this.spawnDirectionalRejectFeedback(segment, earth);
    if (hits.length === 0) {
      this.updateStrokeHitRearm(segment);
      return;
    }

    const kills = this.applyHits(hits, NORMAL_SLASH_DAMAGE, segment.b.t);
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
        color: 0x64748b,
        secondaryColor: 0x8ff3ff,
        radius: Math.max(28, enemy.radiusPx * this.enemyVisualScale(enemy) * 0.52),
        particleCount: 7,
        lifeMs: 240,
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
    const diff = this.difficulty[DIFFICULTY] as unknown as { gravitySwell: number };
    return depthScale(enemy.radius, EARTH_GAMEPLAY_RADIUS, diff.gravitySwell);
  }

  private applyHits(hits: HitResult[], damage: number, hitAtMs = performance.now()): PendingKill[] {
    const killed: PendingKill[] = [];
    for (const h of hits) {
      this.strokeHadHit = true;
      this.strokeHitTracker.recordHit(h.enemyId, hitAtMs);
      const result = this.objects.applyDamage(h.enemyId, damage);
      if (result.enemy) this.triggerEnemyHitFeedback(h.enemyId);
      if (!result.killed || !result.enemy) continue;

      const pos = enemyXY(result.enemy);
      killed.push({
        hit: h,
        score: result.enemy.score,
        type: result.enemy.type,
        x: pos.x,
        y: pos.y,
        hitAtMs,
      });
      this.removeSprite(h.enemyId);
    }
    return killed;
  }

  private commitKills(kills: PendingKill[], earth: EarthRef, visualsAlreadyShown: boolean): void {
    if (kills.length === 0) return;

    const scoreById = new Map(kills.map((k) => [k.hit.enemyId, k.score] as const));
    const typeById = new Map(kills.map((k) => [k.hit.enemyId, k.type] as const));
    const groups = groupByComboTimeout(kills, this.scoringCfg.comboChainTimeoutMs ?? 650);

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
      this.gauge = Math.min(GAUGE_MAX, this.gauge + res.gauge);

      const tier = multiCutTier(group.length);
      if (tier !== "none") this.hud.flashBanner(multiCutLabel(tier), 0xffc14d);
      if (res.lastSave) {
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
        Telemetry.track("last_save", { difficulty: DIFFICULTY });
      }
    }
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
    return shouldReserveLiveSlashForSolarLance(points, earth, {
      strokeHadHit: this.strokeHadHit,
      skillReady: this.skills.isReady("solar_lance"),
      gauge: this.gauge,
      gaugeCost: this.skillTable.solar_lance.gaugeCost,
      infiniteGauge: this.skillTable._debug.infiniteGauge,
      screenShortSide: BASE_WIDTH,
    });
  }

  private shouldReserveStrokeForGravitySlow(points: Point[], earth: EarthRef): boolean {
    return shouldReserveLiveSlashForGravitySlow(points, earth, {
      strokeHadHit: this.strokeHadHit,
      skillReady: this.skills.isReady("gravity_slow"),
      gauge: this.gauge,
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

  private drawEnemyOverlay(g: Graphics, en: EnemyState, hitFeedback?: EnemyHitFeedbackState): void {
    g.clear();
    const r = en.radiusPx;
    const style = enemyVisualStyle(en.type);
    if (en.boss) {
      g.circle(0, 0, r + 14).stroke({ width: 10, color: style.sparkleColor, alpha: 0.66 });
      g.circle(0, 0, r + 30).stroke({ width: 4, color: 0xfef3c7, alpha: 0.34 });
      g.circle(0, 0, r * 0.28).stroke({ width: 8, color: 0xffffff, alpha: 0.22 });
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
      g.circle(0, 0, r + 10 + t * (en.boss ? 28 : 14)).stroke({ width: en.boss ? 10 : 6, color: 0xffffff, alpha: t * (en.boss ? 0.62 : 0.42) });
      g.circle(0, 0, Math.max(10, r * 0.22 + t * r * 0.18)).stroke({ width: en.boss ? 7 : 4, color: style.sparkleColor, alpha: t * 0.48 });
    }
  }

  // ── 메인 update (RAF) ─────────────────────────────────────────────────────

  update(dtMs: number): void {
    if (this.running) {
      this.elapsedMs += dtMs;
      this.skills.tick(dtMs);
      if (this.gravitySlowRemainingMs > 0) {
        this.gravitySlowRemainingMs = Math.max(0, this.gravitySlowRemainingMs - dtMs);
        if (this.gravitySlowRemainingMs === 0) this.gravitySlowMultiplier = 1;
      }

      // spawn
      const spawns = this.wave.next(this.elapsedMs);
      for (const spawn of spawns) Telemetry.track("spawn", { enemyType: spawn.enemyType, difficulty: DIFFICULTY });
      this.spawner.spawn(spawns);

      // movement + 지구 충돌
      const diff = this.difficulty[DIFFICULTY] as unknown as { gravitySwell: number };
      const movementDtMs = this.gravitySlowRemainingMs > 0 ? dtMs * this.gravitySlowMultiplier : dtMs;
      for (const en of this.objects.getAlive()) {
        stepEnemy(en, movementDtMs);
        if (enemyTouchesImpactZone(en.radius, en.radiusPx, EARTH_GAMEPLAY_RADIUS, this.zones, diff.gravitySwell, en.earthImpactRadiusPx)) {
          const r = this.energy.applyDamage(en.damage);
          this.scoring.onMiss(); // 지구 피격 = 콤보 끊김
          Telemetry.track("combo_break", { reason: "earth_hit" });
          this.objects.kill(en.id);
          this.removeSprite(en.id);
          this.earth.setVisualState(this.energy.visualState());
          if (r.gameOver) {
            this.objects.prune();
            this.endRun();
            break;
          }
        }
      }
      this.objects.prune();
      this.updateEnemyHitFeedback(dtMs);

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
        const shake = hitFeedback
          ? enemyHitShakeOffset(en.id, hitFeedback.elapsedMs, hitFeedback.intensityPx, hitFeedback.durationMs)
          : { x: 0, y: 0, scale: 1 };
        this.drawEnemyOverlay(g.overlay, en, hitFeedback);
        g.container.position.set(pos.x + shake.x, pos.y + shake.y);
        g.container.scale.set(this.enemyVisualScale(en) * shake.scale);
      }
    } else {
      this.updateEnemyHitFeedback(dtMs);
    }

    // 시각 갱신 (running 무관)
    this.earth.update(dtMs);
    this.slashTrail.update(dtMs);
    this.laser.update(dtMs);
    this.destructionBurst.update(dtMs);
    this.hitBurst.update(dtMs);

    const snap = this.scoring.snapshot();
    const cost = this.skillTable.solar_lance.gaugeCost;
    const wave = waveHudState(this.elapsedMs);
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
        timeMs: this.elapsedMs,
      },
      dtMs,
    );
  }

  private skillCooldownSlots() {
    const defs = [
      { id: "solar_lance", label: t("skill.solar_lance"), cost: this.skillTable.solar_lance.gaugeCost, cooldownSec: this.skillTable.solar_lance.cooldownSec, active: true },
      { id: "orbital_cut", label: t("skill.orbital_cut"), cost: this.skillTable.orbital_cut.gaugeCost, cooldownSec: this.skillTable.orbital_cut.cooldownSec, active: false },
      { id: "gravity_slow", label: t("skill.gravity_slow"), cost: this.skillTable.gravity_slow.gaugeCost, cooldownSec: this.skillTable.gravity_slow.cooldownSec, active: true },
      { id: "delta_shield", label: t("skill.delta_shield"), cost: this.skillTable.delta_shield.gaugeCost, cooldownSec: this.skillTable.delta_shield.cooldownSec, active: false },
      { id: "reserve_slot", label: t("skill.reserve_slot"), cost: this.skillTable.reserve_slot.gaugeCost, cooldownSec: this.skillTable.reserve_slot.cooldownSec, active: false },
    ];
    return buildSkillCooldownSlots(defs, this.gauge, (skillId) => this.skills?.cooldownRemaining(skillId) ?? 0);
  }
}
