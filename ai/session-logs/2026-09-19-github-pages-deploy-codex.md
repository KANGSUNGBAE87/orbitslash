# GitHub Pages deployment

- Date: 2026-09-19
- Actor: codex
- User request: 현재 구현 상태를 GitHub에 배포하고 공개 링크 제공
- Decision: 기존 `main` 푸시 기반 GitHub Pages workflow를 사용한다. 앱인토스/Google Play 스토어 출시는 이번 범위가 아니다.
- Verification: Node 24.21.0에서 `npm ci`, Vitest 136 files / 969 tests, production build, local release preflight를 실행했다.
- Files changed: 기존 작업 트리의 구현·테스트·자산·플랫폼 설정 전체와 이 배포 기록.
- Commands: `npm ci`, `npm test -- --reporter=dot`, `npm run build`, `npm run preflight:release`, GitHub PR/Pages workflow 확인.
- Risks: 운영 의존성 감사 경고는 Apps in Toss 빌드 도구 및 Pixi 선택 경로에서 발생한다. critical 패키지 문자열은 Vite production bundle에 포함되지 않았지만 후속 SDK 메이저 업그레이드 검토가 필요하다. 원격 Supabase 신규 기능과 실기기/스토어 QA는 별도 미완료 상태다.
- Deployment: GitHub Pages workflow 및 공개 URL 확인 전.
- Next steps: GitHub Actions 성공과 공개 페이지 smoke check를 확인한 뒤 이 항목을 최종 증거로 갱신한다.
- Knowledge promotion: 없음. 프로젝트 배포 증거로만 유지한다.
