# F3 integration points

F1 can import `CapsuleMapPage` for capsule page 2 and `usePlaceDistance` / `openingCoordinates` from `location.ts`.

```tsx
const { meters, accuracy, status } = usePlaceDistance(place);
<CapsuleMapPage place={place} vessel={capsule.vessel as VesselKind} onGoOpen={() => setPage(3)} />
const coordinates = openingCoordinates();
const result = await capsules.open(capsule.id, coordinates?.lat, coordinates?.lng, coordinates?.accuracy);
```

`place` is a row from `places`. Use the distance and accuracy to explain UI state; `open_capsule` remains the authority. The permission prompt only appears after `CapsuleMapPage` shows its explainer and the user taps Allow location. `setFakeLocation({lat, lng})` is development only; the map page has a toggle that simulates arrival at its place.

A1 registers `map-asia`, the eleven place stamps, and passport cover/page art in `mobile/src/art/manifest.ts`. Journey pins use reviewed 1254 px display coordinates from art PR #12, while the server still checks real place coordinates. The map remains stylised; its pins are for display, not navigation.

Journey groups pins whose 50 px badges would overlap on screen. Tapping a numbered cluster springs toward the next separation; nearby Macau landmarks may take two taps to become individual pins. Badges stay 50 px wide as the map zooms, and a cluster pulses when any member has a waiting capsule.
