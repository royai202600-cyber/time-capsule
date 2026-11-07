# Art style guide: 時光膠囊 / Time Capsule

Read this before generating, editing or regenerating **any** illustration for the app, so new art matches the approved set. `README.md` in this folder lists the files that already exist; this file says how to make new ones.

## 1. Model and tool

- **Model: `gpt-image-2`, nothing else.** Not DALL·E, not gpt-image-1, not a tool's unnamed default.
- **Codex:** use Codex's built-in image generation, which is `gpt-image-2`. **No API key is needed.** If the built-in tool isn't available or can't use gpt-image-2, stop and tell Roy. Never fall back to another model silently.
- **Any other agent or script:** call the OpenAI Images API with `model: "gpt-image-2"` and read `OPENAI_API_KEY` from the environment. Never write the key to a file or commit it.
- **Every call:** pass `design/art/style-sheet.png` as the reference image ("match this style exactly"), and repeat the full style block from section 2 in the prompt. Calls don't remember each other, so the reference and the block are what keep the style consistent.

## 2. Style block (paste into every prompt, unchanged)

```
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
```

Roy approved a palette exception for warm amber-orange pumpkin shells on 2026-11-07 (T10c-fix), and teal-green bamboo leaves matching the existing dome rose leaves. Keep the style block above unchanged in prompts; state the approved exception separately when applicable.

Roy approved style sheet **A** (`style-sheet.png`). `style-sheet-a/b/c.png` are kept for history only, so never use B or C as the reference.

## 3. Rules by kind of asset

**Vessels (anything that opens)**
- **New vessels: follow [VESSEL-SOP.md](VESSEL-SOP.md)**, the per-vessel checklist for the canvas, layers, roles, pivots, the opening move, idle motion, checks, manifest fields and the code changes.
- Generate the **assembled** image first. Then make each **part** by editing that same image ("keep only the <part>, same position and same scale, everything else fully transparent"), so the parts stack exactly on one 1024×1024 canvas.
- Vessels are **closed** in the assembled image. Lids, flaps and corks are separate parts.
- Draw anything that gets revealed completely, with no holes: a box's interior, the ring's velvet seat, the letter under a flap.
- **Glass never hides what's inside it.** After generating, lower the glass interior alpha to about 35–40% with `scripts/adjust-glass-alpha.py`, keeping the outline, knob and highlights opaque. The glass goes on top of what's inside it.
- Record each lid, flap or cork hinge as a pivot `{x, y}` in px on the 1024 canvas, in the manifest.
- Name the files `vessels/vessel-<id>.png` and `vessels/vessel-<id>-<part>.png`, where `<id>` is the database id from the `vessels` table.

**Portraits (the app's main profile pictures)**
- Head and shoulders, warm and friendly, never caricatures. The set as a whole should vary in age, gender, hair and skin tone.
- Must read at **24 px and 40 px**: simple shapes, a clear silhouette, a slightly thicker outline than the vessels, no hatching on faces. Glasses use thick navy frames.
- Same framing in every portrait: run `scripts/mask-portraits.py` to cut each one to an identical circle (centre 505,526, radius 430 on a 1024 canvas), each disc a different soft palette colour.
- A new portrait also has to be registered in `mobile/src/art/manifest.ts`. That's the screens team's file, so tell them.

**Passport stamps**
- Round ink-stamp look, **one colour** per stamp (plum, ink blue or wax red), slightly imperfect edges, no lettering. Run `scripts/normalize-stamps.py` on the result.
- Name them `stamps/stamp-<placeId>.png`, where `<placeId>` is the id from the `places` table.

**Maps and flags**
- Before drawing, look at a reliable real-world reference (for example Natural Earth coastlines), record the source in the README, and check the result against it (AGENTS.md rule).
- Every place on a map needs a pin `{x, y}` in native px in the manifest, checked with `scripts/check-map-pins.py`. These pins are display positions only. GPS checks still use the `places` table.

**Scenes, textures and effects**
- Scenes (about 1536×1024): edges fade to transparent so the scene sits on the paper texture.
- Textures: opaque and seamlessly tileable 1024² (`paper.png` is cool, `paper-letter.png` is warmer).
- Effects (for example the light burst): soft, no outline, transparent.
- Shelves and walls must match the existing `shelf.png`: shelf surfaces at y≈250/510/765, usable width x≈175–850 on its 1024 canvas.

**UI icons are not generated.** They're drawn in code, using `icon-reference.png` as the style reference.

**App icon:** opaque, with no transparency (iOS rejects transparent icons), no text, readable at 32 px.

## 4. Process (every new batch)

1. **Test first.** Make one example (or 3 for a set) and run its checks. Show Roy and wait for his OK before doing the rest.
2. **Fix small problems with scripts, not by regenerating.** Regenerating to tweak glass or edges introduced artifacts before.
3. **Checks** (scripts in `scripts/`, Pillow required): transparent corners where a transparent background is expected, parts stack at 120 px (`check-vessels.py`), portraits at 24/40 px (`check-portraits.py`), everything else with `check-assets.py`. Save check images in `_checks/`.
4. **Size:** the built-in tool returns about 1254 px. Downscale a vessel's parts *together* to 1024, never one by one, and never upscale.
5. **Export:** `scripts/export-webp.cjs` writes WebP copies to `public/art/` at the same paths (quality 85, alpha kept, max 512 px; maps and wide images up to 1600). The app loads `public/art/` and never the masters.
6. **Record:** add every new file to `manifest.json` (`scripts/build-manifest.py`: path, what, size, transparent, the exact prompt, model, and pivots or pins) and to the `README.md` table, then regenerate `_checks/contact-sheet.png`.
7. **Ship:** commit on a `codex/` branch and open a PR with the contact sheet in the description. Merge only after Roy's OK. Don't change app code in an art PR. Wiring art into screens is a separate task.

## 5. Rollback

The original line-drawn SVG art is tagged `art-svg-v1` and still lives in `src/art.js`. The app keeps the SVG option selectable.
