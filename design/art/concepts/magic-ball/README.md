# Wax keyhole ball concept

Review art only. Roy rejected the initial Star Glass, Moon and Embroidered ball directions; their images were removed. The final review direction is a spherical wax-red ball with an embossed keyhole. Nothing here is production art.

## Files

- `wax-hero.png`: normal and premium ball on transparent 1024 × 1024 canvas; the generated pair was scaled and centred by `build_concepts.py`.
- `wax-throw.png`: portrait mid-throw concept.
- `wax-hit.png`: portrait successful-hit concept.
- `s1-lost-hourglass.png`: script-edited approved hourglass; its alpha is identical to the approved master alpha.
- `s1-lost-restored.png`: scripted comparison with the untouched approved master on the right.
- `contact-sheet.png`: scripted review sheet with the normal ball at actual 64 px.
- `build_concepts.py`: reproducible scaling, generic damaged-vessel tint/cracks/mist and contact-sheet composition.

The final S1 damage is a script edit of `design/art/vessels/vessel-hourglass.png`, not a regenerated silhouette. The initial built-in image edit informed the look, but shifted the vessel shape and was discarded. Its exact prompt appears below for provenance. The same cracked master shape was supplied as the Lost Capsule reference in the wax throw scene. The rendered phone scenes are concept illustrations and do not guarantee pixel-exact vessel geometry.

Model for generated images: **gpt-image-2**, via Codex's built-in image tool. Each generated call used `design/art/style-sheet.png` as the first reference. The style block from `design/art/STYLE.md` section 2 appears unchanged in every prompt below.

## Final image prompts

### Hero: `wax-hero.png`

Model: `gpt-image-2`
References: `design/art/style-sheet.png`

```text
Use case: stylized-concept
Asset: wax-hero.png, concept art, transparent square about 1024x1024.
Image 1 is the approved Time Capsule style sheet. Match its hand-inked storybook style exactly.
Create two versions side by side of ONE original throwable magic ball design: normal on the left and premium on the right. The normal is a solid, three-dimensional, clearly SPHERICAL ball of wax-red sealing wax, with subtle hand-formed texture and a single simple KEYHOLE embossed directly into the front wax surface. The keyhole is a shallow engraving in the wax, NOT a raised button, clasp, separate plate or lock. No holder. The premium is unmistakably the same wax sphere and embossed keyhole, with richer brass dust rubbed into the engraving, cream highlights and a stronger soft brass glow, staying inside the approved palette. Both objects read as balls at actual 64 px.
Composition: equal scale, generous gap and transparent outer corners. No seam, no equator band, no two-colour halves, no red-and-white pattern, no central button, no opening shell, no creatures, no glossy 3D, no text, letters, numbers or logos.
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
```

### Throw screen: `wax-throw.png`

Model: `gpt-image-2`
References: `design/art/style-sheet.png`, `design/art/concepts/magic-ball/s1-lost-hourglass.png`, `design/art/concepts/magic-ball/wax-hero.png`

```text
Use case: ui-mockup
Asset: wax-throw.png, full portrait concept phone screen.
Image 1 is the approved style sheet. Image 2 is the exact cracked hourglass Lost Capsule. Image 3 is the wax keyhole ball hero; use the normal LEFT version. Match the references.
A real-feeling, hand-painted storybook park at dusk fills the background: soft paper-blue path, ink-blue trees, a bench, and warm cream sky, all in the approved palette. ONE cracked, clouded, tarnished hourglass Lost Capsule with faint dark mist floats at centre, close to image 2. A thin separate hand-inked BRASS timing ring with tiny clock-like ticks partly tightens around the vessel. At the bottom centre, ONE large clearly SPHERICAL wax-red magic ball matching the normal left version of image 3 waits under the thumb to be flicked upward. Its simple keyhole is embossed directly in the wax surface. No holder, no equatorial band, no centre button, no clasp or split shell. Keep the keyhole readable and the wax ball visually distinct from a flat seal.
Originality constraints: no red-and-white ball, no two-colour halves, no capsule pulled inside the ball, no plain white or bright green target circle, no creatures, 3D avatar, glossy 3D, floating item bubbles, teal gradient buttons, text, letters, numbers or logos.
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is a full-bleed portrait phone screen with an opaque background, about 1024x1536, instead of a transparent, single-object square. Keep no text, letters or numbers anywhere; do not draw a phone frame or status bar.
```

### Hit moment: `wax-hit.png`

Model: `gpt-image-2`
References: `design/art/style-sheet.png`, `design/art/concepts/magic-ball/wax-throw.png`

```text
Use case: precise-object-edit
Asset: wax-hit.png, full portrait concept phone screen at the instant after a successful hit.
Image 1 is the approved style sheet. Image 2 is the exact wax-throw scene to edit. Preserve its portrait framing, hand-painted dusk park, trees, bench, lantern, path, camera angle, central hourglass position and illustration style.
The thrown wax-red ball has reached the cracked Lost Capsule and dissolved COMPLETELY into a delicate cloud of brass-gold dust around the hourglass. No intact ball remains anywhere, including at the bottom. The hourglass cracks are visibly closing with short fine brass lines; clouding and dark mist thin away as a soft brass glow spreads from the vessel. The thin separate hand-inked brass timing ring with small clock ticks remains close around the vessel. Keep the approved hourglass silhouette, sand and support structure. Show a clear successful restoration moment, tender rather than explosive.
Originality constraints: no ball opening or splitting, no vessel pulled into a ball, no red-and-white pattern, no green or plain white target circle, no creatures, avatar, glossy 3D, floating item bubbles, teal gradient UI, text, letters, numbers or logos.
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
Override for this image only: this is a full-bleed portrait phone screen with an opaque background, about 1024x1536, instead of a transparent, single-object square. Keep no text, letters or numbers anywhere; do not draw a phone frame or status bar.
```

## Exploratory prompt record

The following generated calls were superseded by Roy's wax-ball direction; their outputs are not in this PR. Three subsequent throw calls were canceled while running and produced no retained images.

### Lost-vessel exploratory edit: `s1-lost-hourglass exploratory edit`

Model: `gpt-image-2`
References: `design/art/style-sheet.png`, `design/art/vessels/vessel-hourglass.png`

```text
Use case: precise-object-edit
Asset: s1-lost-hourglass.png, transparent 1024x1024 concept intermediate.
Image 1 is the approved style sheet: match its illustration style exactly. Image 2 is the edit target, the approved hourglass vessel master. Keep its exact silhouette, proportions, orientation, sand, glass, wood, linework, placement, and transparent background. Apply a reusable Lost Capsule surface effect only: delicate dark ink cracks across glass and supports, a clouded tarnished tint, and a low faint dark mist hugging the lower vessel. The effect must be generic enough to overlay any of 67 different vessels. Do not add or remove parts or redraw the hourglass. Keep full transparent outer corners. No text, letters, numbers, logos, symbols, or extra objects.
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
```

### Superseded hero: `a-hero.png`

Model: `gpt-image-2`
References: `design/art/style-sheet.png`

```text
Use case: stylized-concept
Asset: a-hero.png, concept art, transparent square about 1024x1024.
Image 1 is the approved style sheet. Match its hand-inked storybook style exactly.
Star Glass Ball. Two versions side by side, each a clearly throwable round sphere. Normal: clear glass-blue sphere with softly swirling brass-gold stardust and a few tiny stars visibly suspended INSIDE. Keep glass interior pale and translucent so the stardust stays legible. Premium: exactly the same glass sphere and inner swirl, visibly richer with more brass-gold stardust and a stronger soft glow, cream highlights. A single seamless spherical silhouette for each. No seam, band, central circle, button, clasp, two-colour halves, or opening shell.
Composition: two isolated balls side by side, normal on the left, premium on the right, same size, generous clear space around both. Each must read as a ball at actual 64 px. Transparent outer corners. Premium gold means only brighter brass and cream within the existing palette.
Originality constraints: no red-and-white sphere, no two-colour halves, no band around the middle, no centre button or clasp, no opening/splitting, no creatures, no glossy 3D, no logos, no text.
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
```

### Superseded hero: `b-hero.png`

Model: `gpt-image-2`
References: `design/art/style-sheet.png`

```text
Use case: stylized-concept
Asset: b-hero.png, concept art, transparent square about 1024x1024.
Image 1 is the approved style sheet. Match its hand-inked storybook style exactly.
Moon Ball. Two versions side by side, each a clearly throwable round sphere. Normal: solid deep ink-blue sphere with a few tiny hand-inked brass stars scattered UNEVENLY across the surface and ONE glowing brass crescent moon. Premium: exactly the same ink-blue sphere, crescent and scattered star motif, richer brass, a few more tiny stars, stronger soft cream-gold glow. No lines or seams circling it, no band, central circle, button, clasp, two-colour halves, or opening shell.
Composition: two isolated balls side by side, normal on the left, premium on the right, same size, generous clear space around both. Each must read as a ball at actual 64 px. Transparent outer corners. Premium gold means only brighter brass and cream within the existing palette.
Originality constraints: no red-and-white sphere, no two-colour halves, no band around the middle, no centre button or clasp, no opening/splitting, no creatures, no glossy 3D, no logos, no text.
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
```

### Superseded hero: `c-hero.png`

Model: `gpt-image-2`
References: `design/art/style-sheet.png`

```text
Use case: stylized-concept
Asset: c-hero.png, concept art, transparent square about 1024x1024.
Image 1 is the approved style sheet. Match its hand-inked storybook style exactly.
Embroidered Ball (繡球). Two versions side by side, each a round throwable silk sphere with a SHORT brass-coloured tassel. Normal: traditional Chinese hand-embroidered silk texture, an ALL-OVER woven pattern in wax red and brass, broken up into irregular embroidery motifs rather than panels or halves, with a soft gold glow. Premium: exactly the same red-and-brass embroidered sphere with a slightly richer dense gold thread pattern and stronger glow. Show one seamless textile surface, never a split ball, no central button, clasp, band around middle, letters or characters.
Composition: two isolated balls side by side, normal on the left, premium on the right, same size, generous clear space around both. Each must read as a ball at actual 64 px. Transparent outer corners. Premium gold means only brighter brass and cream within the existing palette.
Originality constraints: no red-and-white sphere, no two-colour halves, no band around the middle, no centre button or clasp, no opening/splitting, no creatures, no glossy 3D, no logos, no text.
App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.
```
