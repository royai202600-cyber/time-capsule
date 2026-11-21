begin;

create table private.waypost_levels (
  level integer primary key check (level between 1 and 5),
  xp_from integer not null check ((level = 1 and xp_from = 0) or (level > 1 and xp_from > 0)),
  items jsonb not null
);

create table private.waypost_xp (
  waypost_id uuid primary key references public.public_capsule_spots(id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0)
);

create table private.waypost_xp_daily (
  user_id uuid references auth.users(id) on delete cascade,
  waypost_id uuid references private.waypost_xp(waypost_id) on delete cascade,
  local_day date,
  spins integer not null check (spins between 0 and 1),
  capsules integer not null check (capsules between 0 and 1),
  opened integer not null check (opened between 0 and 3),
  primary key (user_id, waypost_id, local_day)
);
create index waypost_xp_daily_waypost_idx on private.waypost_xp_daily (waypost_id);

alter table private.waypost_levels enable row level security;
alter table private.waypost_xp enable row level security;
alter table private.waypost_xp_daily enable row level security;
revoke all on private.waypost_levels, private.waypost_xp, private.waypost_xp_daily
  from public, anon, authenticated, service_role;

create function private.waypost_wax_item(p_min integer, p_max integer)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('kind', 'wax', 'vessel', null, 'min', p_min, 'max', p_max, 'chance', 100);
$$;

insert into private.waypost_levels (level, xp_from, items)
select 1, 0, jsonb_build_array(private.waypost_wax_item(spin_wax_min, spin_wax_max)) ||
  case when spin_gold_chance > 0 and spin_gold_award > 0 then jsonb_build_array(
    jsonb_build_object('kind', 'gold', 'vessel', null, 'min', spin_gold_award,
      'max', spin_gold_award, 'chance', spin_gold_chance::numeric * 100))
  else '[]'::jsonb end
from private.game_config where singleton;
insert into private.waypost_levels (level, xp_from, items) values
  (2, 100, jsonb_build_array(private.waypost_wax_item(12, 12)) ||
    '[{"kind":"gold","vessel":null,"min":1,"max":1,"chance":5}]'),
  (3, 300, jsonb_build_array(private.waypost_wax_item(12, 12)) ||
    '[{"kind":"gold","vessel":null,"min":1,"max":1,"chance":10}]'),
  (4, 700, jsonb_build_array(private.waypost_wax_item(14, 14)) ||
    '[{"kind":"gold","vessel":null,"min":1,"max":1,"chance":20}]'),
  (5, 1500, jsonb_build_array(private.waypost_wax_item(15, 15)) ||
    '[{"kind":"gold","vessel":null,"min":1,"max":1,"chance":20},
      {"kind":"vessel","vessel":null,"min":1,"max":1,"chance":5}]');

-- Lock in the same order for spin, leave and open. Concurrent spins pay at the
-- level reached before their own XP is counted.
create function private.waypost_lock_xp(p_waypost uuid)
returns bigint language plpgsql set search_path = '' as $$
declare points bigint;
begin
  insert into private.waypost_xp (waypost_id) values (p_waypost) on conflict do nothing;
  select xp into strict points from private.waypost_xp where waypost_id = p_waypost for update;
  return points;
end $$;

create function private.waypost_credit_xp(p_post public.public_capsule_spots, p_action text)
returns void language plpgsql set search_path = '' as $$
declare
  zone text;
  points integer;
begin
  if p_post.kind <> 'common' then return; end if;
  select g.timezone into zone from private.game_regions g where g.city = p_post.city_en;
  -- A coverage entry supplies the local clock for every active city.
  if zone is null then raise exception 'missing_waypost_timezone'; end if;
  points := case p_action when 'spin' then 5 when 'leave' then 15 when 'open' then 25 end;

  perform private.waypost_lock_xp(p_post.id);
  insert into private.waypost_xp_daily as d (user_id, waypost_id, local_day, spins, capsules, opened)
  values (auth.uid(), p_post.id, (statement_timestamp() at time zone zone)::date,
    (p_action = 'spin')::integer, (p_action = 'leave')::integer, (p_action = 'open')::integer)
  on conflict (user_id, waypost_id, local_day) do update
  set spins = d.spins + excluded.spins, capsules = d.capsules + excluded.capsules, opened = d.opened + excluded.opened
  where d.spins + excluded.spins <= 1 and d.capsules + excluded.capsules <= 1 and d.opened + excluded.opened <= 3;

  if found then
    update private.waypost_xp set xp = xp + points where waypost_id = p_post.id;
  end if;
end $$;

create function public.waypost_level(p_waypost uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare points bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (
    select 1 from public.public_capsule_spots
    where id = p_waypost and kind = 'common' and game_enabled and hidden_at is null
  ) then raise exception 'not_found'; end if;

  points := coalesce((select xp from private.waypost_xp where waypost_id = p_waypost), 0);
  return (
    select jsonb_build_object('level', l.level, 'xp', points, 'level_xp', l.xp_from,
      'next_xp', n.xp_from, 'items', l.items, 'next_items', n.items,
      'me', (select jsonb_build_object('spins', coalesce(sum(d.spins), 0),
        'capsules', coalesce(sum(d.capsules), 0), 'opened', coalesce(sum(d.opened), 0))
        from private.waypost_xp_daily d where d.user_id = auth.uid() and d.waypost_id = p_waypost))
    from private.waypost_levels l
    left join private.waypost_levels n on n.level = l.level + 1
    where l.xp_from <= points order by l.level desc limit 1
  );
end $$;

create function public.admin_waypost_levels()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  return (select jsonb_agg(jsonb_build_object('level', level, 'xp', xp_from, 'items', items) order by level)
    from private.waypost_levels);
end $$;

create function private.waypost_level_state(p_level integer)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('level', level, 'xp', xp_from, 'items', items)
  from private.waypost_levels where level = p_level;
$$;

create function private.waypost_level_save(p_level integer, p_xp integer, p_items jsonb)
returns void language plpgsql set search_path = '' as $$
declare item jsonb;
begin
  if p_level is null or p_level not between 1 and 5 or p_xp is null
    or (p_level = 1 and p_xp <> 0) or (p_level > 1 and p_xp < 1)
    or exists (select 1 from private.waypost_levels
      where (level = p_level - 1 and xp_from >= p_xp) or (level = p_level + 1 and xp_from <= p_xp))
  then raise exception 'order'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'items'; end if;
  if jsonb_array_length(p_items) not between 1 and 6 then raise exception 'items'; end if;

  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object' or coalesce(item->>'kind', '') not in ('wax', 'gold', 'vessel')
      or jsonb_typeof(item->'min') is distinct from 'number'
      or jsonb_typeof(item->'max') is distinct from 'number'
      or jsonb_typeof(item->'chance') is distinct from 'number'
      or coalesce(jsonb_typeof(item->'vessel'), 'null') not in ('null', 'string')
      or (item->>'vessel' is not null and (item->>'kind' <> 'vessel'
        or not exists (select 1 from public.vessels where id = item->>'vessel')))
    then raise exception 'range'; end if;

    if exists (
      select 1 from jsonb_each(item) as f(key, value)
      where key in ('min', 'max', 'chance') and value::numeric <> trunc(value::numeric)
    ) or (item->'min')::numeric < 1 or (item->'max')::numeric > 99
      or (item->'min')::numeric > (item->'max')::numeric
      or (item->'chance')::numeric not between 1 and 100
    then raise exception 'range'; end if;
  end loop;

  update private.waypost_levels l set xp_from = p_xp, items = (
    select jsonb_agg(jsonb_build_object('kind', entries.item->'kind', 'vessel', entries.item->'vessel',
      'min', entries.item->'min', 'max', entries.item->'max', 'chance', entries.item->'chance') order by ordinal)
    from jsonb_array_elements(p_items) with ordinality as entries(item, ordinal)
  ) where l.level = p_level;
end $$;

create function public.admin_waypost_level_set(p_level integer, p_xp integer, p_items jsonb, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare prior jsonb;
begin
  perform private.require_game_editor();
  -- Serialize threshold validation with other edits and undos.
  lock table private.waypost_levels in share row exclusive mode;
  prior := private.waypost_level_state(p_level);
  perform private.waypost_level_save(p_level, p_xp, p_items);
  perform private.admin_log('config.waypost_level', 'waypost_level', p_level::text, 'Waypost level ' || p_level,
    prior, private.waypost_level_state(p_level), p_note);
end $$;

-- Old app versions still have the spin reward form. Route its reads and writes
-- through the level-one drop list and keep historical Activity entries undoable.
create or replace function private.admin_spin_reward_state()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('spin_wax_min', (item->'min'), 'spin_wax_max', (item->'max'))
  from private.waypost_levels l cross join lateral jsonb_array_elements(l.items) with ordinality as drops(item, ordinal)
  where l.level = 1 and item->>'kind' = 'wax' and (item->'chance')::numeric = 100
  order by ordinal limit 1;
$$;

create function private.waypost_replace_base_wax(p_min integer, p_max integer)
returns jsonb language sql stable set search_path = '' as $$
  select private.waypost_wax_item(p_min, p_max) || coalesce((
    select jsonb_agg(item order by ordinal) from (
      select item, ordinal, min(ordinal) filter (where item->>'kind' = 'wax' and (item->'chance')::numeric = 100) over () base
      from private.waypost_levels l cross join lateral jsonb_array_elements(l.items) with ordinality as drops(item, ordinal)
      where l.level = 1
    ) d where ordinal is distinct from base
  ), '[]'::jsonb);
$$;

create or replace function public.admin_set_spin_reward(p_wax_min integer, p_wax_max integer, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prior jsonb;
  saved jsonb;
begin
  perform private.require_game_editor();
  if not coalesce(p_wax_min between 1 and p_wax_max and p_wax_max between 1 and 50, false)
  then raise exception 'bad_rule'; end if;

  lock table private.waypost_levels in share row exclusive mode;
  prior := private.admin_spin_reward_state();
  -- A legacy form can only edit an existing base wax drop.
  if prior is null then raise exception 'bad_rule'; end if;
  perform private.waypost_level_save(1, 0, private.waypost_replace_base_wax(p_wax_min, p_wax_max));
  saved := private.admin_spin_reward_state();
  perform private.admin_log('config.spin', 'config', 'spin', 'Waypost spin reward', prior, saved, p_note);
  return saved;
end $$;

create or replace function public.admin_undo(p_action_id bigint, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event private.admin_actions;
  current_state jsonb;
  level_number integer;
  restored_items jsonb;
  legacy boolean;
begin
  select * into event from private.admin_actions where id = p_action_id;
  legacy := event.target_type = 'config' and event.target_id = 'spin';
  if event.target_type is distinct from 'waypost_level' and not coalesce(legacy, false) then
    return private.admin_undo_before_spin_reward(p_action_id, p_note);
  end if;

  perform private.require_game_editor();
  if event.action not in ('config.waypost_level', 'config.spin') then raise exception 'not_undoable'; end if;
  lock table private.waypost_levels in share row exclusive mode;
  level_number := case when legacy then 1 else event.target_id::integer end;
  current_state := case when legacy then private.admin_spin_reward_state() else private.waypost_level_state(level_number) end;
  if current_state is distinct from event.after
    or exists (select 1 from private.admin_actions a where a.target_type = event.target_type
      and a.target_id = event.target_id and a.action = 'undo' and a.after->>'undo_of' = event.id::text)
  then raise exception 'stale'; end if;

  if legacy then
    restored_items := private.waypost_replace_base_wax(
      (event.before->>'spin_wax_min')::integer, (event.before->>'spin_wax_max')::integer);
  else
    restored_items := event.before->'items';
  end if;
  perform private.waypost_level_save(level_number, coalesce((event.before->>'xp')::integer, 0), restored_items);
  perform private.admin_log('undo', event.target_type, event.target_id, event.target_label,
    event.after, event.before || jsonb_build_object('undo_of', event.id), p_note);
  return event.before;
end $$;

create function private.waypost_award_vessel(p_user uuid, p_vessel text, p_count integer)
returns boolean language plpgsql set search_path = '' as $$
declare
  v public.vessels;
  edition integer;
begin
  select * into v from public.vessels where id = p_vessel for share;
  if not found then return false; end if;
  if v.edition_total is not null then
    perform pg_advisory_xact_lock(hashtext('vessel:' || v.id));
    if not exists (select 1 from public.owned_vessels where user_id = p_user and vessel = v.id) then
      select coalesce(max(edition_no), 0) + 1 into edition from public.owned_vessels where vessel = v.id;
      if edition > v.edition_total then return false; end if;
    end if;
  end if;

  insert into public.owned_vessels as o (user_id, vessel, edition_no, copies)
  values (p_user, v.id, edition, case when v.unlimited_copies then null else p_count end)
  on conflict on constraint owned_vessels_pkey do update
  set copies = least(o.copies::bigint + excluded.copies, 2147483647)::integer
  where not v.unlimited_copies;
  return found;
end $$;

create function private.waypost_rare_vessel(p_city text)
returns text language sql volatile set search_path = '' as $$
  select r.vessel
  from private.game_wave_at(now()) w
  cross join lateral unnest(private.game_spawn_city_rules(private.game_spawn_at(w.starts_at), p_city)) r
  where r.rarity = 'rare'
  order by random() limit 1;
$$;

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
        'spin_wax_min', spin.reward->'spin_wax_min', 'spin_wax_max', spin.reward->'spin_wax_max',
        'spawn_chance', cfg.spawn_chance, 'nearby_max', cfg.nearby_spawn_target,
        'copies_per_catch', (select copies_per_catch from private.vessel_copy_settings where singleton),
        'weights', jsonb_build_object('common', cfg.rarity_common_weight,
          'uncommon', cfg.rarity_uncommon_weight, 'rare', cfg.rarity_rare_weight)),
      'places', (select jsonb_agg(jsonb_build_object('id', g.id, 'parent', g.parent_id,
        'name_zh', g.name_zh, 'name_en', g.name_en, 'country_zh', g.country_zh, 'country_en', g.country_en,
        'has_spots', exists (select 1 from private.game_regions child
          join public.corrupted_spots p on p.city = child.city and p.source_ref not like 'qa:%'
          where g.id in (child.id, child.parent_id))) order by g.country_en, g.name_en)
        from private.game_regions g),
      'rules', (select coalesce(jsonb_agg(jsonb_build_object(
        'vessel', v.id, 'unlimited_copies', v.unlimited_copies, 'rarity', r.rarity, 'habitat', r.habitat,
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
    from private.game_config cfg
    cross join (select private.admin_spin_reward_state() as reward) spin where cfg.singleton
  );
end;
$function$;

-- The returned row gains an optional vessel id. Existing callers read the
-- same columns as before; PostgreSQL requires recreating the function.
drop function public.waypost_spin(uuid, double precision, double precision, double precision);

CREATE OR REPLACE FUNCTION public.waypost_spin(p_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS TABLE(wax_awarded integer, gold_awarded integer, xp_gained integer, wax_balls integer, gold_balls integer, cooldown_end timestamp with time zone, vessel_awarded text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pg public.player_game; cfg private.game_config; post public.public_capsule_spots;
  last_spin timestamptz; spin_id uuid;
  points bigint; rewards jsonb; item jsonb; quantity integer; vessel_id text;
begin
  pg:=private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  select * into post from public.public_capsule_spots where id=p_id and game_enabled and kind='common';
  if post.id is null then raise exception 'too_far'; end if;
  if public.distance_m(p_lat,p_lng,post.lat,post.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  select max(spun_at) into last_spin from public.waypost_spins
    where user_id=auth.uid() and waypost_id=p_id;
  if last_spin+make_interval(secs=>cfg.spin_cooldown_seconds)>now()
    then raise exception 'cooldown'; end if;
  points := private.waypost_lock_xp(post.id);
  select items into strict rewards from private.waypost_levels
    where xp_from <= points order by xp_from desc limit 1;
  wax_awarded := 0;
  gold_awarded := 0;
  vessel_awarded := null;
  -- Process named vessels in id order so concurrent spins lock numbered
  -- editions consistently, even if their levels list the drops differently.
  for item in
    select value from jsonb_array_elements(rewards) with ordinality
    order by value->>'vessel' nulls last, ordinality
  loop
    if (item->'chance')::numeric < 100 and random() * 100 >= (item->'chance')::numeric then continue; end if;
    quantity := (item->'min')::integer +
      floor(random() * ((item->'max')::integer - (item->'min')::integer + 1))::integer;
    case item->>'kind'
      when 'wax' then wax_awarded := wax_awarded + quantity;
      when 'gold' then gold_awarded := gold_awarded + quantity;
      when 'vessel' then
        vessel_id := coalesce(item->>'vessel', private.waypost_rare_vessel(post.city_en));
        if vessel_id is not null and private.waypost_award_vessel(auth.uid(), vessel_id, quantity) then
          vessel_awarded := coalesce(vessel_awarded, vessel_id);
        end if;
    end case;
  end loop;
  insert into public.waypost_spins(user_id,waypost_id,wax_awarded,gold_awarded)
    values(auth.uid(),p_id,wax_awarded,gold_awarded) returning id,spun_at
      into spin_id,cooldown_end;
  perform private.waypost_credit_xp(post, 'spin');
  cooldown_end:=cooldown_end+make_interval(secs=>cfg.spin_cooldown_seconds);
  update public.player_game set wax_balls=public.player_game.wax_balls+wax_awarded,
    gold_balls=public.player_game.gold_balls+gold_awarded
    where user_id=auth.uid() returning * into pg;
  xp_gained:=private.award_xp(auth.uid(),'spin',spin_id::text,cfg.xp_spin);
  wax_balls:=pg.wax_balls; gold_balls:=pg.gold_balls;
  begin
    perform private.city_hunt_record_quest('spin',post.id,p_lat,p_lng);
  exception when others then
    raise warning 'hunt spin bookkeeping failed: %',sqlerrm;
  end;
  return next;
end $function$;

CREATE OR REPLACE FUNCTION public.rack_leave(waypost_id uuid, lat double precision, lng double precision, accuracy double precision, body text, hint text, wait_days integer, lock_question text DEFAULT NULL::text, lock_answer text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  post public.public_capsule_spots;
  distance double precision;
  capsule uuid;
  opens timestamptz;
  letter text := btrim(coalesce(body, ''));
  public_hint text := btrim(coalesce(hint, ''));
  question text := nullif(btrim(lock_question), '');
  secret text := private.rack_normalize_answer(lock_answer);
begin
  if actor is null then raise exception 'not signed in'; end if;
  select w.* into post from public.public_capsule_spots w where w.id = waypost_id for share;
  distance := private.rack_distance(post, lat, lng, accuracy);
  if distance is null or distance > 100 then raise exception 'too_far'; end if;
  if wait_days is null or wait_days not in (1, 7, 30, 365) then raise exception 'bad_wait'; end if;
  if not (private.text_allowed(letter) and private.text_allowed(public_hint) and private.text_allowed(question)) then
    raise exception 'blocked_words';
  end if;
  if question is not null and secret is null then raise exception 'no_answer'; end if;
  if char_length(letter) not between 1 and 280 or char_length(public_hint) > 40
    or char_length(question) > 280 or char_length(lock_answer) > 280
    or (question is null and secret is not null)
  then raise exception 'rejected'; end if;

  opens := statement_timestamp() + wait_days * interval '24 hours';
  insert into public.capsules (sender, vessel, hint, open_at, is_public, public_capsule_spot, lock_question)
  values (actor, 'bottle', public_hint, opens, true, waypost_id, question)
  returning id into capsule;
  insert into public.capsule_contents (capsule_id, message, lock_answer) values (capsule, letter, secret);
  perform private.waypost_credit_xp(post, 'leave');
  return jsonb_build_object('capsule_id', capsule, 'opens_at', opens);
end;
$function$;

CREATE OR REPLACE FUNCTION public.rack_open(capsule_id uuid, lat double precision, lng double precision, accuracy double precision, answer text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  capsule public.capsules;
  post public.public_capsule_spots;
  distance double precision;
  opened jsonb;
begin
  if actor is null then raise exception 'not signed in'; end if;
  select c.* into capsule from public.capsules c where c.id = capsule_id and c.is_public for update;
  if not found or capsule.recipient is not null or capsule.opened_at is not null or capsule.sender = actor
    or capsule.rack_removed_at is not null or private.public_capsule_is_hidden(capsule.id)
  then raise exception 'taken'; end if;
  select w.* into post from public.public_capsule_spots w where w.id = capsule.public_capsule_spot for share;
  distance := private.rack_distance(post, lat, lng, accuracy);
  if distance is null or distance > 100 then raise exception 'too_far'; end if;
  if capsule.open_at > now() then raise exception 'too_early'; end if;
  if capsule.lock_question is not null and not exists (
    select 1 from public.capsule_contents cc where cc.capsule_id = capsule.id
      and cc.lock_answer = private.rack_normalize_answer(answer)
  ) then raise exception 'wrong_answer'; end if;

  update public.capsules set recipient = actor where id = capsule.id;
  insert into public.public_capsule_pickups (capsule_id, finder) values (capsule.id, actor)
    on conflict do nothing;
  select to_jsonb(c) into strict opened from public.open_capsule(capsule.id, lat, lng, accuracy) c;
  update public.capsules set opened_distance_m = round(distance) where id = capsule.id;
  perform private.waypost_credit_xp(post, 'open');
  return opened;
end;
$function$;

revoke all on function
  private.waypost_wax_item(integer, integer),
  private.waypost_lock_xp(uuid),
  private.waypost_credit_xp(public.public_capsule_spots, text),
  private.waypost_level_state(integer),
  private.waypost_level_save(integer, integer, jsonb),
  private.waypost_replace_base_wax(integer, integer),
  private.waypost_award_vessel(uuid, text, integer),
  private.waypost_rare_vessel(text),
  public.waypost_level(uuid),
  public.admin_waypost_levels(),
  public.admin_waypost_level_set(integer, integer, jsonb, text),
  public.waypost_spin(uuid, double precision, double precision, double precision)
from public, anon, authenticated, service_role;

grant execute on function
  public.waypost_level(uuid),
  public.admin_waypost_levels(),
  public.admin_waypost_level_set(integer, integer, jsonb, text),
  public.waypost_spin(uuid, double precision, double precision, double precision)
to authenticated;

notify pgrst, 'reload schema';
commit;
