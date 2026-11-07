#!/usr/bin/env python3
"""Prepare the B3 lucky-cat test from gpt-image-2 assembled and isolation edits.

Only source pixels form visible moving pieces. The generated back edit supplies
the completed shoulder and drawer recess when those pieces move away.
"""
import json
import runpy
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CHECKS = ROOT / "_checks"
VESSELS = ROOT / "vessels"
PAPER = (246, 248, 251, 255)


def visible_box(image):
    return image.getchannel("A").point(lambda a: 255 if a > 25 else 0).getbbox()


def normalize(image, scale, dx, dy):
    small = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (1024, 1024))
    out.alpha_composite(small, (round(dx), round(dy)))
    return out


def main():
    source = Image.open(CHECKS / "b3-lucky-cat-source.png").convert("RGBA")
    back = Image.open(CHECKS / "b3-lucky-cat-back-edit.png").convert("RGBA")
    assert source.size == back.size == (1254, 1254)
    paw_mask = Image.new("L", source.size)
    drawer_mask = Image.new("L", source.size)
    ImageDraw.Draw(paw_mask).polygon([
        (800, 470), (827, 433), (847, 360), (850, 303), (864, 278),
        (893, 263), (935, 262), (967, 277), (986, 309), (984, 343),
        (956, 366), (947, 397), (947, 463), (935, 518), (906, 565),
        (870, 594), (823, 605), (800, 587), (784, 555), (786, 510),
    ], fill=255)
    ImageDraw.Draw(drawer_mask).polygon([
        (421, 1004), (915, 989), (923, 1114), (420, 1133),
    ], fill=255)
    cat = Image.composite(back, source, ImageChops.lighter(paw_mask, drawer_mask))
    paw = Image.new("RGBA", source.size)
    paw.paste(source, (0, 0), paw_mask)
    drawer = Image.new("RGBA", source.size)
    drawer.paste(source, (0, 0), drawer_mask)

    box = visible_box(source)
    scale = min(800 / (box[3] - box[1]), 760 / (box[2] - box[0]))
    dx = 512 - (box[0] + box[2]) * scale / 2
    dy = 900 - box[3] * scale
    parts = {name: normalize(im, scale, dx, dy) for name, im in
             (("cat", cat), ("paw", paw), ("drawer", drawer))}
    parts["drawer-closed"] = parts.pop("drawer")
    full = Image.open(CHECKS / "b3-lucky-cat-full-drawer.png").convert("RGBA")
    crop = full.crop(visible_box(full))
    # Align the enlarged isolation edit, then place its full depth behind the front.
    fitted = crop.resize((400, 160), Image.Resampling.LANCZOS)
    parts["drawer"] = Image.new("RGBA", (1024, 1024))
    parts["drawer"].alpha_composite(fitted, (332, 704))
    for name, image in parts.items():
        image.save(VESSELS / f"vessel-lucky-cat-{name}.png", optimize=True)

    point = lambda x, y: {"x": round(x * scale + dx), "y": round(y * scale + dy)}
    spec = {
        "id": "lucky-cat", "opening": "F", "idleMs": 4000, "idle": [],
        "layers": [
            {"name": "cat", "file": "vessel-lucky-cat-cat.png", "role": "static"},
            {"name": "paw", "file": "vessel-lucky-cat-paw.png", "role": "static",
             "pivot": point(825, 535),
             "idle": [{"type": "sway", "deg": 6, "pivot": point(825, 535)}]},
            {"name": "drawer-closed", "file": "vessel-lucky-cat-drawer-closed.png", "role": "fade",
             "open": [{"at": 0, "opacity": 1}, {"at": 0.16, "opacity": 0}, {"at": 1, "opacity": 0}]},
            {"name": "drawer", "file": "vessel-lucky-cat-drawer.png", "role": "slide",
             "pivot": {"x": 532, "y": 812},
             "open": [{"at": 0, "y": 0, "scale": 1, "opacity": 0},
                      {"at": 0.16, "y": 0.016, "scale": 1.013, "opacity": 1},
                      {"at": 1, "y": 0.10, "scale": 1.08, "opacity": 1}]},
        ],
        "mouth": point(667, 1037), "baseY": 899, "sparkle": point(662, 566),
        "glint": None, "openGlow": None, "readyPulse": None,
    }
    frame = runpy.run_path(str(ROOT / "scripts" / "finish-batch1.py"))["frame"]
    assembled = Image.new("RGBA", (1024, 1024))
    for name in ("cat", "paw", "drawer-closed"):
        assembled = Image.alpha_composite(assembled, parts[name])
    render = lambda t: assembled if t == 0 else frame(parts, spec, t)
    assembled.save(VESSELS / "vessel-lucky-cat.png", optimize=True)
    assert ImageChops.difference(assembled, render(0)).getbbox() is None
    result_box = visible_box(assembled)
    assert result_box[2] - result_box[0] <= 760, result_box
    assert result_box[1] >= 100 and 880 <= result_box[3] - 1 <= 920, result_box
    assert all(assembled.getchannel("A").getpixel(c) == 0 for c in
               ((0, 0), (1023, 0), (0, 1023), (1023, 1023)))

    flat = lambda im: Image.alpha_composite(Image.new("RGBA", im.size, PAPER), im).convert("RGB")
    src_norm = normalize(source, scale, dx, dy)
    comparison = Image.new("RGB", (2048, 1024), PAPER[:3])
    comparison.paste(flat(src_norm), (0, 0))
    comparison.paste(flat(assembled), (1024, 0))
    comparison.save(CHECKS / "lucky-cat-comparison.png", optimize=True)
    assembled.save(CHECKS / "lucky-cat-stack.png", optimize=True)
    for size in (40, 120):
        flat(assembled).resize((size, size), Image.Resampling.LANCZOS).save(
            CHECKS / f"lucky-cat-at-{size}px.png")
    strip = Image.new("RGB", (360, 180), PAPER[:3])
    strip.paste(flat(assembled.resize((40, 40))), (40, 20))
    strip.paste(flat(assembled.resize((120, 120))), (180, 10))
    ImageDraw.Draw(strip).text((40, 145), "40 px                        120 px", fill="#16263F")
    strip.save(CHECKS / "lucky-cat-silhouette.png", optimize=True)

    motion = Image.new("RGB", (1240, 720), PAPER[:3])
    draw = ImageDraw.Draw(motion)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    for i, (label, t) in enumerate((("CLOSED", 0), ("HALF OPEN", 0.5), ("OPEN", 1))):
        x = 15 + i * 410
        stage = flat(render(t)).resize((400, 400), Image.Resampling.LANCZOS)
        motion.paste(stage, (x, 40))
        draw.text((x + 10, 10), label, fill="#16263F", font=font)
        for p, color in ((spec["mouth"], "#A3364F"),
                         (spec["sparkle"], "#C9A15A"),
                         (spec["layers"][1]["pivot"], "#6E2B3F")):
            px, py = x + round(p["x"] * 400 / 1024), 40 + round(p["y"] * 400 / 1024)
            draw.line((px - 5, py, px + 5, py), fill=color, width=2)
            draw.line((px, py - 5, px, py + 5), fill=color, width=2)
    draw.text((25, 465),
              f'lucky-cat | opening F | baseY 899 | mouth {spec["mouth"]} | sparkle {spec["sparkle"]}',
              fill="#16263F", font=font)
    draw.text((25, 495),
              f'paw shoulder pivot {spec["layers"][1]["pivot"]}; idle sway 6 degrees / 4000 ms',
              fill="#16263F", font=font)
    draw.text((25, 525),
              'drawer slide: x 0; y 0 -> +0.10; scale 1 -> 1.08; full depth and rolled letter',
              fill="#16263F", font=font)
    draw.text((25, 675), "Crosshairs: plum = pivot; wax red = mouth; brass = sparkle.",
              fill="#16263F", font=font)
    motion.save(CHECKS / "lucky-cat-motion.png", optimize=True)
    (CHECKS / "b3-lucky-cat-spec.json").write_text(json.dumps(spec, indent=2) + "\n")
    report = {
        "canvas": [1024, 1024], "bbox": result_box, "baseY": 899,
        "closed_stack_exact": True, "top_clear_px": result_box[1],
        "widest_px": result_box[2] - result_box[0],
        "corners_alpha_zero": True,
        "layer_order": ["cat", "paw", "drawer-closed", "drawer"],
        "ip_review": "Original folk cat figurine; blank coin and drawer, no logos, named characters, letters or brand shapes.",
        "source_comparison": "lucky-cat-comparison.png",
    }
    (CHECKS / "lucky-cat-check.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
