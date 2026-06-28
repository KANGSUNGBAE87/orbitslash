
## Custom Subagent Routing

When the user explicitly asks for subagents, parallel agents, delegation, or a named custom agent:

- First consult `/Users/kangsungbae/.codex/agents/` and `/Users/kangsungbae/.codex/agent-routing/subagent-backends.toml`.
- Treat `subagent-backends.toml` as the source of truth for preferred backend/model routing.
- Prefer the routing file's external primary or secondary backend, such as `agy`/Gemini or Claude, before native Codex fallback when specified.
- Before using Claude CLI or Antigravity CLI (`agy`), run the auth checks from the global instructions: `claude auth status` for Claude and `agy -p 'Reply with exactly: AGY_AUTH_OK' --print-timeout 45s` for `agy`.
- If the preferred external backend is unavailable, unauthenticated, quota-limited, timed out, or rejected, tell 성배님 plainly and mark the run as degraded before falling back. Do not silently substitute GPT/native Codex for a custom-routed external worker.
- Subagents return a `세션로그용 요약 블록`; the main Codex/Claude session writes project-local `ai/session-logs/` when needed.
# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

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
