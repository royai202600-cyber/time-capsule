#!/usr/bin/env python3
"""Normalize the three review portraits and render native-size legibility checks."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PORTRAITS = ROOT / "portraits"
CHECKS = ROOT / "_checks"
PAPER = "#F6F8FB"


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    return ImageFont.truetype(path, size) if path.exists() else ImageFont.load_default()


def main() -> None:
    canvas = Image.new("RGB", (1020, 620), PAPER)
    draw = ImageDraw.Draw(canvas)
    report = []
    draw.text((30, 18), "TIME CAPSULE  |  PORTRAIT LEGIBILITY TEST", fill="#16263F", font=font(25))
    draw.text((30, 53), "Original size at left of each sample; pixel enlargement at right", fill="#6E2B3F", font=font(15))

    for index in range(1, 4):
        path = PORTRAITS / f"portrait-{index:02}.png"
        portrait = Image.open(path).convert("RGBA")
        if portrait.size != (1024, 1024):
            portrait = portrait.resize((1024, 1024), Image.Resampling.LANCZOS)
            portrait.save(path, optimize=True)
        alpha = portrait.getchannel("A")
        corners = [alpha.getpixel(point) for point in ((0, 0), (1023, 0), (0, 1023), (1023, 1023))]
        if any(corners):
            raise ValueError(f"{path.name}: corners are not transparent: {corners}")

        left = 30 + (index - 1) * 330
        draw.rounded_rectangle((left, 86, left + 310, 585), radius=16, fill="#FFFFFF", outline="#DCE8F2", width=2)
        draw.text((left + 20, 103), f"PORTRAIT {index:02}", fill="#16263F", font=font(20))
        for size, y, scale in ((24, 145, 7), (40, 353, 4)):
            sample = portrait.resize((size, size), Image.Resampling.LANCZOS)
            native = Image.new("RGBA", sample.size, PAPER)
            native.alpha_composite(sample)
            canvas.paste(native.convert("RGB"), (left + 25, y + 70))
            zoom = native.resize((size * scale, size * scale), Image.Resampling.NEAREST)
            canvas.paste(zoom.convert("RGB"), (left + 112, y + 20))
            draw.text((left + 25, y + 10), f"{size} px", fill="#6E2B3F", font=font(20))
            draw.text((left + 20, y + 100), "native", fill="#16263F", font=font(13))
            draw.text((left + 165, y + 192), "zoom", fill="#16263F", font=font(13))
        report.append({"file": str(path.relative_to(ROOT)), "size": [1024, 1024], "mode": "RGBA", "corners_alpha": corners, "visible_bbox": alpha.getbbox()})

    CHECKS.mkdir(parents=True, exist_ok=True)
    canvas.save(CHECKS / "portraits-small.png", optimize=True)
    (CHECKS / "portraits-small.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
