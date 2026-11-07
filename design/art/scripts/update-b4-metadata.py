#!/usr/bin/env python3
"""Merge B4 art records into the current manifest and README without changing other entries."""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHECKS = ROOT / "_checks"
GENERATION = json.loads((CHECKS / "b4-generation.json").read_text())
MANIFEST = ROOT / "manifest.json"
README = ROOT / "README.md"


def metadata(path, prompt, what, vessel=None, postprocess=None):
    image = Image.open(ROOT / path)
    entry = {
        "path": f"design/art/{path}", "what": what,
        "size_px": list(image.size), "transparent": image.mode in ("RGBA", "LA"),
        "prompt": prompt, "model": "gpt-image-2",
    }
    if vessel is not None:
        entry["vessel"] = vessel
    if postprocess:
        entry["postprocess"] = postprocess
    entry["web_export"] = "public/art/" + path.removesuffix(".png") + ".webp"
    return entry


def main():
    entries = json.loads(MANIFEST.read_text())
    by_path = {entry["path"]: entry for entry in entries}
    for id, data in GENERATION.items():
        spec = json.loads((CHECKS / f"b4-{id}-spec.json").read_text())
        assembled = f"vessels/vessel-{id}.png"
        by_path[f"design/art/{assembled}"] = metadata(
            assembled, data["prompt"], f"Assembled {id} vessel", spec,
            "Composited from complete record and sleeve isolation edits, aligned and downscaled together by finish-b4-vinyl.py; assembled is exactly the at=0 layer stack.",
        )
        for name, part in data["parts"].items():
            path = f"vessels/vessel-{id}-{name}.png"
            by_path[f"design/art/{path}"] = metadata(
                path, part["prompt"], f"Vinyl record in a sleeve — {name} layer",
                postprocess="Aligned with the assembled edit and downscaled on the shared 1024 canvas by finish-b4-vinyl.py.",
            )
    merged = sorted(by_path.values(), key=lambda entry: entry["path"])
    MANIFEST.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n")

    text = README.read_text()
    start = text.index("## Masters\n")
    end = text.index("\n## Review\n", start)
    table = ["## Masters", "", "| File | What | Size | Notes |", "|---|---|---:|---|"]
    for entry in merged:
        rel = entry["path"].removeprefix("design/art/")
        notes = []
        if "pivot" in entry:
            notes.append(f"pivot {entry['pivot']['x']},{entry['pivot']['y']}")
        if "postprocess" in entry:
            notes.append("processed; see manifest")
        if not entry["transparent"]:
            notes.append("opaque")
        table.append(f"| `{rel}` | {entry['what']} | {entry['size_px'][0]}×{entry['size_px'][1]} | {', '.join(notes)} |")
    text = text[:start] + "\n".join(table) + "\n" + text[end:]
    if "- T10d B4 vinyl test:" not in text:
        marker = "- T10a snow-globe test:"
        info = "- T10d B4 vinyl test: a record slides from an abstract sleeve. The complete hidden disc, sleeve and exact assembled CLOSED stack share one 1024 canvas. `_checks/vinyl-motion.png` shows measured opening and anchors; `_checks/vinyl-silhouette.png` shows 40/120 px. Original shapes and abstract sleeve art were checked for text, characters, logos and recognizable brand trade dress. Roy's test-vessel approval is pending.\n"
        text = text.replace(marker, info + marker, 1)
    if "[B4 vinyl motion]" not in text:
        text = text.replace("[Full contact sheet](_checks/contact-sheet.png)", "[Full contact sheet](_checks/contact-sheet.png) · [B4 vinyl motion](_checks/vinyl-motion.png) · [B4 vinyl 40/120 px](_checks/vinyl-silhouette.png)", 1)
    README.write_text(text)
    print("B4 metadata:", len(GENERATION), "vessel(s);", len(merged), "manifest entries")


if __name__ == "__main__":
    main()
