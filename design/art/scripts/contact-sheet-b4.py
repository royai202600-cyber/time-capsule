#!/usr/bin/env python3
"""Build a compact contact sheet from the B4 files in the current art manifest."""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
entries = json.loads((ROOT / "manifest.json").read_text())
ids = ("vinyl", "vhs", "photo-strip", "arcade", "pager", "rotary-phone", "umbrella", "love-padlock", "lucky-stars", "paper-plane")
paths = []
for id in ids:
    prefix = f"design/art/vessels/vessel-{id}"
    for entry in entries:
        path = entry["path"]
        if path == prefix + ".png" or path.startswith(prefix + "-"):
            paths.append(path)

cols, cell_w, cell_h = 5, 240, 230
rows = math.ceil(len(paths) / cols)
sheet = Image.new("RGB", (cols * cell_w, 60 + rows * cell_h), "#F6F8FB")
draw = ImageDraw.Draw(sheet)
font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
title = ImageFont.truetype(font_path, 23)
label = ImageFont.truetype(font_path, 14)
draw.text((18, 16), f"B4 RETRO AND LOVE  ·  {len(paths)} PNG MASTERS", fill="#16263F", font=title)
for index, path in enumerate(paths):
    x, y = (index % cols) * cell_w, 60 + (index // cols) * cell_h
    draw.rounded_rectangle((x + 6, y + 6, x + cell_w - 6, y + cell_h - 6), radius=10,
                           fill="#FFFFFF", outline="#DCE8F2")
    image = Image.open(ROOT.parent.parent / path).convert("RGBA")
    image.thumbnail((200, 175), Image.Resampling.LANCZOS)
    tile = Image.new("RGBA", image.size, "#F6F8FB")
    tile.alpha_composite(image)
    sheet.paste(tile.convert("RGB"), (x + (cell_w - image.width) // 2,
                                     y + 12 + (175 - image.height) // 2))
    name = Path(path).stem
    if len(name) > 28:
        name = name[:25] + "…"
    draw.text((x + 12, y + 197), name, fill="#16263F", font=label)
output = ROOT / "_checks" / "b4-contact-sheet.png"
sheet.save(output, optimize=True)
print(output, sheet.size)
