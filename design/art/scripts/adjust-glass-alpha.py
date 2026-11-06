#!/usr/bin/env python3
"""Reduce generated glass fill opacity while preserving opaque ink and highlights.

Usage: python adjust-glass-alpha.py SOURCE.png OUTPUT.png [scale]
Use a fresh generated source each time; repeated processing compounds alpha.
"""

import sys
from PIL import Image


def main() -> None:
    if len(sys.argv) not in (3, 4):
        raise SystemExit(__doc__)
    source, output = sys.argv[1:3]
    scale = float(sys.argv[3]) if len(sys.argv) == 4 else 0.375
    if not 0 < scale < 1:
        raise SystemExit("scale must be between 0 and 1")

    image = Image.open(source).convert("RGBA")
    rgba = bytearray(image.tobytes())
    for offset in range(3, len(rgba), 4):
        alpha = rgba[offset]
        if alpha < 200:
            rgba[offset] = round(alpha * scale)
    result = Image.frombytes("RGBA", image.size, bytes(rgba))
    result.save(output, optimize=True)


if __name__ == "__main__":
    main()
