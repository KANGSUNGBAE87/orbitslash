#!/usr/bin/env python3
"""Generate Orbit Slash's deterministic 120-second looping combat BGM."""

from __future__ import annotations

import math
import re
import struct
import subprocess
import tempfile
import wave
from pathlib import Path


BPM = 128
BEATS = 256
DURATION_SECONDS = BEATS * 60 / BPM
SAMPLE_RATE = 32_000
TOTAL_FRAMES = int(DURATION_SECONDS * SAMPLE_RATE)
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "public/assets/audio/orbit-siege-120s.m4a"
AFCONVERT = Path("/usr/bin/afconvert")
AFINFO = Path("/usr/bin/afinfo")
MAX_ENCODED_BYTES = 2 * 1024 * 1024
MIN_DURATION_SECONDS = 119.5
MAX_DURATION_SECONDS = 120.5
TAU = math.tau
ARP_STEPS_PER_BEAT = 4.0
ARP_NOTES = (45, 52, 55, 59, 47, 52, 57, 59, 45, 52, 57, 59, 47, 52, 55, 59)
ARP_GAIN = 0.072
CONTINUOUS_DRONE_ENABLED = False
WARNING_BEACON_ENABLED = False


def loop_frequency(hz: float) -> float:
    """Snap a tone to a whole number of cycles across the 120-second loop."""
    return round(hz * DURATION_SECONDS) / DURATION_SECONDS


def midi_frequency(note: int) -> float:
    return loop_frequency(440.0 * 2 ** ((note - 69) / 12))


def smoothstep(value: float) -> float:
    return value * value * (3.0 - 2.0 * value)


def evolving_level(values: tuple[float, ...], beat: float) -> float:
    section_position = beat / 32.0
    section = int(section_position) % len(values)
    blend = smoothstep(section_position % 1.0)
    return values[section] + (values[(section + 1) % len(values)] - values[section]) * blend


def synth_frame(frame: int) -> tuple[int, int]:
    time = frame / SAMPLE_RATE
    beat = time * BPM / 60.0
    beat_index = int(beat) % BEATS
    beat_phase = beat % 1.0

    # Slow phase motion is reserved for the quiet metallic shimmer.
    slow_motion = math.sin(TAU * beat / 64.0)

    # Four-step-per-beat low-mid arpeggio: same urgency, softer pitch and attack.
    arp_step_position = beat * ARP_STEPS_PER_BEAT
    arp_step = int(arp_step_position)
    arp_phase = arp_step_position % 1.0
    arp_attack = smoothstep(min(1.0, arp_phase / 0.18))
    arp_release = smoothstep(min(1.0, (1.0 - arp_phase) / 0.24))
    arp_envelope = arp_attack * arp_release * math.exp(-2.8 * arp_phase)
    arp_level = evolving_level((0.5, 0.72, 0.62, 0.92, 0.68, 1.0, 0.78, 0.58), beat)
    arp_frequency = midi_frequency(ARP_NOTES[arp_step % len(ARP_NOTES)])
    arp_angle = TAU * arp_frequency * time
    arp_shape = (
        math.sin(arp_angle)
        - math.sin(arp_angle * 3.0) / 9.0
        + math.sin(arp_angle * 5.0) / 25.0
    )
    arp_wave = arp_shape * ARP_GAIN * arp_envelope * arp_level
    arp_pan = 0.5 + 0.34 * math.sin(TAU * (arp_step % 16) / 16.0)

    # Centered combat pulse. Pattern repeats every four bars and closes at beat 256.
    pulse_accents = (1.0, 0.48, 0.7, 0.42, 0.86, 0.46, 0.68, 0.58, 1.0, 0.45, 0.76, 0.42, 0.9, 0.5, 0.7, 0.62)
    pulse_envelope = math.sin(math.pi * beat_phase) * math.exp(-5.7 * beat_phase)
    pulse_frequency = midi_frequency(28) * (1.0 - 0.06 * beat_phase)
    pulse = (
        0.19
        * pulse_accents[beat_index % len(pulse_accents)]
        * pulse_envelope
        * math.sin(TAU * pulse_frequency * time)
    )

    # Deterministic metallic shimmer replaces random noise and remains loop-safe.
    shimmer_gate = math.sin(math.pi * ((beat * 2.0) % 1.0)) ** 5
    shimmer = 0.022 * shimmer_gate * (
        math.sin(TAU * loop_frequency(1_213.4) * time)
        + 0.62 * math.sin(TAU * loop_frequency(1_827.7) * time + 0.7 * slow_motion)
        + 0.38 * math.sin(TAU * loop_frequency(2_411.3) * time - 0.5 * slow_motion)
    )

    left = pulse + arp_wave * math.sqrt(1.0 - arp_pan) + shimmer * 0.78
    right = pulse + arp_wave * math.sqrt(arp_pan) + shimmer

    # Soft saturation keeps transient sums below full scale without hard clipping.
    left_sample = int(max(-0.92, min(0.92, math.tanh(left * 1.12) * 0.88)) * 32_767)
    right_sample = int(max(-0.92, min(0.92, math.tanh(right * 1.12) * 0.88)) * 32_767)
    return left_sample, right_sample


def write_pcm_wav(path: Path) -> None:
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        chunk = bytearray()
        for frame in range(TOTAL_FRAMES):
            chunk.extend(struct.pack("<hh", *synth_frame(frame)))
            if len(chunk) >= 64 * 1024:
                wav_file.writeframesraw(chunk)
                chunk.clear()
        if chunk:
            wav_file.writeframesraw(chunk)


def validate_encoded_asset(path: Path) -> float:
    encoded_bytes = path.stat().st_size
    if encoded_bytes <= 0 or encoded_bytes > MAX_ENCODED_BYTES:
        raise RuntimeError(
            f"encoded asset is {encoded_bytes} bytes; expected 1..{MAX_ENCODED_BYTES} bytes"
        )

    inspection = subprocess.run(
        [str(AFINFO), str(path)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    duration_match = re.search(r"estimated duration:\s*([0-9.]+)\s*sec", inspection)
    if not duration_match:
        raise RuntimeError("afinfo did not report an estimated duration")
    duration = float(duration_match.group(1))
    if not MIN_DURATION_SECONDS <= duration <= MAX_DURATION_SECONDS:
        raise RuntimeError(
            f"encoded duration is {duration:.6f}s; expected "
            f"{MIN_DURATION_SECONDS:.1f}..{MAX_DURATION_SECONDS:.1f}s"
        )
    return duration


def main() -> None:
    if not AFCONVERT.is_file() or not AFINFO.is_file():
        raise SystemExit("/usr/bin/afconvert and /usr/bin/afinfo are required to encode and validate AAC")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    wav_handle = tempfile.NamedTemporaryFile(prefix="orbit-siege-", suffix=".wav", delete=False)
    wav_path = Path(wav_handle.name)
    wav_handle.close()
    encoded_handle = tempfile.NamedTemporaryFile(
        prefix="orbit-siege-",
        suffix=".m4a",
        dir=OUTPUT_PATH.parent,
        delete=False,
    )
    encoded_path = Path(encoded_handle.name)
    encoded_handle.close()
    encoded_path.unlink()

    try:
        write_pcm_wav(wav_path)
        subprocess.run(
            [
                str(AFCONVERT),
                str(wav_path),
                "-o",
                str(encoded_path),
                "-f",
                "m4af",
                "-d",
                "aac",
                "-b",
                "80000",
                "-q",
                "96",
                "--no-filler",
            ],
            check=True,
        )
        encoded_duration = validate_encoded_asset(encoded_path)
        encoded_path.replace(OUTPUT_PATH)
        print(
            f"Generated {OUTPUT_PATH} "
            f"({OUTPUT_PATH.stat().st_size} bytes, {encoded_duration:.6f}s encoded duration)"
        )
    finally:
        wav_path.unlink(missing_ok=True)
        encoded_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
