# Session Log — Phase 1 QA Fixes

- Date: 2026-06-28
- Actor: codex
- Stage: implementation + qa

## User Request

서브에이전트를 활용해서 구현을 시작하고, 다음에 무엇을 해야 할지 알려 달라고 요청.

## Method

- Used `live-qa-runner` for browser QA.
- Used `reviewer` for read-only regression/code review.
- Used `game-logic-reviewer` for loop, scoring, and feel risk review.
- Main Codex integrated only the must-fix items, using TDD for pure gameplay fixes.

## Decisions

- Phase 2 should not start before Phase 1 E2E and fairness blockers are fixed.
- `heavy_asteroid.hp=3` is intentional and should be honored at runtime.
- Earth collision should consider enemy visual radius, not only the enemy center.
- Solar Lance should use first-point-to-last-point line hits, not the full gesture polyline.
- `.DS_Store`, `coverage/`, and `.gstack/` are local/generated artifacts and should stay out of commits.

## Files Changed

- `.gitignore`
  - Added `coverage/`, `.DS_Store`, and `.gstack/`.
- `src/game/ObjectManager.ts`
  - Added `applyDamage(id, amount)` so multi-HP enemies survive non-lethal hits.
- `src/game/ObjectManager.test.ts`
  - Added TDD coverage for HP damage and death.
- `src/game/CollisionSystem.ts`
  - Added `enemyTouchesImpactZone(...)` for edge-based Earth impact.
  - Added `resolveLineHits(...)` for Solar Lance line-only hit snapshots.
- `src/game/CollisionSystem.test.ts`
  - Added tests for edge-based impact and line-only hit resolution.
- `src/game/GameScene.ts`
  - Routed normal slashes through HP damage.
  - Scores/gauge/combos only when enemies are actually killed.
  - Routed Solar Lance hits through `resolveLineHits`.
  - Routed Earth collision through `enemyTouchesImpactZone`.
- `src/game/types.ts`
  - Added optional `SkillDef.hitDamage`.
- `src/data/skills.json`
  - Added `solar_lance.hitDamage = 3`.

## Verification

- `npm test -- src/game/ObjectManager.test.ts`
  - RED first: failed because `applyDamage` did not exist.
  - GREEN after implementation: 3 passed.
- `npm test -- src/game/CollisionSystem.test.ts`
  - RED first for `enemyTouchesImpactZone`: failed because function did not exist.
  - GREEN after implementation.
  - RED first for `resolveLineHits`: failed because function did not exist.
  - GREEN after implementation.
- `npm run typecheck` passed.
- `npm test` passed: 6 files, 78 tests.
- `npm run build` passed.
- Automated Chrome canvas QA:
  - Render OK.
  - No-slash collision and Game Over were confirmed by subagent.
  - Solar Lance gauge-0 did not fire.
  - Main Codex reproduced slash kill path with deterministic seed and corrected root offset; screenshot showed score `0 -> 50`.

## Remaining Risks

- Sufficient-gauge Solar Lance still needs manual/device QA because current flow does not quickly fill 80 gauge without a debug path.
- Last Save intentional success feel needs device QA and likely stronger visual feedback.
- i18n number/cooldown formatting has minor follow-up risk.
- Initial commit still needs careful staging because the repo has many untracked generated/local/project-setup files.

## Next Steps

1. Run a short owner/device QA pass for touch feel, Last Save, and Solar Lance with sufficient gauge.
2. Add a dev-only QA path or controlled test harness for Solar Lance if manual gauge filling is too slow.
3. Start Phase 2 with feedback-first polish: destruction VFX, distance multiplier feedback, Last Save feedback.
4. Then add directional cut as the first deeper judgment mechanic.
5. Prepare initial commit with a curated staging set; do not stage generated runtime artifacts.

## Promote to 지식저장소?

Not yet. Project-local implementation/QA state only.

---

## Continuation — Touch QA Harness + Feedback-First VFX

- Date: 2026-06-28
- Actor: codex
- Stage: implementation + qa

### User Request

사용자가 다음 작업으로 touch feel QA, Solar Lance 충분 게이지 확인, 필요 시 dev-only QA
harness 추가, Phase 2 feedback-first(파괴 이펙트/거리배율/Last Save 피드백 우선)를
서브에이전트와 함께 수행해 달라고 요청.

### Subagents Used

- `game-logic-reviewer`
  - Read-only로 touch feel acceptance와 feedback-first 우선순위를 검토.
  - 결론: dev-only `qaGauge/seed` harness는 적절하나, Last Save ring pulse와 Solar
    Lance ready pulse가 더 필요.
- `reviewer`
  - Read-only 코드 리뷰.
  - must-fix 없음. follow-up으로 restart burst cleanup, production bundle dev surface,
    multiplier label i18n 경로를 지적.
- `live-qa-runner`
  - Browser QA.
  - `qaGauge=100` harness와 Solar Lance 발동은 desktop/mobile에서 PASS.
  - 일반 slash/Last Save는 HMR/reload와 timing 문제로 inconclusive.

### Files Changed

- `src/game/DevQa.ts`
  - DEV URL query number parser 추가: `seed`, `qaGauge`.
- `src/game/DevQa.test.ts`
  - missing/non-finite/clamp/integer parse TDD coverage 추가.
- `src/game/GameScene.ts`
  - `import.meta.env.DEV` dev-only `?seed=` and `?qaGauge=` harness 추가.
  - hit kill 시 distance multiplier burst 연결.
  - Last Save 중심 burst 중복 억제 및 `Earth.flashLastSave()` 연결.
  - restart 시 `HitBurst.clear()` 호출.
- `src/game/HitFeedback.ts`
  - distance band별 feedback metadata 추가.
- `src/game/HitFeedback.test.ts`
  - multiplier/Last Save feedback metadata coverage 추가.
- `src/render/HitBurst.ts`
  - kill feedback ring/text burst renderer 추가.
  - restart cleanup용 `clear()` 추가.
- `src/render/HitBurst.test.ts`
  - `clear()` lifecycle test 추가.
- `src/game/Earth.ts`
  - Last Save ring event pulse 추가.
- `src/render/Hud.ts`
  - Solar Lance ready pulse 추가.
  - Pixi arc path artifact 방지용 `moveTo` 추가.
- `src/ui/hud-labels.ts`
  - `multiplierLabel()` i18n helper 추가.
- `src/ui/hud-labels.test.ts`
  - multiplier label locale formatting test 추가.
- `src/i18n/ko.json`, `src/i18n/en.json`
  - `label.multiplier` 추가.
- `src/vite-env.d.ts`
  - Vite `import.meta.env` typing 추가.
- `index.html`
  - data favicon 추가로 dev-browser `/favicon.ico` 404 제거.

### Verification

- TDD RED/GREEN:
  - `DevQa`/`HitFeedback` tests first failed because modules/shape did not exist, then passed.
  - `HitBurst.clear()` test first failed because `clear` did not exist, then passed.
  - `multiplierLabel`/updated feedback tests first failed, then passed.
- Commands:
  - `npm run typecheck` passed.
  - `npm test` passed: 10 files, 87 tests.
  - `npm run build` passed.
  - `rg "qaGauge|seed" dist/assets/index-*.js dist/index.html || true` returned no matches,
    confirming production bundle no longer exposes those query strings.
- Browser QA (main Codex, isolated port 5178):
  - `/?seed=12345&qaGauge=100`: Solar Lance full gauge visible; ready ring artifact fixed.
  - `/?seed=12345&qaGauge=0`: broad normal slash killed an enemy; score `0 -> 100`; `x1.0`
    burst visible.
  - `/?seed=12345&qaGauge=100`: Solar Lance fires through Earth and enters cooldown (`12s`).
  - Last Save direct visual proof remains inconclusive due spawn/timing difficulty.
  - Final smoke console had only Vite dev connect logs; favicon 404 removed.
- Knowledge refresh:
  - cmm `index_repository` fast succeeded.
  - `graphify update . --no-cluster` succeeded.

### Remaining Risks

- Last Save feedback code is implemented but still needs a deterministic or real-device proof case.
- Landscape/letterbox pointer hitArea should be reviewed if desktop landscape becomes a supported target.
  Current product target is mobile-first, so this is not blocking for mobile QA.
- `_debug.instantFillGauge` / `_debug.infiniteGauge` remain data flags; keep them false for any release.
- First commit still needs curated staging because the repo has no initial commit and many untracked setup/generated files.

### Next Steps

1. Run a clean real-device mobile QA pass on dev URL:
   `http://<mac-lan-ip>:5178/?seed=12345&qaGauge=100`.
2. Specifically verify Last Save with either real timing or a narrower dev-only spawn harness if manual timing stays slow.
3. If Last Save proof is still hard, add a dev-only deterministic QA spawn hook, then remove or keep it DEV-only with production bundle string check.
4. Start directional cut only after Last Save proof and feedback pass are accepted.
5. Prepare initial commit with curated staging:
   source/config/docs only; exclude `dist/`, `coverage/`, `node_modules/`, `.codebase-memory-home/`,
   `.env*`, `.DS_Store`, and local runtime files.

### Promote to 지식저장소?

Not yet. Project-local implementation/QA state only.

---

## Continuation — GitHub Pages Deployment

- Date: 2026-06-28
- Actor: codex
- Stage: release

### User Request

사용자가 GitHub에 배포해서 실제 URL로 테스트해 달라고 요청.

### Files Changed

- `.github/workflows/deploy-pages.yml`
  - GitHub Pages workflow 추가.
  - `npm ci`, `npm test`, `npm run build`, Pages artifact upload, deploy 순서.
- `.gitignore`
  - `graphify-out/`, UA generated files, `.claude/settings.local.json` 등 생성/로컬 파일 제외 추가.
- `ai/session-logs/2026-06-28-phase1-qa-fixes-codex.md`
  - 배포 결과 기록.

### GitHub Deployment

- Repository: `https://github.com/KANGSUNGBAE87/orbitslash`
- First commit pushed to `main`: `ba11a0e92a4ecae996207f98e7e8c57942170914`
- Pages source enabled as GitHub Actions workflow.
- Actions run: `https://github.com/KANGSUNGBAE87/orbitslash/actions/runs/28314065380`
- Live URL: `https://kangsungbae87.github.io/orbitslash/`

### Verification

- Before commit/push:
  - `npm run typecheck` passed.
  - `npm test` passed: 10 files, 87 tests.
  - `npm run build` passed.
- GitHub Actions:
  - `build` job passed.
  - `deploy` job passed.
- Live URL:
  - `curl -I -L https://kangsungbae87.github.io/orbitslash/` returned HTTP 200.
  - Live HTML referenced `./assets/index-D8hpCobR.js`.
  - Asset URL returned HTTP 200.
  - Headless Chrome mobile viewport `390x844` loaded a Pixi canvas with no console errors.
  - Screenshot evidence: `/tmp/orbitslash-pages-live-smoke.png`.

### Remaining Risks

- Live URL smoke confirms render, not full touch feel.
- Next QA should happen on a physical mobile device using the public Pages URL.
- Last Save proof remains the main gameplay QA gap.

### Next Steps

1. Open `https://kangsungbae87.github.io/orbitslash/` on a real phone.
2. Test normal slash feel and Solar Lance gesture on public build.
3. For Last Save proof, either wait for a natural near-Earth timing or add a DEV-only deterministic spawn harness in a follow-up.
4. If mobile public build feels acceptable, proceed to directional cut.

### Promote to 지식저장소?

Not yet. Project-local release evidence only.

---

## Continuation — Implementation Queue Batch

- Date: 2026-06-28
- Actor: codex
- Stage: implementation

### User Request

사용자가 다음 구현 큐 전체를 서브에이전트와 함께 구현해 달라고 요청:
방향 적 출현 빈도 조절, 웨이브/난이도 shaping, DEV-only QA harness, 스킬 5슬롯/다중
스킬 확장, 에셋 교체, 랭킹/백엔드 준비, 플랫폼/릴리즈 준비. 이후 DEV-only QA
harness는 QA에 포함되면 건너뛰어도 된다고 명시.

### Subagents Used

- `game-logic-reviewer`: directional enemy should be a separate low-frequency type; next real skill should be `gravity_slow`; 5th skill should stay as a reserve slot.
- `toss-compliance-auditor`: keep backend/ranking behind adapters, draft SQL only, no SDK imports from product logic, no raw Toss IDs, and no public-open RLS.
- `reviewer`: found early blockers in type narrowing, wave wiring, enemy visual wiring, and ranking integration. Main Codex corrected those before final verification.

### Files Changed

- `src/data/waves.json`, `src/game/WaveGenerator.ts`
  - Added early/mid/late weighted wave bands.
  - Opening wave excludes directional enemies; later waves introduce `directional_comet` at low frequency.
- `src/data/enemies.json`
  - Added `directional_comet`.
  - Kept `fast_comet` as a normal non-directional enemy.
- `src/game/SkillSystem.ts`, `src/game/GameScene.ts`, `src/data/skills.json`
  - Added `gravity_slow` circle gesture, cooldown, gauge cost, slow duration, VFX/banner feedback, and top HUD slot state.
  - Kept a 5th `reserve_slot` placeholder instead of inventing an unapproved skill.
- `src/render/EnemyVisual.ts`
  - Centralized procedural enemy visuals as the asset replacement boundary.
- `src/game/RunSession.ts`, `src/game/RankingSystem.ts`, `src/platform/BackendAdapter.ts`
  - Added run summary, skill-use counts, local run start token/seed, and backend adapter contract.
- `src/game/Telemetry.ts`, `src/platform/ReleaseBoundary.ts`, `scripts/check-release-boundary.mjs`
  - Added telemetry allowlist and release-boundary scan.
- `supabase/migrations/20260628_orbitslash_ranking_draft.sql`
  - Added local review-only Supabase draft tables with RLS enabled and no public-open policies.
- `ai/plans/backend-contract.md`, `ai/reviews/release-checklist.md`, `ai/reviews/review.md`
  - Recorded backend contract, release checklist, implemented items, remaining QA, and deferred QA harness.
- `.env.example`
  - Added public browser env placeholders and explicit server-secret warning.
- `/Users/kangsungbae/Documents/지식저장소/projects/orbitslash/platform.md`
  - Added cross-assistant platform note.

### Deferred

- DEV-only QA harness for deterministic Last Save/directional spawns is intentionally not implemented in this batch because Owner classified it as QA tooling.

### Verification

- `npm test` passed: 24 files / 139 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run preflight:release-boundary` passed.
- Local Chrome mobile smoke at `http://127.0.0.1:5179/?seed=20260628&qaGauge=100`:
  - Pixi canvas loaded at `412x915` CSS / `824x1830` backing pixels.
  - No console messages or page errors.
  - Smoke screenshot: `/tmp/orbitslash-implementation-queue-smoke.png`.
- cmm index status could not be read because the MCP transport returned `Transport closed`; direct source verification and tests were used instead.

### Remaining Risks Before Release

- Real-device touch/readability QA is still required for latest local changes.
- Public ranking strategy is undecided: Supabase verified ranking, Apps in Toss leaderboard, or hybrid.
- Supabase migration is a local draft only; remote apply is not done.
- Final sprites/assets are not replaced yet; only the replacement boundary is ready.
- Store release order and platform packaging need Owner confirmation plus official-doc re-check.

### Promote to 지식저장소?

Yes, lightweight platform note added at `/Users/kangsungbae/Documents/지식저장소/projects/orbitslash/platform.md`.

---

## Continuation — Remaining Issues Implementation

- Date: 2026-06-28
- Actor: codex
- Stage: implementation + backend provisioning

### User Request

사용자가 남은 핵심 이슈 전체를 서브에이전트와 함께 구현하고, 남은 QA와 추가 작업을 알려 달라고 요청.

### Subagents Used

- `game-logic-reviewer`
  - Gravity Slow reserve/close-gap risk, inactive HUD slot confusion, directional anti-streak, top-HUD spawn overlap을 지적.
- `toss-compliance-auditor`
  - Hybrid ranking strategy를 추천. Remote Supabase apply는 public ranking launch가 아니라 dormant schema provisioning일 때만 조건부 가능하다고 판단.
- `reviewer`
  - Asset swap should stay inside render boundary, telemetry must be bounded/flushed, runtime should go through backend adapter, `orbitslash_scores.run_id` uniqueness needed.

### Implemented

- Ranking strategy:
  - Added `RankingStrategy` with `hybrid:supabase_verified+apps_in_toss_leaderboard_bridge`.
  - `GameScene` now creates local run starts through `LocalBackendAdapter`.
- Remote Supabase:
  - Applied `20260628_orbitslash_ranking_draft.sql`.
  - Applied `20260628_orbitslash_ranking_hardening.sql`.
  - Verified RLS enabled, no policies, unique run score index, and no anon/authenticated direct grants.
- Gameplay QA support:
  - Fixed Gravity Slow reserve path with shared `GravitySlowReserve`.
  - Lowered Gravity Slow close ratio to `0.30`.
  - Added inactive HUD slot gauge suppression.
  - Added directional/heavy anti-streak.
  - Added top-HUD safe start-angle adjustment.
  - Added DEV QA presets: `directional`, `lastSave`, `dense`.
- Assets:
  - Added SVG enemy sprite assets under `public/assets/enemies/`.
  - Swapped enemy rendering from pure `Graphics` circles to pooled `Container(Sprite + guide overlay)`.
  - Kept collision/hitbox SSOT as `enemy.radiusPx`.
- Telemetry:
  - Added bounded local telemetry queue.
  - Flushes local telemetry on restart/end-run.
  - Removed misleading `run_submit` event from local game-over path.

### Remaining QA

- Real-device QA remains required for touch latency, slash feel, Gravity Slow success/false-positive rate, directional readability, Last Save feedback, dense VFX performance, top HUD readability, and final asset hit feel.
- Official Apps in Toss and Google Play release docs still need a fresh release-stage re-check.
- Public ranking remains disabled until Edge/server validation exists.

### Verification

- `npm test` passed: 28 files / 154 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run preflight:release-boundary` passed.
- Production bundle string check found no `qaPreset` / `qaGauge` strings in `dist`.
- Local Chrome mobile smoke at `http://127.0.0.1:5180/?seed=20260628&qaGauge=100&qaPreset=dense`:
  - Pixi canvas loaded at `412x915` CSS / `824x1830` backing pixels.
  - All five enemy SVG assets returned HTTP 200.
  - No console messages or page errors.
  - Smoke screenshot: `/tmp/orbitslash-remaining-issues-smoke.png`.
- GitHub:
  - Commit pushed: `bdd5122` (`Implement Orbit Slash balance, assets, and backend readiness`).
  - GitHub Pages workflow run `28323678650` completed successfully.
  - Live URL smoke passed at `https://kangsungbae87.github.io/orbitslash/`.
  - Live smoke screenshot: `/tmp/orbitslash-live-after-remaining-issues.png`.

---

## Continuation — Realtime Slash Judgement Tuning

- Date: 2026-06-28 16:27 KST
- Actor: codex
- Stage: implementation + qa

### User Request

사용자가 이전 touch-feel/판정 의견을 바탕으로 서브에이전트를 활용해 구현하고 GitHub에 배포해 달라고 요청.

### Subagents

- `game-logic-reviewer`: 일반 slash는 `pointermove` recent segment, Solar Lance는 release-time recognizer, 같은 stroke 중복 적중 금지, Earth visual/gameplay radius 분리, 상단 cooldown strip을 권장.
- `reviewer`: move-time hit와 pointer-up 배치 판정 중복, tap-only guard, per-stroke score/gauge semantics, HUD single-skill hardcoding 리스크를 체크리스트로 제시.

### Files Changed

- `src/game/CollisionSystem.ts`
  - `resolveLiveSegmentHits` 추가.
  - 일반 slash 전용 inflated hit radius와 same-stroke dedupe 지원.
- `src/game/GameScene.ts`
  - 일반 slash를 `pointermove` recent segment hit로 전환.
  - 킬 피드백은 즉시 보여주고, score/gauge/multi-cut은 stroke release 때 묶음 정산.
  - Solar Lance는 release-time 판정으로 유지하고, 일반 slash hit가 이미 있는 stroke에서는 발동하지 않도록 배타 처리.
  - Solar Lance 후보처럼 보이는 직선/지구관통 stroke는 move-time 일반 slash 판정을 보류.
- `src/game/gesture-helpers.ts`, `src/game/GestureSystem.ts`, `src/game/input-tuning.ts`
  - path length 계산, stroke length cap, touch tuning constants 추가.
- `src/game/coords.ts`, `src/game/Earth.ts`
  - Earth visual radius 1.3x 적용.
  - gameplay radius는 visual보다 작게 분리해 distance band/impact/Solar Lance 기준이 과하게 커지지 않게 조정.
- `src/data/enemies.json`, `src/data/skills.json`
  - 적 placeholder 크기 확대.
  - Solar Lance straightness threshold를 `0.90`으로 조정.
- `src/render/Hud.ts`
  - 하단 Solar Lance 버튼의 cooldown 숫자 표시를 제거.
  - 상단에 future skill slots용 cooldown strip 추가.
- Tests:
  - `CollisionSystem.test.ts`: live segment hit, tap/short move guard, same-stroke dedupe.
  - `gesture-helpers.test.ts`: path length and stroke trimming.

### Verification

- TDD RED:
  - `npm test -- src/game/CollisionSystem.test.ts src/game/gesture-helpers.test.ts` failed before implementation because `resolveLiveSegmentHits`, `pathLength`, and `trimPathToMaxLength` did not exist.
- GREEN and regression:
  - `npm test -- src/game/CollisionSystem.test.ts src/game/gesture-helpers.test.ts` passed: 49 tests.
  - `npm test` passed: 10 files, 93 tests.
  - `npm run typecheck` passed.
  - `npm run build` passed.
- Local Chrome mobile smoke:
  - Dev server: `http://127.0.0.1:5176/?seed=42&qaGauge=100`.
  - Canvas rendered at mobile viewport `393x852`, no page errors.
  - Normal drag smoke raised score to `130` and showed hit feedback.
  - Long Earth-crossing drag fired Solar Lance VFX and changed gauge/cooldown UI.

### Remaining Risks

- Physical device touch feel is still the real acceptance gate.
- 상단 중앙 적이 HUD 뒤를 지나가는 경우가 보였다. 이번 판정 변경 범위 밖이며 다음 HUD safe-area/spawn exclusion QA에서 다룰 후보.
- Directional cut is not implemented in this pass. The recommended next implementation is contact segment angle with full/graze/fail.

### Next Steps

1. Deploy this implementation to GitHub Pages and verify the public URL.
2. Test public build on a real phone: normal slash immediate hit, Solar Lance long line, Last Save feel.
3. If Last Save remains hard to hit naturally, add a DEV-only deterministic near-Earth spawn harness.
4. Implement directional cut enemies using contact segment angle.

### Promote to 지식저장소?

Not yet. Project-local implementation and release evidence only.

---

## Deployment Evidence — Realtime Slash Judgement Tuning

- Date: 2026-06-28 16:31 KST
- Actor: codex
- Stage: release

### GitHub Deployment

- Commit pushed to `main`: `4412072 tune realtime slash feel`
- Actions run: `https://github.com/KANGSUNGBAE87/orbitslash/actions/runs/28315156495`
- Live URL: `https://kangsungbae87.github.io/orbitslash/`

### Verification

- GitHub Actions:
  - `build` job passed.
  - `deploy` job passed.
  - Annotation: GitHub reported Node.js 20 deprecation for several actions, but the runner forced Node.js 24 and the workflow succeeded.
- Live URL:
  - Live HTML references `./assets/index-DRGit0Tv.js`.
  - `https://kangsungbae87.github.io/orbitslash/assets/index-DRGit0Tv.js` returned HTTP 200.
  - Chrome mobile viewport `393x852` loaded a Pixi canvas at `786x1704` backing resolution.
  - No console errors or page errors in public Pages smoke.

### Notes

- Public Pages is a production build, so dev-only `?qaGauge=100` is intentionally ignored. Solar Lance QA evidence for this change is from local DEV Chrome smoke.
- Public smoke confirmed render and input stability, but not physical-device touch feel.

### Next Steps

1. Open the public URL on a real phone and test touch feel.
2. Specifically test normal slash immediate hit, Last Save timing, and Solar Lance long line after naturally charging gauge.
3. If Last Save or Solar Lance setup is too slow, add a DEV-only deterministic spawn/gauge QA harness.
4. Then implement directional cut using contact segment angle.

---

## 2026-06-28 17:13 KST — Radius Separation + Same-Stroke Rehit + Non-Lethal Feedback

User request:
- Use subagents, implement the discussed hit-feel changes, and deploy to GitHub.

Subagent:
- `game-logic-reviewer` checked the proposed logic. It agreed that larger visual/slash radii improve feel, but flagged risks around heavy asteroid difficulty, visual-vs-Earth-contact mismatch, and Solar Lance being preempted by move-time hits.
- Incorporated the review by keeping the Owner-requested 2.2x radii, while setting same-stroke rehit cooldown to a more conservative `80ms`.
- `reviewer` blocked the first pass because Solar Lance live reservation still ran after an early hit, which could stop later normal hit/rehit checks in the same stroke.
- Fixed the block by extracting `shouldReserveLiveSlashForSolarLance(...)` and returning `false` once `strokeHadHit` is true.

Decisions made:
- Enemy `radiusPx` now represents visual/slash hit size only.
- Earth impact uses a separate `earthImpactRadiusPx`, defaulting to `EARTH_BODY_DIAMETER / 10` (`13px`) so larger enemies do not damage Earth early just because their sprite/hitbox grew.
- Same-stroke repeated damage is allowed only after the pointer exits the hitbox plus margin, then enters again after cooldown. Re-arm happens after the current segment is resolved, so slow exit segments do not count as re-entry.
- Live slash and Solar Lance hitboxes now include the same visual scale used by enemy rendering, so sprite bounds and slash bounds stay aligned.
- Non-lethal hits now shake/scale the enemy sprite, so HP remains visible through feedback rather than silence.

Files changed:
- `src/data/enemies.json`
- `src/game/CollisionSystem.ts`
- `src/game/Enemy.ts`
- `src/game/GameScene.ts`
- `src/game/StrokeHitTracker.ts`
- `src/game/HitShake.ts`
- `src/game/SolarLanceReserve.ts`
- `src/game/coords.ts`
- `src/game/input-tuning.ts`
- `src/game/types.ts`
- tests under `src/game/*.test.ts`

Verification:
- `npm test`: 14 files, 105 tests passing.
- `npm run build`: TypeScript + Vite production build passing.
- Local Chrome smoke at `http://127.0.0.1:5173/?qaGauge=100&seed=1234`: one canvas fills mobile viewport, no page errors.

Remaining risks:
- Heavy asteroid at 2.2x (`128px`) may become too easy if same-stroke zig-zagging feels too forgiving.
- Very small Earth contact radius may feel late if a huge asteroid visually overlaps Earth before impact. This needs real phone QA.
- Solar Lance should be tested again on the public build because normal hitboxes are now larger.

Next steps:
1. Deploy to GitHub Pages and verify the public URL.
2. Test on a real phone: heavy multi-hit re-entry, non-lethal shake, Last Save timing, Solar Lance with full gauge.
3. If heavy becomes too easy, tune only `heavy_asteroid.radiusPx` down to `104~116` or raise rehit cooldown to `100~120ms`.

---

## Deployment Evidence — Slash Hit Feel Tuning

- Date: 2026-06-28 17:24 KST
- Actor: codex
- Stage: release

### GitHub Deployment

- Commit pushed to `main`: `5853293 tune slash hit feel`
- Actions run: `https://github.com/KANGSUNGBAE87/orbitslash/actions/runs/28316405276`
- Live URL: `https://kangsungbae87.github.io/orbitslash/`

### Verification

- GitHub Actions:
  - `build` job passed.
  - `deploy` job passed.
  - Annotation: GitHub reported Node.js 20 deprecation for several actions, but the runner forced Node.js 24 and the workflow succeeded.
- Live URL:
  - `curl -I -L https://kangsungbae87.github.io/orbitslash/` returned HTTP 200.
  - Live HTML references `./assets/index-BA-VRIhK.js`.
  - Chrome mobile viewport `412x915` loaded a Pixi canvas covering the viewport.
  - No console errors or page errors in public Pages smoke.

### Notes

- Public smoke confirms deployment/render stability, not physical-device touch feel.
- Real-phone QA remains the acceptance gate for heavy same-stroke rehit feel, non-lethal shake strength, Last Save timing, and Solar Lance with full gauge.

### Next Steps

1. Open the public URL on a real phone and test heavy multi-hit re-entry.
2. Test Solar Lance after gauge is naturally full; if it is still hard to set up, add a DEV-only deterministic gauge/spawn harness.
3. If heavy feels too easy, first raise `SAME_STROKE_REHIT_COOLDOWN_MS` to `100~120`, then consider lowering only `heavy_asteroid.radiusPx` to `104~116`.

---

## 2026-06-28 17:40 KST — Combo Chain Timeout

User request:
- Implement a rule so combo does not keep chaining indefinitely while a long drag continues.

Decision:
- Added `comboChainTimeoutMs = 650`.
- A kill within `650ms` of the previous combo kill continues the combo.
- A kill at `650ms` or later starts a fresh combo, even if it came from the same stroke.
- Same-stroke re-entry hit remains valid; only combo chaining is time-gated.

Files changed:
- `src/data/scoring.json`
- `src/game/ComboTiming.ts`
- `src/game/ScoringSystem.ts`
- `src/game/GameScene.ts`
- `src/game/types.ts`
- `src/game/ComboTiming.test.ts`
- `src/game/ScoringSystem.test.ts`

Verification:
- TDD RED: `npm test -- src/game/ScoringSystem.test.ts src/game/ComboTiming.test.ts` failed because combo continued to `2` after `650ms` and `ComboTiming` did not exist.
- GREEN: target tests passed, 26 tests.
- Regression: `npm test` passed, 15 files / 109 tests.
- Build: `npm run build` passed.

Next steps:
1. Real-phone QA for `650ms` combo timeout feel.
2. If combo feels too strict, raise to `750ms`; if long-drag combo still feels too easy, lower to `550~600ms`.

---

## 2026-06-28 18:00 KST — Directional Cut First Pass

User request:
- Confirm whether directional slash was already implemented, then move to the next work.

Finding:
- Directional slash was not implemented yet. The project had `directional` data fields and scoring multipliers, but all hits were still emitted as `accuracy: "normal"`.

Decision:
- Implemented the first directional cut pass without deploying.
- `fast_comet` is now the first directional enemy.
- Directional enemies get a visible cyan cut guide line.
- A segment whose orientation matches the enemy's required slash angle within tolerance returns `accuracy: "directional"`.
- Wrong-direction contact is rejected, so it does not damage the enemy.
- Directional hits add `gaugeGain.directionalCut` on top of the enemy's normal gauge gain.

Files changed:
- `src/data/enemies.json`
- `src/game/DirectionalCut.ts`
- `src/game/CollisionSystem.ts`
- `src/game/Enemy.ts`
- `src/game/GameScene.ts`
- `src/game/ScoringSystem.ts`
- `src/game/types.ts`
- related tests under `src/game/*.test.ts`

Verification:
- TDD RED: directional tests failed because `DirectionalCut` did not exist, enemy directional state was undefined, collisions stayed `accuracy: "normal"`, and directional gauge was missing.
- GREEN: targeted tests passed, 6 files / 74 tests.
- Regression: `npm test` passed, 16 files / 117 tests.
- Build: `npm run build` passed.
- Local Chrome smoke at `http://127.0.0.1:5173/?qaGauge=100&seed=1234`: one canvas fills mobile viewport, no page errors.

Remaining risks:
- `fast_comet` now being directional may be too frequent because enemy type selection is currently uniform.
- Wrong-direction rejection has no dedicated fail feedback yet.

Next steps:
1. Local/phone QA directional fast_comet visibility and strictness.
2. If it appears too often, add spawn weighting or split a lower-frequency directional enemy type.
3. Next Phase 2 work: destruction VFX, distance multiplier feedback, and stronger Last Save feedback.

---

## 2026-06-28 19:05 KST — Phase 2 Feedback + Directional Cut Hardening

User request:
- Continue items 3 and 4 using subagents.
- No GitHub deployment needed.

Subagent:
- `game-logic-reviewer` reviewed current combo/directional/feedback risk.
- Main finding adopted immediately: default directional slash angle must follow the enemy's current orbit tangent, not only the spawn angle.
- Additional adopted feedback: wrong-direction contact should show a weak reject effect instead of feeling like ignored input.
- `reviewer` performed a final read-only diff review.
- Reviewer finding adopted immediately: wrong-direction reject feedback must still appear when the same segment also hits another enemy successfully.

Decisions:
- Added `DestructionBurst` as a separate Pixi explosion layer so score text/rings and particle destruction stay decoupled.
- Distance multiplier feedback now scales by band: closer bands get larger label/ring/particle feedback; Last Save is the strongest.
- Last Save now triggers a larger Earth-centered particle wave plus a stronger text/ring pulse.
- Default directional enemies now require the current orbit tangent slash angle; explicit `directionalSlashAngleDeg` remains a fixed data override.
- Directional guide lines redraw while the enemy moves so the visible guide and hit rule stay aligned.
- Wrong-direction directional contact emits one short grey/cyan reject burst per enemy per stroke. It still deals no damage and gives no score.
- Solar Lance line hits now have regression coverage for directional success/reject because they use `resolveLineHits`.

Files changed:
- `src/render/DestructionBurst.ts`
- `src/render/DestructionBurst.test.ts`
- `src/render/HitBurst.ts`
- `src/render/HitBurst.test.ts`
- `src/game/HitFeedback.ts`
- `src/game/HitFeedback.test.ts`
- `src/game/DirectionalCut.ts`
- `src/game/DirectionalCut.test.ts`
- `src/game/CollisionSystem.ts`
- `src/game/CollisionSystem.test.ts`
- `src/game/Enemy.ts`
- `src/game/Enemy.test.ts`
- `src/game/GameScene.ts`

Verification:
- Targeted tests passed: 6 files / 55 tests.
- Regression: `npm test` passed, 17 files / 126 tests.
- Build: `npm run build` passed.
- Local Chrome mobile smoke at `http://127.0.0.1:5173/?qaGauge=100&seed=1234`: one canvas fills `412x915`, no page errors or console errors.

Remaining risks:
- Wrong-direction contact still counts as a failed slash if no enemy is killed in the stroke. This is intentional for now, but needs phone feel QA.
- Fast comet frequency may still make directional enemies feel too common because spawning is not yet weighted.

Next steps:
1. Real-phone QA for Last Save visibility, destruction noise level, directional guide readability, and wrong-direction reject feel.
2. If directional enemies feel too common, add spawn weighting or introduce a dedicated low-frequency directional enemy.
3. Then start the next gameplay feature: additional skills or spawn/wave difficulty shaping, depending on which QA pain is stronger.

---

## 2026-06-28 19:25 KST — QA and Implementation Backlog Saved

User request:
- Save all deferred QA items as todos, and include the following implementation work beyond only the immediate next step.

Decision:
- Created the canonical review/readiness backlog at `ai/reviews/review.md`.
- Split it into:
  - P0/P1 real-device QA backlog.
  - Directional cut, Last Save, Solar Lance, VFX, combo, heavy re-entry, HUD overlap, and impact-feel checks.
  - Ordered implementation backlog after QA: directional enemy frequency tuning, wave/difficulty shaping, DEV-only QA harness, skill expansion, asset replacement, backend/ranking readiness, platform release readiness.

Verification:
- Documentation-only change. No tests needed.

Next steps:
1. Continue implementation from `ai/reviews/review.md`, starting with directional enemy frequency tuning unless Owner chooses a different item.

---

## 2026-06-28 22:47 KST — Enemy Size and HP Retune

User request:
- Apply the recommended enemy retune because planets still feel too small and one-cut kills are too fast.
- Confirm whether orbit rotation directions are mixed and what the current maximum hit count is.

Decisions:
- Increased enemy visual/slash `radiusPx` by roughly 1.5x from the current data.
- Kept Earth impact radius behavior separate; this change affects visible enemy size and slash/touch hit feel, not Earth collision size.
- Raised HP from mostly one-cut values to tiered values:
  - `small_meteor`: 2
  - `basic_meteor`: 4
  - `fast_comet`: 4
  - `directional_comet`: 6
  - `heavy_asteroid`: 8
- Added a data-level balance test so the new mobile touch-feel and HP contract cannot silently regress.
- Verified orbit profiles are still mixed: 5 `dir: 1` and 5 `dir: -1`.

Files changed:
- `src/data/enemies.json`
- `src/game/EnemyBalance.test.ts`

Verification:
- RED check passed before implementation: `npm test -- src/game/EnemyBalance.test.ts` failed on old radius/HP values.
- Targeted test passed after implementation: `npm test -- src/game/EnemyBalance.test.ts`.
- Full regression passed: `npm test` passed, 29 files / 156 tests.
- Build passed: `npm run build`.
- cmm project index refreshed with `index_repository` fast mode.

Remaining risks:
- Real-device feel may now shift from "too easy to kill" toward "too much HP" because scoring and gauge gain still primarily happen on kill.
- Solar Lance currently deals multi-damage, so it may still erase some high-HP enemies faster than ordinary slashes. This is probably desirable, but needs touch QA after the retune.
- Larger visual/slash radius can make dense waves feel more forgiving; wave density and scoring may need the next balance pass.

Next steps:
1. Real-phone QA for new enemy size, heavy HP pacing, directional comet 6-hit feel, and Solar Lance value.
2. If kills feel too slow, tune score/gauge feedback or add stronger non-lethal crack/flash feedback before lowering HP.
3. Next implementation candidate: score/gauge reward scaling for high-HP enemies, then wave density shaping.

---

## 2026-06-28 23:14 KST — Wave Gauge, 8-Tier Enemies, Boss Scaffold, and Skill HUD

User request:
- Use subagents and implement all feasible items from the current gameplay queue.
- Add a wave gauge and make waves progress every 10 seconds.
- Add all feasible work from Solar Lance strengthening, 8 enemy tiers, top 5-slot skill HUD, high-HP feedback, boss scaffold, and wave/difficulty shaping.
- Boss should appear every 60 seconds with fixed speed and should not stop normal planets from spawning.
- Assets can be added later; implement with current/procedural assets for now.

Subagents:
- `game-logic-reviewer` reviewed balance risks. Adopted: 8-tier data, 10-second wave cadence, 60-second independent boss cadence, fixed boss speed, kill-reward gauge scaling, first boss as scaffold rather than final weak-point boss. Adjusted from earlier 60HP idea to a safer 24HP first boss.
- `ui-fixer` reviewed HUD layout. Adopted: two-row top HUD, large 5-slot row, slot orb diameter near Earth visual size, ready pulse/shine, and wave gauge under the skill row.
- `reviewer` final diff review was requested after implementation.

Decisions:
- Added 8 normal enemy tiers with HP `1/3/5/7/9/11/13/15`:
  - `shard_meteor`, `small_meteor`, `basic_meteor`, `fast_comet`, `iron_planet`, `directional_comet`, `heavy_asteroid`, `ancient_planet`.
- Added first boss scaffold `eclipse_core`:
  - `hp=24`, `damage=20`, `score=1200`, `radiusPx=260`, `approachSpeed=24`.
  - `boss=true`, `ignoreSpeedScale=true`.
- Wave bands now advance every 10 seconds and include increasing spawn speed and enemy mix.
- Boss spawns every 60 seconds through `WaveGenerator` independently from normal spawns.
- Solar Lance:
  - `hitDamage` raised from 3 to 5.
  - hit inflate now uses Earth visual diameter.
  - VFX width now uses Earth visual diameter x2.
- Replaced the tiny top cooldown strip / bottom single skill button with a large top 5-slot skill HUD.
- Added wave gauge below the skill row.
- Added enemy `maxHp` and crack/flash overlay so high-HP non-lethal hits are visible.
- New enemy visual types reuse existing SVG assets for now and differentiate via procedural style/overlay.

Files changed:
- `ai/reviews/review.md`
- `src/data/enemies.json`
- `src/data/scoring.json`
- `src/data/skills.json`
- `src/data/waves.json`
- `src/game/Enemy.ts`
- `src/game/GameScene.ts`
- `src/game/ScoringSystem.test.ts`
- `src/game/SkillCooldownSlots.ts`
- `src/game/SkillCooldownSlots.test.ts`
- `src/game/WaveGenerator.ts`
- `src/game/WaveGenerator.test.ts`
- `src/game/input-tuning.ts`
- `src/game/types.ts`
- `src/i18n/en.json`
- `src/i18n/ko.json`
- `src/render/EnemyVisual.ts`
- `src/render/Hud.ts`
- `src/render/LaserVfx.ts`
- `src/game/EnemyBalance.test.ts`
- `src/game/SolarLanceBalance.test.ts`
- `src/render/HudLayout.test.ts`

Verification:
- RED check passed before implementation for new enemy tiers, wave HUD helper, boss cadence, Solar Lance range, and top HUD layout.
- Targeted tests passed: `npm test -- src/game/EnemyBalance.test.ts src/game/WaveGenerator.test.ts src/game/SolarLanceBalance.test.ts src/render/HudLayout.test.ts src/game/SkillCooldownSlots.test.ts`.
- Full regression passed: `npm test` passed, 31 files / 164 tests.
- Build passed: `npm run build`.

Remaining risks:
- Real-device QA is required for 8-tier HP pacing, especially `11/13/15` HP enemies.
- First boss is a whole-body scaffold, not final weak-point/multi-part boss behavior.
- Boss slow resistance is not implemented; Gravity Slow currently affects global movement.
- Non-lethal hit rewards remain kill-centered. If high-HP enemies feel slow, chip score/gauge may be needed later.
- Top HUD safe-area/notch handling was not added in this batch; current layout uses base-coordinate spawn safety and needs mobile QA.
- Real boss/additional tier art assets are still deferred.

Next steps:
1. Real-phone QA for top 5-slot HUD readability, wave gauge, 60-second boss arrival, Solar Lance width, and 8-tier pacing.
2. If HP pacing feels slow, add chip reward or reduce late-tier HP before adding deeper boss systems.
3. If boss scaffold feels good, implement weak points / multi-part boss behavior and final boss assets.

### Reviewer Follow-Up

Subagent review findings fixed after the first implementation pass:
- Boss/normal spawn determinism: `WaveGenerator.next()` now emits normal and boss spawns in chronological order, so one long call and split frame calls produce the same seeded sequence.
- Top HUD spawn safety: large enemies now use a radius-aware top safe band so 260px-class boss/large planets do not start under the wave/skill HUD.
- HUD localization: cooldown/wave seconds text now uses i18n labels instead of hard-coded `s`.
- Regression coverage: added/expanded tests for repeated boss schedule, boss fixed speed, large-enemy top safe bounds, Solar Lance range/VFX width/damage, and 5-slot HUD layout.

Verification after reviewer fixes:
- Targeted: `npm test -- src/game/WaveGenerator.test.ts src/game/SolarLanceBalance.test.ts src/render/HudLayout.test.ts` passed, 18 tests.
- Full regression: `npm test` passed, 31 files / 167 tests.
- Build: `npm run build` passed.
- Release boundary: `npm run preflight:release-boundary` passed.

Still not implemented:
- Final boss weak points / multi-part boss behavior. Reason: the current request can be satisfied with a first boss scaffold, while weak points need separate gameplay rules, VFX, scoring, and QA acceptance.
- Final boss/enemy art assets. Reason: Owner said assets will be added later, so this batch only prepared/reused visual boundaries.
- Boss-specific Gravity Slow resistance. Reason: not explicitly requested in this batch and it changes skill balance; left as a tuning follow-up after phone QA.

---

## 2026-06-28 Late KST — Enemy Asset Pass and 50-Hit Boss Image

User request:
- Use the provided image as the first boss planet.
- Apply images to all remaining enemy tiers; create missing assets where needed.
- Preserve/strengthen crack and sparkle hit readability.
- Use subagents for implementation support.

Subagents:
- `ui-fixer` read-only asset review:
  - Recommended `shard-meteor.svg`, `iron-planet.svg`, `ancient-planet.svg`, and `eclipse-core.png`.
  - Recommended keeping crack/sparkle as runtime overlays rather than baking all damage states into assets.
  - Warned against excessive detail for small enemies.
- `game-logic-reviewer` read-only balance review:
  - `hp=50` is acceptable for scaffold boss.
  - `radiusPx=340` is acceptable as a temporary upper bound, but it increases hit generosity more than difficulty.
  - Immediate follow-up should be boss HP/remaining-hit UI, boss arrival warning, and stronger non-lethal feedback.

Decisions:
- First boss `eclipse_core` now uses the user-provided image, processed into a 1024x1024 transparent PNG.
- All 8 normal enemy tiers plus the boss now have unique asset URLs.
- Missing assets were created as repo-native SVGs:
  - `shard-meteor.svg`: sharp broken shard meteor.
  - `iron-planet.svg`: metal-panel planet with blue rim.
  - `ancient-planet.svg`: purple/gold relic planet.
- Boss scaffold changed from `hp=24`, `radiusPx=260` to `hp=50`, `radiusPx=340`.
- Type-colored crack/sparkle tokens were added and used by runtime hit overlays.

Files changed:
- `public/assets/enemies/shard-meteor.svg`
- `public/assets/enemies/iron-planet.svg`
- `public/assets/enemies/ancient-planet.svg`
- `public/assets/enemies/eclipse-core.png`
- `src/data/enemies.json`
- `src/render/EnemyVisual.ts`
- `src/render/EnemyVisual.test.ts`
- `src/game/GameScene.ts`
- `src/game/EnemyBalance.test.ts`
- `ai/reviews/review.md`
- `ai/session-logs/2026-06-28-phase1-qa-fixes-codex.md`

Verification:
- TDD RED:
  - `npm test -- src/game/EnemyBalance.test.ts src/render/EnemyVisual.test.ts` failed on old boss HP, reused asset URLs, and missing crack/sparkle tokens.
- Targeted GREEN:
  - `npm test -- src/game/EnemyBalance.test.ts src/render/EnemyVisual.test.ts` passed, 7 tests.
- Full regression:
  - `npm test` passed, 31 files / 168 tests.
- Build:
  - `npm run build` passed.
- Release boundary:
  - `npm run preflight:release-boundary` passed.
- Asset validation:
  - `eclipse-core.png` alpha corners are transparent, alpha bbox is inside the canvas, and dist copy includes all 9 enemy assets.
- Browser smoke:
  - Clean dev server `http://127.0.0.1:5179/?seed=1234&qaPreset=dense&qaGauge=100`.
  - Mobile viewport canvas rendered `390x844`.
  - All 9 enemy assets returned 200 with image content types.
  - No page errors or request failures.

Remaining risks:
- `5174` had multiple Vite processes and served asset URLs as HTML fallback. Use clean port `5179` for this session's local QA unless old servers are cleaned up.
- 50-hit boss still lacks a boss HP bar / remaining-hit display.
- Boss arrival warning/banner is still missing.
- Boss special ranges, weak points, and real patterns are deferred by user decision.
- Large `radiusPx=340` makes the boss easier to hit; QA should confirm it feels like a boss rather than a huge sponge.

Next steps:
1. Add boss arrival warning and boss HP/remaining-hit indicator.
2. Then tune 7-second waves and Solar Lance charge access.
3. Then implement real boss pattern or Orbital Cut, depending on the next gameplay priority.

---

## 2026-06-29 00:28 KST — Live Slash Immediate Rewards

User request:
- Continuous drawing should still charge Solar Lance. If the player keeps dragging and kills enemies, the gauge should rise at kill time instead of waiting until the finger is lifted.

Decision:
- Keep hit detection live on `pointermove`.
- Commit kill rewards immediately for live slash kills by calling `commitKills(kills, earth, true)` inside `resolveLiveSlashSegment`.
- Do not wait for pointer release to award score/gauge for those kills.
- Keep `strokeKills` empty for live-committed kills so pointer release does not double-count them.
- Existing combo timeout remains the combo chain gate; this change only fixes reward timing.

Files changed:
- `src/game/GameScene.ts`
- `src/game/GameSceneLiveRewards.test.ts`
- `ai/reviews/review.md`
- `ai/session-logs/2026-06-28-phase1-qa-fixes-codex.md`

Verification:
- TDD RED: `npm test -- src/game/GameSceneLiveRewards.test.ts` failed before implementation because `commitKills` was not called during live slash kill resolution.
- Targeted GREEN: `npm test -- src/game/GameSceneLiveRewards.test.ts` passed.
- Full regression: `npm test` passed, 32 files / 169 tests.
- Build: `npm run build` passed.
- Release boundary: `npm run preflight:release-boundary` passed.
- Production bundle string check: no `qaPreset` / `qaGauge` strings found in `dist`.

Remaining risks:
- Physical-device QA should confirm the gauge rise is visible enough while the finger is still moving.
- Boss HP/remaining-hit UI and boss arrival warning remain next gameplay readability work.
