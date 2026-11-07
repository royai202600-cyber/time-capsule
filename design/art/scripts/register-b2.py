#!/usr/bin/env python3
"""Merge B2 art records into the current manifest and README without dropping other batches."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CHECKS = ROOT / "_checks"
IDS = (
    "clock-tower", "senado-fountain", "bamboo-tower", "gate-lantern",
    "torii-scroll", "palace-pavilion", "lionfish-fountain", "golden-roof",
    "gate-lacquer", "twin-towers",
)
LABELS = {
    "clock-tower": "small standing clock-tower keepsake",
}
PAPER = (246, 248, 251, 255)


def main():
    manifest_path = ROOT / "manifest.json"
    entries = json.loads(manifest_path.read_text())
    prompts = {}
    for path in CHECKS.glob("t10b-*-prompts.json"):
        prompts.update(json.loads(path.read_text()))
    specs = {}
    for path in CHECKS.glob("t10b-*-spec.json"):
        spec = json.loads(path.read_text())
        specs[f"vessels/vessel-{spec['id']}.png"] = spec
    if not specs:
        raise SystemExit("No B2 specs found")

    updated = {entry["path"]: entry for entry in entries}
    for rel, prompt in prompts.items():
        id = next((candidate for candidate in IDS if rel.startswith(f"vessels/vessel-{candidate}")), None)
        if id is None or f"vessels/vessel-{id}.png" not in specs:
            continue
        file = ROOT / rel
        if not file.exists():
            raise FileNotFoundError(file)
        image = Image.open(file).convert("RGBA")
        part = Path(rel).stem.removeprefix(f"vessel-{id}").lstrip("-")
        what = f"Assembled {LABELS.get(id, id.replace('-', ' '))} vessel" if not part else f"{LABELS.get(id, id.replace('-', ' ')).title()} — {part} layer"
        record = {
            "path": f"design/art/{rel}", "what": what,
            "size_px": list(image.size), "transparent": True,
            "prompt": prompt, "model": "gpt-image-2",
            "postprocess": "finish-clock-tower.py: registered layer masking and common 1254-to-1024 transform; closed master composites the at=0 keys." if id == "clock-tower" else "See B2 finishing script and motion sheet.",
            "web_export": "public/art/" + rel.removesuffix(".png") + ".webp",
        }
        if rel in specs:
            record["vessel"] = specs[rel]
        updated[record["path"]] = record
    records = sorted(updated.values(), key=lambda entry: entry["path"])
    manifest_path.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")

    readme_path = ROOT / "README.md"
    readme = readme_path.read_text()
    prefix, rest = readme.split("## Masters\n", 1)
    _, review = rest.split("## Review\n", 1)
    current_ids = [id for id in IDS if f"vessels/vessel-{id}.png" in prompts]
    for id in current_ids:
        marker = "Place IDs:"
        if f", {id}. {marker}" not in prefix:
            prefix = prefix.replace(f". {marker}", f", {id}. {marker}", 1)
    note = "- T10b B2 landmark vessels are original souvenir objects inspired by place materials and architecture, not exact replicas. The clock-tower test uses a complete revealed letter compartment, an exact at=0 stack, a side-pivot door and fading/spinning hands; see `_checks/clock-tower-motion.png` and `_checks/clock-tower-silhouette.png`. Roy's test approval is pending.\n"
    if "T10b B2 landmark vessels" not in prefix:
        prefix = prefix.replace("## Masters\n", note + "\n## Masters\n") if "## Masters\n" in prefix else prefix + note + "\n"
    lines = [
        "## Masters", "", "| File | What | Size | Notes |",
        "|---|---|---:|---|",
    ]
    for entry in records:
        rel = entry["path"].removeprefix("design/art/")
        notes = []
        if "pivot" in entry:
            notes.append(f"pivot {entry['pivot']['x']},{entry['pivot']['y']}")
        if "postprocess" in entry:
            notes.append("processed; see manifest")
        if not entry["transparent"]:
            notes.append("opaque")
        lines.append(f"| `{rel}` | {entry['what']} | {entry['size_px'][0]}×{entry['size_px'][1]} | {', '.join(notes)} |")
    if "[B2 contact sheet]" not in review:
        review = review.replace("[Full contact sheet]", "[B2 contact sheet](_checks/b2-contact-sheet.png) · [Clock-tower motion](_checks/clock-tower-motion.png) · [Clock-tower 40/120 px](_checks/clock-tower-silhouette.png) · [Full contact sheet]", 1)
    readme_path.write_text(prefix.rstrip() + "\n\n" + "\n".join(lines) + "\n\n## Review\n" + review)

    # Compact batch-only sheet; future B2 vessels fill its remaining cards.
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
    present = [id for id in IDS if (ROOT / f"vessels/vessel-{id}.png").exists()]
    width, card_w, card_h = 5 * 220, 220, 250
    sheet = Image.new("RGB", (width, 55 + ((len(present) + 4) // 5) * card_h), PAPER[:3])
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 15), f"B2 LANDMARK VESSELS  ·  {len(present)}/10", fill="#16263F", font=font)
    for index, id in enumerate(present):
        x, y = (index % 5) * card_w, 55 + (index // 5) * card_h
        draw.rounded_rectangle((x + 7, y + 7, x + 213, y + 243), radius=10, fill="white", outline="#DCE8F2")
        image = Image.open(ROOT / f"vessels/vessel-{id}.png").convert("RGBA")
        image.thumbnail((190, 195), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", image.size, PAPER)
        tile.alpha_composite(image)
        sheet.paste(tile.convert("RGB"), (x + (card_w - image.width) // 2, y + 12 + (195 - image.height) // 2))
        draw.text((x + 17, y + 216), id, fill="#16263F", font=font)
    sheet.save(CHECKS / "b2-contact-sheet.png", optimize=True)
    print("registered", len(current_ids), "B2 vessel(s) in", len(records), "manifest entries")


if __name__ == "__main__":
    main()
