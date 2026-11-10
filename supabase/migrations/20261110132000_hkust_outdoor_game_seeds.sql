-- Roy-approved HKUST outdoor pilot. The campus is open to visitors, but only
-- public outdoor paths are seeded: HKUST Piazza, LG7 Lawn, Fong Shu Chuen
-- Promenade and its seafront pedestrian area. No building, hall, staff quarter,
-- lab, sports facility or car park.
-- OSM API 0.6 extract on 2026-11-10, SHA256
-- ea1f655d5d71f7235304e059a91d387a09f16dcb402d42bfaf7df5ca4b484f9c (ODbL).
-- Every point is interpolated on its source_ref footway/pedestrian way, at least
-- 20 m from a motor road, outside buildings and car parks, and at least 100 m
-- from mapped places of worship. Capsule spots are at least 28 m apart.
begin;

insert into public.sea_shores
  (name_zh,name_en,city_zh,city_en,lat,lng,game_enabled,source_ref,scene)
values
  ('科大廣場南','HKUST Piazza South','香港','Hong Kong',22.3371294,114.2632712,true,'osm:way/235913807@0m;hkust-outdoor','square'),
  ('科大廣場東','HKUST Piazza East','香港','Hong Kong',22.3374457,114.2634294,true,'osm:way/235913807@40m;hkust-outdoor','square'),
  ('科大廣場北','HKUST Piazza North','香港','Hong Kong',22.3378184,114.2632018,true,'osm:way/235913807@90m;hkust-outdoor','square'),
  ('LG7草坪南','LG7 Lawn South','香港','Hong Kong',22.3379023,114.2642429,true,'osm:way/240091530@30m;hkust-outdoor','garden'),
  ('LG7草坪北','LG7 Lawn North','香港','Hong Kong',22.3390094,114.2641215,true,'osm:way/240091530@160m;hkust-outdoor','garden'),
  ('方樹泉廊','Fong Shu Chuen Promenade','香港','Hong Kong',22.3374312,114.2660457,true,'osm:way/236145960@20m;hkust-outdoor','waterfront')
on conflict (source_ref) where source_ref is not null do nothing;

insert into public.corrupted_spots
  (city,timezone,lat,lng,habitat,source_ref)
values
  ('Hong Kong','Asia/Hong_Kong',22.3371294,114.2632712,'square','osm:way/235913807@0m;hkust-outdoor'),
  ('Hong Kong','Asia/Hong_Kong',22.3373567,114.2634186,'square','osm:way/235913807@30m;hkust-outdoor'),
  ('Hong Kong','Asia/Hong_Kong',22.3376207,114.2633923,'square','osm:way/235913807@60m;hkust-outdoor'),
  ('Hong Kong','Asia/Hong_Kong',22.3378184,114.2632018,'square','osm:way/235913807@90m;hkust-outdoor'),
  ('Hong Kong','Asia/Hong_Kong',22.3376513,114.2641656,'park','osm:way/240091530@0m;hkust-outdoor'),
  ('Hong Kong','Asia/Hong_Kong',22.3379023,114.2642429,'park','osm:way/240091530@30m;hkust-outdoor'),
  ('Hong Kong','Asia/Hong_Kong',22.3384884,114.2642401,'park','osm:way/240091530@100m;hkust-outdoor'),
  ('Hong Kong','Asia/Hong_Kong',22.3388339,114.2641621,'park','osm:way/240091530@140m;hkust-outdoor'),
  ('Hong Kong','Asia/Hong_Kong',22.3390965,114.2641011,'park','osm:way/240091530@170m;hkust-outdoor'),
  ('Hong Kong','Asia/Hong_Kong',22.3374312,114.2660457,'water','osm:way/236145960@20m;hkust-outdoor'),
  ('Hong Kong','Asia/Hong_Kong',22.3370113,114.2669922,'water','osm:way/239222429@20m;hkust-outdoor')
on conflict (source_ref) do nothing;

do $$ begin
  if (select count(*) from public.sea_shores where game_enabled and kind='common'
      and source_ref like '%;hkust-outdoor')<>6 then
    raise exception 'HKUST outdoor Waypost seed incomplete';
  end if;
  if (select count(*) from public.corrupted_spots
      where source_ref like '%;hkust-outdoor' and city='Hong Kong'
        and timezone='Asia/Hong_Kong')<>11 then
    raise exception 'HKUST outdoor capsule seed incomplete';
  end if;
end $$;

commit;
