begin;

create table private.admin_members (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'moderator', 'viewer')),
  added_by uuid,
  added_at timestamptz not null default now()
);
alter table private.admin_members enable row level security;
revoke all on private.admin_members from public, anon, authenticated, service_role;

insert into private.admin_members (user_id, role)
select id, 'owner' from public.profiles where id = '1fd214ef-4de5-4b4f-81bc-77c3328441fe';
-- An empty local database has no production profile to seed. On a populated
-- database, fail rather than installing an admin panel without its owner.
do $$
begin
  if exists (select 1 from public.profiles) and not exists (select 1 from private.admin_members) then
    raise exception 'admin_owner_profile_missing';
  end if;
end;
$$;

create table private.admin_actions (
  id bigint generated always as identity primary key,
  actor uuid not null,
  actor_snapshot jsonb not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  target_label text not null,
  before jsonb,
  after jsonb,
  note text,
  at timestamptz not null default clock_timestamp()
);
create index admin_actions_reviews_idx on private.admin_actions (target_type, target_id, id desc)
  where action in ('queue.restore', 'queue.remove');
alter table private.admin_actions enable row level security;
revoke all on private.admin_actions from public, anon, authenticated, service_role;

create function private.admin_audit_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'append_only';
end;
$$;
create trigger admin_audit_append_only before update or delete or truncate on private.admin_actions
for each statement execute function private.admin_audit_append_only();

-- 'read' is implicit for all four roles. The four named actions match CAN in admin.ts.
create function private.admin_can(action text) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from private.admin_members m
    where m.user_id = auth.uid()
      and case action
        when 'read' then true
        when 'members' then m.role = 'owner'
        when 'queue' then m.role in ('owner', 'admin', 'moderator')
        when 'letters' then m.role in ('owner', 'admin', 'moderator')
        when 'edit' then m.role in ('owner', 'admin')
        else false
      end
  );
$$;

create function private.admin_person(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', id, 'name', name, 'avatar', avatar)
  from public.profiles where id = p_id;
$$;

create function private.admin_log(
  p_action text, p_type text, p_id text, p_label text,
  p_before jsonb, p_after jsonb, p_note text default null
) returns void
language sql set search_path = '' as $$
  insert into private.admin_actions (actor, actor_snapshot, action, target_type, target_id, target_label, before, after, note)
  values (auth.uid(), private.admin_person(auth.uid()), p_action, p_type, p_id, p_label, p_before, p_after, p_note);
$$;

create function public.admin_me() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role', role)
  from private.admin_members where user_id = auth.uid() and private.admin_can('read');
$$;

create function public.admin_members_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.admin_can('members') then raise exception 'forbidden'; end if;
  return (
    select coalesce(jsonb_agg(private.admin_person(m.user_id) || jsonb_build_object(
      'email', u.email, 'role', m.role, 'added_by', adder.name, 'added_at', m.added_at
    ) order by m.added_at, m.user_id), '[]'::jsonb)
    from private.admin_members m
    join auth.users u on u.id = m.user_id
    left join public.profiles adder on adder.id = m.added_by
  );
end;
$$;

create function public.admin_member_add(p_email text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  member public.profiles;
begin
  if not private.admin_can('members') then raise exception 'forbidden'; end if;
  if p_role is null or p_role not in ('owner', 'admin', 'moderator', 'viewer') then
    raise exception 'forbidden';
  end if;
  -- Serialize membership changes and check permission again after waiting for the lock.
  lock table private.admin_members in share row exclusive mode;
  if not private.admin_can('members') then raise exception 'forbidden'; end if;

  select p.* into member
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(btrim(p_email))
    and not exists (
      select 1 from auth.users other where lower(other.email) = lower(u.email) and other.id <> u.id
    );
  if not found then raise exception 'not_found'; end if;
  insert into private.admin_members (user_id, role, added_by)
  values (member.id, p_role, auth.uid()) on conflict (user_id) do nothing;
  if not found then raise exception 'already_member'; end if;
  perform private.admin_log('member.add', 'member', member.id::text, member.name,
    null, jsonb_build_object('role', p_role));
end;
$$;

create function private.admin_change_member(p_user uuid, p_role text) returns void
language plpgsql set search_path = '' as $$
declare
  old_role text;
  label text;
begin
  if not private.admin_can('members') then raise exception 'forbidden'; end if;
  lock table private.admin_members in share row exclusive mode;
  if not private.admin_can('members') then raise exception 'forbidden'; end if;

  select m.role, p.name into old_role, label
  from private.admin_members m join public.profiles p on p.id = m.user_id
  where m.user_id = p_user;
  if not found then raise exception 'not_found'; end if;
  if old_role = 'owner' and p_role is distinct from 'owner'
    and not exists (select 1 from private.admin_members where role = 'owner' and user_id <> p_user)
  then raise exception 'last_owner'; end if;

  if p_role is null then
    delete from private.admin_members where user_id = p_user;
    perform private.admin_log('member.remove', 'member', p_user::text, label,
      jsonb_build_object('role', old_role), null);
  else
    update private.admin_members set role = p_role where user_id = p_user;
    perform private.admin_log('member.role', 'member', p_user::text, label,
      jsonb_build_object('role', old_role), jsonb_build_object('role', p_role));
  end if;
end;
$$;

create function public.admin_member_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_role is null or p_role not in ('owner', 'admin', 'moderator', 'viewer') then
    raise exception 'forbidden';
  end if;
  perform private.admin_change_member(p_user, p_role);
end;
$$;

create function public.admin_member_remove(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  select private.admin_change_member(p_user, null);
$$;

create function public.admin_activity(p_limit integer, p_before bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'actor', a.actor_snapshot, 'action', a.action,
      'target_type', a.target_type, 'target_id', a.target_id, 'target_label', a.target_label,
      'before', a.before, 'after', a.after, 'note', a.note, 'at', a.at
    ) order by a.id desc), '[]'::jsonb)
    from (
      select * from private.admin_actions where p_before is null or id < p_before
      order by id desc limit least(100, greatest(1, coalesce(p_limit, 50)))
    ) a
  );
end;
$$;

-- The coverage bounds are [west, south, east, north] from public-sea-cities.geojson.
-- Bytes exclude archive overhead and tile payloads shared by multiple areas.
create table private.game_map_coverage (
  id text primary key,
  name text not null,
  west double precision not null,
  south double precision not null,
  east double precision not null,
  north double precision not null,
  bytes bigint not null check (bytes > 0),
  built_at date not null,
  check (west < east and south < north)
);
alter table private.game_map_coverage enable row level security;
revoke all on private.game_map_coverage from public, anon, authenticated, service_role;

insert into private.game_map_coverage (id, name, west, south, east, north, bytes, built_at) values
  ('macau', 'Macau', 113.49490675289682, 22.142088, 113.60334724710317, 22.239391, 4096945, '2026-11-07'),
  ('hong-kong', 'Hong Kong', 114.1059188341406, 22.250837, 114.28, 22.35, 9726639, '2026-11-07'),
  ('taipei', 'Taipei', 121.50994318904962, 24.988493, 121.61580581095039, 25.08448, 10408587, '2026-11-07'),
  ('tokyo', 'Tokyo', 139.73450835463743, 35.663861, 139.85856664536257, 35.763669, 20081565, '2026-11-07'),
  ('kyoto', 'Kyoto', 135.70597431270636, 34.921695, 135.82477568729362, 35.017886, 12461893, '2026-11-07'),
  ('seoul', 'Seoul', 126.91915892072643, 37.520641, 127.04199807927357, 37.62178, 9218586, '2026-11-07'),
  ('singapore', 'Singapore', 103.80647364679766, 1.235271, 103.90552435320234, 1.337778, 6167393, '2026-11-07'),
  ('bangkok', 'Bangkok', 100.443591269691, 13.693973, 100.548873730309, 13.809074, 9866979, '2026-11-07'),
  ('beijing', 'Beijing', 116.32379285684871, 39.848787, 116.45874214315128, 39.972534, 6175184, '2026-11-07'),
  ('kuala-lumpur', 'Kuala Lumpur', 101.65212363677146, 3.095159, 101.75984836322854, 3.222825, 9767282, '2026-11-07');

create table private.game_regions (
  id text primary key,
  country_zh text not null,
  country_en text not null,
  city text unique,
  name_zh text not null,
  name_en text not null,
  timezone text not null,
  parent_id text references private.game_regions(id),
  coverage_id text references private.game_map_coverage(id),
  center_lat double precision,
  center_lng double precision,
  check (parent_id is distinct from id),
  check ((center_lat is null) = (center_lng is null))
);
alter table private.game_regions enable row level security;
revoke all on private.game_regions from public, anon, authenticated, service_role;

insert into private.game_regions
  (id, country_zh, country_en, city, name_zh, name_en, timezone, parent_id, coverage_id, center_lat, center_lng)
values
  ('taiwan', '台灣', 'Taiwan', 'Taiwan', '台灣', 'Taiwan', 'Asia/Taipei', null, null, null, null),
  ('taipei', '台灣', 'Taiwan', 'Taipei', '台北', 'Taipei', 'Asia/Taipei', 'taiwan', 'taipei', 25.0375, 121.5637),
  ('kaohsiung', '台灣', 'Taiwan', 'Kaohsiung', '高雄', 'Kaohsiung', 'Asia/Taipei', 'taiwan', null, null, null),
  ('taichung', '台灣', 'Taiwan', 'Taichung', '台中', 'Taichung', 'Asia/Taipei', 'taiwan', null, null, null),
  ('tainan', '台灣', 'Taiwan', 'Tainan', '台南', 'Tainan', 'Asia/Taipei', 'taiwan', null, null, null),
  ('hong-kong', '香港', 'Hong Kong', 'Hong Kong', '香港', 'Hong Kong', 'Asia/Hong_Kong', null, 'hong-kong', 22.2985, 114.1720),
  ('singapore', '新加坡', 'Singapore', 'Singapore', '新加坡', 'Singapore', 'Asia/Singapore', null, 'singapore', 1.2894, 103.8504),
  ('macau', '澳門', 'Macau', 'Macau', '澳門', 'Macau', 'Asia/Macau', null, 'macau', 22.1935, 113.5420);

create table private.vessel_spawn_places (
  region_id text not null references private.game_regions(id),
  vessel text not null references private.vessel_spawn_rules(vessel) on delete cascade,
  primary key (region_id, vessel)
);
alter table private.vessel_spawn_places enable row level security;
revoke all on private.vessel_spawn_places from public, anon, authenticated, service_role;

-- The join deliberately preserves the previous four assignment scopes.
insert into private.vessel_spawn_places (region_id, vessel)
select g.id, r.vessel
from private.vessel_spawn_rules r
cross join lateral unnest(r.regions) as old(city)
join private.game_regions g on g.city = old.city;
alter table private.vessel_spawn_rules drop column regions;

CREATE OR REPLACE FUNCTION private.resolve_spawn(p_spot uuid, p_wave bigint)
 RETURNS TABLE(spawn_id text, vessel text, rarity text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare spot public.corrupted_spots; cfg private.game_config; wave_at timestamptz;
  local_hour integer; local_md text; chosen_rarity text; picked text;
  rarity_roll double precision; total_weight integer; visible_minutes integer;
begin
  select * into spot from public.corrupted_spots where id=p_spot;
  if spot.id is null then return; end if;
  select * into cfg from private.game_config where singleton;
  wave_at := to_timestamp(p_wave * cfg.wave_minutes * 60);
  if private.game_roll(p_spot::text||':'||p_wave||':show') >= cfg.spawn_chance
    then return; end if;
  local_hour := extract(hour from wave_at at time zone spot.timezone)::integer;
  local_md := to_char(wave_at at time zone spot.timezone,'MM-DD');
  rarity_roll := private.game_roll(p_spot::text||':'||p_wave||':rarity');
  total_weight := cfg.rarity_common_weight+cfg.rarity_uncommon_weight+cfg.rarity_rare_weight;
  chosen_rarity := case
    when rarity_roll < cfg.rarity_common_weight::double precision/total_weight then 'common'
    when rarity_roll < (cfg.rarity_common_weight+cfg.rarity_uncommon_weight)::double precision/total_weight
      then 'uncommon' else 'rare' end;
  select r.vessel into picked from private.vessel_spawn_rules r
    where r.rarity = chosen_rarity
      and exists (
        select 1 from private.game_regions g
        join private.vessel_spawn_places a on a.region_id in (g.id, g.parent_id)
        where g.city = spot.city and a.vessel = r.vessel
      )
      and (r.habitat is null or r.habitat=spot.habitat)
      and (r.local_start_hour is null
        or (r.local_start_hour < r.local_end_hour and local_hour >= r.local_start_hour and local_hour < r.local_end_hour)
        or (r.local_start_hour > r.local_end_hour and (local_hour >= r.local_start_hour or local_hour < r.local_end_hour)))
      and (r.month_day_start is null
        or (r.month_day_start <= r.month_day_end and local_md between r.month_day_start and r.month_day_end)
        or (r.month_day_start > r.month_day_end and (local_md >= r.month_day_start or local_md <= r.month_day_end)))
    order by private.game_roll(p_spot::text||':'||p_wave||':vessel:'||r.vessel)
    limit 1;
  if picked is null then return; end if;
  visible_minutes := cfg.visible_min_minutes + floor(
    private.game_roll(p_spot::text||':'||p_wave||':duration') *
    (cfg.visible_max_minutes-cfg.visible_min_minutes+1))::integer;
  spawn_id := p_spot::text||':'||p_wave::text;
  vessel := picked; rarity := chosen_rarity;
  expires_at := wave_at + make_interval(mins=>visible_minutes);
  -- Temporary Roy QA spots expire at their fixed ten-minute batch boundary.
  if spot.source_ref ~ '^qa:roy-taipei-game:[0-9]+:[0-9]+$' then
    expires_at := least(expires_at,to_timestamp((split_part(spot.source_ref,':',3)::bigint+1)*600));
  end if;
  return next;
end $function$;

create index corrupted_catches_caught_spawn_idx on public.corrupted_catches (spawn_id) where result = 'caught';
create index corrupted_catches_caught_at_idx on public.corrupted_catches (caught_at) where result = 'caught';

create function private.admin_wave(p_city text)
returns table (spot uuid, vessel text, rarity text, lat double precision, lng double precision,
  expires_at timestamptz, caught boolean)
language sql stable set search_path = '' as $$
  select p.id, s.vessel, s.rarity, p.lat, p.lng, s.expires_at, exists (
    select 1 from public.corrupted_catches c where c.spawn_id = s.spawn_id and c.result = 'caught'
  )
  from private.game_config cfg
  join public.corrupted_spots p on p.city = p_city
  cross join lateral private.resolve_spawn(p.id, floor(extract(epoch from now()) / (cfg.wave_minutes * 60))::bigint) s
  where cfg.singleton and p.source_ref not like 'qa:roy-taipei-game:%' and s.expires_at > now();
$$;

-- A private hunt has no city field. Associate its published, visible quests with
-- the same coverage bounds used for the map. A route spanning cities appears in both.
create function private.admin_region_quests(p_region private.game_regions)
returns table (id uuid, hunt text, hunt_name text, lat double precision, lng double precision, picture text)
language sql stable set search_path = '' as $$
  select q.id, h.id, h.name_en, q.location_lat, q.location_lng, q.image
  from private.game_map_coverage b
  join public.private_hunt_quests q on q.location_lat between b.south and b.north
    and q.location_lng between b.west and b.east
  join public.hunts h on h.id = q.hunt_id
  where b.id = p_region.coverage_id
    and h.kind = 'private' and h.status = 'published' and h.hidden_at is null;
$$;

create function private.admin_region(p_region private.game_regions, p_out_now bigint) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p_region.id, 'country_zh', p_region.country_zh, 'country_en', p_region.country_en,
    'name_zh', p_region.name_zh, 'name_en', p_region.name_en, 'timezone', p_region.timezone,
    'center', jsonb_build_object('lat', p_region.center_lat, 'lng', p_region.center_lng),
    'wayposts', (select jsonb_build_object(
      'common', count(*) filter (where p.kind = 'common'),
      'landmark', count(*) filter (where p.kind = 'landmark'))
      from public.public_capsule_spots p where p.city_en = p_region.city and p.game_enabled),
    'corrupted_spots', (select count(*) from public.corrupted_spots p
      where p.city = p_region.city and p.source_ref not like 'qa:roy-taipei-game:%'),
    'capsule_spots', (select count(*) from public.public_capsule_spots p where p.city_en = p_region.city),
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
$$;

create function public.admin_cities() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  return (
    select coalesce(jsonb_agg(private.admin_region(g,
      (select count(*) from private.admin_wave(g.city) where not caught))
      order by g.country_en, g.name_en), '[]'::jsonb)
    from private.game_regions g where g.center_lat is not null
  );
end;
$$;

create function public.admin_city_map(p_region text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
        'kind', p.kind, 'game_enabled', p.game_enabled, 'source_ref', p.source_ref
      ) order by p.id), '[]'::jsonb)
        from public.public_capsule_spots p where p.city_en = city.city),
      'spots', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'lat', p.lat, 'lng', p.lng, 'habitat', p.habitat
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
$$;

create function public.admin_spawning() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
        'wave_minutes', cfg.wave_minutes, 'spawn_chance', cfg.spawn_chance, 'nearby_max', cfg.nearby_spawn_target,
        'weights', jsonb_build_object('common', cfg.rarity_common_weight,
          'uncommon', cfg.rarity_uncommon_weight, 'rare', cfg.rarity_rare_weight)),
      'rules', (select coalesce(jsonb_agg(jsonb_build_object(
        'vessel', v.id, 'rarity', r.rarity, 'habitat', r.habitat,
        'hours', case when r.local_start_hour is not null then jsonb_build_array(r.local_start_hour, (r.local_end_hour + 23) % 24) end,
        'dates', case when r.month_day_start is not null then jsonb_build_array(r.month_day_start, r.month_day_end) end,
        'regions', (select coalesce(jsonb_agg(g.id order by g.id), '[]'::jsonb) from cities g
          where exists (select 1 from private.vessel_spawn_places a where a.vessel = v.id
            and a.region_id in (g.id, g.parent_id))),
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
$$;

create function private.admin_latest_review(p_type text, p_id text) returns private.admin_actions
language sql stable set search_path = '' as $$
  select a.* from private.admin_actions a
  where a.target_type = p_type and a.target_id = p_id and a.action in ('queue.restore', 'queue.remove')
  order by a.id desc limit 1;
$$;

-- Before a decision, the original two-report rule still applies. After a restore,
-- only reports filed since the decision count toward hiding the item again.
create function private.public_capsule_is_hidden(p_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(a.action = 'queue.remove', false) or exists (
    select 1 from public.public_capsule_reports r
    where r.capsule_id = p_id and r.reported_at > coalesce(a.at, '-infinity'::timestamptz)
    offset 1
  )
  from private.admin_latest_review('public_capsule', p_id::text) a;
$$;

alter table public.public_capsule_reports alter column reported_at set default clock_timestamp();
alter table private.private_hunt_reports alter column reported_at set default clock_timestamp();

create function public.admin_queue(p_status text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  can_read_preview boolean;
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  if p_status is null or p_status not in ('open', 'done') then raise exception 'not_found'; end if;
  can_read_preview := private.admin_can('letters');

  return (
    with reported as (
      select 'hunt_report' as kind, 'hunt' as target_type, h.id, h.name_en as title,
        case when can_read_preview then h.description end as preview,
        h.owner, h.hidden_at is not null as hidden, count(*) as reports,
        '[]'::jsonb as reasons,
        jsonb_agg(private.admin_person(r.reporter) order by r.reported_at, r.reporter) as reporters,
        min(r.reported_at) as first_at, max(r.reported_at) as latest_at
      from private.private_hunt_reports r join public.hunts h on h.id = r.hunt_id and h.kind = 'private'
      group by h.id
      union all
      select 'public_capsule_report', 'public_capsule', c.id::text, c.hint,
        case when can_read_preview then (select x.message from public.capsule_contents x where x.capsule_id = c.id) end,
        c.sender, private.public_capsule_is_hidden(c.id), count(*), jsonb_agg(distinct r.reason order by r.reason),
        jsonb_agg(private.admin_person(r.reporter) order by r.reported_at, r.reporter),
        min(r.reported_at), max(r.reported_at)
      from public.public_capsule_reports r join public.capsules c on c.id = r.capsule_id and c.is_public
      group by c.id
    ), review as (
      select r.*, a.action, a.actor_snapshot, a.at, a.note,
        case when a.action = 'queue.remove' or a.at >= r.latest_at then 'done' else 'open' end as status
      from reported r cross join lateral private.admin_latest_review(r.target_type, r.id) a
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind', r.kind, 'id', r.id, 'title', r.title, 'preview', r.preview,
      'owner', private.admin_person(r.owner), 'reports', r.reports, 'reasons', r.reasons,
      'reporters', r.reporters, 'hidden', r.hidden, 'first_at', r.first_at, 'status', r.status
    ) || case when r.status = 'done' then jsonb_build_object(
      'decision', split_part(r.action, '.', 2), 'decided_by', r.actor_snapshot,
      'decided_at', r.at, 'note', r.note) else '{}'::jsonb end
    order by case when r.status = 'done' then r.at else r.latest_at end desc, r.kind, r.id), '[]'::jsonb)
    from review r where r.status = p_status
  );
end;
$$;

create function public.admin_queue_resolve(p_kind text, p_id text, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_type text;
  title text;
  was_hidden boolean;
  latest_report timestamptz;
  prior private.admin_actions;
  target_capsule uuid;
begin
  if not private.admin_can('queue') then raise exception 'forbidden'; end if;
  if p_decision is null or p_decision not in ('restore', 'remove') then raise exception 'not_found'; end if;

  -- Reporting and pickup use the same target row lock, so the decision and its
  -- audit row see the same report set and take effect together.
  case p_kind
    when 'hunt_report' then
      target_type := 'hunt';
      select h.name_en, h.hidden_at is not null into title, was_hidden
      from public.hunts h where h.id = p_id and h.kind = 'private' for update;
      if not found then raise exception 'not_found'; end if;
      select max(reported_at) into latest_report from private.private_hunt_reports where hunt_id = p_id;
    when 'public_capsule_report' then
      target_type := 'public_capsule';
      if p_id is null or p_id !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
        raise exception 'not_found';
      end if;
      target_capsule := p_id::uuid;
      p_id := target_capsule::text;
      select c.hint into title from public.capsules c where c.id = target_capsule and c.is_public for update;
      if not found then raise exception 'not_found'; end if;
      was_hidden := private.public_capsule_is_hidden(target_capsule);
      select max(r.reported_at) into latest_report from public.public_capsule_reports r where r.capsule_id = target_capsule;
    else raise exception 'not_found';
  end case;

  if not private.admin_can('queue') then raise exception 'forbidden'; end if;
  prior := private.admin_latest_review(target_type, p_id);
  if latest_report is null or prior.action = 'queue.remove' or prior.at >= latest_report then
    raise exception 'not_found';
  end if;
  if target_type = 'hunt' then
    update public.hunts set hidden_at = case when p_decision = 'remove' then coalesce(hidden_at, clock_timestamp()) end
    where id = p_id;
  elsif p_decision = 'remove' then
    update public.capsules set recipient = null, opened_at = null, seen_at = null,
      opened_lat = null, opened_lng = null, opened_distance_m = null
    where id = target_capsule and recipient is not null;
  end if;
  perform private.admin_log('queue.' || p_decision, target_type, p_id, title,
    jsonb_build_object('hidden', was_hidden), jsonb_build_object('hidden', p_decision = 'remove'), p_note);
end;
$$;

CREATE OR REPLACE FUNCTION public.private_hunt_report(p_hunt text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts;
begin
  select * into h from public.hunts where id = p_hunt and kind = 'private' for update;
  if auth.uid() is null or not found or h.owner = auth.uid() then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.private_hunt_members where hunt_id = h.id and user_id = auth.uid())
  then raise exception 'not_joined'; end if;
  insert into private.private_hunt_reports (hunt_id, reporter) values (h.id, auth.uid()) on conflict do nothing;
  if h.hidden_at is null and exists (
    select 1 from private.private_hunt_reports r where r.hunt_id = h.id
      and r.reported_at > coalesce((private.admin_latest_review('hunt', h.id)).at, '-infinity'::timestamptz)
    offset 1
  ) then
    update public.hunts set hidden_at = clock_timestamp() where id = h.id;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.public_capsule_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS TABLE(id uuid, hint text, vessel text, lat double precision, lng double precision, spot_zh text, spot_en text, sealed_at timestamp with time zone, available_at timestamp with time zone, returns integer, sender jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.id, c.hint, c.vessel, s.lat, s.lng, s.name_zh, s.name_en,
    c.sealed_at, c.open_at, c.public_capsule_returns,
    jsonb_build_object('id', p.id, 'name', p.name, 'avatar', p.avatar, 'city', p.city)
  from public.capsules c
  join public.public_capsule_spots s on s.id = c.public_capsule_spot
  join public.profiles p on p.id = c.sender
  where auth.uid() is not null
    and p_lat between -90 and 90 and p_lng between -180 and 180
    and p_accuracy > 0 and p_accuracy <= 200
    and c.is_public and c.recipient is null and c.open_at <= now()
    and c.sender <> auth.uid()
    and public.distance_m(p_lat, p_lng, s.lat, s.lng) <= 5000
    and not exists (select 1 from public.public_capsule_pickups x where x.capsule_id = c.id and x.finder = auth.uid())
    and not exists (select 1 from public.public_capsule_reports r where r.capsule_id = c.id and r.reporter = auth.uid())
    and not private.public_capsule_is_hidden(c.id)
  order by public.distance_m(p_lat, p_lng, s.lat, s.lng), c.open_at
  limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.public_capsule_pick_up(p_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.capsules; s public.public_capsule_spots;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from public.capsules where id = p_id for update;
  if c.id is null or not c.is_public then raise exception 'taken'; end if;
  if c.sender = auth.uid() then raise exception 'own_bottle'; end if;
  if c.recipient is not null or c.open_at > now()
    or exists (select 1 from public.public_capsule_pickups x where x.capsule_id = p_id and x.finder = auth.uid())
    or exists (select 1 from public.public_capsule_reports r where r.capsule_id = p_id and r.reporter = auth.uid())
    or private.public_capsule_is_hidden(p_id)
  then raise exception 'taken'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180
    or p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200
  then raise exception 'too_far'; end if;
  select * into s from public.public_capsule_spots where id = c.public_capsule_spot;
  if s.id is null or public.distance_m(p_lat, p_lng, s.lat, s.lng) > 100 then
    raise exception 'too_far';
  end if;
  insert into public.public_capsule_pickups (capsule_id, finder) values (p_id, auth.uid());
  update public.capsules set recipient = auth.uid() where id = p_id;
end $function$
;

revoke all on function
  private.admin_audit_append_only(), private.admin_can(text), private.admin_person(uuid),
  private.admin_log(text, text, text, text, jsonb, jsonb, text), private.admin_change_member(uuid, text),
  private.admin_wave(text), private.admin_region_quests(private.game_regions),
  private.admin_region(private.game_regions, bigint),
  private.admin_latest_review(text, text), private.public_capsule_is_hidden(uuid)
from public, anon, authenticated, service_role;

revoke all on function
  public.admin_me(), public.admin_members_list(), public.admin_member_add(text, text),
  public.admin_member_set_role(uuid, text), public.admin_member_remove(uuid),
  public.admin_cities(), public.admin_city_map(text), public.admin_spawning(),
  public.admin_queue(text), public.admin_queue_resolve(text, text, text, text), public.admin_activity(integer, bigint)
from public, anon, authenticated, service_role;
grant execute on function
  public.admin_me(), public.admin_members_list(), public.admin_member_add(text, text),
  public.admin_member_set_role(uuid, text), public.admin_member_remove(uuid),
  public.admin_cities(), public.admin_city_map(text), public.admin_spawning(),
  public.admin_queue(text), public.admin_queue_resolve(text, text, text, text), public.admin_activity(integer, bigint)
to authenticated;

commit;
