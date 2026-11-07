#!/usr/bin/env python3
"""Validate the two A2 effect masters and render their requested size tests."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / "_checks" / "idle-glint-review.png"
PAPER = (246, 248, 251, 255)
NAVY = (22, 38, 63, 255)


def font(size: int):
    for candidate in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def load(relative: str) -> Image.Image:
    return Image.open(ROOT / relative).convert("RGBA")


def paste_scaled(canvas: Image.Image, vessel: Image.Image, effect: Image.Image, size: int,
                 left: int, top: int, point: tuple[int, int] | None = None,
                 effect_size: int | None = None) -> None:
    vessel_small = vessel.resize((size, size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(vessel_small, (left, top))
    if point is None:
        overlay = effect.resize((size, size), Image.Resampling.LANCZOS)
        canvas.alpha_composite(overlay, (left, top))
    else:
        assert effect_size is not None
        overlay = effect.resize((effect_size, effect_size), Image.Resampling.LANCZOS)
        cx = left + round(point[0] * size / 1024)
        cy = top + round(point[1] * size / 1024)
        canvas.alpha_composite(overlay, (cx - effect_size // 2, cy - effect_size // 2))


def main() -> None:
    dome = load("vessels/vessel-dome.png")
    dome_glint = load("vessels/vessel-dome-glint.png")
    glass = load("vessels/vessel-dome-glass.png")
    fx = load("fx/fx-glint.png")
    envelope = load("vessels/vessel-envelope.png")
    tin = load("vessels/vessel-tin.png")

    for name, image in (("dome glint", dome_glint), ("fx glint", fx)):
        assert image.size == (1024, 1024), f"{name}: wrong size"
        alpha = image.getchannel("A")
        assert all(alpha.getpixel(point) == 0 for point in ((0, 0), (1023, 0), (0, 1023), (1023, 1023))), f"{name}: opaque corner"
    assert dome_glint.getchannel("A").getextrema()[1] <= 179, "Dome glint exceeds 70% alpha"
    glint_box = dome_glint.getchannel("A").point(lambda a: 255 if a >= 8 else 0).getbbox()
    assert glint_box is not None and 290 <= glint_box[0] <= 380 and glint_box[2] < 500, f"Dome glint is off the left glass: {glint_box}"
    glass_box = glass.getchannel("A").getbbox()
    assert glass_box is not None and glass_box[0] <= glint_box[0] and glint_box[2] <= glass_box[2], "Glint outside glass width"
    fx_box = fx.getchannel("A").point(lambda a: 255 if a >= 8 else 0).getbbox()
    assert fx_box is not None and 250 < fx_box[0] < 450 and 580 < fx_box[2] < 800, f"FX size/center wrong: {fx_box}"

    canvas = Image.new("RGBA", (1450, 800), PAPER)
    draw = ImageDraw.Draw(canvas)
    title = font(28)
    label = font(19)
    draw.text((35, 26), "A2 idle glint review", fill=NAVY, font=title)
    draw.text((35, 70), "Dome: compare original with separate highlight stacked", fill=NAVY, font=label)
    canvas.alpha_composite(dome.resize((120, 120), Image.Resampling.LANCZOS), (48, 145))
    paste_scaled(canvas, dome, dome_glint, 120, 198, 145)
    canvas.alpha_composite(dome.resize((240, 240), Image.Resampling.LANCZOS), (425, 100))
    paste_scaled(canvas, dome, dome_glint, 240, 700, 100)
    draw.text((50, 275), "Original · 120", fill=NAVY, font=label)
    draw.text((195, 275), "+ Glint · 120", fill=NAVY, font=label)
    draw.text((460, 348), "Original · 240", fill=NAVY, font=label)
    draw.text((747, 348), "+ Glint · 240", fill=NAVY, font=label)
    draw.rectangle((1050, 100, 1330, 370), fill=NAVY)
    canvas.alpha_composite(dome_glint.resize((240, 240), Image.Resampling.LANCZOS), (1070, 110))
    draw.text((1060, 380), "Glint layer only", fill=NAVY, font=label)
    draw.line((35, 425, 1415, 425), fill=(201, 161, 90, 255), width=2)
    draw.text((35, 443), "Sparkle on seal and tin lid edge", fill=NAVY, font=label)

    placements = (
        (envelope, (475, 545), 16, 45, "Envelope · 16 px"),
        (envelope, (475, 545), 24, 345, "Envelope · 24 px"),
        (tin, (350, 460), 16, 650, "Tin · 16 px"),
        (tin, (350, 460), 24, 950, "Tin · 24 px"),
    )
    for vessel, point, effect_size, left, caption in placements:
        paste_scaled(canvas, vessel, fx, 235, left, 490, point, effect_size)
        draw.text((left, 745), caption, fill=NAVY, font=label)

    CHECK.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(CHECK)
    print(f"PASS: transparent corners; dome alpha <=179; glint on left glass {glint_box}; centred fx {fx_box}")
    print(f"Review overlay: {CHECK.relative_to(ROOT)} ({canvas.width}x{canvas.height})")


if __name__ == "__main__":
    main()
