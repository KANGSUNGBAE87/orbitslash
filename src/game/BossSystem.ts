// Boss 시스템 (implementation-plan §1 [LATER]). Phase 4~. 인터페이스만.
// TODO(Phase4): Threat Gauge, 보스 5종 패턴 (product-plan §19).

export interface IBossSystem {
  tick(dtMs: number): void;
  threatPercent(): number;
}

class StubBossSystem implements IBossSystem {
  tick(_dtMs: number): void {
    // noop — Phase 4
  }
  threatPercent(): number {
    return 0;
  }
}

export const BossSystem: IBossSystem = new StubBossSystem();
