"""Reproduce one city from the dated Geofabrik PBF. See docs/review/drop-places.md."""
import json
import gzip
import hashlib
import math
import re
import runpy
import sys
from pathlib import Path

import numpy as np
import osmium
import shapely
from pyproj import CRS, Transformer
from shapely import from_wkb, make_valid, transform
from shapely.geometry import LineString, box, shape
from shapely.strtree import STRtree

script_dir = Path(__file__).resolve().parent
seed = runpy.run_path(str(script_dir / 'seed-game-public-paths.py'))
city, extract, output_dir = sys.argv[1:]
output_dir = Path(output_dir)
output_dir.mkdir(parents=True, exist_ok=True)
coast = json.loads(gzip.decompress((script_dir / 'data/drop-places/coastlines.json.gz').read_bytes()))
STEP = 50
EXTRACT_DATE = '2026-11-14T21:20:41Z'

region = seed['REGIONS'][city]
slug = region.slug.replace('_', '-')
bounds = {
    'taipei': (121.50994318905, 24.988493, 121.61580581095, 25.08448),
    'hong-kong': (114.105918834141, 22.250837, 114.28, 22.35),
    'singapore': (103.806473646798, 1.235271, 103.905524353202, 1.337778),
    'macau': (113.494906752897, 22.142088, 113.603347247103, 22.239391),
}[slug]
clip = box(*bounds)
lng, lat = region.centre
local = CRS.from_proj4(f'+proj=aeqd +lon_0={lng} +lat_0={lat} +datum=WGS84 +units=m')
project = Transformer.from_crs(4326, local, always_xy=True).transform
unproject = Transformer.from_crs(local, 4326, always_xy=True).transform

ROAD = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified',
        'residential', 'living_street', 'service', 'track', 'road', 'busway',
        'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}
WALK = {'footway', 'pedestrian', 'path', 'steps'}
PUBLIC_FOOT = {'yes', 'designated', 'official', 'permissive'}
SENSITIVE = {'school', 'kindergarten', 'hospital', 'place_of_worship', 'grave_yard'}

def pedestrian(tags):
    highway = tags.get('highway')
    return (highway in WALK
        or highway in {'bridleway', 'cycleway'} and tags.get('foot') in PUBLIC_FOOT
        or highway in ROAD and tags.get('motor_vehicle') == 'no' and tags.get('foot') in PUBLIC_FOOT)

def sensitive(tags):
    return (tags.get('amenity') in SENSITIVE
        or tags.get('building') in {'school', 'kindergarten', 'hospital', 'church', 'cathedral', 'mosque', 'synagogue', 'temple', 'chapel', 'shrine'}
        or tags.get('landuse') in {'cemetery', 'religious', 'military'}
        or tags.get('boundary') == 'military'
        or tags.get('military') not in (None, 'no'))

def place_kind(tags):
    if tags.get('leisure') in {'park', 'garden'}:
        return tags['leisure']
    if tags.get('place') == 'square' or tags.get('area:highway') == 'pedestrian' or (
        tags.get('highway') == 'pedestrian' and tags.get('area') == 'yes'):
        return 'square'
    if tags.get('area:highway') in WALK or tags.get('highway') in WALK and tags.get('area') == 'yes':
        return 'pedestrian area'
    return None

def motor_road(tags):
    return (tags.get('highway') in ROAD and tags.get('motor_vehicle') != 'no'
            and tags.get('vehicle') != 'no')

def offset_level(tags):
    layer = tags.get('layer', '0')
    return layer.startswith('-') or tags.get('tunnel') not in (None, 'no')

def carriageway_width(tags):
    for key in ('width:carriageway', 'width'):
        value = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(?:m)?\s*', tags.get(key, ''))
        if value and 1 <= float(value[1]) <= 60:
            return float(value[1])
    lanes = tags.get('lanes', '')
    if lanes.isdecimal() and 1 <= int(lanes) <= 12:
        return int(lanes) * 3.0
    if tags.get('highway') == 'service':
        return 3.0 if tags.get('service') in {'driveway', 'parking_aisle'} else 4.0
    if tags.get('highway') == 'track':
        return 2.7
    if tags.get('oneway') in {'yes','-1'} or tags.get('highway', '').endswith('_link'):
        return 3.25
    return 6.5 if tags.get('highway') in {'motorway','trunk','primary','secondary'} else 5.5

def label(tags):
    return tags.get('name:en') or tags.get('name') or tags.get('name:zh')

def parts(geom, kind):
    if geom.is_empty:
        return
    if geom.geom_type == kind:
        yield geom
    elif hasattr(geom, 'geoms'):
        for element in geom.geoms:
            yield from parts(element, kind)

class ReadMap(osmium.SimpleHandler):
    near_tiles = seed['Extract'].near_tiles

    def __init__(self):
        super().__init__()
        self.clip = clip
        self.boundary = None
        self.wkb = osmium.geom.WKBFactory()
        self.ways = []
        self.areas = []
        self.blocked = []
        self.hard_masks = []

    def way(self, way):
        raw = way.tags
        if not raw.get('highway'):
            return
        tags = dict(raw)
        on_foot = pedestrian(tags) and tags.get('foot') not in {'use_sidepath', 'dismount'}
        drive = motor_road(tags)
        is_area = tags.get('area') == 'yes'
        if not (on_foot or drive) or is_area or offset_level(tags):
            return
        coords = [(node.lon, node.lat) for node in way.nodes if node.location.valid()]
        if len(coords) < 2:
            return
        if not self.near_tiles(coords):
            return
        geom = transform(LineString(coords), project, interleaved=False)
        if drive:
            if tags.get('bridge') not in (None, 'no') or tags.get('layer','0') not in ('0',''):
                return
            lane = geom.buffer(carriageway_width(tags) / 2, cap_style='flat', join_style='round', quad_segs=4)
            if not lane.is_empty:
                self.hard_masks.append(lane)
        elif (tags.get('indoor') in (None, 'no') and tags.get('location') != 'indoor'
                and tags.get('footway') != 'crossing' and tags.get('foot') != 'no'):
            kind = 'sidewalk' if tags.get('footway') == 'sidewalk' else tags.get('highway', 'path')
            self.ways.append((geom, f'way/{way.id}', label(tags), kind))

    def area(self, area):
        tags = dict(area.tags)
        ref = f"{'way' if area.from_way() else 'relation'}/{area.orig_id()}"
        is_boundary = ref == region.boundary
        no_drops = sensitive(tags)
        scene = place_kind(tags)
        building = any(tags.get(k) not in (None,'no') for k in ('building','building:part'))
        water = (tags.get('natural') in {'water','bay','strait','wetland','mud','reef'}
                 or tags.get('water') not in (None,'no') or tags.get('waterway') in {'riverbank','dock'}
                 or tags.get('leisure') == 'swimming_pool')
        road = ((tags.get('area:highway') in ROAD or motor_road(tags) and tags.get('area') == 'yes')
                and not offset_level(tags))
        if not (is_boundary or building or water or road or no_drops or scene):
            return
        try:
            geom = from_wkb(self.wkb.create_multipolygon(area))
        except (RuntimeError, ValueError):
            return
        if geom.is_empty or not self.near_tiles((geom.bounds[:2],geom.bounds[2:])):
            return
        geom = make_valid(transform(geom, project, interleaved=False))
        if is_boundary:
            self.boundary = geom
        if no_drops:
            self.blocked.append(geom)
        if building or water or road:
            self.hard_masks.append(geom)
        elif scene:
            self.areas.append((geom, ref, label(tags), scene))

def coords(points, decimals=7):
    lngs, lats = unproject(shapely.get_x(points), shapely.get_y(points))
    return np.round(np.column_stack((lats,lngs)), decimals)

def projection(latlngs):
    arr = np.array(latlngs)
    xs, ys = project(arr[:, 1], arr[:, 0])
    return shapely.points(xs, ys)

def allowed_mask(points, footprint, *indices):
    good = shapely.covers(footprint, points)
    for index in indices:
        if len(index):
            hit = index.query(points, predicate='intersects')
            if hit.shape[1]:
                good[hit[0]] = False
    return good

def main():
    parser = ReadMap()
    keys = osmium.filter.KeyFilter(
        'highway','area:highway','natural','water','waterway','building','building:part',
        'boundary','military','amenity','landuse','leisure','place')
    parser.apply_file(extract, locations=True, idx='flex_mem', filters=[keys])
    assert parser.boundary is not None
    poly = transform(clip, project, interleaved=False)
    footprint = poly.intersection(parser.boundary)
    if city in coast['land']:
        land = transform(shape(coast['land'][city]), project, interleaved=False)
        footprint = footprint.intersection(land)
    if city == 'Macau':
        parser.hard_masks.extend(make_valid(transform(shape(item), project, interleaved=False))
                                 for item in coast['macauWater'])
    assert 0.03 <= footprint.area / poly.area <= 1.000001
    shapely.prepare(footprint)
    print(f'{slug} footprint {footprint.area/1e6:.1f} km². {len(parser.ways)} ways, {len(parser.areas)} pedestrian areas', file=sys.stderr, flush=True)
    hard_masks = STRtree(parser.hard_masks)
    protected = STRtree(parser.blocked)
    areas = [
        (piece, ref, name, kind)
        for geom, ref, name, kind in sorted(parser.areas, key=lambda item: item[1])
        for piece in parts(geom.intersection(footprint), 'Polygon') if piece.area > 0
    ]
    ways = sorted(parser.ways, key=lambda item: item[1])

    candidates = {}
    def add(new_points, ref, name, kind):
        points = new_points[allowed_mask(new_points, footprint, hard_masks, protected)]
        if not len(points):
            return
        latlngs = coords(points)
        rounded = projection(latlngs)
        good = allowed_mask(rounded, footprint, hard_masks, protected)
        for pos in latlngs[good]:
            key = tuple(pos)
            if key not in candidates or (name and not candidates[key][1]):
                candidates[key] = (ref,name,kind)

    for geom, ref, name, kind in areas:
        x1,y1,x2,y2 = geom.bounds
        xx, yy = np.meshgrid(np.arange(math.ceil(x1 / STEP) * STEP, x2, STEP), np.arange(math.ceil(y1 / STEP) * STEP, y2, STEP))
        pts = shapely.points(xx.ravel(), yy.ravel())
        if len(pts):
            add(pts[shapely.contains(geom,pts)], ref, name, kind)
    for geom, ref, name, kind in ways:
        if geom.length:
            offsets = np.arange(0, geom.length + .0001, STEP)
            add(shapely.line_interpolate_point(geom,offsets), ref, name, kind)
    # Record a nearby sidewalk and a mapped protected ground for integration checks.
    sidewalks = [(coord, ref) for coord, (ref, _, kind) in candidates.items() if kind == 'sidewalk']
    schools = [point for polygon in parser.blocked if polygon.intersects(footprint)
               for point in [polygon.representative_point()] if footprint.covers(point)]
    print(f'{slug} {len(candidates)} grid and path locations', file=sys.stderr)
    rows = [[*coord, ref, name] for coord, (ref, name, _) in sorted(candidates.items())]
    (output_dir / f'{slug}.json').write_text(json.dumps({
        'city': city, 'region': slug, 'extract_date': EXTRACT_DATE, 'locations': rows,
        'sidewalks': sidewalks, 'protected': coords(np.array(schools)).tolist() if schools else [],
    }, ensure_ascii=False, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    expected = {
        'taipei': 'fd8d74b5226ad4c700c082de55708c86fdcd374d6c89dd46022f579b534e6d56',
        'singapore': '4fc76f724b39cc096d9d65662b920ce2b54570248d4bcc8eb90ea3ff62aef575',
        'hong-kong': 'e0c5973fba87bcd3541f66304f7e0b92176d1a4a4e2255288587a2776da79d31',
        'macau': 'e0c5973fba87bcd3541f66304f7e0b92176d1a4a4e2255288587a2776da79d31',
    }[slug]
    with open(extract, 'rb') as handle:
        if hashlib.file_digest(handle, 'sha256').hexdigest() != expected:
            raise ValueError('OSM extract checksum mismatch')
    with osmium.io.Reader(extract) as reader:
        if reader.header().get('osmosis_replication_timestamp') != EXTRACT_DATE:
            raise ValueError('OSM extract timestamp mismatch')
    main()
