---
status: completed
updated: 2026-07-18
canonical_parent: ai/plans/implementation-plan.md
---

# Orbit Slash 우주 BGM·설정·로그인·공유 구현 계획

## 경계

- 기존 dirty worktree를 보존한다. 커밋·스테이징·원격 배포·DB apply는 하지 않는다.
- TDD: 각 행동 테스트를 먼저 추가해 예상 실패를 확인한 뒤 최소 구현한다.
- SDK import는 platform/feedback 경계 안에만 둔다.

## Task 1 — 120초 BGM과 자동재생 복구

**파일**

- 수정: `src/feedback/AudioPort.ts`
- 수정: `src/feedback/WebAudioEngine.test.ts`
- 수정: `src/feedback/WebAudioEngine.ts`
- 생성: `scripts/generate-orbit-bgm.py`
- 생성: `public/assets/audio/orbit-siege-120s.m4a`

**RED**

- HTML audio factory를 주입해 `loop`, `src`, `volume`, `play/pause` 상태를 검사한다.
- BGM enabled 시 자동재생을 시도하고, 거부되면 최초 제스처에서 재시도하는 테스트를 실패시킨다.
- pause와 BGM OFF가 audio pause를 호출하는 테스트를 실패시킨다.

**GREEN**

- 효과음 WebAudio와 BGM HTMLAudio를 분리한다.
- 128 BPM/256박의 원본 PCM을 생성한 뒤 `/usr/bin/afconvert`로 AAC/M4A 변환한다.
- 자동재생 실패를 삼키고 제스처 재시도를 허용한다.

**검증**

- `npm test -- src/feedback/WebAudioEngine.test.ts`
- 오디오 duration/크기 검사

## Task 2 — 우측 상단 설정과 카드형 패널

**파일**

- 수정: `src/render/AppShell.test.ts`
- 수정: `src/render/AppShell.ts`
- 수정: `src/i18n/ko.json`
- 수정: `src/i18n/en.json`

**RED**

- Home에 `home-settings-trigger`가 우측 safe area 안 존재하고 기존 하단 설정 버튼이 없음을 검사한다.
- 계정/감각/언어/공유 카드 텍스트와 login/share callback을 검사한다.
- anonymous/loading/linked/error 표시를 검사한다.

**GREEN**

- Pixi Graphics 기어 버튼과 카드형 설정 패널을 만든다.
- `SettingsAccountState`, `SettingsShareState`를 표시 모델로 받고 callback만 외부로 노출한다.
- 기존 preference toggle과 locale 전환은 그대로 유지한다.

**검증**

- `npm test -- src/render/AppShell.test.ts src/i18n/i18nParity.test.ts`

## Task 3 — 로그인 상태·공유 fallback 서비스

**파일**

- 수정: `src/platform/identity/IdentityService.test.ts`
- 수정: `src/platform/identity/IdentityService.ts`
- 생성: `src/platform/share/ShareService.test.ts`
- 생성: `src/platform/share/ShareService.ts`

**RED**

- 로그인 loading/linked/error 상태 전이를 실패시킨다.
- Apps in Toss → native share → clipboard 순서와 모든 실패 결과를 실패시킨다.
- 기본 경로에서는 초대 코드를 적용하지 않고 일반 앱 공유만 수행하는 계약을 검사한다.

**GREEN**

- IdentityService가 현재 상태와 실패 사유를 보존한다.
- ShareService가 SDK 함수를 주입받아 테스트 가능하게 하고 브라우저 fallback을 제공한다.
- 공식 `getTossShareLink('intoss://orbitslash')` 계약을 platform 경계에만 둔다.

**검증**

- `npm test -- src/platform/identity/IdentityService.test.ts src/platform/share/ShareService.test.ts`

## Task 4 — GameApp 통합과 전체 검증

**파일**

- 수정: `src/game/GameApp.test.ts`
- 수정: `src/game/GameApp.ts`
- 수정: `scripts/check-asset-budget.mjs`
- 수정: `ai/plans/implementation-plan.md`
- 생성: `ai/session-logs/2026-07-18-space-bgm-settings-auth-share-codex.md`

**RED**

- init이 첫 진입 BGM을 시도하고 settings login/share callback을 연결하는 통합 테스트를 실패시킨다.
- asset budget이 M4A/AAC와 eager audio budget을 집계하는 테스트/스크립트 검증을 추가한다.

**GREEN**

- `IdentityService`가 account 상태의 단일 원천을 소유하고 GameApp은 표시 상태만 파생한다.
- init에서 BGM 자동재생을 시도하고 document gesture fallback을 등록한다.
- 공유/로그인 결과는 사용자에게 정확한 상태로 표시한다.

**검증**

- 대상 테스트 → 전체 `npm test` → `npm run typecheck` → `npm run build` → `npm run check:assets`
- 로컬 브라우저 360/390/430px Home/Settings 시각 QA
- project Graphify refresh
