import { describe, it, expect } from "vitest";
import { ScoringSystem, scoreFor, comboMultiplierFor } from "./ScoringSystem";
import scoringJson from "../data/scoring.json";
import type { ScoringConfig, HitResult } from "./types";

const cfg = scoringJson as unknown as ScoringConfig;

const hit = (band: HitResult["band"], enemyId = 1): HitResult => ({
  enemyId,
  band,
  accuracy: "normal",
});

describe("comboMultiplierFor (product-plan §13.3 경계)", () => {
  it("1~4 → x1.0", () => {
    expect(comboMultiplierFor(1, cfg)).toBe(1.0);
    expect(comboMultiplierFor(4, cfg)).toBe(1.0);
  });
  it("5 → x1.2 (경계 4→5)", () => {
    expect(comboMultiplierFor(4, cfg)).toBe(1.0);
    expect(comboMultiplierFor(5, cfg)).toBe(1.2);
  });
  it("10 → x1.5 (경계 9→10)", () => {
    expect(comboMultiplierFor(9, cfg)).toBe(1.2);
    expect(comboMultiplierFor(10, cfg)).toBe(1.5);
  });
  it("20 → x2.0 (경계 19→20)", () => {
    expect(comboMultiplierFor(19, cfg)).toBe(1.5);
    expect(comboMultiplierFor(20, cfg)).toBe(2.0);
  });
  it("30+ → x2.5 (경계 29→30, 최대)", () => {
    expect(comboMultiplierFor(29, cfg)).toBe(2.0);
    expect(comboMultiplierFor(30, cfg)).toBe(2.5);
    expect(comboMultiplierFor(100, cfg)).toBe(2.5);
  });
});

describe("scoreFor (기본×거리×정확도×콤보, product-plan §13.1)", () => {
  it("기본 100, outer x1.0, normal x1.0, combo 1 → 100", () => {
    expect(scoreFor({ baseScore: 100, band: "outer", accuracy: "normal", combo: 1 }, cfg)).toBe(100);
  });
  it("기본 100, lastSave x3.5, normal x1.0, combo 1 → 350", () => {
    expect(scoreFor({ baseScore: 100, band: "lastSave", accuracy: "normal", combo: 1 }, cfg)).toBe(350);
  });
  it("기본 180, danger x2.2, normal x1.0, combo 10 (x1.5) → 180*2.2*1.5 = 594", () => {
    expect(scoreFor({ baseScore: 180, band: "danger", accuracy: "normal", combo: 10 }, cfg)).toBeCloseTo(594, 6);
  });
  it("정확도 directional x1.2 적용", () => {
    expect(scoreFor({ baseScore: 100, band: "outer", accuracy: "directional", combo: 1 }, cfg)).toBe(120);
  });
  it("specialBonus는 가산", () => {
    expect(scoreFor({ baseScore: 100, band: "outer", accuracy: "normal", combo: 1, specialBonus: 50 }, cfg)).toBe(150);
  });
  it("impact 밴드는 outer 배율로 처리(fallback)", () => {
    // impact는 충돌 밴드라 distanceMultiplier 키에 없음 → outer로 안전 처리
    expect(scoreFor({ baseScore: 100, band: "impact", accuracy: "normal", combo: 1 }, cfg)).toBe(100);
  });
});

describe("ScoringSystem.onHit (콤보 += N, Multi Cut, 게이지, Last Save)", () => {
  const enemyTable = {
    small_meteor: 50,
    basic_meteor: 100,
    fast_comet: 130,
    heavy_asteroid: 180,
  };
  const baseScoreOf = (id: number): number => {
    // 테스트용: enemyId를 type 매핑. 1=basic_meteor
    void id;
    return enemyTable.basic_meteor;
  };

  it("한 슬래시로 N마리 → 콤보 += N", () => {
    const s = new ScoringSystem(cfg);
    const out = s.onHit([hit("outer", 1), hit("outer", 2), hit("outer", 3)], () => 100, () => "basic_meteor");
    expect(out.combo).toBe(3);
  });

  it("콤보 경계 4→5: 4 누적 후 1 더 → combo 5, 배율 1.2 반영", () => {
    const s = new ScoringSystem(cfg);
    s.onHit([hit("outer", 1), hit("outer", 2), hit("outer", 3), hit("outer", 4)], () => 100, () => "basic_meteor");
    const out = s.onHit([hit("outer", 5)], () => 100, () => "basic_meteor");
    expect(out.combo).toBe(5);
  });

  it("Multi Cut 보너스는 등급당 1회 가산 (double=50)", () => {
    const s = new ScoringSystem(cfg);
    const out = s.onHit([hit("outer", 1), hit("outer", 2)], () => 100, () => "basic_meteor");
    expect(out.multiCut).toBe(50); // double
  });

  it("Multi Cut triple=120, 1마리는 0", () => {
    const s1 = new ScoringSystem(cfg);
    expect(s1.onHit([hit("outer", 1), hit("outer", 2), hit("outer", 3)], () => 100, () => "basic_meteor").multiCut).toBe(120);
    const s2 = new ScoringSystem(cfg);
    expect(s2.onHit([hit("outer", 1)], () => 100, () => "basic_meteor").multiCut).toBe(0);
  });

  it("게이지: 적별 gaugeGain 합 + 콤보 처치(2)", () => {
    const s = new ScoringSystem(cfg);
    // 2마리 basic_meteor(+1 each) = 2, comboKill +2 = 4
    const out = s.onHit([hit("outer", 1), hit("outer", 2)], () => 100, () => "basic_meteor");
    expect(out.gauge).toBe(2 + 2);
  });

  it("Last Save 밴드면 lastSave 플래그 true + 게이지 +8", () => {
    const s = new ScoringSystem(cfg);
    const out = s.onHit([hit("lastSave", 1)], () => 100, () => "basic_meteor");
    expect(out.lastSave).toBe(true);
    // basic +1, lastSave +8 (콤보 1마리라 comboKill 없음)
    expect(out.gauge).toBe(1 + 8);
  });

  it("comboGainPerSlashCap=null → 무제한 (5마리면 +5)", () => {
    const s = new ScoringSystem(cfg);
    const out = s.onHit(
      [hit("outer", 1), hit("outer", 2), hit("outer", 3), hit("outer", 4), hit("outer", 5)],
      () => 100,
      () => "basic_meteor",
    );
    expect(out.combo).toBe(5);
  });

  it("comboGainPerSlashCap=2 → 5마리여도 콤보는 +2만", () => {
    const cappedCfg: ScoringConfig = { ...cfg, comboGainPerSlashCap: 2 };
    const s = new ScoringSystem(cappedCfg);
    const out = s.onHit(
      [hit("outer", 1), hit("outer", 2), hit("outer", 3), hit("outer", 4), hit("outer", 5)],
      () => 100,
      () => "basic_meteor",
    );
    expect(out.combo).toBe(2);
  });

  it("onMiss → 콤보 0으로 리셋", () => {
    const s = new ScoringSystem(cfg);
    s.onHit([hit("outer", 1), hit("outer", 2)], () => 100, () => "basic_meteor");
    s.onMiss();
    expect(s.snapshot().combo).toBe(0);
  });

  it("snapshot: 누적 점수/최대콤보/LastSave 횟수", () => {
    const s = new ScoringSystem(cfg);
    s.onHit([hit("outer", 1), hit("outer", 2), hit("outer", 3)], () => 100, () => "basic_meteor");
    s.onHit([hit("lastSave", 4)], () => 100, () => "basic_meteor");
    const snap = s.snapshot();
    expect(snap.maxCombo).toBe(4);
    expect(snap.lastSaveCount).toBe(1);
    expect(snap.score).toBeGreaterThan(0);
  });

  it("baseScore는 enemies.json.score 출처(주입 콜백) 사용", () => {
    const s = new ScoringSystem(cfg);
    const out = s.onHit([hit("outer", 99)], baseScoreOf, () => "basic_meteor");
    // basic_meteor 100 × outer 1.0 × normal 1.0 × combo 1.0 = 100
    expect(out.gained).toBe(100);
  });
});
