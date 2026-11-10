#!/usr/bin/env python3
"""Build the art prompt manifest and master-file table."""

import json
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKS = ROOT / "_checks"
VESSELS = {
    "dome": "glass-dome blue rose", "bottle": "message in a bottle",
    "envelope": "wax-sealed letter", "tin": "tin box",
    "lantern": "Mid-Autumn lantern", "musicbox": "warm wood music box",
    "maison": "Maison Aurèle ring box",
    "snow-globe": "winter scene snow globe",
    "mixtape": "cassette in a clear case", "instant-camera": "original instant camera",
    "ramen": "covered ramen bowl", "fortune-cookie": "fortune cookie on a plate",
    "red-packet": "gold-foil red packet", "phone-booth": "original red phone booth",
    "firefly-jar": "cloth-covered firefly jar", "hourglass": "wood and brass hourglass",
    "gashapon": "pastel clear-top toy capsule",
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
    "fx/fx-glint.png": "Small four-point idle sparkle for wax and brass",
    "vessels/vessel-dome-glint.png": "Travelling highlight for the dome glass",
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
    "vessels/vessel-dome-glint.png": "Generated edit of the assembled dome; downscaled to 1024, stray alpha removed and peak alpha capped at 179 by finish-idle-glints.py.",
    "fx/fx-glint.png": "Generated four-point sparkle; finish-idle-glints.py smoothed the star edge, strengthened its warm-white core and brass tint, and faded the bloom to transparent for 16/24 px use.",
    "vessels/vessel-snow-globe.png": "Composited from the four edited layers after finish-snow-globe.py downscaled and aligned them on one 1024 canvas.",
    "vessels/vessel-snow-globe-base.png": "The edit revealed the pedestal seat; finish-snow-globe.py fitted its footprint and baseY to the assembled art.",
    "vessels/vessel-snow-globe-scene.png": "finish-snow-globe.py clipped the complete winter scene inside the globe footprint.",
    "vessels/vessel-snow-globe-snow.png": "finish-snow-globe.py replaced large flakes with 22 small soft white/light-blue particles per Roy; idle direction is down.",
    "vessels/vessel-snow-globe-globe.png": "finish-snow-globe.py removed erase residue and scaled glass fill alpha below 200 to 37.5%; rim and highlights stay strong.",
    "vessels/vessel-snow-globe-glint.png": "finish-snow-globe.py extracted the generated glass highlight into a soft idle-glint layer.",
}
VESSEL_SPECS = {
    "vessels/vessel-snow-globe.png": {
        "opening": "B", "idleMs": 4000, "idle": [],
        "layers": [
            {"name": "base", "file": "vessel-snow-globe-base.png", "role": "static"},
            {"name": "scene", "file": "vessel-snow-globe-scene.png", "role": "static"},
            {"name": "snow", "file": "vessel-snow-globe-snow.png", "role": "fade",
             "open": [{"at": 0, "opacity": 1}, {"at": 0.5, "opacity": 0.5}, {"at": 1, "opacity": 0}],
             "idle": [{"type": "drift", "amount": 0.03, "direction": "down"}]},
            {"name": "globe", "file": "vessel-snow-globe-globe.png", "role": "lift",
             "open": [{"at": 0, "y": 0, "opacity": 1}, {"at": 0.5, "y": -0.175, "opacity": 0.5},
                      {"at": 1, "y": -0.35, "opacity": 0}]},
        ],
        "mouth": {"x": 512, "y": 724}, "letterDrop": 230, "baseY": 902,
        "sparkle": {"x": 340, "y": 270}, "glint": "vessel-snow-globe-glint.png",
        "openGlow": None, "readyPulse": None,
    },
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
    prompts.update(json.loads((CHECKS / "prompts-t10a-extra.json").read_text()))
    prompts.update(runpy.run_path(str(Path(__file__).with_name("prompts-t10a.py")))["PROMPTS"])
    b2_prompts = CHECKS / "t10b-batch-prompts.json"
    if b2_prompts.exists():
        prompts.update(json.loads(b2_prompts.read_text()))
    return prompts


def main() -> None:
    if (CHECKS / "t10b-batch-prompts.json").exists():
        VESSELS.update(runpy.run_path(str(Path(__file__).with_name("register-b2.py")))["LABELS"])
        for path in CHECKS.glob("t10b-*-spec.json"):
            spec = json.loads(path.read_text())
            VESSEL_SPECS[f"vessels/vessel-{spec['id']}.png"] = spec
    prompts = load_prompts()
    VESSEL_SPECS.update(json.loads((CHECKS / "t10a-specs.json").read_text()))
    audit = json.loads((CHECKS / "assets.json").read_text())
    pivots = json.loads((CHECKS / "pivots.json").read_text())
    preserved = json.loads((CHECKS / "manifest-cabinet.json").read_text())
    entries = []
    for item in audit["assets"]:
        rel = item["path"]
        if rel in preserved:
            entries.append(preserved[rel])
            continue
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
        if rel in VESSEL_SPECS:
            entry["vessel"] = VESSEL_SPECS[rel]
        if rel.startswith("portraits/"):
            entry["postprocess"] = "Perfect circle: center (505,526), radius 430 px; transparent outside, by mask-portraits.py."
        elif rel.startswith("stamps/"):
            entry["postprocess"] = "Single palette ink color with white fills and stray colors removed by normalize-stamps.py."
        elif rel == "vessels/vessel-firefly-jar-jar.png":
            entry["postprocess"] = "Generated dusk gradient and five dark grass blades composited into the static jar by finish-firefly-card.py; original opaque ink/highlight pixels and entire rim preserved. Dusk remains present when the firefly layer drifts/fades."
        elif rel == "vessels/vessel-firefly-jar-fireflies.png":
            entry["postprocess"] = "finish-firefly-card.py: scripted redraw per Roy: six natural uneven positions, varied cream-gold cores and golden halos, two curved trails; script-only glow enlargement to approximately 28–34 px bright cores (near/far variation) and 100–130 px halos, with the near light slightly larger. No static wash on the drifting layer. Approved dusk, positions, trails and motion unchanged."
        elif rel.startswith("vessels/") and rel.removeprefix("vessels/vessel-").split(".png")[0].split("-")[0] in ("mixtape", "instant", "ramen", "fortune", "red", "phone", "firefly", "hourglass", "gashapon"):
            entry["postprocess"] = "finish-batch1.py: align isolation edits, common downscale and baseline, clean alpha; clear glass fill and soft particles where relevant. Assembled resting view composites the recorded at=0 keyframes; complete hidden photo is compressed at rest."
        elif rel in POSTPROCESS:
            entry["postprocess"] = POSTPROCESS[rel]
        if not rel.startswith("style-sheet"):
            entry["web_export"] = "public/art/" + rel.removesuffix(".png") + ".webp"
        entries.append(entry)
    (ROOT / "manifest.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")

    lines = [
        "# Time Capsule art assets", "",
        "To make new art, follow [STYLE.md](STYLE.md). This README lists what already exists.", "",
        "Roy chose style sheet A. All generated masters use the built-in `gpt-image-2` image tool with the approved sheet as their style reference; the exact prompts and any postprocessing are in `manifest.json`.", "",
        "PNG masters live in `design/art/`. WebP copies live at matching paths in `public/art/`, except the style sheets and `_checks/`. Names use kebab-case: `<category>-<id>-<part>` where a part exists. Vessel IDs: dome, bottle, envelope, tin, lantern, musicbox, maison, snow-globe, mixtape, instant-camera, ramen, fortune-cookie, red-packet, phone-booth, firefly-jar, hourglass, gashapon. Place IDs: senado, tst-clock, taipei101, sensoji, fushimi, gyeongbok, merlion, grandpal, wumen, petronas, aurele-cotai.", "",
        "The original SVG art remains in `src/art.js` and is recoverable from Git tag `art-svg-v1`. These bitmap assets are not wired into app screens yet.", "",
        "## Rules and checks", "",
        "- Music box and ring box assembled views are closed. Their lids are separate complete parts. Vessel part order and 120 px comparisons are in `_checks/`; lid, flap and cork pivots are in `manifest.json` and `_checks/pivots.json`.",
        "- Dome stack: base → rose → glass. Bottle stack: waves → letter → body → cork. Glass interior alpha below 200 was scaled to 37.5% so contents stay visible.",
        "- All nine portraits are the main profile pictures, with an identical 860 px diameter disc centered at (505, 526). `_checks/portraits-small.png` shows 24 px and 40 px tests.",
        "- Passport stamps use one ink color each. Paper textures are opaque and seamlessly tile at all edges. Scene edges fade to transparency.",
        "- A2 idle effects: `vessels/vessel-dome-glint.png` overlays the existing dome glass without changing vessel art; `fx/fx-glint.png` catches on wax seals and brass edges. Roy approved both after `_checks/idle-glint-review.png` showed the dome at 120/240 px and the sparkle at 16/24 px on envelope and tin. `finish-idle-glints.py` downscaled and refined the generated layers.",
        "- T10a snow-globe test: original winter scene inside a clear lifting globe, with separate base, scene, drifting snow, glass and idle glint. Its data-driven vessel block follows the PR #42 `IllustratedParts` field names. `_checks/snow-globe-motion.png` shows the measured open keyframes and mouth/sparkle/base anchors; `_checks/snow-globe-silhouette.png` shows 40/120 px. Roy approved this test with a full-clear glass lift and 22 small pale falling snow particles.",
        "- T10a batch 1: all ten vessels follow the approved plan and PR #42 vessel data format. No `ground` layers or split/twist/door roles. Moving layers have measured opening keyframes; snow and sand drift down, steam/fireflies rise. The cassette reels spin independently. Each new vessel has 40/120 px silhouette and closed/half/open motion sheets. The complete camera photo uses its at=0 keyframe for the resting stack; raw part compositing alone would expose it. Pivots and anchors are measured on the normalized canvas. All ten original designs were checked against the plan’s rejected IP ideas; assembled designs were retained. PR #46 review updates redraw the firefly layer as 19 warm golden points that rise/fade, add chopsticks to the ramen lid, keep steam visible, add the six requested whole-vessel idle motions, keep the phone-booth light on, and constrain the fully-out camera photo to the canvas.",
        "- T10a-fix latest review: static jar interior fades from clear light glass at the rim to ink/navy dusk below, with five slender dark grass blades. The drifting firefly layer contains only six gold lights in irregular positions, varied depth/size, and two curved flying trails. Original cloth, glass rim, outline and highlights are retained; opening/idle metadata is unchanged. `_checks/firefly-card-review.png` shows 40/120/240 px and `_checks/firefly-jar-motion.png` has an exact assembled CLOSED panel. Latest script-only review enlarges the glow cores/halos for 120 px while preserving the approved dusk jar exactly. Roy approved the final art in PR #51; the merge refresh preserves its PNG/WebP bytes.",
        "- The built-in image tool returned the map at native 1254 × 1254, its largest square output here; no artificial upscale was used.",
        "- The map entry in `manifest.json` has eleven hand-placed `pins` coordinates in that native 1254 × 1254 pixel space. They follow the illustrative coastlines rather than a precise map projection. `_checks/map-pins.png` overlays their exact points and labels; the Macau boutique pin sits beside Senado Square.",
        "- The T9c pin placement was checked against Roy's supplied world map and an [online East/Southeast Asia map](https://maplab-icon.com/blog-entry-784-html/); [Natural Earth coastlines](https://www.naturalearthdata.com/downloads/10m-physical-vectors/) were consulted for a reliable geographic source. These pins are display positions only; actual location checks use the app's place coordinates.",
        "- `icon-reference.png` is one 4×4 sheet on paper. Row-major order: pin, back, close, plus, lock, check, shop, user, map, cabinet, share, camera, pen; the last three cells are blank. These are references only; the screens team draws final UI icons in code.",
        "- WebP exports use sharp/libvips quality 85 and preserve transparency. Vessel, stamp, portrait and seal exports have max edge 512 px; map has max edge 1600 px. App icon PNG sizes are in `public/icons/`.",
        "- Run checks with the Python scripts in `design/art/scripts/` (Pillow required). Run `npm run build` before merging.", "",
        "A3 cabinet tiles retain their approved full-width 1024 px exports and geometry: crown 1024×256, repeatable row 1024×384, base 1024×192. They were cut from one generated source; Roy approved `_checks/cabinet-tiles-review.png` at `7b1f646`. The manifest preserves the exact A3 prompts and measured geometry.", "",
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
    lines += ["", "## Review", "", "[Full contact sheet](_checks/contact-sheet.png) · [Snow globe motion](_checks/snow-globe-motion.png) · [Snow globe 40/120 px](_checks/snow-globe-silhouette.png) · [Vessel 120 px checks](_checks/vessels-at-120px.png) · [Portrait 24/40 px strip](_checks/portraits-small.png) · [Map pin overlay](_checks/map-pins.png) · [Idle glint review](_checks/idle-glint-review.png) · [Cabinet tile review](_checks/cabinet-tiles-review.png)", ""]
    (ROOT / "README.md").write_text("\n".join(lines))
    print("manifest and README:", len(entries), "masters", len(prompts), "prompts")


def register_public_sea() -> None:
    """Register just this pair while preserving all approved batch records."""
    from PIL import Image
    manifest_path = ROOT / "manifest.json"
    entries = json.loads(manifest_path.read_text())
    prompts = json.loads((CHECKS / "prompts-public-sea.json").read_text())
    descriptions = {
        "portraits/portrait-sea.png": "Sea recipient profile picture: message bottle on a dusk sea",
        "scenes/scene-sea-sealed.png": "Sea bottle sent: drifting away toward a quiet dusk shore",
    }
    records = {entry["path"]: entry for entry in entries}
    for rel, prompt in prompts.items():
        im = Image.open(ROOT / rel).convert("RGBA")
        record = {
            "path": "design/art/" + rel, "what": descriptions[rel],
            "size_px": list(im.size), "transparent": True,
            "prompt": prompt, "model": "gpt-image-2",
            "web_export": "public/art/" + rel.removesuffix(".png") + ".webp",
            "postprocess": ("Downscaled from native 1254 square, translated 6px right/down, then identical circle center (505,526), radius 430, pale sea-glass ground (205,222,236), by mask-portraits.py. Existing portraits skipped unchanged." if rel.startswith("portraits/") else "Native 1536x1024 RGBA, original generated feathered vignette and transparent corners retained; no upscale."),
        }
        records[record["path"]] = record
    manifest_path.write_text(json.dumps(sorted(records.values(), key=lambda e:e["path"]), ensure_ascii=False, indent=2) + "\n")
    readme_path = ROOT / "README.md"
    readme = readme_path.read_text()
    prefix, rest = readme.split("## Masters\n", 1)
    table, review = rest.split("## Review\n", 1)
    prefix = prefix.replace("All nine portraits are the main profile pictures", "All ten portraits are profile pictures (nine people/future presets plus the sea recipient)")
    prefix = prefix.replace("shows 24 px and 40 px tests", "shows 24/40/60 px tests with full-canvas and exact 860 px app-disc crops")
    note = "- Public Sea art: `portrait-sea.png` is a non-person recipient picture with the shared circle mask; `scene-sea-sealed.png` is a transparent dusk-sea vignette. Existing master/export hashes are preserved. Exact prompts are in `_checks/prompts-public-sea.json`. Read `docs/design/public-sea.md` from PR #67 (`claude/public-sea`) because it was not yet on main. App registration/wiring is the screens team's follow-up.\n"
    if "- Public Sea art:" not in prefix:
        prefix += note + "\n"
    rows = [line for line in table.splitlines() if line.startswith("| `") and not any("`"+rel+"`" in line for rel in prompts)]
    for rel in prompts:
        e=records["design/art/"+rel]
        rows.append(f"| `{rel}` | {e['what']} | {e['size_px'][0]}×{e['size_px'][1]} | processed; see manifest |")
    table = "\n| File | What | Size | Notes |\n|---|---|---:|---|\n" + "\n".join(sorted(rows)) + "\n\n"
    links = "[Sea portrait crop review](_checks/portrait-sea-review.png) · [Sea sealed scene comparison](_checks/scene-sea-sealed-review.png)"
    if links not in review:
        review += "\n" + links + "\n"
    readme_path.write_text(prefix + "## Masters\n" + table + "## Review\n" + review)
    print("Public Sea: registered 2 assets; retained", len(entries), "existing manifest records")


def register_city_hunt() -> None:
    """Append City Hunt artwork, preserving all previously registered records."""
    from PIL import Image
    path = ROOT / 'manifest.json'
    raw = path.read_text()
    entries = json.loads(raw)
    existing = {e['path']:e for e in entries}
    specs = json.loads((CHECKS/'city-hunt-art.json').read_text())
    added = []
    batch = []
    for spec in specs:
        spec = dict(spec)
        relative = spec.pop('relative_path')
        im = Image.open(ROOT/relative).convert('RGBA')
        record = {'path':'design/art/'+relative, 'what':spec.pop('what'),
                  'size_px':list(im.size), 'transparent':True,
                  'web_export':'public/art/'+relative.removesuffix('.png')+'.webp', **spec}
        record['alpha_bbox_px'] = list(im.getchannel('A').getbbox())
        if record['path'] in existing:
            if existing[record['path']] != record:
                raise ValueError('Existing City Hunt record differs: '+relative)
        else:
            added.append(record)
        batch.append(record)
    if added:
        prefix = raw[:raw.rfind(']')].rstrip()
        snippet = json.dumps(added,ensure_ascii=False,indent=2)[2:-2]
        path.write_text(prefix+',\n'+snippet+'\n]\n')
    # Keep all approved metadata records byte-for-byte before the new tail.
    updated = json.loads(path.read_text())
    assert all(old == new for old,new in zip(entries,updated))
    readme_path = ROOT/'README.md'
    readme = readme_path.read_text()
    prefix,rest = readme.split('## Masters\n',1)
    table,review = rest.split('## Review\n',1)
    note = ('- City Hunt art: Letter Keeper from selected sketch A1, matching dialog portrait, '
            'all eight player figures on the approved shared adult scale, RGB-only blue Waypost gems, '
            'and the ink-blue double-ring Xinyi hunt stamp. Roy approved the first seven assets at '
            '`9c247aa`; their PNGs and WebPs remain unchanged. The five remaining figures and stamp '
            'await whole-PR approval. No app registration, deployment or merge. '
            'Exact prompts, references, scale and preservation hashes are in `_checks/city-hunt-*.json`.\n\n')
    if '- City Hunt art test batch:' in prefix:
        start = prefix.index('- City Hunt art test batch:')
        end = prefix.index('\n\n', start) + 2
        prefix = prefix[:start] + note + prefix[end:]
    elif '- City Hunt art:' not in prefix:
        prefix += note
    for e in batch:
        rel = e['path'].removeprefix('design/art/')
        if '| `'+rel+'` |' not in table:
            table = table.rstrip()+'\n'+f"| `{rel}` | {e['what']} | 1024×1024 | awaiting whole-PR approval; see manifest |\n"
    links = ('[City Hunt figures and anchor guides](_checks/city-hunt-figures.png) · '
             '[Compact figure review](_checks/city-hunt-figures-review.png) · '
             '[Keeper portrait at 24/40 px](_checks/portraits-small.png) · '
             '[Blue/purple gem review](_checks/city-hunt-gems.png)')
    if links not in review:
        review += '\n'+links+'\n'
    final_links = ('[All nine head-and-shoulder facing crops](_checks/city-hunt-facing.png) · '
                   '[Xinyi event stamp versus Taipei 101 place stamp](_checks/city-hunt-stamp.png)')
    if final_links not in review:
        review += '\n'+final_links+'\n'
    reference = ('- Xinyi hunt stamp silhouette reference: [TAIPEI 101 official sunrise photograph]'
                 '(https://www.taipei-101.com.tw/asset/img/cover-sunrise.jpg), linked from the '
                 '[official gallery](https://www.taipei-101.com.tw/tw/explore/photogallery), '
                 'inspected 2026-11-10. Observed stacked upward-flared tiers and slim spire; '
                 'used only to inform a smaller loose tower behind the focal letter. '
                 'The photograph is not reproduced in the artwork or repository.\n')
    if reference not in review:
        review += '\n'+reference
    readme_path.write_text(prefix+'## Masters\n'+table.rstrip()+'\n\n## Review\n'+review)
    print('City Hunt: registered',len(batch),'assets; retained',len(entries),'existing records')


def register_red_bird() -> None:
    """Append the one-vessel landmark art batch without rewriting prior records."""
    from PIL import Image
    prompts=json.loads((CHECKS/'red-bird-prompts.json').read_text())
    spec=json.loads((CHECKS/'red-bird-vessel.json').read_text())
    path=ROOT/'manifest.json'
    raw=path.read_text(); existing=json.loads(raw)
    by_path={e['path']:e for e in existing}
    added=[]
    for name in ('assembled','box','lid','shadow'):
        filename='vessel-red-bird'+('' if name=='assembled' else '-'+name)+'.png'
        source=prompts['closed'] if name=='assembled' else next(p for p in prompts['parts'] if p['name']==name)
        im=Image.open(ROOT/'vessels'/filename).convert('RGBA')
        entry={'path':'design/art/vessels/'+filename,
               'what':('Closed Red Bird Sundial Box / 火鳥日晷盒; Earned HKUST landmark vessel' if name=='assembled'
                       else 'Red Bird Sundial Box — '+name+' layer'),
               'size_px':list(im.size),'transparent':True,'prompt':source['prompt'],'model':'gpt-image-2',
               'references':source['references'],'native_source':source['source'],
               'postprocess':'finish-red-bird.py: alpha dust cutoff16; all generated edits share one full-canvas downscale1024/1254 and translation(3,-30), never independent fit or upscale. Generated shadow softened4px and clipped off the red pointer. Assembled is the exact at=0 stack. See red-bird-prompts.json for all exact generation/isolation prompts.',
               'alpha_bbox_px':list(im.getchannel('A').getbbox()),
               'web_export':'public/art/vessels/'+filename.removesuffix('.png')+'.webp'}
        if name=='assembled':entry['vessel']=spec
        if entry['path'] in by_path:
            assert by_path[entry['path']]==entry,filename+' metadata differs'
        else:added.append(entry)
    if added:
        snippet=json.dumps(added,ensure_ascii=False,indent=2)[2:-2]
        path.write_text(raw[:raw.rfind(']')].rstrip()+',\n'+snippet+'\n]\n')
    assert json.loads(path.read_text())[:len(existing)]==existing
    readme_path=ROOT/'README.md';readme=readme_path.read_text()
    before,rest=readme.split('## Masters\n',1);table,review=rest.split('## Review\n',1)
    note=('- Red Bird Sundial Box (`red-bird`, 火鳥日晷盒): original low brass sundial keepsake '
          'with a wax-red swept pointer inspired by the verified HKUST Piazza sculpture. Closed master, '
          'complete rolled-letter interior, back-hinged dial/pointer and soft shadow. The shadow sways '
          '4° about its foot on a 4200ms loop; the rim has a measured sparkle anchor. Earned landmark '
          'art only, pending Roy’s visual OK; no app registration, migration, deployment or merge.\n\n')
    if '- Red Bird Sundial Box (' not in before:before+=note
    for name in ('assembled','box','lid','shadow'):
        filename='vessel-red-bird'+('' if name=='assembled' else '-'+name)+'.png'
        if '| `vessels/'+filename+'` |' not in table:
            table=table.rstrip()+'\n'+f'| `vessels/{filename}` | Red Bird Sundial Box — {name} | 1024×1024 | pending Roy; see manifest |\n'
    links=('[Red Bird vessel review](_checks/red-bird-review.png) · '
           '[40/120px](_checks/red-bird-sizes.png) · [stack](_checks/red-bird-stack.png) · '
           '[closed/half/open motion](_checks/red-bird-motion.png) · '
           '[shadow idle](_checks/red-bird-idle.png) · [audit](_checks/red-bird-audit.json)')
    if links not in review:review+='\n'+links+'\n'
    reference=('### Red Bird reference\n\n'
               '[HKUST Campus Management Office: Circle of Time / Red Bird Sundial]'
               '(https://cmo.hkust.edu.hk/sundial-sculpture) · '
               '[official photograph, the filename Roy identified]'
               '(https://cmo.hkust.edu.hk/files/sundial_M0089_01_m001R2.jpg). '
               'Credit: HKUST Campus Management Office / HKUST. Inspected 2026-11-10: the red '
               'swept steel planes stand in the circular pool and stepped podium of the Entrance Piazza. '
               'The [official Visit HKUST page](https://hkust.edu.hk/visit) confirms the same sculpture '
               'against the curved academic building. This is not the Guangzhou sundial or the university emblem. '
               'Only the small reference thumbnail is stored; the vessel is an original souvenir design, not a replica.\n\n'
               '![HKUST official Red Bird Piazza reference](reference/red-bird/hkust-piazza-thumb.jpg)\n')
    if '### Red Bird reference' not in review:review+='\n'+reference
    readme_path.write_text(before+'## Masters\n'+table.rstrip()+'\n\n## Review\n'+review)
    print('Red Bird: registered 4 masters; retained',len(existing),'existing records')


def register_hkust_stamp() -> None:
    """Register the single HKUST academic-building Passport stamp."""
    from PIL import Image
    provenance=json.loads((CHECKS/'hkust-stamp-prompts.json').read_text())
    im=Image.open(ROOT/'stamps/stamp-hkust.png').convert('RGBA')
    entry={'path':'design/art/stamps/stamp-hkust.png',
           'what':'HKUST Passport stamp / 香港科技大學; curved academic building wrapping the Piazza',
           'size_px':list(im.size),'transparent':True,'model':'gpt-image-2',
           'prompt':provenance['prompt'],'references':provenance['references'],
           'reference_pages':provenance['reference_pages'],
           'reference_notes':provenance['reference_notes'],
           'postprocess':provenance['postprocess'],'native_source':provenance['native_source'],
           'ink_rgb':[47,93,138],'alpha_bbox_px':list(im.getchannel('A').getbbox()),
           'web_export':'public/art/stamps/stamp-hkust.webp'}
    path=ROOT/'manifest.json';raw=path.read_text();previous=json.loads(raw)
    found=next((e for e in previous if e['path']==entry['path']),None)
    if found:assert found==entry,'HKUST stamp record differs'
    else:
        snippet=json.dumps(entry,ensure_ascii=False,indent=2)
        path.write_text(raw[:raw.rfind(']')].rstrip()+',\n'+snippet+'\n]\n')
    assert json.loads(path.read_text())[:len(previous)]==previous
    readme_path=ROOT/'README.md';s=readme_path.read_text()
    prefix,rest=s.split('## Masters\n',1);table,review=rest.split('## Review\n',1)
    note=('- HKUST Passport stamp: one ink-blue round landmark stamp featuring the curved academic '
          'building wrapping the Piazza, with no lettering or emblem. Generated with GPT Image 2, '
          'normalized only with `normalize-stamps.py --only hkust`; every existing stamp stays '
          'byte-identical. Art only, pending Roy’s OK; no app wiring, migration, deployment or merge.\n\n')
    if '- HKUST Passport stamp:' not in prefix:prefix+=note
    row='| `stamps/stamp-hkust.png` | HKUST curved academic building / Piazza Passport stamp | 1024×1024 | ink blue; pending Roy |\n'
    if '| `stamps/stamp-hkust.png` |' not in table:table=table.rstrip()+'\n'+row
    reference=('### HKUST stamp references\n\n'
       '- Ground level: [official Visit HKUST page](https://hkust.edu.hk/visit) and '
       '[Piazza photo used in PR #99](https://hkust.edu.hk/sites/default/files/styles/hkust_multi_card_block_short/public/2025-02/Circle%20of%20Time.png?itok=ecDGajgj). '
       'Credit: HKUST. Used to inspect the curved academic facade behind the sculpture.\n'
       '- Aerial: [HKUST campus view looking from above](https://commons.wikimedia.org/wiki/File:HKUST_campus_view_looking_from_above.jpg), '
       'uploaded by Hkust pao, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). '
       'Inspected 2026-11-10: the concave frontage and square end blocks wrap the Entrance Piazza at '
       'Clear Water Bay. The stamp is an original simplified architectural drawing; no photographic '
       'content is committed. The Red Bird and university emblem are omitted.\n\n'
       '[HKUST stamp review at 40/64/120px](_checks/hkust-stamp-review.png) · '
       '[Checks](_checks/hkust-stamp-audit.json) · [Exact prompt](_checks/hkust-stamp-prompts.json)\n')
    if '### HKUST stamp references' not in review:review+='\n'+reference
    readme_path.write_text(prefix+'## Masters\n'+table.rstrip()+'\n\n## Review\n'+review)
    print('HKUST stamp registered; retained',len(previous),'existing records')


if __name__ == "__main__":
    if sys.argv[1:] == ["--stamp-hkust"]:
        register_hkust_stamp()
        raise SystemExit(0)
    if sys.argv[1:] == ["--red-bird"]:
        register_red_bird()
        raise SystemExit(0)
    if sys.argv[1:] == ["--city-hunt"]:
        register_city_hunt()
        raise SystemExit(0)
    if sys.argv[1:] == ["--public-sea"]:
        register_public_sea()
        raise SystemExit(0)
    main()
    if (CHECKS / "t10b-batch-prompts.json").exists():
        runpy.run_path(str(Path(__file__).with_name("register-b2.py")), run_name="__main__")
