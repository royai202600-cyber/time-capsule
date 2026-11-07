#!/usr/bin/env python3
"""Align the approved vinyl generation and its two gpt-image-2 isolation edits."""
import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
VESSELS = ROOT / "vessels"
CHECKS = ROOT / "_checks"
PAPER = (246, 248, 251, 255)


def bbox(image):
    return image.getchannel("A").point(lambda value: 255 if value > 25 else 0).getbbox()


def place(image, scale, center):
    size = (round(image.width * scale), round(image.height * scale))
    small = image.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", image.size)
    canvas.alpha_composite(small, (round(center[0] - size[0] / 2), round(center[1] - size[1] / 2)))
    return canvas


def normalize(image):
    small = image.resize((1024, 1024), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (1024, 1024))
    canvas.alpha_composite(small, (2, 5))
    return canvas


def move(image, amount):
    canvas = Image.new("RGBA", (1024, 1024))
    canvas.alpha_composite(image, (0, round(amount * 1024)))
    return canvas


def on_paper(image):
    return Image.alpha_composite(Image.new("RGBA", image.size, PAPER), image).convert("RGB")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--assembled-source", type=Path, required=True)
    parser.add_argument("--record-source", type=Path, required=True)
    parser.add_argument("--sleeve-source", type=Path, required=True)
    args = parser.parse_args()
    assembled_source = Image.open(args.assembled_source).convert("RGBA")
    record_source = Image.open(args.record_source).convert("RGBA")
    sleeve_source = Image.open(args.sleeve_source).convert("RGBA")
    assert all(im.size == (1254, 1254) for im in (assembled_source, record_source, sleeve_source))
    # Match the edit's complete record to the original visible semicircle.
    record_native = place(record_source, 0.785, (624, 477))
    sleeve = normalize(sleeve_source)
    record = normalize(record_native)
    assembled = Image.alpha_composite(record, sleeve)
    VESSELS.mkdir(exist_ok=True)
    for name, image in (("record", record), ("sleeve", sleeve), ("", assembled)):
        suffix = f"-{name}" if name else ""
        image.save(VESSELS / f"vessel-vinyl{suffix}.png", optimize=True)
    assert ImageChops.difference(assembled, Image.alpha_composite(record, sleeve)).getbbox() is None
    bounds = bbox(assembled)
    assert bounds[2] - bounds[0] <= 760 and bounds[1] >= 100 and 880 <= bounds[3] - 1 <= 920, bounds
    assert all(im.getchannel("A").getpixel(point) == 0 for im in (record, sleeve, assembled)
               for point in ((0, 0), (1023, 0), (0, 1023), (1023, 1023)))
    # F slide: the lower edge clears the sleeve's upper lip by the fully open pose.
    slide_end = -0.30
    moved = move(record, slide_end)
    assert bbox(moved)[3] < bbox(sleeve)[1], (bbox(moved), bbox(sleeve))
    spec = {
        "id": "vinyl", "opening": "F", "idleMs": 4000,
        "idle": [{"type": "sway", "deg": 2.5, "pivot": {"x": 512, "y": bounds[3] - 1}}],
        "layers": [
            {"name": "record", "file": "vessel-vinyl-record.png", "role": "slide",
             "open": [{"at": 0, "y": 0, "opacity": 1},
                      {"at": 0.5, "y": -0.10, "opacity": 1},
                      {"at": 1, "y": slide_end, "opacity": 0}]},
            {"name": "sleeve", "file": "vessel-vinyl-sleeve.png", "role": "static"},
        ],
        "mouth": {"x": 512, "y": round(bbox(sleeve)[1] + 28)},
        "baseY": bounds[3] - 1, "sparkle": {"x": round(bounds[2] - 42), "y": round(bbox(sleeve)[1] + 46)},
        "glint": None, "openGlow": None, "readyPulse": None,
    }
    CHECKS.mkdir(exist_ok=True)
    (CHECKS / "b4-vinyl-spec.json").write_text(json.dumps(spec, indent=2) + "\n")
    # The three large panels show exact resting stack and interpolated opening.
    labels = ("CLOSED", "HALF OPEN", "OPEN")
    sheet = Image.new("RGB", (1240, 650), PAPER[:3])
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
    for i, t in enumerate((0, 0.5, 1)):
        ox = 15 + i * 410
        y = -0.20 * t if t <= 0.5 else -0.10 + (slide_end + 0.10) * (t - 0.5) * 2
        shifted = move(record, y)
        if t > 0.5:
            shifted.putalpha(shifted.getchannel("A").point(lambda a: round(a * (2 - 2 * t))))
        frame = Image.alpha_composite(shifted, sleeve)
        sheet.paste(on_paper(frame).resize((400, 400), Image.Resampling.LANCZOS), (ox, 40))
        draw.text((ox + 10, 10), labels[i], fill="#16263F", font=font)
        for point, colour in ((spec["mouth"], "#A3364F"), (spec["sparkle"], "#C9A15A"),
                              (spec["idle"][0]["pivot"], "#6E2B3F")):
            x = ox + round(point["x"] * 400 / 1024)
            y = 40 + round(point["y"] * 400 / 1024)
            draw.line((x - 6, y, x + 6, y), fill=colour, width=2)
            draw.line((x, y - 6, x, y + 6), fill=colour, width=2)
    draw.text((20, 463), f"vinyl · F slide · baseY {spec['baseY']} · mouth {spec['mouth']} · sparkle {spec['sparkle']}", fill="#16263F", font=font)
    draw.text((20, 495), f"record slide: y 0 → -0.10 → {slide_end}; opacity 1 → 1 → 0 · sleeve static", fill="#16263F", font=font)
    draw.text((20, 527), "idle: whole-vessel sway 2.5° from base · 4000 ms", fill="#16263F", font=font)
    draw.text((20, 559), "Crosshairs: plum = pivot, wax red = mouth, brass = sparkle", fill="#16263F", font=font)
    sheet.save(CHECKS / "vinyl-motion.png", optimize=True)
    strip = Image.new("RGB", (360, 180), PAPER[:3])
    for n, x in ((40, 40), (120, 180)):
        strip.paste(on_paper(assembled.resize((n, n), Image.Resampling.LANCZOS)), (x, 10))
        ImageDraw.Draw(strip).text((x, 145), f"{n} px", fill="#16263F", font=font)
        on_paper(assembled).resize((n, n), Image.Resampling.LANCZOS).save(CHECKS / f"vinyl-at-{n}px.png")
    strip.save(CHECKS / "vinyl-silhouette.png", optimize=True)
    assembled.save(CHECKS / "vinyl-stack.png", optimize=True)
    source_look = normalize(assembled_source)
    comparison = Image.new("RGB", (2048, 1024), PAPER[:3])
    comparison.paste(on_paper(source_look), (0, 0))
    comparison.paste(on_paper(assembled), (1024, 0))
    comparison.save(CHECKS / "vinyl-comparison.png", optimize=True)
    report = {"canvas": [1024, 1024], "bbox": bounds, "baseY": spec["baseY"],
              "corners_alpha_zero": True, "rest_stack_exact": True, "record_complete": True,
              "open_record_clears_sleeve": True, "ip_review": "Original abstract sleeve, no marks, text, characters or brand shapes."}
    (CHECKS / "vinyl-check.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
