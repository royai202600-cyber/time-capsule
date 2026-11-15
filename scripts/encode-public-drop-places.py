"""Render the seed block for the public capsule drop-place migration."""
import base64
import json
import sys
import textwrap
from pathlib import Path

SCALE = 10_000_000
REGIONS = ('hong-kong', 'macau', 'singapore', 'taipei')


def encode(path):
    data = json.loads(path.read_text())
    region = data['region']
    points = [(round(row[0] * SCALE), round(row[1] * SCALE)) for row in data['locations']]
    lat0 = min(lat for lat, _ in points)
    lng0 = min(lng for _, lng in points)
    packed = bytearray()
    for lat, lng in points:
        packed.extend((lat - lat0).to_bytes(3, 'big'))
        packed.extend((lng - lng0).to_bytes(3, 'big'))
    encoded = '\n'.join(textwrap.wrap(base64.b64encode(packed).decode(), 100, break_on_hyphens=False))
    delimiter = '$$'
    return f"    ('{region}', {lat0}, {lng0}, decode({delimiter}{encoded}\n{delimiter}, 'base64'))", len(points)


def main(directory):
    regions = [encode(directory / f'{region}.json') for region in REGIONS]
    counts = ', '.join(f'{region} {total:,}' for region, (_, total) in zip(REGIONS, regions))
    values = ',\n'.join(row for row, _ in regions)
    print(f"""-- OpenStreetMap contributors (ODbL), snapshot 2026-11-14T21:20:41Z.
-- scripts/seed-public-drop-places.py and scripts/encode-public-drop-places.py
-- {counts}. Each record holds two 24-bit offsets in units of 1e-7 degrees.
with encoded(region_id, lat_origin, lng_origin, payload) as (
  values
{values}
), offsets as (
  select region_id,
    lat_origin + get_byte(payload, i) * 65536 + get_byte(payload, i + 1) * 256
      + get_byte(payload, i + 2) as lat,
    lng_origin + get_byte(payload, i + 3) * 65536 + get_byte(payload, i + 4) * 256
      + get_byte(payload, i + 5) as lng
  from encoded
  cross join lateral generate_series(0, length(payload) - 6, 6) as pos(i)
), existing as materialized (
  select round(p.lat * 10000000)::integer as lat, round(p.lng * 10000000)::integer as lng
  from private.public_capsule_points p
  where p.eligible and p.lat is not null and p.lng is not null
)
insert into private.public_capsule_drop_places (id, region_id, lat, lng)
select md5(region_id || ':' || lat || ':' || lng)::uuid,
  region_id, lat / 10000000.0, lng / 10000000.0
from offsets
where (lat, lng) not in (select lat, lng from existing);""")


if __name__ == '__main__':
    main(Path(sys.argv[1]))
