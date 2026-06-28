
## Shared Knowledge Sources

- Reuse the shared long-term knowledge repository at `/Users/kangsungbae/Documents/지식저장소`.
- Before substantial planning, architecture, or coding work, read `/Users/kangsungbae/Documents/지식저장소/AI_CONTEXT.md`, then `agent/index.md`, `agent/profile.md`, `agent/operating-rules.md`, and the relevant `sessions/` or `projects/` notes.
- Treat `/Users/kangsungbae/Documents/최종관리자` as a historical/reference workspace when relevant. Search its dated folders for explicit files, but prefer promoted knowledge in `/Users/kangsungbae/Documents/지식저장소` as the durable source of truth.
- When reusable knowledge appears during `orbitslash` work, promote it into Markdown under `/Users/kangsungbae/Documents/지식저장소` so Codex, Claude, and future AI assistants can share it.
- Keep sync token-light: do not replay all raw logs, do not paste full transcripts, and do not repeatedly read large logs or generated graph files unless the task specifically requires it.
- Answer the user in Korean by default unless the task or requested artifact clearly calls for another language.

## Implementation Consent Gate

- Do not start implementation, file edits, configuration changes, installs,
  deployments, deletes, or other mutating work unless the latest user message
  explicitly asks to implement, modify, apply, update, create, run, install,
  delete, or otherwise execute that action.
- For questions, reviews, status checks, "확인해줘", "의견줘", "어떻게 할까", and
  ambiguous requests, read or inspect as needed and answer with findings,
  tradeoffs, and a recommended next step. Then wait for explicit implementation
  permission.
- Read-only inspection and planning are allowed when requested. Mutating
  commands and file edits require explicit action wording.

## Custom Subagent Routing

When the user explicitly asks for subagents, parallel agents, delegation, or a named custom agent:

- First consult `/Users/kangsungbae/.codex/agents/` and `/Users/kangsungbae/.codex/agent-routing/subagent-backends.toml`.
- Treat `subagent-backends.toml` as the source of truth for preferred backend/model routing.
- Prefer the routing file's external primary or secondary backend, such as `agy`/Gemini or Claude, before native Codex fallback when specified.
- Before using Claude CLI or Antigravity CLI (`agy`), run the auth checks from the global instructions: `claude auth status` for Claude and `agy -p 'Reply with exactly: AGY_AUTH_OK' --print-timeout 45s` for `agy`.
- If the preferred external backend is unavailable, unauthenticated, quota-limited, timed out, or rejected, tell 성배님 plainly and mark the run as degraded before falling back. Do not silently substitute GPT/native Codex for a custom-routed external worker.
- Subagents return a `세션로그용 요약 블록`; the main Codex/Claude session writes project-local `ai/session-logs/` when needed.

## understand-anything

This project uses Understand-Anything project memory in `.understand-anything/`.

Rules (Owner rule 2026-06-28: UA demoted to a third-tier manual backup):
- Use Understand-Anything only when an architecture narrative, onboarding guide, or diff/risk map is genuinely needed. For routine code lookup use codebase-memory-mcp (cmm) first.
- Keep `.understand-anything/config.json` with `"language": "ko"`, `"outputLanguage": "ko"`, and `"autoUpdate": false`. Refresh UA only when the user explicitly asks for a full-project UA update.

## codebase-memory-mcp (cmm)

This project uses codebase-memory-mcp (cmm) as the primary code-read/code-write knowledge layer. The index is stored per project, locally, via `.mcp.json` (`env.HOME=<project>/.codebase-memory-home`).

Rules (Owner rule 2026-06-28):
- For reading or writing code (functions, classes, callers, call chains, impact, architecture), use cmm tools first (`search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`) instead of grep/glob/broad file reads.
- Use Graphify for docs, decisions, session logs, plans, and cross-file/cross-document relationships. Use direct file reads as the final source of truth for exact code.
- `.codebase-memory-home/` is a local index store; keep it in `.gitignore` and out of Graphify source scans. `auto_index` is on, so the index refreshes on change.

## Project Plans and Session Logs

This project stores AI-generated planning and session evidence under `ai/`.

Rules:
- Maintain canonical latest artifact files for recurring project documents:
  - `ai/plans/product-plan.md` for product/spec planning.
  - `ai/plans/design-plan.md` for UX/UI/design planning.
  - `ai/plans/implementation-plan.md` for implementation planning.
  - `ai/reviews/review.md` for review/QA critique and readiness notes.
- Put `version`, `status`, `updated`, and `canonical: true` frontmatter at the top of each canonical artifact.
- Update the canonical file in place when the plan changes; the newest state should be discoverable by opening the fixed filename.
- Keep a short `Change Log` inside each canonical file. Archive milestone snapshots only when useful under `ai/plans/archive/` or `ai/reviews/archive/`.
- Dated files remain appropriate for session logs, research notes, one-off handoff briefs, or archive snapshots, but they should not replace the canonical latest files.
- Keep `ai/session-logs/README.md` in every new project even before the first real log exists.
- Save meaningful session change logs in `ai/session-logs/` as dated Markdown files. Include user request, decisions, files changed, commands or verification, risks, next steps, and knowledge-store promotion status.
- Every meaningful session should first be recorded in this project's `ai/session-logs/`; `/Users/kangsungbae/Documents/지식저장소` is for promoted reusable summaries, not a replacement for the local project log.
- Name session-log files `YYYY-MM-DD-<short-topic>-<actor>.md` where `<actor>` is `codex`, `claude`, or `gemini` (use `both` only for a genuinely joint log).
- Same-day same-topic sessions must still be separated by actor. Append only to the matching actor's file and keep the internal `Actor:` field aligned with the filename.
- If this project has no session logs yet, write the first real log at the end of the first meaningful planning, implementation, review, QA, release, or durable-decision session. Do not create fake placeholder logs.
- Keep plans and logs concise. Do not paste full chat transcripts or full tool logs unless the raw evidence itself is the artifact being preserved.
- Keep `ai/` available to project-local Graphify; do not ignore it in `.graphifyignore`.
- Promote reusable knowledge from these logs to `/Users/kangsungbae/Documents/지식저장소`.
- Follow `/Users/kangsungbae/Documents/지식저장소/docs/workflows/graph-refresh-policy.md` for graph timing.
- Refresh project Graphify after new project setup, verified feature completion, finalized important project docs, durable decisions, or handoffs that depend on recent files.
- Do not refresh project Graphify for ordinary conversation, tiny copy edits, or short unsaved opinions.
- Use `graphify update . --no-cluster` as the routine structural fallback when a refresh is worthwhile.

## App Platform Portability

If this project is an app, follow `/Users/kangsungbae/Documents/지식저장소/docs/workflows/app-platform-standard.md`.

Rules:
- Keep every app compatible with both Apps in Toss and Google Play from the first implementation unless the user explicitly narrows the target.
- For game or game-like apps, use Google Play as the first release target while preserving Apps in Toss compatibility.
- For non-game apps, use Apps in Toss as the first release target while preserving Google Play compatibility.
- Keep one shared product codebase by default, with platform-specific Apps in Toss and Google Play build targets, adapters, config, release checklists, and packaging. Do not fork core/domain logic just to support both stores.
- Apps in Toss builds follow Apps in Toss runtime/login/ads/IAP/WebView/UX/review requirements. Google Play builds follow Android/Google Play/Credential Manager or Play Games/AdMob/Billing/Data Safety/store listing requirements.
- Before meaningful app planning, design, implementation, or QA, read `/Users/kangsungbae/Documents/지식저장소/docs/tools/apps-in-toss-platform.md` and run `/Users/kangsungbae/Documents/지식저장소/docs/workflows/apps-in-toss-development-gate.md`.
- Before deploy, release review, Google Play-first game release prep, store packaging, or a user-facing release decision, run `/Users/kangsungbae/Documents/지식저장소/docs/workflows/apps-in-toss-release-gate.md`.
- Use `/Users/kangsungbae/Documents/지식저장소/docs/tools/apps-in-toss-developer-center-catalog.md` to find the exact official Apps in Toss developer-center page when details matter.
- Keep authentication/login, ads, in-app purchase, storage, analytics, haptics, share, and backend transport behind platform adapters.
- Do not import Apps in Toss, Google Play Billing, AdMob, Google login, or other platform SDKs directly from product/domain logic.
- Use Supabase as an attached default backend for every app project even when the user does not explicitly ask for it, unless a project records an explicit exception. Keep Supabase behind `BackendAdapter`/repository/server boundaries; product/domain logic must not import `@supabase/supabase-js` directly.
- Use one shared Supabase project for MVPs and mini apps by default: `dr.kang-mini-project` (`project-ref: jwnuxxxthzkeiiuqopir`). Use only the `public` schema and separate app data with short, unique table prefixes.
- Use `core_`, `identity_`, and `authmap_` prefixes for shared user/account mapping. Google, Apps in Toss/Toss, Apple, Kakao, GitHub, and anonymous identities map to internal `core_users` through `authmap_user_identities`; do not automatically merge providers.
- Codex/Claude should write SQL migrations, adapter/repository code, `.env.example`, and setup docs. The user reviews and applies SQL in the Supabase SQL Editor by default. Do not run remote apply commands such as `supabase db push` unless explicitly asked.
- Enable RLS for user data tables by default. Do not write public-open policies like `using (true) with check (true)`, do not disable RLS, and do not store raw Toss userKey values.
- Keep Supabase service role keys, DB passwords, JWT/webhook secrets, receipt-verification secrets, and other server credentials out of app bundles. Frontend public env may contain only Supabase URL/anon key when RLS and storage policies are verified.
- Deployed Apps in Toss and Google Play clients may read/write Supabase only through public `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` plus verified RLS policies, or through a backend/Supabase Edge Function/server proxy. Apps in Toss/Toss identity writes, Google/Toss account linking, admin writes, paid entitlement changes, LLM calls, token exchange, and service-role operations must stay server-side and resolve to internal `core_user_id`.
- For shared Supabase public client values across app projects, use `/Users/kangsungbae/.config/sungbae/shared-env/supabase-public.env.local`. Project `.env.local` may reference this file. Store only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` there; never store service role keys, `SUPABASE_ACCESS_TOKEN`, DB passwords, JWT secrets, webhook secrets, or platform private secrets in that shared public env file.
- For shared server-only AI provider secrets such as DeepSeek, use `/Users/kangsungbae/.config/sungbae/shared-env/ai-secrets.env.local`. Project `.env.server.local` may reference this file. Store `DEEPSEEK_API_KEY` there only as a server-side key; never expose it through `VITE_`, `NEXT_PUBLIC_`, or `PUBLIC_` env names. Client apps must call a backend/Supabase Edge Function/server proxy that owns the secret.
- For shared Supabase admin/server/CLI access across app projects, use `/Users/kangsungbae/.config/sungbae/shared-env/supabase-admin.env.local`. This file is server/agent/CI-only and may contain `SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SECRET_KEY`, optional `SUPABASE_SERVICE_ROLE_KEY`, and verified `SUPABASE_DB_URL`. Never symlink it into app `.env.local`, never expose it through `VITE_`, `NEXT_PUBLIC_`, or `PUBLIC_`, and never print its values in chat, logs, docs, screenshots, PRs, or Graphify source files.
- When an explicit Owner request requires Supabase remote schema/migration access, first load the admin env above and verify access without leaking secrets. Check management access with `supabase projects list`, prefer the existing verified `SUPABASE_DB_URL` for DB access, and if DB access fails because of IPv6 or stale pooler routing, re-derive or re-copy the Dashboard **Connect > Transaction pooler** URL, test it, then update only `SUPABASE_DB_URL`. Transaction pooler port is `6543`; hostname can vary by project or Supabase routing, so verified env value wins over guessed `aws-0`/`aws-1` patterns.
- AI readiness is attached by default for every app/service project even when the user does not explicitly ask for AI. Include an AI adapter/service interface, backend/Supabase Edge Function/server proxy route, server-only env placeholder, and touchpoint review. If no user-facing AI feature is enabled for the current stage, record `AI UX disabled for this stage` and keep the AI path backend-ready or stubbed.
- Implement i18n from the first app version: Korean (`ko`) is the default, and English (`en`) must be user-selectable.
- Route UI copy, LLM prompts, notifications, purchase copy, errors, empty states, and onboarding through the active locale instead of hard-coding user-facing strings.
- Plan MVP stubs for login, ads, and IAP even when the first release does not enable them.
- Apps in Toss implementations should use Toss login, Apps in Toss ads, and Apps in Toss IAP.
- Google Play implementations should use Credential Manager or Play Games Services, AdMob, and Google Play Billing.
- Verify paid entitlements on a backend. Do not put store secrets, receipt-verification credentials, or LLM API keys in app bundles.
- Apps in Toss Console API key access uses `APPS_IN_TOSS_CONSOLE_API_KEY`. Treat it as server/agent/CI-only secret material: do not store the real value in project files, do not print it, and do not expose it through browser/app public env variables such as `VITE_`, `NEXT_PUBLIC_`, or `PUBLIC_`.
- Keep a project platform note in `/Users/kangsungbae/Documents/지식저장소/projects/<project-name>/platform.md` when the project becomes an app.

## Implementation Knowledge Graph Workflow

When implementing, modifying, debugging, or refactoring code in this project:

- Before broad source reading or code edits, consult the project knowledge graphs when they exist. Use Understand-Anything for architecture, components, data flow, onboarding, and diff-risk context. Use Graphify for cross-file, cross-document, decision, and relationship discovery. Fall back to direct file reads for exact code and trivial single-file edits.
- After meaningful code implementation, bug fixes, refactors, or architecture-affecting changes, refresh the project knowledge graphs before declaring the work complete unless the user explicitly asks to skip. Refresh Graphify with `graphify update . --no-cluster` as the routine structural fallback. Refresh Understand-Anything with the appropriate installed `understand*` skill for meaningful code or architecture changes.
- If either refresh cannot run or would be disproportionate for a tiny change, record the reason in the session log or final summary.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- Follow `/Users/kangsungbae/Documents/지식저장소/docs/workflows/graph-refresh-policy.md` for graph refresh timing.
- Refresh project Graphify after new project setup, verified feature completion, finalized important project docs, durable decisions, or handoffs that depend on recent files.
- Do not refresh project Graphify for ordinary conversation, tiny copy edits, or short unsaved opinions.
- Use `graphify update . --no-cluster` as the routine structural fallback when a refresh is worthwhile.

<!-- APP_AD_TELEMETRY_STANDARD_START -->
## App Ad Telemetry Standard

For every app project, including newly created projects, plan and implement ad telemetry when banner, interstitial/full-screen, rewarded, or platform ads are introduced.

- Keep ad SDK calls behind platform adapters such as `AdsAdapter`; product/domain logic must not import Apps in Toss Ads, AdMob, or other ad SDKs directly.
- Add a Supabase-backed or server-backed ad telemetry path by default: client code may call only an Edge Function/server endpoint with public credentials, and the server performs table writes with service-role/admin credentials. Do not let the app bundle write directly to diagnostics tables.
- Track banner, interstitial/full-screen, and rewarded ad lifecycle events separately. At minimum record load/preload/request, show, impression, click, dismiss, no-fill, render/show failure, and final result. For rewarded ads, record `userEarnedReward` separately and never grant durable rewards from show, dismiss, network response, or generic success alone.
- Persist diagnostic fields such as `event_name`, `ad_format`, `placement_id`, `ad_group_id`, `sdk_event_type`, `reason`, `shown`, `rewarded`, `screen`, `runtime`, app/session trace id, app version/build/deployment id when available, and timestamps.
- Do not store raw Toss `userKey`, advertising IDs, device IDs, nicknames, invite codes, answer payloads, free-text relationship content, or other unnecessary personal data in ad telemetry. Use random app/session trace IDs and hashed/internal IDs only when a real debugging need is documented.
- For Apps in Toss, compare internal telemetry against Apps in Toss Console metrics to distinguish preload requests, actual impressions, rewarded completion, no-fill, invalid/test traffic, and dashboard reporting delay.
- Release plans and session logs must state whether the telemetry table/migration, Edge Function/server endpoint, env configuration, deployment, and real-device ad QA are complete.
<!-- APP_AD_TELEMETRY_STANDARD_END -->
