begin;

-- Active fights retain the health they started with.
alter table private.corrupted_fights
  drop constraint corrupted_fights_max_health_check,
  add constraint corrupted_fights_max_health_check check (max_health between 3 and 14);

create or replace function public.corrupted_fight_start(
  p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision
)
returns table(fight_id uuid, health integer, max_health integer, expires_at timestamptz, attempts_left integer)
language plpgsql security definer set search_path = '' as $$
declare
  player public.player_game;
  cfg private.game_config;
  target record;
  fight private.corrupted_fights;
begin
  player := private.track_position(p_lat,p_lng,p_accuracy);
  select * into strict cfg from private.game_config where singleton;
  select * into strict target from private.corrupted_target(p_spawn,p_lat,p_lng,cfg);
  delete from private.corrupted_fights f
    where f.user_id=auth.uid() and f.expires_at+interval '60 seconds'<=clock_timestamp();
  select * into fight from private.corrupted_fights where user_id=auth.uid() and spawn_id=p_spawn;
  if not found then
    max_health := case target.rarity when 'common' then 10 when 'uncommon' then 12 else 14 end;
    insert into private.corrupted_fights(user_id,spawn_id,max_health,health,expires_at)
      values(auth.uid(),p_spawn,max_health,max_health,target.expires_at) returning * into fight;
  end if;
  if player.wax_balls + 2::bigint * player.gold_balls < fight.health then
    raise exception 'no_balls';
  end if;
  fight_id := fight.id;
  health := fight.health;
  max_health := fight.max_health;
  expires_at := fight.expires_at+interval '60 seconds';
  attempts_left := target.attempts_left;
  return next;
end $$;

-- Start records the current values. Finish validates the recorded health and
-- time since start, including attempts created before this change.
update private.game_config
set landmark_cracks = 40, landmark_seconds = 150, spin_wax_min = 10, spin_wax_max = 10
where singleton;

-- Pre-DF3 fights have a 20 HP bar. Keep their remaining cracks and expiry.
alter table public.landmark_attempts
  add column max_health integer not null default 20,
  add constraint landmark_attempts_health_check check (max_health > 0 and cracks_left <= max_health);

alter table public.landmark_attempts alter column max_health drop default;

-- PostgreSQL requires recreating a function when its returned columns change.
drop function public.landmark_start(uuid,double precision,double precision,double precision);

create function public.landmark_start(
  p_waypost uuid, p_lat double precision, p_lng double precision, p_accuracy double precision
)
returns table(attempt_id uuid, cracks integer, expires_at timestamptz, max_health integer)
language plpgsql security definer set search_path = '' as $$
declare
  player public.player_game;
  cfg private.game_config;
  post public.public_capsule_spots;
  active public.landmark_attempts;
  started timestamptz;
begin
  player := private.track_position(p_lat,p_lng,p_accuracy);
  select * into strict cfg from private.game_config where singleton;
  select * into post from public.public_capsule_spots
    where id=p_waypost and game_enabled and kind='landmark';
  if not found or public.distance_m(p_lat,p_lng,post.lat,post.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;

  started := clock_timestamp();
  select * into active from public.landmark_attempts a
    where a.user_id=auth.uid() and a.won_at is null and a.expires_at>started
    order by a.expires_at desc limit 1 for update;
  if found then
    if active.waypost_id<>p_waypost then raise exception 'active_attempt'; end if;
  else
    insert into public.landmark_attempts(user_id,waypost_id,cracks_left,max_health,started_at,expires_at)
      values(auth.uid(),p_waypost,cfg.landmark_cracks,cfg.landmark_cracks,started,
        started+make_interval(secs=>cfg.landmark_seconds))
      returning * into active;
  end if;
  if player.wax_balls + 2::bigint * player.gold_balls < active.cracks_left then
    raise exception 'no_balls';
  end if;
  attempt_id := active.id;
  cracks := active.cracks_left;
  expires_at := active.expires_at;
  max_health := active.max_health;
  return next;
end $$;

revoke all on function public.landmark_start(uuid,double precision,double precision,double precision)
from public, anon, authenticated, service_role;
grant execute on function public.landmark_start(uuid,double precision,double precision,double precision)
to authenticated, service_role;

create or replace function public.admin_spawning()
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
        'spin_wax_min', cfg.spin_wax_min, 'spin_wax_max', cfg.spin_wax_max,
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
    from private.game_config cfg where cfg.singleton
  );
end;
$function$;

create function private.admin_spin_reward_state() returns jsonb
language plpgsql set search_path = '' as $$
declare
  state jsonb;
begin
  select jsonb_build_object('spin_wax_min', c.spin_wax_min, 'spin_wax_max', c.spin_wax_max)
    into strict state from private.game_config c where c.singleton for update;
  return state;
end $$;

create function public.admin_set_spin_reward(p_wax_min integer, p_wax_max integer, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prior jsonb;
  saved jsonb;
begin
  perform private.require_game_editor();
  if not coalesce(p_wax_min between 0 and p_wax_max and p_wax_max between 0 and 50, false) then
    raise exception 'bad_rule';
  end if;

  prior := private.admin_spin_reward_state();
  update private.game_config set spin_wax_min = p_wax_min, spin_wax_max = p_wax_max where singleton;
  saved := jsonb_build_object('spin_wax_min', p_wax_min, 'spin_wax_max', p_wax_max);
  perform private.admin_log('config.spin', 'config', 'spin', 'Waypost spin reward', prior, saved, p_note);
  return saved;
end $$;

alter function public.admin_undo(bigint,text) rename to admin_undo_before_spin_reward;
alter function public.admin_undo_before_spin_reward(bigint,text) set schema private;

create function public.admin_undo(p_action_id bigint, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event private.admin_actions;
  current_reward jsonb;
begin
  select * into event from private.admin_actions where id = p_action_id;
  if event.target_type is distinct from 'config' or event.target_id is distinct from 'spin' then
    return private.admin_undo_before_spin_reward(p_action_id, p_note);
  end if;

  perform private.require_game_editor();
  if event.action <> 'config.spin' then raise exception 'not_undoable'; end if;
  current_reward := private.admin_spin_reward_state();
  if current_reward is distinct from event.after
    or exists (select 1 from private.admin_actions a where a.target_type = 'config'
       and a.target_id = 'spin' and a.action = 'undo' and a.after->>'undo_of' = event.id::text)
  then raise exception 'stale'; end if;

  update private.game_config
    set spin_wax_min = (event.before->>'spin_wax_min')::integer,
        spin_wax_max = (event.before->>'spin_wax_max')::integer
    where singleton;
  perform private.admin_log('undo', 'config', 'spin', event.target_label,
    event.after, event.before || jsonb_build_object('undo_of', event.id), p_note);
  return event.before;
end $$;

revoke all on function private.admin_spin_reward_state(), private.admin_undo_before_spin_reward(bigint,text),
  public.admin_set_spin_reward(integer,integer,text), public.admin_undo(bigint,text)
from public, anon, authenticated, service_role;
grant execute on function public.admin_set_spin_reward(integer,integer,text), public.admin_undo(bigint,text) to authenticated;

notify pgrst, 'reload schema';

commit;
