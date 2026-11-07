# Vessel SOP: making a vessel that animates

The checklist **every new vessel** follows, so it drops into the app's opening, sealing, idle and Cabinet animations without surprises. Read [STYLE.md](STYLE.md) first (model `gpt-image-2`, the reference sheet, the style block). This file adds the vessel-specific rules. The list of planned vessels is in [docs/design/vessels-50.md](../../docs/design/vessels-50.md).

Code it relates to (owned by the screens team): `mobile/src/art/manifest.ts` (`vesselParts`), `mobile/src/components/Vessel.tsx` (`MovingLayer`, `IDLE_MS`, `idleStyle`, `SPARKLE`), `mobile/src/features/create/CreateScreen.tsx` (`LETTER_DROP`), `mobile/src/features/cabinet/CabinetScreen.tsx` (`baseY`), `mobile/src/vesselArt.ts` (`VesselKind`).

---

## 1. Canvas and position (same for every vessel)
- [ ] All files for a vessel share **one 1024×1024 canvas**. The assembled image and every part sit at exactly the same position and scale.
- [ ] **Centred horizontally.** The widest point is at most 760 px wide.
- [ ] **The base sits at y = 880–920** (the lowest opaque pixel). New vessels standardise on this so shelves and cards line up; the 7 existing vessels vary between 0.76 and 0.93 of the height.
- [ ] Leave at least 100 px of clear space above the top, so lids and caps have room to lift inside the canvas.
- [ ] **Closed** in the assembled image. Anything that moves is its own part.

## 2. Files and names
`design/art/vessels/` (PNG masters) → `public/art/vessels/` (WebP, made by `scripts/export-webp.cjs`).

- [ ] `vessel-<id>.png`: the assembled vessel (used whenever nothing moves).
- [ ] `vessel-<id>-<part>.png`: one file per part, named by what it is (`lid`, `door`, `cap`, `left`/`right`, `glow`, `steam`…).
- [ ] Optional `vessel-<id>-glint.png`: a highlight streak for glass or metal (like `vessel-dome-glint.png`).
- [ ] `<id>`: lowercase, a single word or hyphenated, and identical to the id in the database `vessels` row (for example `mixtape`, `ramen`, `phone-booth`).

## 3. Layer roles
Every part gets one role. Opening roles describe what happens as `lidLift` goes from 0 to 1. Idle roles are optional and describe the resting loop.

| Role | What it does on open | Existing example |
|---|---|---|
| `static` | Doesn't move (the body, the base, the contents) | dome base, tin box |
| `hinge` | Rotates open around `pivot` (lids and doors with a back or side hinge) | tin, music box, ring-box lids; bottle cork |
| `lift` | Moves straight up, usually fading | dome glass, lantern cap |
| `fade` | Fades out (seals, knots, straps) or fades in (glows) | envelope seal, lantern glow |
| `slide` *(new)* | Moves out along a direction (sleeves, drawers, photos) | — |
| `twist` *(new)* | Rotates a few degrees in place, then lifts (screw lids) | — |
| `split` *(new)* | Two parts rotate apart, each about its own pivot | — |
| `door` *(new)* | Swings on a vertical side hinge (narrows horizontally from `pivot`) | — |
| `pop` *(new)* | Springs up with a small overshoot | — |

Idle extras: `sway` (rotate a little around a pivot), `bob` (up and down), `breathe` (small scale), `glow` (opacity pulse or flicker), `drift` (a particle layer such as steam, snow or fireflies, rising and fading on a loop), `spin` (slow continuous turn), `tick` (a small periodic jolt).

### Pivots
- [ ] Measure pivots in **px on the 1024 canvas**, at the hinge line's midpoint (for example the back edge of a lid where it meets the box). For a `door`, use the hinge side's midpoint.
- [ ] Draw a crosshair at every pivot on a review overlay (section 7) and check it sits exactly on the hinge.

## 4. The opening move
Pick **one opening type** per vessel (the codes match the plan):

| Code | Type | Roles used |
|---|---|---|
| A | Hinge lid | `hinge` (lid) |
| B | Lift-off cover | `lift` (cover) |
| C | Cap lift | `lift` (small cap) |
| D | Pop and pull | `hinge` (stopper) plus `slide` (contents) |
| E | Flap fold | `fade` (seal) plus `hinge` (flap) |
| F | Slide out | `slide` |
| G | Unscrew | `twist` |
| H | Split | `split` (two parts) |
| J | Door swing | `door` |
| K | Pop-up | `pop` |

A to E are already built. F, G, H, J and K each need code once (section 9), after which every vessel can reuse them.

- [ ] When open, the **letter or contents must be visible or reachable**: draw the inside completely (box interior, the inner side of a door, a cup's insides), with no holes.
- [ ] **Mouth point**: the canvas point `{x, y}` where the letter enters when sealing. The seal step drops the letter from stage y = 125 into a 120 px vessel at stage y = 270, so **`LETTER_DROP` ≈ 145 + mouth.y × 120 / 1024**. Check against today's values (dome 205 ↔ mouth y ≈ 512, bottle 190, musicbox 220) and fine-tune by eye.

## 5. Idle motion and sparkles
- [ ] Choose 1–2 idle motions from section 3 (more looks busy). Name which part each one moves, and give a pivot for `sway`.
- [ ] Keep motion small: sway at most 3°, bob at most 1.5% of the size, scale at most 1.5%. One loop lasts 4.4–6.4 s (`IDLE_MS`). Every term repeats whole turns, so the loop is seamless and t = 0 is the rest pose.
- [ ] **Sparkle anchor**: one `{x, y}` on wax, brass, gold or glass where `fx-glint.webp` twinkles once per loop (today: envelope 440,512 · tin 300,470 · maison 438,612 · lantern 578,214).
- [ ] Glows and drifting particles are their own soft layers with no outline (like `vessel-lantern-glow`).
- [ ] With **Reduce Motion** on, the app shows the assembled image. Nothing may depend on motion to make sense.

## 6. Transparency and glass
- [ ] Every vessel file has real alpha, with corners at alpha 0 (`scripts/check-assets.py`).
- [ ] **Glass never hides what's inside it:** after generating, run `scripts/adjust-glass-alpha.py` (interior to about 35–40%; outline, rims and highlights stay opaque). Glass goes on top of what's inside it.
- [ ] Glows, steam and smoke are soft and semi-transparent, with no hard edges.

## 7. Sizes and checks
The app draws vessels at **35–46 px** (map pins, chips), **95–120 px** (cards, seal step), **150–190 px** (capsule pages, shop) and up to **230 px** (shop detail).
- [ ] Silhouette check: readable and recognisable at **40 px** and **120 px** (`_checks/<id>-at-120px.png` plus a 40 px strip).
- [ ] Stack check: the parts composited in order match the assembled image (`scripts/check-vessels.py` → `_checks/<id>-stack.png`).
- [ ] **Motion overlay**: one sheet per vessel showing closed, half open and fully open, with pivots, the mouth point and the sparkle anchor marked (`_checks/<id>-motion.png`). This is what the reviewer approves.
- [ ] IP check: an original design, no logos, no brand shapes, no characters (see the plan's list of rejected ideas).

## 8. Manifest fields (`design/art/manifest.json`)
Add these to each vessel's assembled-file entry, alongside the usual `path`, `what`, `size_px`, `transparent`, `prompt` and `model`:
```json
"vessel": {
  "id": "ramen",
  "opening": "B",
  "layers": [
    { "name": "bowl", "file": "vessel-ramen-bowl.png", "role": "static" },
    { "name": "steam", "file": "vessel-ramen-steam.png", "role": "fade", "idle": { "type": "drift" } },
    { "name": "lid", "file": "vessel-ramen-lid.png", "role": "lift", "pivot": { "x": 512, "y": 470 } }
  ],
  "baseY": 905,
  "mouth": { "x": 512, "y": 470 },
  "sparkle": { "x": 640, "y": 455 },
  "glint": null,
  "idleMs": 5200
}
```
`layers` are listed **bottom to top**, in drawing order.

## 9. Code changes per vessel (screens team / Codex)
Until motion is data-driven, every new vessel needs all of these:
- [ ] `mobile/src/vesselArt.ts`: add the id to `VesselKind`. Also make the SVG fallback show the illustrated art for vessels that have no SVG drawing (only the original 7 have SVGs).
- [ ] `mobile/src/art/manifest.ts`: add a `vesselParts` entry (requires for the assembled image and each layer, plus role and pivot).
- [ ] `mobile/src/components/Vessel.tsx`: the opening motion in `MovingLayer` (a new type F/G/H/J/K needs its motion added once), plus `IDLE_MS`, the `idleStyle` cases and `SPARKLE`.
- [ ] `CreateScreen.tsx`: a `LETTER_DROP` value from the mouth point. `CabinetScreen.tsx`: a `baseY` value (baseY / 1024).
- [ ] i18n: `shop.vessel.<id>` and `shop.desc.<id>` in both 繁中 and English.
- [ ] Database: a migration inserting the `vessels` row (`id, price_mop, edition_total, brand, sort`). The shop stays free while testing.
- [ ] Run it on the phone and on web (port 8088): idle, open, the seal drop, the Cabinet shelf, and with Reduce Motion on.

**Recommended once, before the first batch:** have `Vessel.tsx` read the motion from the manifest (role, pivot, opening type, idle, mouth, baseY, sparkle) instead of `if kind === …` code. After that, a new vessel is just art plus a manifest entry plus the database row and translations.

## 10. Order of work for a batch
1. Test vessel first (one), with its checks and motion overlay → Roy's OK.
2. The rest of the batch, using the same checks.
3. Art PR (masters, WebP, manifest, README table, contact sheet) → review → merge.
4. Code PR wiring the batch in (section 9) → review → merge.
