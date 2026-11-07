#!/usr/bin/env python3
"""Cut the approved-style cabinet source into deterministic, seamless review tiles."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CHECKS = ROOT / "_checks"
CABINET = ROOT / "cabinet"
SOURCE = CHECKS / "cabinet-source.png"
RESAMPLE = Image.Resampling.LANCZOS


def horizontal_warp(image):
    # The generation put its posts slightly inside the requested x positions.
    return image.transform(
        image.size,
        Image.Transform.AFFINE,
        (1 / 1.05, 0, 512 - 512 / 1.05, 0, 1, 0),
        resample=Image.Resampling.BICUBIC,
    )


def flatten_stretch_zone(image):
    """Use one source column for each y in the stretchable central strip."""
    image = image.copy()
    for y in range(image.height):
        color = image.getpixel((512, y))
        image.paste(Image.new("RGBA", (672, 1), color), (176, y))
        for left, right, direction in ((160, 176, 1), (848, 864, -1)):
            for x in range(left, right):
                original = image.getpixel((x, y))
                t = (x - left + 1) / 17 if direction == 1 else (right - x) / 16
                image.putpixel((x, y), tuple(round(a * (1 - t) + b * t) for a, b in zip(original, color)))
        # The wallpaper and shelf surface are an opaque cabinet backing.
        for x in range(112, 912):
            r, g, b, alpha = image.getpixel((x, y))
            if alpha > 200:
                image.putpixel((x, y), (r, g, b, 255))
    return image


def make_row(src):
    row = Image.new("RGBA", (1024, 384))
    for src_top, src_bottom, dst_top, dst_bottom in (
        (300, 580, 0, 280),
        (580, 630, 280, 300),
        (630, 680, 300, 352),
        (680, 712, 352, 384),
    ):
        region = src.crop((0, src_top, 1024, src_bottom))
        row.paste(region.resize((1024, dst_bottom - dst_top), RESAMPLE), (0, dst_top))
    return row


def blend_to_seam(image, color_row, at_bottom):
    image = image.copy()
    for i in range(20):
        y = image.height - 20 + i if at_bottom else i
        # The seam pixel is exact; the surrounding 19 px fade naturally into it.
        t = (i + 1) / 20 if at_bottom else (20 - i) / 20
        for x in range(image.width):
            a = image.getpixel((x, y))
            b = color_row[x]
            image.putpixel((x, y), tuple(round(v * (1 - t) + w * t) for v, w in zip(a, b)))
    return image


def stretch_to_width(tile, width, height):
    scale = height / tile.height
    side = round(176 * scale)
    left = tile.crop((0, 0, 176, tile.height)).resize((side, height), RESAMPLE)
    center = tile.crop((176, 0, 848, tile.height)).resize((width - side * 2, height), RESAMPLE)
    right = tile.crop((848, 0, 1024, tile.height)).resize((side, height), RESAMPLE)
    output = Image.new("RGBA", (width, height))
    output.alpha_composite(left)
    output.alpha_composite(center, (side, 0))
    output.alpha_composite(right, (width - side, 0))
    return output


def font(size):
    path = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    return ImageFont.truetype(path, size) if path.exists() else ImageFont.load_default()


def cabinet_preview(tiles, width, count):
    scale = 375 / 1024
    heights = [round(h * scale) for h in (256, 384, 384, 384, 192)]
    total = sum(heights)
    result = Image.new("RGBA", (width, total), (246, 248, 251, 255))
    top = 0
    for tile, height in zip((tiles["crown"], tiles["row"], tiles["row"], tiles["row"], tiles["base"]), heights):
        result.alpha_composite(stretch_to_width(tile, width, height), (0, top))
        top += height
    vessel_names = ["dome", "bottle", "envelope", "tin", "lantern"]
    usable_left = round(112 * scale)
    usable_right = width - usable_left
    slot = (usable_right - usable_left) / count
    for row_index in range(3):
        surface_y = heights[0] + row_index * heights[1] + round(300 * scale)
        for index in range(count):
            name = vessel_names[(row_index * count + index) % len(vessel_names)]
            path = ROOT.parents[1] / "public" / "art" / "vessels" / f"vessel-{name}.webp"
            vessel = Image.open(path).convert("RGBA")
            size = round(slot * .9)
            vessel.thumbnail((size, min(size, round(140 * scale / (375 / 1024)))), RESAMPLE)
            bbox = vessel.getchannel("A").getbbox()
            if bbox:
                x = round(usable_left + slot * (index + .5) - vessel.width / 2)
                y = round(surface_y - bbox[3])
                result.alpha_composite(vessel, (x, y))
    return result.convert("RGB")


def main():
    CABINET.mkdir(parents=True, exist_ok=True)
    src = horizontal_warp(Image.open(SOURCE).convert("RGBA"))
    tiles = {
        "crown": flatten_stretch_zone(src.crop((0, 0, 1024, 256))),
        "row": flatten_stretch_zone(make_row(src)),
        "base": flatten_stretch_zone(src.crop((0, 1344, 1024, 1536))),
    }
    seam = [tiles["row"].getpixel((x, 0)) for x in range(1024)]
    tiles["crown"] = blend_to_seam(tiles["crown"], seam, True)
    tiles["row"] = blend_to_seam(tiles["row"], seam, True)
    tiles["base"] = blend_to_seam(tiles["base"], seam, False)
    for name, tile in tiles.items():
        tile.save(CABINET / f"cabinet-{name}.png", optimize=True)
    phone = cabinet_preview(tiles, 375, 3)
    desktop = cabinet_preview(tiles, 960, 5)
    paper = (246, 248, 251)
    review = Image.new("RGB", (1390, 980), paper)
    draw = ImageDraw.Draw(review)
    draw.text((20, 10), "A3 CABINET TILES · PHONE 375px · DESKTOP 960px", fill="#16263F", font=font(22))
    review.paste(phone, (20, 50))
    review.paste(desktop, (410, 50))
    seam_positions = [round(256 * 375 / 1024), round(640 * 375 / 1024), round(1408 * 375 / 1024)]
    seam_labels = ["CROWN / ROW", "ROW / ROW", "ROW / BASE"]
    crop_w, crop_h = 90, 28
    for i, (y, label) in enumerate(zip(seam_positions, seam_labels)):
        x0 = 20 + i * 450
        draw.text((x0, 660), label + " · 400%", fill="#16263F", font=font(18))
        # Show a post seam and a back-panel seam for each join.
        for j, center_x in enumerate((46, 190)):
            box = (center_x - crop_w // 2, y - crop_h // 2, center_x + crop_w // 2, y + crop_h // 2)
            crop = phone.crop(box).resize((360, 112), Image.Resampling.NEAREST)
            review.paste(crop, (x0, 690 + j * 132))
    review.save(CHECKS / "cabinet-tiles-review.png", optimize=True)
    print("saved three cabinet masters and review", review.size)


if __name__ == "__main__":
    main()
