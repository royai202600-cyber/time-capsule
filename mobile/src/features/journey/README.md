# F3 integration points

F1 can import `CapsuleMapPage` for capsule page 2 and `usePlaceDistance` / `openingCoordinates` from `location.ts`.

```tsx
const { meters, accuracy, status } = usePlaceDistance(place);
<CapsuleMapPage place={place} vessel={capsule.vessel as VesselKind} onGoOpen={() => setPage(3)} />
const coordinates = openingCoordinates();
const result = await capsules.open(capsule.id, coordinates?.lat, coordinates?.lng, coordinates?.accuracy);
```

`place` is a row from `places`. Use the distance and accuracy to explain UI state; `open_capsule` remains the authority. The permission prompt only appears after `CapsuleMapPage` shows its explainer and the user taps Allow location. `setFakeLocation({lat, lng})` is development only; the map page has a toggle that simulates arrival at its place.

F0's art manifest does not yet register `map-asia`, `stamp-<placeId>`, or passport images. F3 renders a drawn map, code stamps, navy cover and cream pages until those assets are registered there from `design/art/manifest.json`.
