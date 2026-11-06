#!/usr/bin/env python3
"""Give every avatar the same clean circular disc and remove generated edge specks."""

from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "portraits"
CENTER = (505, 526)
RADIUS = 430
TARGETS = {
    "portrait-06.png": (214, 208, 223),  # mist plum
    "portrait-07.png": (193, 224, 231),  # blue mint
    "portrait-08.png": (232, 216, 228),  # pale mauve
    "portrait-future.png": (224, 227, 237),  # silver blue
}


def recolor_disc(image: Image.Image, target: tuple[int, int, int]) -> Image.Image:
    source = image.getpixel((512, 100))[:3]
    shift = tuple(target[i] - source[i] for i in range(3))
    if shift == (0, 0, 0):
        return image
    rgba = bytearray(image.tobytes())
    for p in range(0, len(rgba), 4):
        r, g, b, a = rgba[p:p + 4]
        if a and max(abs(r - source[0]), abs(g - source[1]), abs(b - source[2])) < 58 and b >= r - 10:
            for i in range(3):
                rgba[p + i] = max(0, min(255, rgba[p + i] + shift[i]))
    return Image.frombytes("RGBA", image.size, bytes(rgba))


def main() -> None:
    disc_mask = Image.new("L", (1024, 1024), 0)
    ImageDraw.Draw(disc_mask).ellipse(
        (CENTER[0] - RADIUS, CENTER[1] - RADIUS, CENTER[0] + RADIUS, CENTER[1] + RADIUS),
        fill=255,
    )
    for path in sorted(ROOT.glob("portrait-*.png")):
        portrait = Image.open(path).convert("RGBA")
        if portrait.size != (1024, 1024):
            portrait = portrait.resize((1024, 1024), Image.Resampling.LANCZOS)
        target = TARGETS.get(path.name, portrait.getpixel((512, 100))[:3])
        portrait = recolor_disc(portrait, target)
        ground = Image.new("RGBA", portrait.size, (*target, 255))
        merged = Image.alpha_composite(ground, portrait)
        merged.putalpha(disc_mask)
        merged.save(path, optimize=True)
        print(path.name, "disc center", CENTER, "radius", RADIUS, "color", target)


if __name__ == "__main__":
    main()
