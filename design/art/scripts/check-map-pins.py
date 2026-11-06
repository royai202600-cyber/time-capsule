#!/usr/bin/env python3
"""Validate map pin metadata and render a native-pixel review overlay."""

import json
from math import dist
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / "map-asia.png"
OVERLAY = ROOT / "_checks" / "map-pins.png"
EXPECTED = (
    ("senado", "Senado Square, Macau"),
    ("tst-clock", "TST Clock Tower, Hong Kong"),
    ("taipei101", "Taipei 101, Taiwan"),
    ("sensoji", "Senso-ji, Tokyo"),
    ("fushimi", "Fushimi Inari, Kyoto"),
    ("gyeongbok", "Gyeongbokgung, Seoul"),
    ("merlion", "Merlion, Singapore"),
    ("grandpal", "Grand Palace, Bangkok"),
    ("wumen", "Meridian Gate, Beijing"),
    ("petronas", "Petronas Towers, Kuala Lumpur"),
    ("aurele-cotai", "Maison Aurele Cotai, Macau"),
)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def main() -> None:
    entries = json.loads((ROOT / "manifest.json").read_text())
    map_entries = [item for item in entries if item["path"] == "design/art/map-asia.png"]
    assert len(map_entries) == 1, "Expected one map entry in manifest"
    pins = map_entries[0]["pins"]
    assert set(pins) == {place_id for place_id, _ in EXPECTED}, "Unexpected or missing place ID"

    map_image = Image.open(MAP).convert("RGB")
    assert map_image.size == (1254, 1254), f"Unexpected map size: {map_image.size}"
    for place_id, _ in EXPECTED:
        point = pins[place_id]
        assert set(point) == {"x", "y"}, f"Unexpected coordinate keys: {place_id}"
        assert all(type(point[axis]) is int for axis in ("x", "y")), f"Non-integer coordinate: {place_id}"
        assert 0 <= point["x"] < 1254 and 0 <= point["y"] < 1254, f"Out of bounds: {place_id}"
    macau_distance = dist(tuple(pins["senado"].values()), tuple(pins["aurele-cotai"].values()))
    assert 0 < macau_distance <= 15, "Macau pins should be distinct and adjacent"
    assert pins["senado"]["x"] < pins["tst-clock"]["x"], "Macau should lie west of Hong Kong"
    assert pins["fushimi"]["x"] < pins["sensoji"]["x"], "Kyoto should lie west of Tokyo"
    assert pins["petronas"]["y"] < pins["merlion"]["y"], "Kuala Lumpur should lie north of Singapore"

    sidebar = 420
    canvas = Image.new("RGB", (1254 + sidebar, 1254), "#F6F8FB")
    canvas.paste(map_image, (0, 0))  # Keep native map pixels and coordinate origin.
    draw = ImageDraw.Draw(canvas)
    plum, navy, brass = "#6E2B3F", "#16263F", "#C9A15A"
    draw.line((1254, 0, 1254, 1254), fill=navy, width=2)

    title_font, row_font, small_font = font(29), font(19), font(16)
    draw.text((1280, 45), "Map pin check", fill=navy, font=title_font)
    draw.text((1280, 90), "1254 x 1254 native pixels", fill=navy, font=small_font)
    draw.text((1280, 117), "Illustrated coastline; approximate sites", fill=plum, font=small_font)

    offsets = {"senado": (-27, -27), "aurele-cotai": (28, 28), "tst-clock": (31, -22)}
    for number, (place_id, label) in enumerate(EXPECTED, 1):
        x, y = pins[place_id]["x"], pins[place_id]["y"]
        ox, oy = offsets.get(place_id, (21, -21))
        badge_x, badge_y = x + ox, y + oy
        draw.line((x, y, badge_x, badge_y), fill=plum, width=2)
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=plum, outline="white", width=2)
        draw.ellipse((badge_x - 14, badge_y - 14, badge_x + 14, badge_y + 14), fill=plum, outline="white", width=2)
        number_text = str(number)
        bounds = draw.textbbox((0, 0), number_text, font=small_font)
        draw.text((badge_x - (bounds[2] - bounds[0]) / 2,
                   badge_y - (bounds[3] - bounds[1]) / 2 - bounds[1]),
                  number_text, fill="white", font=small_font)

        row_y = 160 + (number - 1) * 90
        draw.ellipse((1281, row_y - 2, 1307, row_y + 24), fill=plum)
        bounds = draw.textbbox((0, 0), number_text, font=small_font)
        draw.text((1294 - (bounds[2] - bounds[0]) / 2, row_y + 11 - (bounds[3] - bounds[1]) / 2 - bounds[1]),
                  number_text, fill="white", font=small_font)
        draw.text((1320, row_y - 4), label, fill=navy, font=row_font)
        draw.text((1320, row_y + 25), f"{place_id}  ({x}, {y})", fill=plum, font=small_font)

    draw.line((1280, 1175, 1648, 1175), fill=brass, width=2)
    draw.text((1280, 1190), "Dots mark exact manifest coordinates.", fill=navy, font=small_font)
    canvas.save(OVERLAY)
    print(f"PASS: {len(pins)} pins in bounds; Macau pins {macau_distance:.1f} px apart")
    print(f"Overlay: {OVERLAY.relative_to(ROOT)} ({canvas.width} x {canvas.height})")


if __name__ == "__main__":
    main()
