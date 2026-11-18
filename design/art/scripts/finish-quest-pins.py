#!/usr/bin/env python3
"""Cut one quest pin window and make the three colors from the same sprite."""

import argparse
from math import hypot
from pathlib import Path

from PIL import Image

ART = Path(__file__).resolve().parents[1]
SIZE = 1024
WINDOW = {"x": 506, "y": 399, "radius": 237}
TIP = {"x": 506, "y": 955}
BLUE = ("16263f", "2f5d8a", "5a8fd0")
BRASS = ("684827", "c9a15a", "efd7a1")


def lightness(rgb):
    return (max(rgb) + min(rgb)) / 2


def parse_rgb(hex_color):
    return tuple(bytes.fromhex(hex_color))


def mix(first, second, amount):
    return tuple(round(a + (b - a) * amount) for a, b in zip(first, second))


def ramp_color(ramp, level):
    t = max(0, min(1, level)) * 2
    return mix(ramp[0], ramp[1], t) if t < 1 else mix(ramp[1], ramp[2], t - 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Original generated blue frame")
    args = parser.parse_args()
    frame = Image.open(args.source).convert("RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    gem = Image.open(ART / "game/waypost-gem.png").convert("RGBA")
    plum_pixels = sorted((p[:3] for p in gem.getdata() if p[3] >= 200), key=lightness)
    plum = [plum_pixels[round(fraction * (len(plum_pixels) - 1))] for fraction in (.02, .50, .98)]
    ramps = {"blue": list(map(parse_rgb, BLUE)), "brass": list(map(parse_rgb, BRASS)), "plum": plum}

    cx, cy, radius = WINDOW["x"], WINDOW["y"], WINDOW["radius"]
    original = list(frame.getdata())
    facet_lightness = sorted(
        lightness((r, g, b))
        for i, (r, g, b, a) in enumerate(original)
        if a >= 200 and b - r > 16 and hypot(i % SIZE - cx, i // SIZE - cy) > radius + 21
    )
    low, high = [facet_lightness[round(fraction * (len(facet_lightness) - 1))] for fraction in (.01, .99)]
    outputs = {color: [] for color in ramps}
    for i, (r, g, b, a) in enumerate(original):
        x, y = i % SIZE, i // SIZE
        distance = hypot(x + .5 - cx, y + .5 - cy)
        edge = max(0, min(1, distance - radius + .5))
        # Remove faint color from the transparent surround without leaving a hard edge.
        alpha = round(max(0, a - 11) * 255 / 244 * edge)
        if not alpha:
            for pixels in outputs.values():
                pixels.append((0, 0, 0, 0))
            continue
        level = (lightness((r, g, b)) - low) / (high - low)
        # Preserve the light bevel hue. Fill its innermost band so the exact circle
        # has a continuous rim even where the generated inset was slightly oval.
        if distance <= radius + 4 or (distance <= radius + 16 and b - r < 14):
            rim = mix((208, 190, 153), (249, 239, 214), max(0, min(1, lightness((r, g, b)) / 255)))
            for pixels in outputs.values():
                pixels.append((*rim, alpha))
        else:
            for color, ramp in ramps.items():
                outputs[color].append((*ramp_color(ramp, level), alpha))

    destination = ART / "quest-pins"
    destination.mkdir(exist_ok=True)
    for color, pixels in outputs.items():
        pin = Image.new("RGBA", (SIZE, SIZE))
        pin.putdata(pixels)
        assert pin.getbbox()[3] == TIP["y"] + 1 and pin.getpixel((TIP["x"], TIP["y"]))[3] > 0
        pin.save(destination / f"quest-pin-{color}.png", optimize=True)
    print(f"Window {WINDOW}; tip {TIP}; reference plum ramp {plum}")


if __name__ == "__main__":
    main()
