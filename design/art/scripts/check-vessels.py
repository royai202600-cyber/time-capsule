#!/usr/bin/env python3
"""Composite vessel layers and record size, alpha, and visual-difference checks."""

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parents[1]
VESSELS = ROOT / "vessels"
CHECKS = ROOT / "_checks"
PAPER = (246, 248, 251, 255)
LAYERS = {
    "dome": ["base", "rose", "glass"],
    "bottle": ["waves", "letter", "body", "cork"],
    "envelope": ["body", "flap", "seal"],
    "tin": ["box", "lid"],
    "lantern": ["glow", "body", "cap"],
    "musicbox": ["box", "lid"],
    "maison": ["box", "ring", "lid"],
}


def flatten(image: Image.Image) -> Image.Image:
    return Image.alpha_composite(Image.new("RGBA", image.size, PAPER), image).convert("RGB")


def check_vessel(vessel: str, layer_names: list[str]) -> dict:
    assembled = Image.open(VESSELS / f"vessel-{vessel}.png").convert("RGBA")
    parts = {
        name: Image.open(VESSELS / f"vessel-{vessel}-{name}.png").convert("RGBA")
        for name in layer_names
    }
    if assembled.size != (1024, 1024) or any(part.size != assembled.size for part in parts.values()):
        raise ValueError(f"{vessel}: parts must share a 1024x1024 canvas")

    stack = Image.new("RGBA", assembled.size, (0, 0, 0, 0))
    for name in layer_names:
        stack = Image.alpha_composite(stack, parts[name])
    stack.save(CHECKS / f"{vessel}-stack.png", optimize=True)

    original_on_paper, stack_on_paper = flatten(assembled), flatten(stack)
    diff = ImageChops.difference(original_on_paper, stack_on_paper)
    mae = round(sum(ImageStat.Stat(diff).mean) / 3, 3)
    comparison = Image.new("RGB", (2048, 1024), PAPER[:3])
    comparison.paste(original_on_paper, (0, 0))
    comparison.paste(stack_on_paper, (1024, 0))
    comparison.save(CHECKS / f"{vessel}-comparison.png", optimize=True)

    small = Image.new("RGB", (240, 120), PAPER[:3])
    small.paste(original_on_paper.resize((120, 120), Image.Resampling.LANCZOS), (0, 0))
    small.paste(stack_on_paper.resize((120, 120), Image.Resampling.LANCZOS), (120, 0))
    small.save(CHECKS / f"{vessel}-at-120px.png", optimize=True)

    image_checks = {}
    for name, image in [("assembled", assembled), *parts.items()]:
        alpha = image.getchannel("A")
        image_checks[name] = {
            "size": list(image.size),
            "mode": image.mode,
            "corners_alpha": [alpha.getpixel(p) for p in ((0, 0), (1023, 0), (0, 1023), (1023, 1023))],
            "center_alpha": alpha.getpixel((512, 512)),
            "visible_bbox_alpha_gt_20": alpha.point(lambda value: 255 if value > 20 else 0).getbbox(),
        }

    report = {
        "style_reference": "design/art/style-sheet.png",
        "layer_order": layer_names,
        "assembled_vs_stack_mae_rgb_on_paper_0_to_255": mae,
        "exact_pixel_match": diff.getbbox() is None,
        "all_corners_alpha_zero": all(
            value == 0 for item in image_checks.values() for value in item["corners_alpha"]
        ),
        "layer_checks": image_checks,
    }
    (CHECKS / f"{vessel}-check.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def main() -> None:
    CHECKS.mkdir(parents=True, exist_ok=True)
    for vessel, layer_names in LAYERS.items():
        result = check_vessel(vessel, layer_names)
        print(vessel, "MAE", result["assembled_vs_stack_mae_rgb_on_paper_0_to_255"],
              "alpha corners", "PASS" if result["all_corners_alpha_zero"] else "FAIL")


if __name__ == "__main__":
    main()
