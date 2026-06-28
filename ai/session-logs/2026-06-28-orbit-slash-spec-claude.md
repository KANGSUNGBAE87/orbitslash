# Session Log — Orbit Slash 기획문 등록

- Date: 2026-06-28
- Actor: claude
- Stage: spec / project-setup

## User Request
빈 orbitslash repo에 Orbit Slash 게임 기획문 v1.0 전달, "기억해" — 영구 보존 요청.

## Decisions
- 프로젝트 셋업 적용: `apply-project-knowledge-tools`로 ai/ 구조, Graphify,
  Understand-Anything, codebase-memory(.mcp.json), Supabase/AI env 심볼릭 링크 생성.
- 기획문 원문을 `ai/plans/product-plan.md` (canonical, v1.0, status: approved)로 보존.
- 아직 **구현 미시작**. Owner가 명시적 구현 지시 안 함("진행할 예정" + "기억해"까지).

## Files Changed
- `ai/plans/product-plan.md` 생성 (기획문 v1.0 전문)
- 프로젝트 스캐폴드 (AGENTS.md, CLAUDE.md, .graphifyignore, .mcp.json, .env.* 등)

## Project Profile (전역지침 연동)
- 타입: Apps in Toss WebView 게임 → Apps in Toss compliance 첫 게이트.
- 게임/게임형 → Apps in Toss 요건 충족 후 등급분류 필요시 Google Play first 검토.
- 백엔드: 랭킹 서버 + 기록 검증 + Remote Config 필요 → Supabase 부착 대상.
  공유 프로젝트 `dr.kang-mini-project`, 테이블 prefix `orbitslash_`.
  Run Token·시드·기록 검증은 server-side(Edge Function), 클라 신뢰 금지.
- AI: 현재 user-facing AI 기능 없음 → "AI UX disabled for this stage" (백엔드 stub 보류).
- 기술 스택: Vite + TS + PixiJS, Canvas/WebGL, DOM 게임 렌더 금지.
- i18n: ko 기본 + en 선택 (1차부터).

## Verification
- product-plan.md 생성 확인됨. graphify 빌드는 LLM API key 없어 스킵됨(셋업 helper 출력).

## Risks / Notes
- WebView 치팅 방지 = 서버 검증 필수. 클라이언트-only 기록 신뢰 불가.
- Master 난이도 60초 벽, 랭킹 시드 고정, 광고 부활 금지 — 핵심 공정성 규칙.

## Next Steps
1. (선택) Apps in Toss 개발 게이트 확인 + Supabase 랭킹 스키마 초안.
2. design-plan.md (지구 중심 UI, 슬래시 이펙트, 시각 톤).
3. implementation-plan.md → 1단계 핵심 플레이 루프부터 (지구/소용돌이/슬래시/충돌/에너지/점수).
4. Owner의 명시적 구현 지시 대기.

## Promote to 지식저장소?
- 아직 불필요. 프로젝트-local 보존으로 충분. 구현/결정 진행되면 projects/orbitslash/ 생성 검토.
