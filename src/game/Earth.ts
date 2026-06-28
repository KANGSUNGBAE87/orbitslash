import { Container, Graphics } from "pixi.js";
import {
  EARTH_CENTER_X,
  EARTH_CENTER_Y,
  EARTH_BODY_RADIUS,
  EARTH_GAMEPLAY_RADIUS,
  EARTH_SHIELD_RADIUS,
  LAST_SAVE_RING_RADIUS,
} from "./coords";
import { LAYER } from "./layers";
import type { EarthVisualState } from "./EnergySystem";
import type { EarthRef } from "./types";

// 지구 렌더 (design §2.2). 작은 지구: body 300px(radius 150), shield 420px, center (540,900).
// ⚠️ 하드룰: 게임 화면 지구는 절대 500px 이상 금지. 목업의 과대 지구 따르지 않음.
// Phase 1은 플레이스홀더 도형(원/링). 스프라이트 교체는 이후 에셋 파이프라인.

// 에너지 상태별 shield 색 (product-plan §11.3).
const SHIELD_STYLE: Record<EarthVisualState, { color: number; alpha: number }> = {
  healthy: { color: 0x3fd8ff, alpha: 0.55 }, // 100~70 파란 방어막
  cracked: { color: 0x6fb4ff, alpha: 0.45 }, // 69~40 균열
  warning: { color: 0xff7a4d, alpha: 0.6 }, // 39~10 붉은 경고
  critical: { color: 0xff3a3a, alpha: 0.85 }, // 9 이하
};

export class Earth {
  readonly container: Container;
  private body: Graphics;
  private shieldOuter: Graphics;
  private lastSaveRing: Graphics;
  private rotation = 0;
  private state: EarthVisualState = "healthy";
  private pulse = 0;
  private lastSavePulseMs = 0;

  constructor() {
    this.container = new Container();
    this.container.x = EARTH_CENTER_X;
    this.container.y = EARTH_CENTER_Y;

    // Last Save 링 (평소 약하게) — L6 영역
    this.lastSaveRing = new Graphics();
    this.drawLastSaveRing();
    this.lastSaveRing.zIndex = LAYER.ORBIT_GUIDE;

    // Shield 외곽 (시안 글로우 링)
    this.shieldOuter = new Graphics();
    this.shieldOuter
      .circle(0, 0, EARTH_SHIELD_RADIUS)
      .stroke({ width: 4, color: 0x3fd8ff, alpha: 0.55 });
    this.shieldOuter
      .circle(0, 0, EARTH_SHIELD_RADIUS - 8)
      .stroke({ width: 1.5, color: 0x9fe9ff, alpha: 0.25 });
    this.shieldOuter.zIndex = LAYER.EARTH_SHIELD_OUTER;

    // 지구 본체 (로우폴리 느낌 플레이스홀더: 바다 + 대륙 점)
    this.body = new Graphics();
    this.drawBody();
    this.body.zIndex = LAYER.EARTH;

    this.container.sortableChildren = true;
    this.container.addChild(this.lastSaveRing, this.shieldOuter, this.body);
  }

  private drawBody(): void {
    const r = EARTH_BODY_RADIUS;
    this.body.clear();
    // 바다
    this.body.circle(0, 0, r).fill({ color: 0x123a6b });
    this.body.circle(0, 0, r).fill({ color: 0x1a4f8a, alpha: 0.6 });
    // 대륙 (단순 초록 덩어리 — 회전 시각용)
    this.body.ellipse(-r * 0.3, -r * 0.2, r * 0.34, r * 0.24).fill({ color: 0x2f9e54 });
    this.body.ellipse(r * 0.35, r * 0.25, r * 0.26, r * 0.32).fill({ color: 0x3aa861 });
    this.body.ellipse(r * 0.1, -r * 0.45, r * 0.18, r * 0.14).fill({ color: 0x2f9e54 });
    // 림 하이라이트
    this.body.circle(0, 0, r).stroke({ width: 2, color: 0x6fd0ff, alpha: 0.45 });
  }

  private drawShield(): void {
    const st = SHIELD_STYLE[this.state];
    // warning/critical에서 경고 펄스 (alpha 진동)
    const pulseBoost = this.state === "warning" || this.state === "critical" ? Math.sin(this.pulse) * 0.2 : 0;
    const a = Math.max(0.1, st.alpha + pulseBoost);
    this.shieldOuter.clear();
    this.shieldOuter.circle(0, 0, EARTH_SHIELD_RADIUS).stroke({ width: 4, color: st.color, alpha: a });
    this.shieldOuter.circle(0, 0, EARTH_SHIELD_RADIUS - 8).stroke({ width: 1.5, color: st.color, alpha: a * 0.45 });
  }

  private drawLastSaveRing(): void {
    const t = Math.max(0, Math.min(1, this.lastSavePulseMs / 520));
    const boost = t * t;
    this.lastSaveRing.clear();
    this.lastSaveRing
      .circle(0, 0, LAST_SAVE_RING_RADIUS + boost * 24)
      .stroke({ width: 2 + boost * 5, color: 0x3fd8ff, alpha: 0.18 + boost * 0.65 });
    if (boost > 0) {
      this.lastSaveRing
        .circle(0, 0, LAST_SAVE_RING_RADIUS + 14 + boost * 34)
        .stroke({ width: 2, color: 0xffffff, alpha: boost * 0.55 });
    }
  }

  /** 에너지 비율에 따른 상태 연출 (product-plan §11.3). */
  setVisualState(state: EarthVisualState): void {
    if (state === this.state) return;
    this.state = state;
    this.drawShield();
  }

  flashLastSave(): void {
    this.lastSavePulseMs = 520;
    this.drawLastSaveRing();
  }

  /** 충돌 판정용 지구 기준 (중심/반지름 R). */
  ref(): EarthRef {
    return { cx: EARTH_CENTER_X, cy: EARTH_CENTER_Y, r: EARTH_GAMEPLAY_RADIUS };
  }

  /** 느린 지구 회전 + 경고 펄스 (design §11). dtMs 단위. */
  update(dtMs: number): void {
    this.rotation += (dtMs / 1000) * 0.12; // 매우 느린 자전
    this.body.rotation = this.rotation;
    if (this.state === "warning" || this.state === "critical") {
      this.pulse += (dtMs / 1000) * 6;
      this.drawShield();
    }
    if (this.lastSavePulseMs > 0) {
      this.lastSavePulseMs = Math.max(0, this.lastSavePulseMs - dtMs);
      this.drawLastSaveRing();
    }
  }
}
