#!/usr/bin/env python3
"""Add only B3 art to the shared manifest/README, preserving other batches."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent.parent
CHECKS = ROOT / "_checks"
ID = "lucky-cat"
PARTS = ("cat", "paw", "drawer")
WHAT = {
    "": "Assembled original folk lucky-cat vessel",
    "cat": "Lucky-cat fixed figurine and completed drawer recess",
    "paw": "Lucky-cat raised foreleg with brass shoulder pin",
    "drawer": "Lucky-cat sliding drawer front",
}


def main():
    prompts = json.loads((CHECKS / "b3-lucky-cat-prompts.json").read_text())
    spec = json.loads((CHECKS / "b3-lucky-cat-spec.json").read_text())
    manifest_path = ROOT / "manifest.json"
    entries = json.loads(manifest_path.read_text())
    for part in ("", *PARTS):
        filename = f"vessel-{ID}" + (f"-{part}" if part else "") + ".png"
        rel = f"vessels/{filename}"
        path = f"design/art/{rel}"
        image = Image.open(ROOT / rel).convert("RGBA")
        assert image.size == (1024, 1024)
        assert all(image.getchannel("A").getpixel(p) == 0 for p in
                   ((0, 0), (1023, 0), (0, 1023), (1023, 1023)))
        entry = {
            "path": path, "what": WHAT[part], "size_px": [1024, 1024],
            "transparent": True, "prompt": prompts[rel], "model": "gpt-image-2",
            "web_export": f"public/art/vessels/{filename[:-4]}.webp",
            "postprocess": "finish-b3-lucky-cat.py: downscale all layers together; use assembled pixels for moving pieces and the generated back edit for the shoulder and drawer recess.",
        }
        if not part:
            entry["vessel"] = spec
        if part == "paw":
            entry["pivot"] = spec["layers"][1]["pivot"]
        entries = [item for item in entries if item["path"] != path]
        entries.append(entry)
        image.resize((512, 512), Image.Resampling.LANCZOS).save(
            REPO / "public" / "art" / "vessels" / (filename[:-4] + ".webp"),
            "WEBP", quality=85, method=6)
    entries.sort(key=lambda item: item["path"])
    manifest_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")

    readme_path = ROOT / "README.md"
    readme = readme_path.read_text()
    if "lucky-cat" not in readme.split("Place IDs:")[0]:
        readme = readme.replace(
            "hourglass, gashapon. Place IDs:",
            "hourglass, gashapon, lucky-cat. Place IDs:")
    note = ("- T10c B3 lucky-cat test: original folk figurine with a blank coin, separate raised foreleg, "
            "and an opening base drawer. All layers share one 1024 canvas; the back edit completes the "
            "shoulder and drawer recess. The 40/120 px strip, exact resting stack, motion sheet and IP "
            "review are in `_checks/lucky-cat-*`. Roy's test approval is pending.\n")
    if note not in readme:
        readme = readme.replace("- The built-in image tool returned the map", note + "- The built-in image tool returned the map")
    for part in ("", *PARTS):
        filename = f"vessel-{ID}" + (f"-{part}" if part else "") + ".png"
        row = f"| `vessels/{filename}` | {WHAT[part]} | 1024×1024 | processed; see manifest |"
        if row not in readme:
            anchor = "| `vessels/vessel-maison-"
            readme = readme.replace(anchor, row + "\n" + anchor, 1)
    if "[B3 lucky-cat motion]" not in readme:
        readme = readme.replace(
            "[Full contact sheet](_checks/contact-sheet.png)",
            "[Full contact sheet](_checks/contact-sheet.png) · [B3 lucky-cat motion](_checks/lucky-cat-motion.png) · [B3 contact sheet](_checks/b3-contact-sheet.png)")
    readme_path.write_text(readme)

    images = [Image.open(ROOT / "vessels" / ("vessel-lucky-cat" + (f"-{part}" if part else "") + ".png")).convert("RGBA")
              for part in ("", *PARTS)]
    sheet = Image.new("RGB", (4 * 245, 260), (246, 248, 251))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    for i, (label, image) in enumerate(zip(("CLOSED", "CAT / RECESS", "PAW", "DRAWER"), images)):
        thumb = image.resize((220, 220), Image.Resampling.LANCZOS)
        paper = Image.new("RGBA", thumb.size, (246, 248, 251, 255))
        paper.alpha_composite(thumb)
        sheet.paste(paper.convert("RGB"), (i * 245 + 12, 8))
        draw.text((i * 245 + 12, 232), label, fill="#16263F", font=font)
    sheet.save(CHECKS / "b3-contact-sheet.png", optimize=True)
    print("Registered lucky-cat art, WebP exports, README, and B3 contact sheet.")


if __name__ == "__main__":
    main()
