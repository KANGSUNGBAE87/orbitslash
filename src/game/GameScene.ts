import { Container, Graphics, Rectangle, type FederatedPointerEvent } from "pixi.js";
import { BASE_WIDTH, BASE_HEIGHT, EARTH_BODY_RADIUS, EARTH_GAMEPLAY_RADIUS } from "./coords";
import { LAYER } from "./layers";
import { Earth } from "./Earth";
import { RemoteConfig } from "./RemoteConfig";
import { createRng } from "./Rng";
import { WaveGenerator } from "./WaveGenerator";
import { ObjectManager } from "./ObjectManager";
import { OrbitSpawner } from "./OrbitSpawner";
import { GestureSystem } from "./GestureSystem";
import { enemyTouchesImpactZone, resolveLineHits, resolveLiveSegmentHits, multiCutTier } from "./CollisionSystem";
import { ScoringSystem, comboMultiplierFor } from "./ScoringSystem";
import { EnergySystem } from "./EnergySystem";
import { SkillSystem } from "./SkillSystem";
import { stepEnemy, enemyXY } from "./Enemy";
import { readDevNumberParam } from "./DevQa";
import { feedbackForHitBand } from "./HitFeedback";
import { pathLength, straightness, trimPathToMaxLength } from "./gesture-helpers";
import {
  LIVE_SEGMENT_MIN_LENGTH_PX,
  MISS_COMMIT_DISTANCE_PX,
  NORMAL_SLASH_HIT_INFLATE_PX,
  SOLAR_LANCE_HIT_INFLATE_PX,
  STROKE_TRAIL_MAX_LENGTH_PX,
} from "./input-tuning";
import { SlashTrail } from "../render/SlashTrail";
import { LaserVfx } from "../render/LaserVfx";
import { HitBurst } from "../render/HitBurst";
import { Hud } from "../render/Hud";
import { ResultOverlay } from "../render/ResultOverlay";
import { multiCutLabel, lastSaveLabel, multiplierLabel } from "../ui/hud-labels";
import { t } from "../i18n";
import type { Point, EnemyState, EarthRef, ZoneTable, EnemyTable, ScoringConfig, DifficultyTable, SkillTable, OrbitProfile, HitResult, Segment } from "./types";

// 한 판 플레이 씬 (implementation-plan §1, §4 게임 루프).
// 고정 update 순서 (§4.1): input(이벤트) → spawn → movement → collision(지구) → scoring(이벤트) → render.
//   슬래시 판정은 pointer-up 이벤트에서 즉시 확정(§2.3 Instant Judgment); 연출은 시각 전용.

const DIFFICULTY = "rookie"; // Phase 1: 단일 난이도 (오픈이슈 #2)
const GAUGE_MAX = 100;
const NORMAL_SLASH_DAMAGE = 1;

interface PendingKill {
  hit: HitResult;
  score: number;
  type: string;
  x: number;
  y: number;
}

// 적 깊이감: 멀리 0.6 → 가까이 1.3 (design §11.2)
function depthScale(radius: number, R: number, swell: number): number {
  const near = R * 1.2 * swell;
  const far = 950;
  const tt = Math.max(0, Math.min(1, (far - radius) / (far - near)));
  return 0.6 + tt * 0.7;
}

// 적 타입별 플레이스홀더 색 (에셋 교체 전 — design §1.2 danger 계열). Phase 1.
const ENEMY_COLOR: Record<string, { fill: number; rim: number }> = {
  small_meteor: { fill: 0x8a8f9c, rim: 0xff8a3d },
  basic_meteor: { fill: 0x7c8493, rim: 0xff7a2e },
  fast_comet: { fill: 0xffae5c, rim: 0xff5a2e },
  heavy_asteroid: { fill: 0x6b7280, rim: 0xff6b2e },
};

export class GameScene {
  readonly stage: Container;
  private earth: Earth;
  private enemyLayer: Container;
  private slashTrail: SlashTrail;
  private laser: LaserVfx;
  private hitBurst: HitBurst;
  private hud: Hud;
  private result: ResultOverlay;

  // 데이터 테이블 (RemoteConfig 단일 통로)
  private readonly enemies: EnemyTable;
  private readonly scoringCfg: ScoringConfig;
  private readonly difficulty: DifficultyTable;
  private readonly skillTable: SkillTable;
  private readonly orbits: OrbitProfile[];
  private readonly zones: ZoneTable;

  // 시스템 (한 판마다 재생성)
  private objects!: ObjectManager;
  private spawner!: OrbitSpawner;
  private wave!: WaveGenerator;
  private scoring!: ScoringSystem;
  private energy!: EnergySystem;
  private skills!: SkillSystem;
  private gesture = new GestureSystem();

  // 적 스프라이트 (간단 풀)
  private sprites = new Map<number, Graphics>();
  private spritePool: Graphics[] = [];

  // 런 상태
  private running = false;
  private elapsedMs = 0;
  private gauge = 0;
  private livePoints: Point[] = [];
  private strokeHitEnemyIds = new Set<number>();
  private strokeKills: PendingKill[] = [];
  private strokeMoved = false;

  constructor() {
    this.stage = new Container();
    this.stage.sortableChildren = true;

    // 데이터 로드
    this.enemies = RemoteConfig.getEnemies();
    this.scoringCfg = RemoteConfig.getScoring();
    this.difficulty = RemoteConfig.getDifficulty();
    this.skillTable = RemoteConfig.getSkills();
    this.orbits = RemoteConfig.getOrbits();
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
    this.hitBurst = new HitBurst();
    this.stage.addChild(this.slashTrail.container, this.laser.container, this.hitBurst.container);

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
    if (import.meta.env.DEV && typeof window !== "undefined") {
      const search = window.location.search;
      seedOverride = readDevNumberParam(search, "seed", { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
      gaugeOverride = readDevNumberParam(search, "qaGauge", { min: 0, max: GAUGE_MAX });
    }
    this.objects = new ObjectManager();
    this.spawner = new OrbitSpawner(this.enemies, this.objects);
    this.wave = new WaveGenerator(createRng(seedOverride ?? Date.now()), { difficulty: DIFFICULTY }, this.enemies, this.difficulty, this.orbits);
    this.scoring = new ScoringSystem(this.scoringCfg);
    this.energy = new EnergySystem(diff.earthEnergy);
    this.skills = new SkillSystem(this.skillTable);
    this.gauge = gaugeOverride ?? (this.skillTable._debug.instantFillGauge ? GAUGE_MAX : 0);
    this.elapsedMs = 0;
    this.running = true;
    this.earth.setVisualState("healthy");
    this.resetStrokeState();
  }

  private restart(): void {
    for (const [, g] of this.sprites) this.releaseSprite(g);
    this.sprites.clear();
    this.slashTrail.release([]);
    this.result.hide();
    this.hitBurst.clear();
    this.startRun();
  }

  private endRun(): void {
    this.running = false;
    this.result.show(this.scoring.snapshot(), this.elapsedMs);
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
    const act =
      this.strokeHitEnemyIds.size === 0
        ? this.skills.trySolarLance(
            this.gestureResultFromPoints(points, earth),
            { earth, gauge: this.gauge, screenShortSide: BASE_WIDTH },
          )
        : null;

    if (act) {
      if (!this.skillTable._debug.infiniteGauge) {
        this.gauge = Math.max(0, this.gauge - this.skillTable.solar_lance.gaugeCost);
      }
      this.laser.fire(act.vfxLine); // 연출 — 판정 불변
      const lanceKills = this.applyHits(
        resolveLineHits(act.vfxLine, this.objects.getAlive(), earth.cx, earth.cy, earth.r, this.zones, {
          hitRadiusInflatePx: SOLAR_LANCE_HIT_INFLATE_PX,
        }),
        this.skillTable.solar_lance.hitDamage ?? NORMAL_SLASH_DAMAGE,
      );
      this.commitKills(lanceKills, earth, false);
      this.objects.prune();
      return;
    }

    if (this.strokeKills.length > 0) {
      this.commitKills(this.strokeKills, earth, true);
    } else if (committedMovement && this.strokeHitEnemyIds.size === 0) {
      this.scoring.onMiss(); // 탭/짧은 입력은 neutral, 의미 있는 빈 슬래시만 콤보 끊김.
    }
    this.objects.prune();
  }

  private resetStrokeState(): void {
    this.strokeHitEnemyIds.clear();
    this.strokeKills = [];
    this.strokeMoved = false;
  }

  private resolveLiveSlashSegment(segment: Segment, earth: EarthRef): void {
    const hits = resolveLiveSegmentHits(segment, this.objects.getAlive(), earth.cx, earth.cy, earth.r, this.zones, {
      minSegmentLengthPx: LIVE_SEGMENT_MIN_LENGTH_PX,
      hitRadiusInflatePx: NORMAL_SLASH_HIT_INFLATE_PX,
      alreadyHitEnemyIds: this.strokeHitEnemyIds,
    });
    if (hits.length === 0) return;

    const kills = this.applyHits(hits, NORMAL_SLASH_DAMAGE);
    for (const kill of kills) {
      this.strokeKills.push(kill);
      this.spawnKillFeedback(kill);
    }
    this.objects.prune();
  }

  private applyHits(hits: HitResult[], damage: number): PendingKill[] {
    const killed: PendingKill[] = [];
    for (const h of hits) {
      this.strokeHitEnemyIds.add(h.enemyId);
      const result = this.objects.applyDamage(h.enemyId, damage);
      if (!result.killed || !result.enemy) continue;

      const pos = enemyXY(result.enemy);
      killed.push({
        hit: h,
        score: result.enemy.score,
        type: result.enemy.type,
        x: pos.x,
        y: pos.y,
      });
      this.removeSprite(h.enemyId);
    }
    return killed;
  }

  private commitKills(kills: PendingKill[], earth: EarthRef, visualsAlreadyShown: boolean): void {
    if (kills.length === 0) return;

    const scoreById = new Map(kills.map((k) => [k.hit.enemyId, k.score] as const));
    const typeById = new Map(kills.map((k) => [k.hit.enemyId, k.type] as const));
    const res = this.scoring.onHit(
      kills.map((k) => k.hit),
      (id) => scoreById.get(id) ?? 0,
      (id) => typeById.get(id) ?? "",
    );
    this.gauge = Math.min(GAUGE_MAX, this.gauge + res.gauge);

    if (!visualsAlreadyShown) {
      for (const kill of kills) this.spawnKillFeedback(kill);
    }

    const tier = multiCutTier(kills.length);
    if (tier !== "none") this.hud.flashBanner(multiCutLabel(tier), 0xffc14d);
    if (res.lastSave) {
      this.hitBurst.spawn(earth.cx, earth.cy, lastSaveLabel(), 0x3fd8ff, EARTH_BODY_RADIUS * 2.4, true);
      this.earth.flashLastSave();
      this.hud.flashBanner(lastSaveLabel(), 0x3fd8ff);
    }
  }

  private spawnKillFeedback(kill: PendingKill): void {
    const feedback = feedbackForHitBand(kill.hit.band, this.scoringCfg);
    this.hitBurst.spawn(kill.x, kill.y, multiplierLabel(feedback.multiplier), feedback.color, feedback.radius, feedback.isLastSave);
  }

  private shouldReserveStrokeForSolarLance(points: Point[], earth: EarthRef): boolean {
    if (!this.skills.isReady("solar_lance")) return false;
    if (this.gauge < this.skillTable.solar_lance.gaugeCost && !this.skillTable._debug.infiniteGauge) return false;
    if (points.length < 2 || pathLength(points) < BASE_WIDTH * 0.18) return false;
    if (straightness(points) < 0.9) return false;

    const first = points[0]!;
    const last = points[points.length - 1]!;
    const lineDist = pointToSegmentDistance(earth.cx, earth.cy, first.x, first.y, last.x, last.y);
    return lineDist <= earth.r * 0.9;
  }

  /** GestureSystem 없이 점 배열만으로 분류 결과 생성 (Solar Lance 판정용). */
  private gestureResultFromPoints(points: Point[], earth: EarthRef) {
    return this.gesture.classify(points, earth);
  }

  // ── 적 스프라이트 풀 ──────────────────────────────────────────────────────

  private acquireSprite(): Graphics {
    const g = this.spritePool.pop() ?? new Graphics();
    g.visible = true;
    return g;
  }

  private releaseSprite(g: Graphics): void {
    g.clear();
    g.visible = false;
    if (g.parent) g.parent.removeChild(g);
    this.spritePool.push(g);
  }

  private removeSprite(id: number): void {
    const g = this.sprites.get(id);
    if (g) {
      this.releaseSprite(g);
      this.sprites.delete(id);
    }
  }

  private drawEnemySprite(g: Graphics, en: EnemyState): void {
    const c = ENEMY_COLOR[en.type] ?? { fill: 0x8a8f9c, rim: 0xff7a2e };
    g.clear();
    g.circle(0, 0, en.radiusPx).fill({ color: c.fill });
    g.circle(0, 0, en.radiusPx).stroke({ width: 3, color: c.rim, alpha: 0.85 });
    // 작은 균열 하이라이트
    g.circle(-en.radiusPx * 0.3, -en.radiusPx * 0.3, en.radiusPx * 0.25).fill({ color: 0xffffff, alpha: 0.08 });
  }

  // ── 메인 update (RAF) ─────────────────────────────────────────────────────

  update(dtMs: number): void {
    if (this.running) {
      this.elapsedMs += dtMs;
      this.skills.tick(dtMs);

      // spawn
      this.spawner.spawn(this.wave.next(this.elapsedMs));

      // movement + 지구 충돌
      const diff = this.difficulty[DIFFICULTY] as unknown as { gravitySwell: number };
      for (const en of this.objects.getAlive()) {
        stepEnemy(en, dtMs);
        if (enemyTouchesImpactZone(en.radius, en.radiusPx, EARTH_GAMEPLAY_RADIUS, this.zones, diff.gravitySwell)) {
          const r = this.energy.applyDamage(en.damage);
          this.scoring.onMiss(); // 지구 피격 = 콤보 끊김
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

      // render 적 스프라이트
      const diff2 = this.difficulty[DIFFICULTY] as unknown as { gravitySwell: number };
      for (const en of this.objects.getAlive()) {
        let g = this.sprites.get(en.id);
        if (!g) {
          g = this.acquireSprite();
          this.drawEnemySprite(g, en);
          this.enemyLayer.addChild(g);
          this.sprites.set(en.id, g);
        }
        const pos = enemyXY(en);
        g.position.set(pos.x, pos.y);
        g.scale.set(depthScale(en.radius, EARTH_GAMEPLAY_RADIUS, diff2.gravitySwell));
      }
    }

    // 시각 갱신 (running 무관)
    this.earth.update(dtMs);
    this.slashTrail.update(dtMs);
    this.laser.update(dtMs);
    this.hitBurst.update(dtMs);

    const snap = this.scoring.snapshot();
    const cost = this.skillTable.solar_lance.gaugeCost;
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
        timeMs: this.elapsedMs,
      },
      dtMs,
    );
  }

  private skillCooldownSlots() {
    const defs = [
      { id: "solar_lance", label: t("skill.solar_lance"), cost: this.skillTable.solar_lance.gaugeCost, active: true },
      { id: "orbital_cut", label: t("skill.orbital_cut"), cost: this.skillTable.orbital_cut.gaugeCost, active: false },
      { id: "gravity_slow", label: t("skill.gravity_slow"), cost: this.skillTable.gravity_slow.gaugeCost, active: false },
      { id: "delta_shield", label: t("skill.delta_shield"), cost: this.skillTable.delta_shield.gaugeCost, active: false },
    ];
    return defs.map((slot) => {
      const cooldownMs = this.skills?.cooldownRemaining(slot.id) ?? 0;
      const ratio = Math.max(0, Math.min(1, this.gauge / slot.cost));
      return {
        id: slot.id,
        label: slot.label,
        ratio,
        ready: slot.active && cooldownMs <= 0 && ratio >= 1,
        cooldownMs,
        active: slot.active,
      };
    });
  }
}

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
