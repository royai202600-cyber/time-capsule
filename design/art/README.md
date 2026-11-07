# Time Capsule art assets

To make new art, follow [STYLE.md](STYLE.md). This README lists what already exists.

Roy chose style sheet A. All generated masters use the built-in `gpt-image-2` image tool with the approved sheet as their style reference; the exact prompts and any postprocessing are in `manifest.json`.

PNG masters live in `design/art/`. WebP copies live at matching paths in `public/art/`, except the style sheets and `_checks/`. Names use kebab-case: `<category>-<id>-<part>` where a part exists. Vessel IDs: dome, bottle, envelope, tin, lantern, musicbox, maison. Place IDs: senado, tst-clock, taipei101, sensoji, fushimi, gyeongbok, merlion, grandpal, wumen, petronas, aurele-cotai.

The original SVG art remains in `src/art.js` and is recoverable from Git tag `art-svg-v1`. These bitmap assets are not wired into app screens yet.

## Rules and checks

- Music box and ring box assembled views are closed. Their lids are separate complete parts. Vessel part order and 120 px comparisons are in `_checks/`; lid, flap and cork pivots are in `manifest.json` and `_checks/pivots.json`.
- Dome stack: base → rose → glass. Bottle stack: waves → letter → body → cork. Glass interior alpha below 200 was scaled to 37.5% so contents stay visible.
- All nine portraits are the main profile pictures, with an identical 860 px diameter disc centered at (505, 526). `_checks/portraits-small.png` shows 24 px and 40 px tests.
- Passport stamps use one ink color each. Paper textures are opaque and seamlessly tile at all edges. Scene edges fade to transparency.
- A2 idle effects: `vessels/vessel-dome-glint.png` overlays the existing dome glass without changing vessel art; `fx/fx-glint.png` catches on wax seals and brass edges. Roy approved both after `_checks/idle-glint-review.png` showed the dome at 120/240 px and the sparkle at 16/24 px on envelope and tin. `finish-idle-glints.py` downscaled and refined the generated layers.
- The built-in image tool returned the map at native 1254 × 1254, its largest square output here; no artificial upscale was used.
- The map entry in `manifest.json` has eleven hand-placed `pins` coordinates in that native 1254 × 1254 pixel space. They follow the illustrative coastlines rather than a precise map projection. `_checks/map-pins.png` overlays their exact points and labels; the Macau boutique pin sits beside Senado Square.
- The T9c pin placement was checked against Roy's supplied world map and an [online East/Southeast Asia map](https://maplab-icon.com/blog-entry-784-html/); [Natural Earth coastlines](https://www.naturalearthdata.com/downloads/10m-physical-vectors/) were consulted for a reliable geographic source. These pins are display positions only; actual location checks use the app's place coordinates.
- `icon-reference.png` is one 4×4 sheet on paper. Row-major order: pin, back, close, plus, lock, check, shop, user, map, cabinet, share, camera, pen; the last three cells are blank. These are references only; the screens team draws final UI icons in code.
- WebP exports use sharp/libvips quality 85 and preserve transparency. Vessel, stamp, portrait and seal exports have max edge 512 px; map has max edge 1600 px. App icon PNG sizes are in `public/icons/`.
- Run checks with the Python scripts in `design/art/scripts/` (Pillow required). Run `npm run build` before merging.

## Masters

| File | What | Size | Notes |
|---|---|---:|---|
| `app-icon.png` | Blue rose dome app icon master | 1024×1024 | opaque |
| `cabinet/cabinet-wall.png` | Warm plaster and wood-panel wall | 1024×1536 | opaque |
| `fx/fx-glint.png` | Small four-point idle sparkle for wax and brass | 1024×1024 | processed; see manifest |
| `fx/fx-light-burst.png` | Warm radial opening light effect | 1024×1024 | processed; see manifest |
| `icon-reference.png` | Thirteen UI icon reference grid | 1024×1024 | opaque |
| `journey/passport-cover.png` | Navy and brass passport cover | 1024×1536 | opaque |
| `journey/passport-page.png` | Blank cream passport page | 1024×1536 | opaque |
| `map-asia.png` | Simplified East and Southeast Asia journey map | 1254×1254 | opaque |
| `portraits/portrait-01.png` | Main profile picture preset 01 | 1024×1024 | processed; see manifest |
| `portraits/portrait-02.png` | Main profile picture preset 02 | 1024×1024 | processed; see manifest |
| `portraits/portrait-03.png` | Main profile picture preset 03 | 1024×1024 | processed; see manifest |
| `portraits/portrait-04.png` | Main profile picture preset 04 | 1024×1024 | processed; see manifest |
| `portraits/portrait-05.png` | Main profile picture preset 05 | 1024×1024 | processed; see manifest |
| `portraits/portrait-06.png` | Main profile picture preset 06 | 1024×1024 | processed; see manifest |
| `portraits/portrait-07.png` | Main profile picture preset 07 | 1024×1024 | processed; see manifest |
| `portraits/portrait-08.png` | Main profile picture preset 08 | 1024×1024 | processed; see manifest |
| `portraits/portrait-future.png` | Main profile picture: future self | 1024×1024 | processed; see manifest |
| `scenes/scene-empty-inbox.png` | Empty inbox: open shelf space and waiting bird | 1536×1024 |  |
| `scenes/scene-empty-sent.png` | Empty sent: blank letter, pen and wax | 1536×1024 |  |
| `scenes/scene-sealed.png` | Letter being sealed with warm glow | 1536×1024 |  |
| `scenes/scene-welcome.png` | Welcome: hands, sealed letter and dome rose | 1536×1024 |  |
| `seal-wax.png` | Large rose-imprinted wax seal | 1024×1024 |  |
| `shelf.png` | Empty three-level wooden display shelf | 1024×1024 |  |
| `stamps/stamp-aurele-cotai.png` | One-color passport stamp: Maison Aurèle Cotai boutique demo | 1024×1024 | processed; see manifest |
| `stamps/stamp-fushimi.png` | One-color passport stamp: Fushimi Inari | 1024×1024 | processed; see manifest |
| `stamps/stamp-grandpal.png` | One-color passport stamp: Grand Palace | 1024×1024 | processed; see manifest |
| `stamps/stamp-gyeongbok.png` | One-color passport stamp: Gyeongbokgung | 1024×1024 | processed; see manifest |
| `stamps/stamp-merlion.png` | One-color passport stamp: Merlion | 1024×1024 | processed; see manifest |
| `stamps/stamp-petronas.png` | One-color passport stamp: Petronas Towers | 1024×1024 | processed; see manifest |
| `stamps/stamp-senado.png` | One-color passport stamp: Senado Square | 1024×1024 | processed; see manifest |
| `stamps/stamp-sensoji.png` | One-color passport stamp: Sensō-ji | 1024×1024 | processed; see manifest |
| `stamps/stamp-taipei101.png` | One-color passport stamp: Taipei 101 | 1024×1024 | processed; see manifest |
| `stamps/stamp-tst-clock.png` | One-color passport stamp: Tsim Sha Tsui Clock Tower | 1024×1024 | processed; see manifest |
| `stamps/stamp-wumen.png` | One-color passport stamp: Forbidden City Meridian Gate | 1024×1024 | processed; see manifest |
| `style-sheet-a.png` | Style sheet A candidate | 1536×1024 | opaque |
| `style-sheet-b.png` | Style sheet B candidate | 1536×1024 | opaque |
| `style-sheet-c.png` | Style sheet C candidate | 1536×1024 | opaque |
| `style-sheet.png` | Roy-approved style sheet A | 1536×1024 | opaque |
| `textures/paper-letter.png` | Warm seamless letter-paper texture | 1024×1024 | processed; see manifest, opaque |
| `textures/paper.png` | Cool seamless paper texture | 1024×1024 | processed; see manifest, opaque |
| `vessels/vessel-bottle-body.png` | Message In A Bottle — body layer | 1024×1024 | processed; see manifest |
| `vessels/vessel-bottle-cork.png` | Message In A Bottle — cork layer | 1024×1024 | pivot 724,355 |
| `vessels/vessel-bottle-letter.png` | Message In A Bottle — letter layer | 1024×1024 |  |
| `vessels/vessel-bottle-waves.png` | Message In A Bottle — waves layer | 1024×1024 |  |
| `vessels/vessel-bottle.png` | Assembled message in a bottle vessel | 1024×1024 |  |
| `vessels/vessel-dome-base.png` | Glass-Dome Blue Rose — base layer | 1024×1024 |  |
| `vessels/vessel-dome-glass.png` | Glass-Dome Blue Rose — glass layer | 1024×1024 | processed; see manifest |
| `vessels/vessel-dome-glint.png` | Travelling highlight for the dome glass | 1024×1024 | processed; see manifest |
| `vessels/vessel-dome-rose.png` | Glass-Dome Blue Rose — rose layer | 1024×1024 |  |
| `vessels/vessel-dome.png` | Assembled glass-dome blue rose vessel | 1024×1024 |  |
| `vessels/vessel-envelope-body.png` | Wax-Sealed Letter — body layer | 1024×1024 |  |
| `vessels/vessel-envelope-flap.png` | Wax-Sealed Letter — flap layer | 1024×1024 | pivot 496,260 |
| `vessels/vessel-envelope-seal.png` | Wax-Sealed Letter — seal layer | 1024×1024 |  |
| `vessels/vessel-envelope.png` | Assembled wax-sealed letter vessel | 1024×1024 |  |
| `vessels/vessel-lantern-body.png` | Mid-Autumn Lantern — body layer | 1024×1024 |  |
| `vessels/vessel-lantern-cap.png` | Mid-Autumn Lantern — cap layer | 1024×1024 |  |
| `vessels/vessel-lantern-glow.png` | Mid-Autumn Lantern — glow layer | 1024×1024 |  |
| `vessels/vessel-lantern.png` | Assembled Mid-Autumn lantern vessel | 1024×1024 |  |
| `vessels/vessel-maison-box.png` | Maison Aurèle Ring Box — box layer | 1024×1024 |  |
| `vessels/vessel-maison-lid.png` | Maison Aurèle Ring Box — lid layer | 1024×1024 | pivot 605,300 |
| `vessels/vessel-maison-ring.png` | Maison Aurèle Ring Box — ring layer | 1024×1024 |  |
| `vessels/vessel-maison.png` | Assembled Maison Aurèle ring box vessel | 1024×1024 |  |
| `vessels/vessel-musicbox-box.png` | Warm Wood Music Box — box layer | 1024×1024 |  |
| `vessels/vessel-musicbox-lid.png` | Warm Wood Music Box — lid layer | 1024×1024 | pivot 541,292 |
| `vessels/vessel-musicbox.png` | Assembled warm wood music box vessel | 1024×1024 |  |
| `vessels/vessel-tin-box.png` | Tin Box — box layer | 1024×1024 |  |
| `vessels/vessel-tin-lid.png` | Tin Box — lid layer | 1024×1024 | pivot 505,310 |
| `vessels/vessel-tin.png` | Assembled tin box vessel | 1024×1024 |  |

## Review

[Full contact sheet](_checks/contact-sheet.png) · [Vessel 120 px checks](_checks/vessels-at-120px.png) · [Portrait 24/40 px strip](_checks/portraits-small.png) · [Map pin overlay](_checks/map-pins.png) · [Idle glint review](_checks/idle-glint-review.png)
