import { t } from "../i18n";
import type { MultiCutTier } from "../game/types";

// HUD 라벨 헬퍼 (design §6, i18n). 사용자 대면 문자열은 전부 t(key) 경유 — 하드코딩 금지.
// 실제 HUD DOM/Canvas 배선은 Subagent B (TODO(Phase1-B), /ui/README.md 참조).

export function lastSaveLabel(): string {
  return t("label.lastSave"); // ko "지구 직전 방어!" / en "LAST SAVE!"
}

/** Multi Cut 등급 → 표기 (Double/Triple/Mega/Orbital Master), i18n 경유. */
export function multiCutLabel(tier: MultiCutTier): string {
  if (tier === "none") return "";
  return t(`multiCut.${tier}`);
}

export function multiplierLabel(multiplier: number): string {
  return t("label.multiplier", { value: multiplier.toFixed(1) });
}

export function scoreLabel(): string {
  return t("hud.score");
}
export function timeLabel(): string {
  return t("hud.time");
}
export function energyLabel(): string {
  return t("hud.energy");
}
export function threatLabel(): string {
  return t("hud.threat");
}
export function comboLabel(): string {
  return t("hud.combo");
}
