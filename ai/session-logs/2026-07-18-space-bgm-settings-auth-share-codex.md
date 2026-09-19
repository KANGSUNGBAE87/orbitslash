# 2026-07-18 Space BGM, settings, auth, share implementation

- Actor: codex
- User request: 음악을 먼저 만들고, 뽁뽁이와 비슷한 우측 상단 설정, 로그인, 공유 및
  추후 초대 코드 공유 준비까지 서브에이전트로 구현.
- Stage: implementation -> review -> QA

## Decisions

- 원본 합성곡 `Orbit Siege`는 128 BPM, 256박, 정확히 120초로 생성한다.
- macOS 기본 `afconvert`의 Ogg writer가 동작하지 않아 외부 설치 없이 AAC/M4A를 사용한다.
- 첫 진입에서 재생을 시도하고 autoplay 차단은 최초 포인터/키 입력에서 복구한다.
- Home 하단 설정을 제거하고 우측 상단 Pixi Graphics 기어와 카드형 설정 패널을 사용한다.
- `IdentityService`를 계정 상태 단일 원천으로 사용한다. 실제 서버 세션 교환이 없는
  환경에서는 가짜 로그인 대신 계정 연결 불가를 표시한다.
- 공유 순서는 Apps in Toss, native share, clipboard다. 기본 공유에는 초대 코드를 넣지
  않고 향후 명시적 `InviteDeepLinkBuilder` 주입 지점만 둔다.
- 배포, 원격 DB/Edge apply, 실제 초대 코드 발급은 이번 범위에 포함하지 않는다.

## Files changed

- Audio: `src/feedback/AudioPort.ts`, `src/feedback/WebAudioEngine.ts`, 대응 테스트,
  `scripts/generate-orbit-bgm.py`, `public/assets/audio/orbit-siege-120s.m4a`
- Settings/i18n: `src/render/AppShell.ts`, 대응 테스트, `src/i18n/ko.json`, `src/i18n/en.json`
- Identity/share: `src/platform/identity/IdentityService.ts`,
  `src/platform/share/ShareService.ts`, 대응 테스트
- Integration/budget: `src/game/GameApp.ts`, 대응 테스트, `scripts/check-asset-budget.mjs`
- Plans: 본 세션 로그, canonical design/implementation plan, 승인 spec/실행 plan

## Verification

- TDD: 각 하위 작업에서 RED 확인 후 GREEN. 최종 통합 회귀 176/176 통과.
- Full Vitest: 135 files, 956 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed. main 388.59 kB, Pixi chunk 549.69 kB.
- `npm run check:assets`: passed. boot 568,544B, total 10,094,340B,
  eager audio 1,016,063 / 2,097,152B, 45 files.
- Audio metadata: stereo AAC 32kHz, duration 120.000000 seconds, file 1,016,063B.
- Browser QA: Home/Settings를 360x640, 390x844, 430x932에서 확인. clipping/overlap 없음,
  우측 상단 gear와 최소 터치 영역 유지. 로그인 불가 상태 정확, console error/warn 0건.
  브라우저 asset inventory에서 `orbit-siege-120s.m4a` audio request 확인.
- `npm run check:google-play-shell`: passed.
- `npm run check:apps-in-toss-shell`: local Node 22.22.3이라 Node 24 release gate pending.
- `git diff --check`: passed.
- Project Graphify structural refresh: passed, `graph.json` updated (7,553 nodes / 103,013 edges).
- Subagent review: final spec compliant, final quality approved. init/dispose race와 Pixi
  pre-init canvas 계약까지 TDD로 보완.

## Remaining risks / next

- 실제 휴대폰 스피커에서 음량, 반복 경계, 장시간 백그라운드 복귀를 들어봐야 한다.
- 실제 Toss/Google 계정 연결은 서버 session exchange와 플랫폼 Console 설정 후 검증해야 한다.
- 실제 Apps in Toss native share와 private/live scheme은 Node 24 + Toss private test에서 검증한다.
- 초대 코드는 발급 원천, 수신 route, 만료/오용 정책이 준비될 때까지 비활성이다.
- 현재 워크트리에는 이번 작업 전부터 다른 미커밋 변경이 많다. stage/commit하지 않았다.
- Knowledge-store promotion: 없음. 프로젝트별 구현 증거로 로컬 로그에 유지.
