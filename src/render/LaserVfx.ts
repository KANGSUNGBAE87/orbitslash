import { Container, Graphics } from "pixi.js";
import { SOLAR_LANCE_VFX_WIDTH_PX } from "../game/input-tuning";
import type { Segment } from "../game/types";
import { LAYER } from "../game/layers";

// Solar Lance 레이저 VFX (product-plan §9.2). 골드/오렌지 관통 빔, 시각 전용.
// ⚠️ 판정은 손 뗀 순간 스냅샷(GameScene)에서 끝남 — 이 연출은 결과에 영향 없음 (§28-4).

interface Beam {
  seg: Segment;
  age: number;
}

const BEAM_LIFE_MS = 360;

export class LaserVfx {
  readonly container: Container;
  private g: Graphics;
  private beams: Beam[] = [];

  constructor() {
    this.container = new Container();
    this.container.zIndex = LAYER.SLASH_VFX;
    this.g = new Graphics();
    this.container.addChild(this.g);
  }

  fire(seg: Segment): void {
    this.beams.push({ seg, age: 0 });
  }

  update(dtMs: number): void {
    if (this.beams.length === 0) return;
    for (const b of this.beams) b.age += dtMs;
    this.beams = this.beams.filter((b) => b.age < BEAM_LIFE_MS);
    this.g.clear();
    for (const b of this.beams) {
      const a = 1 - b.age / BEAM_LIFE_MS;
      const { a: p0, b: p1 } = b.seg;
      this.g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: SOLAR_LANCE_VFX_WIDTH_PX, color: 0xff9a2e, alpha: a * 0.16, cap: "round" });
      this.g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: SOLAR_LANCE_VFX_WIDTH_PX * 0.45, color: 0xffc14d, alpha: a * 0.34, cap: "round" });
      this.g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: 18, color: 0xffffff, alpha: a * 0.92, cap: "round" });
    }
  }
}
