#!/usr/bin/env python3
"""Make generated paper tiles seamless and remove the burst's gray outer rim."""

import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def finish_tile(path: Path) -> None:
    image = Image.open(path).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    pixels = image.load()
    margin = 64
    for y in range(1024):
        left, right = pixels[0, y], pixels[1023, y]
        average = tuple(round((left[c] + right[c]) / 2) for c in range(3))
        for d in range(margin):
            weight = 1 - d / margin
            for x in (d, 1023 - d):
                original = pixels[x, y]
                pixels[x, y] = tuple(round(original[c] * (1 - weight) + average[c] * weight) for c in range(3))
    for x in range(1024):
        top, bottom = pixels[x, 0], pixels[x, 1023]
        average = tuple(round((top[c] + bottom[c]) / 2) for c in range(3))
        for d in range(margin):
            weight = 1 - d / margin
            for y in (d, 1023 - d):
                original = pixels[x, y]
                pixels[x, y] = tuple(round(original[c] * (1 - weight) + average[c] * weight) for c in range(3))
    image.save(path, optimize=True)
    print(path.name, image.size, "left/right seam", all(pixels[0, y] == pixels[1023, y] for y in range(1024)),
          "top/bottom seam", all(pixels[x, 0] == pixels[x, 1023] for x in range(1024)))


def finish_burst(path: Path) -> None:
    image = Image.open(path).convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    rgba = bytearray(image.tobytes())
    for y in range(1024):
        for x in range(1024):
            p = 4 * (y * 1024 + x)
            r, g, b, a = rgba[p:p + 4]
            radius = math.hypot(x - 512, y - 512)
            fade = max(0.0, min(1.0, (455 - radius) / 100))
            warm = max(0.0, min(1.0, (r - b - 5) / 30))
            rgba[p + 3] = round(a * fade * warm * 0.72)
            rgba[p:p + 3] = bytes((243, 226, 187)) if r + g + b > 570 else bytes((201, 161, 90))
    image = Image.frombytes("RGBA", image.size, bytes(rgba))
    image.save(path, optimize=True)
    print(path.name, image.size, "corners", [image.getpixel(p)[3] for p in ((0, 0), (1023, 0), (0, 1023), (1023, 1023))])


def main() -> None:
    for name in ("paper", "paper-letter"):
        finish_tile(ROOT / "textures" / f"{name}.png")
    finish_burst(ROOT / "fx" / "fx-light-burst.png")


if __name__ == "__main__":
    main()
