# Waypost coverage: filling in the four regions

Status: approved. Claude wrote it on 2026-11-15 and Roy accepted all five choices below the same day; Codex builds it.

## Why

Wayposts are thin and uneven. The decision log has Taipei at about 54, Hong Kong at 8 plus 6 at HKUST, Singapore at 42 and Macau at 33, besides the Landmarks. That is because the first seed only used **footways inside public parks**, taken from a few small OSM extracts per city. Whole districts inside our map tiles still have no Waypost, for example most of Hong Kong Island, Mong Kok, Kwun Tong, Singapore's Orchard and Toa Payoh, and Taipei's Minsheng and Wenshan.

The goal is a Waypost within a few minutes' walk wherever people actually walk, **inside the map we already have**, with every safety rule kept.

## How Wayposts work today

- **Where they live:** a Waypost is a row in `public.public_capsule_spots` (formerly `sea_shores`) with `game_enabled = true`: `kind` is `common` or `landmark`, `scene` is one of `park` / `garden` / `waterfront` / `square` / `publicArt`, and there are `name_zh` / `name_en`, `city_zh` / `city_en` and a unique `source_ref`.
- **Corrupted Capsule spots** are a separate table, `public.corrupted_spots` (`city`, `timezone`, `habitat` park/water/square, `source_ref`). Waves pick from these. Waypost rows and spot rows are made by the same script.
- **Seed script:** [`scripts/seed-game-public-paths.py`](../../scripts/seed-game-public-paths.py). It keeps only footway/path/pedestrian ways inside `leisure=park` or `place=square` polygons without a fee. It blocks 100 m around schools, kindergartens, colleges, universities, hospitals, clinics, places of worship, graveyards, religious, cemetery, military and industrial land, private/no/customers/permit access, `religion=*`, `hazard=*` and `military=*`, and 20 m around motor roads. It samples a point every 25 m along each path, then keeps a spaced set: **250 m apart for Wayposts and 150 m for spots**. It asserts every point is inside the tile area and outside the blocked area. `source_ref` records the path, the offset and the park, for example `osm:way/49195976@100m;park/way/1227733215`.
- **HKUST** is the one school exception Roy approved: public outdoor walkways only, seeded by hand.
- **Names:** `name_zh` must be Chinese. The first seed copied English into `name_zh`, which `20261110082103_localize_game_waypost_names` fixed by hand; unnamed parks are 公園 / "Public park".
- **Discovery:** `public.corrupted_nearby` returns **every** game-enabled Waypost within 5 km (`20261114075139`). It runs about every 30 seconds while Journey is open, and again when the player moves about 110 m. The Waypost part has no bounding-box prefilter and no limit. The Journey WebView draws each Waypost as its own MapLibre DOM marker.

## Map coverage: what is in and out

Wayposts only make sense where the map draws something, and the seed script already refuses points outside [`public-sea-cities.geojson`](public-sea-cities.geojson). The four game regions in today's 99 MB PMTiles file are rectangles:

| Region | Tile area | In | Out |
|---|---|---|---|
| Taipei | 121.510–121.616 E, 24.988–25.084 N (~114 km²) | Zhongzheng, Da'an, Xinyi, Songshan, Zhongshan, Wanhua (east part), Neihu (south), Wenshan (north) | Beitou, Shilin north, Tamsui, all of New Taipei (Banqiao, Sanchong, Xinzhuang), and every other Taiwanese city |
| Hong Kong | 114.106–114.280 E, 22.251–22.350 N (~198 km²) | Kowloon, Hong Kong Island north shore, Kwun Tong, Tseung Kwan O, HKUST | Aberdeen and the south side, Sha Tin, Tsuen Wan, the rest of the New Territories, Lantau and the airport |
| Singapore | 103.806–103.906 E, 1.235–1.338 N (~126 km²) | Downtown, Marina Bay, Orchard, Bukit Timah east, Toa Payoh, Kallang, Geylang, Sentosa | Jurong, Woodlands, Yishun, Tampines, Pasir Ris, Changi |
| Macau | 113.495–113.603 E, 22.142–22.239 N (~125 km²) | The peninsula, Taipa, Cotai | Most of Coloane (the village, Hac Sa) |

**"All of Taiwan" is far outside the tiles.** Choices, from cheapest:

1. **Fill in inside today's tiles** (this plan). No tile work. Recommended now.
2. **Grow the metro areas:** Greater Taipei with New Taipei's core, the whole Hong Kong SAR, the whole of Singapore and Coloane. That adds roughly 2,500 km² of mixed density, very roughly +100–200 MB.
3. **All of Taiwan:** about 36,000 km², two thirds of it mountains. A rough estimate is 0.5–1.5 GB at zoom 15.

Cost of 2 or 3: R2 storage is in the free tier either way (10 GB) and R2 has no egress charge, so the money cost is close to zero. The real costs are:
- The rebuild: one `pmtiles extract` of the Protomaps build plus an upload. Upload it under a **new file name** and point `EXPO_PUBLIC_MAP_PMTILES_URL` at it, which needs an app release, so cached clients never mix two archives.
- The rate-limited `r2.dev` URL, which needs a custom domain before real traffic (tied to T2's domain).
- Each new city's safety review, Chinese names, a vessel set and probably a Landmark.
- A trap: `private.resolve_spawn` maps only Taipei, Kaohsiung, Taichung and Tainan to Taiwan. A spot with `city = 'New Taipei'` would spawn nothing until that list (or the admin plan's `private.game_regions`) includes it.

Codex should measure, not guess: `pmtiles extract ... --dry-run` reports the size before anything is uploaded. **Options 2 and 3 are Roy's call and are not part of this task.**

## Target density

The spacing stays at **250 m between Wayposts everywhere**, the same number the admin plan's hand-editing warning uses. How dense an area ends up depends on how much public walking space it has, so the targets are checks, not separate spacings:

| Area type | Target | Measured as |
|---|---|---|
| City centre | a Waypost within **300 m**, and at least 4 within 500 m | at the sample points below |
| Suburb / residential | a Waypost within **600 m** | at the sample points below |
| Park | every qualifying path sample within **250 m** of a Waypost | the script's existing assertion |

Where a target can't be met without breaking a safety rule, the safety rule wins and the report says so. No filler on roads.

### Sample points for the density check

These coordinates are approximate. Codex snaps each one to the nearest public walkway and reports the coordinates it used.

| Region | Centre | Centre | Suburb | Suburb | Park |
|---|---|---|---|---|---|
| Taipei | Zhongxiao Fuxing 25.0416, 121.5437 | Civic Square 25.0375, 121.5628 | Minsheng Community 25.0590, 121.5590 | Wenshan / Jingmei 24.9925, 121.5410 | Da'an Forest Park 25.0300, 121.5355 |
| Hong Kong | Tsim Sha Tsui 22.2976, 114.1722 | Central 22.2820, 114.1588 | Kwun Tong 22.3123, 114.2257 | Tseung Kwan O 22.3075, 114.2600 | Victoria Park 22.2823, 114.1884 |
| Singapore | Raffles Place 1.2840, 103.8514 | Orchard 1.3040, 103.8318 | Tiong Bahru 1.2852, 103.8270 | Toa Payoh 1.3343, 103.8500 | Botanic Gardens 1.3138, 103.8159 |
| Macau | Senado Square 22.1937, 113.5399 | Taipa Village 22.1535, 113.5575 | Iao Hon 22.2105, 113.5485 | Ocean Gardens, Taipa 22.1600, 113.5600 | Taipa Central Park 22.1565, 113.5555 |

For each point, report: nearest Waypost (m), Wayposts within 300 m, 500 m and 600 m, Wayposts within 5 km, and Corrupted Capsule spots within 100 m. Report before and after.

## Sources and categories

Same script, more kinds of public place. Each category maps to an existing `scene` and spot `habitat`:

| Category | OSM tags | Point | `scene` | spot `habitat` |
|---|---|---|---|---|
| Park paths (today) | footway/path/pedestrian inside `leisure=park` | sampled along the path | `park` | `park` |
| Gardens | footway inside `leisure=garden` with no `access` limit and no fee | sampled along the path | `garden` | `park` |
| Squares and pedestrian areas | `place=square`, `highway=pedestrian` + `area=yes` | sampled inside the area | `square` | `square` |
| Waterfront promenades | footway/pedestrian within 50 m of `natural=water`, `waterway=riverbank` or the coastline, inside a public park or promenade | sampled along the path | `waterfront` | `water` |
| Outdoor public art | `tourism=artwork` with `artwork_type` sculpture / statue / installation / mural, not inside a building | the node itself, if it passes every rule | `publicArt` | `square` |

Skipped on purpose: libraries, shops, malls, transit stations, sports grounds and anything indoors.

**Extracts:** today's script reads several small OSM API `/map` extracts per city. Covering the whole tile rectangles needs bigger extracts. Codex picks the method (tiled API calls, Overpass, or a Geofabrik extract clipped to the tile polygons) and records the source, date and SHA-256 for every file, as the existing migrations do. ODbL credit stays in the migration header.

## Exclusions

Keep **every** rule in the script unchanged: the 100 m buffers, the 20 m motor-road buffer, `fee=yes` and `foot=no`, and the tile-area assertion. Two small additions:

- 20 m from railway tracks (`railway=rail|subway|light_rail|tram`, unless it is a tunnel).
- `landuse=construction` joins the 100 m blocked list.

The HKUST exception stays limited to the already-seeded campus walkways. No new campus rows.

## Naming

- `name_zh` is **Chinese only**. Take the first of `name:zh-Hant`, `name:zh-TW` / `name:zh-HK`, `name` if it is in Chinese characters, then `name:zh`. Convert Simplified to Traditional (Singapore's `name:zh` is usually Simplified) with OpenCC `s2t`, installed only in the seed script's temporary environment, never in the app. Otherwise use the generic name for the scene: 公園, 花園, 廣場, 海濱步道, 公共藝術.
- `name_en`: `name:en`, then `name:pt` for Macau, then `name` if it is Latin; otherwise the generic "Park", "Garden", "Square", "Waterfront" or "Public art".
- The report lists every converted name and every generic name, so Claude can spot-check them.
- `city_zh` / `city_en` stay exactly 台北/Taipei, 香港/Hong Kong, 新加坡/Singapore and 澳門/Macau.

## Duplicates and existing rows

- **Never move, rename or delete an existing row.** City Hunt routes, spin history, public capsules and hunt quests point at them.
- Before sampling, Codex exports the live game-enabled Waypost rows (common and Landmark) for each region and feeds them to the sampler as **already chosen**. No new Waypost lands within 250 m of an existing one, and the same goes for spots at 150 m.
- `source_ref` stays unique and keeps the same format, with the category added, for example `osm:node/123;publicArt` or `osm:way/456@75m;square/way/789`. Inserts keep `on conflict (source_ref) do nothing`.
- No new Landmark Waypost in this task.

## Public capsules: one side effect to decide

The public-capsule throw puts a capsule at the **nearest** `public_capsule_spots` row within 3 km, and that check ignores `game_enabled`. With a Waypost every 250 m, a public capsule would land within about 125 m of where the sender stood. Today it is usually a park or plaza further away. Two options:

- **A (recommended): keep today's drop places.** Add `public_drop boolean not null default true` to `public_capsule_spots`, set it `false` on the new rows, and have the throw (and `public_capsule_return`'s next-spot pick) filter on it. Small, and public capsule behaviour doesn't change.
- **B: let new Wayposts be drop places too.** No schema change, but the sender's area shows up more precisely.

## Server cost

- **Rows.** A rough estimate inside today's tiles is 1,500–2,500 Wayposts in total (Taipei 400–700, Hong Kong 400–700, Singapore 500–800, Macau 100–200) and about 2.5× as many spots. That is tiny for Postgres. Guardrail: Codex stops and reports, without applying anything, if any region would get more than 1,000 new Wayposts or more than 3,000 new spots.
- **The `nearby` query.** The Waypost part of `corrupted_nearby` computes `distance_m` for every game-enabled row on every call. At 3,000 rows that is still a few milliseconds, but add the same latitude/longitude bounding box the spawn part already uses, plus a btree index on `(lat, lng) where game_enabled`. Spot lookups already use a bounding box; add a `(lat, lng)` index on `corrupted_spots` too. PostGIS isn't needed.
- **Payload and the map.** This is the real cost. In a dense centre, 5 km could hold 500 or more Wayposts: about 125 KB every 30 seconds, and 500 DOM markers in the WebView. **Return every Landmark Waypost within 5 km, then the nearest common Wayposts up to a cap of 200**, ordered by distance. Do this in the first migration, before any new rows. The client needs no change: it already draws whatever comes back, and City Hunt only reads the Landmark from that list.

## How this fits the admin page

The approved admin plan ([`admin.md`](admin.md) on `claude/admin-plan`) sets spawning **per country and city now**, and smaller areas later as **drawn shapes** inside a city. So rows don't need an area column. They need a reliable city key:

- New Waypost rows use exactly the same `city_en` values as today, and new spot rows the same `city` values (`Taipei`, `Hong Kong`, `Singapore`, `Macau`), so `admin_city_map(p_region)` and `admin_cities()` can filter by them.
- The admin plan's phase 1 backend moves the region list into `private.game_regions`. If that table is live when this work starts, each new row's city must exist in it (check it in the preflight). If it isn't live yet, **don't create it here**; the admin work owns it.
- `source_ref` carries the category, so the admin map can show why a Waypost exists, and hand-added ones from admin phase 2 ("checked by hand") stay distinguishable.
- Admin phase 2 warns at under 250 m between Wayposts, the same spacing used here.
- The admin overview's "map coverage" card should show the tile rectangles in the table above.

## Rollout order

One branch, one PR, separate migrations so each can be checked on its own:

1. `corrupted_nearby`: Waypost bounding box, the cap of 200 with Landmarks always included, the indexes, and `public_drop` if Roy picks A. No new rows.
2. **Hong Kong** (the thinnest today).
3. **Macau**, then **Singapore**, then **Taipei**.

Each data migration inserts Wayposts and their spots for one region. All migrations stay unapplied until Claude reviews and Roy approves. Then they are applied in order, each followed by its density check.

## Roy's choices (confirmed 2026-11-15)

1. Fill in inside today's tiles only. Growing the metro areas or covering all of Taiwan is a separate decision, with a measured size first.
2. The five categories (adding gardens, squares, waterfront promenades and outdoor public art to park paths) and the two extra exclusions (railway tracks, construction sites).
3. Public capsules keep today's drop places (option A).
4. Return the nearest 200 common Wayposts within 5 km, plus every Landmark.
5. Add Corrupted Capsule spots in the newly covered places too, so new Waypost areas also have capsules to catch.
