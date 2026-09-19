# 로컬 개발과 다음 구현 준비

Updated: 2026-09-19. 현재 단계는 로컬 기능 보완이며 출시/원격 활성화가 아니다.

## 환경과 재현 명령

- Node 24.x: `.nvmrc`와 `package.json.engines` 기준. 이번 검증은 24.21.0.
- Deno: `.deno-version`의 2.9.7. Edge 의존성은 `supabase/functions/deno.lock`으로 고정.
- 설치된 Homebrew Node 24는 `sh scripts/with-toolchain.sh`가 프로젝트 명령에만 선택한다.
  기존 전역 Node/Hermes 실행 환경은 변경하지 않는다. 다른 환경은 먼저 `nvm use`.
- JDK/Android SDK 및 실기기 검증은 Android 작업을 시작할 때 준비한다.

```sh
sh scripts/with-toolchain.sh npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
sh scripts/with-toolchain.sh npm test
sh scripts/with-toolchain.sh npm run typecheck
sh scripts/with-toolchain.sh npm run build
sh scripts/with-toolchain.sh npm run preflight:release
```

처음 설치한 checkout에서는 Node 24 선택 후 `npm ci`로 lockfile을 따른다.
`preflight:release`는 실제 소스의 공통/양 플랫폼 경계, asset/shell, ranked 생성물 동기화,
Edge 7개 번들 및 Deno 타입을 검사한다. 빌드 후 실행해야 최신 `dist`도 검사된다.
이 명령의 통과는 원격 DB/인증/광고/결제/스토어 준비 완료를 뜻하지 않는다.

Deno 의존성을 의도적으로 갱신할 때만 아래 명령을 사용하고 lock diff를 검토한다.
일상 검증/CI는 `--frozen`으로 lock 변경을 금지한다.

```sh
deno check --config supabase/functions/deno.json --frozen=false supabase/functions/*/index.ts
```

## CI

`.github/workflows/deploy-pages.yml`은 PR 및 main에서 테스트 → build(typecheck 포함) →
전체 local preflight를 실행한다. Node/Deno 버전은 위 파일에서 읽는다.
Pages artifact 업로드와 배포는 main의 push/수동 실행에만 허용한다. 이번 작업은 push하지
않았으므로 실제 GitHub Actions 실행 성공은 아직 확인하지 않았다.

## 구현 경계와 다음 순서

- 공용 공유 정책: `ShareService`. Toss SDK/딥링크: `AppsInTossShare`.
  기본 조합: `createDefaultShareService`. 초대 기능은 builder 미주입으로 비활성 유지.
- 공유 실패는 기존 대체 경로를 따른다. `AbortError` 취소는 재공유/복사 없이 idle 복귀.
  실제 Toss/모바일 native 취소 이벤트의 형태는 실기기 확인이 필요하다.
- 경계 검사 정책은 `src/platform/ReleaseBoundary.ts` 한 곳에 있다. CLI와 실제 저장소
  테스트가 재사용한다. 초대 인자는 지정된 두 파일의 일시적 전달에만 허용하며,
  로그/저장/진단 전송을 추가하면 재검토한다. 정적 검사는 완전한 데이터 흐름 분석이 아니다.
- Edge 클라이언트 타입과 불변 ranked 규칙 타입을 복구했다. DB 생성 타입 도입은 후속
  온라인 구현에서 실제 원격 스키마와 대조한다. 타입-only 변경도 기존 생성 규칙에 따라
  ranked rules hash가 바뀌므로 향후 원격 적용 시 client/Edge 계약을 함께 검증한다.
- 다음 작업: 실기기/사용자 플레이 피드백 → 한 묶음씩 게임 보완 → 실제 로그인/내부 계정
  매핑 → 동기화 → 공개 랭킹. boss_shard 서버 재현은 공개 랭킹 전에 해결한다.
- 계획/상태: `ai/plans/implementation-plan.md`, `ai/plans/master-roadmap.md`,
  `ai/reviews/review.md`. 기존 체크박스의 역사적 완료와 현재 원격 검증을 구분한다.
