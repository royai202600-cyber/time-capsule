# SOP: Landmark monuments on the Journey map

How to give a Landmark Waypost its 3D monument. Codex can do this on its own by following these steps. Roy approves the screenshots before merge, because it is a visual change.

## What a monument is
- **Brass map geometry, nothing else.** A monument is drawn by the map itself (MapLibre `fill-extrusion` layers). No image, no 3D model, no texture, no new library, so the map stays light on phones.
- **Two ways to build one, mixable (Roy, 2026-11-10):**
  1. **Tile building (try first).** The real building outline is already in our map tiles. Pick it by its tile feature id and it is redrawn in brass at a toy height. No geometry to write, and it is the exact real shape.
  2. **Hand-built tiers.** Boxes, discs, arcs and shifted boxes, for what the tiles don't have or don't make recognisable: fountains, statues and sculptures (not in the tiles), curved buildings, and towers whose look comes from details the tiles drop (Taipei 101's eight flared sections).
- **It is the Landmark Waypost.** Tapping any part of it opens the Landmark fight. Its seal (28 px brass, four-point star, the same for every Landmark) floats just above the monument's top, over its `lat`/`lng`. Both happen automatically once the monument is added.
- **Toy scale.** Ordinary buildings are shown at 35% height, capped at 40 m. A monument stands out from them, but it is still a toy, not the real height.

## Colour (never change per monument)
| | Colour |
|---|---|
| Hand-built tiers, by height: foot | `#B98F45` dark brass |
| 60% of the monument's height | `#C9A15A` brass (`C.brass`) |
| Top | `#F3E2BB` cream |
| Tile buildings | `#C9A15A` brass |

Every face also has the map's vertical shading. Opacity is 1. A beaten Landmark is shown only by its seal turning plum; the building never changes colour. No ring on the ground.

## Where the code is
`mobile/src/features/journey/live/mapHtml.ts`, the `MONUMENTS` list. Examples in the file: Taipei 101 (stacked squares), Senado (a hand-built round fountain plus the buildings lining the square from the tiles), HKUST (arcs).

```ts
{ id: "senado", lat: 22.193683, lng: 113.53989,
  tile: { ids: [35184577873359, /* ... */], realTop: 26.2, top: 12 },  // the buildings lining the square
  tiers: [[7, 0, 2.5, { round: true }], /* ... */] }                   // the fountain
```

- `id` is the Landmark's id in the `places` table. It must equal the `place` value of the Landmark Waypost row in `sea_shores` (`kind = 'landmark'`). That is how the app links the monument to its Waypost.
- `lat`/`lng` is where the seal floats: the centre of the thing people recognise.
- `tile.ids` are tile feature ids; `realTop` is the tallest real height among them (the tiles' `height`); `top` is the toy height it is drawn at. All of their parts scale by `top / realTop`. They are hidden from the ordinary grey building layer automatically.
- Each tier is `[half-width, base, top, options]` in metres, centred on `lat`/`lng`:
  - no options: a square box, half-width from centre to each side;
  - `{ round: true }`: a disc whose radius is the half-width;
  - `{ dx, dy }`: shifted east/north by that many metres (twin towers, wings);
  - `{ arc: { inner, from, to } }`: a curved band from radius `inner` to the half-width, between two angles in degrees (0 = east, 90 = north, counter-clockwise).
- `flare(from, height, narrow, wide)` makes one section that widens upward in three steps (Taipei 101). Reuse it for repeated sections.

Nothing else in the app needs editing. The seal height, the taps and the hiding of grey buildings all come from this list.

## Steps
1. **Check the Landmark exists.** It needs a `places` row and a game-enabled Landmark Waypost in `sea_shores` with that `place`. If it doesn't, stop and ask Roy: a new Landmark is a separate decision.
2. **Check the tiles cover it.** Open the map there. If it is blank blue, the tile extract doesn't reach it: stop, because the tiles have to be extended first.
3. **Look at reference photos** (Roy's, or Wikipedia/Wikimedia Commons). Name the two or three things people recognise at a glance. Record the links in the PR. Make sure it is the landmark Roy means: for HKUST it was the curved academic building, not the sculpture in its piazza.
4. **Find the real positions** in OpenStreetMap (the same data as our tiles): the structure's centre, not the whole site's. Write the source in a comment on the entry.
5. **Try the tile building first.** In the browser, query the `buildings` layer at the spot (`map.queryRenderedFeatures(point, { layers: ['buildings'] })`) for its feature id(s), `height` and `min_height`. If its outline alone is recognisable, use `tile`. Otherwise, or for anything not in the tiles, hand-build tiers. Mix both when the landmark is a place made of several things. Draw only what belongs to the landmark: at Senado the fountain and the buildings lining the square, found as tile buildings within 3 m of the square's OSM outline; Leal Senado, across the road, stays grey (Roy, 2026-11-10).
6. **Move the server's Landmark point** to the monument's `lat`/`lng` if they differ by more than about 10 m: a small data-only migration updating that `sea_shores` row. Otherwise the seal floats over the monument but the fight checks distance from somewhere else.
7. **Check it in the browser** (below), take the screenshots, and open a PR with them.

## Shape rules
- **Recognisable, not detailed.** Silhouette only. Ignore windows, signs and decoration.
- **At most 30 tiers per monument,** plus any tile buildings.
- **Hand-built tiers stack with no gaps,** each `base` the `top` of the one below. Shifted or arc pieces may start at 0 beside each other.
- **Height in map metres:**

| Kind of landmark | Total height | Notes |
|---|---|---|
| Skyscraper or tower (Taipei 101, Petronas) | 100–145 m | Never above 145 m. A needle spire may be the last 20–30 m. |
| Statue, fountain, gate, temple (Merlion, Senado) | 15–40 m | Low and wide, so it reads as a landmark, not a tower. |
| Square or campus buildings (Senado's frame, HKUST) | 10–20 m | Just above the toy buildings around it. |

- **The centrepiece is the tallest part.** Buildings framing a square stay lower than its fountain or statue (Senado: buildings 12 m, fountain 15 m).
- **Cover the real building.** A hand-built base must be at least as wide as the real grey building at its foot (Taipei 101's base is 62 m half-width because of the mall).
- **Thinnest piece: at least 1.5 m half-width,** or it disappears on a phone.
- **Don't change** `TOY_SCALE`, `TOY_MAX_M`, the colours, the layers, or another monument.

## Checks before the PR
Run the web app (`cd mobile && npm run web` → http://localhost:8088, with `EXPO_PUBLIC_MAP_PMTILES_URL` in `mobile/.env.local`, or the map is flat). Use a 375 px wide window and simulate a location next to the landmark (the dedicated test account's map-tap walk in Taipei, or the browser geolocation override elsewhere).

- [ ] At the default Journey zoom and tilt, someone who knows the place would name it from the screenshot.
- [ ] The seal sits on top while you drag, rotate and tilt the map.
- [ ] Tapping any part opens that Landmark's card; tapping beside it doesn't.
- [ ] No grey building pokes through the brass.
- [ ] The pickup circle and nearby capsules can still be seen and tapped.
- [ ] No console errors; dragging the map stays smooth.
- [ ] TypeScript and `npm test` pass.

Put the screenshots (default view, rotated view, and the reference photo side by side) in `docs/review/monuments/<id>-*.png` and in the PR. **Roy approves them in chat before merge.** Merge and release follow the usual owner-account rules.
