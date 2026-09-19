from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("generate-orbit-bgm.py")
SPEC = importlib.util.spec_from_file_location("generate_orbit_bgm", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load BGM generator: {MODULE_PATH}")
BGM = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BGM)


class ToneContractTest(unittest.TestCase):
    def test_keeps_four_step_rhythm_below_b3_with_soft_gain_and_no_sustained_tones(self) -> None:
        self.assertEqual(BGM.ARP_STEPS_PER_BEAT, 4.0)
        self.assertLessEqual(max(BGM.ARP_NOTES), 59)
        self.assertLessEqual(BGM.ARP_GAIN, 0.072)
        self.assertFalse(BGM.CONTINUOUS_DRONE_ENABLED)
        self.assertFalse(BGM.WARNING_BEACON_ENABLED)

    def test_beat_boundaries_have_no_continuous_woo_layer(self) -> None:
        frames_per_beat = int(BGM.SAMPLE_RATE * 60 / BGM.BPM)
        boundary_samples = [BGM.synth_frame(frames_per_beat * beat) for beat in range(1, 16)]
        self.assertLessEqual(
            max(abs(sample) for stereo in boundary_samples for sample in stereo),
            4,
        )

    def test_representative_samples_are_deterministic_signed_pcm(self) -> None:
        frames = (0, 1, 7_500, 15_000, 31_999, 960_000)
        first = [BGM.synth_frame(frame) for frame in frames]
        second = [BGM.synth_frame(frame) for frame in frames]

        self.assertEqual(first, second)
        for left, right in first:
            self.assertGreaterEqual(left, -32_768)
            self.assertLessEqual(left, 32_767)
            self.assertGreaterEqual(right, -32_768)
            self.assertLessEqual(right, 32_767)


if __name__ == "__main__":
    unittest.main()
