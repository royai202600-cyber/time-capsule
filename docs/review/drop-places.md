# Public capsule drop places

Roy approved private 50 m drop places on 2026-11-15. The seed includes mapped footways, sidewalks, pedestrian streets, paths, parks, squares and walkable residential grounds regardless of their access tag. Points must fall within the city and production tile coverage on dry outdoor ground. The seed uses mapped school, kindergarten, hospital, worship, cemetery and military footprints and models car lanes from mapped outlines or carriageway widths. It uses no additional setbacks or spacing across features. Sidewalk tags on a road centreline do not supply an independent sidewalk geometry.

The private table has a GiST index over its coordinates. Drops use an indexed search rectangle and the exact existing 100 m distance check. A capsule references exactly one source and uses that same coordinate for Journey and pickup. Existing drop points, Wayposts and Corrupted Capsule spots are preserved. The extra points enter the drop and pass-on pool and have no independent map marker or spin action. New places display the city name on their capsule when needed.

## Seed sources and reproduction

Geofabrik extracts are from **2026-11-14T21:20:41Z**. The script checks the timestamp and SHA-256. The archived coastline mask fixes the source geometry used for the coverage check, including an imagery-checked Macau shoreline and the Macau water polygons from the production PMTiles. The 400 random coordinates are the fixed comparison set from the read-only check.

- [Taiwan extract](https://download.geofabrik.de/asia/taiwan-261114.osm.pbf)
- [Guangdong extract for Hong Kong and Macau](https://download.geofabrik.de/asia/china/guangdong-261114.osm.pbf)
- [Malaysia–Singapore–Brunei extract](https://download.geofabrik.de/asia/malaysia-singapore-brunei-261114.osm.pbf)
- [OpenStreetMap contributors, ODbL](https://www.openstreetmap.org/copyright)
- [PMTiles source](../design/public-sea-tiles.md) and [Esri World Imagery](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) for the Macau shoreline check

In Python 3.12, from the repository root:

```sh
python -m pip install 'osmium==4.3.2' 'numpy==2.5.4' 'shapely==2.2.0' 'pyproj==3.8.0' 'opencc-python-reimplemented==0.1.7'
python scripts/seed-public-drop-places.py 'Taipei' /path/to/taiwan-261114.osm.pbf /tmp/drop-places
python scripts/seed-public-drop-places.py 'Hong Kong' /path/to/guangdong-261114.osm.pbf /tmp/drop-places
python scripts/seed-public-drop-places.py 'Singapore' /path/to/malaysia-singapore-brunei-261114.osm.pbf /tmp/drop-places
python scripts/seed-public-drop-places.py 'Macau' /path/to/guangdong-261114.osm.pbf /tmp/drop-places
python scripts/encode-public-drop-places.py /tmp/drop-places > /tmp/drop-places/seed.sql
```

The SQL block stores lossless 24-bit coordinate offsets from each region's origin. IDs derive from the region and seven-decimal coordinates. At load time the migration skips candidates that match an existing eligible coordinate.

## Coverage at 100 m

Each coverage column uses today's eligible sources plus the modeled addition at that spacing. The design points come from the [Waypost coverage plan](../design/waypost-coverage.md#sample-points-for-the-density-check).

| City | 25 m estimate, places | 50 m places | Design, today → 25 m → 50 m | Random, today → 25 m → 50 m |
|---|---:|---:|---|---|
| Taipei | 60,482 | 29,656 | 3/5 → 5/5 → 5/5 | 9% → 80% → 78% |
| Hong Kong | 113,107 | 62,465 | 1/5 → 5/5 → 5/5 | 2% → 83% → 83% |
| Singapore | 56,664 | 28,354 | 3/5 → 5/5 → 5/5 | 7% → 85% → 84% |
| Macau | 8,045 | 4,266 | 1/5 → 4/5 → 4/5 | 7% → 52% → 50% |
| **Total** | **238,298** | **124,741** | | |

Hosted rollback measured 9,306,112 bytes for the table and 13,328,384 bytes for its indexes, or 22.63 MB (21.59 MiB) combined.

## Verification

Run the migration body and `supabase/tests/public-drop-places.sql` inside one transaction, replacing the migration's final commit with the test and rollback. The hosted run checked the Taipei sidewalk, Da'an Junior High School refusal, the stored Journey location, 70 m pickup, 150 m refusal, pass-on, two-report hiding and admin Remove after opening. The maximum of 20 hosted SQL drops was 3.54 ms. The local query plan used the GiST index.

Run `node supabase/tests/public-drop-places-api.mjs` against local Supabase with the local anonymous and service test keys, as documented in the script. The four local accounts use real Supabase Auth JWTs, including the moderator for the queue check.
