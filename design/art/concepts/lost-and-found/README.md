# Time Capsule / 時光膠囊 — concept pictures

Concept review only. Corrupted Capsules / 破損膠囊 remain the detailed illustrated objects. Common Wayposts, Landmark Wayposts and spinning objects use quiet, simple solid forms that match the live map's gentle elevated angle. Common roofs are soft brass; Landmark roofs are muted plum. Their walls stay pale map cream.

## Roy to choose

- Ball: A smooth, B poured or C pressed wax.
- Gold treatment: solid brass-gold wax or branching brass-gold veins.
- Crack style: Corrupted A (large branching cracks) or Corrupted B (fine crackle).
- Common Waypost shape: small house, low wide hut or narrow kiosk.
- Landmark Waypost shape: wide hall or two-storey building.
- Spinning object: pinwheel or four-envelope windmill.
- Portrait: bench or lamp.
- Scene: bench or lamp.

## Scope and preserved pictures

This correction replaces the rejected flat Waypost, Landmark building and spinner files with seven `waypost/block-*.png` concepts. The overview, size check, contact sheet, script and this README are updated. Every other file remains byte-identical to `b3f9a4f`, including all catch/fight pictures, backgrounds, capsule layers, balls, crack art, portraits and scenes. PR #77 is unchanged.

## Separate layers and backgrounds

Map, shadow, capsule, ball and dust remain separate. Catch and Landmark fight share `screens/catch-background.png`. The live-map preview uses `screens/map-plain.png`.

Positioned layers remain under `screens/layers/`: shadow, Corrupted capsule, mending capsule, Ball A, dust, Landmark shadow and Landmark capsule. They contain no target artwork. The app supplies targets and movement. Both backgrounds are invented and show no real place; the real-geography reference step does not apply.

## Script processing

Run from the repository root with Pillow in a temporary environment outside the repository:

```sh
/tmp/timecapsule-concept-venv/bin/python design/art/concepts/lost-and-found/make-review.py
```

The script writes only inside this concept folder:

- `prepare_objects()` downscales only the seven new object pictures to fit 1024 without upscaling. The tool returned genuine transparency, so native alpha is preserved apart from clearing near-transparent specks below alpha 4. Pale cream walls are not colour-keyed away. It does not add outlines, a ground, base or ground shadow.
- `screens/map-capsule-and-wayposts.png` starts from the exact kept live-map background. The exact Corrupted hourglass stays 200 px tall at the same position. The three new common Wayposts are 80 px wide at the former marker centres, and the two new Landmark Wayposts are 140 px wide at the former Landmark centres. No giant capsule is added to this map.
- `checks/wayposts-64.png` shows the three common buildings and two spinners at maximum visible dimensions 48 and 64 px, and the two Landmark buildings at 64 and 96 px, on map land #F3EFE6.
- `contact-sheet.png` stays 2200 px wide. Its sections are Balls → Crack effect → Throw and hit → Common Wayposts with spinners → Landmark Waypost → To whoever passes by. Captions identify brass roofs and plum roofs. Only this image contains text.
- The script no longer regenerates catch/fight composites or modifies their layers. Those retained previews use the shared catch background, separate shadow, exact capsule pixels, Ball A or dust as appropriate. The mending capsule remains 60% blended toward the restored source. The fight keeps its 717 px Corrupted Senado capsule, enlarged soft shadow and existing bottom-centre ball.
- Kept crack effects, restored master, ball checks, circular portraits, scene fades and their checks retain their pixels and previous processing.

Visual review checks all seven objects for simple matte solid forms, recesses rather than decorative detail, no writing, transparent backgrounds, no ground shadows and small-size readability. App/browser/device integration is outside this concept review.

## Exact final prompts for the seven new pictures

Model: **gpt-image-2 through Codex's built-in image tool**. Each call supplies `design/art/style-sheet.png` first and the kept plain live map second. The unchanged style block begins every prompt.

### `waypost/block-waypost-a-house.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/screens/map-plain.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is one simple solid object made to sit on the map in the second reference image. Ignore the style block's lines about ink line art, hatching, paper grain and palette. Do not copy the detail of the style sheet. It looks three-dimensional like the low blocks on that map: seen from above at the same gentle angle, built from a few simple solid forms, with matte surfaces, no outlines and three soft flat tones (lit top, mid side, shaded side), with light from the top-left. It is not glossy, plastic, realistic or a detailed 3D render. No shadow on the ground, no ground, base, disc, ring, beam or glow. Transparent background, object centred.
A small house with a plain pitched roof and one door.
Walls in map cream #EEE9DE and #E6E0D3, with soft darker tones of the same cream for shaded sides. The door or window is one plain darker recess. Roof in soft brass #C9A15A with lighter and darker brass tones. Read as a small building at 64 px. Never a pole, sign, tall tower, arena, cube or floating shape. Keep extremely simple, quiet and low detail. No ground shadow, outlines, decorative detail, text, letters, numbers, labels, logos or writing-like marks.
```

### `waypost/block-waypost-b-hut.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/screens/map-plain.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is one simple solid object made to sit on the map in the second reference image. Ignore the style block's lines about ink line art, hatching, paper grain and palette. Do not copy the detail of the style sheet. It looks three-dimensional like the low blocks on that map: seen from above at the same gentle angle, built from a few simple solid forms, with matte surfaces, no outlines and three soft flat tones (lit top, mid side, shaded side), with light from the top-left. It is not glossy, plastic, realistic or a detailed 3D render. No shadow on the ground, no ground, base, disc, ring, beam or glow. Transparent background, object centred.
A low, wide hut with a plain overhanging roof and one small window.
Walls in map cream #EEE9DE and #E6E0D3, with soft darker tones of the same cream for shaded sides. The door or window is one plain darker recess. Roof in soft brass #C9A15A with lighter and darker brass tones. Read as a small building at 64 px. Never a pole, sign, tall tower, arena, cube or floating shape. Keep extremely simple, quiet and low detail. No ground shadow, outlines, decorative detail, text, letters, numbers, labels, logos or writing-like marks.
```

### `waypost/block-waypost-c-kiosk.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/screens/map-plain.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is one simple solid object made to sit on the map in the second reference image. Ignore the style block's lines about ink line art, hatching, paper grain and palette. Do not copy the detail of the style sheet. It looks three-dimensional like the low blocks on that map: seen from above at the same gentle angle, built from a few simple solid forms, with matte surfaces, no outlines and three soft flat tones (lit top, mid side, shaded side), with light from the top-left. It is not glossy, plastic, realistic or a detailed 3D render. No shadow on the ground, no ground, base, disc, ring, beam or glow. Transparent background, object centred.
A tiny narrow kiosk with a small pointed roof and one service window.
Walls in map cream #EEE9DE and #E6E0D3, with soft darker tones of the same cream for shaded sides. The door or window is one plain darker recess. Roof in soft brass #C9A15A with lighter and darker brass tones. Read as a small building at 64 px. Never a pole, sign, tall tower, arena, cube or floating shape. Keep extremely simple, quiet and low detail. No ground shadow, outlines, decorative detail, text, letters, numbers, labels, logos or writing-like marks.
```

### `waypost/block-landmark-a-hall.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/screens/map-plain.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is one simple solid object made to sit on the map in the second reference image. Ignore the style block's lines about ink line art, hatching, paper grain and palette. Do not copy the detail of the style sheet. It looks three-dimensional like the low blocks on that map: seen from above at the same gentle angle, built from a few simple solid forms, with matte surfaces, no outlines and three soft flat tones (lit top, mid side, shaded side), with light from the top-left. It is not glossy, plastic, realistic or a detailed 3D render. No shadow on the ground, no ground, base, disc, ring, beam or glow. Transparent background, object centred.
A wide plain hall with one long low roof and three arched doors.
Walls in map cream #EEE9DE and #E6E0D3 with soft darker tones of the same cream on shaded sides; doors are plain darker recesses. Roof in muted plum #6E2B3F with lighter and darker plum tones. Clearly larger and more important than a common Waypost. Nothing like a capsule, vessel, jar, box or fountain. Not a tower, arena, temple or real building.
Keep very simple and quiet: a few solid forms, no detailed decoration, no ground shadow, no outlines, no base or ground. No text, letters, numbers, labels, logos or writing-like marks.
```

### `waypost/block-landmark-b-steps.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/screens/map-plain.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is one simple solid object made to sit on the map in the second reference image. Ignore the style block's lines about ink line art, hatching, paper grain and palette. Do not copy the detail of the style sheet. It looks three-dimensional like the low blocks on that map: seen from above at the same gentle angle, built from a few simple solid forms, with matte surfaces, no outlines and three soft flat tones (lit top, mid side, shaded side), with light from the top-left. It is not glossy, plastic, realistic or a detailed 3D render. No shadow on the ground, no ground, base, disc, ring, beam or glow. Transparent background, object centred.
A wide two-storey building, with a smaller upper storey sitting on a larger lower storey, plain roofs and one central arched door. No windows or extra detail.
Walls in map cream #EEE9DE and #E6E0D3 with soft darker tones of the same cream on shaded sides; doors are plain darker recesses. Roof in muted plum #6E2B3F with lighter and darker plum tones. Clearly larger and more important than a common Waypost. Nothing like a capsule, vessel, jar, box or fountain. Not a tower, arena, temple or real building.
Keep very simple and quiet: a few solid forms, no detailed decoration, no ground shadow, no outlines, no base or ground. No text, letters, numbers, labels, logos or writing-like marks.
```

### `waypost/block-spinner-a-pinwheel.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/screens/map-plain.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is one simple solid object made to sit on the map in the second reference image. Ignore the style block's lines about ink line art, hatching, paper grain and palette. Do not copy the detail of the style sheet. It looks three-dimensional like the low blocks on that map: seen from above at the same gentle angle, built from a few simple solid forms, with matte surfaces, no outlines and three soft flat tones (lit top, mid side, shaded side), with light from the top-left. It is not glossy, plastic, realistic or a detailed 3D render. No shadow on the ground, no ground, base, disc, ring, beam or glow. Transparent background, object centred.
A plain chunky FOUR-BLADE pinwheel on a short stick. Soft brass #C9A15A and cream #F3E2BB tones. Distinct thick folded vanes, plainly something a finger can spin. Never a solid disc, ring or picture.
Keep very simple and quiet: a few solid forms, no detailed decoration, no ground shadow, no outlines, no base or ground. No text, letters, numbers, labels, logos or writing-like marks.
```

### `waypost/block-spinner-b-envelopes.png`

Model: `gpt-image-2`

References: `design/art/style-sheet.png`, `design/art/concepts/lost-and-found/screens/map-plain.png`

```text
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is one simple solid object made to sit on the map in the second reference image. Ignore the style block's lines about ink line art, hatching, paper grain and palette. Do not copy the detail of the style sheet. It looks three-dimensional like the low blocks on that map: seen from above at the same gentle angle, built from a few simple solid forms, with matte surfaces, no outlines and three soft flat tones (lit top, mid side, shaded side), with light from the top-left. It is not glossy, plastic, realistic or a detailed 3D render. No shadow on the ground, no ground, base, disc, ring, beam or glow. Transparent background, object centred.
FOUR plain chunky cream envelopes joined at a small brass centre hub, like a little windmill. Soft brass #C9A15A and cream #F3E2BB tones. Plain embossed flap forms, no seals or emblems. Clearly something a finger can spin. Never a solid disc, ring or picture.
Keep very simple and quiet: a few solid forms, no detailed decoration, no ground shadow, no outlines, no base or ground. No text, letters, numbers, labels, logos or writing-like marks.
```

## Retained generation provenance

These previously recorded prompts remain word for word and may contain older wording or file names. Prompts for the deleted flat shapes are removed.

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
