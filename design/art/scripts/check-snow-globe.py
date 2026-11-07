#!/usr/bin/env python3
"""Make the T10a snow-globe silhouette and motion review images."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
VESSELS = ROOT / "vessels"
CHECKS = ROOT / "_checks"
PAPER = (246, 248, 251, 255)
MOUTH = (512, 724)
SPARKLE = (340, 270)
BASE_Y = 902


def layer(name: str) -> Image.Image:
    return Image.open(VESSELS / f"vessel-snow-globe-{name}.png").convert("RGBA")


def composite(offset: int = 0, snow_alpha: float = 1.0, globe_alpha: float = 1.0) -> Image.Image:
    frame = Image.new("RGBA", (1024, 1024))
    for name in ("base", "scene"):
        frame = Image.alpha_composite(frame, layer(name))
    snow = layer("snow")
    snow.putalpha(snow.getchannel("A").point(lambda a: round(a * snow_alpha)))
    frame = Image.alpha_composite(frame, snow)
    globe = layer("globe")
    globe.putalpha(globe.getchannel("A").point(lambda a: round(a * globe_alpha)))
    shifted = Image.new("RGBA", globe.size)
    shifted.alpha_composite(globe, (0, offset))
    return Image.alpha_composite(frame, shifted)


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", size)


def flatten(image: Image.Image) -> Image.Image:
    paper = Image.new("RGBA", image.size, PAPER)
    paper.alpha_composite(image)
    return paper.convert("RGB")


def make_sizes() -> None:
    image = Image.open(VESSELS / "vessel-snow-globe.png").convert("RGBA")
    sheet = Image.new("RGB", (480, 220), PAPER[:3])
    draw = ImageDraw.Draw(sheet)
    for size, x in ((40, 75), (120, 275)):
        tiny = flatten(image.resize((size, size), Image.Resampling.LANCZOS))
        sheet.paste(tiny, (x, 30))
        draw.text((x, 165), f"{size} px", fill=(22, 38, 63), font=font(22))
    sheet.save(CHECKS / "snow-globe-silhouette.png", optimize=True)
    # Separate strip to match the SOP naming and make 40px review simple.
    strip = Image.new("RGB", (80, 70), PAPER[:3])
    strip.paste(flatten(image.resize((40, 40), Image.Resampling.LANCZOS)), (20, 5))
    ImageDraw.Draw(strip).text((16, 48), "40 px", fill=(22, 38, 63), font=font(14))
    strip.save(CHECKS / "snow-globe-at-40px.png", optimize=True)


def marker(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple[int, int, int]) -> None:
    draw.ellipse((x - 5, y - 5, x + 5, y + 5), outline=color, width=2)
    draw.line((x - 8, y, x + 8, y), fill=color, width=2)
    draw.line((x, y - 8, x, y + 8), fill=color, width=2)


def make_motion() -> None:
    width, height = 1240, 485
    sheet = Image.new("RGB", (width, height), PAPER[:3])
    draw = ImageDraw.Draw(sheet)
    states = (
        ("CLOSED", 0, 0, 1.0, 1.0),
        ("HALF OPEN", 0.5, -179, 0.5, 0.5),
        ("OPEN", 1, -358, 0.0, 0.0),
    )
    for index, (title, at, offset, snow_alpha, globe_alpha) in enumerate(states):
        ox = 35 + index * 405
        oy = 40
        stage = flatten(composite(offset, snow_alpha, globe_alpha).resize((350, 350), Image.Resampling.LANCZOS))
        sheet.paste(stage, (ox, oy))
        draw.rectangle((ox, oy, ox + 349, oy + 349), outline=(210, 217, 225), width=1)
        draw.text((ox + 7, 7), title, fill=(22, 38, 63), font=font(20))
        scale = 350 / 1024
        mouth_x, mouth_y = ox + round(MOUTH[0] * scale), oy + round(MOUTH[1] * scale)
        sparkle_x = ox + round(SPARKLE[0] * scale)
        sparkle_y = oy + round((SPARKLE[1] + offset) * scale)
        marker(draw, mouth_x, mouth_y, (163, 54, 79))
        if globe_alpha > 0:
            marker(draw, sparkle_x, sparkle_y, (201, 161, 90))
        base_line = oy + round(BASE_Y * scale)
        draw.line((ox, base_line, ox + 350, base_line), fill=(47, 93, 138), width=1)
        draw.text((ox + 3, 399), f"at {at:g}: globe y {offset / 1024:.3f}, opacity {globe_alpha:g}", fill=(22, 38, 63), font=font(15))
        draw.text((ox + 3, 419), f"snow opacity {snow_alpha:g}", fill=(22, 38, 63), font=font(15))
    draw.text((38, 457), "red = mouth (512,724)   brass = sparkle (340,270)   blue = baseY 902   pivot = none (lift)", fill=(22, 38, 63), font=font(17))
    sheet.save(CHECKS / "snow-globe-motion.png", optimize=True)


if __name__ == "__main__":
    CHECKS.mkdir(parents=True, exist_ok=True)
    make_sizes()
    make_motion()
    print("snow-globe silhouette and motion checks written")
