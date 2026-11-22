-- R1.5. Resolve only the occupancy conflicts Roy reviewed before enforcing
-- one Waypost or Landmark per S2 level-17 cell.
begin;

select private.lock_game_edits();
lock table public.public_capsule_spots, public.waypost_spins, public.capsules,
  public.hunts, private.quest_rules in share row exclusive mode;

alter table public.public_capsule_spots
  add column status text not null default 'live'
    check (status in ('draft', 'live', 'hidden', 'deleted'));
alter table public.corrupted_spots
  add column status text not null default 'live'
    check (status in ('draft', 'live', 'hidden', 'deleted'));

-- Legacy public-drop points were never drafts. Keep them out of Publish all.
update public.public_capsule_spots set status = 'hidden'
where hidden_at is not null or not game_enabled;
update public.corrupted_spots set status = 'hidden' where hidden_at is not null;

create temp table map_r15_cleanup on commit drop as
with ranked as (
  select p.id, p.source_ref, p.kind, p.city_en, p.lat, p.lng, p.status,
    private.s2_cell17(p.lat, p.lng) as cell,
    (select count(*) from public.waypost_spins s where s.waypost_id = p.id) as spins,
    -- The original seed entries precede the dense points in 20261108180337.
    p.source_ref in ('osm:way/395120471', 'osm:relation/9976848',
      'osm:relation/11551012', 'osm:way/183840226', 'osm:way/261647304',
      'osm:way/235913807@40m;hkust-outdoor') as older_seed,
    p.source_ref in ('osm:way/1336506663@0m;park/way/309157011',
      'osm:way/309157011') as keep_civic_square
  from public.public_capsule_spots p
), ordered as (
  select r.*,
    row_number() over (partition by cell order by (kind = 'landmark') desc,
      keep_civic_square desc nulls last, spins desc, older_seed desc nulls last, id) as position
  from ranked r
)
select loser.cell, loser.id as deleted_id, winner.id as kept_id,
  loser.source_ref as deleted_source, winner.source_ref as kept_source,
  loser.kind as deleted_kind, winner.kind as kept_kind,
  loser.spins as deleted_spins, winner.spins as kept_spins
from ordered loser
join ordered winner on winner.cell = loser.cell and winner.position = 1
where loser.position > 1;

create function private.assert_map_builder_hunts(p_exclude uuid[] default '{}')
returns void language plpgsql stable set search_path = '' as $$
begin
  if exists (
    select 1 from public.hunts h
    where h.kind = 'system' and h.status = 'published' and h.hidden_at is null
      and h.ends_at > now()
      and (select count(*) from public.public_capsule_spots p
        where p.kind = 'common' and p.status = 'live' and not (p.id = any(p_exclude))
          and public.distance_m(p.lat, p.lng, h.area_lat, h.area_lng) <= h.area_radius_m)
      < coalesce((select max(q.goal) from public.city_hunt_quests q
        where q.hunt_id = h.id and q.quest_type = 'spin'), 0)
  ) or exists (
    select 1 from (values ('taipei'), ('hongkong'), ('macau'), ('singapore')) as cities(city)
    where not exists (
      select 1 from private.todays_hunt_center(cities.city) c
      join public.public_capsule_spots p on public.distance_m(c.lat, c.lng, p.lat, p.lng) <= 1500
      where p.kind = 'common' and p.status = 'live' and not (p.id = any(p_exclude))
    )
  ) then raise exception 'hunt_needs_wayposts'; end if;
end;
$$;

do $$
declare
  moved_refs bigint;
  moved_rack bigint;
  moved_hunts bigint;
  moved_quests bigint;
  plan jsonb;
  previous jsonb;
begin
  -- Allow the reviewed cells to have fewer rows in local or other databases,
  -- but fail on any new occupants or an unreviewed cell.
  if exists (
    with approved(cell, refs) as (values
      ('1/20323100302003230', array['osm:way/395120471','osm:way/395120469@0m;park/way/395120471']),
      ('1/20323100303103300', array['osm:relation/9976848','osm:way/166554014@0m;park/relation/9976848']),
      ('1/22000023311201011', array['osm:relation/11551012','osm:way/297728677@25m;park/relation/11551012']),
      ('1/22000023311303200', array['osm:way/183840226','osm:way/405411416@0m;park/way/183840226']),
      ('1/22000200020311112', array['osm:way/235913807@40m;hkust-outdoor','osm:way/235913807@90m;hkust-outdoor']),
      ('1/22000200020311121', array['osm:node/2439950828','osm:way/235913807@0m;hkust-outdoor']),
      ('1/22020111113120211', array['osm:way/261647304','osm:way/462045632@0m;park/way/261647304']),
      ('1/22020111113123233', array['osm:way/1336506663@0m;park/way/309157011',
        'admin:a35a655a-be73-47f5-b9aa-e51f30ba4ecd','qa:roy-taipei-public:2']),
      ('1/22020111113130322', array['osm:way/309157011',
        'admin:967fd31a-0b40-42ae-b406-d4661063fa6e','qa:roy-taipei-public:3'])
    )
    select 1 from pg_temp.map_r15_cleanup c left join approved a using (cell)
    where (c.deleted_source = any(a.refs) and c.kept_source = any(a.refs)) is not true
      or c.deleted_kind = 'landmark'
  ) then raise exception 'r15_unreviewed_cell_conflict'; end if;

  if exists (
    select 1 from public.public_capsule_spots p
    where p.source_ref in ('admin:a35a655a-be73-47f5-b9aa-e51f30ba4ecd',
      'admin:967fd31a-0b40-42ae-b406-d4661063fa6e', 'qa:roy-taipei-public:2', 'qa:roy-taipei-public:3')
    and not exists (select 1 from pg_temp.map_r15_cleanup m where m.deleted_id = p.id)
  ) then raise exception 'r15_cleanup_fixture_moved'; end if;

  perform private.assert_map_builder_hunts(array(select deleted_id from pg_temp.map_r15_cleanup));
  -- Landmark Wayposts do not have a player rack. Stop if a capsule was left
  -- on HKUST Piazza South after the snapshot reviewed for this migration.
  if exists (
    select 1 from pg_temp.map_r15_cleanup m join public.capsules c
      on c.public_capsule_spot = m.deleted_id
    where m.kept_kind = 'landmark' and c.is_public and c.opened_at is null
      and c.recipient is null and c.rack_removed_at is null
  ) then raise exception 'r15_landmark_rack_conflict'; end if;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]') into previous
  from public.public_capsule_spots p join pg_temp.map_r15_cleanup m on m.deleted_id = p.id;
  select count(*) into moved_rack from pg_temp.map_r15_cleanup m
    cross join lateral private.waypost_rack_capsules(m.deleted_id);
  update public.capsules c set public_capsule_spot = m.kept_id
    from pg_temp.map_r15_cleanup m where c.public_capsule_spot = m.deleted_id;
  get diagnostics moved_refs = row_count;
  update public.hunts h set landmark = m.kept_id
    from pg_temp.map_r15_cleanup m where h.landmark = m.deleted_id;
  get diagnostics moved_hunts = row_count;

  -- The seeded City Hunt routes and Today's Hunt catch pins snapshot the
  -- Waypost's coordinates instead of storing a foreign key.
  update private.quest_rules q set
    landmark_id = case when q.landmark_id is not null then kept.id end,
    location_lat = kept.lat, location_lng = kept.lng,
    name_zh = kept.name_zh, name_en = kept.name_en
  from pg_temp.map_r15_cleanup m
  join public.public_capsule_spots removed on removed.id = m.deleted_id
  join public.public_capsule_spots kept on kept.id = m.kept_id
  where q.landmark_id = m.deleted_id or (
    (q.location_lat, q.location_lng) = (removed.lat, removed.lng)
    and ((q.type in ('arrive', 'catch') and exists (
      select 1 from private.city_hunt_located_quests k where k.quest_id = q.id
    )) or (q.type = 'catch' and exists (
      select 1 from private.todays_hunt_schedule k where k.quest_id = q.id
    )))
  );
  get diagnostics moved_quests = row_count;

  update public.public_capsule_spots p
  set status = 'deleted', game_enabled = false, hidden_at = coalesce(p.hidden_at, now())
  from pg_temp.map_r15_cleanup m where p.id = m.deleted_id;
  perform private.assert_map_builder_hunts();

  select jsonb_agg(to_jsonb(m) order by m.cell, m.deleted_id) into plan from pg_temp.map_r15_cleanup m;
  if plan is not null then
    insert into private.admin_actions (actor, actor_snapshot, action, target_type, target_id,
      target_label, before, after, note)
    values ('00000000-0000-0000-0000-000000000000',
      '{"id":"00000000-0000-0000-0000-000000000000","name":"Map Builder migration","avatar":null}',
      'map_builder.cell_cleanup', 'waypost', 'r15-cell-cleanup', 'R1.5 S2 cell cleanup',
      jsonb_build_object('rows', previous),
      jsonb_build_object('status', 'deleted', 'cells', plan, 'rack_capsules', moved_rack,
        'capsule_references', moved_refs, 'hunt_references', moved_hunts, 'quest_references', moved_quests),
      'Roy approved the duplicate cell cleanup. Spin history remains on its original Wayposts.');
  end if;
end;
$$;

-- The legacy bits continue to guard existing player RPCs, including definitions
-- that filter only one of the bits. Drafts keep their public_drop preference
-- until Publish, but have a non-null hidden_at while unavailable.
update public.public_capsule_spots
set game_enabled = (status = 'live'), hidden_at = case when status <> 'live' then coalesce(hidden_at, now()) end
where game_enabled is distinct from (status = 'live') or (hidden_at is null) <> (status = 'live');

create unique index public_capsule_spots_r15_cell_idx on public.public_capsule_spots (s2_cell17)
where status <> 'deleted';

create function private.sync_waypost_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status = old.status and old.status <> 'deleted'
    and (new.game_enabled, new.hidden_at) is distinct from (old.game_enabled, old.hidden_at)
  then
    new.status := case when new.game_enabled and new.hidden_at is null then 'live' else 'hidden' end;
  end if;
  new.game_enabled := new.status = 'live';
  new.hidden_at := case when new.status <> 'live' then coalesce(new.hidden_at, now()) end;
  if new.status <> 'deleted' and exists (
    select 1 from public.public_capsule_spots p
    where p.id <> new.id and p.status <> 'deleted'
      and p.s2_cell17 = private.s2_cell17(new.lat, new.lng)
  ) then raise exception 'cell_taken'; end if;
  return new;
end;
$$;

create function private.sync_corrupted_spot_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status = old.status and old.status <> 'deleted'
    and new.hidden_at is distinct from old.hidden_at
  then
    new.status := case when new.hidden_at is null then 'live' else 'hidden' end;
  end if;
  new.hidden_at := case when new.status <> 'live' then coalesce(new.hidden_at, now()) end;
  return new;
end;
$$;

create trigger map_builder_waypost_status before insert or update of status, game_enabled, hidden_at, lat, lng
on public.public_capsule_spots for each row execute function private.sync_waypost_status();
create trigger map_builder_spot_status before insert or update of status, hidden_at
on public.corrupted_spots for each row execute function private.sync_corrupted_spot_status();

alter policy "sea shores: signed in read" on public.public_capsule_spots using (status = 'live');

create or replace function private.admin_waypost_row(p_id uuid) returns public.public_capsule_spots
language plpgsql set search_path = '' as $$
declare p public.public_capsule_spots;
begin
  select * into p from public.public_capsule_spots s where s.id = p_id
    and s.status <> 'deleted' for update;
  if not found then raise exception 'not_found'; end if;
  if p.kind = 'landmark' then raise exception 'landmark'; end if;
  return p;
end;
$$;

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
    'cell_taken', exists (select 1 from public.public_capsule_spots p
      where p.status <> 'deleted' and p.s2_cell17 = cell and p.id is distinct from p_id),
    'same_cell', (select coalesce(jsonb_agg(to_jsonb(w) order by w.meters, w.id), '[]'::jsonb)
      from (select p.id, p.name_zh, p.name_en, public.distance_m(p_lat, p_lng, p.lat, p.lng) as meters
        from public.public_capsule_spots p where p.status <> 'deleted'
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
      (id, name_zh, name_en, city_zh, city_en, lat, lng, scene, kind, game_enabled, public_drop, source_ref, photo, photo_credit, status)
    values (p_after.id, p_after.name_zh, p_after.name_en, p_after.city_zh, p_after.city_en,
      p_after.lat, p_after.lng, p_after.scene, p_after.kind, p_after.game_enabled,
      p_after.public_drop, p_after.source_ref, p_after.photo, p_after.photo_credit, p_after.status)
    returning * into p_after;
  else
    update public.public_capsule_spots p set lat = p_after.lat, lng = p_after.lng,
      name_zh = p_after.name_zh, name_en = p_after.name_en, scene = p_after.scene,
      status = p_after.status,
      photo = p_after.photo, photo_credit = p_after.photo_credit
    where p.id = p_before.id returning p.* into p_after;
  end if;
  if not adding and p_before.status = 'live' and (p_after.status <> 'live' or moved) then
    perform private.assert_map_builder_hunts();
  end if;
  return p_after;
end;
$$;

create function private.create_map_waypost(p_region text, p_lat double precision, p_lng double precision,
  p_name_zh text, p_name_en text, p_scene text, p_photo text, p_photo_credit text, p_status text) returns public.public_capsule_spots
language plpgsql set search_path = '' as $$
declare
  r private.game_regions;
  p public.public_capsule_spots;
begin
  if p_status is null or p_status not in ('draft','live') then raise exception 'bad_status'; end if;
  select * into r from private.game_regions g where g.id = p_region and g.border is not null for share;
  if not found then raise exception 'outside_border'; end if;
  p.id := gen_random_uuid();
  p.name_zh := btrim(p_name_zh); p.name_en := coalesce(btrim(p_name_en), '');
  p.city_zh := r.name_zh; p.city_en := r.city;
  p.lat := p_lat; p.lng := p_lng; p.scene := p_scene;
  p.kind := 'common'; p.status := p_status; p.game_enabled := p_status = 'live'; p.public_drop := true;
  p.source_ref := 'admin:' || p.id;
  p.photo := nullif(btrim(p_photo), '');
  p.photo_credit := nullif(btrim(p_photo_credit), '');
  return private.save_admin_waypost(null, p, null);
end;
$$;

create function private.create_map_spot(p_region text, p_lat double precision, p_lng double precision,
  p_habitat text, p_status text) returns public.corrupted_spots
language plpgsql set search_path = '' as $$
declare
  r private.game_regions;
  spot_id uuid := gen_random_uuid();
  saved public.corrupted_spots;
begin
  if p_status is null or p_status not in ('draft','live') then raise exception 'bad_status'; end if;
  select * into r from private.game_regions g where g.id = p_region and g.border is not null for share;
  if not private.admin_inside_border(r.id, p_lat, p_lng) then raise exception 'outside_border'; end if;
  if p_habitat is null or p_habitat not in ('park','water','square') then raise exception 'bad_habitat'; end if;
  insert into public.corrupted_spots (id, city, timezone, lat, lng, habitat, source_ref, first_spawn_wave, status)
    select spot_id, r.city, r.timezone, p_lat, p_lng, p_habitat, 'admin:' || spot_id, w.wave + 1, p_status
    from private.game_wave_at(clock_timestamp()) w returning * into strict saved;
  return saved;
end;
$$;

create or replace function public.admin_spot_move(p_id uuid, p_lat double precision, p_lng double precision,
  p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.corrupted_spots;
  saved public.corrupted_spots;
  region text;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  select * into p from public.corrupted_spots s where s.id = p_id and s.status <> 'deleted' and s.source_ref not like 'qa:%' for update;
  if not found then raise exception 'not_found'; end if;
  select r.id into region from private.game_regions r where r.city = p.city;
  if not private.admin_inside_border(region, p_lat, p_lng) then raise exception 'outside_border'; end if;
  update public.corrupted_spots set lat = p_lat, lng = p_lng where id = p.id returning * into saved;
  perform private.admin_log('spot.move', 'spot', p.id::text, p.city, to_jsonb(p), to_jsonb(saved), p_note);
  return to_jsonb(saved);
end;
$$;

create or replace function public.admin_waypost_stats(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare post public.public_capsule_spots;
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  select p.* into post from public.public_capsule_spots p
  where p.id = p_id and p.kind = 'common' and p.status <> 'deleted';
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
        'status', p.status, 's2_cell17', p.s2_cell17, 'photo', p.photo, 'photo_credit', p.photo_credit
      ) order by p.id), '[]'::jsonb)
        from public.public_capsule_spots p where p.city_en = city.city and p.status <> 'deleted'),
      'spots', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'lat', p.lat, 'lng', p.lng, 'habitat', p.habitat, 'hidden_at', p.hidden_at, 'status', p.status
      ) order by p.id), '[]'::jsonb) from public.corrupted_spots p
        where p.city = city.city and p.status <> 'deleted' and p.source_ref not like 'qa:roy-taipei-game:%'),
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
    'cells_used', (select count(distinct p.s2_cell17) from public.public_capsule_spots p
      where p.city_en = p_region.city and p.status <> 'deleted'),
    'drafts', (select count(*) from public.public_capsule_spots p
      where p.city_en = p_region.city and p.status = 'draft')
      + (select count(*) from public.corrupted_spots p where p.city = p_region.city and p.status = 'draft'),
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
      count(*) filter (where p.kind = 'common' and not exists (
        select 1 from public.waypost_spins s
        where s.waypost_id = p.id and s.spun_at >= now() - interval '14 days'
      )) as idle_14d
    from public.public_capsule_spots p where p.city_en = p_region.city and p.game_enabled and p.hidden_at is null
  ) w;
$function$;

create or replace function public.admin_waypost_set_visible(p_id uuid, p_visible boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.public_capsule_spots;
declare saved public.public_capsule_spots;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  if p_visible is null then raise exception 'bad_visibility'; end if;
  p := private.admin_waypost_row(p_id);
  saved := p;
  saved.status := case when p_visible then 'live' else 'hidden' end;
  saved := private.save_admin_waypost(p, saved, p_note);
  perform private.admin_log(case when p_visible then 'waypost.show' else 'waypost.hide' end,
    'waypost', p.id::text, saved.name_en, to_jsonb(p), to_jsonb(saved), p_note);
  return to_jsonb(saved);
end;
$$;

create or replace function public.admin_spot_set_visible(p_id uuid, p_visible boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.corrupted_spots;
declare saved public.corrupted_spots;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  if p_visible is null then raise exception 'bad_visibility'; end if;
  select * into p from public.corrupted_spots s where s.id = p_id and s.status <> 'deleted' and s.source_ref not like 'qa:%' for update;
  if not found then raise exception 'not_found'; end if;
  update public.corrupted_spots s set status = case when p_visible then 'live' else 'hidden' end,
    first_spawn_wave = case when p_visible and p.status <> 'live'
      then (select w.wave + 1 from private.game_wave_at(clock_timestamp()) w) else p.first_spawn_wave end
    where s.id = p_id returning s.* into saved;
  perform private.admin_log(case when p_visible then 'spot.show' else 'spot.hide' end,
    'spot', p.id::text, p.city, to_jsonb(p), to_jsonb(saved), p_note);
  return to_jsonb(saved);
end;
$$;

-- A single trailing default keeps calls from deployed R1 clients working.
drop function public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text,text,text);
drop function public.admin_spot_add(text,double precision,double precision,text,text);

create function public.admin_waypost_add(p_region text, p_lat double precision, p_lng double precision,
  p_name_zh text, p_name_en text, p_scene text, p_checked boolean default null, p_note text default null,
  p_photo text default null, p_photo_credit text default null, p_status text default 'live') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare post public.public_capsule_spots;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  post := private.create_map_waypost(p_region, p_lat, p_lng, p_name_zh, p_name_en, p_scene,
    p_photo, p_photo_credit, p_status);
  perform private.admin_log('waypost.add', 'waypost', post.id::text, post.name_en, null, to_jsonb(post), p_note);
  return to_jsonb(post);
end;
$$;

create function public.admin_spot_add(p_region text, p_lat double precision, p_lng double precision,
  p_habitat text, p_note text default null, p_status text default 'live') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare spot public.corrupted_spots;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  spot := private.create_map_spot(p_region, p_lat, p_lng, p_habitat, p_status);
  perform private.admin_log('spot.add', 'spot', spot.id::text, spot.city, null, to_jsonb(spot), p_note);
  return to_jsonb(spot);
end;
$$;

create function public.admin_place_set_status(p_kind text, p_ids uuid[], p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  before_rows jsonb := '{}';
  post public.public_capsule_spots;
  spot public.corrupted_spots;
  target uuid;
  changed uuid[] := '{}';
  label text;
  lost_live boolean := false;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  if p_kind is null or p_kind not in ('waypost','spot')
    or p_status is null or p_status not in ('draft','live','hidden','deleted')
  then raise exception 'bad_status'; end if;
  if coalesce(cardinality(p_ids),0) = 0 then raise exception 'nothing'; end if;

  for target in select distinct id from unnest(p_ids) id order by id loop
    if p_kind = 'waypost' then
      post := private.admin_waypost_row(target);
      if post.status = p_status then continue; end if;
      before_rows := before_rows || jsonb_build_object(target, to_jsonb(post));
      label := coalesce(label, post.name_en);
      lost_live := lost_live or (post.status = 'live' and p_status <> 'live');
      update public.public_capsule_spots set status = p_status where id = target;
    else
      select * into spot from public.corrupted_spots
      where id = target and status <> 'deleted' and source_ref not like 'qa:%' for update;
      if not found then raise exception 'not_found'; end if;
      if spot.status = p_status then continue; end if;
      before_rows := before_rows || jsonb_build_object(target, to_jsonb(spot));
      label := coalesce(label, spot.city);
      update public.corrupted_spots set status = p_status,
        first_spawn_wave = case when p_status = 'live' then (
          select w.wave + 1 from private.game_wave_at(clock_timestamp()) w
        ) else spot.first_spawn_wave end
      where id = target;
    end if;
    changed := array_append(changed, target);
  end loop;

  if lost_live then perform private.assert_map_builder_hunts(); end if;
  if cardinality(changed) > 0 then
    if cardinality(changed) > 1 then label := label || ' +' || (cardinality(changed) - 1); end if;
    perform private.admin_log(p_kind || '.status', p_kind || '_batch', array_to_string(changed, ','),
      label, before_rows, jsonb_build_object('status', p_status), p_note);
  end if;
  return jsonb_build_object('changed', cardinality(changed));
end;
$$;

create function private.add_map_places_batch(p_kind text, p_region text, p_items jsonb, p_note text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  item jsonb;
  idx integer;
  post public.public_capsule_spots;
  spot public.corrupted_spots;
  saved jsonb;
  ids text[] := '{}';
  added jsonb := '[]';
  skipped jsonb := '[]';
  snapshots jsonb := '{}';
  lat double precision;
  lng double precision;
  label text;
  reason text;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  if not exists (select 1 from private.game_regions where id = p_region and border is not null)
  then raise exception 'outside_border'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'bad_item'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'too_many'; end if;

  for item, idx in select value, ordinality::integer - 1
    from jsonb_array_elements(p_items) with ordinality
  loop
    begin
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'lat') is distinct from 'number'
        or jsonb_typeof(item->'lng') is distinct from 'number' then raise exception 'bad_item'; end if;
      lat := (item->>'lat')::double precision;
      lng := (item->>'lng')::double precision;
      if p_kind = 'waypost' then
        if jsonb_typeof(item->'name_zh') is distinct from 'string'
          or jsonb_typeof(item->'name_en') is distinct from 'string'
          or nullif(btrim(item->>'name_en'), '') is null then raise exception 'bad_name'; end if;
        post := private.create_map_waypost(p_region, lat, lng,
          item->>'name_zh', item->>'name_en', item->>'scene', null, null, 'draft');
        saved := to_jsonb(post);
        label := coalesce(label, post.name_en);
      else
        spot := private.create_map_spot(p_region, lat, lng, item->>'habitat', 'draft');
        saved := to_jsonb(spot);
        label := coalesce(label, spot.city);
      end if;
      ids := array_append(ids, saved->>'id');
      snapshots := snapshots || jsonb_build_object(saved->>'id', saved);
      added := added || jsonb_build_array(saved);
    exception
      when numeric_value_out_of_range then
        skipped := skipped || jsonb_build_array(jsonb_build_object('index', idx, 'reason', 'bad_item'));
      when raise_exception then
        get stacked diagnostics reason = message_text;
        if reason not in ('bad_item', 'bad_name', 'bad_scene', 'bad_habitat', 'outside_border', 'cell_taken')
        then raise; end if;
        skipped := skipped || jsonb_build_array(jsonb_build_object('index', idx, 'reason', reason));
    end;
  end loop;

  if cardinality(ids) > 0 then
    if cardinality(ids) > 1 then label := label || ' +' || (cardinality(ids) - 1); end if;
    perform private.admin_log(p_kind || '.add_batch', p_kind || '_batch', array_to_string(ids, ','),
      label, null, jsonb_build_object('count', cardinality(ids), 'rows', snapshots), p_note);
  end if;
  return jsonb_build_object('added', added, 'skipped', skipped);
end;
$$;

create function public.admin_waypost_add_batch(p_region text, p_items jsonb, p_note text default null)
returns jsonb language sql security definer set search_path = '' as $$
  select private.add_map_places_batch('waypost', p_region, p_items, p_note);
$$;

create function public.admin_spot_add_batch(p_region text, p_items jsonb, p_note text default null)
returns jsonb language sql security definer set search_path = '' as $$
  select private.add_map_places_batch('spot', p_region, p_items, p_note);
$$;

create function public.admin_area_suggest(p_region text, p_kind text, p_south double precision,
  p_west double precision, p_north double precision, p_east double precision, p_spacing_m double precision)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  region private.game_regions;
  candidate record;
  picks jsonb := '[]';
  cells text[] := '{}';
begin
  perform private.require_game_editor();
  if p_kind is null or p_kind not in ('waypost','spot') then raise exception 'bad_kind'; end if;
  if (p_south >= -90 and p_north <= 90 and p_south < p_north
      and p_west >= -180 and p_east <= 180 and p_west < p_east) is not true
  then raise exception 'bad_area'; end if;
  if (p_spacing_m > 0 and p_spacing_m < 'Infinity'::double precision) is not true
  then raise exception 'bad_spacing'; end if;
  if p_north - p_south > 5 or p_east - p_west > 5
    or extensions.st_area(extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::extensions.geography) > 4000000
  then raise exception 'area_too_big'; end if;
  select * into region from private.game_regions r where r.id = p_region and r.border is not null;
  if not found then raise exception 'outside_border'; end if;

  for candidate in
    with occupied as materialized (
      select p.lat, p.lng from public.public_capsule_spots p
        where p_kind = 'waypost' and p.status <> 'deleted'
      union all
      select p.lat, p.lng from public.corrupted_spots p
        where p_kind = 'spot' and p.status <> 'deleted'
    ), safe as materialized (
      select p.lat, p.lng, p.id,
        case when p_kind = 'waypost' then private.s2_cell17(p.lat, p.lng) end as cell
      from private.public_capsule_drop_places p
      where p.region_id = p_region
        and point(p.lng, p.lat) <@ box(point(p_west, p_south), point(p_east, p_north))
        and extensions.st_covers(region.border, extensions.st_setsrid(extensions.st_makepoint(p.lng, p.lat), 4326))
    )
    select s.lat, s.lng, s.cell from safe s
    where (s.cell is null or not exists (select 1 from public.public_capsule_spots p
      where p.status <> 'deleted' and p.s2_cell17 = s.cell))
      and not exists (select 1 from occupied o
        where public.distance_m(s.lat, s.lng, o.lat, o.lng) < p_spacing_m)
    order by s.lat, s.lng, s.id
  loop
    if candidate.cell = any(cells) or exists (
      select 1 from jsonb_to_recordset(picks) as p(lat double precision, lng double precision)
      where public.distance_m(candidate.lat, candidate.lng, p.lat, p.lng) < p_spacing_m
    ) then continue; end if;
    picks := picks || jsonb_build_array(jsonb_build_object('lat', candidate.lat, 'lng', candidate.lng));
    if candidate.cell is not null then cells := array_append(cells, candidate.cell); end if;
    exit when jsonb_array_length(picks) = 100;
  end loop;
  return picks;
end;
$$;

create or replace function public.admin_undo(p_action_id bigint, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event private.admin_actions;
  post public.public_capsule_spots;
  old_post public.public_capsule_spots;
  spot public.corrupted_spots;
  old_spot public.corrupted_spots;
  target uuid;
  kind text;
  is_batch boolean;
  is_status boolean;
  is_add boolean;
  current_state jsonb;
  expected jsonb;
  previous jsonb;
  before_rows jsonb := '{}';
  after_rows jsonb := '{}';
  saved jsonb;
  status_fields text[] := array['status','game_enabled','hidden_at','first_spawn_wave'];
  recheck_hunts boolean := false;
begin
  select * into event from private.admin_actions where id = p_action_id;
  if not coalesce(event.action in ('waypost.add','waypost.edit','waypost.move','waypost.hide','waypost.show',
    'spot.add','spot.move','spot.hide','spot.show','waypost.status','spot.status','waypost.add_batch','spot.add_batch'), false)
  then return private.admin_undo_before_map_builder(p_action_id, p_note); end if;

  perform private.require_game_editor();
  perform private.lock_game_edits();
  kind := split_part(event.action, '.', 1);
  is_status := event.action in ('waypost.status','spot.status');
  is_batch := event.target_type in ('waypost_batch','spot_batch');
  is_add := event.action in ('waypost.add','spot.add','waypost.add_batch','spot.add_batch');

  for target in select unnest(string_to_array(event.target_id, ',')::uuid[]) loop
    if exists (
      select 1 from private.admin_actions a
      where a.id > event.id and a.target_type in (kind, kind || '_batch')
        and target::text = any(string_to_array(a.target_id, ','))
    ) then raise exception 'stale'; end if;

    if kind = 'waypost' then
      select * into post from public.public_capsule_spots where id = target for update;
      if not found or post.kind = 'landmark' then raise exception 'stale'; end if;
      current_state := to_jsonb(post);
    else
      select * into spot from public.corrupted_spots where id = target for update;
      if not found then raise exception 'stale'; end if;
      current_state := to_jsonb(spot);
    end if;

    previous := case when is_batch then event.before->target::text else event.before end;
    if is_status then
      if current_state->>'status' is distinct from event.after->>'status'
        or (current_state - status_fields) is distinct from (previous - status_fields)
      then raise exception 'stale'; end if;
    else
      expected := case when is_batch then event.after->'rows'->target::text else event.after end;
      -- Actions before R1.5 have neither status nor the new draft snapshots.
      -- The old status and spawn metadata are still valid for those actions.
      if not (expected ? 'status') then current_state := current_state - 'status'; end if;
      if kind = 'waypost' and not (expected ? 's2_cell17') then
        current_state := current_state - array['s2_cell17','photo','photo_credit'];
      elsif kind = 'spot' and not (expected ? 'first_spawn_wave') then
        current_state := current_state - 'first_spawn_wave';
      end if;
      if current_state is distinct from expected then raise exception 'stale'; end if;
    end if;

    if kind = 'waypost' then
      old_post := jsonb_populate_record(null::public.public_capsule_spots, previous);
      update public.public_capsule_spots w set
        status = case when is_add then case when is_batch then 'deleted' else 'hidden' end
          else coalesce(old_post.status,
            case when old_post.game_enabled and old_post.hidden_at is null then 'live' else 'hidden' end) end,
        hidden_at = case when is_add then now() else old_post.hidden_at end,
        lat = case when is_add then post.lat else old_post.lat end,
        lng = case when is_add then post.lng else old_post.lng end,
        name_zh = case when is_add then post.name_zh else old_post.name_zh end,
        name_en = case when is_add then post.name_en else old_post.name_en end,
        scene = case when is_add then post.scene else old_post.scene end,
        photo = case when is_add then post.photo else old_post.photo end,
        photo_credit = case when is_add then post.photo_credit else old_post.photo_credit end
      where id = target returning to_jsonb(w) into saved;
      recheck_hunts := recheck_hunts or (post.status = 'live' and
        (saved->>'status' <> 'live' or (post.lat, post.lng) is distinct from (old_post.lat, old_post.lng)));
    else
      old_spot := jsonb_populate_record(null::public.corrupted_spots, previous);
      update public.corrupted_spots s set
        status = case when is_add then case when is_batch then 'deleted' else 'hidden' end
          else coalesce(old_spot.status, case when old_spot.hidden_at is not null then 'hidden' else 'live' end) end,
        hidden_at = case when is_add then now() else old_spot.hidden_at end,
        lat = case when is_add then spot.lat else old_spot.lat end,
        lng = case when is_add then spot.lng else old_spot.lng end,
        first_spawn_wave = case when is_add or not (previous ? 'first_spawn_wave')
          then spot.first_spawn_wave else old_spot.first_spawn_wave end
      where id = target returning to_jsonb(s) into saved;
    end if;
    before_rows := before_rows || jsonb_build_object(target, current_state);
    after_rows := after_rows || jsonb_build_object(target, saved);
  end loop;

  if recheck_hunts then perform private.assert_map_builder_hunts(); end if;
  perform private.admin_log('undo', event.target_type, event.target_id, event.target_label,
    case when is_batch then before_rows else current_state end,
    (case when is_batch then jsonb_build_object('rows', after_rows) else saved end)
      || jsonb_build_object('undo_of', event.id), p_note);
  return case when is_batch then after_rows else saved end;
end;
$$;

revoke all on function
  private.assert_map_builder_hunts(uuid[]),
  private.sync_waypost_status(), private.sync_corrupted_spot_status(),
  private.create_map_waypost(text,double precision,double precision,text,text,text,text,text,text),
  private.create_map_spot(text,double precision,double precision,text,text),
  private.add_map_places_batch(text,text,jsonb,text),
  public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text,text,text,text),
  public.admin_spot_add(text,double precision,double precision,text,text,text),
  public.admin_place_set_status(text,uuid[],text,text),
  public.admin_waypost_add_batch(text,jsonb,text), public.admin_spot_add_batch(text,jsonb,text),
  public.admin_area_suggest(text,text,double precision,double precision,double precision,double precision,double precision)
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text,text,text,text),
  public.admin_spot_add(text,double precision,double precision,text,text,text),
  public.admin_place_set_status(text,uuid[],text,text),
  public.admin_waypost_add_batch(text,jsonb,text), public.admin_spot_add_batch(text,jsonb,text),
  public.admin_area_suggest(text,text,double precision,double precision,double precision,double precision,double precision)
to authenticated;

commit;
