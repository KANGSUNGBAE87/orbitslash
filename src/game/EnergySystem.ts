// Earth Energy 시스템 (product-plan §11). 순수 로직 — 게임플레이 wiring은 Subagent B.
// TODO(Phase1-B): 지구 충돌 감지 → applyDamage 호출, 지구 상태 연출(§11.3) 트리거,
// 게임오버 → ResultScreen 전환을 GameScene collision 단계에 wiring.

export type EarthVisualState = "healthy" | "cracked" | "warning" | "critical";

export class EnergySystem {
  private energy: number;
  private readonly maxEnergy: number;
  private gameOverFired = false;

  constructor(startEnergy: number) {
    this.energy = startEnergy;
    this.maxEnergy = startEnergy;
  }

  /** 피해 적용. 0 이하면 게임오버 신호(정확히 한 번 true). */
  applyDamage(amount: number): { energy: number; gameOver: boolean } {
    this.energy = Math.max(0, this.energy - amount);
    let gameOver = false;
    if (this.energy <= 0 && !this.gameOverFired) {
      this.gameOverFired = true;
      gameOver = true;
    }
    return { energy: this.energy, gameOver };
  }

  /** 회복 (product-plan §11.4). maxEnergy 상한. */
  heal(amount: number): number {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
    return this.energy;
  }

  getEnergy(): number {
    return this.energy;
  }

  getMax(): number {
    return this.maxEnergy;
  }

  /** 에너지 비율에 따른 지구 상태 연출 (product-plan §11.3). */
  visualState(): EarthVisualState {
    const ratio = this.energy / this.maxEnergy;
    if (ratio > 0.69) return "healthy"; // 100~70
    if (ratio > 0.39) return "cracked"; // 69~40
    if (ratio > 0.09) return "warning"; // 39~10
    return "critical"; // 9 이하
  }
}
