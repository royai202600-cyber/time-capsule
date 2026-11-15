begin;

alter table public.public_capsule_spots add column hidden_at timestamptz;
alter table public.corrupted_spots add column hidden_at timestamptz;

-- A wave number identifies one interval permanently. The initial period preserves
-- every existing number, and each later period starts at its predecessor's next number.
create table private.game_wave_periods (
  starts_at timestamptz primary key,
  first_wave bigint not null unique,
  minutes integer not null check (minutes in (5,10,15,20,30,60))
);
insert into private.game_wave_periods
select to_timestamp(0), 0, wave_minutes from private.game_config where singleton;

create function private.game_wave_at(p_at timestamptz)
returns table (wave bigint, starts_at timestamptz, ends_at timestamptz, minutes integer)
language sql stable set search_path = '' as $$
  select p.first_wave + w.offset_number,
    p.starts_at + w.offset_number * make_interval(mins => p.minutes),
    p.starts_at + (w.offset_number + 1) * make_interval(mins => p.minutes), p.minutes
  from (select * from private.game_wave_periods where starts_at <= p_at order by starts_at desc limit 1) p
  cross join lateral (select floor(extract(epoch from p_at - p.starts_at) / (p.minutes * 60))::bigint
    as offset_number) w;
$$;

create function private.game_wave_by_number(p_wave bigint)
returns table (wave bigint, starts_at timestamptz, ends_at timestamptz, minutes integer)
language sql stable set search_path = '' as $$
  select p_wave,
    p.starts_at + (p_wave - p.first_wave) * make_interval(mins => p.minutes),
    p.starts_at + (p_wave - p.first_wave + 1) * make_interval(mins => p.minutes), p.minutes
  from private.game_wave_periods p where p.first_wave <= p_wave order by p.first_wave desc limit 1;
$$;

-- Keep the current wave's rules available until it ends, including when the
-- catalogue is changed by an agent migration instead of the admin console.
create table private.game_spawn_revisions (
  starts_at timestamptz primary key,
  config private.game_config not null,
  rules private.vessel_spawn_rules[] not null,
  places private.vessel_spawn_places[] not null
);

create function private.stage_game_spawn(p_start timestamptz) returns void
language sql set search_path = '' as $$
  insert into private.game_spawn_revisions (starts_at, config, rules, places)
  select p_start, c, array(select r from private.vessel_spawn_rules r order by r.vessel),
    array(select p from private.vessel_spawn_places p order by p.region_id, p.vessel)
  from private.game_config c where c.singleton
  on conflict (starts_at) do update set config = excluded.config, rules = excluded.rules, places = excluded.places;
$$;
select private.stage_game_spawn('-infinity'::timestamptz);

create function private.game_spawn_at(p_at timestamptz) returns private.game_spawn_revisions
language sql stable set search_path = '' as $$
  select r from private.game_spawn_revisions r where starts_at <= p_at order by starts_at desc limit 1;
$$;

create function private.game_spawn_city_rules(p_revision private.game_spawn_revisions, p_city text)
returns private.vessel_spawn_rules[]
language sql stable set search_path = '' as $$
  select array(select r from unnest(p_revision.rules) r
    where exists (select 1 from private.game_regions g
      join unnest(p_revision.places) p on p.region_id in (g.id, g.parent_id)
      where g.city = p_city and p.vessel = r.vessel));
$$;

create function private.lock_game_edits() returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(72143006820261115);
$$;

create function private.lock_spawn_edit() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform private.lock_game_edits();
  return null;
end;
$$;

create function private.stage_spawn_edit() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform private.stage_game_spawn((select w.ends_at from private.game_wave_at(now()) w));
  return null;
end;
$$;

create trigger lock_spawn_rules before insert or update or delete on private.vessel_spawn_rules
for each statement execute function private.lock_spawn_edit();
create trigger stage_spawn_rules after insert or update or delete on private.vessel_spawn_rules
for each statement execute function private.stage_spawn_edit();
create trigger lock_spawn_places before insert or update or delete on private.vessel_spawn_places
for each statement execute function private.lock_spawn_edit();
create trigger stage_spawn_places after insert or update or delete on private.vessel_spawn_places
for each statement execute function private.stage_spawn_edit();
create trigger lock_spawn_config before update of spawn_chance, rarity_common_weight, rarity_uncommon_weight,
  rarity_rare_weight, nearby_spawn_target on private.game_config
for each statement execute function private.lock_spawn_edit();
create trigger stage_spawn_config after update of spawn_chance, rarity_common_weight, rarity_uncommon_weight,
  rarity_rare_weight, nearby_spawn_target on private.game_config
for each statement execute function private.stage_spawn_edit();

alter table private.game_wave_periods enable row level security;
alter table private.game_spawn_revisions enable row level security;
revoke all on private.game_wave_periods, private.game_spawn_revisions from public, anon, authenticated, service_role;
-- Preload the same game secret once for a whole map or preview. Interpret its
-- HMAC's first four bytes as the unsigned fraction used by the live game.
create function private.game_roll(p_key text, p_secret bytea) returns double precision
language sql immutable strict as $$
  select ('x' || pg_catalog.encode(pg_catalog.substr(
    extensions.hmac(pg_catalog.convert_to(p_key, 'UTF8'), p_secret, 'sha256'), 1, 4), 'hex'))::bit(32)::bigint::double precision
    / 4294967296::double precision;
$$;

create type private.game_spawn_pool as (common text[], uncommon text[], rare text[]);

-- Habitats and local windows only depend on the city, wave and kind of spot.
-- Build each pool once, then keep the spot-specific rolls in the resolver.
create function private.game_spawn_pool(p_rules private.vessel_spawn_rules[], p_habitat text, p_local timestamp)
returns private.game_spawn_pool language sql stable as $$
  select array_agg(r.vessel) filter (where r.rarity = 'common'),
    array_agg(r.vessel) filter (where r.rarity = 'uncommon'),
    array_agg(r.vessel) filter (where r.rarity = 'rare')
  from unnest(p_rules) r
  cross join lateral (select extract(hour from p_local)::integer as hour, to_char(p_local, 'MM-DD') as md) t
  where (r.habitat is null or r.habitat = p_habitat)
    and (r.local_start_hour is null
      or (r.local_start_hour < r.local_end_hour and t.hour >= r.local_start_hour and t.hour < r.local_end_hour)
      or (r.local_start_hour > r.local_end_hour and (t.hour >= r.local_start_hour or t.hour < r.local_end_hour)))
    and (r.month_day_start is null
      or (r.month_day_start <= r.month_day_end and t.md between r.month_day_start and r.month_day_end)
      or (r.month_day_start > r.month_day_end and (t.md >= r.month_day_start or t.md <= r.month_day_end)));
$$;

create function private.resolve_spawn_batch(p_spots uuid[], p_wave bigint, wave_end timestamptz,
  cfg private.game_config, pool private.game_spawn_pool, secret bytea)
returns table (spot uuid, spawn_id text, vessel text, rarity text, expires_at timestamptz)
language sql stable as $$
  with seeds as materialized (
    select p.id, p.id::text || ':' || p_wave as seed from unnest(p_spots) p(id)
  ), shown as materialized (
    select s.*, private.game_roll(s.seed || ':rarity', secret) as roll
    from seeds s where cfg.spawn_chance = 1 or private.game_roll(s.seed || ':show', secret) < cfg.spawn_chance
  ), choice as materialized (
    select s.*, case
      when s.roll < cfg.rarity_common_weight / w.total then 'common'
      when s.roll < (cfg.rarity_common_weight + cfg.rarity_uncommon_weight) / w.total then 'uncommon'
      else 'rare' end as tier
    from shown s cross join lateral (select
      (cfg.rarity_common_weight + cfg.rarity_uncommon_weight + cfg.rarity_rare_weight)::float8 as total) w
  ), eligible as materialized (
    select c.*, case when c.tier = 'rare' and pool.rare is not null then 'rare'
      when c.tier <> 'common' and pool.uncommon is not null then 'uncommon'
      when pool.common is not null then 'common'
      when pool.uncommon is not null then 'uncommon'
      when pool.rare is not null then 'rare' end as chosen
    from choice c
  ), options as materialized (
    select e.*, case e.chosen when 'common' then pool.common
      when 'uncommon' then pool.uncommon else pool.rare end as vessels from eligible e
  )
  select o.id, o.seed, case when cardinality(o.vessels) = 1 then o.vessels[1] else (
    select v.id from unnest(o.vessels) v(id)
    order by pg_catalog.substr(extensions.hmac(pg_catalog.convert_to(o.seed || ':vessel:' || v.id, 'UTF8'),
      secret, 'sha256'), 1, 4), v.id limit 1
  ) end, o.chosen, wave_end
  from options o where o.vessels is not null;
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
    and case when p.source_ref ~ '^qa:roy-taipei-game:[0-9]+:[0-9]+$'
      then split_part(p.source_ref, ':', 3)::bigint = p_wave else true end;
$function$;

CREATE OR REPLACE FUNCTION private.refresh_taipei_game_demo()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  batch bigint := (select w.wave from private.game_wave_at(now()) w);
  i integer; n integer; spot uuid; released record;
  north double precision; east double precision; demo_lat double precision; demo_lng double precision;
  placed boolean;
  -- OSM way/309157011, inspected 2026-11-09. Clip samples to the public park polygon.
  safe_area polygon := '((121.5634500,25.0390412),(121.5634144,25.0373910),(121.5633978,25.0366291),(121.5633737,25.0360564),(121.5633501,25.0360012),(121.5631544,25.0360047),(121.5620735,25.0360240),(121.5620570,25.0360396),(121.5620932,25.0377011),(121.5620942,25.0377529),(121.5623006,25.0377481),(121.5623019,25.0378122),(121.5623114,25.0382507),(121.5623209,25.0387012),(121.5623233,25.0388075),(121.5623255,25.0389155),(121.5623275,25.0390118),(121.5623291,25.0390898),(121.5634181,25.0390713),(121.5634500,25.0390412))';
begin
  perform pg_advisory_xact_lock(hashtext('roy-taipei-game-demo'));
  if (select count(*) from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:'||batch||':%')=5 then return; end if;
  delete from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:%';
  for i in 1..5 loop
    placed := false;
    for n in 1..2000 loop
      -- Independent random positions; no ring, grid, equal angles or fixed radii.
      north := random()*176-88; east := random()*176-88;
      if north*north+east*east not between 28*28 and 88*88 then continue; end if;
      demo_lat := 25.037546+north/111195;
      demo_lng := 121.562754+east/(111195*cos(radians(25.037546)));
      if not point(demo_lng,demo_lat) <@ safe_area then continue; end if;
      if exists(select 1 from public.corrupted_spots s where s.source_ref like 'qa:roy-taipei-game:%'
        and public.distance_m(demo_lat,demo_lng,s.lat,s.lng)<36) then continue; end if;
      spot := gen_random_uuid();
      insert into public.corrupted_spots(id,city,timezone,lat,lng,habitat,source_ref)
        values(spot,'Taipei','Asia/Taipei',demo_lat,demo_lng,'square','qa:roy-taipei-game:'||batch||':'||i);
      select * into released from private.resolve_spawn(spot,batch);
      if released.spawn_id is not null and released.expires_at>now() then placed:=true; exit; end if;
      delete from public.corrupted_spots where id=spot;
    end loop;
    if not placed then raise exception 'Could not place temporary Taipei test batch'; end if;
  end loop;
end $function$;

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
    where s.game_enabled
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
    'lat',s.lat,'lng',s.lng,'scene',s.scene,
    'cooldown_end',case when s.kind='common'
      then (select max(spun_at)+make_interval(secs=>cfg.spin_cooldown_seconds)
        from public.waypost_spins x where x.user_id=auth.uid() and x.waypost_id=s.id)
      else null end)
    order by s.distance,s.id),'[]'::jsonb) into result_wayposts
  from shown s;
  return jsonb_build_object('spawns',result_spawns,'wayposts',result_wayposts);
end $function$;

CREATE OR REPLACE FUNCTION public.corrupted_capsule_throw(p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision, p_ball text, p_ring double precision, p_hit boolean)
 RETURNS TABLE(result text, vessel text, copies integer, stars integer, is_new boolean, xp_gained integer, wax_balls integer, gold_balls integer, attempts_left integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pg public.player_game; cfg private.game_config; spot public.corrupted_spots;
  released record; caught public.corrupted_catches; wave bigint; current_wave bigint;
  chance double precision; did_catch boolean;
begin
  if p_spawn is null or p_spawn !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9]{1,18}$'
    then raise exception 'expired'; end if;
  if p_ball is null or p_ball not in ('wax','gold') or p_ring is null or p_hit is null
    or p_ring::text in ('NaN','Infinity','-Infinity') then raise exception 'rejected'; end if;
  pg := private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  wave := split_part(p_spawn,':',2)::bigint;
  current_wave := (select w.wave from private.game_wave_at(now()) w);
  if wave not between current_wave-1 and current_wave then raise exception 'expired'; end if;
  select * into spot from public.corrupted_spots where id=split_part(p_spawn,':',1)::uuid and hidden_at is null for share;
  if spot.id is null then raise exception 'expired'; end if;
  select * into released from private.resolve_spawn(spot.id,wave);
  if released.spawn_id is null or released.spawn_id<>p_spawn or released.expires_at<=now()
    then raise exception 'expired'; end if;
  if public.distance_m(p_lat,p_lng,spot.lat,spot.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  select * into caught from public.corrupted_catches
    where user_id=auth.uid() and spawn_id=p_spawn for update;
  if caught.result='caught' then raise exception 'already_caught'; end if;
  if coalesce(caught.attempts,0)>=cfg.max_attempts then raise exception 'no_attempts'; end if;
  if (p_ball='wax' and pg.wax_balls<1) or (p_ball='gold' and pg.gold_balls<1)
    then raise exception 'no_balls'; end if;
  update public.player_game set
    wax_balls=public.player_game.wax_balls-case when p_ball='wax' then 1 else 0 end,
    gold_balls=public.player_game.gold_balls-case when p_ball='gold' then 1 else 0 end
    where user_id=auth.uid() returning * into pg;
  vessel := released.vessel; result := 'miss'; copies := null; stars := null;
  is_new := false; xp_gained := 0;
  attempts_left := cfg.max_attempts-coalesce(caught.attempts,0);
  if p_hit then
    insert into public.corrupted_catches(user_id,spawn_id,attempts,result,vessel)
      values(auth.uid(),p_spawn,1,'pending',vessel)
      on conflict (user_id,spawn_id) do update
      set attempts=public.corrupted_catches.attempts+1
      returning * into caught;
    attempts_left := greatest(0,cfg.max_attempts-caught.attempts);
    chance := case released.rarity when 'common' then cfg.restore_common
      when 'uncommon' then cfg.restore_uncommon else cfg.restore_rare end;
    chance := least(1.0,chance+cfg.restore_ring_bonus*least(1.0,greatest(0.0,p_ring))
      +case when p_ball='gold' then cfg.restore_gold_bonus else 0 end);
    did_catch := random()<chance;
    if did_catch then
      update public.corrupted_catches set result='caught',caught_at=now()
        where user_id=auth.uid() and spawn_id=p_spawn;
      is_new := not exists (select 1 from public.owned_vessels
        where user_id=auth.uid() and public.owned_vessels.vessel=corrupted_capsule_throw.vessel);
      insert into public.owned_vessels(user_id,vessel,copies)
        values(auth.uid(),vessel,1)
        on conflict on constraint owned_vessels_pkey do update
          set copies=public.owned_vessels.copies+1
        returning public.owned_vessels.copies into copies;
      select count(*)::integer into stars from unnest(cfg.star_thresholds) threshold
        where threshold<=copies;
      xp_gained := private.award_xp(auth.uid(),'catch',p_spawn,cfg.xp_catch);
      if is_new then xp_gained := xp_gained+
        private.award_xp(auth.uid(),'new_vessel',vessel,cfg.xp_new_vessel); end if;
      xp_gained := xp_gained+private.award_xp(auth.uid(),'first_catch_day',
        (now() at time zone 'UTC')::date::text,cfg.xp_first_daily_catch);
      result := 'restored';
      begin
        perform private.city_hunt_record_quest('restore',spot.id,p_lat,p_lng);
      exception when others then
        raise warning 'hunt restore bookkeeping failed: %',sqlerrm;
      end;
    else
      update public.corrupted_catches set result=case when attempts>=cfg.max_attempts
        then 'failed' else 'pending' end
        where user_id=auth.uid() and spawn_id=p_spawn;
      result := 'not_restored';
    end if;
  end if;
  wax_balls:=pg.wax_balls; gold_balls:=pg.gold_balls;
  return next;
end $function$;

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
    from public.corrupted_spots p where p.city = p_city and p.hidden_at is null
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
    'wayposts', (select jsonb_build_object(
      'common', count(*) filter (where p.kind = 'common'),
      'landmark', count(*) filter (where p.kind = 'landmark'))
      from public.public_capsule_spots p where p.city_en = p_region.city and p.game_enabled),
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
  left join private.game_map_coverage b on b.id = area.id;
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
        'scene', p.scene, 'hidden_at', p.hidden_at
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

CREATE OR REPLACE FUNCTION public.admin_spawning()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  return (
    with cities as materialized (
      select g.*, date_trunc('day', now() at time zone g.timezone) at time zone g.timezone as day_start,
        date_trunc('week', now() at time zone g.timezone) at time zone g.timezone as week_start
      from private.game_regions g where g.center_lat is not null
    ), caught as (
      select p.city, count(*) filter (where c.caught_at >= g.day_start) as today, count(*) as week
      from cities g join public.corrupted_spots p on p.city = g.city
      join public.corrupted_catches c on split_part(c.spawn_id, ':', 1) = p.id::text
      where c.result = 'caught' and c.caught_at >= g.week_start
        and p.source_ref not like 'qa:roy-taipei-game:%'
      group by p.city
    )
    select jsonb_build_object(
      'config', jsonb_build_object(
        'wave_minutes', (select w.minutes from private.game_wave_at(now()) w),
        'next_length', (select jsonb_build_object('minutes', w.minutes, 'starts_at', w.starts_at)
          from private.game_wave_periods w where w.starts_at > now() order by w.starts_at limit 1),
        'spawn_chance', cfg.spawn_chance, 'nearby_max', cfg.nearby_spawn_target,
        'weights', jsonb_build_object('common', cfg.rarity_common_weight,
          'uncommon', cfg.rarity_uncommon_weight, 'rare', cfg.rarity_rare_weight)),
      'places', (select jsonb_agg(jsonb_build_object('id', g.id, 'parent', g.parent_id,
        'name_zh', g.name_zh, 'name_en', g.name_en, 'country_zh', g.country_zh, 'country_en', g.country_en,
        'has_spots', exists (select 1 from private.game_regions child
          join public.corrupted_spots p on p.city = child.city and p.source_ref not like 'qa:%'
          where g.id in (child.id, child.parent_id))) order by g.country_en, g.name_en)
        from private.game_regions g),
      'rules', (select coalesce(jsonb_agg(jsonb_build_object(
        'vessel', v.id, 'rarity', r.rarity, 'habitat', r.habitat,
        'hours', case when r.local_start_hour is not null then jsonb_build_array(r.local_start_hour, (r.local_end_hour + 23) % 24) end,
        'dates', case when r.month_day_start is not null then jsonb_build_array(r.month_day_start, r.month_day_end) end,
        'regions', (select coalesce(jsonb_agg(g.id order by g.id), '[]'::jsonb) from cities g
          where exists (select 1 from private.vessel_spawn_places a where a.vessel = v.id
            and a.region_id in (g.id, g.parent_id))),
        'places', (select coalesce(jsonb_agg(a.region_id order by a.region_id), '[]'::jsonb)
          from private.vessel_spawn_places a where a.vessel = v.id),
        'never', case when v.earned_place is not null then 'earned'
          when v.brand is not null or v.edition_total is not null then 'brand'
          when v.id in ('dome', 'bottle', 'envelope', 'tin') then 'starter' end
        ) order by v.sort, v.id), '[]'::jsonb)
        from public.vessels v left join private.vessel_spawn_rules r on r.vessel = v.id),
      'stats', (select coalesce(jsonb_object_agg(g.id, jsonb_build_object(
        'out_now', (select count(*) from private.admin_wave(g.city) where not caught),
        'caught_today', coalesce(c.today, 0), 'caught_week', coalesce(c.week, 0))), '{}'::jsonb)
        from cities g left join caught c on c.city = g.city)
    )
    from private.game_config cfg where cfg.singleton
  );
end;
$function$;

create or replace view private.public_capsule_points with (security_invoker = true) as
 SELECT public_capsule_spots.id,
    false AS corrupted,
    public_capsule_spots.lat,
    public_capsule_spots.lng,
    public_capsule_spots.name_zh,
    public_capsule_spots.name_en,
    public_capsule_spots.city_en,
    (public_capsule_spots.hidden_at IS NULL AND (public_capsule_spots.game_enabled OR public_capsule_spots.public_drop)) AS eligible,
    false AS drop_place,
    point(public_capsule_spots.lng, public_capsule_spots.lat) AS location
   FROM public_capsule_spots
UNION ALL
 SELECT s.id,
    true AS corrupted,
    s.lat,
    s.lng,
    COALESCE(w.name_zh, g.name_zh, s.city) AS name_zh,
    COALESCE(w.name_en, s.city) AS name_en,
    s.city AS city_en,
    (s.hidden_at IS NULL AND s.source_ref !~~ 'qa:%'::text) AS eligible,
    false AS drop_place,
    point(s.lng, s.lat) AS location
   FROM ((corrupted_spots s
     LEFT JOIN private.game_regions g ON ((g.city = s.city)))
     LEFT JOIN public_capsule_spots w ON ((w.source_ref = s.source_ref)))
UNION ALL
 SELECT d.id,
    false AS corrupted,
    d.lat,
    d.lng,
    g.name_zh,
    g.name_en,
    g.city AS city_en,
    true AS eligible,
    true AS drop_place,
    point(d.lng, d.lat) AS location
   FROM (private.public_capsule_drop_places d
     JOIN private.game_regions g ON ((g.id = d.region_id)));

CREATE OR REPLACE FUNCTION private.game_roll(p_key text)
 RETURNS double precision

 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.game_roll(p_key, k.secret) from private.game_secret k where k.singleton;
$function$;
create function private.require_game_editor() returns void
language plpgsql stable set search_path = '' as $$
begin
  if not private.admin_can('edit') then raise exception 'forbidden'; end if;
end;
$$;

create function private.admin_inside_coverage(p_region text, p_lat double precision, p_lng double precision)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from private.game_regions r join private.game_map_coverage b on b.id = r.coverage_id
    where r.id = p_region and p_lat between b.south and b.north and p_lng between b.west and b.east);
$$;

create function private.admin_nearest_waypost(p_lat double precision, p_lng double precision, p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'name_zh', p.name_zh, 'name_en', p.name_en,
    'meters', public.distance_m(p_lat, p_lng, p.lat, p.lng))
  from public.public_capsule_spots p
  where p.game_enabled and p.id is distinct from p_id
    and p_lat between -90 and 90 and p_lng between -180 and 180
  order by public.distance_m(p_lat, p_lng, p.lat, p.lng), p.id limit 1;
$$;

create function private.admin_waypost_hunts(p_lat double precision, p_lng double precision, p_id uuid)
returns table (id text, name_zh text, name_en text, wayposts_left bigint, wayposts_needed integer)
language sql stable set search_path = '' as $$
  select h.id, h.name_zh, h.name_en,
    (select count(*) from public.public_capsule_spots p where p.game_enabled and p.kind = 'common'
      and p.id is distinct from p_id
      and public.distance_m(p.lat, p.lng, h.area_lat, h.area_lng) <= h.area_radius_m),
    coalesce((select max(q.goal) from public.city_hunt_quests q where q.hunt_id = h.id and q.quest_type = 'spin'), 0)
  from public.hunts h
  where h.kind = 'system' and h.status = 'published' and h.hidden_at is null
    and h.starts_at <= now() and now() < h.ends_at
    and public.distance_m(p_lat, p_lng, h.area_lat, h.area_lng) <= h.area_radius_m;
$$;

create function public.admin_waypost_check(p_region text, p_lat double precision, p_lng double precision,
  p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  return jsonb_build_object('inside_coverage', private.admin_inside_coverage(p_region, p_lat, p_lng),
    'nearest', private.admin_nearest_waypost(p_lat, p_lng, p_id),
    'live_hunts', (select coalesce(jsonb_agg(to_jsonb(h) order by h.id), '[]'::jsonb)
      from private.admin_waypost_hunts(p_lat, p_lng, p_id) h));
end;
$$;

create function private.admin_waypost_row(p_id uuid) returns public.public_capsule_spots
language plpgsql set search_path = '' as $$
declare p public.public_capsule_spots;
begin
  select * into p from public.public_capsule_spots s where s.id = p_id
    and (s.game_enabled or s.hidden_at is not null) for update;
  if not found then raise exception 'not_found'; end if;
  if p.kind = 'landmark' then raise exception 'landmark'; end if;
  return p;
end;
$$;

create function private.save_admin_waypost(p_before public.public_capsule_spots,
  p_after public.public_capsule_spots, p_note text) returns public.public_capsule_spots
language plpgsql set search_path = '' as $$
declare region text;
declare nearest jsonb;
declare moved boolean := p_before.id is null or (p_before.lat, p_before.lng) is distinct from (p_after.lat, p_after.lng);
begin
  if p_before.id is null or (p_before.name_zh, p_before.name_en) is distinct from (p_after.name_zh, p_after.name_en) then
    if nullif(btrim(p_after.name_en), '') is null or nullif(btrim(p_after.name_zh), '') is null
      or p_after.name_zh !~ '[一-鿿㐀-䶿]' or p_after.name_zh ~ '[A-Za-z]'
    then raise exception 'bad_name'; end if;
  end if;
  if p_before.id is null or p_before.scene is distinct from p_after.scene then
    if p_after.scene is null or p_after.scene not in ('park','garden','waterfront','square','publicArt')
    then raise exception 'bad_scene'; end if;
  end if;
  if moved then
    select r.id into region from private.game_regions r where r.city = p_after.city_en;
    if not private.admin_inside_coverage(region, p_after.lat, p_after.lng)
    then raise exception 'outside_coverage'; end if;
    nearest := private.admin_nearest_waypost(p_after.lat, p_after.lng, p_before.id);
    if (nearest->>'meters')::double precision < 250 and nullif(btrim(p_note), '') is null
    then raise exception 'too_close'; end if;
  end if;
  if p_before.game_enabled and (not p_after.game_enabled or moved) and exists (
    select 1 from private.admin_waypost_hunts(p_before.lat, p_before.lng, p_before.id) h
    where h.wayposts_left < h.wayposts_needed
      and (not p_after.game_enabled or not exists (
        select 1 from private.admin_waypost_hunts(p_after.lat, p_after.lng, p_before.id) target where target.id = h.id))
  ) then raise exception 'hunt_needs_wayposts'; end if;

  if p_before.id is null then
    insert into public.public_capsule_spots
    select (p_after).*;
  else
    update public.public_capsule_spots p set lat = p_after.lat, lng = p_after.lng,
      name_zh = p_after.name_zh, name_en = p_after.name_en, scene = p_after.scene,
      game_enabled = p_after.game_enabled, hidden_at = p_after.hidden_at
    where p.id = p_before.id returning p.* into p_after;
  end if;
  return p_after;
end;
$$;

create function public.admin_waypost_add(p_region text, p_lat double precision, p_lng double precision,
  p_name_zh text, p_name_en text, p_scene text, p_checked boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r private.game_regions;
declare p public.public_capsule_spots;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  if p_checked is not true then raise exception 'not_checked'; end if;
  select * into r from private.game_regions g where g.id = p_region and g.coverage_id is not null;
  if not found then raise exception 'outside_coverage'; end if;
  p.id := gen_random_uuid();
  p.name_zh := btrim(p_name_zh); p.name_en := btrim(p_name_en);
  p.city_zh := r.name_zh; p.city_en := r.city;
  p.lat := p_lat; p.lng := p_lng; p.scene := p_scene;
  p.kind := 'common'; p.game_enabled := true; p.public_drop := true;
  p.source_ref := 'admin:' || p.id;
  p := private.save_admin_waypost(null, p, p_note);
  perform private.admin_log('waypost.add', 'waypost', p.id::text, p.name_en, null, to_jsonb(p), p_note);
  return to_jsonb(p);
end;
$$;

create function public.admin_waypost_update(p_id uuid, p_lat double precision default null,
  p_lng double precision default null, p_name_zh text default null, p_name_en text default null,
  p_scene text default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.public_capsule_spots;
declare saved public.public_capsule_spots;
declare action text;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  p := private.admin_waypost_row(p_id);
  saved := p;
  saved.lat := coalesce(p_lat, p.lat); saved.lng := coalesce(p_lng, p.lng);
  saved.name_zh := coalesce(btrim(p_name_zh), p.name_zh);
  saved.name_en := coalesce(btrim(p_name_en), p.name_en);
  saved.scene := coalesce(p_scene, p.scene);
  action := case when (p.lat, p.lng) is distinct from (saved.lat, saved.lng) then 'waypost.move' else 'waypost.edit' end;
  saved := private.save_admin_waypost(p, saved, p_note);
  perform private.admin_log(action, 'waypost', p.id::text, saved.name_en, to_jsonb(p), to_jsonb(saved), p_note);
  return to_jsonb(saved);
end;
$$;

create function public.admin_waypost_set_visible(p_id uuid, p_visible boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.public_capsule_spots;
declare saved public.public_capsule_spots;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  if p_visible is null then raise exception 'bad_visibility'; end if;
  p := private.admin_waypost_row(p_id);
  saved := p;
  saved.game_enabled := p_visible;
  saved.hidden_at := case when not p_visible then coalesce(p.hidden_at, now()) end;
  saved := private.save_admin_waypost(p, saved, p_note);
  perform private.admin_log(case when p_visible then 'waypost.show' else 'waypost.hide' end,
    'waypost', p.id::text, saved.name_en, to_jsonb(p), to_jsonb(saved), p_note);
  return to_jsonb(saved);
end;
$$;

create function public.admin_spot_set_visible(p_id uuid, p_visible boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.corrupted_spots;
declare saved public.corrupted_spots;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  if p_visible is null then raise exception 'bad_visibility'; end if;
  select * into p from public.corrupted_spots s where s.id = p_id and s.source_ref not like 'qa:%' for update;
  if not found then raise exception 'not_found'; end if;
  update public.corrupted_spots s set hidden_at = case when not p_visible then coalesce(p.hidden_at, now()) end
    where s.id = p_id returning s.* into saved;
  perform private.admin_log(case when p_visible then 'spot.show' else 'spot.hide' end,
    'spot', p.id::text, p.city, to_jsonb(p), to_jsonb(saved), p_note);
  return to_jsonb(saved);
end;
$$;
create function private.admin_assert_spawn_pool() returns void
language plpgsql stable set search_path = '' as $$
begin
  if exists (
    select 1 from private.game_regions g
    where exists (select 1 from public.corrupted_spots p where p.city = g.city and p.source_ref not like 'qa:%')
      and not exists (
        select 1 from private.vessel_spawn_places a join private.vessel_spawn_rules r on r.vessel = a.vessel
        where a.region_id in (g.id, g.parent_id) and r.local_start_hour is null and r.month_day_start is null)
  ) then raise exception 'place_needs_vessel'; end if;
end;
$$;

create function private.admin_spawnable(p_vessel text) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (select 1 from public.vessels v where v.id = p_vessel
    and v.id not in ('dome','bottle','envelope','tin')
    and v.earned_place is null and v.brand is null and v.edition_total is null)
  then raise exception 'not_spawnable'; end if;
end;
$$;

create function private.admin_valid_month_day(p_day text) returns boolean
language sql immutable set search_path = '' as $$
  select case when p_day ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    then right(p_day, 2)::integer <= (array[31,29,31,30,31,30,31,31,30,31,30,31])[left(p_day,2)::integer]
    else false end;
$$;

create function private.admin_wave_length_state() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('minutes', p.minutes, 'starts_at', p.starts_at, 'pending', p.starts_at > now())
  from private.game_wave_periods p order by p.starts_at desc limit 1;
$$;

create function private.admin_schedule_wave_length(p_minutes integer, p_restore_at timestamptz default null)
returns jsonb language plpgsql set search_path = '' as $$
declare current_minutes integer;
declare seconds integer;
declare boundary timestamptz;
begin
  if p_minutes is null or p_minutes not in (5,10,15,20,30,60) then raise exception 'bad_rule'; end if;
  select w.minutes into current_minutes from private.game_wave_at(now()) w;
  perform 1 from private.game_wave_periods p where p.starts_at <= now() order by p.starts_at desc limit 1 for update;
  delete from private.game_wave_periods p where p.starts_at > now();
  if p_minutes <> current_minutes then
    seconds := lcm(current_minutes, p_minutes) * 60;
    boundary := to_timestamp((floor(extract(epoch from now()) / seconds) + 1) * seconds);
    if p_restore_at > now() and mod(extract(epoch from p_restore_at), seconds) = 0 then
      boundary := p_restore_at;
    end if;
    insert into private.game_wave_periods (starts_at, first_wave, minutes)
      select boundary, w.wave, p_minutes from private.game_wave_at(boundary) w;
  end if;
  return private.admin_wave_length_state();
end;
$$;

-- The public entry points, preview and undo share the same writes and checks.
-- Only callers passing p_log append an audit event.
create function private.admin_spawn_write(p_rpc text, p_args jsonb, p_note text, p_log boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare region text := p_args->>'p_region';
declare v text := p_args->>'p_vessel';
declare rarity text := p_args->>'p_rarity';
declare habitat text := p_args->>'p_habitat';
declare start_hour integer;
declare end_hour integer;
declare md_start text := p_args->>'p_md_start';
declare md_end text := p_args->>'p_md_end';
declare chance double precision;
declare common_weight integer;
declare uncommon_weight integer;
declare rare_weight integer;
declare nearby_target integer;
declare rule private.vessel_spawn_rules;
declare assignment private.vessel_spawn_places;
declare prior jsonb;
declare saved jsonb;
declare kind text;
declare target text;
declare action text;
declare created_rule boolean := false;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  case p_rpc
    when 'admin_spawn_place_add', 'admin_spawn_place_remove' then
      perform private.admin_spawnable(v);
      if not exists (select 1 from private.game_regions g where g.id = region) then raise exception 'not_found'; end if;
      select * into assignment from private.vessel_spawn_places a where a.region_id = region and a.vessel = v for update;
      kind := 'spawn_place'; target := region || ':' || v;
      if p_rpc = 'admin_spawn_place_add' then
        if assignment.region_id is not null then raise exception 'already_assigned'; end if;
        insert into private.vessel_spawn_rules (vessel, rarity) values (v, 'common')
        on conflict (vessel) do nothing;
        created_rule := found;
        insert into private.vessel_spawn_places (region_id, vessel) values (region, v) returning * into assignment;
        saved := to_jsonb(assignment) || jsonb_build_object('created_rule', created_rule);
        action := 'spawn.place_add';
      else
        if assignment.region_id is null then raise exception 'not_found'; end if;
        prior := to_jsonb(assignment);
        delete from private.vessel_spawn_places a where a.region_id = region and a.vessel = v;
        saved := prior || jsonb_build_object('assigned', false);
        action := 'spawn.place_remove';
      end if;
    when 'admin_spawn_rule_set' then
      perform private.admin_spawnable(v);
      start_hour := (p_args->>'p_start_hour')::integer;
      end_hour := (p_args->>'p_end_hour')::integer;
      if rarity is null or rarity not in ('common','uncommon','rare')
        or (habitat is not null and habitat not in ('park','water','square'))
        or (start_hour is null) <> (end_hour is null) or start_hour not between 0 and 23 or end_hour not between 0 and 23
        or (md_start is null) <> (md_end is null)
        or (md_start is not null and not private.admin_valid_month_day(md_start))
        or (md_end is not null and not private.admin_valid_month_day(md_end))
      then raise exception 'bad_rule'; end if;
      -- A complete 24-hour selection has the same start and exclusive end.
      if end_hour = start_hour then start_hour := null; end_hour := null; end if;
      select to_jsonb(r) into prior from private.vessel_spawn_rules r where r.vessel = v for update;
      insert into private.vessel_spawn_rules (vessel, rarity, habitat, local_start_hour, local_end_hour, month_day_start, month_day_end)
      values (v, rarity, habitat, start_hour, end_hour, md_start, md_end)
      on conflict (vessel) do update set rarity = excluded.rarity, habitat = excluded.habitat,
        local_start_hour = excluded.local_start_hour, local_end_hour = excluded.local_end_hour,
        month_day_start = excluded.month_day_start, month_day_end = excluded.month_day_end
      returning * into rule;
      saved := to_jsonb(rule); kind := 'spawn_rule'; target := v; action := 'spawn.rule';
    when 'admin_wave_config_set' then
      chance := (p_args->>'p_spawn_chance')::double precision;
      common_weight := (p_args->>'p_common_weight')::integer;
      uncommon_weight := (p_args->>'p_uncommon_weight')::integer;
      rare_weight := (p_args->>'p_rare_weight')::integer;
      nearby_target := (p_args->>'p_nearby_target')::integer;
      if not coalesce(chance between 0.1 and 1 and common_weight between 0 and 100
        and uncommon_weight between 0 and 100 and rare_weight between 0 and 100
        and common_weight + uncommon_weight + rare_weight > 0 and nearby_target between 1 and 12, false)
      then raise exception 'bad_rule'; end if;
      select jsonb_build_object('spawn_chance', c.spawn_chance,
        'common_weight', c.rarity_common_weight, 'uncommon_weight', c.rarity_uncommon_weight,
        'rare_weight', c.rarity_rare_weight, 'nearby_target', c.nearby_spawn_target)
        into prior from private.game_config c where c.singleton for update;
      update private.game_config c set spawn_chance = chance, rarity_common_weight = common_weight,
        rarity_uncommon_weight = uncommon_weight, rarity_rare_weight = rare_weight,
        nearby_spawn_target = nearby_target where c.singleton;
      saved := jsonb_build_object('spawn_chance', chance, 'common_weight', common_weight,
        'uncommon_weight', uncommon_weight, 'rare_weight', rare_weight, 'nearby_target', nearby_target);
      kind := 'config'; target := 'wave'; action := 'config.wave';
    when 'admin_wave_length_set' then
      prior := private.admin_wave_length_state();
      saved := private.admin_schedule_wave_length((p_args->>'p_minutes')::integer);
      kind := 'config'; target := 'wave_length'; action := 'config.wave_length';
    else raise exception 'bad_rule';
  end case;
  perform private.admin_assert_spawn_pool();
  if p_log then
    perform private.admin_log(action, kind, target, target, prior, saved, p_note);
  end if;
  return saved;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'bad_rule';
end;
$$;

create function public.admin_spawn_place_add(p_region text, p_vessel text, p_note text default null) returns jsonb
language sql security definer set search_path = '' as $$
  select private.admin_spawn_write('admin_spawn_place_add',
    jsonb_build_object('p_region', p_region, 'p_vessel', p_vessel), p_note, true);
$$;

create function public.admin_spawn_place_remove(p_region text, p_vessel text, p_note text default null) returns jsonb
language sql security definer set search_path = '' as $$
  select private.admin_spawn_write('admin_spawn_place_remove',
    jsonb_build_object('p_region', p_region, 'p_vessel', p_vessel), p_note, true);
$$;

create function public.admin_spawn_rule_set(p_vessel text, p_rarity text, p_habitat text,
  p_start_hour integer, p_end_hour integer, p_md_start text, p_md_end text, p_note text default null) returns jsonb
language sql security definer set search_path = '' as $$
  select private.admin_spawn_write('admin_spawn_rule_set', jsonb_build_object('p_vessel', p_vessel, 'p_rarity', p_rarity,
    'p_habitat', p_habitat, 'p_start_hour', p_start_hour, 'p_end_hour', p_end_hour,
    'p_md_start', p_md_start, 'p_md_end', p_md_end), p_note, true);
$$;

create function public.admin_wave_config_set(p_spawn_chance double precision, p_common_weight integer,
  p_uncommon_weight integer, p_rare_weight integer, p_nearby_target integer, p_note text default null) returns jsonb
language sql security definer set search_path = '' as $$
  select private.admin_spawn_write('admin_wave_config_set', jsonb_build_object('p_spawn_chance', p_spawn_chance,
    'p_common_weight', p_common_weight, 'p_uncommon_weight', p_uncommon_weight, 'p_rare_weight', p_rare_weight,
    'p_nearby_target', p_nearby_target), p_note, true);
$$;

create function public.admin_wave_length_set(p_minutes integer, p_note text default null) returns timestamptz
language sql security definer set search_path = '' as $$
  select (private.admin_spawn_write('admin_wave_length_set',
    jsonb_build_object('p_minutes', p_minutes), p_note, true)->>'starts_at')::timestamptz;
$$;
create function private.admin_spawn_preview_counts(p_regions text[], p_requested_at timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  with recursive waves as (
    select w.*, 0 as n
    from private.game_wave_at(p_requested_at) previous
    cross join lateral private.game_wave_at(previous.ends_at) w
    union all
    select w.*, previous.n + 1
    from waves previous cross join lateral private.game_wave_at(previous.ends_at) w
    where w.starts_at < p_requested_at + interval '24 hours'
  ), cities as materialized (
    select g.id, g.city from private.game_regions g where g.id = any(p_regions)
  ), contexts as materialized (
    select w.wave, w.starts_at, w.ends_at, r.config, g.id, g.city,
      private.game_spawn_city_rules(r, g.city) rules, k.secret
    from waves w cross join lateral private.game_spawn_at(w.starts_at) r cross join cities g
    cross join private.game_secret k
    where w.n % 6 = 0 and k.singleton
  ), habitats as materialized (
    select p.city, p.timezone, p.habitat, array_agg(p.id) spots
    from cities g join public.corrupted_spots p on p.city = g.city
    where p.hidden_at is null and p.source_ref not like 'qa:%'
    group by p.city, p.timezone, p.habitat
  ), pools as materialized (
    select c.*, h.spots, h.timezone, h.habitat,
      private.game_spawn_pool(c.rules, h.habitat, c.starts_at at time zone h.timezone) pool
    from contexts c join habitats h on h.city = c.city
  ), totals as (
    select c.id, released.vessel, count(*) as count
    from pools c cross join lateral
      private.resolve_spawn_batch(c.spots, c.wave, c.ends_at, c.config, c.pool, c.secret) released
    group by c.id, released.vessel
  ), by_city as (
    select id, jsonb_object_agg(vessel, count) counts from totals group by id
  )
  select coalesce(jsonb_object_agg(id, counts), '{}'::jsonb) from by_city;
$$;

create function public.admin_spawn_preview(p_change jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare call_name text := p_change->>'call';
declare args jsonb := p_change->'args';
declare target_region text := args->>'p_region';
declare rpc text;
declare regions text[];
declare baseline jsonb;
declare proposed jsonb;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  rpc := case call_name when 'place_add' then 'admin_spawn_place_add'
    when 'place_remove' then 'admin_spawn_place_remove'
    when 'rule' then 'admin_spawn_rule_set' when 'wave' then 'admin_wave_config_set' end;
  if rpc is null or jsonb_typeof(args) is distinct from 'object' then raise exception 'bad_rule'; end if;
  select coalesce(array_agg(g.id order by g.id), array[]::text[]) into regions
  from private.game_regions g
  where exists (select 1 from public.corrupted_spots p where p.city = g.city and p.source_ref not like 'qa:%')
    and case
      when call_name in ('place_add','place_remove') then target_region in (g.id, g.parent_id)
      when call_name = 'rule' then exists (select 1 from private.vessel_spawn_places a
        where a.region_id in (g.id, g.parent_id) and a.vessel = args->>'p_vessel')
      else true end;
  baseline := private.admin_spawn_preview_counts(regions, now());
  begin
    perform private.admin_spawn_write(rpc, args, null, false);
    proposed := private.admin_spawn_preview_counts(regions, now());
    raise exception using errcode = 'PVA01', message = 'rollback_spawn_preview';
  exception when sqlstate 'PVA01' then
    null;
  end;
  return jsonb_build_object('regions', (select coalesce(jsonb_agg(jsonb_build_object('region', g.id,
    'before', coalesce(baseline->g.id, '{}'::jsonb), 'after', coalesce(proposed->g.id, '{}'::jsonb))
    order by g.id), '[]'::jsonb) from unnest(regions) g(id)));
end;
$$;

create function public.admin_undo(p_action_id bigint, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare event private.admin_actions;
declare post public.public_capsule_spots;
declare restored public.public_capsule_spots;
declare rule private.vessel_spawn_rules;
declare current_state jsonb;
declare saved jsonb;
declare p_region text;
declare p_vessel text;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  select * into event from private.admin_actions a where a.id = p_action_id;
  if not found then raise exception 'not_found'; end if;
  if event.action not in ('waypost.add', 'waypost.move', 'waypost.edit', 'waypost.hide', 'waypost.show',
    'spawn.place_add', 'spawn.place_remove', 'spawn.rule', 'config.wave', 'config.wave_length')
  then raise exception 'not_undoable'; end if;
  if exists (select 1 from private.admin_actions a where a.target_type = event.target_type
      and a.target_id = event.target_id and a.id > event.id)
  then raise exception 'stale'; end if;

  case event.target_type
    when 'waypost' then
      post := private.admin_waypost_row(event.target_id::uuid);
      current_state := to_jsonb(post);
      if current_state is distinct from event.after then raise exception 'stale'; end if;
      if event.action = 'waypost.add' then
        -- Retain the pin and its history when undoing creation.
        restored := post;
        restored.game_enabled := false;
        restored.hidden_at := now();
      else
        restored := jsonb_populate_record(null::public.public_capsule_spots, event.before);
      end if;
      saved := to_jsonb(private.save_admin_waypost(post, restored, p_note));
    when 'spawn_place' then
      p_region := event.after->>'region_id';
      p_vessel := event.after->>'vessel';
      select to_jsonb(a) into current_state from private.vessel_spawn_places a
        where a.region_id = p_region and a.vessel = p_vessel;
      if event.action = 'spawn.place_add' then
        if current_state is null then raise exception 'stale'; end if;
        saved := private.admin_spawn_write('admin_spawn_place_remove',
          jsonb_build_object('p_region', p_region, 'p_vessel', p_vessel), p_note, false);
        if (event.after->>'created_rule')::boolean and not exists (
          select 1 from private.vessel_spawn_places a where a.vessel = p_vessel)
          and not exists (select 1 from private.admin_actions a
            where a.target_type = 'spawn_rule' and a.target_id = p_vessel and a.id > event.id)
        then
          delete from private.vessel_spawn_rules r where r.vessel = p_vessel
            and r.rarity = 'common' and r.habitat is null
            and r.local_start_hour is null and r.month_day_start is null;
        end if;
      else
        if current_state is not null then raise exception 'stale'; end if;
        saved := private.admin_spawn_write('admin_spawn_place_add',
          jsonb_build_object('p_region', p_region, 'p_vessel', p_vessel), p_note, false);
      end if;
    when 'spawn_rule' then
      select to_jsonb(r) into current_state from private.vessel_spawn_rules r
        where r.vessel = event.target_id for update;
      if current_state is distinct from event.after then raise exception 'stale'; end if;
      if event.before is null then
        if exists (select 1 from private.vessel_spawn_places a where a.vessel = event.target_id)
        then raise exception 'stale'; end if;
        delete from private.vessel_spawn_rules r where r.vessel = event.target_id;
        saved := jsonb_build_object('vessel', event.target_id, 'rule', null);
      else
        rule := jsonb_populate_record(null::private.vessel_spawn_rules, event.before);
        saved := private.admin_spawn_write('admin_spawn_rule_set', jsonb_build_object(
          'p_vessel', rule.vessel, 'p_rarity', rule.rarity, 'p_habitat', rule.habitat,
          'p_start_hour', rule.local_start_hour, 'p_end_hour', rule.local_end_hour,
          'p_md_start', rule.month_day_start, 'p_md_end', rule.month_day_end), p_note, false);
      end if;
    when 'config' then
      if event.action = 'config.wave_length' then
        current_state := private.admin_wave_length_state();
        if (current_state - 'pending') is distinct from (event.after - 'pending') then raise exception 'stale'; end if;
        saved := private.admin_schedule_wave_length((event.before->>'minutes')::integer,
          case when (event.before->>'pending')::boolean then (event.before->>'starts_at')::timestamptz end);
      else
        select jsonb_build_object('spawn_chance', c.spawn_chance, 'common_weight', c.rarity_common_weight,
          'uncommon_weight', c.rarity_uncommon_weight, 'rare_weight', c.rarity_rare_weight,
          'nearby_target', c.nearby_spawn_target) into current_state from private.game_config c where c.singleton;
        if current_state is distinct from event.after then raise exception 'stale'; end if;
        saved := private.admin_spawn_write('admin_wave_config_set', jsonb_build_object(
          'p_spawn_chance', event.before->'spawn_chance', 'p_common_weight', event.before->'common_weight',
          'p_uncommon_weight', event.before->'uncommon_weight', 'p_rare_weight', event.before->'rare_weight',
          'p_nearby_target', event.before->'nearby_target'), p_note, false);
      end if;
    else raise exception 'not_undoable';
  end case;

  if event.target_type <> 'waypost' then perform private.admin_assert_spawn_pool(); end if;
  perform private.admin_log('undo', event.target_type, event.target_id, event.target_label,
    current_state, saved || jsonb_build_object('undo_of', event.id), p_note);
  return saved;
end;
$$;
-- Scope the new RPCs explicitly. Existing replacement functions retain their grants.
revoke all on function
  public.admin_waypost_check(text,double precision,double precision,uuid),
  public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text),
  public.admin_waypost_update(uuid,double precision,double precision,text,text,text,text),
  public.admin_waypost_set_visible(uuid,boolean,text), public.admin_spot_set_visible(uuid,boolean,text),
  public.admin_spawn_place_add(text,text,text), public.admin_spawn_place_remove(text,text,text),
  public.admin_spawn_rule_set(text,text,text,integer,integer,text,text,text),
  public.admin_wave_config_set(double precision,integer,integer,integer,integer,text),
  public.admin_wave_length_set(integer,text), public.admin_spawn_preview(jsonb), public.admin_undo(bigint,text)
from public, anon, authenticated, service_role;
grant execute on function
  public.admin_waypost_check(text,double precision,double precision,uuid),
  public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text),
  public.admin_waypost_update(uuid,double precision,double precision,text,text,text,text),
  public.admin_waypost_set_visible(uuid,boolean,text), public.admin_spot_set_visible(uuid,boolean,text),
  public.admin_spawn_place_add(text,text,text), public.admin_spawn_place_remove(text,text,text),
  public.admin_spawn_rule_set(text,text,text,integer,integer,text,text,text),
  public.admin_wave_config_set(double precision,integer,integer,integer,integer,text),
  public.admin_wave_length_set(integer,text), public.admin_spawn_preview(jsonb), public.admin_undo(bigint,text)
to authenticated;

revoke all on function
  private.game_wave_at(timestamptz), private.game_wave_by_number(bigint),
  private.stage_game_spawn(timestamptz), private.game_spawn_at(timestamptz),
  private.game_spawn_city_rules(private.game_spawn_revisions,text), private.lock_game_edits(),
  private.lock_spawn_edit(), private.stage_spawn_edit(),
  private.game_roll(text,bytea),
  private.game_spawn_pool(private.vessel_spawn_rules[],text,timestamp),
  private.resolve_spawn_batch(uuid[],bigint,timestamptz,private.game_config,private.game_spawn_pool,bytea),
  private.require_game_editor(), private.admin_inside_coverage(text,double precision,double precision),
  private.admin_nearest_waypost(double precision,double precision,uuid),
  private.admin_waypost_hunts(double precision,double precision,uuid), private.admin_waypost_row(uuid),
  private.save_admin_waypost(public.public_capsule_spots,public.public_capsule_spots,text),
  private.admin_assert_spawn_pool(), private.admin_spawnable(text), private.admin_valid_month_day(text),
  private.admin_wave_length_state(), private.admin_schedule_wave_length(integer,timestamptz),
  private.admin_spawn_write(text,jsonb,text,boolean), private.admin_spawn_preview_counts(text[],timestamptz)
from public, anon, authenticated, service_role;

commit;
