# Vessel SOP: making a vessel that animates

The checklist **every new vessel** follows, so it drops into the app's opening, sealing, idle and Cabinet animations without surprises. Read [STYLE.md](STYLE.md) first (model `gpt-image-2`, the reference sheet, the style block). This file adds the vessel-specific rules. The list of planned vessels is in [docs/design/vessels-50.md](../../docs/design/vessels-50.md).

Code it relates to (owned by the screens team): `mobile/src/art/manifest.ts` (`vesselParts`, the data every animation reads), `mobile/src/components/Vessel.tsx` (the generic motion engine), `mobile/src/vesselArt.ts` (`VesselKind`).

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

Idle extras: `sway` (rotate a little around a pivot), `bob` (up and down), `breathe` (small scale), `glow` (opacity pulse or flicker), `drift` (a particle layer drifting and fading on a loop: steam and fireflies rise, snow and sand fall with `"direction": "down"`), `spin` (slow continuous turn), `tick` (a small periodic jolt).

### Pivots
- [ ] Measure pivots in **px on the 1024 canvas**, at the hinge line's midpoint (for example the back edge of a lid where it meets the box). For a `door`, use the hinge side's midpoint.
- [ ] Draw a crosshair at every pivot on a review overlay (section 7) and check it sits exactly on the hinge.

## 4. The opening move
- [ ] **The resting pose is each layer's `open` keyframe at `at: 0`.** The app shows the layers in that pose while closed (for example, the instant-camera photo rests squashed into its slot), so the assembled image must look exactly like the layers at `at: 0`. Check this on the motion overlay's CLOSED panel.
- [ ] A property you only set at a later key eases in from its default at 0 (x/y 0, rotate 0, scale 1, opacity 1), so the `at: 0` key doesn't need to repeat defaults. Repeating them is harmless.
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
- [ ] Make motion clearly visible on a phone (Roy, 2026-11-07, PR #37) without looking frantic: sway about 2.5–6°, bob/float about 2.5–3.5% of the size, breathe about 2.5–3.5%, a lid peek up to about 9°. One loop lasts 3.4–4.6 s (`idleMs`). Every term repeats whole turns, so the loop is seamless and t = 0 is the rest pose.
- [ ] **Sparkle anchor**: one `{x, y}` on wax, brass, gold or glass where `fx-glint.webp` twinkles once per loop (today: envelope 440,512 · tin 300,470 · maison 438,612 · lantern 578,214).
- [ ] Glows and drifting particles are their own soft layers with no outline (like `vessel-lantern-glow`).
- [ ] **`drift` fades the whole layer in and out every loop**, so use it only on a layer of loose particles (flakes, steam, fireflies, a falling stream of sand). Never put anything that must stay visible (a sand pile, a scene) on a drift layer. For trickling sand, draw two layers: a stream (drift down) and a pile (static). Batch 1's hourglass mixed them, so its drift had to be removed in code.
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
Add a `vessel` block to each vessel's assembled-file entry, alongside `path`, `what`, `size_px`, `transparent`, `prompt` and `model`. It uses exactly the field names of `IllustratedParts` in `mobile/src/art/manifest.ts` (§9), with `file` in place of `source`. Pivots, mouth, baseY and sparkle are px on the 1024 canvas. In `open` keyframes, `at` is how far it has opened (0–1), x/y are fractions of the drawn size and rotate is in degrees, measured on the motion overlay. Idle motions are `{ "type": "<sway|bob|float|breathe|peek|spin|tick|drift|glow>", ...params }`.
```json
"vessel": {
  "id": "ramen",
  "opening": "B",
  "idleMs": 4000,
  "idle": [{ "type": "bob", "amount": 0.03 }],
  "layers": [
    { "name": "bowl", "file": "vessel-ramen-bowl.png", "role": "static" },
    { "name": "steam", "file": "vessel-ramen-steam.png", "role": "fade",
      "open": [{ "at": 0, "opacity": 0.6 }, { "at": 1, "opacity": 0 }],
      "idle": [{ "type": "drift", "amount": 0.04 }] },
    { "name": "lid", "file": "vessel-ramen-lid.png", "role": "lift", "pivot": { "x": 512, "y": 470 },
      "open": [{ "at": 0, "y": 0, "opacity": 1 }, { "at": 1, "y": -0.32, "rotate": -6, "opacity": 0 }] }
  ],
  "mouth": { "x": 512, "y": 470 },
  "baseY": 905,
  "sparkle": { "x": 640, "y": 455 },
  "glint": null,
  "openGlow": null,
  "readyPulse": null
}
```
`layers` are listed **bottom to top**. Mark a layer `"ground": true` only if it must stay still while the rest of the vessel idles (like the sea under the bottle); ground layers must come first.

## 9. Code changes per vessel (screens team / Codex)
Motion is **data-driven** (PR "vessel spec"): a vessel's opening, idle loop, letter drop, shelf base, sparkle and glint all come from its entry in `vesselParts` in `mobile/src/art/manifest.ts` (type `IllustratedParts`). No motion code per vessel. Each new vessel needs:
- [ ] `mobile/src/vesselArt.ts`: add the id to `VesselKind`. (Vessels without an SVG drawing automatically show the illustrated art.)
- [ ] `mobile/src/art/manifest.ts`: one `vesselParts` entry, copied from `manifest.json` → `vessel`:
  - `assembled`, and `layers` bottom to top: `name`, `source` (literal `require`), `role`, `pivot`;
  - `open`: keyframes `{ at, x, y, rotate, scaleX, scaleY, scale, opacity }`, with `at` = lidLift 0–1, x/y as fractions of the size, rotate in degrees. Optional `openReady` (when the capsule is ready), `idle` (motions of this layer) and `ground: true` (stays still while the vessel idles; list ground layers first);
  - `opening` (code A–K), `idleMs`, `idle` (whole-vessel motions), `mouth`, optional `letterDrop` (otherwise 145 + mouth.y × 120 / 1024), `baseY`, `sparkle`, `glint` (a glass highlight layer), `openGlow` (a light revealed while opening), `readyPulse` (a layer name that pulses while ready).
  - Idle motion types: `sway {deg, pivot?, turns?}`, `bob {amount, axis?, turns?}`, `float {amount}`, `breathe {amount}`, `peek {deg, pivot}`, `spin {pivot?, turns?}`, `tick {deg, pivot?}`, `drift {amount, direction?}` (particles drift and fade; `direction: "down"` for snow or sand, default up for steam and fireflies), `glow {base, range, readyBase?, readyRange?, flicker?}`.
  - Opening types are just keyframes: F slide = x/y; G unscrew = rotate then y; H split = two `hinge` layers with their own pivots; J door = `scaleX` from a side `pivot`; K pop = y/scale with an overshoot key.
- [ ] i18n: `shop.vessel.<id>` and `shop.desc.<id>` in both 繁中 and English.
- [ ] Database: a migration inserting the `vessels` row (`id, price_mop, edition_total, brand, sort`). The shop stays free while testing.
- [ ] Run it on the phone and on web (port 8088): idle, open, the seal drop, the Cabinet shelf, and with Reduce Motion on.

## 10. Order of work for a batch
1. Test vessel first (one), with its checks and motion overlay → Roy's OK.
2. The rest of the batch, using the same checks.
3. Art PR (masters, WebP, manifest, README table, contact sheet) → review → merge.
4. Code PR wiring the batch in (section 9) → review → merge.
