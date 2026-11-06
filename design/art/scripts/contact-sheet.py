#!/usr/bin/env python3
"""Create a review sheet containing every PNG master from the manifest."""

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
entries = json.loads((ROOT / "manifest.json").read_text())
COLS, CARD_W, CARD_H = 6, 220, 220
ROWS = math.ceil(len(entries) / COLS)
PAPER = (246, 248, 251, 255)


def font(size: int):
    p = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    return ImageFont.truetype(p, size) if p.exists() else ImageFont.load_default()


def main() -> None:
    sheet = Image.new("RGB", (COLS * CARD_W, 60 + ROWS * CARD_H), PAPER[:3])
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 16), f"TIME CAPSULE ART  ·  {len(entries)} PNG MASTERS", fill="#16263F", font=font(25))
    for index, entry in enumerate(entries):
        x, y = (index % COLS) * CARD_W, 60 + (index // COLS) * CARD_H
        draw.rounded_rectangle((x + 7, y + 7, x + CARD_W - 7, y + CARD_H - 7),
                               radius=10, fill="#FFFFFF", outline="#DCE8F2")
        rel = entry["path"].removeprefix("design/art/")
        image = Image.open(ROOT / rel).convert("RGBA")
        image.thumbnail((190, 165), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", image.size, PAPER)
        tile.alpha_composite(image)
        sheet.paste(tile.convert("RGB"), (x + (CARD_W - image.width) // 2, y + 15 + (165 - image.height) // 2))
        label = rel if len(rel) < 28 else rel[:25] + "…"
        draw.text((x + 13, y + 185), label, fill="#16263F", font=font(13))
    output = ROOT / "_checks" / "contact-sheet.png"
    sheet.save(output, optimize=True)
    print(output, sheet.size)


if __name__ == "__main__":
    main()
