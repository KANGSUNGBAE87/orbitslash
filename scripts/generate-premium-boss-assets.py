#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "enemies" / "eclipse-core.png"
OUT_DIR = ROOT / "public" / "assets" / "enemies"


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.removeprefix("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def alpha_glow(alpha: Image.Image, color: tuple[int, int, int], blur: int, strength: float) -> Image.Image:
    mask = alpha.filter(ImageFilter.GaussianBlur(blur)).point(lambda p: min(255, int(p * strength)))
    glow = Image.new("RGBA", alpha.size, (*color, 0))
    glow.putalpha(mask)
    return glow


def grade(
    source: Image.Image,
    *,
    shadow: str,
    mid: str,
    light: str,
    blend: float,
    color: float,
    contrast: float,
    brightness: float,
    glow: str,
    glow_strength: float,
) -> Image.Image:
    base = source.convert("RGBA")
    alpha = base.getchannel("A")
    gray = ImageOps.grayscale(base)
    colorized = ImageOps.colorize(gray, black=shadow, mid=mid, white=light).convert("RGBA")
    mixed = Image.blend(base, colorized, blend)
    mixed = ImageEnhance.Color(mixed).enhance(color)
    mixed = ImageEnhance.Contrast(mixed).enhance(contrast)
    mixed = ImageEnhance.Brightness(mixed).enhance(brightness)
    mixed.putalpha(alpha)

    canvas = Image.new("RGBA", mixed.size, (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, alpha_glow(alpha, hex_rgb(glow), 34, glow_strength * 0.2))
    canvas = Image.alpha_composite(canvas, alpha_glow(alpha, hex_rgb(glow), 12, glow_strength * 0.1))
    canvas = Image.alpha_composite(canvas, mixed)
    return canvas


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    variants = {
        "ringed-destroyer.png": {
            "shadow": "#090b12",
            "mid": "#364052",
            "light": "#ffb066",
            "blend": 0.18,
            "color": 1.14,
            "contrast": 1.1,
            "brightness": 1.0,
            "glow": "#38dff8",
            "glow_strength": 0.95,
        },
        "lava-titan.png": {
            "shadow": "#120507",
            "mid": "#7f1d1d",
            "light": "#ffd166",
            "blend": 0.42,
            "color": 1.32,
            "contrast": 1.18,
            "brightness": 1.03,
            "glow": "#ff4500",
            "glow_strength": 1.12,
        },
        "ice-colossus.png": {
            "shadow": "#031526",
            "mid": "#2563eb",
            "light": "#e0f7ff",
            "blend": 0.5,
            "color": 0.92,
            "contrast": 1.08,
            "brightness": 1.08,
            "glow": "#7dd3fc",
            "glow_strength": 1.0,
        },
        "dark-planet.png": {
            "shadow": "#020617",
            "mid": "#4c1d95",
            "light": "#f0abfc",
            "blend": 0.5,
            "color": 1.18,
            "contrast": 1.22,
            "brightness": 0.86,
            "glow": "#a855f7",
            "glow_strength": 1.05,
        },
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, options in variants.items():
        image = grade(source, **options)
        image.save(OUT_DIR / filename, optimize=True)


if __name__ == "__main__":
    main()
