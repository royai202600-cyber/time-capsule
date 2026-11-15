"""Generate Wayposts and Corrupted Capsule spots from local Geofabrik PBF extracts.

Run from the repository root in a temporary Python environment:
  pip install 'osmium==4.3.2' 'shapely==2.2.0' 'pyproj==3.8.0' 'opencc-python-reimplemented==0.1.7'
  python scripts/seed-game-public-paths.py EXTRACTS LIVE_POINTS TILE_GEOMETRY OUTPUT

EXTRACTS is a JSON object keyed by city with a {url, path} entry for each city.
LIVE_POINTS is a JSON object keyed by city with wayposts and spots arrays of
[lat, lng] pairs from the live database. TILE_GEOMETRY is the existing PMTiles
coverage GeoJSON. OUTPUT must already be a directory.
"""
import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import unicodedata

import osmium
from opencc import OpenCC
from pyproj import CRS, Transformer
from shapely import from_wkb, make_valid, transform
from shapely.geometry import LineString, MultiPoint, Point, Polygon, box, shape
from shapely.ops import nearest_points, polygonize, unary_union
from shapely.strtree import STRtree


EARTH_RADIUS = 6_371_000
STEP = 25
WALKWAYS = {"footway", "path", "pedestrian"}
NON_MOTOR_ROADS = WALKWAYS | {"steps", "cycleway", "bridleway"}
RAILWAYS = {"rail", "subway", "light_rail", "tram"}
RESTRICTED = {"private", "no", "customers", "permit"}
BLOCKED_AMENITIES = {
    "school", "kindergarten", "college", "university", "hospital", "clinic",
    "place_of_worship", "grave_yard",
}
BLOCKED_USES = {"religious", "cemetery", "military", "industrial", "construction"}
ART_TYPES = {"sculpture", "statue", "installation", "mural"}
HKUST = "way/40664120"
SOURCE_KEYS = (
    "access", "amenity", "boundary", "building", "hazard", "highway", "landuse", "leisure",
    "man_made", "military", "natural", "place", "railway", "religion", "tourism", "waterway",
)
SCENES = {
    "publicArt": ("公共藝術", "Public art", "square"),
    "waterfront": ("海濱步道", "Waterfront", "water"),
    "garden": ("花園", "Garden", "park"),
    "square": ("廣場", "Square", "square"),
    "park": ("公園", "Park", "park"),
}


@dataclass(frozen=True)
class Region:
    slug: str
    zh: str
    timezone: str
    centre: tuple[float, float]
    boundary: str


REGIONS = {
    "Hong Kong": Region("hong_kong", "香港", "Asia/Hong_Kong", (114.18, 22.30), "relation/913110"),
    "Macau": Region("macau", "澳門", "Asia/Macau", (113.55, 22.20), "relation/1867188"),
    "Singapore": Region("singapore", "新加坡", "Asia/Singapore", (103.85, 1.29), "relation/536780"),
    "Taipei": Region("taipei", "台北", "Asia/Taipei", (121.56, 25.04), "relation/1293250"),
}

# Centre, centre, suburb, suburb, park, in the order of the approved design.
SAMPLES = {
    "Hong Kong": [
        ("Tsim Sha Tsui", 22.2976, 114.1722),
        ("Central", 22.2820, 114.1588),
        ("Kwun Tong", 22.3123, 114.2257),
        ("Tseung Kwan O", 22.3075, 114.2600),
        ("Victoria Park", 22.2823, 114.1884),
    ],
    "Macau": [
        ("Senado Square", 22.1937, 113.5399),
        ("Taipa Village", 22.1535, 113.5575),
        ("Iao Hon", 22.2105, 113.5485),
        ("Ocean Gardens, Taipa", 22.1600, 113.5600),
        ("Taipa Central Park", 22.1565, 113.5555),
    ],
    "Singapore": [
        ("Raffles Place", 1.2840, 103.8514),
        ("Orchard", 1.3040, 103.8318),
        ("Tiong Bahru", 1.2852, 103.8270),
        ("Toa Payoh", 1.3343, 103.8500),
        ("Botanic Gardens", 1.3138, 103.8159),
    ],
    "Taipei": [
        ("Zhongxiao Fuxing", 25.0416, 121.5437),
        ("Civic Square", 25.0375, 121.5628),
        ("Minsheng Community", 25.0590, 121.5590),
        ("Wenshan / Jingmei", 24.9925, 121.5410),
        ("Da’an Forest Park", 25.0300, 121.5355),
    ],
}


def blocked_tags(tags):
    return (
        tags.get("amenity") in BLOCKED_AMENITIES
        or tags.get("landuse") in BLOCKED_USES
        or tags.get("access") in RESTRICTED
        or any(tags.get(key) for key in ("religion", "hazard", "military"))
    )


def indoor(tags):
    return (
        tags.get("indoor") not in (None, "no")
        or tags.get("location") in {"indoor", "underground"}
        or tags.get("tunnel") not in (None, "no")
    )


def restricted_foot(tags):
    return tags.get("foot") in RESTRICTED


def category(tags):
    if tags.get("leisure") in ("park", "garden"):
        return tags["leisure"]
    if tags.get("place") == "square" or (
        tags.get("highway") == "pedestrian" and tags.get("area") == "yes"
    ):
        return "square"
    if tags.get("man_made") == "promenade" or tags.get("leisure") == "promenade":
        return "waterfront"
    return None


def waterfront_path(tags):
    return category(tags) == "waterfront" or any(
        any(word in value.casefold() for word in ("promenade", "海濱長廊", "海濱步道", "海濱走廊", "滨海步道"))
        for key, value in tags.items() if key == "name" or key.startswith("name:")
    )


class Extract(osmium.SimpleHandler):
    def __init__(self, clip, project, boundary):
        super().__init__()
        self.clip = clip
        self.project = project
        self.boundary_ref = boundary
        self.boundary = None
        self.campus_found = False
        self.factory = osmium.geom.WKBFactory()
        self.exclusions = []
        self.water = []
        self.areas = []
        self.paths = []
        self.art = []

    def near_tiles(self, coords):
        west, south, east, north = self.clip.bounds
        lngs, lats = zip(*coords)
        return min(lngs) <= east and max(lngs) >= west and min(lats) <= north and max(lats) >= south

    def node(self, node):
        tags = dict(node.tags)
        art = tags.get("tourism") == "artwork" and tags.get("artwork_type") in ART_TYPES
        if not (art or blocked_tags(tags)) or not self.clip.covers(Point(node.lon, node.lat)):
            return
        point = Point(*self.project(node.lon, node.lat))
        ref = f"node/{node.id}"
        if blocked_tags(tags):
            self.exclusions.append((point, 100, ref))
        elif not indoor(tags) and not restricted_foot(tags) and tags.get("fee") != "yes":
            self.art.append((point, ref, tags))

    def way(self, way):
        tags = dict(way.tags)
        highway = tags.get("highway")
        danger = blocked_tags(tags)
        track = tags.get("railway") in RAILWAYS and tags.get("tunnel") in (None, "no")
        coast = tags.get("natural") == "coastline"
        if not (highway or danger or track or coast):
            return
        coords = [(node.lon, node.lat) for node in way.nodes if node.location.valid()]
        if len(coords) < 2 or not self.near_tiles(coords):
            return
        line = transform(LineString(coords), self.project, interleaved=False)
        ref = f"way/{way.id}"
        motor = highway and highway not in NON_MOTOR_ROADS
        footprint = line
        if (danger or motor) and len(coords) >= 4 and coords[0] == coords[-1]:
            footprint = make_valid(Polygon(line.coords))
        if danger:
            self.exclusions.append((footprint, 100, ref))
        if motor:
            self.exclusions.append((footprint, 20, ref))
        if track:
            self.exclusions.append((line, 20, ref))
        if coast:
            self.water.append(line)
        if (highway in WALKWAYS and not danger and not indoor(tags)
                and not restricted_foot(tags) and tags.get("fee") != "yes"):
            self.paths.append((line, ref, tags))

    def area(self, area):
        tags = dict(area.tags)
        ref = f"{'way' if area.from_way() else 'relation'}/{area.orig_id()}"
        scene = category(tags)
        danger = blocked_tags(tags) or ref == HKUST
        water = tags.get("natural") == "water" or tags.get("waterway") == "riverbank"
        building = tags.get("building") not in (None, "no")
        motor = tags.get("highway") and tags["highway"] not in NON_MOTOR_ROADS
        if not (scene or danger or water or building or motor or ref == self.boundary_ref):
            return
        try:
            geometry = from_wkb(self.factory.create_multipolygon(area))
        except RuntimeError:
            # Keep exclusions conservative if an extract has an incomplete ring.
            if not (danger or motor or building):
                return
            coords = [(node.lon, node.lat) for ring in area.outer_rings() for node in ring
                      if node.location.valid()]
            if not coords or not self.near_tiles(coords):
                return
            geometry = MultiPoint(coords).convex_hull
            scene = None
        bounds = geometry.bounds
        if geometry.is_empty or not self.near_tiles((bounds[:2], bounds[2:])):
            return
        geometry = make_valid(transform(geometry, self.project, interleaved=False))
        if ref == self.boundary_ref:
            self.boundary = geometry
        if ref == HKUST:
            self.campus_found = True
        if danger:
            self.exclusions.append((geometry, 100, ref))
        if motor:
            self.exclusions.append((geometry, 20, ref))
        if building or tags.get("fee") == "yes" or restricted_foot(tags) or indoor(tags):
            self.exclusions.append((geometry, 0, ref))
        elif scene and not danger:
            self.areas.append((geometry, ref, tags, scene))
        if water:
            self.water.append(geometry.boundary)

    def block_other_relations(self, path):
        # Some schools and churches are site relations. Keep the existing
        # closed-member-ring rule for relations outside Osmium's area assembler.
        relation_filter = osmium.filter.KeyFilter(
            "amenity", "landuse", "access", "religion", "hazard", "military",
        )
        relations = {}
        for relation in osmium.FileProcessor(path, osmium.osm.RELATION).with_filter(relation_filter):
            if blocked_tags(relation.tags) and relation.tags.get("type") not in {"multipolygon", "boundary"}:
                relations[relation.id] = [(m.ref, m.role) for m in relation.members if m.type == "w"]
        member_ids = {ref for members in relations.values() for ref, _ in members}
        if not member_ids:
            return
        members = {}
        ways = osmium.FileProcessor(path, osmium.osm.NODE | osmium.osm.WAY).with_locations()
        ways.with_filter(osmium.filter.EntityFilter(osmium.osm.WAY))
        ways.with_filter(osmium.filter.IdFilter(member_ids))
        for way in ways:
            coords = [(n.lon, n.lat) for n in way.nodes if n.location.valid()]
            if len(coords) >= 2:
                members[way.id] = LineString(coords)
        for ref, rings in relations.items():
            outer_parts = [make_valid(p) for p in
                           polygonize(members[i] for i, role in rings if i in members and role != "inner")
                           if p.intersects(self.clip)]
            outer = unary_union(outer_parts)
            if outer.is_empty or not outer.intersects(self.clip):
                continue
            inner = unary_union([make_valid(p) for p in
                                 polygonize(members[i] for i, role in rings if i in members and role == "inner")
                                 if p.intersects(self.clip)])
            footprint = transform(outer.difference(inner), self.project, interleaved=False)
            self.exclusions.append((footprint, 100, f"relation/{ref}"))


class Safety:
    def __init__(self, extract, area, tile):
        self.area = area
        self.tile = tile
        # Round buffers slightly outward to account for line-segment arcs and coordinate rounding.
        self.blocked = [(geometry.buffer(radius + 0.015, quad_segs=64), ref)
                        for geometry, radius, ref in extract.exclusions]
        self.index = STRtree([geometry for geometry, _ in self.blocked])

    def allows(self, point):
        return self.area.covers(point) and len(self.index.query(point, predicate="intersects")) == 0


@dataclass(frozen=True)
class Candidate:
    lat: float
    lng: float
    scene: str
    ref: str
    tags: dict


def coordinates(point, unproject):
    lng, lat = unproject(point.x, point.y)
    return round(lat, 7), round(lng, 7)


def line_points(line):
    for offset in range(0, int(line.length) + 1, STEP):
        yield offset, line.interpolate(offset)


def area_points(area):
    if area.is_empty:
        return
    min_x, min_y, max_x, max_y = area.bounds
    for x in range(math.ceil(min_x / STEP) * STEP, math.floor(max_x) + 1, STEP):
        for y in range(math.ceil(min_y / STEP) * STEP, math.floor(max_y) + 1, STEP):
            point = Point(x, y)
            if area.contains(point):
                yield f"{x},{y}m", point


def collect(extract, safety, project, unproject):
    areas = sorted(extract.areas, key=lambda area: (area[0].area, area[1]))
    area_index = STRtree([area[0] for area in areas])
    water = STRtree(extract.water)
    candidates = {}

    def add(point, scene, ref, tags):
        lat, lng = coordinates(point, unproject)
        if safety.tile.covers(Point(lng, lat)) and safety.allows(Point(*project(lng, lat))):
            candidates[ref] = Candidate(lat, lng, scene, ref, tags)

    for point, ref, tags in extract.art:
        add(point, "publicArt", f"osm:{ref};publicArt", tags)

    for geometry, ref, tags, scene in areas:
        if scene == "square":
            for offset, point in area_points(geometry.intersection(safety.area)):
                add(point, scene, f"osm:{ref}@{offset};square", tags)

    for path, ref, tags in extract.paths:
        highway = tags["highway"]
        for offset, point in line_points(path):
            if not safety.area.covers(point):
                continue
            places = [areas[i] for i in sorted(area_index.query(point, predicate="within"))]
            if highway != "path" and (
                waterfront_path(tags) or any(p[3] in ("park", "waterfront") for p in places)
            ) and len(water.query(point, predicate="dwithin", distance=50)):
                owner = next((p for p in places if p[3] in ("waterfront", "park")), None)
                label = tags if waterfront_path(tags) or owner is None else owner[2]
                suffix = f"/{owner[1]}" if owner else ""
                add(point, "waterfront", f"osm:{ref}@{offset}m;waterfront{suffix}", label)
            for owner_scene in ("garden", "square", "park"):
                if owner_scene == "garden" and highway != "footway":
                    continue
                if owner_scene == "square" and highway == "path":
                    continue
                owner = next((p for p in places if p[3] == owner_scene), None)
                if owner:
                    add(point, owner_scene, f"osm:{ref}@{offset}m;{owner_scene}/{owner[1]}", owner[2])
    priority = {scene: index for index, scene in enumerate(SCENES)}
    return sorted(candidates.values(), key=lambda c: (priority[c.scene], c.ref))


def distance(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2
    h += math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * EARTH_RADIUS * math.asin(math.sqrt(min(1, h)))


def spaced(candidates, existing, spacing, project):
    buckets = defaultdict(list)

    def bucket(coord):
        lat, lng = coord
        x, y = project(lng, lat)
        return math.floor(x / (spacing + 1)), math.floor(y / (spacing + 1))

    for coord in existing:
        buckets[bucket(coord)].append(coord)
    selected = []
    max_gap = 0.0
    for c in candidates:
        coord = (c.lat, c.lng)
        bx, by = bucket(coord)
        nearby = (p for x in range(bx - 1, bx + 2) for y in range(by - 1, by + 2)
                  for p in buckets[x, y])
        gap = min((distance(coord, p) for p in nearby), default=math.inf)
        if gap >= spacing:
            selected.append(c)
            buckets[bx, by].append(coord)
        else:
            max_gap = max(max_gap, gap)
    return selected, round(max_gap, 2)


def is_chinese(name):
    scripts = [unicodedata.name(c, "") for c in name if c.isalpha()]
    return bool(scripts) and all(s.startswith("CJK UNIFIED IDEOGRAPH") or
                                 s.startswith("CJK COMPATIBILITY IDEOGRAPH") for s in scripts)


def is_latin(name):
    scripts = [unicodedata.name(c, "") for c in name if c.isalpha()]
    return bool(scripts) and all(s.startswith("LATIN ") for s in scripts)


def names(c, city, converter):
    tags = c.tags
    generic_zh, generic_en, _ = SCENES[c.scene]
    zh = next((tags[k].strip() for k in ("name:zh-Hant", "name:zh-TW", "name:zh-HK", "name", "name:zh")
               if k in tags and is_chinese(tags[k])), None)
    en = tags.get("name:en", "").strip() or (tags.get("name:pt", "").strip() if city == "Macau" else "")
    if not en and is_latin(tags.get("name", "")):
        en = tags["name"].strip()
    converted = converter.convert(zh) if zh else None
    audit = {}
    if zh and converted != zh:
        audit["converted"] = [zh, converted]
    if not zh:
        audit["generic_zh"] = generic_zh
    if not en:
        audit["generic_en"] = generic_en
    return converted or generic_zh, en or generic_en, audit


def metrics(coord, posts, spots):
    distances = [distance(coord, p) for p in posts]
    return [round(min(distances), 1), *(sum(d <= r for d in distances) for r in (300, 500, 600, 5000)),
            sum(distance(coord, p) <= 100 for p in spots)]


def snap_samples(city, extract, safety, project, unproject):
    # Snap to mapped public walkways in the city and tile, independently of the seed buffers.
    paths = [(path.intersection(safety.area), ref) for path, ref, _ in extract.paths]
    paths = [(path, ref) for path, ref in paths if not path.is_empty]
    index = STRtree([path for path, _ in paths])
    for sample, lat, lng in SAMPLES[city]:
        original = Point(*project(lng, lat))
        path, ref = paths[index.nearest(original)]
        snapped = nearest_points(original, path)[1]
        coord = coordinates(snapped, unproject)
        blockers = [(radius, ref) for geometry, radius, ref in extract.exclusions
                    if geometry.distance(snapped) <= radius]
        yield {
            "sample": sample, "snapped": coord, "walkway": ref,
            "snap_m": round(original.distance(snapped), 1),
            "blocked_at_sample": sorted(set(blockers)),
        }


def waypost_order(candidates, samples, anchors):
    """Try safe paths nearest the published targets before filling the rest of the area."""
    preferred = {}
    taken = list(anchors)
    for sample, radius in zip(samples, (300, 300, 600, 600, 250)):
        origin = sample["snapped"]
        if any(distance(origin, p) <= radius for p in taken):
            continue
        for c in sorted(candidates, key=lambda c: distance(origin, (c.lat, c.lng))):
            point = (c.lat, c.lng)
            if distance(origin, point) > radius:
                break
            if all(distance(point, p) >= 250 for p in taken):
                preferred[c.ref] = c
                taken.append(point)
                break
    centre_order = sorted(candidates, key=lambda c: min(
        distance(s["snapped"], (c.lat, c.lng)) for s in samples[:2]
    ))
    for c in centre_order:
        if any(distance(s["snapped"], (c.lat, c.lng)) <= 500 for s in samples[:2]):
            preferred.setdefault(c.ref, c)
        else:
            break
    return list(preferred.values()) + [c for c in candidates if c.ref not in preferred]


def density(samples, candidates, before, posts, spots):
    post_coords = before["wayposts"] + [(p.lat, p.lng) for p in posts]
    spot_coords = before["spots"] + [(p.lat, p.lng) for p in spots]
    report = []
    for sample in samples:
        coord = sample["snapped"]
        local = [(c.lat, c.lng) for c in candidates if distance(coord, (c.lat, c.lng)) <= 600]
        spacing_eligible = [p for p in local if all(distance(p, old) >= 250 for old in before["wayposts"])]
        report.append({
            **sample, "before": metrics(coord, before["wayposts"], before["spots"]),
            "after": metrics(coord, post_coords, spot_coords),
            "nearest_eligible_m": round(min(distance(coord, (c.lat, c.lng)) for c in candidates), 1),
            "spaced_candidates_at_target": [sum(distance(coord, p) <= r for p in spacing_eligible)
                                            for r in (250, 300, 500, 600)],
        })
    return report


def prepare(city, source, before, tiles):
    region = REGIONS[city]
    lng, lat = region.centre
    tile = next(t for t in tiles.geoms if t.covers(Point(lng, lat)))
    crs = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lng} +R={EARTH_RADIUS}")
    project = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
    unproject = Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform
    extract = Extract(box(*tile.bounds).buffer(0.003), project, region.boundary)
    extract.apply_file(source["path"], locations=True, filters=[osmium.filter.KeyFilter(*SOURCE_KEYS)])
    extract.block_other_relations(source["path"])
    if extract.boundary is None:
        raise ValueError(f"Missing city boundary {region.boundary} for {city}")
    if city == "Hong Kong" and not extract.campus_found:
        raise ValueError("Missing HKUST campus boundary")
    projected_tile = transform(tile, project, interleaved=False)
    safety = Safety(extract, projected_tile.intersection(extract.boundary), tile)

    candidates = collect(extract, safety, project, unproject)
    samples = list(snap_samples(city, extract, safety, project, unproject))
    posts, post_gap = spaced(waypost_order(candidates, samples, before["wayposts"]),
                             before["wayposts"], 250, project)
    spots, spot_gap = spaced(candidates, before["spots"], 150, project)
    print(f"{city}: {len(posts)} new Wayposts and {len(spots)} new spots", flush=True)
    if len(posts) > 1000 or len(spots) > 3000:
        raise SystemExit(f"Guardrail tripped in {city}. No SQL was generated.")
    assert all(safety.allows(Point(*project(c.lng, c.lat))) and tile.covers(Point(c.lng, c.lat))
               for c in posts + spots)
    report = {
        "safe_samples": len(candidates), "max_waypost_gap_m": post_gap, "max_spot_gap_m": spot_gap,
        "wayposts_by_scene": Counter(p.scene for p in posts),
        "spots_by_scene": Counter(p.scene for p in spots),
        "density": density(samples, candidates, before, posts, spots),
    }
    return posts, spots, report


def insert(table, columns, rows, conflict):
    def sql(value):
        if isinstance(value, str):
            return "'" + value.replace("'", "''") + "'"
        if isinstance(value, bool):
            return str(value).lower()
        return f"{value:.7f}"

    if not rows:
        return ""
    values = ",\n".join("(" + ",".join(map(sql, row)) + ")" for row in rows)
    return f"insert into public.{table} ({columns}) values\n{values}\non conflict {conflict} do nothing;\n"


def write_region(output, city, source, posts, spots, report):
    region = REGIONS[city]
    converter = OpenCC("s2t")
    labels = []
    post_rows = []
    for c in posts:
        zh, en, audit = names(c, city, converter)
        if audit:
            labels.append({"source_ref": c.ref, "lat": c.lat, "lng": c.lng, **audit})
        post_rows.append((zh, en, region.zh, city, c.lat, c.lng, True, False, c.ref, c.scene))
    spot_rows = [(city, region.timezone, c.lat, c.lng, SCENES[c.scene][2], c.ref) for c in spots]
    with open(source["path"], "rb") as file:
        digest = hashlib.file_digest(file, "sha256").hexdigest()
    with osmium.io.Reader(source["path"]) as reader:
        date = reader.header().get("osmosis_replication_timestamp")
    header = (
        f"-- {city} Wayposts and Corrupted Capsule spots within the existing map footprint.\n"
        "-- OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright).\n"
        f"-- Geofabrik extract: {source['url']}\n-- Data through {date}; SHA-256 {digest}\n"
        "-- Generated by scripts/seed-game-public-paths.py with the live points as spacing anchors.\n"
    )
    post_sql = insert(
        "public_capsule_spots", "name_zh,name_en,city_zh,city_en,lat,lng,game_enabled,public_drop,source_ref,scene",
        post_rows, "(source_ref) where source_ref is not null",
    )
    spot_sql = insert("corrupted_spots", "city,timezone,lat,lng,habitat,source_ref", spot_rows, "(source_ref)")
    (output / f"{region.slug}.sql").write_text(header + post_sql + spot_sql, encoding="utf-8")
    report["name_audit"] = labels
    report["source"] = {"url": source["url"], "date": date, "sha256": digest}
    (output / f"{region.slug}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("extracts", type=Path)
    parser.add_argument("live_points", type=Path)
    parser.add_argument("tile_geometry", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--city", choices=REGIONS)
    args = parser.parse_args()
    sources = json.loads(args.extracts.read_text())
    live = json.loads(args.live_points.read_text())
    tiles = shape(json.loads(args.tile_geometry.read_text()))
    cities = [args.city] if args.city else REGIONS
    prepared = {city: prepare(city, sources[city], live[city], tiles) for city in cities}
    for city, result in prepared.items():
        write_region(args.output, city, sources[city], *result)


if __name__ == "__main__":
    main()
