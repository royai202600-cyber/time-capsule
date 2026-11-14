#!/usr/bin/env python3
"""Audit every PNG master for size, alpha, stamp color, and paper seams."""

import argparse
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OPAQUE = {
    "style-sheet.png", "style-sheet-a.png", "style-sheet-b.png", "style-sheet-c.png",
    "map-asia.png", "app-icon.png", "icon-reference.png",
    "textures/paper.png", "textures/paper-letter.png",
    "hunt-covers/hunt-cover-park.png",
    "journey/passport-cover.png", "journey/passport-page.png", "cabinet/cabinet-wall.png",
}


def expected_size(rel: str) -> tuple[int, int]:
    if rel.startswith("hunt-covers/"):
        return (1280, 720)
    tiles = {"cabinet/cabinet-crown.png": (1024, 256), "cabinet/cabinet-row.png": (1024, 384), "cabinet/cabinet-base.png": (1024, 192)}
    if rel in tiles:
        return tiles[rel]
    if rel.startswith("scenes/") or rel.startswith("style-sheet"):
        return (1536, 1024)
    if rel.startswith("journey/") or rel.startswith("cabinet/"):
        return (1024, 1536)
    if rel == "map-asia.png":
        return (1254, 1254)  # highest native square returned by built-in image tool
    return (1024, 1024)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', nargs='+', help='Audit only these paths relative to design/art.')
    parser.add_argument('--report', default='assets.json', help='Report filename under _checks/.')
    args = parser.parse_args()
    results = []
    for path in sorted(ROOT.rglob("*.png")):
        if "_checks" in path.parts:
            continue
        rel = str(path.relative_to(ROOT))
        if args.only and rel not in args.only:
            continue
        image = Image.open(path).convert("RGBA")
        alpha = image.getchannel("A")
        corners = [alpha.getpixel(p) for p in ((0, 0), (image.width - 1, 0),
                                               (0, image.height - 1), (image.width - 1, image.height - 1))]
        opaque = rel in OPAQUE
        checks = {
            "size": image.size == expected_size(rel),
            "alpha": all(v == 255 for v in alpha.getextrema()) if opaque else all(v == 0 for v in corners),
        }
        if rel.startswith("stamps/"):
            data = image.tobytes()
            visible_colors = {data[i:i + 3] for i in range(0, len(data), 4) if data[i + 3] > 0}
            checks["one_ink_color"] = len(visible_colors) == 1
        if rel.startswith("textures/"):
            rgb = image.convert("RGB")
            checks["tile_seams"] = all(rgb.getpixel((0, y)) == rgb.getpixel((1023, y)) for y in range(1024)) and all(
                rgb.getpixel((x, 0)) == rgb.getpixel((x, 1023)) for x in range(1024))
        results.append({"path": rel, "size": list(image.size), "transparent": not opaque,
                        "corners_alpha": corners, "checks": checks, "pass": all(checks.values())})
    report = {"count": len(results), "passed": sum(item["pass"] for item in results),
              "failed": [item["path"] for item in results if not item["pass"]], "assets": results}
    if args.only and {item['path'] for item in results} != set(args.only):
        raise ValueError('One or more --only assets were not found')
    checks_path = ROOT / "_checks" / args.report
    checks_path.write_text(json.dumps(report, indent=2) + "\n")
    print(f"{report['passed']}/{report['count']} PNG masters pass", "failures:", report["failed"])
    if report["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
