# Orbit Slash 제품 완성 1~5 구현계획

- Date: 2026-07-11
- Actor: codex
- Stage: planning

## User Request

직전 구현·상품성 감사의 권장 순서 1~5를 Claude 포함 서로 다른 모델 의견으로 검토하고,
현재 코드에 맞는 상세 구현계획으로 취합.

## Evidence Read

- Canonical product/design/implementation plans and roadmap.
- Current dirty working tree and recent commits.
- CMM project index: 3,346 nodes / 7,442 edges.
- App/Progress/Unlock/Tutorial/Solar Lance/asset/platform/telemetry/ranked code boundaries.
- Apps in Toss platform/development gate and design preflight.
- UI UX Pro Max verification output.

## Model Inputs

- Claude CLI first-party Opus 4.6 xhigh: `Stream idle timeout`; authentication remained valid.
- Claude CLI first-party Sonnet 4.6 high: completed in degraded fallback mode.
- Gemini 3.1 Pro High: mobile UX, feedback, asset budget, retention funnel opinion.
- Codex subagent/CMM: exact source/test/module and migration boundary map.
- Main Codex GPT-5.5 xhigh: final evidence reconciliation and plan integration.

## Decisions

- Keep PixiJS, pure TypeScript, current platform adapter boundaries.
- Reject XState, Howler, React/CSS particle migration.
- Use pure `ProgressReducer` outcome, `TutorialFlow` reducer, `SolarLanceResolver`,
  `FeedbackController`, grouped `AssetManifest`, local-first cloud sync.
- Identity is required before cloud/public Ranked, not before local Stage 1–3 work.
- Proposed Ranked/Nova player unlock: Story 8 clear or first boss defeat.
- Separate player unlock from public service readiness.
- Google Play remains first release shell; Apps in Toss compatibility follows.
- No remote DB apply, Edge deploy, install, packaging, or store upload in this planning session.

## Files Changed

- `ai/plans/implementation-plan.md`
- `ai/plans/master-roadmap.md`
- `docs/superpowers/plans/2026-07-11-orbit-slash-product-completion-1-5.md`
- `ai/session-logs/2026-07-11-product-completion-plan-codex.md`

## Verification

- Plan placeholder/type/path self-review.
- `git diff --check` and targeted document structure checks.
- Project Graphify structural refresh completed: 3,337 nodes / 389,655 edges.
- Follow-up keyword query reached the existing product plan, but did not surface the new detailed plan;
  semantic document re-extraction remains a later knowledge-maintenance item.
- No source-code or runtime implementation changed.

## Remaining Risks

- Current working tree already has 23 tracked modifications and 7 untracked files; implementation must capture that baseline first.
- Ranked/Nova unlock threshold is a proposed product decision until Owner accepts or changes it.
- Remote cloud/ranked/entitlement work still needs explicit Owner execution and release commands.
- Real-device performance, audio, haptic, Google Play, and Apps in Toss evidence does not yet exist.

## Next Step

Owner reviews the canonical plan. After approval, execute Batch 0 then Stage 1 using
`superpowers:subagent-driven-development` or `superpowers:executing-plans`.

## Knowledge Promotion

Project-specific plan only. No new cross-project rule; `/Users/kangsungbae/Documents/지식저장소`
source was not modified.

---

## Implementation Continuation

- Date: 2026-07-11
- Actor: codex
- Stage: implementation + local/browser QA

### User Direction

- Execute the approved completion plan and use routed subagents where available.
- Claude has no remaining tokens; exclude the Claude route.

### Completed in This Continuation

- Added deterministic `ProgressReducer` result outcomes, unlock policy/skill access,
  progress schema migration, first-session/tutorial reducers, Solar Lance protected-object
  stop resolution, local retention rules, asset manifest/preload helpers, product event queue,
  and local cloud-progress merge/idempotent mutation primitives.
- Wired home primary flow, guided Story 1 persistence, unlock result rendering, and direct
  Collection CTA.
- Fixed Free Defense mobile detail layout: all main/secondary controls meet 48 CSS-pixel
  touch-height target at 360x800, 390x844, and 412x915; body/status overlap was found in
  browser QA and removed.
- Added product telemetry queue retry behavior. Remote product telemetry endpoint/schema is
  intentionally not claimed complete.

### Cross-model / Agent Evidence

- `agy` review initially found time-dependent reducer state; fixed by injecting the store clock.
  Re-review: approved.
- DeepSeek auxiliary route was attempted for text/code review but did not return before timeout;
  no DeepSeek result was used.
- Native Codex UI/backend audits found the mobile overlap, cloud identity, remote telemetry,
  entitlement, and store-runtime gaps. CMM later returned `Transport closed`; direct file/test
  checks were used after that failure.

### Verification

- `npm test`: 99 files, 544 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Browser QA against local Vite at `390x844` and `360x800`:
  home, guided Story start, and Free Defense detail rendered; no console errors. The repeated
  Pixi `No available adapters` message is a local warning, not a thrown error.
- Graphify structural refresh: 3,514 nodes, 401,140 edges.

### Remaining Release Blockers

- CMM MCP transport must be restarted/reindexed before relying on it again.
- Supabase identity, cloud snapshot repository/Edge deployment, product telemetry sink,
  entitlement/IAP, shared Ranked server SSOT, Google Play shell/signing, Apps in Toss SDK
  bridge/private-device QA, audio/haptic preferences, and real-device performance remain
  incomplete. No remote schema apply, Edge deploy, store action, or package upload was run.

### Knowledge Promotion

- No cross-project promotion: this is implementation evidence specific to Orbit Slash.

---

## Implementation Continuation 2

- Date: 2026-07-11
- Actor: codex
- Stage: implementation + browser QA

### Added

- `PlayerPreferencesStore`: persistent `bgmEnabled`, `sfxEnabled`, `hapticEnabled`,
  `reducedMotion`, and locale preferences.
- `FeedbackController` and gesture-gated `WebAudioEngine`: synthesized SFX, normal-hit
  80ms haptic throttle, protected Last Save heavy haptic, and disabled-feedback behavior.
- Settings UI feedback toggles, wired through `GameApp` into platform storage.
- `AppLifecycle`: background transition pauses simulation/audio, cancels active strokes, and
  requires an explicit subsequent pointer gesture before frame advancement resumes.

### Evidence

- Browser QA at 390x844: Settings controls have 48 CSS-pixel-or-larger targets; haptic toggle
  visibly changes to off and persisted `hapticEnabled:false` in localStorage.
- Full local verification: `npm test` 103 files / 553 tests passed; `npm run typecheck`,
  `npm run build`, and `git diff --check` passed.
- agy and DeepSeek external runs authenticated but returned no answer; no unsupported model
  output was incorporated. Claude remained excluded by Owner direction.

### Remaining

- Lifecycle still lacks a player-visible PauseOverlay and native safe-inset bridge.
- Audio uses synthesized local cues; final music assets and device speaker QA remain.
- Remote cloud/identity/telemetry, entitlement, ranked server parity, Google Play, Apps in Toss,
  and external real-device/store gates remain incomplete.

---

## Implementation Continuation 3

- Date: 2026-07-11
- Actor: codex
- Stage: implementation + release-preflight

### Added

- Privacy-safe product-funnel remote boundary: `orbitslash_product_events` migration,
  product telemetry Edge Function, public-anon adapter route, explicit enable/verification
  flags, and client queue flushing that retains rejected/offline events.
- Local-first cloud-progress boundary: adapter-normalized identity state, durable local snapshot
  replacement, idempotent sync outbox, deterministic local/remote merge, public-anon progress
  port, progress migration, and server identity mapping through `authmap_user_identities`.
- Collection now shows non-degrading stage medal, daily clear-day, and weekly claim summaries.
- Added `npm run check:edge` for the new product and progress Edge draft bundles.

### Verification

- Full local regression: `npm test` 110 files / 568 tests passed.
- `npm run typecheck`, `npm run check:edge`, `npm run build`, `git diff --check`: passed.
- `npm run preflight:release`: local boundary scans and existing Edge draft bundle checks passed.
  It explicitly does not prove remote deployment, app stores, or real devices.

### Routing / Blockers

- agy, DeepSeek, and native fallback audit each returned no usable response despite valid auth;
  no fabricated cross-model conclusion was used. Claude remained excluded.
- No Supabase migration was remotely applied and no Edge Function was deployed. The progress
  Edge requires a verified Supabase auth token plus a matching `authmap_user_identities` row;
  until that external setup exists, cloud sync correctly remains unavailable.

---

## Implementation Continuation 4

- Date: 2026-07-11
- Actor: codex
- Stage: implementation + local release QA

### Added

- Cosmetic catalog/loadout with an invariant that cosmetics never alter `RunConfig`.
- Cosmetic-only supporter entitlement repository and server-only entitlement migration/Edge draft.
  The Edge returns `receipt_provider_not_configured` for client receipt requests instead of
  granting purchases without a verified provider path.
- Asset budget gate: boot assets <= 700 KiB, each asset <= 2 MiB, total <= 12 MiB. Current
  measured boot size is 568,544 bytes; total is 9,057,679 bytes.
- Release preflight now bundles all product/progress/entitlement Edge drafts.

### Verification

- Full local regression: `npm test` 113 files / 573 tests passed.
- `npm run typecheck`, `npm run check:assets`, `npm run check:edge`,
  `npm run preflight:release`, `npm run build`, and `git diff --check`: passed.

### Remaining

- Ranked Edge is still a large handwritten implementation and lacks the planned generated shared
  server-truth core/hash parity mechanism.
- Entitlement receipt provider verification, remote migration apply/Edge deploy, Google Play and
  Apps in Toss actual SDK shells, and real-device release QA remain external or unfinished.

---

## Implementation Continuation 5

- Date: 2026-07-11
- Actor: codex
- Stage: ranked SSOT migration + local release QA

### Added

- `shared/ranked-core/` now owns Deno/browser-neutral ranked rules, deterministic wave/boss/split
  scheduling, score replay, bounds, and strict spawn evidence matching.
- The generator hashes every ranked-core module plus the six ranked JSON sources, emits a Deno-safe
  module graph and immutable Edge rules snapshot, and detects source/artifact drift in `--check`.
- Client replay validation delegates spawn, score, and bounds work to that core. The ranked Edge
  wrapper delegates normal waves, dynamic boss/split sequence, and replay scoring to generated
  modules; it consumes all four difficulty wave tables rather than the old rookie fallback.
- Public `boss_shard` evidence remains rejected. Deterministic server phase/shard simulation is
  still absent, so accepting client-provided shard spawns would be client authority.

### Verification

- Added client-vs-generated Edge parity coverage for all ranked difficulties, WaveGenerator RNG
  order, generated JSON snapshot equality, score/bounds, split ordinals, missing/injected/permuted
  evidence, and boss-shard rejection.
- Full local regression: `npm test` 115 files / 593 tests passed.
- `npm run typecheck`, `npm run build`, `node scripts/generate-ranked-edge-core.mjs --check`,
  `npm run preflight:release`, and `git diff --check` passed.
- Preflight bundles ranked Edge successfully. `deno check` was skipped because Deno is not installed;
  no remote deploy, migration apply, device QA, or store verification occurred.

### Remaining

- The Edge HTTP/auth/database wrapper still has local geometry/auth validation helpers; ranked
  source data and spawn/score sequencing are no longer handwritten. A fully deterministic boss
  phase simulator is required before public boss-shard replay evidence can safely be accepted.
- Platform SDK shells, remote Supabase deployment, real-device QA, and store-console gates remain
  separate external work.

---

## Implementation Continuation 6

- Date: 2026-07-11
- Actor: codex
- Stage: ranked SSOT post-review remediation

### Added / Corrected

- Added additive local-only migration `20260711_orbitslash_ranked_rules_contract.sql`.
  Historical rows are marked `legacy-ranked-rules-unbound` / version `0` before both columns are
  made `NOT NULL`; no permissive default is added.
- Ranked token issuance now persists generated `rules_hash` and `rules_version`. Submission first
  verifies the caller's current contract and then the issued run contract, returning stable
  `ranked_rules_mismatch` before replay validation or score insertion for a stale token.
- Added actual player `WaveGenerator` + ranked runtime configuration parity checks across rookie,
  defender, elite, and master. The test found the Edge normal-wave wrapper leaked `spawnOrdinal`;
  the wrapper now strips that transport-only field to match player/core spawn specs.
- Removed dead handwritten Edge wave/RNG/boss/split derivation graph. The remaining normal-wave
  helper is a narrow generated-core delegation, enforced by a source-boundary test.

### TDD / Verification

- RED→GREEN: issued-token insert lacked rules fields; then added exact generated contract fields.
- RED→GREEN: stale issued contract traversed beyond lookup; then added selected issued contract
  fields and the pre-score mismatch guard.
- RED→GREEN: all-difficulty runtime parity exposed the Edge `spawnOrdinal` shape mismatch; then
  stripped it at the delegation boundary.
- RED→GREEN: source guard exposed legacy `ROOKIE_WAVES`/RNG/derive graph; then removed it.
- Full local regression: `npm test` 115 files / 597 tests passed.
- `npm run typecheck`, `npm run build`, `npm run check:edge`,
  `node scripts/generate-ranked-edge-core.mjs --check`, `npm run preflight:release`, and
  `git diff --check` passed. Preflight bundles ranked Edge; `deno check` is skipped because Deno
  is not installed in PATH.

### External Boundaries

- No Supabase migration was applied and no Edge function was deployed.
- Public boss-shard evidence remains rejected until deterministic server phase simulation exists.

---

## Implementation Continuation 7

- Date: 2026-07-11
- Actor: codex
- Stage: final local integration + QA

### Completed Local Slices

- Ranked server-truth contract was finalized after specification and quality re-review: generated
  shared rules/source hash, issued-run contract binding, caller identity checks, exact server spawn
  sequencing, and fail-closed boss-shard replay policy.
- Season configuration and friend challenges are local/Edge-ready: cosmetic-only remote season
  rewards, one-time hashed challenge tokens, verified-ranked-run acceptance, and atomic
  service-role RPC acceptance conditions.
- Lifecycle pause UX is complete: background/foreground pauses the simulation, shows a non-click-
  through resume overlay, and only the explicit resume CTA restores input.
- Google Play and Apps in Toss platform shells are installed and contract-tested. They remain
  intentionally unsupported for real login, billing, ads, or purchases until verified native/
  server services are configured; no placeholder can grant identity or entitlement.

### Final Verification Evidence

- `npm test`: 127 files / 671 tests passed.
- `npm run typecheck`, `npm run build`, `npm run check:assets`, `npm run check:edge`,
  `node scripts/generate-ranked-edge-core.mjs --check`, `node scripts/check-google-play-shell.mjs`,
  and `git diff --check`: passed.
- Asset budget: boot 568,544 B; total 9,057,679 B; 15 files.
- Browser smoke at 390x844: home → start run → simulated background/foreground → visible pause
  overlay → explicit resume all passed. Browser console contained only Pixi's expected
  `No available adapters` warning in this headless runtime.
- Release preflight correctly stopped with exit 2 at `node24_required_external` because this
  workspace has Node 22.22.3. Deno is also absent, so real `deno check` remains external.
- cmm transport was closed during the final lifecycle lookup; a narrow direct source fallback was
  used only for the lifecycle event names.

### Remaining External Release Gates

- Install/select Node 24 and Deno, then run the actual Apps in Toss build/private-device flow with
  Console-approved app name/icon values.
- Install/configure JDK 21, produce and test Android AAB on a real device, then configure verified
  Google Credential Manager, Billing, and AdMob services.
- Apply the local Supabase migrations, deploy Edge Functions/secrets, configure provider receipt
  verification, and test real authenticated cloud/telemetry/friend-challenge flows.
- Perform real Apps in Toss and Google Play store-console/device release QA. No remote apply,
  deployment, credential configuration, store submission, or commit was performed in this session.

---

## Implementation Continuation 8

- Date: 2026-07-11
- Actor: codex
- Stage: actual-path remediation + local/browser QA

### Reconciliation

- Continuation 7의 “final local integration” 표현은 actual game-path 재감사와 충돌했다.
  이번 continuation에서 test-only/고정 viewport/미연결 UI 지점을 실제 경로로 보완했으며,
  아래 외부 release gate는 여전히 완료가 아니다.

### Added / Corrected

- Ranked: player unlock과 public service readiness를 UI/start route에 연결. 검증 서버가
  준비되지 않으면 명시적으로 `local practice`로 시작하며 progress/leaderboard에 기록하지 않는다.
- Result: `summary → unlock reveal → Collection` 순차 흐름을 AppShell에 연결하고 raw ID를
  현지화된 mode/skill/boss/collection 이름으로 교체.
- Retention: `retention.json`, remote validation fallback, KST Monday 06:00 주간 집계,
  idempotent `weekly_five_day` title claim, Collection 상태/수령 CTA, weekly claim telemetry.
- Return: KST day key를 이용해 최초 실행을 제외한 익일 재방문만 `return_next_day`로 기록.
- Mobile: GameApp safe-area/root-fit metrics를 Free Defense detail layout에 전달하고, 실제
  short viewport에서 버튼 영역이 겹치지 않도록 재배치.
- Sensory: user-gesture 뒤에만 시작하고 background에서 정지하는 low-volume synthesized BGM bed.
- Visual: special object/skill SVG assets, boot-vs-gameplay asset manifest, run-context preload,
  GameScene special sprite layer. Vite Pixi manual chunk로 production warning 제거.
- Cloud/Ranked: prior continuation의 strict skill-timeline/leaderboard partition/cloud Edge merge
  연결을 유지하고 Task14와 충돌 없이 확인.

### Verification

- Full local: `npm test` — 128 files / 700 tests passed.
- `npm run build`, `npm run check:edge`, `npm run check:assets`, `git diff --check`: passed.
- Production bundle: app `351.07 kB` gzip `99.00 kB`, Pixi `549.69 kB` gzip `160.58 kB`; prior
  >600 kB single-chunk warning 없음.
- Browser smoke at 390x844:
  - Home and six-mode grid rendered.
  - Home primary start entered Guided Story; a real simulated slash advanced
    `basic_slash → last_save` tutorial copy.
  - `qaMode=freeDefense&qaPreset=special` rendered special-object visual assets and ready skill HUD.
  - Free Defense detail rendered without control overlap.
  - Headless console has only Pixi `No available adapters` warning, no error.
- Production preview smoke at 390x844: built `dist` served through Vite preview rendered Home
  correctly after the Pixi manual split; after clearing the old dev-server buffer, console had no
  errors and only the same headless Pixi warning.
- `npm run preflight:release` stopped as designed at `node24_required_external` on Node 22.22.3.

### External / Unfinished Gates

- Node 24, Deno, JDK 21 are absent. Therefore Apps in Toss build/private-device, Deno type check,
  Android AAB/device QA cannot be verified locally.
- Local migrations/Edge changes are not applied/deployed in this continuation. Auth-bound cloud,
  telemetry, entitlement receipt verification, friend challenge, and public ranked need a real
  Supabase environment plus verified identity/receipt services.
- Apps in Toss/Google Play native login, Ads, IAP, store-console, and real-device evidence remain
  human/external gates. The adapter shells remain fail-closed rather than simulating a service.

---

## Implementation Continuation 9

- Date: 2026-07-11
- Actor: codex
- Stage: external gate recheck

### Read-only External Evidence

- Supabase project `dr.kang-mini-project` (`jwnuxxxthzkeiiuqopir`) is `ACTIVE_HEALTHY` and
  admin/DB read access works through the verified pooler URL.
- `supabase migration list --db-url "$SUPABASE_DB_URL"` shows the local `20260628`, `20260705`,
  `20260706`, and six `20260711` migration groups have no corresponding remote migration row.
  The latest local schema/Edge draft work is therefore not deployed.
- Current runtime: Node `v22.22.3`; `deno` is absent; `/usr/bin/java` exists only as an Apple
  launcher and reports no installed Java Runtime. Apps in Toss tooling requires Node 24; Android
  build/device proof needs a real JDK.

### Blocked Authority / External State

- Installing Node 24, Deno, and JDK 21 was not authorized in the current goal continuation.
- Applying Supabase migrations/deploying Edge Functions, configuring secrets/receipt verification,
  and running store Console/device flows are material external mutations and were not authorized.
- Local code, full tests, build, browser QA, Graphify, and release-boundary checks are complete;
  no truthful local substitute exists for the remaining remote/native/store proof.
- Cosmetics and live-ops contracts are locally/Edge ready but cannot be truthfully enabled until
  entitlements/season remote config are deployed and verified.
