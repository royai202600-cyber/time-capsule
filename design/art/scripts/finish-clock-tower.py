#!/usr/bin/env python3
"""Turn the gpt-image-2 clock souvenir into registered T10b vessel layers."""

import json
import runpy
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CHECKS = ROOT / "_checks"
VESSELS = ROOT / "vessels"
SOURCE = CHECKS / "t10b-clock-assembled-source.png"
OPEN_SOURCE = CHECKS / "t10b-clock-open-source.png"
BLANK_SOURCE = CHECKS / "t10b-clock-blank-door-source.png"
FRAME = runpy.run_path(str(ROOT / "scripts/finish-batch1.py"))["frame"]
PAPER = (246, 248, 251, 255)


def clean(image):
    image = image.convert("RGBA")
    image.putalpha(image.getchannel("A").point(lambda a: a if a >= 8 else 0))
    return image


def multiply_alpha(image, mask):
    result = image.copy()
    result.putalpha(ImageChops.multiply(result.getchannel("A"), mask))
    return result


def normalize(image):
    # One transform for all layers: 1254 source px -> 1024 canvas, base near y=900.
    result = Image.new("RGBA", (1024, 1024))
    result.alpha_composite(image.resize((960, 960), Image.Resampling.LANCZOS), (38, 18))
    return clean(result)


def point(x, y):
    return {"x": round(x * 960 / 1254 + 38), "y": round(y * 960 / 1254 + 18)}


def font(size):
    return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", size)


def main():
    original = clean(Image.open(SOURCE))
    opened = clean(Image.open(OPEN_SOURCE))
    blank = clean(Image.open(BLANK_SOURCE))
    assert original.size == opened.size == blank.size == (1254, 1254)

    # The generation edit drew a complete letter compartment, but isolation
    # enlarged the door. Cut door and hands from the assembled original so
    # they stay registered, and take only the hidden cream fill from that edit.
    door_mask = Image.new("L", original.size)
    draw = ImageDraw.Draw(door_mask)
    draw.rounded_rectangle((407, 519, 745, 857), radius=22, fill=255)
    draw.rounded_rectangle((398, 553, 431, 638), radius=7, fill=255)
    draw.rounded_rectangle((398, 739, 431, 823), radius=7, fill=255)
    draw.rounded_rectangle((704, 662, 771, 716), radius=8, fill=255)
    door_mask = door_mask.filter(ImageFilter.GaussianBlur(0.6))

    hand_zone = Image.new("L", original.size)
    draw = ImageDraw.Draw(hand_zone)
    draw.line(((490, 634), (570, 690)), fill=255, width=40)
    draw.line(((570, 690), (691, 594)), fill=255, width=36)
    draw.ellipse((541, 662, 599, 719), fill=255)
    hand_zone = hand_zone.filter(ImageFilter.MaxFilter(5))
    erase_zone = hand_zone.filter(ImageFilter.GaussianBlur(1))
    # Reject the cream face, keeping just brass and its plum outline.
    pixels = original.load()
    zone = hand_zone.load()
    for y in range(575, 735):
        for x in range(460, 720):
            r, g, b, a = pixels[x, y]
            if not (r < 245 and g < 215 and b < 182 and a > 20):
                zone[x, y] = 0
    hand_zone = hand_zone.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.5))

    # Use the isolated edit's unmarked cream paper only where the hands vanish.
    blank_box = blank.getchannel("A").point(lambda a: 255 if a > 25 else 0).getbbox()
    blank_face = blank.crop((blank_box[0] + 35, blank_box[1] + 18,
                             blank_box[2] - 35, blank_box[3] - 18))
    blank_face = blank_face.resize((338, 338), Image.Resampling.LANCZOS)
    blank_aligned = Image.new("RGBA", original.size)
    blank_aligned.alpha_composite(blank_face, (407, 519))
    door_pixels = Image.composite(blank_aligned, original, erase_zone)

    tower = Image.composite(opened, original, door_mask)
    door = multiply_alpha(door_pixels, door_mask)
    hands = multiply_alpha(original, hand_zone)
    parts = {"tower": normalize(tower), "door": normalize(door), "hands": normalize(hands)}

    pivot = point(414, 689)
    clock_center = point(570, 689)
    spec = {
        "id": "clock-tower", "opening": "J", "idleMs": 4200,
        "idle": [{"type": "breathe", "amount": 0.025}],
        "layers": [
            {"name": "tower", "file": "vessel-clock-tower-tower.png", "role": "static"},
            {"name": "door", "file": "vessel-clock-tower-door.png", "role": "door",
             "pivot": pivot,
             "open": [{"at": 0, "scaleX": 1}, {"at": 0.3, "scaleX": 1},
                      {"at": 1, "scaleX": 0.04}]},
            {"name": "hands", "file": "vessel-clock-tower-hands.png", "role": "fade",
             "pivot": clock_center,
             "open": [{"at": 0, "opacity": 1}, {"at": 0.3, "opacity": 0},
                      {"at": 1, "opacity": 0}],
             "idle": [{"type": "spin", "pivot": clock_center, "turns": 1}]},
        ],
        "mouth": point(565, 620), "baseY": 898,
        "sparkle": point(734, 688), "glint": None,
        "openGlow": None, "readyPulse": None,
    }
    for name, image in parts.items():
        image.save(VESSELS / f"vessel-clock-tower-{name}.png", optimize=True)
    assembled = FRAME(parts, spec, 0)
    assembled.save(VESSELS / "vessel-clock-tower.png", optimize=True)

    bbox = assembled.getchannel("A").point(lambda a: 255 if a > 25 else 0).getbbox()
    assert bbox and bbox[2] - bbox[0] <= 760 and bbox[1] >= 100 and 880 <= bbox[3] - 1 <= 920, bbox
    assert all(image.size == (1024, 1024) for image in [assembled, *parts.values()])
    corners = ((0, 0), (1023, 0), (0, 1023), (1023, 1023))
    assert all(image.getpixel(position)[3] == 0
               for image in [assembled, *parts.values()] for position in corners)
    assert ImageChops.difference(assembled, FRAME(parts, spec, 0)).getbbox() is None

    # Review sheets: exactly rendered closed, half and open positions.
    sheet = Image.new("RGB", (1240, 570), PAPER[:3])
    draw = ImageDraw.Draw(sheet)
    for index, progress in enumerate((0, 0.5, 1)):
        left = 15 + 410 * index
        rendered = FRAME(parts, spec, progress)
        flatten = Image.alpha_composite(Image.new("RGBA", rendered.size, PAPER), rendered)
        sheet.paste(flatten.convert("RGB").resize((400, 400), Image.Resampling.LANCZOS), (left, 40))
        draw.text((left + 10, 10), ("CLOSED", "HALF OPEN", "OPEN")[index],
                  fill="#16263F", font=font(20))
        for label, p, color in (("door pivot", pivot, "#6E2B3F"),
                                ("hands pivot", clock_center, "#2F5D8A"),
                                ("mouth", spec["mouth"], "#A3364F"),
                                ("sparkle", spec["sparkle"], "#C9A15A")):
            x, y = left + round(p["x"] * 400 / 1024), 40 + round(p["y"] * 400 / 1024)
            draw.line((x - 5, y, x + 5, y), fill=color, width=2)
            draw.line((x, y - 5, x, y + 5), fill=color, width=2)
    draw.text((22, 460), "clock-tower | J door swing | baseY 898 | idle: breathe 0.025 + hands spin",
              fill="#16263F", font=font(18))
    draw.text((22, 490), "Door scaleX: 1 at 0, 1 at 0.3, 0.04 at 1. Hands fade by 0.3.",
              fill="#16263F", font=font(16))
    draw.text((22, 522), "Crosshairs: plum=door pivot, blue=hands, red=mouth, brass=sparkle.",
              fill="#16263F", font=font(16))
    sheet.save(CHECKS / "clock-tower-motion.png", optimize=True)

    sizes = Image.new("RGB", (260, 170), PAPER[:3])
    flat = Image.alpha_composite(Image.new("RGBA", assembled.size, PAPER), assembled).convert("RGB")
    sizes.paste(flat.resize((40, 40), Image.Resampling.LANCZOS), (20, 25))
    sizes.paste(flat.resize((120, 120), Image.Resampling.LANCZOS), (100, 10))
    ImageDraw.Draw(sizes).text((20, 135), "40 px       120 px", fill="#16263F", font=font(16))
    sizes.save(CHECKS / "clock-tower-silhouette.png", optimize=True)
    assembled.save(CHECKS / "clock-tower-stack.png", optimize=True)
    (CHECKS / "t10b-clock-spec.json").write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n")
    (CHECKS / "clock-tower-check.json").write_text(json.dumps({
        "canvas": [1024, 1024], "bbox_alpha_gt25": bbox,
        "corners_alpha_zero": True, "rest_stack_exact": True,
        "opening": "J", "pivot": pivot, "mouth": spec["mouth"],
        "baseY": spec["baseY"], "sparkle": spec["sparkle"],
        "ip_sensitivity": "Original small keepsake clock, loosely inspired by red brick and pale stone; no exact tower silhouette, logos, symbols, characters, numerals or religious imagery.",
    }, indent=2) + "\n")
    print("clock-tower", bbox, "exact closed stack; motion and 40/120 px sheets written")


if __name__ == "__main__":
    main()
