import { Container, Graphics, Text, type TextStyle, type TextStyleOptions } from "pixi.js";
import { BASE_WIDTH, BASE_HEIGHT } from "../game/coords";
import { LAYER } from "../game/layers";
import { t } from "../i18n";
import type { ScoringSnapshot } from "../game/ScoringSystem";

// 최소 결과 화면 (implementation-plan §9 step 8). Game Over → 점수/생존시간 표시 + 재시작.
// Phase 1 최소 구현. 정식 Result/Victory 화면(design §13)은 이후 Phase.

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
function style(opts: Partial<TextStyleOptions>): TextStyle {
  return { fontFamily: FONT, fill: 0xffffff, fontSize: 40, align: "center", ...opts } as TextStyle;
}

export class ResultOverlay {
  readonly container: Container;
  onRestart: (() => void) | null = null;

  private title: Text;
  private body: Text;
  private hint: Text;

  constructor() {
    this.container = new Container();
    this.container.zIndex = LAYER.OVERLAY;
    this.container.visible = false;
    this.container.eventMode = "static";
    this.container.cursor = "pointer";

    const dim = new Graphics();
    dim.rect(0, 0, BASE_WIDTH, BASE_HEIGHT).fill({ color: 0x05060f, alpha: 0.78 });
    dim.eventMode = "static";
    dim.hitArea = { contains: () => true } as never;

    const panel = new Graphics();
    panel.roundRect(BASE_WIDTH / 2 - 380, BASE_HEIGHT / 2 - 320, 760, 640, 28).fill({ color: 0x0c1730, alpha: 0.95 });
    panel.roundRect(BASE_WIDTH / 2 - 380, BASE_HEIGHT / 2 - 320, 760, 640, 28).stroke({ width: 3, color: 0xff5a5a, alpha: 0.8 });

    this.title = new Text({ text: t("result.gameOver"), style: style({ fontSize: 72, fontWeight: "bold", fill: 0xff6b6b }) });
    this.title.anchor.set(0.5);
    this.title.position.set(BASE_WIDTH / 2, BASE_HEIGHT / 2 - 180);

    this.body = new Text({ text: "", style: style({ fontSize: 44 }) });
    this.body.anchor.set(0.5);
    this.body.position.set(BASE_WIDTH / 2, BASE_HEIGHT / 2);

    this.hint = new Text({ text: t("result.restart"), style: style({ fontSize: 34, fill: 0xffc14d }) });
    this.hint.anchor.set(0.5);
    this.hint.position.set(BASE_WIDTH / 2, BASE_HEIGHT / 2 + 220);

    this.container.addChild(dim, panel, this.title, this.body, this.hint);
    this.container.on("pointertap", () => {
      if (this.container.visible) this.onRestart?.();
    });
  }

  show(snap: ScoringSnapshot, survivalMs: number): void {
    const sec = Math.floor(survivalMs / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    this.body.text =
      `${t("result.score")}: ${Math.floor(snap.score).toLocaleString()}\n` +
      `${t("result.time")}: ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}\n` +
      `${t("hud.combo")}: x${snap.maxCombo}`;
    this.container.visible = true;
  }

  hide(): void {
    this.container.visible = false;
  }
}
