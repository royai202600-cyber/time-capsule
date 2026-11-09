"""Generate dense game seeds from local OSM API 0.6 extracts; requires Shapely.
Usage: python seed-game-public-paths.py /tmp/tc-osm /tmp/game-path-seed.sql
Extracts: taipei{,-west,-east}, daan, singapore{,-gardens,-fort}, macau{,-north}.
Only footways inside public park/square polygons qualify. Religious, school,
hospital, restricted/private and hazardous areas have a 100 m exclusion buffer;
motor roads have a 20 m exclusion. A maximal spaced sample covers qualifying
path samples within 150 m for spots and 250 m for Wayposts. No road grid points.
Source: https://api.openstreetmap.org/api/0.6/map, OSM contributors, ODbL, 2026-11-09.
"""
import sys, math, json, hashlib, argparse, xml.etree.ElementTree as ET
from pathlib import Path
from shapely.geometry import Point, Polygon, LineString
from shapely.ops import unary_union, polygonize
args=argparse.ArgumentParser()
args.add_argument('prefix');args.add_argument('out');args.add_argument('--city')
options=args.parse_args();prefix,out=options.prefix,options.out
cities={'Taipei':(['taipei','taipei-west','taipei-east','daan','taipei-peace','taipei-riverside'],25.04,'台北','Asia/Taipei'),
'Singapore':(['singapore','singapore-gardens','singapore-fort','singapore-botanic','singapore-kallang'],1.29,'新加坡','Asia/Singapore'),
'Macau':(['macau','macau-north','macau-taipa'],22.2,'澳門','Asia/Macau'),
'Hong Kong':(['hong-kong-kowloon','hong-kong-west','hong-kong-waterfront'],22.3,'香港','Asia/Hong_Kong')}
if options.city:
 cities={options.city:cities[options.city]}
else:
 cities={k:v for k,v in cities.items() if k!='Hong Kong'}
posts=[];spots=[];report={}
for city,(files,lat0,zh,tz) in cities.items():
 nodes={}; ways={}; relations={}
 for f in files:
  root=ET.parse(prefix+'-'+f+'.xml').getroot()
  for e in root:
   if e.tag=='node': nodes[e.get('id')]=e
   elif e.tag=='way': ways[e.get('id')]=e
   elif e.tag=='relation': relations[e.get('id')]=e
 sx=111320*math.cos(math.radians(lat0));sy=111320
 def tags(e):return {t.get('k'):t.get('v') for t in e.findall('tag')}
 def xy(e):return (float(e.get('lon'))*sx,float(e.get('lat'))*sy)
 def geom(e):
  if e.tag=='node':return Point(xy(e))
  if e.tag=='relation':
   rings=[];holes=[]
   for m in e.findall('member'):
    if m.get('type')!='way' or m.get('ref') not in ways:continue
    pts=[xy(nodes[n.get('ref')]) for n in ways[m.get('ref')].findall('nd') if n.get('ref') in nodes]
    if len(pts)>1:(holes if m.get('role')=='inner' else rings).append(LineString(pts))
   return unary_union([p.buffer(0) for p in polygonize(rings)]).difference(unary_union([p.buffer(0) for p in polygonize(holes)]))
  pts=[xy(nodes[n.get('ref')]) for n in e.findall('nd') if n.get('ref') in nodes]
  if len(pts)<2:return None
  if len(pts)>=4 and pts[0]==pts[-1]:return Polygon(pts).buffer(0)
  return LineString(pts)
 safe=[];excluded=[];roads=[];paths=[]
 for e in list(nodes.values())+list(ways.values())+list(relations.values()):
  t=tags(e)
  if not t:continue
  dangerous=(t.get('amenity') in ('school','kindergarten','college','university','hospital','clinic','place_of_worship','grave_yard') or t.get('landuse') in ('religious','cemetery','military','industrial') or t.get('access') in ('private','no','customers','permit') or t.get('religion') or t.get('hazard') or t.get('military'))
  if not (dangerous or t.get('highway') or t.get('leisure')=='park' or t.get('place')=='square'):continue
  g=geom(e)
  if g is None or g.is_empty:continue
  if dangerous:excluded.append(g.buffer(100));continue
  if t.get('highway') and t['highway'] not in ('footway','path','pedestrian','steps','cycleway','bridleway'):
   roads.append(g.buffer(20));continue
  if g.geom_type in ('Polygon','MultiPolygon') and (t.get('leisure')=='park' or t.get('place')=='square') and t.get('fee')!='yes':
   safe.append((g,t.get('name:en') or t.get('name') or 'Public park',e.tag+'/'+e.get('id')))
  if e.tag=='way' and t.get('highway') in ('footway','path','pedestrian') and t.get('foot')!='no':paths.append((g.boundary if g.geom_type=='Polygon' else g,e.get('id')))
 blocked=unary_union(excluded+roads); allowed=unary_union([p[0] for p in safe]).difference(blocked)
 candidates=[]
 for path,pid in sorted(paths,key=lambda x:int(x[1])):
  for d in range(0,int(path.length)+1,25):
   point=path.interpolate(d)
   if not allowed.contains(point):continue
   park=next((p for p in safe if p[0].contains(point)),None)
   if park:candidates.append((point,pid,d,park[1],park[2]))
 def sample(spacing):
  selected=[]
  for c in candidates:
   if all(c[0].distance(p[0])>=spacing for p in selected):selected.append(c)
  return selected
 ps=sample(250);ss=sample(150)
 tile=json.loads(Path("docs/design/public-sea-cities.geojson").read_text())
 tile_area=unary_union([Polygon(p[0]) for p in tile["coordinates"]])
 for point,*_ in ps+ss:
  assert tile_area.covers(Point(point.x/sx,point.y/sy)), "outside existing map tiles"
  assert allowed.contains(point), "unsafe point"
 for spacing,selected in ((250,ps),(150,ss)):
  assert all(min(c[0].distance(p[0]) for p in selected)<spacing for c in candidates)
 def row(c,kind):
  p,pid,d,name,park=c
  return (city,zh,tz,round(p.y/sy,7),round(p.x/sx,7),name,f'osm:way/{pid}@{d}m;park/{park}')
 posts += [row(c,'post') for c in ps];spots += [row(c,'spot') for c in ss]
 report[city]={'safe_path_samples':len(candidates),'new_wayposts':len(ps),'new_spots':len(ss),'max_waypost_gap_m':round(max((min(c[0].distance(p[0]) for p in ps) for c in candidates),default=0),1),'max_spot_gap_m':round(max((min(c[0].distance(p[0]) for p in ss) for c in candidates),default=0),1)}
q=lambda x:"'"+str(x).replace("'","''")+"'"
sql='-- Dense public park-path seed. OSM API extracts, 2026-11-09; ODbL.\n-- Reproduce with scripts/seed-game-public-paths.py; source_ref records path, offset and park.\n'
for files,*_ in cities.values():
 for f in files:
  fp=Path(prefix+'-'+f+'.xml')
  sql+='-- extract '+fp.name+' SHA256 '+hashlib.sha256(fp.read_bytes()).hexdigest()+'\n'
sql+='insert into public.sea_shores(name_zh,name_en,city_zh,city_en,lat,lng,game_enabled,source_ref,scene) values\n'
sql+=',\n'.join('('+','.join([q(name),q(name),q(zh),q(city),str(lat),str(lng),'true',q(ref),q('park')])+')' for city,zh,tz,lat,lng,name,ref in posts)+'\non conflict (source_ref) where source_ref is not null do nothing;\n'
sql+='insert into public.corrupted_spots(city,timezone,lat,lng,habitat,source_ref) values\n'
sql+=',\n'.join('('+','.join([q(city),q(tz),str(lat),str(lng),q('park'),q(ref)])+')' for city,zh,tz,lat,lng,name,ref in spots)+'\non conflict(source_ref) do nothing;\n'
Path(out).write_text(sql);print(json.dumps(report,indent=2))
