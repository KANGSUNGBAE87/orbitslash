import { Container, Graphics, Text, type TextStyle, type TextStyleOptions } from "pixi.js";
import { BASE_WIDTH } from "../game/coords";
import { LAYER } from "../game/layers";
import { t } from "../i18n";
import { energyLabel, scoreLabel, timeLabel, comboLabel } from "../ui/hud-labels";

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
  skillSlots: SkillCooldownSlot[];
  waveNumber: number;
  waveProgressRatio: number;
  nextWaveInMs: number;
  timeMs: number;
}

export interface SkillCooldownSlot {
  id: string;
  label: string;
  ratio: number;
  cooldownRatio: number;
  ready: boolean;
  cooldownMs: number;
  active: boolean;
  visualState: "locked" | "charging" | "cooldown" | "ready";
}

export interface TopSkillSlotLayout {
  x: number;
  y: number;
  radius: number;
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function label(opts: Partial<TextStyleOptions>): TextStyle {
  return { fontFamily: FONT, fill: 0xffffff, fontSize: 28, ...opts } as TextStyle;
}

const SKILL_ROW_X = 24;
const SKILL_ROW_Y = 124;
const SKILL_ROW_W = BASE_WIDTH - SKILL_ROW_X * 2;
const SKILL_ROW_H = 170;
const SKILL_ORB_R = 62;
const SKILL_ORB_Y = 188;
const SKILL_CARD_W = 184;
const SKILL_CARD_H = 154;
const WAVE_BAR_X = 72;
const WAVE_BAR_Y = 312;
const WAVE_BAR_W = BASE_WIDTH - WAVE_BAR_X * 2;
const WAVE_BAR_H = 18;

export function topSkillSlotLayout(count: number): TopSkillSlotLayout[] {
  if (count <= 0) return [];
  const firstX = 132;
  const lastX = BASE_WIDTH - firstX;
  const step = count === 1 ? 0 : (lastX - firstX) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const x = Math.round(firstX + step * i);
    return {
      x,
      y: SKILL_ORB_Y,
      radius: SKILL_ORB_R,
      cardX: x - SKILL_CARD_W / 2,
      cardY: SKILL_ROW_Y + 8,
      cardW: SKILL_CARD_W,
      cardH: SKILL_CARD_H,
    };
  });
}

export class Hud {
  readonly container: Container;

  private energyText: Text;
  private scoreText: Text;
  private timeText: Text;
  private comboText: Text;
  private banner: Text;
  private bannerAge = Infinity;

  private skillRow: Graphics;
  private waveGauge: Graphics;
  private waveText: Text;
  private slotCenterTexts: Text[] = [];
  private slotLabelTexts: Text[] = [];
  private readyPulse = 0;

  constructor() {
    this.container = new Container();
    this.container.zIndex = LAYER.HUD_PANELS;
    this.container.sortableChildren = true;

    this.energyText = new Text({ text: "", style: label({ fontSize: 30, fill: 0x9fe9ff }) });
    this.energyText.position.set(40, 40);

    this.scoreText = new Text({ text: "", style: label({ fontSize: 38, fontWeight: "bold", align: "center" }) });
    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.position.set(BASE_WIDTH / 2, 32);

    this.timeText = new Text({ text: "", style: label({ fontSize: 30, fill: 0xf5b042, align: "right" }) });
    this.timeText.anchor.set(1, 0);
    this.timeText.position.set(BASE_WIDTH - 40, 40);

    this.comboText = new Text({ text: "", style: label({ fontSize: 56, fontWeight: "bold", fill: 0xffd84d, align: "center" }) });
    this.comboText.anchor.set(0.5);
    this.comboText.position.set(BASE_WIDTH / 2, 380);

    this.banner = new Text({ text: "", style: label({ fontSize: 64, fontWeight: "bold", fill: 0x3fd8ff, align: "center" }) });
    this.banner.anchor.set(0.5);
    this.banner.position.set(BASE_WIDTH / 2, 580);

    this.skillRow = new Graphics();
    this.waveGauge = new Graphics();
    this.waveText = new Text({ text: "", style: label({ fontSize: 23, fontWeight: "bold", fill: 0xdbeafe, align: "center" }) });
    this.waveText.anchor.set(0.5, 0.5);
    this.waveText.position.set(BASE_WIDTH / 2, WAVE_BAR_Y + 34);

    this.container.addChild(
      this.energyText,
      this.scoreText,
      this.timeText,
      this.comboText,
      this.banner,
      this.skillRow,
      this.waveGauge,
      this.waveText,
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

    if (this.bannerAge < 900) {
      this.bannerAge += dtMs;
      this.banner.alpha = Math.max(0, 1 - this.bannerAge / 900);
    } else {
      this.banner.alpha = 0;
    }

    if (s.skillSlots.some((slot) => slot.ready)) this.readyPulse += dtMs / 1000;
    else this.readyPulse = 0;

    this.drawSkillSlots(s.skillSlots);
    this.drawWaveGauge(s);
  }

  private drawSkillSlots(slots: SkillCooldownSlot[]): void {
    const layout = topSkillSlotLayout(slots.length);
    this.ensureSlotTexts(slots.length);
    this.skillRow.clear();
    this.skillRow
      .roundRect(SKILL_ROW_X, SKILL_ROW_Y, SKILL_ROW_W, SKILL_ROW_H, 30)
      .fill({ color: 0x080b16, alpha: 0.58 });

    for (let i = 0; i < this.slotCenterTexts.length; i += 1) {
      const slot = slots[i];
      const cell = layout[i];
      const centerText = this.slotCenterTexts[i]!;
      const labelText = this.slotLabelTexts[i]!;
      centerText.visible = Boolean(slot && cell);
      labelText.visible = Boolean(slot && cell);
      if (!slot || !cell) continue;

      const ready = slot.visualState === "ready";
      const locked = slot.visualState === "locked";
      const cooldown = slot.visualState === "cooldown";
      const charging = slot.visualState === "charging";
      const pulse = ready ? (Math.sin(this.readyPulse * 14) + 1) / 2 : 0;
      const rim = ready ? 0xffc14d : cooldown ? 0xf97316 : charging ? 0x3fd8ff : 0x475569;
      const fill = ready ? 0xf59e0b : locked ? 0x111827 : 0x172033;

      this.skillRow.roundRect(cell.cardX, cell.cardY, cell.cardW, cell.cardH, 24).fill({ color: 0x050914, alpha: locked ? 0.42 : 0.68 });
      this.skillRow.roundRect(cell.cardX, cell.cardY, cell.cardW, cell.cardH, 24).stroke({ width: ready ? 3 : 1.5, color: rim, alpha: ready ? 0.8 : 0.35 });
      if (ready) {
        this.skillRow.circle(cell.x, cell.y, cell.radius + 7 + pulse * 9).stroke({ width: 8, color: 0xffd166, alpha: 0.25 + pulse * 0.4 });
      }

      this.skillRow.circle(cell.x, cell.y, cell.radius).fill({ color: fill, alpha: locked ? 0.45 : 0.88 });
      this.skillRow.circle(cell.x, cell.y, cell.radius).stroke({ width: 9, color: 0x1e293b, alpha: locked ? 0.55 : 0.85 });

      const ringRatio = cooldown ? 1 - slot.cooldownRatio : slot.ratio;
      if (ringRatio > 0) {
        const start = -Math.PI / 2;
        this.skillRow.moveTo(cell.x, cell.y - cell.radius);
        this.skillRow.arc(cell.x, cell.y, cell.radius, start, start + Math.min(1, ringRatio) * Math.PI * 2);
        this.skillRow.stroke({ width: 10, color: rim, alpha: locked ? 0.25 : 0.95 });
      }

      if (ready) {
        const sweepX = cell.x - cell.radius + ((this.readyPulse * 120) % (cell.radius * 2));
        this.skillRow.moveTo(sweepX - 18, cell.y - cell.radius * 0.72);
        this.skillRow.lineTo(sweepX + 18, cell.y + cell.radius * 0.72);
        this.skillRow.stroke({ width: 6, color: 0xffffff, alpha: 0.22, cap: "round" });
      }

      centerText.text = centerTextForSlot(slot);
      centerText.style.fill = ready ? 0x111827 : locked ? 0x94a3b8 : 0xffffff;
      centerText.style.fontSize = ready ? 27 : 30;
      centerText.position.set(cell.x, cell.y);

      labelText.text = shortSkillLabel(slot);
      labelText.style.fill = ready ? 0xffd166 : locked ? 0x64748b : 0xdbeafe;
      labelText.position.set(cell.x, SKILL_ROW_Y + SKILL_ROW_H - 24);
    }
  }

  private drawWaveGauge(s: HudState): void {
    const ratio = Math.max(0, Math.min(1, s.waveProgressRatio));
    this.waveGauge.clear();
    this.waveGauge.roundRect(WAVE_BAR_X, WAVE_BAR_Y, WAVE_BAR_W, WAVE_BAR_H, 9).fill({ color: 0x111827, alpha: 0.82 });
    this.waveGauge.roundRect(WAVE_BAR_X, WAVE_BAR_Y, WAVE_BAR_W * ratio, WAVE_BAR_H, 9).fill({ color: 0x3fd8ff, alpha: 0.92 });
    for (let i = 1; i < 6; i += 1) {
      const x = WAVE_BAR_X + (WAVE_BAR_W * i) / 6;
      this.waveGauge.moveTo(x, WAVE_BAR_Y - 4).lineTo(x, WAVE_BAR_Y + WAVE_BAR_H + 4);
      this.waveGauge.stroke({ width: 2, color: i === 5 ? 0xffc14d : 0xffffff, alpha: i === 5 ? 0.7 : 0.24 });
    }
    this.waveGauge.roundRect(WAVE_BAR_X, WAVE_BAR_Y, WAVE_BAR_W, WAVE_BAR_H, 9).stroke({ width: 2, color: 0x274060, alpha: 0.9 });

    const seconds = Math.ceil(s.nextWaveInMs / 1000);
    this.waveText.text = `${t("hud.wave")} ${s.waveNumber}  ·  ${secondsLabel(seconds)}`;
  }

  private ensureSlotTexts(count: number): void {
    while (this.slotCenterTexts.length < count) {
      const center = new Text({ text: "", style: label({ fontSize: 30, fontWeight: "bold", fill: 0xffffff, align: "center" }) });
      center.anchor.set(0.5);
      const name = new Text({ text: "", style: label({ fontSize: 18, fontWeight: "bold", fill: 0xdbeafe, align: "center" }) });
      name.anchor.set(0.5);
      this.slotCenterTexts.push(center);
      this.slotLabelTexts.push(name);
      this.container.addChild(center, name);
    }
  }
}

function centerTextForSlot(slot: SkillCooldownSlot): string {
  if (slot.visualState === "locked") return "·";
  if (slot.visualState === "ready") return t("skill.ready");
  if (slot.visualState === "cooldown") return secondsLabel(Math.ceil(slot.cooldownMs / 1000));
  return `${Math.floor(slot.ratio * 100)}%`;
}

function secondsLabel(seconds: number): string {
  return t("unit.seconds", { value: seconds });
}

function shortSkillLabel(slot: SkillCooldownSlot): string {
  if (slot.label.length <= 5) return slot.label;
  return slot.label.slice(0, 5);
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
