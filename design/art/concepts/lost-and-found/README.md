# Time Capsule / 時光膠囊 — concept pictures

Review concepts only. Corrupted Capsules / 破損膠囊 stay detailed and colourful. A Waypost is a muted solid object floating above the map on one thin straight stem ending in a soft shadow dot. The marker itself is what players spin. Common markers use dusty brass; Landmark markers use dusty plum, a larger shape and a thicker stem.

## Roy to choose

- Ball: A smooth, B poured or C pressed wax.
- Gold treatment: solid brass-gold wax or branching brass-gold veins.
- Crack style: Corrupted A (large branching cracks) or Corrupted B (fine crackle).
- Waypost shape: gem, crystal or solid keyhole, with its matching Landmark version.
- Portrait: bench or lamp.
- Scene: bench or lamp.

## Scope and preserved pictures

Six floating-marker pictures replace every rejected `waypost/block-*` file. There are no building markers or separate spinning objects. Only these new pictures, `screens/map-capsule-and-wayposts.png`, `checks/wayposts-64.png`, `contact-sheet.png`, `make-review.py` and this README change. Everything else stays byte-identical to `816a358`, including catch/fight pictures and layers, backgrounds, capsule art, balls, crack overlays, portraits and scenes. PR #77 stays unchanged.

## Separate layers and backgrounds

Map, shadow, capsule, ball and dust remain separate. Catch and Landmark fight share `screens/catch-background.png`; the overview uses `screens/map-plain.png`. Targets and capsule motion are supplied by app code. No drawn target or glow is added. Both backgrounds are invented and show no real place; the real-geography reference step does not apply.

## Script processing

Run from the repository root with Pillow in a temporary environment outside the repository:

```sh
/tmp/timecapsule-concept-venv/bin/python design/art/concepts/lost-and-found/make-review.py
```

The script writes only inside this concept folder:

- `prepare_objects()` downscales the six new marker canvases to fit 1024 without upscaling. The tool returned genuine transparency; native alpha is retained with near-transparent specks below alpha 4 cleared. Each marker's object, stem and small soft shadow dot remain together as the review marker.
- `screens/map-capsule-and-wayposts.png` starts with the exact kept plain map. The exact Corrupted hourglass stays 200 px tall at its previous position. Three common markers are uniformly resized to 56 px wide and three Landmark markers to 100 px wide. Each is anchored by its bottom shadow dot on a different street. The Landmark crystal is placed away from the common crystal to avoid overlap. No giant capsule is added.
- `checks/wayposts-64.png` shows common markers at maximum visible dimensions 48 and 64 px, and Landmark markers at 64 and 96 px, on map land #F3EFE6. Each size includes the marker, stem and shadow.
- `contact-sheet.png` stays 2200 px wide. Its sections are Balls → Crack effect → Throw and hit → Common Wayposts → Landmark Waypost → To whoever passes by. Building and separate spinner pictures are removed. Only this image contains text.
- Catch/fight composites and their layers are not regenerated. They retain the shared catch background, independent shadow/capsule/ball/dust layers, 60% mending blend, and the existing giant Corrupted Senado fight preview.
- The kept crack effects, restored master, ball checks, portrait circles, scene fades and their checks retain their pixels and previous processing.

Visual review covers all six markers for the requested silhouettes, muted colour families, single stems, soft shadow dots, no platforms/rings/buildings/blue objects/writing, and readability in the size check and map preview. App/browser/device integration is outside this concept review.

## Exact final prompts for the six new pictures

Model: **gpt-image-2 through Codex's built-in image tool**. Every call uses the approved style sheet first and `screens/map-plain.png` second. The exact approved style block starts every prompt.

### `waypost/marker-a-gem.png`

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
One faceted gem shaped like two SHALLOW pyramids joined at their widest point. Wide low diamond silhouette, not a cube or box.
Common Waypost marker. Muted dusty brass based on #C9A15A but greyer and softer, only one colour family, three calm flat facet tones. The hovering object is at the top, one thin straight stem supports it and ends at ONE small soft shadow dot, no platform. Readable at 48 px. No cube, blue object, flat plate, square under the object, ring, disc, tower, building, beam, glow, sparkle, text, letters, numbers, logos or writing-like marks.
```

### `waypost/marker-b-crystal.png`

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
One SHORT six-sided crystal with a shallow point at each end. Short hexagonal prismatic crystal, plainly different from a cube.
Common Waypost marker. Muted dusty brass based on #C9A15A but greyer and softer, only one colour family, three calm flat facet tones. The hovering object is at the top, one thin straight stem supports it and ends at ONE small soft shadow dot, no platform. Readable at 48 px. No cube, blue object, flat plate, square under the object, ring, disc, tower, building, beam, glow, sparkle, text, letters, numbers, logos or writing-like marks.
```

### `waypost/marker-c-keyhole.png`

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
One SOLID keyhole-shaped object with real thickness, standing upright. The external silhouette is a round head merging into a short flared trapezoid foot; filled solid, NOT a hole cut into a plate. No plate behind it.
Common Waypost marker. Muted dusty brass based on #C9A15A but greyer and softer, only one colour family, three calm flat facet tones. The hovering object is at the top, one thin straight stem supports it and ends at ONE small soft shadow dot, no platform. Readable at 48 px. No cube, blue object, flat plate, square under the object, ring, disc, tower, building, beam, glow, sparkle, text, letters, numbers, logos or writing-like marks.
```

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

### `waypost/landmark-b-crystal.png`

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
ONE TALL SIX-SIDED crystal, about twice as tall as the common short crystal, with a shallow point at each end. One elongated faceted hexagonal prism; not a cube or tower.
Landmark Waypost marker. Muted dusty plum based on #6E2B3F but greyer and softer, one colour family with three calm flat facet tones. Clearly larger and more important than its common marker counterpart, supported on a slightly thicker straight stem ending at ONE small soft shadow dot. No base or platform. No cube, blue object, flat plate, square beneath the object, ring, disc, tower, building, beam, glow, sparkle, text, letters, numbers, logos or writing-like marks.
```

### `waypost/landmark-c-keyhole.png`

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
ONE LARGE SOLID keyhole-shaped object with real thickness, upright, with ONE small faceted gem HOVERING a short clear gap ABOVE it. The keyhole external silhouette is a round head merging into a short flared trapezoid foot, filled solid, not a hole in a plate. A single straight stem supports the keyhole. No plate behind it.
Landmark Waypost marker. Muted dusty plum based on #6E2B3F but greyer and softer, one colour family with three calm flat facet tones. Clearly larger and more important than its common marker counterpart, supported on a slightly thicker straight stem ending at ONE small soft shadow dot. No base or platform. No cube, blue object, flat plate, square beneath the object, ring, disc, tower, building, beam, glow, sparkle, text, letters, numbers, logos or writing-like marks.
```

## Retained generation provenance

Previously recorded prompts for kept pictures remain word for word; they may contain older wording or file names. Prompts for deleted buildings and separate spinners are removed.

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
