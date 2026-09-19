# 다음 로컬 구현 준비 및 앱 실행

- Date: 2026-09-19
- Actor: codex
- Stage: planning / knowledge / local startup
- User request: 출시 준비 대신 다음 구현에 필요한 정리와 계획을 반영하고 앱 열기.

## Decisions

- 현재 목표를 로컬 구현 준비로 재설정. 앱 확인/피드백 → 공유·검사 경계 정리 →
  선택한 게임/UI 기능 보완 → 필요한 로컬 계약 정리 순서로 진행한다.
- 출시 도구 설치, 원격 DB/Edge 적용, 실제 플랫폼 서비스/스토어 작업은 후속 목록으로 분리.
- 이미 구현된 온보딩·결과·BGM·설정·재방문 기능을 7월 계획의 미체크만 보고 재구현하지 않는다.
- 게임 소스·설정 및 기존 미커밋 작업은 변경하지 않았다. 이번 시작 시 `.mcp.json`의 기존
  수정도 확인했으며 손대지 않았다. 신규 기능·공유 검사 결함은 아직 수정하지 않았다.

## Files Changed

- `ai/plans/implementation-plan.md`: v1.7, 현재 단계/파일 범위/완료 기준/보류 목록.
- `ai/plans/master-roadmap.md`: v0.4, 현재 상태/큐 재정리, 과거 체크리스트 구분.
- `ai/reviews/review.md`: v0.9, 같은 대화에서 확인한 실제 검증 결과/결함/다음 작업.
- 이 actor 세션 로그.

## Verification / Local App

- canonical 문서 3개의 frontmatter/version/date와 `git diff --check` 확인 통과.
- 같은 대화의 앞선 분석에서 135 files / 956 tests, typecheck, 웹 빌드 통과.
  이번 문서 변경 후 전체 게임 테스트를 재실행한 것으로 기록하지 않는다.
- `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`: Vite 시작 성공.
- Codex 인앱 브라우저에서 `http://127.0.0.1:5173/`를 열고 홈 화면을 스크린샷으로 확인.
  Orbit Slash 제목, 훈련 계속하기, 설정, 6모드 카드, 컬렉션 표시 확인. 사용자용 탭 유지.
- 환경은 local web / web_stub. Toss sandbox/private/live 또는 실기기 QA 증거가 아니다.
- 기존 브라우저 진행 데이터를 초기화하지 않았으며 게임을 대신 진행하지 않았다.

## Risks / Next

- 공유 경계 검사 실패, 랭킹 boss_shard 검증 불일치, 실제 계정/광고/결제 미연결은 그대로 남음.
- 다음 단계는 사용자가 로컬 앱에서 확인한 구체적 피드백을 반영할 작업 묶음 선택.
- 서버는 앱 확인을 위해 실행 상태로 유지한다. 배포/커밋/설치 수행 없음.
- 지식저장소 승격 없음: 프로젝트 고유의 실행 순서와 상태 정리.
- Understand-Anything 갱신 생략: 코드/아키텍처 변경 없음. 프로젝트 Graphify 구조 갱신은 아래 결과 참조.

## Final verification

- 문서 관련 테스트: 2 files / 6 tests 통과 (`DocumentationSsot`, `ReleaseTargetDocs`).
- 최종 `git diff --check` 통과, 로컬 URL HTTP 200 확인.
- Graphify 구조 갱신 완료: 3,796 nodes / 8,036 edges. SQL parser 미설치로 SQL 13개 제외,
  Gradle 3개 부분 추출 경고. 설치나 별도 수리는 수행하지 않음.
- 이 명령은 code-only 구조 갱신이다. 변경 Markdown의 semantic 재추출은 수행하지 않았으며,
  다음 세션은 canonical 문서 파일을 직접 기준으로 읽어야 한다.
