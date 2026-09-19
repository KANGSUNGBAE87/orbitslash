# Orbit Siege Tone Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 120초 BGM의 빠른 리듬은 유지하면서 높은 삑삑 음색과 continuous drone을 제거한다.

**Architecture:** 합성기 상단에 청감 계약 상수를 노출하고 `synth_frame`의 arp/drone 레이어만 좁게 교체한다. 출력 파일 경로와 WebAudio 재생 계층은 건드리지 않고 같은 M4A를 원자적으로 재생성한다.

**Tech Stack:** Python stdlib synthesis, `unittest`, macOS `afconvert`/`afinfo`, existing Vitest audio integration

---

### Task 1: 음색 계약 테스트

**Files:**
- Create: `scripts/test_generate_orbit_bgm.py`
- Test: `scripts/generate-orbit-bgm.py`

- [x] **Step 1: Write the failing contract test**

```python
class ToneContractTest(unittest.TestCase):
    def test_keeps_four_step_rhythm_below_b3_with_no_continuous_drone(self):
        self.assertEqual(bgm.ARP_STEPS_PER_BEAT, 4.0)
        self.assertLessEqual(max(bgm.ARP_NOTES), 59)
        self.assertLessEqual(bgm.ARP_GAIN, 0.072)
        self.assertFalse(bgm.CONTINUOUS_DRONE_ENABLED)
        self.assertFalse(bgm.WARNING_BEACON_ENABLED)
```

- [x] **Step 2: Verify RED**

Run: `python3 -m unittest scripts/test_generate_orbit_bgm.py -v`

Expected: FAIL because the current generator does not expose the approved tone constants.

- [x] **Step 3: Add deterministic sampling assertions**

Test representative frames twice and require identical stereo samples inside signed 16-bit bounds.

### Task 2: arp와 drone 최소 수정

**Files:**
- Modify: `scripts/generate-orbit-bgm.py:15-118`
- Test: `scripts/test_generate_orbit_bgm.py`

- [x] **Step 1: Add approved constants**

```python
ARP_STEPS_PER_BEAT = 4.0
ARP_NOTES = (45, 52, 55, 59, 47, 52, 57, 59, 45, 52, 57, 59, 47, 52, 55, 59)
ARP_GAIN = 0.072
CONTINUOUS_DRONE_ENABLED = False
WARNING_BEACON_ENABLED = False
```

- [x] **Step 2: Replace the sharp arp wave**

Use a smooth attack envelope and triangle-like odd harmonics:

```python
arp_attack = smoothstep(min(1.0, arp_phase / 0.18))
arp_envelope = arp_attack * math.exp(-2.8 * arp_phase)
arp_wave_shape = fundamental - third / 9.0 + fifth / 25.0
```

- [x] **Step 3: Remove sustained drone and warning layers**

Keep `slow_motion` only for shimmer phase movement. Build left/right from pulse, softened arp, and the unchanged shimmer; do not add another sustained pad or siren.

- [x] **Step 4: Verify GREEN**

Run: `python3 -m unittest scripts/test_generate_orbit_bgm.py -v`

Expected: all tests PASS.

### Task 3: M4A 재생성과 회귀 검증

**Files:**
- Modify: `public/assets/audio/orbit-siege-120s.m4a`
- Modify: `ai/session-logs/2026-07-19-orbit-bgm-tone-refinement-codex.md`

- [x] **Step 1: Regenerate atomically**

Run: `python3 scripts/generate-orbit-bgm.py`

Expected: duration `120.000000s`, encoded size below 2 MiB.

- [x] **Step 2: Verify audio and app contracts**

Run: `afinfo public/assets/audio/orbit-siege-120s.m4a`

Run: `npm test -- src/feedback/WebAudioEngine.test.ts && npm run check:assets && npm run typecheck && npm run build`

Expected: stereo AAC 32kHz, 120 seconds, all commands exit 0.

- [x] **Step 3: Record the refinement**

Write the approved layer changes, RED/GREEN evidence, regenerated asset metadata, and remaining real-device listening risk to the dated session log. Do not commit or stage the dirty worktree.
