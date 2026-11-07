#!/usr/bin/env python3
"""Downscale generated idle effects and remove faint edge/color artifacts."""

import argparse
from math import sqrt
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]


def clean_alpha(value: int, maximum: int) -> int:
    if value < 8:
        return 0
    return min(maximum, round(value * maximum / 240))


def make_fx_readable_at_16(image: Image.Image) -> Image.Image:
    """Clean the generated four-point silhouette and make it read on wax and gold."""
    source = image.load()
    core = Image.new("L", (1024, 1024))
    mask = core.load()
    for y in range(1024):
        for x in range(1024):
            _, _, blue, alpha = source[x, y]
            whiteness = max(0.0, min(1.0, (blue - 135) / 75))
            solidity = max(0.0, min(1.0, (alpha - 150) / 95))
            mask[x, y] = round(sqrt(whiteness * solidity) * 255)

    # The generated star's white points are tiny when a 1024 canvas is shown at 16 px.
    # Enlarge just that same generated silhouette; the canvas and centre stay fixed.
    core = core.filter(ImageFilter.MedianFilter(5))
    core = core.crop((412, 412, 612, 612)).resize((480, 480), Image.Resampling.LANCZOS)
    core = core.filter(ImageFilter.GaussianBlur(5))
    mask = core.load()
    result = Image.new("RGBA", (1024, 1024))
    pixels = result.load()

    def smoothstep(low: float, high: float, value: float) -> float:
        t = max(0.0, min(1.0, (value - low) / (high - low)))
        return t * t * (3 - 2 * t)

    for y in range(1024):
        for x in range(1024):
            distance_sq = (x - 512) ** 2 + (y - 512) ** 2
            radius = sqrt(distance_sq)
            # The cubic falloff reaches zero gently: no round disc boundary.
            bloom = round(90 * max(0.0, 1.0 - (radius / 240) ** 2) ** 3)
            source_star = mask[x - 272, y - 272] if 272 <= x < 752 and 272 <= y < 752 else 0
            star = round(255 * smoothstep(12, 170, source_star))
            alpha = max(star, bloom)
            # White core for contrast on the tin; brass tint grows toward points and bloom.
            light = smoothstep(20, 200, star)
            pixels[x, y] = (
                round(201 + 54 * light), round(161 + 88 * light),
                round(90 + 149 * light), alpha,
            )
    return result


def finish(source: Path, destination: Path, kind: str) -> None:
    image = Image.open(source).convert("RGBA")
    if image.width < 1024 or image.height < 1024 or image.width != image.height:
        raise ValueError(f"Expected a square generated image at least 1024 px: {source}")
    if image.size != (1024, 1024):
        image = image.resize((1024, 1024), Image.Resampling.LANCZOS)

    if kind == "fx":
        image = make_fx_readable_at_16(image)
    else:
        pixels = image.load()
        for y in range(1024):
            for x in range(1024):
                _, _, _, alpha = pixels[x, y]
                alpha = clean_alpha(alpha, 179)  # about 70% opacity at the peak
                # Keep the generated shape; remove the colored fringe around a glass-white glint.
                blue_mix = min(1.0, alpha / 179)
                red = round(220 + 35 * blue_mix)
                green = round(232 + 23 * blue_mix)
                blue = round(242 + 13 * blue_mix)
                pixels[x, y] = (red, green, blue, alpha)

    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination)
    print(f"{kind}: {source.name} -> {destination.relative_to(ROOT)}; size {image.width}x{image.height}; alpha {image.getchannel('A').getextrema()}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dome-raw", type=Path)
    parser.add_argument("--fx-raw", type=Path)
    args = parser.parse_args()
    if not args.dome_raw and not args.fx_raw:
        parser.error("Supply --dome-raw, --fx-raw, or both")
    if args.dome_raw:
        finish(args.dome_raw, ROOT / "vessels" / "vessel-dome-glint.png", "dome")
    if args.fx_raw:
        finish(args.fx_raw, ROOT / "fx" / "fx-glint.png", "fx")


if __name__ == "__main__":
    main()
