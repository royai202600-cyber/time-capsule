#!/usr/bin/env python3
"""Align the snow-globe edits on one canvas and remove glass-edit residue.

Usage: finish-snow-globe.py ASSEMBLED BASE SCENE SNOW GLOBE
The five inputs are native 1254-square gpt-image-2 outputs. This script only
resamples down, aligns the revealed pedestal, isolates the glass rim, and
composites the approved layer order. It does not redraw an illustration.
"""

import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "vessels"
SIZE = 1254
TARGET = 1024
SHIFT_Y = 36


def clean(image: Image.Image, cutoff: int = 15) -> Image.Image:
    image = image.convert("RGBA")
    image.putalpha(image.getchannel("A").point(lambda alpha: alpha if alpha >= cutoff else 0))
    return image


def finish(image: Image.Image) -> Image.Image:
    image = image.resize((TARGET, TARGET), Image.Resampling.LANCZOS)
    shifted = Image.new("RGBA", (TARGET, TARGET))
    shifted.alpha_composite(image, (0, SHIFT_Y))
    return clean(shifted, 4)


def pedestal(image: Image.Image) -> Image.Image:
    # The edit revealed the covered top of the pedestal, but enlarged it.
    # Fit its visible footprint to the assembled base, with the same bottom.
    box = image.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox()
    crop = image.crop(box)
    new_width = 580
    new_height = round(crop.height * new_width / crop.width)
    crop = crop.resize((new_width, new_height), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (SIZE, SIZE))
    output.alpha_composite(crop, ((SIZE - new_width) // 2, 1060 - new_height))
    return clean(output, 20)


def clear_globe(image: Image.Image) -> Image.Image:
    """Keep the edited glass rim and highlights; replace erasure residue.

    The image edit left faint rainbow pixels where it erased the cottage.
    A subtle glass-blue interior is put under the retained rim. Pixels with
    alpha below 200 are reduced to 37.5% after the mask, per STYLE.md.
    """
    source = image.convert("RGBA")
    result = Image.new("RGBA", (SIZE, SIZE))
    drawer = ImageDraw.Draw(result)
    drawer.ellipse((250, 164, 987, 895), fill=(220, 232, 242, 64))
    src = source.load()
    dst = result.load()
    cx, cy, rx, ry = 616.5, 529.5, 370.5, 366.0
    for y in range(155, 906):
        for x in range(238, 998):
            r = (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) ** 0.5
            red, green, blue, alpha = src[x, y]
            if alpha < 20:
                continue
            # Retain the clean edge ring. Fade its inner edge to avoid a seam.
            edge = min(1.0, max(0.0, (r - 0.865) / 0.045))
            # The original white glints dip inside the outer ring.
            white_glint = x < 595 and y < 445 and red >= 242 and green >= 242 and blue >= 242 and alpha >= 80
            if white_glint:
                edge = 1.0
            if edge > 0:
                dst[x, y] = (red, green, blue, round(alpha * edge))
    # STYLE.md glass rule: faint fill, preserve strong ink and white highlight.
    pixels = result.load()
    for y in range(155, 906):
        for x in range(238, 998):
            red, green, blue, alpha = pixels[x, y]
            if alpha < 200:
                pixels[x, y] = (red, green, blue, round(alpha * 0.375))
    return clean(result, 4)


def inside_globe(image: Image.Image) -> Image.Image:
    """Keep the winter scene and drifting snow inside the glass footprint."""
    image = image.copy()
    pixels = image.load()
    cx, cy, rx, ry = 616.5, 529.5, 370.5, 366.0
    for y in range(SIZE):
        for x in range(SIZE):
            red, green, blue, alpha = pixels[x, y]
            if not alpha:
                continue
            r = (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) ** 0.5
            keep = min(1.0, max(0.0, (0.965 - r) / 0.025))
            pixels[x, y] = (red, green, blue, round(alpha * keep))
    return image


def make_glint(globe: Image.Image) -> Image.Image:
    """Extract the existing upper-left white reflection for idle travel."""
    pix = globe.load()
    alpha = Image.new("L", globe.size)
    mask = alpha.load()
    for y in range(170, 450):
        for x in range(230, 520):
            red, green, blue, opacity = pix[x, y]
            if red > 235 and green > 235 and blue > 235 and opacity > 60:
                mask[x, y] = round(opacity * 0.52)
    alpha = alpha.filter(ImageFilter.GaussianBlur(2))
    result = Image.new("RGBA", globe.size, (245, 250, 255, 0))
    result.putalpha(alpha)
    return clean(result, 3)


def small_snow():
    """Roy-approved scripted replacement: 22 pale falling particles."""
    im = Image.new("RGBA", (1024,1024))
    d = ImageDraw.Draw(im)
    points = [(392,244,3),(477,234,2),(574,259,3),(635,299,2),(337,312,3),
              (425,330,2),(529,307,4),(590,359,2),(678,381,3),(290,418,2),
              (393,415,3),(483,389,2),(557,437,3),(712,467,2),(324,509,3),
              (421,491,2),(615,506,3),(687,561,2),(366,577,3),(512,572,2),
              (574,633,2),(432,653,3)]
    for x,y,r in points:
        d.ellipse((x-r-1,y-r-1,x+r+1,y+r+1),fill=(169,203,230,155))
        d.ellipse((x-r,y-r,x+r,y+r),fill=(255,255,255,235))
    return im.filter(ImageFilter.GaussianBlur(.5))


def main() -> None:
    if len(sys.argv) != 6:
        raise SystemExit(__doc__)
    assembled, base, scene, snow, globe = [Image.open(path).convert("RGBA") for path in sys.argv[1:]]
    if any(image.size != (SIZE, SIZE) for image in (assembled, base, scene, snow, globe)):
        raise SystemExit("all source images must share the native 1254 square canvas")
    OUT.mkdir(parents=True, exist_ok=True)
    parts = {
        "base": finish(pedestal(base)),
        "scene": finish(inside_globe(clean(scene, 15))),
        "snow": small_snow(),
        "globe": finish(clear_globe(globe)),
    }
    make_glint(parts["globe"]).save(OUT / "vessel-snow-globe-glint.png", optimize=True)
    stack = Image.new("RGBA", (TARGET, TARGET))
    for name, part in parts.items():
        part.save(OUT / f"vessel-snow-globe-{name}.png", optimize=True)
        stack = Image.alpha_composite(stack, part)
    # The final resting view must match the actual layer stack exactly.
    stack.save(OUT / "vessel-snow-globe.png", optimize=True)
    print("saved snow globe and four aligned layers; base bbox", parts["base"].getbbox())


if __name__ == "__main__":
    main()
