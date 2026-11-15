# Waypost coverage review

WC1 uses Roy’s approved design. All five migrations are staged for review and held for production rollout. [Design PR #131](https://github.com/royai202600-cyber/time-capsule/pull/131)

## Changes and live baseline

Live counts were recorded before generating seeds on 2026-11-15. `private.game_regions` was absent. The sampler used the live game-enabled common and Landmark Wayposts and existing Corrupted Capsule spots as spacing anchors.

| Region | Live common Wayposts | Live Landmarks | Live spots | Added Wayposts | Added spots | Common after | Spots after |
|---|---:|---:|---:|---:|---:|---:|---:|
| Hong Kong | 14 | 1 | 180 | 102 | 144 | 116 | 324 |
| Macau | 32 | 1 | 200 | 12 | 17 | 44 | 217 |
| Singapore | 41 | 1 | 981 | 77 | 100 | 118 | 1081 |
| Taipei | 53 | 1 | 1234 | 103 | 170 | 156 | 1404 |
| **Total** | 140 | 4 | 2595 | 294 | 431 | 434 | 3026 |

The first migration adds the two coordinate indexes, a bounding-box prefilter, the nearest 200 common Wayposts plus every Landmark within 5 km, and the public-drop flag. Results are sorted by distance with the Waypost ID as a tie-breaker. In current main the RPC implementations are `game_nearby`, `public_capsule_drop` and `public_capsule_return`. Existing wrappers delegate to the updated implementations.

The regions follow in order. New Wayposts use `public_drop = false`. The existing destinations acquire the default `true`. The guardrail of 1,000 new Wayposts and 3,000 new spots per region was met in every region.

- `20261115090112_waypost_discovery_and_public_drops.sql`
- `20261115092024_waypost_coverage_hong_kong.sql`
- `20261115092026_waypost_coverage_macau.sql`
- `20261115092028_waypost_coverage_singapore.sql`
- `20261115092030_waypost_coverage_taipei.sql`

## Sources and sampling

The sampler clips the dated Geofabrik extracts to the intersection of the existing tile rectangles and the corresponding OSM administrative boundary. Each migration records the extract URL, time, SHA-256 and ODbL attribution. The Hong Kong and Macau extracts use the same Guangdong source so the sampler can see features near the boundaries. [OpenStreetMap attribution](https://www.openstreetmap.org/copyright)

| Applies to | Extract | Data timestamp (UTC) | SHA-256 |
|---|---|---|---|
| Hong Kong and Macau | [Dated PBF](https://download.geofabrik.de/asia/china/guangdong-261114.osm.pbf) | 2026-11-14T21:20:41Z | `e0c5973fba87bcd3541f66304f7e0b92176d1a4a4e2255288587a2776da79d31` |
| Singapore | [Dated PBF](https://download.geofabrik.de/asia/malaysia-singapore-brunei-261114.osm.pbf) | 2026-11-14T21:20:41Z | `4fc76f724b39cc096d9d65662b920ce2b54570248d4bcc8eb90ea3ff62aef575` |
| Taipei | [Dated PBF](https://download.geofabrik.de/asia/taiwan-261114.osm.pbf) | 2026-11-14T21:20:41Z | `fd8d74b5226ad4c700c082de55708c86fdcd374d6c89dd46022f579b534e6d56` |

Public paths were sampled every 25 m. Pedestrian squares also use a 25 m grid inside the polygon and outdoor artwork uses its mapped node. The sampler applied the 100 m exclusions, the 20 m motor-road and above-ground rail exclusions, the access and fee rules, and the construction exclusion. Samples near the published density checks get priority among eligible Waypost candidates. The sampler kept the 250 m Waypost and 150 m spot spacing using the same spherical distance as the database and repeated its geometry check at the rounded persisted coordinates.

To reproduce the seed, use the dated PBF files above and a JSON export of the pre-rollout live coordinates grouped by city. The script docstring documents the input fields and temporary Python dependencies.

```sh
python scripts/seed-game-public-paths.py extracts.json live-points.json docs/design/public-sea-cities.geojson output-dir
```

| Region | Eligible candidates | Wayposts by scene | Spots by habitat | Maximum candidate distance to a Waypost (m) | Maximum candidate distance to a spot (m) |
|---|---:|---|---|---:|---:|
| Hong Kong | 2,773 | garden 11, park 42, publicArt 1, waterfront 41, square 7 | park 82, water 50, square 12 | 250.00 | 149.98 |
| Macau | 295 | waterfront 8, square 3, park 1 | park 3, water 10, square 4 | 249.11 | 149.91 |
| Singapore | 2,429 | square 17, waterfront 20, publicArt 4, garden 2, park 34 | park 44, water 27, square 29 | 248.32 | 149.99 |
| Taipei | 4,337 | park 41, square 11, publicArt 5, waterfront 46 | park 67, water 85, square 18 | 249.88 | 150.00 |

## Density at the 20 published samples

Each sample was snapped to the nearest mapped public outdoor footway, path or pedestrian way within the city and tile footprint. All counts include existing Landmarks. Each cell shows live before → staged after. Centre targets require a Waypost within 300 m and at least four within 500 m. Suburb and park checks use 600 m and 250 m respectively.

| Region and sample | Snapped lat, lng | Snap (m) | Nearest (m) | Within 300 m | Within 500 m | Within 600 m | Within 5 km | Spots within 100 m | Target met |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Hong Kong · Tsim Sha Tsui | 22.2976047, 114.1722792 | 8.2 | 301.7 → 301.7 | 0 → 0 | 2 → 4 | 3 → 5 | 8 → 57 | 0 → 0 | No |
| Hong Kong · Central | 22.2819129, 114.1587169 | 12.9 | 1871.4 → 295.2 | 0 → 1 | 0 → 2 | 0 → 4 | 8 → 43 | 0 → 0 | No |
| Hong Kong · Kwun Tong | 22.3122888, 114.2257286 | 3.2 | 4479.3 → 515.6 | 0 → 0 | 0 → 0 | 0 → 1 | 8 → 68 | 0 → 0 | Yes |
| Hong Kong · Tseung Kwan O | 22.3072680, 114.2600923 | 27.5 | 3336.5 → 496.6 | 0 → 0 | 0 → 1 | 0 → 1 | 7 → 39 | 0 → 0 | Yes |
| Hong Kong · Victoria Park | 22.2822255, 114.1878902 | 53.1 | 1805.7 → 2.6 | 0 → 2 | 0 → 2 | 0 → 2 | 8 → 49 | 0 → 1 | Yes |
| Macau · Senado Square | 22.1937280, 113.5399123 | 3.4 | 5.5 → 5.5 | 3 → 3 | 5 → 5 | 5 → 5 | 33 → 42 | 0 → 0 | Yes |
| Macau · Taipa Village | 22.1534946, 113.5574895 | 1.2 | 264.7 → 264.7 | 1 → 1 | 1 → 1 | 1 → 1 | 25 → 34 | 0 → 0 | No |
| Macau · Iao Hon | 22.2104972, 113.5484918 | 0.9 | 613.3 → 613.3 | 0 → 0 | 0 → 0 | 0 → 0 | 31 → 36 | 0 → 0 | No |
| Macau · Ocean Gardens, Taipa | 22.1601888, 113.5592462 | 80.4 | 565.9 → 565.9 | 0 → 0 | 0 → 0 | 1 → 1 | 29 → 40 | 0 → 0 | Yes |
| Macau · Taipa Central Park | 22.1557258, 113.5556546 | 87.5 | 485.6 → 485.6 | 0 → 0 | 1 → 1 | 2 → 2 | 28 → 38 | 0 → 0 | No |
| Singapore · Raffles Place | 1.2840008, 103.8513900 | 1.1 | 28.1 → 28.1 | 6 → 6 | 10 → 10 | 11 → 11 | 37 → 84 | 20 → 20 | Yes |
| Singapore · Orchard | 1.3042339, 103.8319791 | 32.8 | 1711.7 → 47.5 | 0 → 2 | 0 → 2 | 0 → 3 | 42 → 88 | 0 → 1 | No |
| Singapore · Tiong Bahru | 1.2852269, 103.8271263 | 14.4 | 2186.0 → 372.8 | 0 → 0 | 0 → 2 | 0 → 2 | 40 → 83 | 0 → 0 | Yes |
| Singapore · Toa Payoh | 1.3343190, 103.8499982 | 2.1 | 3663.9 → 208.7 | 0 → 1 | 0 → 2 | 0 → 2 | 18 → 48 | 0 → 0 | Yes |
| Singapore · Botanic Gardens | 1.3137174, 103.8162292 | 37.7 | 43.9 → 43.9 | 1 → 1 | 2 → 2 | 4 → 4 | 15 → 53 | 5 → 5 | Yes |
| Taipei · Zhongxiao Fuxing | 25.0416023, 121.5435468 | 15.4 | 1251.0 → 454.3 | 0 → 0 | 0 → 1 | 0 → 1 | 54 → 124 | 0 → 0 | No |
| Taipei · Civic Square | 25.0373691, 121.5627969 | 14.6 | 20.1 → 20.1 | 4 → 4 | 16 → 16 | 19 → 19 | 51 → 128 | 23 → 23 | Yes |
| Taipei · Minsheng Community | 25.0590436, 121.5590397 | 6.3 | 1464.5 → 82.8 | 0 → 2 | 0 → 2 | 0 → 2 | 54 → 123 | 0 → 1 | Yes |
| Taipei · Wenshan / Jingmei | 24.9925496, 121.5408539 | 15.7 | 3823.0 → 361.5 | 0 → 0 | 0 → 1 | 0 → 2 | 9 → 35 | 0 → 0 | Yes |
| Taipei · Da’an Forest Park | 25.0299979, 121.5355013 | 0.3 | 106.7 → 106.7 | 2 → 2 | 4 → 4 | 4 → 4 | 39 → 88 | 66 → 66 | Yes |

13 of 20 samples met their full target.

- **Tsim Sha Tsui**. The nearest Waypost is 301.7 m away. All eligible candidates within 300 m are within 250 m of a live Waypost. The four-within-500 m target is met.
- **Central**. The nearest eligible Waypost is 295.2 m away. The road and restricted-access buffers leave separated public areas. The spaced layout places two Wayposts within 500 m.
- **Taipa Village**. The nearest Waypost is 264.7 m away. After the 100 m exclusions, every eligible candidate within 500 m is inside an existing 250 m spacing buffer.
- **Iao Hon**. The nearest eligible candidate is 613.3 m away. The sample falls within several 100 m exclusions and a 20 m road buffer.
- **Taipa Central Park**. The published point snaps 87.5 m to a public walkway. From that walkway the nearest eligible candidate is 266.3 m away and it is within 250 m of a live Waypost. The snapped walkway is in road and 100 m exclusion buffers.
- **Orchard**. The nearest Waypost is 47.5 m away. Within 500 m the eligible samples lie in limited areas between the mapped exclusions. The spaced layout places two Wayposts within 500 m.
- **Zhongxiao Fuxing**. The nearest eligible candidate is 454.3 m away. Road, building and 100 m exclusions affect the snapped point and leave one spaced Waypost within 500 m.

## Names

The name audit lists 137 Wayposts, including all 43 OpenCC conversions, 69 generic Chinese names and 75 generic English names. Name selection used the Traditional Chinese tags, a Chinese-only local name or the Chinese tag. English used the English tag, Macau’s Portuguese tag or a Latin local name. Generic labels followed the scene.

[Complete name audit](waypost-coverage-names.csv)

## Verification

The hosted preflight ran all five migrations in order inside one transaction and rolled it back. It compared the original rows and security metadata, verified the new coordinates and spacing using the stored values, and matched the sample table against SQL before and after. The source-geometry pass independently checked the blocked-area exclusions for every generated point. A disposable hosted SQL fixture checked the nearest-200 cutoff and Taipei 101 inclusion.

Hosted wave replay inserted the exact new spot rows for each region in separate rollback transactions. Every existing spot was evaluated for the 144 ten-minute waves on 2026-11-15 local time. Release IDs, vessels, rarities and expiry timestamps matched for all 373,680 existing spot releases.

The real-JWT test signed in through disposable local GoTrue and called PostgREST against the staged schema. At Civic Square it received 127 common Wayposts plus Taipei 101 in distance order. A stress case received exactly 200 common Wayposts plus Taipei 101. A new Taipei seed awarded the correct spin balance, XP and five-minute cooldown. A new spot produced a Corrupted Capsule that could be restored with the correct Wax Ball cost. Public drop and return used eligible original destinations, and both accounts were denied direct access to sealed contents.

Xinyi has 142 distinct eligible coordinates within the 1,200 m hunt area before spacing. The largest gap from any of those coordinates to an existing Waypost is 168.1 m. The closest staged Waypost is 1,280.3 m from the hunt centre. Its spin correctly earned zero Xinyi credit. A disposable game-only Waypost inside the existing boundary earned one credit with the same real-JWT account after check-in. The migration adds no Waypost to that hunt.

Both JWT test accounts were signed out and deleted. Cleanup verified zero associated account, game and capsule test rows. The hosted transaction left zero test fixtures.

Mobile `npm ci`, `npm run typecheck`, `npm test`, `npx expo install --check` and `npx expo export --platform web` passed, including 186 tests. The local browser showed the Traditional Chinese sign-in screen. Run the Expo app with `cd mobile && npm run web`. [Local app](http://localhost:8088)

## Rollout

No production migrations or deployments were made. After Claude reviews and Roy approves, apply the first migration followed by Hong Kong, Macau, Singapore and Taipei. Verify the density after each region and regenerate live database types after the schema change.
