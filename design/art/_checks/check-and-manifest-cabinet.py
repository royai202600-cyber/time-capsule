#!/usr/bin/env python3
"""Run the existing art audit/manifest scripts with A3 dimensions in scope.

The task explicitly limits changed paths, so this wrapper supplies the three new
tile sizes and descriptions without editing the shared scripts.
"""

import importlib.util
import json
import sys
from pathlib import Path
from PIL import Image

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
CHECKS = ROOT / "_checks"
GEOMETRY = {
    "cabinet/cabinet-crown.png": {
        "height": 256, "stretch_zone_x": [176, 848],
        "posts_x": {"left_outer": 25, "left_inner": 89, "right_inner": 935, "right_outer": 999},
    },
    "cabinet/cabinet-row.png": {
        "height": 384, "stretch_zone_x": [176, 848],
        "posts_x": {"left_outer": 25, "left_inner": 89, "right_inner": 935, "right_outer": 999},
        "standing_surface_y": 300, "plaque_face_y": [300, 352],
        "usable_x": [112, 912],
    },
    "cabinet/cabinet-base.png": {
        "height": 192, "stretch_zone_x": [176, 848],
        "posts_x": {"left_outer": 25, "left_inner": 89, "right_inner": 935, "right_outer": 999},
    },
}
DESCRIPTIONS = {
    "cabinet/cabinet-crown.png": "Tiling cabinet crown with brass finials",
    "cabinet/cabinet-row.png": "One repeatable cabinet shelf row",
    "cabinet/cabinet-base.png": "Tiling cabinet base with brass feet",
}


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    audit = load_script("check-assets")
    expected_size = audit.expected_size
    audit.expected_size = lambda rel: (1024, GEOMETRY[rel]["height"]) if rel in GEOMETRY else expected_size(rel)
    audit.main()
    result = json.loads((CHECKS / "assets.json").read_text())
    for item in result["assets"]:
        if item["path"] in GEOMETRY:
            im = Image.open(ROOT / item["path"]).convert("RGBA")
            sample_y = {"cabinet/cabinet-crown.png": 255, "cabinet/cabinet-row.png": 100,
                        "cabinet/cabinet-base.png": 20}[item["path"]]
            assert im.getpixel((512, sample_y))[3] == 255, item["path"]
            if item["path"].endswith("cabinet-row.png"):
                for y in range(im.height):
                    assert len({im.getpixel((x, y)) for x in (176, 512, 847)}) == 1, (item["path"], y)
    crown = Image.open(ROOT / "cabinet/cabinet-crown.png").convert("RGBA")
    row = Image.open(ROOT / "cabinet/cabinet-row.png").convert("RGBA")
    base = Image.open(ROOT / "cabinet/cabinet-base.png").convert("RGBA")
    for upper, lower in ((crown, row), (row, row), (row, base)):
        assert upper.crop((0, upper.height - 1, 1024, upper.height)).tobytes() == lower.crop((0, 0, 1024, 1)).tobytes()
    builder = load_script("build-manifest")
    descriptions = builder.description
    builder.description = lambda rel: DESCRIPTIONS[rel] if rel in DESCRIPTIONS else descriptions(rel)
    load_prompts = builder.load_prompts
    cabinet_prompts = json.loads((CHECKS / "prompts-cabinet.json").read_text())
    builder.load_prompts = lambda: load_prompts() | cabinet_prompts
    builder.main()
    manifest_path = ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    for entry in manifest:
        rel = entry["path"].removeprefix("design/art/")
        if rel in GEOMETRY:
            entry["geometry"] = GEOMETRY[rel]
            entry["postprocess"] = "Cut, horizontally aligned, flattened in the x=176–848 stretch zone, and seam-matched by _checks/build-cabinet-tiles.py."
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    readme_path = ROOT / "README.md"
    readme = readme_path.read_text()
    readme = readme.replace(
        "## Masters",
        "- A3 cabinet tiles are cut from one generated source in `_checks/cabinet-source.png`. "
        "The 1024 px masters have a repeatable 384 px row, a 256 px crown and a 192 px base; "
        "their measured geometry is in `manifest.json`. `_checks/cabinet-tiles-review.png` "
        "shows three rows with vessels at phone and desktop widths and 400% seam crops. "
        "The WebP export and PR wait for Roy's visual approval; Claude wires the app separately.\n\n## Masters",
    )
    readme = readme.replace(
        "[Idle glint review](_checks/idle-glint-review.png)",
        "[Idle glint review](_checks/idle-glint-review.png) · "
        "[Cabinet tile review](_checks/cabinet-tiles-review.png)",
    )
    readme_path.write_text(readme)
    print("cabinet geometry and seam audit passed")


if __name__ == "__main__":
    main()
