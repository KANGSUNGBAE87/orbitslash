import { Container, Graphics } from "pixi.js";
import type { Point } from "../game/types";
import { LAYER } from "../game/layers";

// 슬래시 trail 렌더 (design §10 L9, §1.2 시안). 진행 중 라이브 경로 + 손 뗀 뒤 페이드.
// 판정과 무관한 시각 전용 (product-plan §2.3 Instant Judgment, Delayed Effect).

interface FadingSlash {
  points: Point[];
  age: number; // ms
}

const TRAIL_LIFE_MS = 260;
const TRAIL_COLOR = 0x3fd8ff;

export class SlashTrail {
  readonly container: Container;
  private live: Graphics;
  private fade: Graphics;
  private livePoints: Point[] = [];
  private fading: FadingSlash[] = [];

  constructor() {
    this.container = new Container();
    this.container.zIndex = LAYER.SLASH_VFX;
    this.fade = new Graphics();
    this.live = new Graphics();
    this.container.addChild(this.fade, this.live);
  }

  setLive(points: Point[]): void {
    this.livePoints = points;
    this.redrawLive();
  }

  /** 손 뗀 순간: 라이브 경로를 페이드 목록으로 이관. */
  release(points: Point[]): void {
    if (points.length >= 2) this.fading.push({ points: points.slice(), age: 0 });
    this.livePoints = [];
    this.live.clear();
  }

  update(dtMs: number): void {
    if (this.fading.length === 0) return;
    for (const s of this.fading) s.age += dtMs;
    this.fading = this.fading.filter((s) => s.age < TRAIL_LIFE_MS);
    this.redrawFade();
  }

  private strokePath(g: Graphics, pts: Point[], alpha: number): void {
    if (pts.length < 2) return;
    g.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
    g.stroke({ width: 10, color: TRAIL_COLOR, alpha: alpha * 0.9, cap: "round", join: "round" });
    g.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
    g.stroke({ width: 3, color: 0xffffff, alpha: alpha, cap: "round", join: "round" });
  }

  private redrawLive(): void {
    this.live.clear();
    this.strokePath(this.live, this.livePoints, 1);
  }

  private redrawFade(): void {
    this.fade.clear();
    for (const s of this.fading) {
      const a = 1 - s.age / TRAIL_LIFE_MS;
      this.strokePath(this.fade, s.points, a);
    }
  }
}
