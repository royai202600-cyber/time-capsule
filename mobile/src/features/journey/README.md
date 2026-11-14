# F3 integration points

F1 can import `CapsuleMapPage` for capsule page 2 and `usePlaceDistance` / `openingCoordinates` from `location.ts`.

```tsx
const { meters, accuracy, status } = usePlaceDistance(place);
<CapsuleMapPage place={place} vessel={capsule.vessel as VesselKind} onGoOpen={() => setPage(3)} />
const coordinates = openingCoordinates();
const result = await capsules.open(capsule.id, coordinates?.lat, coordinates?.lng, coordinates?.accuracy);
```

`place` is a row from `places`. Use the distance and accuracy to explain UI state; `open_capsule` remains the authority. The permission prompt only appears after `CapsuleMapPage` shows its explainer and the user taps Allow location. `setFakeLocation({lat, lng})` is development only; the map page has a toggle that simulates arrival at its place.

A1 registers the eleven place stamps and passport cover/page art in `mobile/src/art/manifest.ts`. The illustrated Asia map was removed on 2026-11-09; Journey uses only the live map.

The detailed web map uses OpenStreetMap's Web Mercator fitted bounds for the vessel, radius, position dot and line. Reference inspected: [OpenStreetMap at the Tsim Sha Tsui Clock Tower](https://www.openstreetmap.org/?mlat=22.29359&mlon=114.16954#map=17/22.29359/114.16954). Browser and OS permission denial must be resolved in their settings; the page explains the relevant path.

## Journey modules

`JourneyScreen` coordinates server refreshes, selection and actions. `useCapsuleItems` builds received/public capsule items and Passport visits; `useCityHuntPins`, `usePrivateQuestPins` and `useGamePins` build their map layers. `SelectedCard`, `GameCard`, `LocationGate` and `JourneyControls` own their presentation. `journeyModel` shares item types and asset URI helpers. `MapFilterSheet` and `mapFilter` keep filtering separate from these layers. A quest is a task; its optional location gives it a quest pin.
