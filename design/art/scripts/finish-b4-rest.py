#!/usr/bin/env python3
"""Align B4 isolation edits, compose exact resting stacks, and render opening reviews."""
import json
import math
import runpy
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
VESSELS = ROOT / "vessels"
CHECKS = ROOT / "_checks"
DATA = json.loads((CHECKS / "b4-generation-rest.json").read_text())
PAPER = (246, 248, 251, 255)
MOTION = runpy.run_path(str(ROOT / "scripts" / "check-batch1.py"))["expanded"]
FRAME = runpy.run_path(str(ROOT / "scripts" / "finish-batch1.py"))["frame"]

# Each crop is a complete gpt-image-2 edit; these four fits only restore its
# original apparent size/position relative to the assembled source.
FIT = {
    ("photo-strip", "strip"): (490, 310, 750, 1070),
    ("rotary-phone", "handset"): (207, 276, 1076, 635),
    ("umbrella", "note"): (573, 479, 719, 716),
    ("umbrella", "strap"): (555, 555, 722, 689),
}
ORDER = {
    "vhs": ("tape", "sleeve"), "photo-strip": ("strip", "sleeve"),
    "arcade": ("cabinet", "screen", "door"),
    "pager": ("body", "screen", "cover"),
    "rotary-phone": ("phone", "handset"),
    "umbrella": ("umbrella", "note", "strap"),
    "love-padlock": ("lock", "shackle"),
    "lucky-stars": ("jar", "lid"),
    "paper-plane": ("plane", "fold"),
}
OPENING = {"vhs": "F", "photo-strip": "F", "arcade": "J", "pager": "F",
           "rotary-phone": "C", "umbrella": "F", "love-padlock": "A",
           "lucky-stars": "G", "paper-plane": "E"}
MOUTH = {"vhs": (615, 495), "photo-strip": (620, 470), "arcade": (520, 900),
         "pager": (590, 560), "rotary-phone": (620, 480), "umbrella": (650, 590),
         "love-padlock": (620, 490), "lucky-stars": (610, 360), "paper-plane": (620, 700)}
SPARKLE = {"vhs": (850, 520), "photo-strip": (620, 740), "arcade": (470, 730),
           "pager": (515, 770), "rotary-phone": (600, 760), "umbrella": (600, 1045),
           "love-padlock": (800, 510), "lucky-stars": (420, 460), "paper-plane": (650, 550)}


def box(im):
    return im.getchannel("A").point(lambda a: 255 if a > 25 else 0).getbbox()


def clean(im):
    im = im.convert("RGBA")
    im.putalpha(im.getchannel("A").point(lambda a: a if a >= 18 else 0))
    return im


def fit(im, target):
    original = box(im)
    crop = im.crop(original)
    width, height = target[2] - target[0], target[3] - target[1]
    assert width <= crop.width and height <= crop.height, (original, target)
    crop = crop.resize((width, height), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", im.size)
    out.alpha_composite(crop, target[:2])
    return out


def normalize(im, s, dx, dy):
    size = round(im.width * s), round(im.height * s)
    small = im.resize(size, Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (1024, 1024))
    out.alpha_composite(small, (round(dx), round(dy)))
    return clean(out)


def paper(im):
    return Image.alpha_composite(Image.new("RGBA", im.size, PAPER), im).convert("RGB")


def layer(name, id, role="static", **extra):
    return {"name": name, "file": f"vessel-{id}-{name}.png", "role": role, **extra}


def make_spec(id, point, base_y):
    P = lambda pair: {"x": point(*pair)[0], "y": point(*pair)[1]}
    common = {"id": id, "opening": OPENING[id], "idleMs": 4000,
              "layers": [], "mouth": P(MOUTH[id]), "baseY": base_y,
              "sparkle": P(SPARKLE[id]), "glint": None, "openGlow": None,
              "readyPulse": None}
    if id == "vhs":
        common["idle"] = [{"type": "bob", "amount": 0.025}]
        common["layers"] = [layer("tape", id, "slide", open=[
            {"at": 0, "x": 0, "y": 0, "scale": 1, "opacity": 1},
            {"at": 0.5, "x": 0.06, "y": -0.07, "scale": 0.84, "opacity": 1},
            {"at": 1, "x": 0.13, "y": -0.21, "scale": 0.63, "opacity": 1},
        ]), layer("sleeve", id)]
    elif id == "photo-strip":
        common["idle"] = [{"type": "sway", "deg": 3, "pivot": P((620, 283))}]
        common["layers"] = [layer("strip", id, "slide", open=[
            {"at": 0, "x": 0, "y": 0, "opacity": 1},
            {"at": 0.5, "x": 0.12, "y": -0.05, "opacity": 1},
            {"at": 1, "x": 0.25, "y": -0.10, "opacity": 1},
        ]), layer("sleeve", id)]
    elif id == "arcade":
        common["idle"] = [{"type": "breathe", "amount": 0.025}]
        common["layers"] = [layer("cabinet", id),
            layer("screen", id, "fade", open=[{"at": 0, "opacity": 0.55}, {"at": 1, "opacity": 1}],
                  idle=[{"type": "glow", "base": 0.55, "range": 0.4, "flicker": 0.08}]),
            layer("door", id, "door", pivot=P((665, 974)), open=[
                {"at": 0, "scaleX": 1, "opacity": 1}, {"at": 1, "scaleX": 0.08, "opacity": 1}])]
    elif id == "pager":
        common["idle"] = [{"type": "tick", "deg": 3, "pivot": {"x": 512, "y": base_y}}]
        common["layers"] = [layer("body", id),
            layer("screen", id, "fade", open=[{"at": 0, "opacity": 0.55}, {"at": 1, "opacity": 1}],
                  idle=[{"type": "glow", "base": 0.55, "range": 0.4}]),
            layer("cover", id, "slide", open=[
                {"at": 0, "x": 0, "y": 0, "scale": 1, "opacity": 1},
                {"at": 0.5, "x": 0.05, "y": -0.10, "scale": 0.85, "opacity": 1},
                {"at": 1, "x": 0.15, "y": -0.37, "scale": 0.68, "opacity": 1}])]
    elif id == "rotary-phone":
        common["idle"] = [{"type": "tick", "deg": 3, "pivot": {"x": 512, "y": base_y}}]
        common["layers"] = [layer("phone", id), layer("handset", id, "lift", open=[
            {"at": 0, "x": 0, "y": 0, "scale": 1, "opacity": 1},
            {"at": 0.5, "x": 0.04, "y": -0.10, "scale": 0.9, "opacity": 1},
            {"at": 1, "x": 0.09, "y": -0.24, "scale": 0.78, "opacity": 1}])]
    elif id == "umbrella":
        common["idle"] = [{"type": "sway", "deg": 3, "pivot": {"x": 512, "y": base_y}}]
        common["layers"] = [layer("umbrella", id), layer("note", id, "slide", open=[
            {"at": 0, "x": 0, "y": 0, "opacity": 1},
            {"at": 0.5, "x": 0.13, "y": -0.04, "opacity": 1},
            {"at": 1, "x": 0.28, "y": -0.08, "opacity": 1}]),
            layer("strap", id, "fade", open=[{"at": 0, "opacity": 1}, {"at": 1, "opacity": 0}])]
    elif id == "love-padlock":
        common["idle"] = [{"type": "sway", "deg": 3, "pivot": P((620, 165))}]
        common["layers"] = [layer("lock", id), layer("shackle", id, "hinge",
            pivot=P((425, 500)), open=[{"at": 0, "rotate": 0},
                                        {"at": 0.5, "rotate": -18},
                                        {"at": 1, "rotate": -36}])]
    elif id == "lucky-stars":
        common["idle"] = [{"type": "breathe", "amount": 0.025}]
        common["glint"] = "vessel-lucky-stars-glint.png"
        common["layers"] = [layer("jar", id), layer("lid", id, "twist",
            pivot=P((609, 300)), open=[
                {"at": 0, "x": 0, "y": 0, "rotate": 0, "opacity": 1},
                {"at": 0.4, "x": 0, "y": 0, "rotate": -12, "opacity": 1},
                {"at": 1, "x": 0.25, "y": -0.10, "rotate": -18, "scale": 0.85, "opacity": 1}])]
    else:
        common["idle"] = [{"type": "float", "amount": 0.03}]
        common["layers"] = [layer("plane", id), layer("fold", id, "hinge",
            pivot=P((625, 540)), open=[{"at": 0, "scaleY": 1},
                                         {"at": 0.5, "scaleY": 0.18},
                                         {"at": 1, "scaleY": -0.8}])]
    return common


def make_glint(jar):
    # Isolate the glass's own white highlights; keep the sparkle separate and soft.
    px = jar.load()
    out = Image.new("RGBA", jar.size)
    op = out.load()
    for y in range(1024):
        for x in range(1024):
            r, g, b, a = px[x, y]
            if a > 35 and r > 214 and g > 222 and b > 229 and b >= r:
                op[x, y] = (246, 248, 251, round(a * 0.52))
    return out.filter(ImageFilter.GaussianBlur(1.4))


def make_review(id, parts, spec):
    sheet = Image.new("RGB", (1240, 690), PAPER[:3])
    d = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 17)
    for i, t in enumerate((0, 0.5, 1)):
        ox = 15 + i * 410
        stage = paper(MOTION(parts, spec, t)).resize((400, 400), Image.Resampling.LANCZOS)
        sheet.paste(stage, (ox, 42))
        d.text((ox + 10, 12), ("CLOSED", "HALF OPEN", "OPEN")[i], fill="#16263F", font=font)
        pts = [(spec["mouth"], "#A3364F"), (spec["sparkle"], "#C9A15A")]
        pts += [(l["pivot"], "#6E2B3F") for l in spec["layers"] if "pivot" in l]
        if spec.get("idle"):
            pts += [(m["pivot"], "#6E2B3F") for m in spec["idle"] if "pivot" in m]
        for p, colour in pts:
            x = ox + round((p["x"] + 256) * 400 / 1536)
            y = 42 + round((p["y"] + 256) * 400 / 1536)
            d.line((x - 5, y, x + 5, y), fill=colour, width=2)
            d.line((x, y - 5, x, y + 5), fill=colour, width=2)
    d.text((18, 460), f"{id} · {spec['opening']} · baseY {spec['baseY']} · mouth {spec['mouth']} · sparkle {spec['sparkle']}", fill="#16263F", font=font)
    yy = 492
    for l in spec["layers"]:
        if "open" in l:
            line = l["name"] + " " + l["role"] + " " + json.dumps(l["open"], separators=(",", ":"))
            for j in range(0, len(line), 120):
                d.text((18, yy), line[j:j + 120], fill="#16263F", font=font)
                yy += 23
    d.text((18, 658), "Crosshairs: plum pivot · wax red mouth · brass sparkle", fill="#16263F", font=font)
    sheet.save(CHECKS / f"{id}-motion.png", optimize=True)


def main():
    reports = {}
    for id, data in DATA.items():
        original = clean(Image.open(data["source"]))
        source_box = box(original)
        w, h = source_box[2] - source_box[0], source_box[3] - source_box[1]
        s = min(1024 / 1254, 740 / w, 780 / h)
        dx = 512 - (source_box[0] + source_box[2]) * s / 2
        dy = 900 - source_box[3] * s
        point = lambda x, y: (round(x * s + dx), round(y * s + dy))
        parts = {}
        for name in ORDER[id]:
            im = clean(Image.open(data["parts"][name]["source"]))
            if (id, name) in FIT:
                im = fit(im, FIT[id, name])
            if id == "love-padlock" and name == "shackle":
                # Let the body own the visible brass hole rings at rest.
                a = im.getchannel("A")
                a.paste(0, (0, 508, 1254, 1254))
                im.putalpha(a)
            if id == "lucky-stars" and name == "jar":
                # Only pale glass fill loses alpha. Folded stars, ink, rim and
                # bright highlights remain opaque and readable.
                px = im.load()
                for yy in range(im.height):
                    for xx in range(im.width):
                        r, g, b, a = px[xx, yy]
                        if 35 < a < 230 and r > 170 and b > r + 10 and b >= g:
                            px[xx, yy] = (r, g, b, round(a * 0.375))
            parts[name] = normalize(im, s, dx, dy)
        provisional = Image.new("RGBA", (1024, 1024))
        for im in parts.values():
            provisional = Image.alpha_composite(provisional, im)
        bounds = box(provisional)
        spec = make_spec(id, point, bounds[3] - 1)
        assembled = FRAME(parts, spec, 0)
        bounds = box(assembled)
        assert bounds[2] - bounds[0] <= 760 and bounds[1] >= 100 and 880 <= bounds[3] - 1 <= 920, (id, bounds)
        spec["baseY"] = bounds[3] - 1
        if id in ("pager", "rotary-phone", "umbrella"):
            spec["idle"][0]["pivot"]["y"] = spec["baseY"]
        for name, im in parts.items():
            im.save(VESSELS / f"vessel-{id}-{name}.png", optimize=True)
        assembled.save(VESSELS / f"vessel-{id}.png", optimize=True)
        if id == "lucky-stars":
            make_glint(parts["jar"]).save(VESSELS / "vessel-lucky-stars-glint.png", optimize=True)
        assert ImageChops.difference(assembled, FRAME(parts, spec, 0)).getbbox() is None
        all_images = [assembled, *parts.values()]
        assert all(im.getchannel("A").getpixel(p) == 0 for im in all_images
                   for p in ((0, 0), (1023, 0), (0, 1023), (1023, 1023))), id
        for l in spec["layers"]:
            if l["role"] != "static":
                assert l.get("open"), (id, l)
                if l["open"][-1].get("opacity", 1) > 0:
                    solo = MOTION({l["name"]: parts[l["name"]]}, {"layers": [l]}, 1)
                    full = box(solo)
                    assert full and all(v >= 256 for v in full[:2]) and all(v <= 1280 for v in full[2:]), (id, l["name"], full)
        make_review(id, parts, spec)
        strip = Image.new("RGB", (360, 180), PAPER[:3])
        d = ImageDraw.Draw(strip)
        for n, x in ((40, 40), (120, 180)):
            small = paper(assembled.resize((n, n), Image.Resampling.LANCZOS))
            strip.paste(small, (x, 10))
            d.text((x, 145), f"{n} px", fill="#16263F")
            paper(assembled).resize((n, n), Image.Resampling.LANCZOS).save(CHECKS / f"{id}-at-{n}px.png")
        strip.save(CHECKS / f"{id}-silhouette.png", optimize=True)
        assembled.save(CHECKS / f"{id}-stack.png", optimize=True)
        (CHECKS / f"b4-{id}-spec.json").write_text(json.dumps(spec, indent=2) + "\n")
        report = {"canvas": [1024, 1024], "bbox": bounds,
                  "corners_alpha_zero": True, "rest_stack_exact": True,
                  "baseY": spec["baseY"], "layers": list(parts),
                  "ip_review": "Original, no logos, text, characters or brand trade dress; checked against vessels-50 rejected list."}
        (CHECKS / f"{id}-check.json").write_text(json.dumps(report, indent=2) + "\n")
        reports[id] = report
        print(id, "bbox", bounds, "layers", list(parts))
    (CHECKS / "b4-validation.json").write_text(json.dumps(reports, indent=2) + "\n")


if __name__ == "__main__":
    main()
