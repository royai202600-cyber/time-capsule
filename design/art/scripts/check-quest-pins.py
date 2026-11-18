#!/usr/bin/env python3
"""Check the frame geometry and compose the quest pin review at both sizes."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ART = Path(__file__).resolve().parents[1]
REPO = ART.parents[1]
LAND = "#F3EFE6"
INK = "#16263F"
COLORS = ("blue", "brass", "plum")
QUEST_TYPES = ("arrive", "question", "price", "catch", "landmark")
RESAMPLE = Image.Resampling.LANCZOS


def circle_mask(diameter):
    mask = Image.new("L", (diameter * 4,) * 2)
    ImageDraw.Draw(mask).ellipse((0, 0, mask.width - 1, mask.height - 1), fill=255)
    return mask.resize((diameter,) * 2, RESAMPLE)


def pin_view(frame, picture, window, face_size):
    # Use the 1024 px master coordinates. The picture extends a couple of
    # pixels under the bevel so the two antialiased edges cannot leave a seam.
    radius = window["radius"]
    inset_size = 2 * (radius + 3)
    inset = ImageOps.fit(picture, (inset_size,) * 2, RESAMPLE)
    inset.putalpha(circle_mask(inset_size))
    composite = Image.new("RGBA", frame.size)
    composite.alpha_composite(inset, (window["x"] - inset_size // 2, window["y"] - inset_size // 2))
    composite.alpha_composite(frame)
    composite = composite.crop(frame.getbbox())
    dimensions = tuple(round(edge * face_size / (2 * radius)) for edge in composite.size)
    return composite.resize(dimensions, RESAMPLE)


def font(size):
    arial = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    return ImageFont.truetype(arial, size) if arial.exists() else ImageFont.load_default()


def main():
    entries = {entry["path"]: entry for entry in json.loads((ART / "manifest.json").read_text())}
    frame_entries = [entries[f"design/art/quest-pins/quest-pin-{color}.png"] for color in COLORS]
    frames = [Image.open(REPO / entry["path"]).convert("RGBA") for entry in frame_entries]
    window = frame_entries[0]["window"]
    tip = frame_entries[0]["tip_anchor"]
    radius = window["radius"]
    x, y = window["x"], window["y"]
    alpha = frames[0].getchannel("A")
    assert all(entry["window"] == window and entry["tip_anchor"] == tip for entry in frame_entries)
    assert all(frame.getchannel("A").tobytes() == alpha.tobytes() for frame in frames)
    for dy in range(1 - radius, radius):
        for dx in range(1 - radius, radius):
            if dx * dx + dy * dy <= (radius - 2) ** 2:
                assert alpha.getpixel((x + dx, y + dy)) == 0
    assert alpha.getpixel((tip["x"], tip["y"])) > 0
    assert alpha.getbbox()[3] == tip["y"] + 1
    for entry in frame_entries:
        exported = Image.open(REPO / entry["web_export"])
        assert exported.size == (512, 512)
        assert exported.getchannel("A").getpixel((x // 2, y // 2)) == 0

    pictures = []
    for quest_type in QUEST_TYPES:
        entry = entries.get(f"design/art/quest-types/quest-type-{quest_type}.png")
        if entry:
            picture = Image.open(REPO / entry["web_export"]).convert("RGB")
            pictures.append((quest_type, picture))
    width = 1120
    pitch = 325
    sheet = Image.new("RGB", (width, 100 + pitch * len(pictures)), LAND)
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 18), "QUEST PINS", fill=INK, font=font(26))
    draw.text((24, 55), "Circle diameter shown at 46 px and 138 px", fill=INK, font=font(16))
    column_centres = (155, 250, 345, 505, 735, 965)
    for i, (quest_type, picture) in enumerate(pictures):
        top = 90 + i * pitch
        draw.text((24, top), quest_type.upper(), fill=INK, font=font(19))
        for group, face_size in enumerate((46, 138)):
            for j, (color, frame) in enumerate(zip(COLORS, frames)):
                column = column_centres[group * len(COLORS) + j]
                sample = pin_view(frame, picture, window, face_size)
                top_label = top + 30
                draw.text((column, top_label), color.capitalize(), anchor="mt", fill=INK, font=font(15))
                sheet.paste(sample, (column - sample.width // 2, top_label + 24), sample)
        gem = Image.open(ART / "game/waypost-gem-blue.png").convert("RGBA")
        gem = gem.crop(gem.getbbox())
        gem = gem.resize((round(gem.width * 48 / gem.height), 48), RESAMPLE)
        sheet.paste(gem, (50 - gem.width // 2, top + 57), gem)
        draw.text((50, top + 112), "Waypost", anchor="mt", fill=INK, font=font(13))
        draw.text((50, top + 129), "48 px", anchor="mt", fill=INK, font=font(13))

    sheet.save(ART / "_checks/quest-types-review.png", optimize=True)
    print(f"Reviewed {len(pictures)} quest pictures in 3 frames at 46/138 px. Shared alpha, clear window and tip pass.")


if __name__ == "__main__":
    main()
