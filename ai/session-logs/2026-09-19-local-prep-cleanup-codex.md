# 다음 구현을 위한 0~1단계 정리

- Date: 2026-09-19
- Actor: codex
- Stage: implementation / verification / local preparation
- User request: 인용한 정리 계획에서 필요한 정리를 모두 실행. 아직 출시하지 않음.

## Decisions

- 현재 보존 + 공유/검사 복구 + Node/Deno/CI + 문서 정합성을 이번 단위로 완료한다.
- 원격 적용/배포/푸시/스토어/새 게임 기능은 후속. JDK/SDK는 Android 작업 전 준비한다.
- 실행 전 535개 파일을 분류하고 민감 설정 1개를 제외한 534개 파일 사본과 SHA-256 manifest를 외부 0700 백업에 보존하고
  `codex/local-prep-cleanup` 브랜치를 만들었다. 세부 분류는 `ai/reviews/local-baseline.md`.
- Node 24.21.0/Deno 2.9.7을 Homebrew로 설치했다. Homebrew 공용 의존성 업그레이드도
  수반됐다. 전역 Node 선택/Hermes 설정은 변경하지 않고 프로젝트 launcher를 사용한다.
- 공유 정책에는 SDK/스킴을 남기지 않고 플랫폼 port를 주입한다. SDK의 AbortError는
  취소로 구분해 clipboard 대체 없이 UI idle로 돌아간다. 실제 SDK 취소 형태 QA는 별도.
- `inviteCode`는 두 승인된 공유 파일의 일시적 전달만 허용. 다른 원시 식별자/비밀값 차단과
  로그/저장/전송 sink 검사를 유지. 임의 alias까지 추적하는 보안 증명은 아니다.
- Deno가 없어서 드러나지 않았던 기존 타입 오류를 수정. SupabaseClient 기본 타입을 사용하고
  ranked rules의 readonly 배열/고정 skill 키와 weekKey 계약을 정정. `as never` 규칙 우회 제거.
  DB 생성 타입/스키마 검증은 다음 온라인 연결 때 수행한다.
- 타입 파일도 hash 입력이므로 client/Edge generated rules hash가 함께 변경됨. 원격 미배포.

## Files Changed

- `src/platform/share/ShareService.ts`, 테스트, `createDefaultShareService.ts`.
- `src/platform/apps-in-toss/AppsInTossShare.ts`, `src/game/GameApp.ts`, 통합 테스트.
- `src/platform/ReleaseBoundary.ts`, unit/actual-repository 테스트, CLI script.
- `.github/workflows/deploy-pages.yml`, `.deno-version`, `scripts/with-toolchain.sh`,
  `scripts/check-release-prep.mjs`, `supabase/functions/deno.json`, `deno.lock`.
- `shared/ranked-core/types.ts`, generated hash/index/Edge types, ranked/progress/entitlement/
  friend/gameplay Edge의 client 타입. runtime 비즈니스 규칙 변경 없음.
- canonical implementation-plan/master-roadmap/review, release-checklist,
  `docs/local-development.md`, `ai/reviews/local-baseline.md`, 이 로그.

## Verification

- TDD: 실제 저장소 검사에서 기존 4건 실패 재현. 취소 UI는 error→idle 기대 실패 확인.
- 공유/검사/GameApp 106개 targeted 통과. ranked Edge 실제 실행 회귀 19개 통과.
- 최종 전체 `npm test`: **136 files / 969 tests passed**.
- `npm run typecheck`, `npm run build`: 통과.
- `npm run preflight:release`: generic/양 target 경계, assets, 양 shell, ranked generated sync,
  7개 Edge bundle 및 7개 Deno frozen-lock check 모두 통과. 원격 요청 없이 코드 검사만 수행.
- CI YAML parse 통과. PR은 검증만, main push/수동 실행만 업로드/배포 조건. 실제 Actions 실행 없음.
- `git diff --check`: 통과. 기준선 사본 해시 일치, 기준선 파일 삭제 0.
- Node 24로 Vite 재시작, `http://127.0.0.1:5173/` 홈 스크린샷 확인. 기존 진행 저장 유지.
  runtime: local web/web_stub. Toss sandbox/private/live 또는 실기기 QA 증거가 아님.
- cmm 초기 심볼 조회 성공, 이후 Transport closed로 정확한 파일 읽기 fallback 사용.

## Remaining / Handoff

- 홈/6모드/스킬/보스/저장/복귀/오디오/ko·en 실기기 QA는 별도다.
- 실제 인증/계정 매핑/클라우드/제품 분석/공개 랭킹 미연결. boss_shard 서버 재현 문제 유지.
- 실제 광고/결제/코스메틱 UI/친구/시즌과 AI server-ready stub은 후속 구현.
- 새 온라인 마이그레이션/Edge는 원격 미배포. 현재 사전검사 통과를 출시 승인으로 보지 않는다.
- 앱 서버는 사용자가 확인할 수 있도록 실행 유지. 커밋/푸시/배포 없음.
- 지식저장소 승격 없음: 프로젝트 고유의 정리/검증이며 위 프로젝트 문서를 공유 근거로 사용.
- Understand-Anything은 이번 제한적 변경에 별도 아키텍처 맵이 불필요해 미실행.
  Project Graphify 결과는 아래 최종 항목에 기록한다.

## Final checks

- 기준선 대비 이번 변경만 따로 비교·자체 검토했다. 전체 작업 트리는 기존 미커밋 작업을 포함한다.
- 문서 변경 후 DocumentationSsot/ReleaseTargetDocs 2 files / 6 tests 재확인 통과.
- Project Graphify 구조 갱신: 3,821 nodes / 8,088 edges. SQL parser 부재로 SQL 13개,
  Gradle syntax 지원 한계로 3개가 완전 추출되지 않음. Markdown semantic 재추출은 수행하지
  않았으므로 최신 상태는 canonical 문서 직접 조회가 기준이다.
- 백업 분류는 535개이며 `.mcp.json` 제외 후 실제 SHA-256 검증 사본은 534개다.
  원본 삭제 없음. 백업은 민감 설정을 제외한 소스 기준선이며 비밀값 복구용이 아니다.
