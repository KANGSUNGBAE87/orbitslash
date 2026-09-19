# 로컬 기준선 보존과 정리 범위

Updated: 2026-09-19. Actor: codex.

- 기준 HEAD: `e168118b12ff07f687e0fcb3e70988e4f83b0c52`.
- 정리 브랜치: `codex/local-prep-cleanup`. 기존 checkout의 변경을 그대로 유지한 로컬 브랜치.
- 시작 시 실제 미커밋 상태: 추적 변경 80개 + 미추적 234개. 이전 분석의 78/233 이후
  문서 정리 등이 더해진 수치이며, 이번 백업 시점의 상태를 기준으로 한다.
- 백업: `/Users/kangsungbae/.codex/backups/orbitslash/20260919-183806`.
  `manifest.json`의 파일별 SHA-256과 `git-status.txt`, `files/` 사본으로 이번 수정과 구분한다.
- 기준선 분류 535개(설정 제외 실제 사본 534개): 게임 154, 플랫폼 152, 비주얼/오디오 98, 도구/설정 60, 문서 71.
  변경 파일만이 아니라 추적/미추적 소스 전체의 사본이다.
- `.env` 계열 실값, 개인키/서명키, `.mcp.json`은 백업 대상에서 제외했다. 원본은 유지했다.
  백업 폴더는 0700. 의존성/빌드/그래프/로컬 인덱스는 기존 ignore 정책을 따른다.
- 백업 검증: 534개 사본 해시 일치, 기준선 파일 삭제 0개. 게임 아트/오디오 삭제/이동 없음.
- 자동 생성 ranked Edge 파일은 실행 계약의 일부라 유지하고 정식 generator로 갱신했다.
  dist/node_modules/그래프는 게시할 소스와 구분한다. 미커밋 파일을 일괄 stage/commit하지 않았다.

## 이번 정리의 변경 묶음

| 묶음 | 내용 | 완료 증거 |
|---|---|---|
| 공유 | Toss SDK/딥링크 분리, 기본 조합 주입, AbortError 취소 시 idle | 공유 21개 및 GameApp 통합 테스트 |
| 검사 | import AST 판정, 일시적 초대 경계 한정, CLI/테스트 정책 통합 | 실제 저장소 및 CLI 회귀 검사 |
| 환경/CI | Node 24, Deno 2.9.7, 프로젝트 launcher, lock/frozen check, PR 검증 | 로컬 preflight 통과, YAML parse; GitHub 실행은 미수행 |
| Edge 타입 | Supabase client generic 추론, weekKey, readonly/5 skill 계약 | 7 함수 Deno check와 replay 회귀 |
| 문서 | 최신 상태/후속 작업/재현 명령/세션 근거 | canonical 계획·로드맵·리뷰 갱신 |

원격 서버/DB 변경, 공개 랭킹 개통, 결제/광고 연결, 출시/배포/푸시는 이번 범위에 포함하지 않았다.
