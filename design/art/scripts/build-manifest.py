#!/usr/bin/env python3
"""Build the T9/T9b prompt manifest and master-file table."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKS = ROOT / "_checks"
VESSELS = {
    "dome": "glass-dome blue rose", "bottle": "message in a bottle",
    "envelope": "wax-sealed letter", "tin": "tin box",
    "lantern": "Mid-Autumn lantern", "musicbox": "warm wood music box",
    "maison": "Maison Aurèle ring box",
}
PLACES = {
    "senado": "Senado Square", "tst-clock": "Tsim Sha Tsui Clock Tower",
    "taipei101": "Taipei 101", "sensoji": "Sensō-ji",
    "fushimi": "Fushimi Inari", "gyeongbok": "Gyeongbokgung",
    "merlion": "Merlion", "grandpal": "Grand Palace",
    "wumen": "Forbidden City Meridian Gate", "petronas": "Petronas Towers",
    "aurele-cotai": "Maison Aurèle Cotai boutique demo",
}
SPECIAL = {
    "style-sheet.png": "Roy-approved style sheet A",
    "style-sheet-a.png": "Style sheet A candidate",
    "style-sheet-b.png": "Style sheet B candidate",
    "style-sheet-c.png": "Style sheet C candidate",
    "map-asia.png": "Simplified East and Southeast Asia journey map",
    "shelf.png": "Empty three-level wooden display shelf",
    "seal-wax.png": "Large rose-imprinted wax seal",
    "app-icon.png": "Blue rose dome app icon master",
    "textures/paper.png": "Cool seamless paper texture",
    "textures/paper-letter.png": "Warm seamless letter-paper texture",
    "scenes/scene-welcome.png": "Welcome: hands, sealed letter and dome rose",
    "scenes/scene-empty-inbox.png": "Empty inbox: open shelf space and waiting bird",
    "scenes/scene-empty-sent.png": "Empty sent: blank letter, pen and wax",
    "scenes/scene-sealed.png": "Letter being sealed with warm glow",
    "fx/fx-light-burst.png": "Warm radial opening light effect",
    "journey/passport-cover.png": "Navy and brass passport cover",
    "journey/passport-page.png": "Blank cream passport page",
    "cabinet/cabinet-wall.png": "Warm plaster and wood-panel wall",
    "icon-reference.png": "Thirteen UI icon reference grid",
}
POSTPROCESS = {
    "vessels/vessel-dome-glass.png": "Alpha below 200 scaled to 37.5% by adjust-glass-alpha.py; opaque outline and highlights preserved.",
    "vessels/vessel-bottle-body.png": "Alpha below 200 scaled to 37.5% by adjust-glass-alpha.py; opaque outline and highlights preserved.",
    "textures/paper.png": "Resized to 1024 square and made seamless by finish-backgrounds.py.",
    "textures/paper-letter.png": "Resized to 1024 square and made seamless by finish-backgrounds.py.",
    "fx/fx-light-burst.png": "Outer gray rim removed and rays feathered by finish-backgrounds.py.",
}
MAP_PINS = {
    # Positions are hand-placed on the drawn 1254×1254 map, not a geographic projection.
    "senado": {"x": 501, "y": 583},
    "tst-clock": {"x": 525, "y": 578},
    "taipei101": {"x": 655, "y": 532},
    "sensoji": {"x": 978, "y": 307},
    "fushimi": {"x": 900, "y": 340},
    "gyeongbok": {"x": 758, "y": 249},
    "merlion": {"x": 275, "y": 1026},
    "grandpal": {"x": 218, "y": 748},
    "wumen": {"x": 560, "y": 206},
    "petronas": {"x": 230, "y": 970},
    "aurele-cotai": {"x": 509, "y": 582},
}


def description(rel: str) -> str:
    if rel in SPECIAL:
        return SPECIAL[rel]
    if rel.startswith("vessels/"):
        stem = Path(rel).stem.removeprefix("vessel-")
        for vessel, name in VESSELS.items():
            if stem == vessel:
                return f"Assembled {name} vessel"
            if stem.startswith(vessel + "-"):
                return f"{name.title()} — {stem[len(vessel) + 1:]} layer"
    if rel.startswith("portraits/"):
        return "Main profile picture: future self" if "future" in rel else f"Main profile picture preset {Path(rel).stem[-2:]}"
    if rel.startswith("stamps/"):
        return f"One-color passport stamp: {PLACES[Path(rel).stem.removeprefix('stamp-')]}"
    raise KeyError(rel)


def load_prompts() -> dict[str, str]:
    initial = json.loads((CHECKS / "prompts-initial.json").read_text())
    vessel = json.loads((CHECKS / "prompts-vessels.json").read_text())
    portraits = json.loads((CHECKS / "prompts-portraits.json").read_text())
    completion = json.loads((CHECKS / "prompts-completion.json").read_text())
    prompts = {}
    for name, prompt in initial.items():
        path = name + ".png" if not name.endswith(".png") else name
        prompts[path if name.startswith("style-sheet") else "vessels/" + path] = prompt
    for path, prompt in vessel.items():
        prompts[path.removeprefix("design/art/")] = prompt
    for name, prompt in portraits.items():
        prompts[f"portraits/{name}.png"] = prompt
    prompts.update(completion)
    return prompts


def main() -> None:
    prompts = load_prompts()
    audit = json.loads((CHECKS / "assets.json").read_text())
    pivots = json.loads((CHECKS / "pivots.json").read_text())
    entries = []
    for item in audit["assets"]:
        rel = item["path"]
        if rel not in prompts:
            raise KeyError(f"missing exact prompt: {rel}")
        entry = {
            "path": f"design/art/{rel}", "what": description(rel),
            "size_px": item["size"], "transparent": item["transparent"],
            "prompt": prompts[rel], "model": "gpt-image-2",
        }
        if Path(rel).name in pivots:
            entry["pivot"] = {k: pivots[Path(rel).name][k] for k in ("x", "y")}
        if rel == "map-asia.png":
            entry["pins"] = MAP_PINS
        if rel.startswith("portraits/"):
            entry["postprocess"] = "Perfect circle: center (505,526), radius 430 px; transparent outside, by mask-portraits.py."
        elif rel.startswith("stamps/"):
            entry["postprocess"] = "Single palette ink color with white fills and stray colors removed by normalize-stamps.py."
        elif rel in POSTPROCESS:
            entry["postprocess"] = POSTPROCESS[rel]
        if not rel.startswith("style-sheet"):
            entry["web_export"] = "public/art/" + rel.removesuffix(".png") + ".webp"
        entries.append(entry)
    (ROOT / "manifest.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")

    lines = [
        "# Time Capsule art assets", "",
        "Roy chose style sheet A. All generated masters use the built-in `gpt-image-2` image tool with the approved sheet as their style reference; the exact prompts and any postprocessing are in `manifest.json`.", "",
        "PNG masters live in `design/art/`. WebP copies live at matching paths in `public/art/`, except the style sheets and `_checks/`. Names use kebab-case: `<category>-<id>-<part>` where a part exists. Vessel IDs: dome, bottle, envelope, tin, lantern, musicbox, maison. Place IDs: senado, tst-clock, taipei101, sensoji, fushimi, gyeongbok, merlion, grandpal, wumen, petronas, aurele-cotai.", "",
        "The original SVG art remains in `src/art.js` and is recoverable from Git tag `art-svg-v1`. These bitmap assets are not wired into app screens yet.", "",
        "## Rules and checks", "",
        "- Music box and ring box assembled views are closed. Their lids are separate complete parts. Vessel part order and 120 px comparisons are in `_checks/`; lid, flap and cork pivots are in `manifest.json` and `_checks/pivots.json`.",
        "- Dome stack: base → rose → glass. Bottle stack: waves → letter → body → cork. Glass interior alpha below 200 was scaled to 37.5% so contents stay visible.",
        "- All nine portraits are the main profile pictures, with an identical 860 px diameter disc centered at (505, 526). `_checks/portraits-small.png` shows 24 px and 40 px tests.",
        "- Passport stamps use one ink color each. Paper textures are opaque and seamlessly tile at all edges. Scene edges fade to transparency.",
        "- The built-in image tool returned the map at native 1254 × 1254, its largest square output here; no artificial upscale was used.",
        "- The map entry in `manifest.json` has eleven hand-placed `pins` coordinates in that native 1254 × 1254 pixel space. They follow the illustrative coastlines rather than a precise map projection. `_checks/map-pins.png` overlays their exact points and labels; the Macau boutique pin sits beside Senado Square.",
        "- The T9c pin placement was checked against Roy's supplied world map and an [online East/Southeast Asia map](https://maplab-icon.com/blog-entry-784-html/); [Natural Earth coastlines](https://www.naturalearthdata.com/downloads/10m-physical-vectors/) were consulted for a reliable geographic source. These pins are display positions only; actual location checks use the app's place coordinates.",
        "- `icon-reference.png` is one 4×4 sheet on paper. Row-major order: pin, back, close, plus, lock, check, shop, user, map, cabinet, share, camera, pen; the last three cells are blank. These are references only; the screens team draws final UI icons in code.",
        "- WebP exports use sharp/libvips quality 85 and preserve transparency. Vessel, stamp, portrait and seal exports have max edge 512 px; map has max edge 1600 px. App icon PNG sizes are in `public/icons/`.",
        "- Run checks with the Python scripts in `design/art/scripts/` (Pillow required). Run `npm run build` before merging.", "",
        "## Masters", "", "| File | What | Size | Notes |", "|---|---|---:|---|",
    ]
    for entry in entries:
        rel = entry["path"].removeprefix("design/art/")
        notes = []
        if "pivot" in entry:
            notes.append(f"pivot {entry['pivot']['x']},{entry['pivot']['y']}")
        if "postprocess" in entry:
            notes.append("processed; see manifest")
        if not entry["transparent"]:
            notes.append("opaque")
        lines.append(f"| `{rel}` | {entry['what']} | {entry['size_px'][0]}×{entry['size_px'][1]} | {', '.join(notes)} |")
    lines += ["", "## Review", "", "[Full contact sheet](_checks/contact-sheet.png) · [Vessel 120 px checks](_checks/vessels-at-120px.png) · [Portrait 24/40 px strip](_checks/portraits-small.png) · [Map pin overlay](_checks/map-pins.png)", ""]
    (ROOT / "README.md").write_text("\n".join(lines))
    print("manifest and README:", len(entries), "masters", len(prompts), "prompts")


if __name__ == "__main__":
    main()
