-- R1 Wayposts, city borders and Corrupted Capsule spots. Apply with the app flag off.
begin;

create extension if not exists postgis with schema extensions;
alter table private.game_regions add column border extensions.geometry(MultiPolygon, 4326);

-- OpenStreetMap contributors (ODbL), retrieved via Nominatim on 2026-11-23
-- (Asia/Taipei). Relation IDs: Taipei 1293250, Hong Kong 913110, Macau
-- 1867188, Singapore 536780. Each outline was clipped to game_map_coverage
-- and simplified with 10 m tolerance in its local UTM zone, preserving topology.
-- The intersection below applies the stored coverage rectangle to the final data.
with outlines(region, geojson) as (values
  ('taipei', $geojson${"type":"MultiPolygon","coordinates":[
    [[
      [121.5367794000000,24.9890008000000],[121.5370285892465,24.9884930000000],[121.6020150067055,24.9884930000000],[121.6017437000000,24.9891602000000],
      [121.6019517000000,24.9903742000000],[121.5998552000000,24.9911023000000],[121.5990722000000,24.9916739000000],[121.5994045000000,24.9929549000000],
      [121.5985377000000,24.9935219000000],[121.5981397000000,24.9945419000000],[121.5988023000000,24.9959470000000],[121.5995759000000,24.9963750000000],
      [121.5996909000000,24.9976115000000],[121.6005515000000,24.9984290000000],[121.6005451000000,25.0007472000000],[121.6004145000000,25.0011868000000],
      [121.5994407000000,25.0028298000000],[121.5977041000000,25.0042839000000],[121.5971498000000,25.0045622000000],[121.5966210000000,25.0045111000000],
      [121.5961982000000,25.0042942000000],[121.5959038000000,25.0045087000000],[121.5959194000000,25.0065783000000],[121.5956331000000,25.0070623000000],
      [121.5958697000000,25.0092153000000],[121.5963417000000,25.0105449000000],[121.5964182000000,25.0117008000000],[121.5966591000000,25.0123076000000],
      [121.5972752000000,25.0127847000000],[121.5975884000000,25.0133673000000],[121.5972335000000,25.0143871000000],[121.5975712000000,25.0148140000000],
      [121.5989608000000,25.0147778000000],[121.5999229000000,25.0149662000000],[121.6006850000000,25.0147962000000],[121.6014374000000,25.0151762000000],
      [121.6023054000000,25.0149976000000],[121.6027028000000,25.0151646000000],[121.6029181000000,25.0155721000000],[121.6030657000000,25.0168696000000],
      [121.6041559000000,25.0191056000000],[121.6081942000000,25.0194263000000],[121.6087318000000,25.0205524000000],[121.6092533000000,25.0209555000000],
      [121.6097045000000,25.0203183000000],[121.6101873000000,25.0199343000000],[121.6113646000000,25.0198738000000],[121.6120970000000,25.0195309000000],
      [121.6127323000000,25.0196219000000],[121.6130412000000,25.0192586000000],[121.6134167000000,25.0191177000000],[121.6158058109504,25.0196565024001],
      [121.6158058109504,25.0844800000000],[121.5628745000000,25.0844800000000],[121.5099431890496,25.0844800000000],[121.5099431890496,25.0215849692724],
      [121.5105516000000,25.0218104000000],[121.5128927000000,25.0217157000000],[121.5142649000000,25.0215119000000],[121.5155541000000,25.0212315000000],
      [121.5190794000000,25.0197808000000],[121.5210712000000,25.0182553000000],[121.5258042000000,25.0116805000000],[121.5271964000000,25.0107238000000],
      [121.5283945000000,25.0101575000000],[121.5300914000000,25.0098877000000],[121.5314287000000,25.0092561000000],[121.5317699000000,25.0088975000000],
      [121.5323706000000,25.0078221000000],[121.5325098000000,25.0062801000000],[121.5336787000000,25.0038007000000],[121.5342222000000,25.0031352000000],
      [121.5313733000000,25.0010125000000],[121.5305560000000,24.9979126000000],[121.5316543000000,24.9947062000000],[121.5317944000000,24.9933064000000],
      [121.5313792000000,24.9925629000000],[121.5317434000000,24.9916441000000],[121.5317011000000,24.9905022000000],[121.5331757000000,24.9918623000000],
      [121.5341045000000,24.9929415000000],[121.5349599000000,24.9950329000000],[121.5352376000000,24.9951224000000],[121.5362299000000,24.9941215000000],
      [121.5368734000000,24.9927672000000],[121.5371425000000,24.9917834000000],[121.5365780000000,24.9897256000000],[121.5367794000000,24.9890008000000]
    ]]
  ]}$geojson$),
  ('hong-kong', $geojson${"type":"MultiPolygon","coordinates":[
    [[
      [114.2800000000000,22.2508370000000],[114.2800000000000,22.3500000000000],[114.1059188341406,22.3500000000000],[114.1059188341406,22.2508370000000],
      [114.2800000000000,22.2508370000000]
    ]]
  ]}$geojson$),
  ('macau', $geojson${"type":"MultiPolygon","coordinates":[
    [[
      [113.5495556000000,22.1453611000000],[113.5494159651799,22.1420880000000],[113.6033472471032,22.1420880000000],[113.6033472471032,22.2041065202120],
      [113.5710556000000,22.2040278000000],[113.5689722000000,22.2090833000000],[113.5622778000000,22.2122222000000],[113.5520278000000,22.2160000000000],
      [113.5516156000000,22.2157881000000],[113.5507591000000,22.2161037000000],[113.5508472000000,22.2170361000000],[113.5500028000000,22.2169333000000],
      [113.5492000000000,22.2166139000000],[113.5483361000000,22.2167333000000],[113.5476278000000,22.2165583000000],[113.5470389000000,22.2167806000000],
      [113.5443556000000,22.2169528000000],[113.5433917000000,22.2163139000000],[113.5424083000000,22.2142861000000],[113.5417167000000,22.2132333000000],
      [113.5415333000000,22.2133250000000],[113.5413306000000,22.2130861000000],[113.5409000000000,22.2130333000000],[113.5381417000000,22.2136417000000],
      [113.5349444000000,22.2135250000000],[113.5330833000000,22.2123056000000],[113.5346528000000,22.2073667000000],[113.5353889000000,22.2066944000000],
      [113.5356389000000,22.2023056000000],[113.5336111000000,22.1945000000000],[113.5292222000000,22.1885278000000],[113.5301944000000,22.1879167000000],
      [113.5291667000000,22.1865556000000],[113.5283611000000,22.1845000000000],[113.5281667000000,22.1821667000000],[113.5294167000000,22.1770000000000],
      [113.5319722000000,22.1733056000000],[113.5321389000000,22.1720833000000],[113.5395278000000,22.1570000000000],[113.5452500000000,22.1507778000000],
      [113.5495556000000,22.1453611000000]
    ]],
    [[
      [113.5449743000000,22.1429504000000],[113.5450213941786,22.1420880000000],[113.5456240273568,22.1420880000000],[113.5455554000000,22.1433440000000],
      [113.5464605000000,22.1432832000000],[113.5466122000000,22.1430445000000],[113.5465883000000,22.1423993000000],[113.5467490000000,22.1423949000000],
      [113.5467397000000,22.1431390000000],[113.5463783000000,22.1434726000000],[113.5450695000000,22.1434229000000],[113.5449017000000,22.1431423000000],
      [113.5449743000000,22.1429504000000]
    ]]
  ]}$geojson$),
  ('singapore', $geojson${"type":"MultiPolygon","coordinates":[
    [[
      [103.8064736467977,1.2352710000000],[103.9055243532023,1.2352710000000],[103.9055243532023,1.3377780000000],[103.8064736467977,1.3377780000000],
      [103.8064736467977,1.2352710000000]
    ]]
  ]}$geojson$)
)
update private.game_regions r
set border = extensions.st_forcepolygonccw(extensions.st_multi(extensions.st_collectionextract(
  extensions.st_intersection(
    extensions.st_setsrid(extensions.st_geomfromgeojson(o.geojson), 4326),
    extensions.st_makeenvelope(c.west, c.south, c.east, c.north, 4326)
  ), 3)))
from outlines o, private.game_map_coverage c
where r.id = o.region and c.id = r.coverage_id;


comment on column private.game_regions.border is
  'OSM relations 1293250, 913110, 1867188, 536780 as retrieved 2026-11-23 (Asia/Taipei), clipped to map coverage and simplified at 10 m.';

create function private.admin_inside_border(p_region text, p_lat double precision, p_lng double precision)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from private.game_regions r where r.id = p_region
      and p_lat between -90 and 90 and p_lng between -180 and 180
      and extensions.st_covers(r.border, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326))
  );
$$;

-- Quadratic cube projection and face-oriented Hilbert traversal as in
-- s2-geometry@1.2.10. The browser key is "face/" followed by 17 digits.
create function private.s2_cell17(p_lat double precision, p_lng double precision)
returns text language plpgsql immutable strict set search_path = '' as $$
declare
  deg_to_rad constant double precision := pi() / 180;
  x double precision := cos(p_lng * deg_to_rad) * cos(p_lat * deg_to_rad);
  y double precision := sin(p_lng * deg_to_rad) * cos(p_lat * deg_to_rad);
  z double precision := sin(p_lat * deg_to_rad);
  face integer;
  u double precision;
  v double precision;
  i integer;
  j integer;
  bit integer;
  quadrant integer;
  orientation integer;
  digits constant text[] := array['0132', '2130', '2310', '0312'];
  next_orientation constant integer[][] := array[[4,1,2,1], [2,2,1,3], [3,4,3,2], [1,3,4,4]];
  key text;
begin
  if abs(x) > abs(y) and abs(x) > abs(z) then
    face := case when x < 0 then 3 else 0 end;
  elsif abs(y) >= abs(x) and abs(y) > abs(z) then
    face := case when y < 0 then 4 else 1 end;
  else
    face := case when z < 0 then 5 else 2 end;
  end if;

  case face
    when 0 then u := y / x; v := z / x;
    when 1 then u := -x / y; v := z / y;
    when 2 then u := -x / z; v := -y / z;
    when 3 then u := z / x; v := y / x;
    when 4 then u := z / y; v := -x / y;
    when 5 then u := -y / z; v := -x / z;
  end case;
  i := greatest(0, least(131071, floor(131072 *
    case when u >= 0 then 0.5 * sqrt(1 + 3*u) else 1 - 0.5 * sqrt(1 - 3*u) end)::integer));
  j := greatest(0, least(131071, floor(131072 *
    case when v >= 0 then 0.5 * sqrt(1 + 3*v) else 1 - 0.5 * sqrt(1 - 3*v) end)::integer));

  orientation := case when face % 2 = 1 then 4 else 1 end;
  key := face::text || '/';
  for bit in reverse 16..0 loop
    quadrant := 1 + (((i >> bit) & 1) * 2) + ((j >> bit) & 1);
    key := key || substr(digits[orientation], quadrant, 1);
    orientation := next_orientation[orientation][quadrant];
  end loop;
  return key;
end;
$$;

alter table public.public_capsule_spots
  add column photo text,
  add column photo_credit text,
  add column s2_cell17 text generated always as (
    case when game_enabled or hidden_at is not null or kind = 'landmark' then private.s2_cell17(lat, lng) end
  ) stored;

create index public_capsule_spots_live_s2_idx on public.public_capsule_spots (s2_cell17)
  where game_enabled and hidden_at is null;
create index waypost_spins_waypost_time_idx on public.waypost_spins (waypost_id, spun_at desc);

alter table public.corrupted_spots add column first_spawn_wave bigint;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('waypost-photos', 'waypost-photos', true, 2097152, array['image/jpeg', 'image/webp']);

create function private.can_edit_waypost_photo(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.admin_can('edit') and p_name ~
    '^[a-z0-9-]+/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|jpeg|webp)$'
    and exists (select 1 from private.game_regions where id = split_part(p_name, '/', 1) and border is not null);
$$;

-- SELECT allows Storage to look up the object for deletion. The public
-- download route can serve a known path without listing objects.
create policy waypost_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'waypost-photos' and private.can_edit_waypost_photo(name));
create policy waypost_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'waypost-photos' and private.can_edit_waypost_photo(name));
create policy waypost_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'waypost-photos' and private.can_edit_waypost_photo(name));

-- Keep the old check fields for the existing editor while its flag is off.
create or replace function public.admin_waypost_check(p_region text, p_lat double precision, p_lng double precision,
  p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  inside_border boolean;
  cell text;
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  inside_border := private.admin_inside_border(p_region, p_lat, p_lng);
  if p_lat between -90 and 90 and p_lng between -180 and 180 then
    cell := private.s2_cell17(p_lat, p_lng);
  end if;
  return jsonb_build_object(
    'inside_border', inside_border,
    'inside_coverage', inside_border,
    'nearest', private.admin_nearest_waypost(p_lat, p_lng, p_id),
    'same_cell', (select coalesce(jsonb_agg(to_jsonb(w) order by w.meters, w.id), '[]'::jsonb)
      from (select p.id, p.name_zh, p.name_en, public.distance_m(p_lat, p_lng, p.lat, p.lng) as meters
        from public.public_capsule_spots p where p.game_enabled and p.hidden_at is null
          and p.s2_cell17 = cell and p.id is distinct from p_id) w),
    'live_hunts', (select coalesce(jsonb_agg(to_jsonb(h) order by h.id), '[]'::jsonb)
      from private.admin_waypost_hunts(p_lat, p_lng, p_id) h));
end;
$$;

create or replace function private.save_admin_waypost(p_before public.public_capsule_spots,
  p_after public.public_capsule_spots, p_note text) returns public.public_capsule_spots
language plpgsql set search_path = '' as $$
declare
  region text;
  adding boolean := p_before.id is null;
  moved boolean := (p_before.lat, p_before.lng) is distinct from (p_after.lat, p_after.lng);
begin
  if adding or (p_before.name_zh, p_before.name_en) is distinct from (p_after.name_zh, p_after.name_en) then
    if nullif(btrim(p_after.name_zh), '') is null
      or p_after.name_zh !~ '[一-鿿㐀-䶿]' or p_after.name_zh ~ '[A-Za-z]'
    then raise exception 'bad_name'; end if;
  end if;
  if adding or p_before.scene is distinct from p_after.scene then
    if p_after.scene is null or p_after.scene not in ('park','garden','waterfront','square','publicArt')
    then raise exception 'bad_scene'; end if;
  end if;
  if adding or moved or p_before.photo is distinct from p_after.photo then
    select r.id into region from private.game_regions r where r.city = p_after.city_en;
  end if;
  if (adding or moved) and not private.admin_inside_border(region, p_after.lat, p_after.lng) then
    raise exception 'outside_border';
  end if;
  if p_after.photo is not null and (adding or p_before.photo is distinct from p_after.photo) then
    if not private.can_edit_waypost_photo(p_after.photo)
      or split_part(p_after.photo, '/', 1) is distinct from region
      or not exists (select 1 from storage.objects o where o.bucket_id = 'waypost-photos' and o.name = p_after.photo)
    then raise exception 'bad_photo'; end if;
  end if;

  if adding then
    insert into public.public_capsule_spots
      (id, name_zh, name_en, city_zh, city_en, lat, lng, scene, kind, game_enabled, public_drop, source_ref, photo, photo_credit)
    values (p_after.id, p_after.name_zh, p_after.name_en, p_after.city_zh, p_after.city_en,
      p_after.lat, p_after.lng, p_after.scene, p_after.kind, p_after.game_enabled,
      p_after.public_drop, p_after.source_ref, p_after.photo, p_after.photo_credit)
    returning * into p_after;
  else
    update public.public_capsule_spots p set lat = p_after.lat, lng = p_after.lng,
      name_zh = p_after.name_zh, name_en = p_after.name_en, scene = p_after.scene,
      game_enabled = p_after.game_enabled, hidden_at = p_after.hidden_at,
      photo = p_after.photo, photo_credit = p_after.photo_credit
    where p.id = p_before.id returning p.* into p_after;
  end if;
  return p_after;
end;
$$;

-- Recreate with trailing defaulted photo arguments. Keeping two defaulted
-- overloads would make existing named PostgREST calls ambiguous.
drop function public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text);
drop function public.admin_waypost_update(uuid,double precision,double precision,text,text,text,text);

create function public.admin_waypost_add(p_region text, p_lat double precision, p_lng double precision,
  p_name_zh text, p_name_en text, p_scene text, p_checked boolean default null, p_note text default null,
  p_photo text default null, p_photo_credit text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r private.game_regions;
  p public.public_capsule_spots;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  select * into r from private.game_regions g where g.id = p_region and g.border is not null for share;
  if not found then raise exception 'outside_border'; end if;
  p.id := gen_random_uuid();
  p.name_zh := btrim(p_name_zh); p.name_en := coalesce(btrim(p_name_en), '');
  p.city_zh := r.name_zh; p.city_en := r.city;
  p.lat := p_lat; p.lng := p_lng; p.scene := p_scene;
  p.kind := 'common'; p.game_enabled := true; p.public_drop := true;
  p.source_ref := 'admin:' || p.id;
  p.photo := nullif(btrim(p_photo), '');
  p.photo_credit := nullif(btrim(p_photo_credit), '');
  p := private.save_admin_waypost(null, p, p_note);
  perform private.admin_log('waypost.add', 'waypost', p.id::text, p.name_en, null, to_jsonb(p), p_note);
  return to_jsonb(p);
end;
$$;

create function public.admin_waypost_update(p_id uuid, p_lat double precision default null,
  p_lng double precision default null, p_name_zh text default null, p_name_en text default null,
  p_scene text default null, p_note text default null, p_photo text default null,
  p_photo_credit text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.public_capsule_spots;
  saved public.public_capsule_spots;
  action text;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  p := private.admin_waypost_row(p_id);
  saved := p;
  saved.lat := coalesce(p_lat, p.lat); saved.lng := coalesce(p_lng, p.lng);
  saved.name_zh := coalesce(btrim(p_name_zh), p.name_zh);
  saved.name_en := coalesce(btrim(p_name_en), p.name_en);
  saved.scene := coalesce(p_scene, p.scene);
  if p_photo is not null then saved.photo := nullif(btrim(p_photo), ''); end if;
  if p_photo_credit is not null then saved.photo_credit := nullif(btrim(p_photo_credit), ''); end if;
  action := case when (p.lat, p.lng) is distinct from (saved.lat, saved.lng) then 'waypost.move' else 'waypost.edit' end;
  saved := private.save_admin_waypost(p, saved, p_note);
  perform private.admin_log(action, 'waypost', p.id::text, saved.name_en, to_jsonb(p), to_jsonb(saved), p_note);
  return to_jsonb(saved);
end;
$$;

create function public.admin_spot_add(p_region text, p_lat double precision, p_lng double precision,
  p_habitat text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r private.game_regions;
  spot_id uuid := gen_random_uuid();
  saved public.corrupted_spots;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  select * into r from private.game_regions g where g.id = p_region and g.border is not null for share;
  if not private.admin_inside_border(r.id, p_lat, p_lng) then raise exception 'outside_border'; end if;
  if p_habitat is null or p_habitat not in ('park','water','square') then raise exception 'bad_habitat'; end if;
  insert into public.corrupted_spots (id, city, timezone, lat, lng, habitat, source_ref, first_spawn_wave)
    select spot_id, r.city, r.timezone, p_lat, p_lng, p_habitat, 'admin:' || spot_id, w.wave + 1
    from private.game_wave_at(clock_timestamp()) w returning * into strict saved;
  perform private.admin_log('spot.add', 'spot', saved.id::text, saved.city, null, to_jsonb(saved), p_note);
  return to_jsonb(saved);
end;
$$;

create function public.admin_spot_move(p_id uuid, p_lat double precision, p_lng double precision,
  p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.corrupted_spots;
  saved public.corrupted_spots;
  region text;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  select * into p from public.corrupted_spots s where s.id = p_id and s.source_ref not like 'qa:%' for update;
  if not found then raise exception 'not_found'; end if;
  select r.id into region from private.game_regions r where r.city = p.city;
  if not private.admin_inside_border(region, p_lat, p_lng) then raise exception 'outside_border'; end if;
  update public.corrupted_spots set lat = p_lat, lng = p_lng where id = p.id returning * into saved;
  perform private.admin_log('spot.move', 'spot', p.id::text, p.city, to_jsonb(p), to_jsonb(saved), p_note);
  return to_jsonb(saved);
end;
$$;

alter function public.admin_undo(bigint,text) rename to admin_undo_before_map_builder;
alter function public.admin_undo_before_map_builder(bigint,text) set schema private;

create function public.admin_undo(p_action_id bigint, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  event private.admin_actions;
  post public.public_capsule_spots;
  old_post public.public_capsule_spots;
  spot public.corrupted_spots;
  old_spot public.corrupted_spots;
  current_state jsonb;
  saved jsonb;
begin
  select * into event from private.admin_actions where id = p_action_id;
  if not coalesce(event.action in ('waypost.add','waypost.edit','waypost.move','waypost.hide','waypost.show',
    'spot.add','spot.move'), false)
  then return private.admin_undo_before_map_builder(p_action_id, p_note); end if;

  perform private.require_game_editor();
  perform private.lock_game_edits();
  if exists (select 1 from private.admin_actions a where a.target_type = event.target_type
      and a.target_id = event.target_id and a.id > event.id)
  then raise exception 'stale'; end if;

  if event.target_type = 'waypost' then
    post := private.admin_waypost_row(event.target_id::uuid);
    current_state := to_jsonb(post);
    -- Older logs have no photo keys or generated cell. Compare them against
    -- the same row shape while still refusing a later change or undo.
    if (case when event.after ? 's2_cell17' then current_state
        else current_state - array['s2_cell17','photo','photo_credit'] end) is distinct from event.after
    then raise exception 'stale'; end if;
    if event.action = 'waypost.add' then
      update public.public_capsule_spots set game_enabled = false, hidden_at = now()
        where id = post.id returning * into post;
    else
      -- Restore the recorded position even for legacy pins outside the new border.
      old_post := jsonb_populate_record(null::public.public_capsule_spots, event.before);
      update public.public_capsule_spots set lat = old_post.lat, lng = old_post.lng,
        name_zh = old_post.name_zh, name_en = old_post.name_en, scene = old_post.scene,
        game_enabled = old_post.game_enabled, hidden_at = old_post.hidden_at,
        photo = old_post.photo, photo_credit = old_post.photo_credit
      where id = post.id returning * into post;
    end if;
    saved := to_jsonb(post);
  else
    select * into spot from public.corrupted_spots where id = event.target_id::uuid for update;
    current_state := to_jsonb(spot);
    if current_state is distinct from event.after then raise exception 'stale'; end if;
    if event.action = 'spot.add' then
      update public.corrupted_spots set hidden_at = now() where id = spot.id returning * into spot;
    else
      old_spot := jsonb_populate_record(null::public.corrupted_spots, event.before);
      update public.corrupted_spots set lat = old_spot.lat, lng = old_spot.lng
        where id = spot.id returning * into spot;
    end if;
    saved := to_jsonb(spot);
  end if;
  perform private.admin_log('undo', event.target_type, event.target_id, event.target_label,
    current_state, saved || jsonb_build_object('undo_of', event.id), p_note);
  return saved;
end;
$$;

CREATE OR REPLACE FUNCTION private.resolve_spawn(p_spot uuid, p_wave bigint)
 RETURNS TABLE(spawn_id text, vessel text, rarity text, expires_at timestamp with time zone)

 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select resolved.spawn_id, resolved.vessel, resolved.rarity, resolved.expires_at
  from public.corrupted_spots p
  cross join private.game_wave_by_number(p_wave) w
  cross join lateral private.game_spawn_at(w.starts_at) r
  cross join private.game_secret key
  cross join lateral private.resolve_spawn_batch(array[p.id], p_wave, w.ends_at, r.config,
    private.game_spawn_pool(private.game_spawn_city_rules(r, p.city), p.habitat, w.starts_at at time zone p.timezone),
    key.secret) resolved
  where p.id = p_spot and p.hidden_at is null and key.singleton
    and (p.first_spawn_wave is null or p.first_spawn_wave <= w.wave)
    and case when p.source_ref ~ '^qa:roy-taipei-game:[0-9]+:[0-9]+$'
      then split_part(p.source_ref, ':', 3)::bigint = p_wave else true end;
$function$;

CREATE OR REPLACE FUNCTION private.admin_wave(p_city text)
 RETURNS TABLE(spot uuid, vessel text, rarity text, lat double precision, lng double precision, expires_at timestamp with time zone, caught boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with clock as materialized (
    select w.*, r.config, private.game_spawn_city_rules(r, p_city) rules, key.secret
    from private.game_wave_at(now()) w cross join lateral private.game_spawn_at(w.starts_at) r
    cross join private.game_secret key where key.singleton
  ), habitats as materialized (
    select p.timezone, p.habitat, array_agg(p.id) spots
    from clock w cross join public.corrupted_spots p
    where p.city = p_city and p.hidden_at is null
      and (p.first_spawn_wave is null or p.first_spawn_wave <= w.wave)
      and p.source_ref not like 'qa:roy-taipei-game:%'
    group by p.timezone, p.habitat
  )
  select p.id, s.vessel, s.rarity, p.lat, p.lng, s.expires_at, exists (
    select 1 from public.corrupted_catches c where c.spawn_id = s.spawn_id and c.result = 'caught'
  )
  from clock w cross join habitats h
  cross join lateral private.resolve_spawn_batch(h.spots, w.wave, w.ends_at, w.config,
    private.game_spawn_pool(w.rules, h.habitat, w.starts_at at time zone h.timezone), w.secret) s
  join public.corrupted_spots p on p.id = s.spot
  where s.expires_at > now();
$function$;

create or replace function private.quest_pin_pool(r private.quest_rules) returns private.game_spawn_pool
language plpgsql stable set search_path='' as $$
declare region private.game_regions;
declare habitat text;
declare wave record;
declare revision private.game_spawn_revisions;
declare pool private.game_spawn_pool;
begin
  select g.* into region from private.game_regions g
  join private.game_map_coverage b on b.id=g.coverage_id
  where g.city is not null and r.location_lat between b.south and b.north
    and r.location_lng between b.west and b.east
  order by public.distance_m(r.location_lat,r.location_lng,g.center_lat,g.center_lng),g.id
  limit 1;
  if not found then raise exception 'bad_rule'; end if;

  select * into wave from private.game_wave_at(now());

  -- A nearby public spot supplies the habitat. A pin without a mapped
  -- habitat can use the city's rules that do not require one.
  select s.habitat into habitat from public.corrupted_spots s
  where s.city=region.city and s.hidden_at is null and s.source_ref not like 'qa:%'
    and (s.first_spawn_wave is null or s.first_spawn_wave <= wave.wave)
    and s.lat between r.location_lat-0.01 and r.location_lat+0.01
    and public.distance_m(s.lat,s.lng,r.location_lat,r.location_lng) <=
      (select action_radius_m from private.game_config where singleton)
  order by public.distance_m(s.lat,s.lng,r.location_lat,r.location_lng),s.id limit 1;

  revision:=private.game_spawn_at(wave.starts_at);
  pool:=private.game_spawn_pool(private.game_spawn_city_rules(revision,region.city),
    habitat,wave.starts_at at time zone region.timezone);
  if num_nonnulls(pool.common,pool.uncommon,pool.rare)=0 then raise exception 'bad_rule'; end if;
  return pool;
end $$;

create or replace function private.quest_start_spawns(p_context text,p_id uuid,r private.quest_rules,p_run timestamptz,
  p_remaining int,p_end timestamptz)
returns void language plpgsql set search_path='' as $$
declare wave record;
declare revision private.game_spawn_revisions;
declare pool private.game_spawn_pool;
declare seed_ids uuid[];
begin
  select * into wave from private.game_wave_at(now());
  revision:=private.game_spawn_at(wave.starts_at);
  pool:=private.quest_pin_pool(r);
  -- Quests guarantee their requested releases. The resolver still uses the
  -- wave's rarity weights, city assignments, windows and vessel selection.
  revision.config.spawn_chance:=1;
  select array_agg(gen_random_uuid() order by n) into seed_ids from generate_series(1,p_remaining) n;
  insert into private.quest_spawns
    (id,quest_id,context,user_id,run_at,slot,expires_at,location_lat,location_lng,vessel,rarity)
  select chosen.spot,p_id,p_context,auth.uid(),p_run,array_position(seed_ids,chosen.spot),
    least(p_end,now()+interval '10 minutes'),r.location_lat,r.location_lng,chosen.vessel,chosen.rarity
  from private.game_secret key
  cross join lateral private.resolve_spawn_batch(seed_ids,wave.wave,wave.ends_at,revision.config,pool,key.secret) chosen
  where key.singleton
  on conflict(context,quest_id,user_id,slot) do update set
    id=excluded.id,run_at=excluded.run_at,expires_at=excluded.expires_at,
    vessel=excluded.vessel,rarity=excluded.rarity
  where quest_spawns.run_at<>excluded.run_at or quest_spawns.expires_at<=now()
    or exists (select 1 from public.corrupted_catches c where c.user_id=auth.uid()
      and c.spawn_id='quest:'||quest_spawns.id and c.result in ('caught','failed'));
end $$;

CREATE OR REPLACE FUNCTION public.game_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cfg private.game_config; result_spawns jsonb; result_wayposts jsonb; wave bigint; wave_start timestamptz; nearby_target integer; candidate jsonb; pass integer; spawn_candidates jsonb; attempt_spawns jsonb;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  select w.wave, w.starts_at into wave, wave_start from private.game_wave_at(now()) w;
  nearby_target := ((private.game_spawn_at(wave_start)).config).nearby_spawn_target;
  -- Eligible positions are static public paths; releases are derived only for this request.
  select coalesce(jsonb_agg(jsonb_build_object(
      'spawn_id',s.spawn_id,'vessel',s.vessel,'rarity',s.rarity,
      'lat',p.lat,'lng',p.lng,'expires_at',s.expires_at,
      'attempts_left',greatest(0,cfg.max_attempts-coalesce(c.attempts,0)),
      'already_caught',coalesce(c.result='caught',false))),'[]'::jsonb) into spawn_candidates
    from public.corrupted_spots p
    cross join lateral private.resolve_spawn(p.id,wave) s
    left join public.corrupted_catches c on c.user_id=auth.uid() and c.spawn_id=s.spawn_id
    where p.lat between p_lat-cfg.action_radius_m/110000.0 and p_lat+cfg.action_radius_m/110000.0
      and p.lng between p_lng-cfg.action_radius_m/(110000.0*cos(radians(p_lat))) and p_lng+cfg.action_radius_m/(110000.0*cos(radians(p_lat)))
      and public.distance_m(p_lat,p_lng,p.lat,p.lng)<=cfg.action_radius_m
      and p.hidden_at is null
      and p.source_ref not like 'qa:roy-taipei-game:%'
      and s.expires_at>now()
;
  result_spawns := '[]'::jsonb;
  -- Stable wave-specific shuffles avoid a ring/grid. Retry spacing so one unlucky
  -- early pick does not unnecessarily reduce the count in a narrow public corridor.
  for pass in 0..7 loop
    attempt_spawns := '[]'::jsonb;
    for candidate in select value from jsonb_array_elements(spawn_candidates)
      order by case when pass=7 then (value->>'lat')::double precision
        else private.game_roll((value->>'spawn_id')||':nearby:'||pass) end,value->>'spawn_id'
    loop
      if exists(select 1 from jsonb_array_elements(attempt_spawns) chosen
        where public.distance_m((candidate->>'lat')::double precision,(candidate->>'lng')::double precision,
          (chosen->>'lat')::double precision,(chosen->>'lng')::double precision)<28) then continue;end if;
      attempt_spawns := attempt_spawns || jsonb_build_array(candidate);
      exit when jsonb_array_length(attempt_spawns)>=nearby_target;
    end loop;
    if jsonb_array_length(attempt_spawns)>jsonb_array_length(result_spawns) then result_spawns:=attempt_spawns;end if;
    exit when jsonb_array_length(result_spawns)>=nearby_target;
  end loop;
  -- Choose the wave's batch before hiding caught/exhausted releases.
  -- Removing one must leave a vacancy until the next wave, rather than refill it.
  select coalesce(jsonb_agg(value),'[]'::jsonb) into result_spawns
  from jsonb_array_elements(result_spawns)
  where not (value->>'already_caught')::boolean and (value->>'attempts_left')::integer>0;
  -- Use a conservative longitude bound at the poleward edge of the search.
  -- Shift the bound by a full turn for positions near the antimeridian.
  with bounds as (
    select 5000 / 110000.0 as lat_delta,
      case when abs(p_lat) + 5000 / 110000.0 >= 90 then 180
        else least(180, 5000 / (110000.0 * cos(radians(abs(p_lat) + 5000 / 110000.0))))
      end as lng_delta
  ), nearby as (
    select s.*, public.distance_m(p_lat,p_lng,s.lat,s.lng) as distance
    from public.public_capsule_spots s cross join bounds b
    where s.game_enabled and s.hidden_at is null
      and s.lat between p_lat-b.lat_delta and p_lat+b.lat_delta
      and (s.lng between p_lng-b.lng_delta and p_lng+b.lng_delta
        or s.lng between p_lng-b.lng_delta+360 and p_lng+b.lng_delta+360
        or s.lng between p_lng-b.lng_delta-360 and p_lng+b.lng_delta-360)
      and public.distance_m(p_lat,p_lng,s.lat,s.lng)<=5000
  ), shown as (
    select * from nearby where kind='landmark'
    union all
    (select * from nearby where kind='common' order by distance,id limit 200)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'kind',s.kind,'name_zh',s.name_zh,'name_en',s.name_en,
    'city_zh',s.city_zh,'city_en',s.city_en,'place',s.place,
    'lat',s.lat,'lng',s.lng,'scene',s.scene,'photo',s.photo,
    'cooldown_end',case when s.kind='common'
      then (select max(spun_at)+make_interval(secs=>cfg.spin_cooldown_seconds)
        from public.waypost_spins x where x.user_id=auth.uid() and x.waypost_id=s.id)
      else null end)
    order by s.distance,s.id),'[]'::jsonb) into result_wayposts
  from shown s;
  return jsonb_build_object('spawns',result_spawns || private.quest_spawn_markers(p_lat,p_lng,cfg.action_radius_m),'wayposts',result_wayposts);
end $function$;

-- Share the rack's product visibility rules with the admin count.
create function private.waypost_rack_capsules(p_waypost uuid) returns setof public.capsules
language sql stable set search_path = '' as $$
  select c.* from public.capsules c
  where c.public_capsule_spot = p_waypost and c.is_public and c.recipient is null
    and c.opened_at is null and c.rack_removed_at is null and not private.public_capsule_is_hidden(c.id);
$$;

create or replace function public.waypost_rack(waypost_id uuid, filter text default 'all', cursor jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  page_size constant integer := 24;
  post public.public_capsule_spots;
begin
  if actor is null then raise exception 'not signed in'; end if;
  if filter is null or filter not in ('all', 'ready', 'waiting', 'has_question', 'friends', 'mine') then
    raise exception 'bad_filter';
  end if;
  select w.* into post from public.public_capsule_spots w
  where w.id = waypost_id and w.kind = 'common' and w.game_enabled and w.hidden_at is null;
  return (
    with visible as (
      select c.id, c.sealed_at, c.sender, c.hint, c.open_at, c.lock_question,
        c.open_at <= statement_timestamp() as ready, c.sender = actor as is_mine,
        f.friend_id is not null as is_friend
      from private.waypost_rack_capsules(post.id) c
      left join public.friendships f on f.user_id = actor and f.friend_id = c.sender
    ), filtered as materialized (
      select * from visible where case filter
        when 'ready' then ready when 'waiting' then not ready
        when 'has_question' then lock_question is not null
        when 'friends' then is_friend when 'mine' then is_mine else true end
    ), page as materialized (
      select * from filtered
      where cursor is null or (sealed_at, id) < ((cursor->>'sealed_at')::timestamptz, (cursor->>'id')::uuid)
      order by sealed_at desc, id desc limit page_size + 1
    ), items as (
      select * from page order by sealed_at desc, id desc limit page_size
    )
    select jsonb_build_object(
      'count', (select count(*) from filtered),
      'photo', post.photo,
      'items', coalesce((select jsonb_agg(jsonb_build_object(
        'capsule_id', i.id, 'sender', jsonb_build_object('portrait', p.avatar, 'name', p.name),
        'hint', i.hint, 'opens_at', i.open_at, 'ready', i.ready, 'has_question', i.lock_question is not null,
        'lock_question', i.lock_question, 'is_friend', i.is_friend, 'is_mine', i.is_mine
      ) order by i.sealed_at desc, i.id desc) from items i join public.profiles p on p.id = i.sender), '[]'::jsonb),
      'next_cursor', case when (select count(*) from page) > page_size then
        (select jsonb_build_object('sealed_at', i.sealed_at, 'id', i.id)
         from items i order by i.sealed_at, i.id limit 1) end
    )
  );
end;
$$;

create function public.admin_waypost_stats(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare post public.public_capsule_spots;
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  select p.* into post from public.public_capsule_spots p
  where p.id = p_id and p.kind = 'common' and (p.game_enabled or p.hidden_at is not null);
  if not found then raise exception 'not_found'; end if;
  return (
    select jsonb_build_object(
      'total_spins', s.total_spins, 'last_spin_at', s.last_spin_at,
      'level', l.level, 'xp', w.xp,
      'rack_count', (select count(*) from private.waypost_rack_capsules(
        case when post.game_enabled and post.hidden_at is null then post.id end)))
    from (select coalesce((select xp from private.waypost_xp where waypost_id = post.id), 0) as xp) w
    cross join lateral (
      select level from private.waypost_levels where xp_from <= w.xp order by level desc limit 1
    ) l
    cross join lateral (
      select count(*) as total_spins, max(spun_at) as last_spin_at from public.waypost_spins where waypost_id = post.id
    ) s
  );
end;
$$;

CREATE OR REPLACE FUNCTION private.admin_region(p_region private.game_regions, p_out_now bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', p_region.id, 'country_zh', p_region.country_zh, 'country_en', p_region.country_en,
    'name_zh', p_region.name_zh, 'name_en', p_region.name_en, 'timezone', p_region.timezone,
    'center', jsonb_build_object('lat', p_region.center_lat, 'lng', p_region.center_lng),
    'border', extensions.st_asgeojson(p_region.border, 15, 0)::jsonb,
    'wayposts', jsonb_build_object('common', w.common, 'landmark', w.landmark),
    'cells_used', w.cells_used,
    'idle_14d', w.idle_14d,
    'corrupted_spots', (select count(*) from public.corrupted_spots p
      where p.city = p_region.city and p.hidden_at is null and p.source_ref not like 'qa:roy-taipei-game:%'),
    'capsule_spots', (select count(*) from public.public_capsule_spots p where p.city_en = p_region.city and p.public_drop and p.hidden_at is null),
    'vessels', (select coalesce(jsonb_agg(v.id order by case r.rarity
      when 'common' then 1 when 'uncommon' then 2 else 3 end, v.sort, v.id), '[]'::jsonb)
      from private.vessel_spawn_rules r join public.vessels v on v.id = r.vessel
      where exists (select 1 from private.vessel_spawn_places a where a.vessel = r.vessel
        and a.region_id in (p_region.id, p_region.parent_id))),
    'out_now', p_out_now,
    'city_hunts_live', (select count(*) from public.hunts h
      where h.kind = 'system' and h.city_en = p_region.city and h.status = 'published'
        and h.starts_at <= now() and now() < h.ends_at),
    'private_hunts', (select count(distinct q.hunt) from private.admin_region_quests(p_region) q),
    'coverage', jsonb_build_object('covered', b.id is not null, 'bytes', b.bytes, 'built_at', b.built_at)
  )
  from (values (p_region.coverage_id)) as area(id)
  left join private.game_map_coverage b on b.id = area.id
  cross join lateral (
    select count(*) filter (where p.kind = 'common') as common,
      count(*) filter (where p.kind = 'landmark') as landmark,
      count(distinct p.s2_cell17) as cells_used,
      count(*) filter (where p.kind = 'common' and not exists (
        select 1 from public.waypost_spins s
        where s.waypost_id = p.id and s.spun_at >= now() - interval '14 days'
      )) as idle_14d
    from public.public_capsule_spots p where p.city_en = p_region.city and p.game_enabled and p.hidden_at is null
  ) w;
$function$;

CREATE OR REPLACE FUNCTION public.admin_city_map(p_region text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  city private.game_regions;
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  select * into city from private.game_regions where id = p_region and center_lat is not null;
  if not found then raise exception 'not_found'; end if;

  return (
    with wave as materialized (select * from private.admin_wave(city.city))
    select jsonb_build_object(
      'region', private.admin_region(city, (select count(*) from wave where not caught)),
      'wayposts', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name_zh', p.name_zh, 'name_en', p.name_en, 'lat', p.lat, 'lng', p.lng,
        'kind', p.kind, 'game_enabled', p.game_enabled, 'source_ref', p.source_ref,
        'scene', p.scene, 'hidden_at', p.hidden_at,
        's2_cell17', p.s2_cell17, 'photo', p.photo, 'photo_credit', p.photo_credit
      ) order by p.id), '[]'::jsonb)
        from public.public_capsule_spots p where p.city_en = city.city and (p.game_enabled or p.hidden_at is not null)),
      'spots', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'lat', p.lat, 'lng', p.lng, 'habitat', p.habitat, 'hidden_at', p.hidden_at
      ) order by p.id), '[]'::jsonb) from public.corrupted_spots p
        where p.city = city.city and p.source_ref not like 'qa:roy-taipei-game:%'),
      'wave', (select coalesce(jsonb_agg(to_jsonb(w) order by w.spot), '[]'::jsonb) from wave w),
      'keepers', (select coalesce(jsonb_agg(jsonb_build_object(
        'hunt', h.id, 'name_zh', h.keeper_spot_zh, 'name_en', h.keeper_spot_en,
        'lat', h.keeper_lat, 'lng', h.keeper_lng, 'landmark', h.landmark
      ) order by h.id), '[]'::jsonb) from public.hunts h
        where h.kind = 'system' and h.city_en = city.city and h.status = 'published'
          and h.starts_at <= now() and now() < h.ends_at),
      'private_quests', (select coalesce(jsonb_agg(to_jsonb(q) order by q.hunt, q.id), '[]'::jsonb)
        from private.admin_region_quests(city) q)
    )
  );
end;
$function$;

revoke all on function
  private.admin_inside_border(text,double precision,double precision),
  private.s2_cell17(double precision,double precision),
  private.can_edit_waypost_photo(text),
  private.waypost_rack_capsules(uuid),
  private.admin_undo_before_map_builder(bigint,text),
  public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text,text,text),
  public.admin_waypost_update(uuid,double precision,double precision,text,text,text,text,text,text),
  public.admin_spot_add(text,double precision,double precision,text,text),
  public.admin_spot_move(uuid,double precision,double precision,text),
  public.admin_waypost_stats(uuid),
  public.admin_undo(bigint,text)
from public, anon, authenticated, service_role;

grant execute on function private.can_edit_waypost_photo(text) to authenticated;
grant execute on function
  public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text,text,text),
  public.admin_waypost_update(uuid,double precision,double precision,text,text,text,text,text,text),
  public.admin_spot_add(text,double precision,double precision,text,text),
  public.admin_spot_move(uuid,double precision,double precision,text),
  public.admin_waypost_stats(uuid),
  public.admin_undo(bigint,text)
to authenticated;

commit;
