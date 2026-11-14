#!/usr/bin/env python3
"""Convert generated stamp ink to one exact palette color and cut paper/specks."""

import argparse
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "stamps"
INKS = {
    "senado": (110, 43, 63), "tst-clock": (47, 93, 138),
    "taipei101": (163, 54, 79), "sensoji": (110, 43, 63),
    "fushimi": (47, 93, 138), "gyeongbok": (163, 54, 79),
    "merlion": (110, 43, 63), "grandpal": (47, 93, 138),
    "wumen": (163, 54, 79), "petronas": (110, 43, 63),
    "aurele-cotai": (47, 93, 138),
    "hunt-xinyi-2026-11": (47, 93, 138),
    "hkust": (47, 93, 138),
    "hunt-hkust-2026-11": (47, 93, 138),
    "private-hunt": (201, 161, 90),
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', nargs='+', choices=tuple(INKS),
                        help='Normalize only named stamps, preserving all others.')
    args = parser.parse_args()
    for name, color in INKS.items():
        if args.only and name not in args.only:
            continue
        path = ROOT / f"stamp-{name}.png"
        image = Image.open(path).convert("RGBA")
        if image.size != (1024, 1024):
            assert min(image.size) >= 1024, 'Never upscale stamp artwork'
            image = image.resize((1024, 1024), Image.Resampling.LANCZOS)
        rgba = bytearray(image.tobytes())
        for p in range(0, len(rgba), 4):
            if rgba[p + 3] == 0:
                continue
            distance = math.sqrt(sum((rgba[p + c] - color[c]) ** 2 for c in range(3)))
            weight = max(0.0, min(1.0, (120 - distance) / 45))
            rgba[p:p + 3] = bytes(color)
            rgba[p + 3] = round(rgba[p + 3] * weight)
        image = Image.frombytes("RGBA", image.size, bytes(rgba))
        image.save(path, optimize=True)
        print(path.name, image.size, "visible bbox", image.getchannel("A").getbbox())


if __name__ == "__main__":
    main()
