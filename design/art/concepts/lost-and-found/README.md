# Time Capsule / 時光膠囊 — Roy's chosen concept set

These remain concept pictures, not production assets. The contact sheet shows Roy's chosen set followed by the new picture wheel scenes for approval. Unchosen options remain in the folder for reference; no option artwork is deleted in this update.

## Roy's choices

- Ball: red wax ball with the embossed keyhole from PR #77.
- Gold ball: branching brass-gold veins redrawn onto that keyhole ball, avoiding the keyhole.
- Cracks: Crack A, the large branching cracks.
- To whoever passes by: portrait A and scene A, the envelope on a bench.
- Waypost: floating purple gem; Landmark Waypost: floating deep purple gems. Roy's final marker decision is thinner gems with no poles.

## Roy to approve

- Picture wheel scenes: the five invented places and three loose landmark scenes, including their 96 px and 240 px circular checks.

## Keyhole ball source and exact extraction

`ball/ball-keyhole.png` comes from `design/art/concepts/magic-ball/wax-hero.png` in `origin/codex/magic-ball-concepts`, commit `86d882b`. The source is read directly from Git by the script; no source file or PR #77 change is made.

The normal LEFT ball is selected by the largest connected nonzero-alpha component in the left half of the 1024 × 1024 source canvas. Its exact crop bounds are (102,348)–(431,683), end exclusive: **329 × 335 px**. That original RGBA rectangle is pasted at integer offset (3,0) on a **335 × 335 px** transparent square canvas. There is no resampling, upscaling, filtering, recolouring or alpha adjustment. The right-hand premium ball and its halo are excluded.

`ball/ball-keyhole-gold.png` is the previously chosen generated gold variant. Its exact final prompt and ordered references are below. The output is downscaled to fit 1024 without upscaling; native transparency is retained. Both chosen ball files remain byte-identical in the current update.

## Script processing and separate layers

Run from the repository root with Pillow in a temporary environment outside the repository:

```sh
/tmp/timecapsule-concept-venv/bin/python design/art/concepts/lost-and-found/make-review.py
```

The script writes only inside this concept folder. Its current main path derives the floating gems, rebuilds the map and Waypost check, checks/normalizes the new wheel scenes, builds the wheel check, and rebuilds the contact sheet. The retained ball extraction and preview helpers are not rerun, preserving all previously chosen ball/screen artwork.

- `screens/layers/ball-keyhole.png` replaces `screens/layers/ball-a.png`: exact normal keyhole ball artwork cropped by alpha and uniformly resized to 180 px wide, bottom-centred at the same x centre 512 and y=1270 as before.
- `screens/screen-throw.png` and `screen-landmark-fight.png`: same background, shadow and capsule layers, with only the ball layer swapped. No other pixel outside the old/new ball region changes.
- `checks/balls-64.png`: normal and gold keyhole balls at maximum visible dimension 64 px, on map land #F3EFE6 and white road.
- `checks/bench-portrait-24-40.png`: only the chosen bench portrait at actual 24 and 40 px on paper. The older two-portrait check stays unchanged.
- `contact-sheet.png`: 2200 px wide, in the requested order: keyhole balls/check → Crack A Corrupted/restored hourglass and three other vessels → throw/hit/background → chosen gem Wayposts/map → Landmark fight → bench portrait/check/scene → Waypost picture wheel. Only this image contains text. Ball gallery previews are cropped for comparable visible sizes without upscaling the normal source.
- `waypost/landmark-a-gem.png` remains byte-identical. The small upper gem is a separate alpha piece (rows 103–251, followed by blank rows 252–262). The large gem is clipped along its visible pointed facet boundary: (480,593) → (502,607) → (525,593), removing the pole behind the point and the ground dot. An antialiased alpha mask follows that boundary; no facet is repainted. Each gem is then resized to 50% width at unchanged height with Lanczos resampling. Colours and the three facet tones are retained. The common gem is centred on the original 1024 square. The Landmark keeps the large/small stack, with each gem compressed separately, and applies RGB × 0.8 with the derived alpha unchanged. Neither marker contains a pole, dot or shadow.
- `screens/map-capsule-and-wayposts.png`: original map and capsule recipe retained, with gem centres and top positions anchored to the prior layout. The common gems are about 28 px wide and the Landmark about 55 px wide after the 50% width change. Soft small shadows are drawn only in this preview at the four former pole-dot locations. The capsule remains the main subject. At map size the markers still look like faceted diamonds, not needles or lines.
- `checks/wayposts-64.png`: common floating gem at maximum dimensions 48/64 px and stacked Landmark at 64/96 px on #F3EFE6. Captions on the contact sheet are “Waypost: floating purple gem” and “Landmark Waypost: floating deep purple gems”.
- Corrupted Capsule art, Crack A proofs, restored master, hit picture, backgrounds, ball/portrait checks and all other layers remain byte-identical.
- Existing crack effects, unchosen ball options, Crack B, lamp portrait/scene, their checks and their recorded provenance remain in the folder unchanged.

Map, shadow, capsule, ball and dust remain separate. Targets and capsule motion are supplied by the app. Catch/map backgrounds are invented; the new loose landmark wheel scenes have separately recorded photo references below. No app/browser/device integration is claimed.

Visual checks cover transparency, no writing/logos, no glow/halo on the chosen balls, irregular gold veins avoiding the keyhole, 64 px distinction, and the chosen-set contact sheet. The normal ball's 335 × 335 canvas is intentionally retained at its source resolution.

## Picture wheel scenes — concept review

The eight `wheel/scene-*.png` files are opaque 1024 × 1024 squares generated with Codex's built-in `gpt-image-2` tool. The first ordered reference on every call was `design/art/style-sheet.png`. The two loose tower/fountain scenes also used the specified approved vessel art. No photograph was passed to the image tool, and no real landmark or brand was named in a generation prompt.

The five generic places are invented. The three landmark photographs below were inspected only for broad forms. The tower is deliberately simplified into stacked flared segments; the fountain is a loose pale stone lion/fish figure with a water arc. The Macau scene was checked against its photo for the black-and-cream wave paving, small central round fountain, and pale colonial arcades; it is a simplified concept rather than an exact architectural record.

### Landmark photographs inspected

| Scene | Source photo and author | Licence |
| --- | --- | --- |
| Taipei | [Taipei 101 - Taiwan — Ludovic Lubeigt](https://commons.wikimedia.org/wiki/File:Taipei_101_-_Taiwan.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| Singapore | [Merlion of Singapore — Kistara](https://commons.wikimedia.org/wiki/File:Merlion_of_Singapore.jpg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Macau | [Senado Square Macao — Georgio](https://commons.wikimedia.org/wiki/File:Senado_Square_Macao.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

These licences describe the inspected photos. No photo pixels are included in the concepts.

### Processing and visual checks

The generated 1254 × 1254 outputs are downscaled together with the same Lanczos recipe to 1024 × 1024; no upscaling or background removal is needed. The scene masters contain no text, decorative circle, rim or frame. The app supplies the rim.

`wheel_circle()` in `make-review.py` uses an antialiased circular alpha mask and a simple 3 px brass #C9A15A rim drawn by script. `checks/wheel-96-240.png` shows each scene in the listed order at actual 96 px (left) and 240 px (right), with no text. The contact sheet adds the last section, “Waypost picture wheel”, with all eight 400 px circular previews and plain-English captions. It is the only image in this update with text.

Visual review checked the full scenes and the 96/240 px circular crops for centred subjects, usable crop margins, legibility, no people/writing/logos, hand-inked style and no generated rim/frame. Framing failures and the waterfront's first unwanted object assortment were regenerated; the final saved set has clear central subjects and no unresolved rule failures. The photograph comparisons are visual concept checks, not app/browser/device integration.

### Exact final scene prompts

#### `wheel/scene-park.png`

Model: `gpt-image-2` (Codex built-in)

Ordered references: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

Override for this image only: this is an illustrated scene on an opaque square, 1024×1024, not an object on a transparent background. Ignore the style block's lines about transparent background and object size. It will be cropped to a circle, so one clear subject sits in the centre, all important detail stays within the middle 70%, and the corners hold only simple background. Hand-inked storybook illustration, never photorealistic. Foliage uses ink blue and the muted teal-green of the rose leaves in the style sheet. Calm, simple shapes that read when small. No people, text, signs, logos, circles, rims or frames.
One big shady tree over a curving footpath and a wooden bench. Generic invented park, never a real spot.
The whole tree including its canopy, the bench and the curve of path must fit inside x=15–85% and y=15–85% of the square. Smaller central composition, surrounded by plain soft background. No isolated curved or circular vignette boundary. No flowers in the foreground. First reference is style only, copy no objects from it.
```

#### `wheel/scene-garden.png`

Model: `gpt-image-2` (Codex built-in)

Ordered references: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

Override for this image only: this is an illustrated scene on an opaque square, 1024×1024, not an object on a transparent background. Ignore the style block's lines about transparent background and object size. It will be cropped to a circle, so one clear subject sits in the centre, all important detail stays within the middle 70%, and the corners hold only simple background. Hand-inked storybook illustration, never photorealistic. Foliage uses ink blue and the muted teal-green of the rose leaves in the style sheet. Calm, simple shapes that read when small. No people, text, signs, logos, circles, rims or frames.
A small arched wooden footbridge among flowering shrubs. Generic invented garden, never a real spot.
```

#### `wheel/scene-waterfront.png`

Model: `gpt-image-2` (Codex built-in)

Ordered references: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

Override for this image only: this is an illustrated scene on an opaque square, 1024×1024, not an object on a transparent background. Ignore the style block's lines about transparent background and object size. It will be cropped to a circle, so one clear subject sits in the centre, all important detail stays within the middle 70%, and the corners hold only simple background. Hand-inked storybook illustration, never photorealistic. Foliage uses ink blue and the muted teal-green of the rose leaves in the style sheet. Calm, simple shapes that read when small. No people, text, signs, logos, circles, rims or frames.
A short wooden pier reaching into calm water at soft dusk. Generic invented waterfront, never a real spot.
Use the first reference only for line, colour and texture. Do not copy any of its objects. One EMPTY short wooden pier pointing toward the centre of a calm bay. No vessels, bottles, rose domes, lanterns, boxes, letters, jewellery, loose objects, sun or moon disc. Keep the entire pier inside the middle 70%.
```

#### `wheel/scene-square.png`

Model: `gpt-image-2` (Codex built-in)

Ordered references: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

Override for this image only: this is an illustrated scene on an opaque square, 1024×1024, not an object on a transparent background. Ignore the style block's lines about transparent background and object size. It will be cropped to a circle, so one clear subject sits in the centre, all important detail stays within the middle 70%, and the corners hold only simple background. Hand-inked storybook illustration, never photorealistic. Foliage uses ink blue and the muted teal-green of the rose leaves in the style sheet. Calm, simple shapes that read when small. No people, text, signs, logos, circles, rims or frames.
An open paved square with one simple old street lamp at its centre. Generic invented square, never a real spot.
Use the first reference only for line, colour and texture. Do not copy its vessels, bottles, rose domes, lanterns, boxes, letters or jewellery. No sun or moon disc.
```

#### `wheel/scene-public-art.png`

Model: `gpt-image-2` (Codex built-in)

Ordered references: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

Override for this image only: this is an illustrated scene on an opaque square, 1024×1024, not an object on a transparent background. Ignore the style block's lines about transparent background and object size. It will be cropped to a circle, so one clear subject sits in the centre, all important detail stays within the middle 70%, and the corners hold only simple background. Hand-inked storybook illustration, never photorealistic. Foliage uses ink blue and the muted teal-green of the rose leaves in the style sheet. Calm, simple shapes that read when small. No people, text, signs, logos, circles, rims or frames.
One abstract curved sculpture on a low plinth. Generic invented place, never a real spot.
Use the first reference only for line, colour and texture. Do not copy its vessels, bottles, rose domes, lanterns, boxes, letters or jewellery. No sun or moon disc.
```

#### `wheel/scene-landmark-taipei.png`

Model: `gpt-image-2` (Codex built-in)

Ordered references: `design/art/style-sheet.png`, `design/art/vessels/vessel-bamboo-tower.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

Override for this image only: this is an illustrated scene on an opaque square, 1024×1024, not an object on a transparent background. Ignore the style block's lines about transparent background and object size. It will be cropped to a circle, so one clear subject sits in the centre, all important detail stays within the middle 70%, and the corners hold only simple background. Hand-inked storybook illustration, never photorealistic. Foliage uses ink blue and the muted teal-green of the rose leaves in the style sheet. Calm, simple shapes that read when small. No people, text, signs, logos, circles, rims or frames.
One tall stepped tower of stacked flared segments rising above a low simple city. Loosely inspired only, not an exact likeness. The second reference shows how loose and simplified the form should be; draw a scene, not a vessel.
Use the first reference only for line, colour and texture. Do not copy its vessels, bottles, rose domes, lanterns, boxes, letters or jewellery. No sun or moon disc.
The tower including spire must fit completely within y=18–80% of the square, with generous plain sky above. Low city only in the middle 70%. Simpler than the reference vessel. No foreground flowers or detailed corner objects; corners are plain sky and ground.
```

#### `wheel/scene-landmark-singapore.png`

Model: `gpt-image-2` (Codex built-in)

Ordered references: `design/art/style-sheet.png`, `design/art/vessels/vessel-lionfish-fountain.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

Override for this image only: this is an illustrated scene on an opaque square, 1024×1024, not an object on a transparent background. Ignore the style block's lines about transparent background and object size. It will be cropped to a circle, so one clear subject sits in the centre, all important detail stays within the middle 70%, and the corners hold only simple background. Hand-inked storybook illustration, never photorealistic. Foliage uses ink blue and the muted teal-green of the rose leaves in the style sheet. Calm, simple shapes that read when small. No people, text, signs, logos, circles, rims or frames.
One pale stone fountain figure, part lion and part fish, sending an arc of water into a calm bay. Loosely inspired only, not an exact likeness. The second reference shows how loose and simplified the form should be; draw a scene, not a vessel.
Use the first reference only for line, colour and texture. Do not copy its vessels, bottles, rose domes, lanterns, boxes, letters or jewellery. No sun or moon disc.
Make the fountain figure and the water arc together a single centred group, entirely within x=18–82% and y=20–80% of the square. The figure is smaller and closer to the centre. Plain calm bay around it. No foreground flowers, branches or detailed corner objects.
```

#### `wheel/scene-landmark-macau.png`

Model: `gpt-image-2` (Codex built-in)

Ordered references: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

Override for this image only: this is an illustrated scene on an opaque square, 1024×1024, not an object on a transparent background. Ignore the style block's lines about transparent background and object size. It will be cropped to a circle, so one clear subject sits in the centre, all important detail stays within the middle 70%, and the corners hold only simple background. Hand-inked storybook illustration, never photorealistic. Foliage uses ink blue and the muted teal-green of the rose leaves in the style sheet. Calm, simple shapes that read when small. No people, text, signs, logos, circles, rims or frames.
A sunny old public square with black-and-cream wave-patterned paving, a small round fountain at the centre, and pale pastel colonial buildings behind it. The fountain is a small architectural basin, not a decorative frame around the picture. No lettering on buildings.
Use the first reference only for line, colour and texture. Do not copy its vessels, bottles, rose domes, lanterns, boxes, letters or jewellery. No sun or moon disc.
Simplify this to large calm shapes that read at 96 px. The complete small fountain and the few main building shapes fit in the middle 70%. The corners hold only simple plain sky, building wall or broad paving waves, with no flowers, leaves, branches, window detail or other decorative foreground. No foreground tree. Use broad charcoal-navy and cream paving waves with very little tile detail.
```

## Exact final gold keyhole ball prompt

### `ball/ball-keyhole-gold.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/ball/ball-keyhole.png`, `design/art/concepts/lost-and-found/ball/ball-gold-2-veins.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Redraw the exact wax-red ball with the embossed keyhole from the second reference, with the same shape, wax texture, keyhole and lighting. Add a few bold, irregular, branching brass-gold veins across its surface, like the third reference, thick enough to show at 64 px. The veins go around the keyhole and do not cross it. The inside edge of the keyhole has a little rubbed brass. The veins must never form a straight line, band or two halves. One ball only. No glow, halo, sparkle, button, clasp, seam or opening.
No text, letters, numbers, labels, logos or writing-like marks.
```

## Retained generation provenance

Previously recorded prompts remain word for word for source and reference options. They may contain older wording or file names. Unchosen images remain for reference and are not displayed on the chosen-set contact sheet.

### `waypost/landmark-a-gem.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/screens/map-plain.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is one small, simple map marker made to sit on the map in the second reference image. Ignore the style block's lines about ink line art, hatching, paper grain and palette. Do not copy the detail of the style sheet. One solid object hovers in the upper part of the canvas, held up by a single thin straight stem that ends in one small soft dot of shadow on the ground. The object looks three-dimensional, with a few clean flat facets, matte surfaces, no outlines and three soft tones of a single muted colour (lit, mid, shaded), with light from the top-left. It is calm and slightly dusty, not bright, shiny, glossy, plastic or realistic. Only one colour family. No base, plate, ring, disc, beam, glow, sparkle or ground. Transparent background.
TWO shallow faceted gem shapes stacked: a large gem made from two shallow pyramids joined at their widest point, with a small matching gem HOVERING a short clear gap ABOVE it. The single straight stem supports the large lower gem. No connection or plate between the gems.
Landmark Waypost marker. Muted dusty plum based on #6E2B3F but greyer and softer, one colour family with three calm flat facet tones. Clearly larger and more important than its common marker counterpart, supported on a slightly thicker straight stem ending at ONE small soft shadow dot. No base or platform. No cube, blue object, flat plate, square beneath the object, ring, disc, tower, building, beam, glow, sparkle, text, letters, numbers, logos or writing-like marks.
```

### `screens/catch-background.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is an empty full-bleed portrait phone-screen background, about 1024×1536, not an object on a transparent square. Ignore the style block's lines about ink line art, hatching, view, transparent background, centring, padding, square format and palette. Do not copy the objects or detail of the style sheet. Every pixel is filled using only: water #BCD3E6, land #F3EFE6, park #DCE6CF, sand #EFE3C6, building #E6E0D3, building top #EEE9DE, road #FFFFFF, road edge #D5DDE7, main road #F1E2BF, paper #F6F8FB.
A simple made-up backdrop built from large flat shapes: open pale land, one wide park shape, one curved road, a little water and only a few simple pale blocks near the edges. It is calmer and has bigger shapes than a street map, and is not a real place. The middle of the picture is open plain land. The top edge fades softly into paper #F6F8FB. Flat colour only, not painted. No outlines, labels, pins, trees, grass, cars, people, sky, clouds, phone frame, status bar, buttons, icons or circles.
```

### `screens/map-plain.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is an empty full-bleed portrait phone-screen map, about 1024×1536, not an object on a transparent square. Ignore the style block's lines about ink line art, hatching, view, transparent background, centring, padding, square format and palette. Do not copy the objects or detail of the style sheet. Every pixel is filled using only: water #BCD3E6, land #F3EFE6, park #DCE6CF, sand #EFE3C6, building #E6E0D3, building top #EEE9DE, road #FFFFFF, road edge #D5DDE7, main road #F1E2BF, paper #F6F8FB.
An invented street map seen from above at a gentle tilt, like a calm navigation map: flat pale land, a few white streets, one main road, low pale building blocks, one flat pale park shape and a little water. Keep the centre very plain. The top edge fades softly into paper #F6F8FB. No outlines, labels, pins, trees, grass, cars, people, objects standing on the map, sky, clouds, phone frame, status bar, buttons, icons or circles.
```

### `screens/hit-dust.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is a soft effect, not an inked object. Ignore the style block's lines about ink line art, hatching, view and object size. Do not copy the objects of the style sheet.
One irregular, soft puff of fine wax-red #A3364F dust with a few tiny brass #C9A15A specks, transparent background. No outline, no glow, no shape inside it. It must not form a ring, circle, sunburst or rays.
No text, letters, numbers, logos or marks that resemble writing.
```

### `ball/ball-a-smooth.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

One completely plain, solid wax red #A3364F ball. Every ball is one round hand-sized throwable ball. Soft matte wax, plum hand-inked outline, one soft shading tone, ONE small top-left highlight. Simple at 64 px. No line around it, halves, button, centre circle, centre emblem, stem, wick, keyhole or seal mark. It does not open. No text, letters, numbers, logos, writing-like marks, characters or glossy 3D.
```

### `ball/ball-b-poured.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

One solid wax-red ball with a few soft tone-on-tone drips running down from the top, as if dipped in wax. Drips are subtle surface texture. Not an apple or a cherry. Every ball is one round hand-sized throwable ball. Soft matte wax, plum hand-inked outline, one soft shading tone, ONE small top-left highlight. Simple at 64 px. No line around it, halves, button, centre circle, centre emblem, stem, wick, keyhole or seal mark. It does not open. No text, letters, numbers, logos, writing-like marks, characters or glossy 3D.
```

### `ball/ball-c-pressed.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.

One solid wax-red ball with one soft thumbprint dent off-centre at the upper right, tone on tone. Every ball is one round hand-sized throwable ball. Soft matte wax, plum hand-inked outline, one soft shading tone, ONE small top-left highlight. Simple at 64 px. No line around it, halves, button, centre circle, centre emblem, stem, wick, keyhole or seal mark. It does not open. No text, letters, numbers, logos, writing-like marks, characters or glossy 3D.
```

### `ball/ball-gold-1-colour.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/ball/ball-a-smooth.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
The exact same plain matte wax sphere as reference 2, now in rich brass-gold wax #C9A15A with ONE small cream top-left highlight and one soft shading tone. No emblem, button, centre circle, seam, band, halves, keyhole, stem or wick. One hand-sized throwable ball.
No text, letters, numbers, logos or marks resembling writing. No extra objects.
```

### `ball/ball-gold-2-veins.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/ball/ball-a-smooth.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
The exact same wax-red sphere as reference 2 with a FEW bold irregular branching brass-gold veins across its surface, like gold mended into old pottery. Thick enough to show at 64 px. Veins must never make a straight line, equatorial band, circle or halves. No emblem, button, centre circle, seam, keyhole, stem or wick.
No text, letters, numbers, logos or marks resembling writing. No extra objects.
```

### `cracks/crack-a-large-raw.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is a crack-pattern layer, not an object. Ignore the style block's lines about view, transparent background, centring, padding and palette. Pure white background, navy #16263F ink lines only, no shading and no object. The pattern fills the whole square from edge to edge.
A few long, bold, branching hand-inked cracks, distributed across the whole square, with generous white areas. Crack ends reach canvas edges. No border.
No text, letters, numbers, logos or marks resembling writing. No extra objects.
```

### `cracks/crack-b-fine-raw.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is a crack-pattern layer, not an object. Ignore the style block's lines about view, transparent background, centring, padding and palette. Pure white background, navy #16263F ink lines only, no shading and no object. The pattern fills the whole square from edge to edge.
Fine crackle like old porcelain, denser on the right side and sparse on the left. Continuous branching network across the whole square to edges. No border.
No text, letters, numbers, logos or marks resembling writing. No extra objects.
```

### `whoever/portrait-a-bench.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/portraits/portrait-01.png`, `design/art/vessels/vessel-envelope.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: the object fills a circular background disc, centred at (505,526) with radius 430 on a 1024 square, the same disc as the framing reference, transparent outside it.
An empty wooden bench with ONE small sealed cream envelope resting on it, on a pale cream circular background disc.
Reference 2 is ONLY for circular framing and line thickness; do not copy the person. Reference 3 is the sealed envelope design. Thicker outline, broad shapes, almost no hatching, legible at 24 px and 40 px. No sea, bottles, people, faces, creatures, lettering, numbers, logos, text or writing-like marks. Simple calm object portrait.
```

### `whoever/portrait-b-lamp.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/portraits/portrait-01.png`, `design/art/vessels/vessel-envelope.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: the object fills a circular background disc, centred at (505,526) with radius 430 on a 1024 square, the same disc as the framing reference, transparent outside it.
An old ink-blue street lamp with ONE sealed cream envelope tied to its post by a wax-red ribbon, on a pale glass-blue circular background disc.
Reference 2 is ONLY for circular framing and line thickness; do not copy the person. Reference 3 is the sealed envelope design. Thicker outline, broad shapes, almost no hatching, legible at 24 px and 40 px. No sea, bottles, people, faces, creatures, lettering, numbers, logos, text or writing-like marks. Simple calm object portrait.
```

### `whoever/scene-a-bench.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/vessels/vessel-envelope.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is a wide illustrated scene, about 1536×1024, not one object on a square. Ignore the centring, padding and square lines. Only the edges will fade to transparent.
A quiet footpath at soft blue-and-cream dusk, with an EMPTY wooden bench under a lit old street lamp and ONE small sealed cream envelope waiting on the bench. Calm, tender, nobody there.
Reference 2 is the envelope design. Wide 1536x1024 composition. No sea, bottle, people, faces, creatures, text, letters, numbers, logos or marks resembling writing. Keep blue-and-cream dusk inside the approved palette. Edges softly fade to transparent.
```

### `whoever/scene-b-lamp.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/vessels/vessel-envelope.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is a wide illustrated scene, about 1536×1024, not one object on a square. Ignore the centring, padding and square lines. Only the edges will fade to transparent.
A small corner of a quiet lane at soft blue-and-cream dusk, with ONE sealed cream envelope tied to a lit old street lamp by a wax-red ribbon, and a path leading away. Calm, tender, nobody there.
Reference 2 is the envelope design. Wide 1536x1024 composition. No sea, bottle, people, faces, creatures, text, letters, numbers, logos or marks resembling writing. Keep blue-and-cream dusk inside the approved palette. Edges softly fade to transparent.
```
