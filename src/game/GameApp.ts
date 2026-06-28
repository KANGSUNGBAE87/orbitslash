import { Application, Container } from "pixi.js";
import { BASE_WIDTH, BASE_HEIGHT, computeScale } from "./coords";
import { GameScene } from "./GameScene";

// 앱 수명주기 (implementation-plan §1 [P1], §4.1). PixiJS init, RAF 루프 소유,
// 1080x1920 반응형 캔버스 + scale = min(sw/1080, sh/1920).
// TODO(Phase1-B): 씬 전환(StartScreen→GameScene→ResultScreen) 상태머신.

const MAX_DT_MS = 50; // dt 클램프 — 탭 백그라운드 점프 방지 (§4.1)

export class GameApp {
  private app: Application;
  private root: Container; // 스케일 컨테이너 (내부 좌표계 1080x1920)
  private scene: GameScene;
  private lastTime = 0;

  constructor() {
    this.app = new Application();
    this.root = new Container();
    this.scene = new GameScene();
  }

  async init(mount: HTMLElement): Promise<void> {
    await this.app.init({
      background: 0x05060f,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: window,
    });
    mount.appendChild(this.app.canvas);

    this.root.addChild(this.scene.stage);
    this.app.stage.addChild(this.root);

    this.resize();
    window.addEventListener("resize", () => this.resize());

    // RAF 루프 (deltaTime 계산, 상한 클램프 후 scene.update)
    this.lastTime = performance.now();
    this.app.ticker.add(() => {
      const now = performance.now();
      let dt = now - this.lastTime;
      this.lastTime = now;
      if (dt > MAX_DT_MS) dt = MAX_DT_MS;
      this.scene.update(dt);
    });
  }

  /** 1080x1920 내부 좌표계를 화면에 맞춰 스케일·센터링 (design §3). */
  private resize(): void {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const scale = computeScale(sw, sh);
    this.root.scale.set(scale);
    this.root.x = (sw - BASE_WIDTH * scale) / 2;
    this.root.y = (sh - BASE_HEIGHT * scale) / 2;
  }
}
