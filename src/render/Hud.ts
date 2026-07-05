import { Container, Graphics, Text, type TextStyle, type TextStyleOptions } from "pixi.js";
import { BASE_HEIGHT, BASE_WIDTH } from "../game/coords";
import { LAYER } from "../game/layers";
import type { BossHudState } from "../game/BossHudState";
import type { TutorialHudState } from "../game/TutorialHudState";
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
  boss?: BossHudState;
  shield?: ShieldHudState;
  tutorial?: TutorialHudState;
  timeMs: number;
}

export interface ShieldHudState {
  active: boolean;
  remainingMs: number;
  durationMs: number;
  absorbsRemaining: number;
  maxAbsorbs: number;
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

export interface HudRectMetrics {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HudLayoutMetrics {
  time: { x: number; y: number; anchorX: number };
  waveBar: HudRectMetrics;
  bossBar: HudRectMetrics;
  shieldBar: HudRectMetrics;
  tutorialPanel: HudRectMetrics;
  blockedPanel: HudRectMetrics;
  skillRow: HudRectMetrics;
  earthEnergyBar: HudRectMetrics;
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function label(opts: Partial<TextStyleOptions>): TextStyle {
  return { fontFamily: FONT, fill: 0xffffff, fontSize: 28, ...opts } as TextStyle;
}

const SKILL_ROW_X = 24;
const SKILL_ROW_Y = 1548;
const SKILL_ROW_W = BASE_WIDTH - SKILL_ROW_X * 2;
const SKILL_ROW_H = 266;
const SKILL_ORB_R = 62;
const SKILL_ORB_Y = 1674;
const SKILL_CARD_W = 184;
const SKILL_CARD_H = 224;
const WAVE_BAR_X = 72;
const WAVE_BAR_Y = 312;
const WAVE_BAR_W = BASE_WIDTH - WAVE_BAR_X * 2;
const WAVE_BAR_H = 44;
const BOSS_BAR_W = 520;
const BOSS_BAR_H = 26;
const BOSS_BAR_X = (BASE_WIDTH - BOSS_BAR_W) / 2;
const BOSS_BAR_Y = WAVE_BAR_Y + WAVE_BAR_H + 42;
const BOSS_OBJECTIVE_Y = BOSS_BAR_Y + BOSS_BAR_H + 28;
const SHIELD_BAR_W = 420;
const SHIELD_BAR_H = 28;
const SHIELD_BAR_X = (BASE_WIDTH - SHIELD_BAR_W) / 2;
const SHIELD_BAR_Y = BOSS_BAR_Y + BOSS_BAR_H + 68;
const EARTH_ENERGY_BAR_X = 32;
const EARTH_ENERGY_BAR_W = BASE_WIDTH - EARTH_ENERGY_BAR_X * 2;
const EARTH_ENERGY_BAR_H = 52;
const EARTH_ENERGY_BAR_Y = BASE_HEIGHT - 92;
const TUTORIAL_PANEL_X = 86;
const TUTORIAL_PANEL_Y = 1390;
const TUTORIAL_PANEL_W = BASE_WIDTH - TUTORIAL_PANEL_X * 2;
const TUTORIAL_PANEL_H = 128;
const BLOCKED_PANEL_X = 130;
const BLOCKED_PANEL_Y = 1048;
const BLOCKED_PANEL_W = BASE_WIDTH - BLOCKED_PANEL_X * 2;
const BLOCKED_PANEL_H = 136;
const BLOCKED_PANEL_LIFE_MS = 1400;

export function hudLayoutMetrics(): HudLayoutMetrics {
  return {
    time: { x: BASE_WIDTH / 2, y: 28, anchorX: 0.5 },
    waveBar: { x: WAVE_BAR_X, y: WAVE_BAR_Y, w: WAVE_BAR_W, h: WAVE_BAR_H },
    bossBar: { x: BOSS_BAR_X, y: BOSS_BAR_Y, w: BOSS_BAR_W, h: BOSS_BAR_H },
    shieldBar: { x: SHIELD_BAR_X, y: SHIELD_BAR_Y, w: SHIELD_BAR_W, h: SHIELD_BAR_H },
    tutorialPanel: { x: TUTORIAL_PANEL_X, y: TUTORIAL_PANEL_Y, w: TUTORIAL_PANEL_W, h: TUTORIAL_PANEL_H },
    blockedPanel: { x: BLOCKED_PANEL_X, y: BLOCKED_PANEL_Y, w: BLOCKED_PANEL_W, h: BLOCKED_PANEL_H },
    skillRow: { x: SKILL_ROW_X, y: SKILL_ROW_Y, w: SKILL_ROW_W, h: SKILL_ROW_H },
    earthEnergyBar: {
      x: EARTH_ENERGY_BAR_X,
      y: EARTH_ENERGY_BAR_Y,
      w: EARTH_ENERGY_BAR_W,
      h: EARTH_ENERGY_BAR_H,
    },
  };
}

export function skillSlotLayout(count: number): TopSkillSlotLayout[] {
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
  private blockedPanel: Graphics;
  private blockedTitle: Text;
  private blockedMessage: Text;
  private blockedAge = Infinity;

  private skillRow: Graphics;
  private waveGauge: Graphics;
  private waveText: Text;
  private bossGauge: Graphics;
  private bossText: Text;
  private bossObjectiveText: Text;
  private shieldGauge: Graphics;
  private shieldText: Text;
  private earthEnergyGauge: Graphics;
  private tutorialPanel: Graphics;
  private tutorialTitle: Text;
  private tutorialMessage: Text;
  private slotCenterTexts: Text[] = [];
  private slotLabelTexts: Text[] = [];
  private readyPulse = 0;
  private bossPulse = 0;

  constructor() {
    this.container = new Container();
    this.container.zIndex = LAYER.HUD_PANELS;
    this.container.sortableChildren = true;

    this.energyText = new Text({ text: "", style: label({ fontSize: 30, fontWeight: "bold", fill: 0xe0f7ff, align: "center" }) });
    this.energyText.anchor.set(0.5);
    this.energyText.position.set(BASE_WIDTH / 2, EARTH_ENERGY_BAR_Y + EARTH_ENERGY_BAR_H / 2);

    this.scoreText = new Text({ text: "", style: label({ fontSize: 31, fontWeight: "bold", align: "left" }) });
    this.scoreText.anchor.set(0, 0);
    this.scoreText.position.set(40, 32);

    const metrics = hudLayoutMetrics();
    this.timeText = new Text({ text: "", style: label({ fontSize: 35, fontWeight: "bold", fill: 0xf5b042, align: "center" }) });
    this.timeText.anchor.set(metrics.time.anchorX, 0);
    this.timeText.position.set(metrics.time.x, metrics.time.y);

    this.comboText = new Text({ text: "", style: label({ fontSize: 56, fontWeight: "bold", fill: 0xffd84d, align: "center" }) });
    this.comboText.anchor.set(0.5);
    this.comboText.position.set(BASE_WIDTH / 2, 380);

    this.banner = new Text({ text: "", style: label({ fontSize: 64, fontWeight: "bold", fill: 0x3fd8ff, align: "center" }) });
    this.banner.anchor.set(0.5);
    this.banner.position.set(BASE_WIDTH / 2, 580);

    this.blockedPanel = new Graphics();
    this.blockedPanel.label = "blocked-weak-point-panel";
    this.blockedTitle = new Text({ text: "", style: label({ fontSize: 33, fontWeight: "bold", fill: 0xffc14d, align: "center" }) });
    this.blockedTitle.label = "blocked-weak-point-title";
    this.blockedTitle.anchor.set(0.5);
    this.blockedTitle.position.set(BASE_WIDTH / 2, BLOCKED_PANEL_Y + 36);
    this.blockedMessage = new Text({
      text: "",
      style: label({ fontSize: 27, fontWeight: "bold", fill: 0xffffff, align: "center", wordWrap: true, wordWrapWidth: BLOCKED_PANEL_W - 140 }),
    });
    this.blockedMessage.label = "blocked-weak-point-message";
    this.blockedMessage.anchor.set(0.5, 0);
    this.blockedMessage.position.set(BASE_WIDTH / 2, BLOCKED_PANEL_Y + 68);

    this.skillRow = new Graphics();
    this.waveGauge = new Graphics();
    this.waveText = new Text({ text: "", style: label({ fontSize: 23, fontWeight: "bold", fill: 0xdbeafe, align: "center" }) });
    this.waveText.anchor.set(0.5, 0.5);
    this.waveText.position.set(BASE_WIDTH / 2, WAVE_BAR_Y + WAVE_BAR_H + 22);

    this.bossGauge = new Graphics();
    this.bossText = new Text({ text: "", style: label({ fontSize: 24, fontWeight: "bold", fill: 0xffedd5, align: "center" }) });
    this.bossText.anchor.set(0.5);
    this.bossText.position.set(BASE_WIDTH / 2, BOSS_BAR_Y + BOSS_BAR_H / 2);
    this.bossObjectiveText = new Text({
      text: "",
      style: label({ fontSize: 22, fontWeight: "bold", fill: 0xffd7a3, align: "center", wordWrap: true, wordWrapWidth: BOSS_BAR_W + 180 }),
    });
    this.bossObjectiveText.label = "boss-objective-text";
    this.bossObjectiveText.anchor.set(0.5, 0.5);
    this.bossObjectiveText.position.set(BASE_WIDTH / 2, BOSS_OBJECTIVE_Y);

    this.shieldGauge = new Graphics();
    this.shieldText = new Text({ text: "", style: label({ fontSize: 22, fontWeight: "bold", fill: 0xdbeafe, align: "center" }) });
    this.shieldText.anchor.set(0.5);
    this.shieldText.position.set(BASE_WIDTH / 2, SHIELD_BAR_Y + SHIELD_BAR_H / 2);

    this.earthEnergyGauge = new Graphics();
    this.tutorialPanel = new Graphics();
    this.tutorialTitle = new Text({
      text: "",
      style: label({ fontSize: 25, fontWeight: "bold", fill: 0x9fe9ff, align: "left" }),
    });
    this.tutorialTitle.anchor.set(0, 0);
    this.tutorialTitle.position.set(TUTORIAL_PANEL_X + 32, TUTORIAL_PANEL_Y + 20);
    this.tutorialMessage = new Text({
      text: "",
      style: label({
        fontSize: 31,
        fontWeight: "bold",
        fill: 0xffffff,
        align: "left",
        wordWrap: true,
        wordWrapWidth: TUTORIAL_PANEL_W - 64,
      }),
    });
    this.tutorialMessage.anchor.set(0, 0);
    this.tutorialMessage.position.set(TUTORIAL_PANEL_X + 32, TUTORIAL_PANEL_Y + 56);

    this.container.addChild(
      this.skillRow,
      this.waveGauge,
      this.bossGauge,
      this.shieldGauge,
      this.earthEnergyGauge,
      this.tutorialPanel,
      this.blockedPanel,
      this.energyText,
      this.scoreText,
      this.timeText,
      this.comboText,
      this.banner,
      this.waveText,
      this.bossText,
      this.bossObjectiveText,
      this.shieldText,
      this.tutorialTitle,
      this.tutorialMessage,
      this.blockedTitle,
      this.blockedMessage,
    );
  }

  flashBanner(text: string, color = 0x3fd8ff): void {
    if (!text) return;
    this.banner.text = text;
    this.banner.style.fill = color;
    this.bannerAge = 0;
  }

  flashBlockedWeakPoint(title: string, message: string): void {
    if (!title || !message) return;
    this.blockedTitle.text = title;
    this.blockedMessage.text = message;
    this.blockedAge = 0;
  }

  update(s: HudState, dtMs: number): void {
    this.scoreText.text = `${scoreLabel()}\n${Math.floor(s.score).toLocaleString()}`;
    this.timeText.text = `${timeLabel()}  ${formatTime(s.timeMs)}`;
    this.comboText.text = s.combo >= 2 ? `${comboLabel()} x${s.combo}  (×${s.comboMult.toFixed(1)})` : "";

    if (this.bannerAge < 900) {
      this.bannerAge += dtMs;
      this.banner.alpha = Math.max(0, 1 - this.bannerAge / 900);
    } else {
      this.banner.alpha = 0;
    }

    this.drawBlockedCallout(dtMs);

    if (s.skillSlots.some((slot) => slot.ready)) this.readyPulse += dtMs / 1000;
    else this.readyPulse = 0;
    if (s.boss?.active || s.boss?.warning) this.bossPulse += dtMs / 1000;
    else this.bossPulse = 0;

    this.drawSkillSlots(s.skillSlots);
    this.drawWaveGauge(s);
    this.drawBossGauge(s.boss);
    this.drawShieldGauge(s.shield);
    this.drawEarthEnergy(s);
    this.drawTutorial(s.tutorial);
  }

  private drawBlockedCallout(dtMs: number): void {
    this.blockedPanel.clear();
    if (this.blockedAge >= BLOCKED_PANEL_LIFE_MS) {
      this.blockedTitle.text = "";
      this.blockedMessage.text = "";
      return;
    }

    this.blockedAge += dtMs;
    const lifeRatio = Math.max(0, Math.min(1, this.blockedAge / BLOCKED_PANEL_LIFE_MS));
    const alpha = Math.max(0, 1 - lifeRatio);
    const pulse = (Math.sin(this.blockedAge * 0.035) + 1) / 2;
    this.blockedPanel
      .roundRect(BLOCKED_PANEL_X, BLOCKED_PANEL_Y, BLOCKED_PANEL_W, BLOCKED_PANEL_H, 28)
      .fill({ color: 0x1c0b0a, alpha: 0.78 * alpha });
    this.blockedPanel
      .roundRect(BLOCKED_PANEL_X, BLOCKED_PANEL_Y, BLOCKED_PANEL_W, BLOCKED_PANEL_H, 28)
      .stroke({ width: 5 + pulse * 3, color: 0xffc14d, alpha: 0.92 * alpha });
    this.blockedPanel.circle(BLOCKED_PANEL_X + 32, BLOCKED_PANEL_Y + BLOCKED_PANEL_H / 2, 13 + pulse * 5).fill({ color: 0xff5a2e, alpha: 0.82 * alpha });
    this.blockedPanel.circle(BLOCKED_PANEL_X + BLOCKED_PANEL_W - 32, BLOCKED_PANEL_Y + BLOCKED_PANEL_H / 2, 13 + pulse * 5).fill({ color: 0xff5a2e, alpha: 0.82 * alpha });
    this.blockedTitle.alpha = alpha;
    this.blockedMessage.alpha = alpha;
  }

  private drawSkillSlots(slots: SkillCooldownSlot[]): void {
    const layout = skillSlotLayout(slots.length);
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
    this.waveGauge.roundRect(WAVE_BAR_X, WAVE_BAR_Y, WAVE_BAR_W, WAVE_BAR_H, 15).fill({ color: 0x111827, alpha: 0.84 });
    this.waveGauge.roundRect(WAVE_BAR_X, WAVE_BAR_Y, WAVE_BAR_W * ratio, WAVE_BAR_H, 15).fill({ color: 0x3fd8ff, alpha: 0.96 });
    for (let i = 1; i < 6; i += 1) {
      const x = WAVE_BAR_X + (WAVE_BAR_W * i) / 6;
      this.waveGauge.moveTo(x, WAVE_BAR_Y - 5).lineTo(x, WAVE_BAR_Y + WAVE_BAR_H + 5);
      this.waveGauge.stroke({ width: 3, color: i === 5 ? 0xffc14d : 0xffffff, alpha: i === 5 ? 0.7 : 0.24 });
    }
    this.waveGauge.roundRect(WAVE_BAR_X, WAVE_BAR_Y, WAVE_BAR_W, WAVE_BAR_H, 15).stroke({ width: 3, color: 0x274060, alpha: 0.95 });

    const seconds = Math.ceil(s.nextWaveInMs / 1000);
    this.waveText.text = `${t("hud.wave")} ${s.waveNumber}  ·  ${secondsLabel(seconds)}`;
  }

  private drawBossGauge(boss: BossHudState | undefined): void {
    this.bossGauge.clear();
    if (!boss) {
      this.bossText.text = "";
      this.bossObjectiveText.text = "";
      return;
    }

    const pulse = (Math.sin(this.bossPulse * 9) + 1) / 2;
    const ratio = boss.active ? Math.max(0, Math.min(1, boss.hpRatio)) : Math.max(0, Math.min(1, boss.threatPercent / 100));
    const color = boss.active ? 0xff5a2e : 0xffc14d;
    const rim = boss.active ? 0xffedd5 : 0xfef08a;

    this.bossGauge.roundRect(BOSS_BAR_X, BOSS_BAR_Y, BOSS_BAR_W, BOSS_BAR_H, 13).fill({ color: 0x160b0b, alpha: 0.82 });
    this.bossGauge.roundRect(BOSS_BAR_X, BOSS_BAR_Y, BOSS_BAR_W * ratio, BOSS_BAR_H, 13).fill({ color, alpha: boss.active ? 0.94 : 0.74 + pulse * 0.18 });
    this.bossGauge.roundRect(BOSS_BAR_X - 3, BOSS_BAR_Y - 3, BOSS_BAR_W + 6, BOSS_BAR_H + 6, 16).stroke({
      width: boss.active ? 3 : 3 + pulse * 2,
      color: rim,
      alpha: boss.active ? 0.55 : 0.5 + pulse * 0.3,
    });

    this.bossText.text = boss.active
      ? `${t("hud.boss")}  ·  ${t("hud.bossHits", { current: boss.hitsRemaining, max: boss.maxHp })}`
      : boss.warning
        ? `${t("hud.bossIncoming")}  ·  ${secondsLabel(Math.ceil(boss.nextBossInMs / 1000))}`
        : `${t("hud.threat")}  ·  ${Math.floor(boss.threatPercent)}%  ·  ${secondsLabel(Math.ceil(boss.nextBossInMs / 1000))}`;
    this.bossObjectiveText.text = boss.active && boss.objectiveKey ? t(boss.objectiveKey) : "";
  }

  private drawShieldGauge(shield: ShieldHudState | undefined): void {
    this.shieldGauge.clear();
    if (!shield || !shield.active || shield.remainingMs <= 0 || shield.absorbsRemaining <= 0) {
      this.shieldText.text = "";
      return;
    }

    const timeRatio = Math.max(0, Math.min(1, shield.remainingMs / Math.max(1, shield.durationMs)));
    const cellGap = 8;
    const cellW = (SHIELD_BAR_W - cellGap * (shield.maxAbsorbs - 1)) / Math.max(1, shield.maxAbsorbs);
    this.shieldGauge.roundRect(SHIELD_BAR_X, SHIELD_BAR_Y, SHIELD_BAR_W, SHIELD_BAR_H, 14).fill({ color: 0x08111f, alpha: 0.78 });
    this.shieldGauge.roundRect(SHIELD_BAR_X, SHIELD_BAR_Y, SHIELD_BAR_W * timeRatio, SHIELD_BAR_H, 14).fill({ color: 0x2563eb, alpha: 0.28 });
    for (let i = 0; i < shield.maxAbsorbs; i += 1) {
      const active = i < shield.absorbsRemaining;
      const x = SHIELD_BAR_X + i * (cellW + cellGap);
      this.shieldGauge.roundRect(x, SHIELD_BAR_Y, cellW, SHIELD_BAR_H, 10).fill({ color: active ? 0x93c5fd : 0x1e293b, alpha: active ? 0.9 : 0.52 });
      this.shieldGauge.roundRect(x, SHIELD_BAR_Y, cellW, SHIELD_BAR_H, 10).stroke({ width: 2, color: active ? 0xdbeafe : 0x475569, alpha: active ? 0.7 : 0.45 });
    }
    this.shieldGauge.roundRect(SHIELD_BAR_X - 3, SHIELD_BAR_Y - 3, SHIELD_BAR_W + 6, SHIELD_BAR_H + 6, 17).stroke({ width: 3, color: 0x93c5fd, alpha: 0.5 });
    this.shieldText.text = `${t("hud.shield")}  ${shield.absorbsRemaining}/${shield.maxAbsorbs}  ·  ${secondsLabel(Math.ceil(shield.remainingMs / 1000))}`;
  }

  private drawEarthEnergy(s: HudState): void {
    const maxEnergy = Math.max(1, s.maxEnergy);
    const ratio = Math.max(0, Math.min(1, s.energy / maxEnergy));
    const fill = ratio <= 0.25 ? 0xff5a66 : ratio <= 0.5 ? 0xffc14d : 0x3fd8ff;
    const glow = ratio <= 0.25 ? 0xff5a66 : 0x9fe9ff;

    this.earthEnergyGauge.clear();
    this.earthEnergyGauge.roundRect(
      EARTH_ENERGY_BAR_X,
      EARTH_ENERGY_BAR_Y,
      EARTH_ENERGY_BAR_W,
      EARTH_ENERGY_BAR_H,
      22,
    ).fill({ color: 0x050914, alpha: 0.82 });
    this.earthEnergyGauge.roundRect(
      EARTH_ENERGY_BAR_X,
      EARTH_ENERGY_BAR_Y,
      EARTH_ENERGY_BAR_W * ratio,
      EARTH_ENERGY_BAR_H,
      22,
    ).fill({ color: fill, alpha: 0.94 });
    this.earthEnergyGauge.roundRect(
      EARTH_ENERGY_BAR_X - 4,
      EARTH_ENERGY_BAR_Y - 4,
      EARTH_ENERGY_BAR_W + 8,
      EARTH_ENERGY_BAR_H + 8,
      26,
    ).stroke({ width: 4, color: glow, alpha: ratio <= 0.25 ? 0.75 : 0.45 });

    this.energyText.text = `${energyLabel()}  ${Math.ceil(s.energy)}/${s.maxEnergy}`;
  }

  private drawTutorial(tutorial: TutorialHudState | undefined): void {
    this.tutorialPanel.clear();
    if (!tutorial) {
      this.tutorialTitle.text = "";
      this.tutorialMessage.text = "";
      return;
    }

    const toneColor = tutorial.tone === "warning" ? 0xffc14d : tutorial.tone === "boss" ? 0xff6b6b : 0x3fd8ff;
    this.tutorialPanel
      .roundRect(TUTORIAL_PANEL_X, TUTORIAL_PANEL_Y, TUTORIAL_PANEL_W, TUTORIAL_PANEL_H, 24)
      .fill({ color: 0x071120, alpha: 0.72 });
    this.tutorialPanel
      .roundRect(TUTORIAL_PANEL_X, TUTORIAL_PANEL_Y, TUTORIAL_PANEL_W, TUTORIAL_PANEL_H, 24)
      .stroke({ width: 3, color: toneColor, alpha: 0.62 });
    this.tutorialPanel.circle(TUTORIAL_PANEL_X + 18, TUTORIAL_PANEL_Y + TUTORIAL_PANEL_H / 2, 7).fill({ color: toneColor, alpha: 0.95 });

    this.tutorialTitle.text = tutorial.title;
    this.tutorialTitle.style.fill = toneColor;
    this.tutorialMessage.text = tutorial.message;
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
