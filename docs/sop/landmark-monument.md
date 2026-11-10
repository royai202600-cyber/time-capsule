# SOP: Landmark monuments on the Journey map

How to give a Landmark Waypost its 3D monument, like Taipei 101. Codex can do this on its own by following these steps. Roy approves the screenshots before merge, because it is a visual change.

## What a monument is
- **Plain stacked boxes, nothing else.** Each monument is a list of square boxes drawn by the map itself (a MapLibre `fill-extrusion` layer). No image, no 3D model, no texture, no new library. This keeps the map light on phones.
- **It is the Landmark Waypost.** Tapping the building opens the Landmark fight. Its seal (28 px brass, four-point star, the same for every Landmark) floats just above the top. Both happen automatically once the monument is added.
- **Toy scale.** Ordinary buildings are shown at 35% height, capped at 40 m. A monument stands above them so it reads as the landmark, but it is still a toy, not the real height.

## Colour (never change per monument)
Every monument uses the same brass gradient, from the bottom box to the top box, with a vertical gradient on each face:

| Position | Colour |
|---|---|
| Bottom box | `#B98F45` dark brass |
| 60% of the way up | `#C9A15A` brass (`C.brass`) |
| Top box | `#F3E2BB` cream |

Opacity is 1. A beaten Landmark is shown only by its seal turning plum; the building never changes colour. No ring on the ground.

## Where the code is
`mobile/src/features/journey/live/mapHtml.ts`, the `MONUMENTS` list. One entry per monument:

```ts
{ id: "taipei101", lat: 25.033667, lng: 121.56481, tiers: [ /* [half-width m, base m, top m], ... */ ] }
```

- `id` is the Landmark's id in the `places` table. It must equal the `place` value of the Landmark Waypost row in `sea_shores` (`kind = 'landmark'`). That is how the app links the building to its Waypost.
- Each tier is `[half-width, base, top]` in metres: a square box centred on `lat`/`lng`, half-width metres from centre to each side, from `base` up to `top`.
- `flare(from, height, narrow, wide)` makes one section that widens upward in three steps (Taipei 101's eight sections). Reuse it for repeated sections.

Nothing else in the app needs editing. The seal height comes from `monumentTop`, and the tap and seal position come from the same list.

## Steps
1. **Check the Landmark exists.** It needs a `places` row and a game-enabled Landmark Waypost in `sea_shores` with that `place`. If it doesn't exist, stop and ask Roy: a new Landmark is a separate decision.
2. **Find the real centre.** Use the building's footprint in OpenStreetMap (the same data as our map tiles). Take the centre of the tower or the main structure, not of the whole site. Cross-check with Wikipedia's coordinates; they should agree within about 20 m. Write the source in a comment on the entry, as Taipei 101 does.
3. **Move the server's Landmark point to the same centre** if it differs by more than about 10 m: a small data-only migration updating that `sea_shores` row's `lat`/`lng`. Otherwise the seal floats over the building but the fight checks distance from somewhere else.
4. **Look at reference photos** of the landmark from a reliable source (Wikipedia/Wikimedia Commons). Pick the two or three things people recognise at a glance. Record the reference links in the PR.
5. **Write the tiers** using the shape rules below.
6. **Check it in the browser** (below), take the screenshots, and open a PR with them.

## Shape rules
- **Recognisable, not detailed.** Capture the silhouette only: Taipei 101 is a wide base, eight sections that flare outward, a crown and a needle spire. Ignore windows, signs and decoration.
- **At most 30 boxes per monument.** Taipei 101 uses 27.
- **Squares centred on one point only.** Boxes can't be offset or rotated. Approximate other shapes by stacking squares. If a landmark can't be read that way (for example two separate towers, or an arch), stop and ask Claude rather than adding new geometry code.
- **Boxes stack with no gaps.** Each box's `base` is the previous box's `top`, and they go upward in order.
- **Height in map metres:**

| Kind of landmark | Total height | Notes |
|---|---|---|
| Skyscraper or tower (Taipei 101, Petronas) | 100–145 m | Never above 145 m. A needle spire may be the last 20–30 m. |
| Statue, fountain, gate, temple (Merlion, Senado Square, Meridian Gate) | 15–40 m | Low and wide, so it reads as a landmark, not a tower. |

- **Cover the real building.** The bottom box must be at least as wide as the real grey building at its foot, or the plain building pokes out beside the brass. Taipei 101's base is 62 m half-width because of the mall around it.
- **Spire or thinnest top box: at least 1.5 m half-width**, or it disappears on a phone.
- **Don't change** `TOY_SCALE`, `TOY_MAX_M`, the colours, the layer, or another monument.

## Checks before the PR
Run the web app (`cd mobile && npm run web` → http://localhost:8088, with `EXPO_PUBLIC_MAP_PMTILES_URL` in `mobile/.env.local`, or the map is flat). Use a 375 px wide window and simulate a location next to the landmark (the dedicated test account's map-tap walk in Taipei, or the browser geolocation override elsewhere).

- [ ] At the default Journey zoom and tilt, someone who knows the place would name it from the screenshot.
- [ ] The seal sits on top while you drag, rotate and tilt the map.
- [ ] Tapping the building opens that Landmark's card; tapping beside it doesn't.
- [ ] The bottom box hides the real grey building.
- [ ] The pickup circle and nearby capsules can still be seen and tapped.
- [ ] No console errors; dragging the map stays smooth.
- [ ] TypeScript and `npm test` pass.

Put the screenshots (default view, rotated view, and the reference photo side by side) in `docs/review/monuments/<id>-*.png` and in the PR. **Roy approves them in chat before merge.** Merge and release follow the usual owner-account rules.
