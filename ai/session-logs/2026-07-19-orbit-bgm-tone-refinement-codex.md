# 2026-07-19 Orbit Siege tone refinement

- Actor: codex
- User request: 빠른 삑삑 아르페지오의 하이톤을 덜 거슬리는 음색으로 바꾸고,
  작은 우주 느낌 소리는 유지하며 `우웅~` 지속음은 제거.
- Stage: design -> implementation -> verification

## Decisions

- 1박 4-step 리듬은 유지한다.
- arp 음역은 기존 MIDI 52~74에서 MIDI 45~59(B3 이하)로 낮춘다.
- 사인파+강한 2배음 대신 triangle-like 홀수 배음을 사용한다.
- arp gain은 `0.105`에서 `0.072`로 낮추고 attack/release를 둥글게 만든다.
- continuous E2/E3 drone과 느린 phase-modulated warning beacon은 제거한다.
- 사용자가 좋다고 한 작은 metallic shimmer와 전투 pulse는 유지한다.

## Files changed

- `scripts/generate-orbit-bgm.py`
- `scripts/test_generate_orbit_bgm.py`
- `public/assets/audio/orbit-siege-120s.m4a`
- `docs/superpowers/specs/2026-07-19-orbit-bgm-tone-refinement-design.md`
- `docs/superpowers/plans/2026-07-19-orbit-bgm-tone-refinement.md`
- `ai/plans/implementation-plan.md`
- 본 세션 로그

## TDD evidence

- RED: tone constants 없음으로 1 error, beat-boundary sustained sample `4,482 > 4`로 1 fail.
- GREEN: 4-step/B3/gain/no-drone/no-warning, beat boundary silence, deterministic signed PCM
  계약 3/3 통과.

## Verification

- Generated M4A: 1,044,279 bytes, stereo AAC 32kHz, `120.000000s`.
- SHA-256: `5fc020edd83f936aefe315eee156a3e764fc11750cc905ac2a8443782838294b`.
- Full Vitest: 135 files, 956 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run check:assets`: passed. eager audio 1,044,279 / 2,097,152B.
- `git diff --check`: passed.
- cmm fast index refreshed: 5,190 nodes / 12,311 edges.
- Graphify structural refresh: 7,569 nodes / 117,191 edges.

## Remaining risk / next

- 수학적 음역·파형·지속음 계약은 검증했지만 듣기 편안함은 주관적이다. 실제 휴대폰
  스피커로 듣고 arp gain이나 음역을 한 번 더 미세 조정할 수 있다.
- 앱의 오디오 파일 경로, 자동재생, loop 계약은 변경하지 않았다.
- 배포, stage, commit 없음.
- Knowledge-store promotion: 없음. 프로젝트별 청감 튜닝 증거로 로컬 로그에 유지.
