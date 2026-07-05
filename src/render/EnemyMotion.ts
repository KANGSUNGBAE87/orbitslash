import type { EnemyState } from "../game/types";
import { enemyVisualStyle } from "./EnemyVisual";

export interface EnemySpriteMotion {
  rotationRad: number;
  visualScale: number;
  trailAlpha: number;
  trailLengthPx: number;
  glowAlpha: number;
}

const TAU = Math.PI * 2;

function hashPhase(enemyId: number): number {
  return (enemyId * 1.61803398875) % TAU;
}

export function enemyTravelAngleRad(enemy: EnemyState): number {
  const radialX = -Math.cos(enemy.angle) * enemy.approachSpeed;
  const radialY = -Math.sin(enemy.angle) * enemy.approachSpeed;
  const tangentX = -Math.sin(enemy.angle) * enemy.radius * enemy.angularSpeed;
  const tangentY = Math.cos(enemy.angle) * enemy.radius * enemy.angularSpeed;

  return Math.atan2(radialY + tangentY, radialX + tangentX);
}

export function enemySpriteMotion(enemy: EnemyState, elapsedMs: number): EnemySpriteMotion {
  const style = enemyVisualStyle(enemy.type);
  const seconds = elapsedMs / 1000;
  const phase = hashPhase(enemy.id);
  const speed = Math.hypot(enemy.approachSpeed, enemy.radius * enemy.angularSpeed);
  const speedRatio = Math.min(1, speed / 260);
  const pulse = Math.sin(seconds * (style.shape === "comet" ? 4.2 : 2.4) + phase);
  const visualScale = 1 + pulse * (enemy.boss ? 0.008 : 0.02);

  if (style.shape === "comet") {
    const travel = enemyTravelAngleRad(enemy);
    const wobble = Math.sin(seconds * 5.4 + phase) * 0.09;
    return {
      rotationRad: travel + wobble,
      visualScale,
      trailAlpha: 0.42 + speedRatio * 0.34,
      trailLengthPx: enemy.radiusPx * (1.15 + speedRatio * 1.05),
      glowAlpha: 0.16 + speedRatio * 0.2,
    };
  }

  const spinDirection = enemy.angularSpeed < 0 ? -1 : 1;
  const baseSpin = style.shape === "asteroid" ? 0.55 : 0.36;
  const spin = spinDirection * seconds * baseSpin + phase;

  return {
    rotationRad: spin,
    visualScale,
    trailAlpha: style.shape === "asteroid" ? 0.12 : 0.18,
    trailLengthPx: enemy.radiusPx * (0.42 + speedRatio * 0.34),
    glowAlpha: style.shape === "asteroid" ? 0.12 : 0.1,
  };
}
