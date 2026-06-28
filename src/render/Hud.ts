import { Container, Graphics, Text, type TextStyle, type TextStyleOptions } from "pixi.js";
import { BASE_WIDTH } from "../game/coords";
import { LAYER } from "../game/layers";
import { t } from "../i18n";
import { energyLabel, scoreLabel, timeLabel, comboLabel } from "../ui/hud-labels";

// HUD 오버레이 (design §6). 텍스트/숫자는 전부 코드 렌더 (이미지에 굽지 않음, i18n 경유).
// 게임필드는 Canvas(PixiJS) — HUD도 PixiJS Text로 캔버스 안에서 그린다 (DOM 회피, §28-1).

export interface HudState {
  energy: number;
  maxEnergy: number;
  score: number;
  combo: number;
  comboMult: number;
  gauge: number;
  gaugeCost: number;
  skillReady: boolean;
  cooldownMs: number;
  timeMs: number;
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function label(opts: Partial<TextStyleOptions>): TextStyle {
  return { fontFamily: FONT, fill: 0xffffff, fontSize: 28, ...opts } as TextStyle;
}

const SKILL_CX = BASE_WIDTH / 2;
const SKILL_CY = 1660;
const SKILL_R = 78;

export class Hud {
  readonly container: Container;

  private energyText: Text;
  private scoreText: Text;
  private timeText: Text;
  private comboText: Text;
  private banner: Text;
  private bannerAge = Infinity;

  private skillRing: Graphics;
  private skillIcon: Graphics;
  private skillText: Text;
  private readyPulse = 0;

  constructor() {
    this.container = new Container();
    this.container.zIndex = LAYER.HUD_PANELS;
    this.container.sortableChildren = true;

    // 좌상단 에너지
    this.energyText = new Text({ text: "", style: label({ fontSize: 30, fill: 0x9fe9ff }) });
    this.energyText.position.set(40, 40);

    // 중앙 상단 점수
    this.scoreText = new Text({ text: "", style: label({ fontSize: 38, fontWeight: "bold", align: "center" }) });
    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.position.set(BASE_WIDTH / 2, 40);

    // 우상단 생존 시간
    this.timeText = new Text({ text: "", style: label({ fontSize: 30, fill: 0xf5b042, align: "right" }) });
    this.timeText.anchor.set(1, 0);
    this.timeText.position.set(BASE_WIDTH - 40, 40);

    // 콤보 (중앙)
    this.comboText = new Text({ text: "", style: label({ fontSize: 56, fontWeight: "bold", fill: 0xffd84d, align: "center" }) });
    this.comboText.anchor.set(0.5);
    this.comboText.position.set(BASE_WIDTH / 2, 360);

    // 배너 (Last Save / Multi Cut)
    this.banner = new Text({ text: "", style: label({ fontSize: 64, fontWeight: "bold", fill: 0x3fd8ff, align: "center" }) });
    this.banner.anchor.set(0.5);
    this.banner.position.set(BASE_WIDTH / 2, 560);

    // 하단 Solar Lance 스킬 버튼 (게이지 링 + 쿨타임)
    this.skillRing = new Graphics();
    this.skillIcon = new Graphics();
    this.skillText = new Text({ text: t("skill.solar_lance"), style: label({ fontSize: 24, fill: 0xffc14d, align: "center" }) });
    this.skillText.anchor.set(0.5, 0);
    this.skillText.position.set(SKILL_CX, SKILL_CY + SKILL_R + 12);

    this.container.addChild(
      this.energyText,
      this.scoreText,
      this.timeText,
      this.comboText,
      this.banner,
      this.skillRing,
      this.skillIcon,
      this.skillText,
    );
  }

  flashBanner(text: string, color = 0x3fd8ff): void {
    if (!text) return;
    this.banner.text = text;
    this.banner.style.fill = color;
    this.bannerAge = 0;
  }

  update(s: HudState, dtMs: number): void {
    this.energyText.text = `${energyLabel()}  ${Math.ceil(s.energy)}/${s.maxEnergy}`;
    this.scoreText.text = `${scoreLabel()}\n${Math.floor(s.score).toLocaleString()}`;
    this.timeText.text = `${timeLabel()}  ${formatTime(s.timeMs)}`;
    this.comboText.text = s.combo >= 2 ? `${comboLabel()} x${s.combo}  (×${s.comboMult.toFixed(1)})` : "";

    // 배너 페이드
    if (this.bannerAge < 900) {
      this.bannerAge += dtMs;
      this.banner.alpha = Math.max(0, 1 - this.bannerAge / 900);
    } else {
      this.banner.alpha = 0;
    }

    this.drawSkillButton(s, dtMs);
  }

  private drawSkillButton(s: HudState, dtMs: number): void {
    const ratio = Math.max(0, Math.min(1, s.gauge / s.gaugeCost));
    const ready = s.skillReady && ratio >= 1;
    if (ready) this.readyPulse += dtMs / 1000;
    else this.readyPulse = 0;

    this.skillRing.clear();
    if (ready) {
      const pulse = (Math.sin(this.readyPulse * 8) + 1) / 2;
      this.skillRing
        .circle(SKILL_CX, SKILL_CY, SKILL_R + 10 + pulse * 8)
        .stroke({ width: 5, color: 0xffc14d, alpha: 0.28 + pulse * 0.32 });
    }
    // 베이스 링
    this.skillRing.circle(SKILL_CX, SKILL_CY, SKILL_R).stroke({ width: 6, color: 0x274060, alpha: 0.9 });
    // 게이지 호 (위에서 시계방향)
    if (ratio > 0) {
      const start = -Math.PI / 2;
      this.skillRing.moveTo(SKILL_CX, SKILL_CY - SKILL_R);
      this.skillRing.arc(SKILL_CX, SKILL_CY, SKILL_R, start, start + ratio * Math.PI * 2);
      this.skillRing.stroke({ width: 6, color: ready ? 0xffc14d : 0x3fd8ff, alpha: 0.95 });
    }

    // 아이콘 (간단 골드 렌즈)
    this.skillIcon.clear();
    this.skillIcon
      .circle(SKILL_CX, SKILL_CY, SKILL_R - 14)
      .fill({ color: ready ? 0xf59e0b : 0x1a2740, alpha: ready ? 0.85 : 0.7 });
    this.skillIcon
      .circle(SKILL_CX, SKILL_CY, SKILL_R - 14)
      .stroke({ width: 2, color: 0xffc14d, alpha: ready ? 1 : 0.5 });

    // 쿨타임 텍스트 (남은 초)
    if (s.cooldownMs > 0) {
      this.skillText.text = `${Math.ceil(s.cooldownMs / 1000)}s`;
      this.skillText.style.fill = 0x88aacc;
    } else {
      this.skillText.text = t("skill.solar_lance");
      this.skillText.style.fill = ready ? 0xffc14d : 0x88aacc;
    }
  }
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
