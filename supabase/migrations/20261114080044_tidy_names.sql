-- Vocabulary migration. Apply only after review. Old RPCs remain for one release.

begin;

create function private.legacy_hunt_keys(value jsonb) returns jsonb language sql immutable set search_path='' as $keys$
select case jsonb_typeof(value)
 when 'object' then (select coalesce(jsonb_object_agg(case key when 'per_quest' then 'per_waypoint' when 'quests' then case when jsonb_typeof(v)='array' and (v->0) ? 'key' then 'steps' else 'waypoints' end when 'quest_type' then 'mission_type' when 'quest_id' then 'waypoint_id' when 'location_lat' then 'lat' when 'location_lng' then 'lng' else key end,private.legacy_hunt_keys(v)),'{}'::jsonb) from jsonb_each(value) as e(key,v))
 when 'array' then (select coalesce(jsonb_agg(private.legacy_hunt_keys(v) order by ord),'[]'::jsonb) from jsonb_array_elements(value) with ordinality as e(v,ord))
 else value end
$keys$;
revoke all on function private.legacy_hunt_keys(jsonb) from public,anon;
grant execute on function private.legacy_hunt_keys(jsonb) to authenticated;

create function private.current_hunt_keys(value jsonb) returns jsonb language sql immutable set search_path='' as $keys$
select case jsonb_typeof(value)
 when 'object' then (select coalesce(jsonb_object_agg(case key when 'waypoints' then 'quests' when 'mission_type' then 'quest_type' when 'waypoint_id' then 'quest_id' when 'lat' then 'location_lat' when 'lng' then 'location_lng' else key end,private.current_hunt_keys(v)),'{}'::jsonb) from jsonb_each(value) as e(key,v))
 when 'array' then (select coalesce(jsonb_agg(private.current_hunt_keys(v) order by ord),'[]'::jsonb) from jsonb_array_elements(value) with ordinality as e(v,ord))
 else value end
$keys$;
revoke all on function private.current_hunt_keys(jsonb) from public,anon;
grant execute on function private.current_hunt_keys(jsonb) to authenticated;

alter table public.hunt_steps rename to city_hunt_quests;

alter table public.hunt_progress rename to city_hunt_quest_progress;

alter table public.hunt_runs rename to city_hunt_runs;

alter table public.hunt_spin_credits rename to city_hunt_spin_credits;

alter table public.hunt_passport_stamps rename to city_hunt_passport_stamps;

alter table public.hunt_waypoints rename to private_hunt_quests;

alter table public.hunt_completions rename to private_hunt_quest_progress;

alter table public.hunt_members rename to private_hunt_members;

alter table private.hunt_waypoint_secrets rename to private_hunt_quest_secrets;

alter table private.hunt_reports rename to private_hunt_reports;

alter table public.sea_shores rename to public_capsule_spots;

alter table public.sea_pickups rename to public_capsule_pickups;

alter table public.sea_reports rename to public_capsule_reports;

alter table public.private_hunt_quests rename column mission_type to quest_type;

alter table public.private_hunt_quest_progress rename column waypoint_id to quest_id;

alter table private.private_hunt_quest_secrets rename column waypoint_id to quest_id;

alter table public.city_hunt_quests rename column step_key to quest_type;

alter table public.capsules rename column sea to is_public;

alter table public.capsules rename column shore to public_capsule_spot;

alter table public.capsules rename column sea_returns to public_capsule_returns;

alter table public.private_hunt_quests rename column lat to location_lat;

alter table public.private_hunt_quests rename column lng to location_lng;

alter table public.capsules add column sea boolean generated always as (is_public) stored;

alter table public.capsules add column shore uuid generated always as (public_capsule_spot) stored;

alter table public.capsules add column sea_returns integer generated always as (public_capsule_returns) stored;

alter function private.hunt_local_day(h hunts, at_time timestamp with time zone) rename to city_hunt_local_day;

alter function private.hunt_run_end(h hunts, started_at timestamp with time zone) rename to city_hunt_run_end;

alter function private.mark_hunt_first_join() rename to private_hunt_mark_first_join;

alter function private.lock_owned_hunt(p_hunt text) rename to private_hunt_lock_owned;

alter function private.hunt_apply_draft(p_hunt text, p_draft jsonb) rename to private_hunt_apply_draft;

alter function private.hunt_action(p_kind text, p_id uuid, p_lat double precision, p_lng double precision) rename to city_hunt_quest_progress;

alter function private.hunt_object(p_hunt text, p_user uuid) rename to city_hunt_object;

alter function private.hunt_player_object(h hunts, m private_hunt_members) rename to private_hunt_player_object;

alter function private.hunt_clean_code(p_code text) rename to private_hunt_clean_code;

alter function private.hunt_normalize_answer(p_answer text) rename to private_hunt_normalize_answer;

CREATE OR REPLACE FUNCTION public.private_hunt_preview(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  select * into h from public.hunts where join_code = private.private_hunt_clean_code(p_code)
    and kind = 'private' and hidden_at is null;
  if not found then raise exception 'bad_code'; end if;
  if h.status <> 'published' or now() >= h.ends_at then raise exception 'closed'; end if;
  return private.private_hunt_player_object(h, null::public.private_hunt_members);
end $function$
;

revoke all on function public.private_hunt_preview(p_code text) from public,anon,authenticated;

grant execute on function public.private_hunt_preview(p_code text) to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_join_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h public.hunts;
  m public.private_hunt_members;
  player uuid := auth.uid();
  joined timestamptz;
begin
  if not exists (select 1 from public.profiles where id = player) then raise exception 'not_allowed'; end if;
  select * into h from public.hunts where join_code = private.private_hunt_clean_code(p_code)
    and kind = 'private' and hidden_at is null for update;
  if not found then raise exception 'bad_code'; end if;
  joined := clock_timestamp();
  if h.status <> 'published' or joined >= h.ends_at then raise exception 'closed'; end if;
  select * into m from public.private_hunt_members where hunt_id = h.id and user_id = player;
  if not found then
    insert into public.private_hunt_members (hunt_id, user_id, joined_at, started_at)
    values (h.id, player, joined, greatest(joined, h.starts_at)) returning * into m;
  end if;
  return private.private_hunt_player_object(h, m);
end $function$
;

revoke all on function public.private_hunt_join_code(p_code text) from public,anon,authenticated;

grant execute on function public.private_hunt_join_code(p_code text) to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_leaderboard(p_hunt text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts;
begin
  select * into h from public.hunts where id = p_hunt and kind = 'private';
  if auth.uid() is null or not found then raise exception 'not_allowed'; end if;
  if h.owner <> auth.uid() then
    if h.hidden_at is not null or not exists (
      select 1 from public.private_hunt_members where hunt_id = h.id and user_id = auth.uid()
    ) then raise exception 'not_joined'; end if;
    if not h.leaderboard_visible then raise exception 'not_allowed'; end if;
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.points desc, r.duration_s nulls last, r.name, r."user"), '[]'::jsonb)
    from (
      select p.id as "user", p.name, p.avatar, m.points, m.finished_at,
        extract(epoch from m.finished_at - m.started_at)::integer as duration_s, p.id = auth.uid() as you
      from public.private_hunt_members m join public.profiles p on p.id = m.user_id
      where m.hunt_id = h.id
    ) r
  );
end $function$
;

revoke all on function public.private_hunt_leaderboard(p_hunt text) from public,anon,authenticated;

grant execute on function public.private_hunt_leaderboard(p_hunt text) to authenticated;

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
  if h.hidden_at is null and exists (select 1 from private.private_hunt_reports where hunt_id = h.id offset 1) then
    update public.hunts set hidden_at = clock_timestamp() where id = h.id;
  end if;
end $function$
;

revoke all on function public.private_hunt_report(p_hunt text) from public,anon,authenticated;

grant execute on function public.private_hunt_report(p_hunt text) to authenticated;

CREATE OR REPLACE FUNCTION private.city_hunt_local_day(h hunts, at_time timestamp with time zone)
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select (at_time at time zone coalesce(h.reset_timezone, 'UTC'))::date
$function$
;

CREATE OR REPLACE FUNCTION private.city_hunt_run_end(h hunts, started_at timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO ''
AS $function$
  select least(h.ends_at,
    started_at + make_interval(mins => h.time_limit_min),
    ((private.city_hunt_local_day(h, started_at) + 1)::timestamp at time zone h.reset_timezone))
$function$
;

CREATE OR REPLACE FUNCTION private.private_hunt_member_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' and new.hunt_id = old.hunt_id then return new; end if;
  perform 1 from public.hunts where id = new.hunt_id and kind = 'private' for update;
  if not found then raise exception 'unknown private hunt'; end if;
  if exists (select 1 from public.private_hunt_members where hunt_id = new.hunt_id offset 499)
     and not exists (select 1 from public.private_hunt_members where hunt_id = new.hunt_id and user_id = new.user_id)
  then raise exception 'too_many'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.private_hunt_mark_first_join()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  update public.hunts set first_joined_at = new.joined_at
  where id = new.hunt_id and first_joined_at is null;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.private_hunt_lock_owned(p_hunt text)
 RETURNS hunts
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare h public.hunts;
begin
  select * into h from public.hunts
  where id = p_hunt and kind = 'private' and owner = auth.uid() for update;
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
  return h;
end $function$
;

CREATE OR REPLACE FUNCTION public.my_passport()
 RETURNS TABLE(place text, name_zh text, name_en text, city_zh text, city_en text, first_at timestamp with time zone, how_earned text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return query
    select q.place,q.name_zh,q.name_en,q.city_zh,q.city_en,q.first_at,q.how_earned
    from (
      select p.id as place,p.name_zh,p.name_en,p.city_zh,p.city_en,
        s.first_at,s.how_earned,p.sort as place_sort
      from public.passport_stamps s join public.places p on p.id=s.place
      where s.user_id=auth.uid()
      union all
      select h.id,h.name_zh,h.name_en,h.city_zh,h.city_en,
        s.first_at,'hunt'::text,2147483647
      from public.city_hunt_passport_stamps s join public.hunts h on h.id=s.hunt_id
      where s.user_id=auth.uid()
      union all
      select h.id,h.name_zh,h.name_en,''::text,''::text,
        m.finished_at,'private_hunt'::text,2147483647
      from public.private_hunt_members m join public.hunts h on h.id=m.hunt_id
      where m.user_id=auth.uid() and m.finished_at is not null and h.kind='private'
    ) q order by q.first_at,q.place_sort;
end $function$
;

CREATE OR REPLACE FUNCTION private.private_hunt_area(p_hunt text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with centre as (
    select avg(location_lat) as lat, avg(location_lng) as lng from public.private_hunt_quests where hunt_id = p_hunt
  )
  select jsonb_build_object('lat', coalesce(c.lat, 0), 'lng', coalesce(c.lng, 0),
    'radius_m', case when c.lat is null then 200 else
      ceil(greatest(200, 1.25 * (select max(public.distance_m(c.lat, c.lng, w.location_lat, w.location_lng))
        from public.private_hunt_quests w where w.hunt_id = p_hunt)))::integer end)
  from centre c
$function$
;

CREATE OR REPLACE FUNCTION private.private_hunt_apply_draft(p_hunt text, p_draft jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  h public.hunts := private.private_hunt_lock_owned(p_hunt);
  draft record;
begin
  if h.status = 'closed' or (h.status = 'published' and h.ends_at <= now())
  then raise exception 'closed'; end if;
  select * into draft from jsonb_to_record(p_draft) as d(
    name text, description text, cover text, route_mode text, leaderboard_visible boolean,
    starts_at timestamptz, ends_at timestamptz, time_limit_min integer);
  if nullif(btrim(draft.name), '') is null then raise exception 'name required'; end if;
  if h.first_joined_at is not null
    and (h.starts_at, h.ends_at, h.route_mode, h.time_limit_min) is distinct from
        (draft.starts_at, draft.ends_at, draft.route_mode, draft.time_limit_min)
  then raise exception 'hunt_locked' using errcode = 'PT409'; end if;
  update public.hunts set name_en = btrim(draft.name), name_zh = btrim(draft.name),
    description = coalesce(draft.description, ''), cover = draft.cover,
    route_mode = draft.route_mode, leaderboard_visible = draft.leaderboard_visible,
    starts_at = draft.starts_at, ends_at = draft.ends_at, time_limit_min = draft.time_limit_min
  where id = h.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.city_hunt_join(p_hunt text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.hunts where kind = 'system' and id=p_hunt;
  if h.id is null then raise exception 'unknown hunt'; end if;
  if h.ends_at<=now() then raise exception 'hunt closed'; end if;
  insert into public.city_hunt_quest_progress(hunt_id,user_id) values(h.id,auth.uid())
    on conflict (hunt_id,user_id) do nothing;
  return private.city_hunt_object(h.id,auth.uid());
end $function$
;

revoke all on function public.city_hunt_join(p_hunt text) from public,anon,authenticated;

grant execute on function public.city_hunt_join(p_hunt text) to authenticated;

CREATE OR REPLACE FUNCTION public.city_hunt_check_in(p_hunt text, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts; p public.city_hunt_quest_progress; cfg private.game_config;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.hunts where kind = 'system' and id=p_hunt;
  if h.id is null or now()<h.starts_at or now()>=h.ends_at then raise exception 'hunt closed'; end if;
  if not exists (select 1 from public.city_hunt_quest_progress where hunt_id=h.id and user_id=auth.uid())
    then raise exception 'join first'; end if;
  -- Match the game actions' lock order: player_game before city_hunt_quest_progress.
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  if public.distance_m(p_lat,p_lng,h.keeper_lat,h.keeper_lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  select * into p from public.city_hunt_quest_progress where hunt_id=h.id and user_id=auth.uid() for update;
  if p.user_id is null then raise exception 'join first'; end if;

  if (h.reset_timezone is not null and (p.finished_at is null or h.time_limit_min is not null)
      and private.city_hunt_local_day(h,p.checked_in_at)<private.city_hunt_local_day(h,now()))
    or (h.time_limit_min is not null and p.finished_at is null
      and now()>=private.city_hunt_run_end(h,p.checked_in_at)) then
    delete from public.city_hunt_spin_credits where hunt_id=h.id and user_id=auth.uid();
    update public.city_hunt_quest_progress set checked_in_at=now(),finished_at=null,
      spin_count=0,restore_count=0,landmark_count=0
      where hunt_id=h.id and user_id=auth.uid();
  elsif p.checked_in_at is null then
    update public.city_hunt_quest_progress set checked_in_at=now()
      where hunt_id=h.id and user_id=auth.uid();
  end if;
  return private.city_hunt_object(h.id,auth.uid());
end $function$
;

revoke all on function public.city_hunt_check_in(p_hunt text, p_lat double precision, p_lng double precision, p_accuracy double precision) from public,anon,authenticated;

grant execute on function public.city_hunt_check_in(p_hunt text, p_lat double precision, p_lng double precision, p_accuracy double precision) to authenticated;

CREATE OR REPLACE FUNCTION public.city_hunt_finish(p_hunt text, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts; p public.city_hunt_quest_progress; cfg private.game_config;
  required_spin integer; required_restore integer; required_landmark integer;
  paid integer := 0; gold integer := 0; first_finish boolean;
  today date;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.hunts where kind = 'system' and id=p_hunt;
  if h.id is null or now()<h.starts_at or now()>=h.ends_at then raise exception 'hunt closed'; end if;
  if not exists (select 1 from public.city_hunt_quest_progress where hunt_id=h.id and user_id=auth.uid())
    then raise exception 'check in first'; end if;
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into p from public.city_hunt_quest_progress where hunt_id=h.id and user_id=auth.uid() for update;
  today:=private.city_hunt_local_day(h,now());
  if p.checked_in_at is null
    or (h.reset_timezone is not null and (p.finished_at is null or h.time_limit_min is not null)
      and private.city_hunt_local_day(h,p.checked_in_at)<today) then raise exception 'check in first'; end if;
  if p.finished_at is not null then raise exception 'already finished'; end if;
  if h.time_limit_min is not null and now()>=private.city_hunt_run_end(h,p.checked_in_at)
    then raise exception 'time_up' using hint = 'time_up'; end if;
  select max(goal) filter (where quest_type='spin'),max(goal) filter (where quest_type='restore'),
    max(goal) filter (where quest_type='landmark') into required_spin,required_restore,required_landmark
    from public.city_hunt_quests where hunt_id=h.id;
  if required_spin is null or required_restore is null or required_landmark is null
    or p.spin_count<required_spin or p.restore_count<required_restore
    or p.landmark_count<required_landmark then raise exception 'hunt incomplete'; end if;
  select * into cfg from private.game_config where singleton;
  if public.distance_m(p_lat,p_lng,h.keeper_lat,h.keeper_lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;

  if h.time_limit_min is not null then
    insert into public.city_hunt_runs(hunt_id,user_id,day,started_at,finished_at,duration_s)
      values(h.id,auth.uid(),today,p.checked_in_at,now(),
        floor(extract(epoch from now()-p.checked_in_at))::integer);
  end if;
  update public.city_hunt_quest_progress set finished_at=now()
    where hunt_id=h.id and user_id=auth.uid();

  insert into public.city_hunt_passport_stamps(hunt_id,user_id,first_at)
    values(h.id,auth.uid(),now()) on conflict do nothing;
  first_finish:=found;
  if first_finish then
    paid:=private.award_xp(auth.uid(),'hunt',h.id,h.reward_xp);
    gold:=h.reward_gold;
    update public.player_game set gold_balls=gold_balls+gold where user_id=auth.uid();
  elsif h.time_limit_min is not null and h.repeat_xp>0 then
    paid:=private.award_xp(auth.uid(),'hunt_repeat',h.id||':'||today::text,h.repeat_xp);
  end if;
  return jsonb_build_object('hunt',private.city_hunt_object(h.id,auth.uid()),
    'xp_gained',paid,'gold_gained',gold,'state','finished');
end $function$
;

revoke all on function public.city_hunt_finish(p_hunt text, p_lat double precision, p_lng double precision, p_accuracy double precision) from public,anon,authenticated;

grant execute on function public.city_hunt_finish(p_hunt text, p_lat double precision, p_lng double precision, p_accuracy double precision) to authenticated;

CREATE OR REPLACE FUNCTION private.city_hunt_quest_progress(p_kind text, p_id uuid, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts; p public.city_hunt_quest_progress; credited uuid;
begin
  for h in select x.* from (select * from public.hunts where kind = 'system') x
    where now()>=x.starts_at and now()<x.ends_at
      and public.distance_m(p_lat,p_lng,x.area_lat,x.area_lng)<=x.area_radius_m
      and (p_kind='spin' and exists (select 1 from public.public_capsule_spots s
        where s.id=p_id and s.kind='common' and s.game_enabled
          and public.distance_m(s.lat,s.lng,x.area_lat,x.area_lng)<=x.area_radius_m)
        or p_kind='restore' and exists (select 1 from public.corrupted_spots s
          where s.id=p_id and public.distance_m(s.lat,s.lng,x.area_lat,x.area_lng)<=x.area_radius_m)
        or p_kind='landmark' and x.landmark=p_id)
  loop
    select * into p from public.city_hunt_quest_progress
      where hunt_id=h.id and user_id=auth.uid() for update;
    if p.user_id is null or p.checked_in_at is null or p.finished_at is not null
      or now()>=private.city_hunt_run_end(h,p.checked_in_at) then continue; end if;
    if p_kind='spin' then
      insert into public.city_hunt_spin_credits(hunt_id,user_id,waypost_id)
        values(h.id,auth.uid(),p_id) on conflict do nothing returning waypost_id into credited;
      if credited is not null then
        update public.city_hunt_quest_progress set spin_count=spin_count+1
          where hunt_id=h.id and user_id=auth.uid();
      end if;
    elsif p_kind='restore' then
      update public.city_hunt_quest_progress set restore_count=restore_count+1
        where hunt_id=h.id and user_id=auth.uid();
    elsif p_kind='landmark' then
      update public.city_hunt_quest_progress set landmark_count=landmark_count+1
        where hunt_id=h.id and user_id=auth.uid();
    end if;
  end loop;
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
    and (select count(*) from public.public_capsule_reports r where r.capsule_id = c.id) < 2
  order by public.distance_m(p_lat, p_lng, s.lat, s.lng), c.open_at
  limit 100;
$function$
;

revoke all on function public.public_capsule_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision) from public,anon,authenticated;

grant execute on function public.public_capsule_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision) to authenticated;

CREATE OR REPLACE FUNCTION public.public_capsule_return(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.capsules; old_shore public.public_capsule_spots; next_shore public.public_capsule_spots;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from public.capsules where id = p_id for update;
  if c.id is null or not c.is_public or c.recipient is distinct from auth.uid() or c.opened_at is null then
    raise exception 'taken';
  end if;
  select * into old_shore from public.public_capsule_spots where id = c.public_capsule_spot;
  select * into next_shore from public.public_capsule_spots s
    where s.id <> old_shore.id
      and public.distance_m(s.lat, s.lng, old_shore.lat, old_shore.lng) >= 1000
    order by case when s.city_en = old_shore.city_en then 0 else 1 end, random() limit 1;
  if next_shore.id is null then raise exception 'no_shore'; end if;
  update public.capsules set recipient = null, public_capsule_spot = next_shore.id,
    open_at = now() + interval '1 day', public_capsule_returns = public_capsule_returns + 1,
    opened_at = null, seen_at = null, opened_lat = null, opened_lng = null,
    opened_distance_m = null, gift_code = null
    where id = p_id;
end $function$
;

revoke all on function public.public_capsule_return(p_id uuid) from public,anon,authenticated;

grant execute on function public.public_capsule_return(p_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.public_capsule_drop(p_message text, p_hint text, p_vessel text, p_drift_days integer, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS TABLE(id uuid, spot_zh text, spot_en text, available_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.vessels; v_ed integer; s public.public_capsule_spots; v_id uuid;
  v_message text; v_hint text; v_scan text; v_open_at timestamptz; w text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  v_message := btrim(coalesce(p_message, ''));
  v_hint := btrim(coalesce(p_hint, ''));
  if char_length(v_message) not between 1 and 280 or char_length(v_hint) > 40
    or p_drift_days is null or p_drift_days not in (1,7,30,365) then
    raise exception 'rejected';
  end if;
  -- First-pass safety gate, deliberately small and reviewable. A future
  -- moderation service can replace it after Roy chooses one. Check the hint too.
  v_scan := lower(v_message || ' ' || v_hint);
  if v_scan ~* '[[:alnum:]._%+\-]+@[[:alnum:].\-]+\.[[:alpha:]]{2,}'
    or v_scan ~* '(https?://|www\.|[[:alnum:]\-]+\.(com|net|org|io|cn|hk|tw|sg|my|jp|kr)(/|\b))'
    or v_scan ~ '(\+?[0-9][0-9 ()+.-]{6,}[0-9])'
  then raise exception 'rejected'; end if;
  foreach w in array array['kill yourself','go die','fuck you','bitch','nigger','去死','滾開','傻逼','操你','冚家剷'] loop
    if position(w in v_scan) > 0 then raise exception 'rejected'; end if;
  end loop;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180
    or p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200 then
    raise exception 'no_shore';
  end if;
  select * into s from public.public_capsule_spots x
    where public.distance_m(p_lat, p_lng, x.lat, x.lng) <= 3000
    order by public.distance_m(p_lat, p_lng, x.lat, x.lng), x.id limit 1;
  if s.id is null then raise exception 'no_shore'; end if;
  -- Exactly the current send_capsule vessel rule: free catalogue items are
  -- available; priced and place-earned vessels must already be owned.
  select * into v from public.vessels where public.vessels.id = p_vessel;
  if v.id is null then raise exception 'unknown vessel'; end if;
  if v.price_mop > 0 or v.earned_place is not null then
    select edition_no into v_ed from public.owned_vessels where user_id = auth.uid() and vessel = p_vessel;
    if not found then raise exception 'vessel not owned' using hint = 'not_owned'; end if;
  end if;
  v_open_at := now() + make_interval(days => p_drift_days);
  insert into public.capsules (sender, recipient, vessel, hint, open_at, edition_no, is_public, public_capsule_spot)
    values (auth.uid(), null, p_vessel, v_hint, v_open_at, v_ed, true, s.id)
    returning public.capsules.id into v_id;
  insert into public.capsule_contents (capsule_id, message) values (v_id, v_message);
  return query select v_id, s.name_zh, s.name_en, v_open_at;
end $function$
;

revoke all on function public.public_capsule_drop(p_message text, p_hint text, p_vessel text, p_drift_days integer, p_lat double precision, p_lng double precision, p_accuracy double precision) from public,anon,authenticated;

grant execute on function public.public_capsule_drop(p_message text, p_hint text, p_vessel text, p_drift_days integer, p_lat double precision, p_lng double precision, p_accuracy double precision) to authenticated;

CREATE OR REPLACE FUNCTION public.public_capsule_report(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.capsules;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_reason is null or p_reason not in ('unkind','personal','spam','other') then raise exception 'rejected'; end if;
  select * into c from public.capsules where id = p_id for update;
  if c.id is null or not c.is_public or not exists (
    select 1 from public.public_capsule_pickups x where x.capsule_id = p_id and x.finder = auth.uid()
  ) then raise exception 'taken'; end if;
  insert into public.public_capsule_reports (capsule_id, reporter, reason)
    values (p_id, auth.uid(), p_reason) on conflict (capsule_id, reporter) do nothing;
  -- Reporting an opened bottle removes it from this finder's Inbox at once.
  -- One report leaves it ashore for others; two reports hide it globally.
  if c.recipient = auth.uid() then
    update public.capsules set recipient = null, opened_at = null, seen_at = null,
      opened_lat = null, opened_lng = null, opened_distance_m = null,
      open_at = now()
      where id = p_id;
  end if;
end $function$
;

revoke all on function public.public_capsule_report(p_id uuid, p_reason text) from public,anon,authenticated;

grant execute on function public.public_capsule_report(p_id uuid, p_reason text) to authenticated;

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
    or (select count(*) from public.public_capsule_reports r where r.capsule_id = p_id) >= 2
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

revoke all on function public.public_capsule_pick_up(p_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision) from public,anon,authenticated;

grant execute on function public.public_capsule_pick_up(p_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision) to authenticated;

CREATE OR REPLACE FUNCTION public.game_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cfg private.game_config; result_spawns jsonb; result_wayposts jsonb; wave bigint; candidate jsonb; pass integer; spawn_candidates jsonb; attempt_spawns jsonb;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  wave := floor(extract(epoch from now())/(cfg.wave_minutes*60))::bigint;
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
      exit when jsonb_array_length(attempt_spawns)>=cfg.nearby_spawn_target;
    end loop;
    if jsonb_array_length(attempt_spawns)>jsonb_array_length(result_spawns) then result_spawns:=attempt_spawns;end if;
    exit when jsonb_array_length(result_spawns)>=cfg.nearby_spawn_target;
  end loop;
  -- Choose the wave's batch before hiding caught/exhausted releases.
  -- Removing one must leave a vacancy until the next wave, rather than refill it.
  select coalesce(jsonb_agg(value),'[]'::jsonb) into result_spawns
  from jsonb_array_elements(result_spawns)
  where not (value->>'already_caught')::boolean and (value->>'attempts_left')::integer>0;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'kind',s.kind,'name_zh',s.name_zh,'name_en',s.name_en,
    'city_zh',s.city_zh,'city_en',s.city_en,'place',s.place,
    'lat',s.lat,'lng',s.lng,'scene',s.scene,
    'cooldown_end',case when s.kind='common'
      then (select max(spun_at)+make_interval(secs=>cfg.spin_cooldown_seconds)
        from public.waypost_spins x where x.user_id=auth.uid() and x.waypost_id=s.id)
      else null end)
    order by s.kind,s.name_en),'[]'::jsonb) into result_wayposts
  from public.public_capsule_spots s
  where s.game_enabled and public.distance_m(p_lat,p_lng,s.lat,s.lng)<=5000;
  return jsonb_build_object('spawns',result_spawns,'wayposts',result_wayposts);
end $function$
;

revoke all on function public.game_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision) from public,anon,authenticated;

grant execute on function public.game_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision) to authenticated;

CREATE OR REPLACE FUNCTION public.capsule_throw(p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision, p_ball text, p_ring double precision, p_hit boolean)
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
  current_wave := floor(extract(epoch from now())/(cfg.wave_minutes*60))::bigint;
  if wave not between current_wave-1 and current_wave then raise exception 'expired'; end if;
  select * into spot from public.corrupted_spots where id=split_part(p_spawn,':',1)::uuid;
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
        where user_id=auth.uid() and public.owned_vessels.vessel=capsule_throw.vessel);
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
        perform private.city_hunt_quest_progress('restore',spot.id,p_lat,p_lng);
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
end $function$
;

revoke all on function public.capsule_throw(p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision, p_ball text, p_ring double precision, p_hit boolean) from public,anon,authenticated;

grant execute on function public.capsule_throw(p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision, p_ball text, p_ring double precision, p_hit boolean) to authenticated;

CREATE OR REPLACE FUNCTION public.landmark_start(p_waypost uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS TABLE(attempt_id uuid, cracks integer, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cfg private.game_config; post public.public_capsule_spots; active public.landmark_attempts;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  select * into post from public.public_capsule_spots
    where id=p_waypost and game_enabled and kind='landmark';
  if post.id is null or public.distance_m(p_lat,p_lng,post.lat,post.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  select * into active from public.landmark_attempts a
    where a.user_id=auth.uid() and a.won_at is null and a.expires_at>now()
    order by a.expires_at desc limit 1 for update;
  if active.id is not null then
    if active.waypost_id<>p_waypost then raise exception 'active_attempt'; end if;
    attempt_id:=active.id; cracks:=active.cracks_left; expires_at:=active.expires_at;
  else
    insert into public.landmark_attempts(user_id,waypost_id,cracks_left,expires_at)
      values(auth.uid(),p_waypost,cfg.landmark_cracks,
        now()+make_interval(secs=>cfg.landmark_seconds))
      returning id,cracks_left,public.landmark_attempts.expires_at
      into attempt_id,cracks,expires_at;
  end if;
  return next;
end $function$
;

CREATE OR REPLACE FUNCTION public.landmark_hit(p_attempt uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_ball text, p_ring double precision)
 RETURNS TABLE(result text, cracks integer, expires_at timestamp with time zone, vessel text, copies integer, stars integer, is_new boolean, xp_gained integer, wax_balls integer, gold_balls integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pg public.player_game; cfg private.game_config; active public.landmark_attempts;
  post public.public_capsule_spots; damage integer; reward text;
begin
  if p_ball is null or p_ball not in ('wax','gold') or p_ring is null
    or p_ring::text in ('NaN','Infinity','-Infinity')
    then raise exception 'rejected'; end if;
  pg:=private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  select * into active from public.landmark_attempts
    where id=p_attempt and user_id=auth.uid() for update;
  if active.id is null or active.expires_at<=now() or active.won_at is not null
    then raise exception 'expired'; end if;
  select * into post from public.public_capsule_spots
    where id=active.waypost_id and game_enabled and kind='landmark';
  if post.id is null or public.distance_m(p_lat,p_lng,post.lat,post.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  if (p_ball='wax' and pg.wax_balls<1) or (p_ball='gold' and pg.gold_balls<1)
    then raise exception 'no_balls'; end if;
  update public.player_game set
    wax_balls=public.player_game.wax_balls-case when p_ball='wax' then 1 else 0 end,
    gold_balls=public.player_game.gold_balls-case when p_ball='gold' then 1 else 0 end
    where user_id=auth.uid() returning * into pg;
  damage:=case when p_ball='gold' or
    least(1.0,greatest(0.0,p_ring))>=cfg.landmark_strong_ring
    then cfg.landmark_strong_damage else cfg.landmark_normal_damage end;
  update public.landmark_attempts
    set cracks_left=greatest(0,cracks_left-damage),
      won_at=case when cracks_left<=damage then now() else null end
    where id=p_attempt returning cracks_left,public.landmark_attempts.expires_at
      into cracks,expires_at;
  result:='hit'; vessel:=null; copies:=null; stars:=null; is_new:=false; xp_gained:=0;
  if cracks=0 then
    select id into reward from public.vessels where earned_place=post.place;
    if reward is null then raise exception 'missing landmark vessel'; end if;
    vessel:=reward;
    is_new:=not exists (select 1 from public.owned_vessels o
      where o.user_id=auth.uid() and o.vessel=reward);
    insert into public.owned_vessels(user_id,vessel,copies)
      values(auth.uid(),reward,1)
      on conflict on constraint owned_vessels_pkey do update set copies=public.owned_vessels.copies+1
      returning public.owned_vessels.copies into copies;
    select count(*)::integer into stars from unnest(cfg.star_thresholds) threshold
      where threshold<=copies;
    insert into public.passport_stamps(user_id,place,first_at,how_earned)
      values(auth.uid(),post.place,now(),'landmark')
      on conflict (user_id,place) do nothing;
    -- The first win at a place pays XP; repeat wins still grant a copy.
    xp_gained:=private.award_xp(auth.uid(),'landmark_win',post.place,cfg.xp_landmark);
    result:='won';
    begin
      perform private.city_hunt_quest_progress('landmark',post.id,p_lat,p_lng);
    exception when others then
      raise warning 'hunt landmark bookkeeping failed: %',sqlerrm;
    end;
  end if;
  wax_balls:=pg.wax_balls; gold_balls:=pg.gold_balls;
  return next;
end $function$
;

CREATE OR REPLACE FUNCTION private.city_hunt_object(p_hunt text, p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id',h.id,'name_zh',h.name_zh,'name_en',h.name_en,
    'city_zh',h.city_zh,'city_en',h.city_en,
    'starts_at',h.starts_at,'ends_at',h.ends_at,
    'keeper',jsonb_build_object('lat',h.keeper_lat,'lng',h.keeper_lng),
    'keeper_spot_zh',h.keeper_spot_zh,'keeper_spot_en',h.keeper_spot_en,
    'area',jsonb_build_object('lat',h.area_lat,'lng',h.area_lng,'radius_m',h.area_radius_m),
    'landmark',h.landmark,
    'landmark_name_zh',s.name_zh,'landmark_name_en',s.name_en,
    'reward',jsonb_build_object('xp',h.reward_xp,'gold',h.reward_gold),
    'quests',(select jsonb_agg(jsonb_build_object('key',st.quest_type,'goal',st.goal,
      'count',case when status.reset or status.timed_out then 0
        else least(st.goal,case st.quest_type
          when 'checkin' then case when p.checked_in_at is null then 0 else 1 end
          when 'spin' then coalesce(p.spin_count,0)
          when 'restore' then coalesce(p.restore_count,0)
          when 'landmark' then coalesce(p.landmark_count,0)
          when 'return' then case when p.finished_at is null then 0 else 1 end end)
        end) order by st.ordinal)
      from public.city_hunt_quests st where st.hunt_id=h.id),
    'joined_at',p.joined_at,
    'checked_in_at',case when not status.reset and not status.timed_out then p.checked_in_at end,
    'finished_at',case when not status.reset then p.finished_at end,
    'time_limit_min',h.time_limit_min,
    -- Keep the expired same-day deadline visible so the client can show "time's up".
    'run_started_at',case when h.time_limit_min is not null and not status.reset then p.checked_in_at end,
    'run_ends_at',case when h.time_limit_min is not null and not status.reset then deadline.ends_at end,
    'best_s',records.best_s,'today_s',records.today_s,
    'finished_today',coalesce(private.city_hunt_local_day(h,p.finished_at)=day.today,false))
  from public.hunts h
  join public.public_capsule_spots s on s.id=h.landmark
  left join public.city_hunt_quest_progress p on p.hunt_id=h.id and p.user_id=p_user
  cross join lateral (select private.city_hunt_local_day(h,now()) as today) day
  cross join lateral (select private.city_hunt_run_end(h,p.checked_in_at) as ends_at) deadline
  cross join lateral (select
    coalesce(h.reset_timezone is not null and (p.finished_at is null or h.time_limit_min is not null)
      and private.city_hunt_local_day(h,p.checked_in_at)<day.today,false) as reset,
    coalesce(h.time_limit_min is not null and p.finished_at is null and now()>=deadline.ends_at,false) as timed_out
  ) status
  cross join lateral (select min(r.duration_s) as best_s,
    min(r.duration_s) filter (where r.day=day.today) as today_s
    from public.city_hunt_runs r where r.hunt_id=h.id and r.user_id=p_user) records
  where h.kind = 'system' and h.id=p_hunt
$function$
;

CREATE OR REPLACE FUNCTION public.city_hunt_list(p_lat double precision, p_lng double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_lat is null or p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180
    or p_lat::text in ('NaN','Infinity','-Infinity') or p_lng::text in ('NaN','Infinity','-Infinity')
    then raise exception 'too_far'; end if;
  select coalesce(jsonb_agg(private.city_hunt_object(h.id,auth.uid())
    order by case when h.starts_at<=now() then 0 else 1 end,
      public.distance_m(p_lat,p_lng,h.keeper_lat,h.keeper_lng),h.starts_at),'[]'::jsonb)
    into result from public.hunts h where h.kind = 'system' and h.ends_at>now();
  return result;
end $function$
;

revoke all on function public.city_hunt_list(p_lat double precision, p_lng double precision) from public,anon,authenticated;

grant execute on function public.city_hunt_list(p_lat double precision, p_lng double precision) to authenticated;

CREATE OR REPLACE FUNCTION public.waypost_spin(p_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS TABLE(wax_awarded integer, gold_awarded integer, xp_gained integer, wax_balls integer, gold_balls integer, cooldown_end timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pg public.player_game; cfg private.game_config; post public.public_capsule_spots;
  last_spin timestamptz; spin_id uuid;
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
  wax_awarded:=cfg.spin_wax_min+floor(random()*
    (cfg.spin_wax_max-cfg.spin_wax_min+1))::integer;
  gold_awarded:=case when random()<cfg.spin_gold_chance then cfg.spin_gold_award else 0 end;
  insert into public.waypost_spins(user_id,waypost_id,wax_awarded,gold_awarded)
    values(auth.uid(),p_id,wax_awarded,gold_awarded) returning id,spun_at
      into spin_id,cooldown_end;
  cooldown_end:=cooldown_end+make_interval(secs=>cfg.spin_cooldown_seconds);
  update public.player_game set wax_balls=public.player_game.wax_balls+wax_awarded,
    gold_balls=public.player_game.gold_balls+gold_awarded
    where user_id=auth.uid() returning * into pg;
  xp_gained:=private.award_xp(auth.uid(),'spin',spin_id::text,cfg.xp_spin);
  wax_balls:=pg.wax_balls; gold_balls:=pg.gold_balls;
  begin
    perform private.city_hunt_quest_progress('spin',post.id,p_lat,p_lng);
  exception when others then
    raise warning 'hunt spin bookkeeping failed: %',sqlerrm;
  end;
  return next;
end $function$
;

CREATE OR REPLACE FUNCTION public.private_hunt_create(p_draft jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  hunt_id text := gen_random_uuid()::text;
begin
  -- The profile row serializes creates for this organizer.
  perform 1 from public.profiles where id = auth.uid() and can_create_hunts for update;
  if not found then raise exception 'not allowed to create hunts' using errcode = '42501'; end if;
  if exists (select 1 from public.hunts where owner = auth.uid() and kind = 'private'
    and (status = 'draft' or (status = 'published' and ends_at > now())) offset 2)
  then raise exception 'too_many'; end if;
  insert into public.hunts (id, owner, kind, status, name_en, name_zh, starts_at, ends_at)
  values (hunt_id, auth.uid(), 'private', 'draft', 'Draft', 'Draft', now(), now() + interval '1 day');
  perform private.private_hunt_apply_draft(hunt_id, p_draft);
  return jsonb_build_object('id', hunt_id);
end $function$
;

revoke all on function public.private_hunt_create(p_draft jsonb) from public,anon,authenticated;

grant execute on function public.private_hunt_create(p_draft jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_update(p_hunt text, p_draft jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.private_hunt_apply_draft(p_hunt, p_draft)
$function$
;

revoke all on function public.private_hunt_update(p_hunt text, p_draft jsonb) from public,anon,authenticated;

grant execute on function public.private_hunt_update(p_hunt text, p_draft jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_publish(p_hunt text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h public.hunts := private.private_hunt_lock_owned(p_hunt);
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  if h.status = 'closed' or h.ends_at <= now()
     or not exists (select 1 from public.private_hunt_quests where hunt_id = h.id)
  then raise exception 'not_ready'; end if;
  if h.join_code is not null then
    return jsonb_build_object('join_code', h.join_code);
  end if;
  for attempt in 1..8 loop
    bytes := extensions.gen_random_bytes(6);
    select string_agg(substr(alphabet, 1 + get_byte(bytes, i) % 32, 1), '' order by i)
      into code from generate_series(0, 5) i;
    begin
      update public.hunts set status = 'published', join_code = code where id = h.id;
      return jsonb_build_object('join_code', code);
    exception when unique_violation then
      -- Another hunt owns this code. Draw a fresh one.
    end;
  end loop;
  raise exception 'could not allocate join code';
end $function$
;

revoke all on function public.private_hunt_publish(p_hunt text) from public,anon,authenticated;

grant execute on function public.private_hunt_publish(p_hunt text) to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_quest_save(p_hunt text, p_quest jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h public.hunts := private.private_hunt_lock_owned(p_hunt);
  w public.private_hunt_quests;
  answer_text text;
  choice_list jsonb;
  quest_id uuid;
begin
  if h.status = 'closed' or (h.status = 'published' and h.ends_at <= now())
  then raise exception 'closed'; end if;
  if h.first_joined_at is not null then raise exception 'hunt_locked' using errcode = 'PT409'; end if;

  select * into w from jsonb_populate_record(null::public.private_hunt_quests, p_quest);
  quest_id := coalesce(w.id, gen_random_uuid());
  if w.id is not null and not exists (
    select 1 from public.private_hunt_quests where id = w.id and hunt_id = h.id
  ) then raise exception 'not allowed' using errcode = '42501'; end if;
  if w.id is null and exists (select 1 from public.private_hunt_quests where hunt_id = h.id offset 29)
  then raise exception 'too_many'; end if;

  if w.quest_type = 'puzzle' then
    if w.puzzle_kind is null then raise exception 'puzzle type required'; end if;
    answer_text := nullif(btrim(p_quest->>'answer'), '');
    if answer_text is null then
      select s.answer into answer_text from private.private_hunt_quest_secrets s where s.quest_id = w.id;
    end if;
    if answer_text is null or char_length(answer_text) > 80 then raise exception 'invalid answer'; end if;
    if w.puzzle_kind = 'choice' then
      if jsonb_typeof(w.choices) is distinct from 'array'
      then raise exception 'invalid choices'; end if;
      if jsonb_array_length(w.choices) > 6 or exists (
        select 1 from jsonb_array_elements(w.choices) c(value)
        where jsonb_typeof(c.value) <> 'string' or char_length(btrim(c.value #>> '{}')) > 80
      ) then raise exception 'invalid choices'; end if;
      select jsonb_agg(btrim(c.value) order by c.ordinality) into choice_list
      from jsonb_array_elements_text(w.choices) with ordinality c(value, ordinality)
      where btrim(c.value) <> '';
      if coalesce(jsonb_array_length(choice_list), 0) < 2 or not (choice_list ? answer_text)
      then raise exception 'invalid choices'; end if;
    end if;
  end if;

  insert into public.private_hunt_quests (
    id, hunt_id, ordinal, location_lat, location_lng, name, quest_type, points, description, image, puzzle_kind, choices, arrive_check
  ) values (
    quest_id, h.id, w.ordinal, w.location_lat, w.location_lng, btrim(w.name), w.quest_type, w.points,
    coalesce(w.description, ''), coalesce(nullif(w.image, ''), 'tpl:park'),
    case when w.quest_type = 'puzzle' then w.puzzle_kind end, choice_list,
    case when w.quest_type = 'arrive' then coalesce(w.arrive_check, 'gps') else 'gps' end
  )
  on conflict (id) do update set
    ordinal = excluded.ordinal, location_lat = excluded.location_lat, location_lng = excluded.location_lng, name = excluded.name,
    quest_type = excluded.quest_type, points = excluded.points, description = excluded.description,
    image = excluded.image, puzzle_kind = excluded.puzzle_kind, choices = excluded.choices,
    arrive_check = excluded.arrive_check;
  if w.quest_type = 'arrive' and w.arrive_check = 'gps_qr' then
    insert into private.private_hunt_quest_secrets as s (quest_id, qr_token)
    values (quest_id, encode(extensions.gen_random_bytes(16), 'hex'))
    on conflict on constraint hunt_waypoint_secrets_pkey do update
      set answer = null, qr_token = coalesce(s.qr_token, excluded.qr_token);
  elsif w.quest_type = 'puzzle' then
    insert into private.private_hunt_quest_secrets (quest_id, answer) values (quest_id, answer_text)
    on conflict on constraint hunt_waypoint_secrets_pkey do update set answer = excluded.answer, qr_token = null;
  else
    delete from private.private_hunt_quest_secrets s where s.quest_id = w.id;
  end if;
end $function$
;

revoke all on function public.private_hunt_quest_save(p_hunt text, p_quest jsonb) from public,anon,authenticated;

grant execute on function public.private_hunt_quest_save(p_hunt text, p_quest jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_quest_delete(p_quest uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts;
begin
  h := private.private_hunt_lock_owned((select hunt_id from public.private_hunt_quests where id = p_quest));
  if h.status = 'closed' or (h.status = 'published' and h.ends_at <= now())
  then raise exception 'closed'; end if;
  if h.first_joined_at is not null then raise exception 'hunt_locked' using errcode = 'PT409'; end if;
  delete from public.private_hunt_quests where id = p_quest and hunt_id = h.id;
end $function$
;

revoke all on function public.private_hunt_quest_delete(p_quest uuid) from public,anon,authenticated;

grant execute on function public.private_hunt_quest_delete(p_quest uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_close(p_hunt text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts := private.private_hunt_lock_owned(p_hunt);
begin
  update public.hunts set status = 'closed' where id = h.id;
end $function$
;

revoke all on function public.private_hunt_close(p_hunt text) from public,anon,authenticated;

grant execute on function public.private_hunt_close(p_hunt text) to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_edit_state(p_hunt text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts;
begin
  select * into h from public.hunts where id = p_hunt and kind = 'private' and owner = auth.uid();
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object('draft', private.private_hunt_draft(h), 'status', h.status, 'code', h.join_code,
    'locked', h.first_joined_at is not null,
    'quests', coalesce((select jsonb_agg(
      (to_jsonb(w) - 'hunt_id') || jsonb_build_object(
        'puzzle_kind', coalesce(w.puzzle_kind, 'choice'),
        'choices', coalesce(w.choices, '[]'::jsonb), 'answer', '')
      || case when s.qr_token is null then '{}'::jsonb else jsonb_build_object('qr_token', s.qr_token) end
      order by w.ordinal)
      from public.private_hunt_quests w left join private.private_hunt_quest_secrets s on s.quest_id = w.id
      where w.hunt_id = h.id), '[]'::jsonb));
end $function$
;

revoke all on function public.private_hunt_edit_state(p_hunt text) from public,anon,authenticated;

grant execute on function public.private_hunt_edit_state(p_hunt text) to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_organized()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(private.private_hunt_draft(h) || jsonb_build_object(
    'id', h.id, 'status', h.status, 'join_code', h.join_code, 'area', private.private_hunt_area(h.id),
    'joined', (select count(*) from public.private_hunt_members m where m.hunt_id = h.id),
    'joined_at', null, 'finished_at', null, 'points', 0, 'preview', false,
    'quests', coalesce((select jsonb_agg(to_jsonb(w) - 'hunt_id' order by w.ordinal)
      from public.private_hunt_quests w where w.hunt_id = h.id), '[]'::jsonb))
    order by h.starts_at desc, h.id), '[]'::jsonb)
  from public.hunts h where h.kind = 'private' and h.owner = auth.uid()
$function$
;

revoke all on function public.private_hunt_organized() from public,anon,authenticated;

grant execute on function public.private_hunt_organized() to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_review(p_hunt text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.hunts where id = p_hunt and kind = 'private' and owner = auth.uid())
  then raise exception 'not allowed' using errcode = '42501'; end if;
  return (
    with members as (
      select p.id as "user", p.name, p.avatar, m.points, m.finished_at,
        extract(epoch from m.finished_at - m.started_at)::integer as duration_s,
        p.id = auth.uid() as you
      from public.private_hunt_members m join public.profiles p on p.id = m.user_id where m.hunt_id = p_hunt
    )
    select jsonb_build_object('members', coalesce(jsonb_agg(to_jsonb(m)
      order by points desc, duration_s nulls last, name, "user"), '[]'::jsonb),
      'stats', jsonb_build_object('joined', count(*), 'finished', count(finished_at),
        'per_quest', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'done',
          (select count(*) from public.private_hunt_quest_progress c where c.quest_id = w.id
            and c.completed_at is not null)) order by w.ordinal)
          from public.private_hunt_quests w where w.hunt_id = p_hunt), '[]'::jsonb)))
    from members m
  );
end $function$
;

revoke all on function public.private_hunt_review(p_hunt text) from public,anon,authenticated;

grant execute on function public.private_hunt_review(p_hunt text) to authenticated;

CREATE OR REPLACE FUNCTION private.can_access_hunt_media(object_name text, owner_only boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.hunts h
    where h.id = (storage.foldername(object_name))[1] and h.kind = 'private'
      and (h.owner = auth.uid() or (not owner_only and h.hidden_at is null and exists (
        select 1 from public.private_hunt_members m where m.hunt_id = h.id and m.user_id = auth.uid()
      )))
  )
$function$
;

CREATE OR REPLACE FUNCTION private.private_hunt_player_object(h hunts, m private_hunt_members)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.private_hunt_draft(h) || jsonb_build_object(
    'id', h.id, 'join_code', h.join_code, 'status', h.status,
    'area', case when m.user_id is not null then private.private_hunt_area(h.id) end,
    'joined_at', m.joined_at, 'finished_at', m.finished_at, 'points', coalesce(m.points, 0),
    'run_started_at', m.started_at,
    'run_ends_at', case when m.user_id is not null then
      least(h.ends_at, m.started_at + make_interval(mins => h.time_limit_min)) end,
    'quests', coalesce((
      select jsonb_agg((to_jsonb(w) - 'hunt_id') || jsonb_build_object(
        'done_at', c.completed_at, 'tries', coalesce(c.tries, 0), 'wait_until', c.wait_until)
        order by w.ordinal)
      from public.private_hunt_quests w
      left join public.private_hunt_quest_progress c on c.quest_id = w.id and c.user_id = m.user_id
      where w.hunt_id = h.id and m.user_id is not null
    ), '[]'::jsonb))
$function$
;

CREATE OR REPLACE FUNCTION private.private_hunt_clean_code(p_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select regexp_replace(upper(p_code collate "C"), '[^A-Z0-9]', '', 'g')
$function$
;

CREATE OR REPLACE FUNCTION private.private_hunt_normalize_answer(p_answer text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  -- Match sameAnswer, including the whitespace and punctuation it ignores.
  select regexp_replace(lower(p_answer),
    U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF，。、！？,.!?]', '', 'g')
$function$
;

CREATE OR REPLACE FUNCTION public.private_hunt_joined()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(private.private_hunt_player_object(h, m)
    order by m.joined_at desc, h.id), '[]'::jsonb)
  from public.private_hunt_members m join public.hunts h on h.id = m.hunt_id
  where m.user_id = auth.uid() and h.kind = 'private' and h.hidden_at is null
$function$
;

revoke all on function public.private_hunt_joined() from public,anon,authenticated;

grant execute on function public.private_hunt_joined() to authenticated;

CREATE OR REPLACE FUNCTION public.private_hunt_quest_complete(p_quest uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_answer text, p_qr text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h public.hunts;
  m public.private_hunt_members;
  w public.private_hunt_quests;
  c public.private_hunt_quest_progress;
  secret private.private_hunt_quest_secrets;
  checked_at timestamptz;
  answer text;
  attempts integer;
  retry_at timestamptz;
  error_message text;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  -- Lock in hunt/member order so joining, closing and reporting see a consistent run.
  select * into h from public.hunts
  where id = (select hunt_id from public.private_hunt_quests where id = p_quest)
    and kind = 'private' for share;
  if not found or h.hidden_at is not null then raise exception 'not_joined'; end if;
  select * into m from public.private_hunt_members where hunt_id = h.id and user_id = auth.uid() for update;
  if not found then raise exception 'not_joined'; end if;
  select * into w from public.private_hunt_quests where id = p_quest and hunt_id = h.id;
  if not found then raise exception 'not_joined'; end if;
  select * into c from public.private_hunt_quest_progress where quest_id = w.id and user_id = m.user_id;

  checked_at := clock_timestamp();
  if h.status <> 'published' then raise exception 'closed'; end if;
  if checked_at < m.started_at then raise exception 'not_started'; end if;
  if c.completed_at is not null then raise exception 'already_done'; end if;
  if checked_at >= least(h.ends_at, m.started_at + make_interval(mins => h.time_limit_min))
  then raise exception 'time_up'; end if;
  if h.route_mode = 'ordered' and exists (
    select 1 from public.private_hunt_quests earlier
    where earlier.hunt_id = h.id and earlier.ordinal < w.ordinal and not exists (
      select 1 from public.private_hunt_quest_progress done where done.quest_id = earlier.id
        and done.user_id = m.user_id and done.completed_at is not null
    )
  ) then raise exception 'locked'; end if;

  if (p_lat between -90 and 90 and p_lng between -180 and 180
      and p_accuracy > 0 and p_accuracy <= 200) is not true
  then raise exception 'too_far'; end if;
  if (public.distance_m(p_lat, p_lng, w.location_lat, w.location_lng) <=
      (select action_radius_m from private.game_config where singleton)) is not true
  then raise exception 'too_far'; end if;

  if w.arrive_check = 'gps_qr' or w.quest_type = 'puzzle' then
    select * into secret from private.private_hunt_quest_secrets where quest_id = w.id;
  end if;
  if w.arrive_check = 'gps_qr' and (
    secret.qr_token is null or lower(regexp_replace(btrim(p_qr), '^timecapsule://quest/', '', 'i') collate "C")
      is distinct from lower(secret.qr_token collate "C")
  ) then raise exception 'wrong_qr'; end if;

  if w.quest_type = 'puzzle' then
    answer := private.private_hunt_normalize_answer(p_answer);
    if c.wait_until > checked_at then
      raise exception 'no_tries' using detail = jsonb_build_object(
        'tries_left', 0, 'wait_s', ceil(extract(epoch from c.wait_until - checked_at)))::text;
    end if;
    if coalesce(answer, '') = '' or answer is distinct from private.private_hunt_normalize_answer(secret.answer) then
      attempts := case when c.wait_until is not null then 1 else coalesce(c.tries, 0) + 1 end;
      if attempts >= 3 then retry_at := checked_at + interval '60 seconds'; end if;
      insert into public.private_hunt_quest_progress (hunt_id, quest_id, user_id, tries, wait_until)
      values (h.id, w.id, m.user_id, attempts, retry_at)
      on conflict (quest_id, user_id) do update set tries = excluded.tries, wait_until = excluded.wait_until;

      -- Raising an exception here would roll back the attempt. PostgREST can
      -- return the normal error shape and a 400 status while committing the row.
      error_message := case when retry_at is null then 'wrong_answer' else 'no_tries' end;
      perform set_config('response.status', '400', true);
      return jsonb_build_object('message', error_message, 'code', 'P0001', 'hint', null,
        'details', jsonb_build_object('tries_left', greatest(0, 3 - attempts),
          'wait_s', case when retry_at is null then 0 else 60 end)::text);
    end if;
  end if;

  insert into public.private_hunt_quest_progress (hunt_id, quest_id, user_id, completed_at)
  values (h.id, w.id, m.user_id, checked_at)
  on conflict (quest_id, user_id) do update set completed_at = excluded.completed_at, tries = 0, wait_until = null;

  update public.private_hunt_members as member set points = member.points + w.points,
    finished_at = case when not exists (
      select 1 from public.private_hunt_quests wp where wp.hunt_id = h.id and not exists (
        select 1 from public.private_hunt_quest_progress done where done.quest_id = wp.id
          and done.user_id = m.user_id and done.completed_at is not null
      )
    ) then checked_at end
  where member.hunt_id = h.id and member.user_id = m.user_id returning * into m;

  return jsonb_build_object('hunt', private.private_hunt_player_object(h, m),
    'points_gained', w.points, 'tries_left', 3, 'wait_s', 0);
end $function$
;

revoke all on function public.private_hunt_quest_complete(p_quest uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_answer text, p_qr text) from public,anon,authenticated;

grant execute on function public.private_hunt_quest_complete(p_quest uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_answer text, p_qr text) to authenticated;

create or replace function public.hunt_preview(p_code text) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.private_hunt_preview(p_code)) $wrapper$;

create or replace function public.hunt_join_code(p_code text) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.private_hunt_join_code(p_code)) $wrapper$;

create or replace function public.hunt_leaderboard(p_hunt text) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.private_hunt_leaderboard(p_hunt)) $wrapper$;

create or replace function public.hunt_report(p_hunt text) returns void language sql set search_path='' as $wrapper$ select * from public.private_hunt_report(p_hunt) $wrapper$;

create or replace function public.hunt_join(p_hunt text) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.city_hunt_join(p_hunt)) $wrapper$;

create or replace function public.hunt_check_in(p_hunt text, p_lat double precision, p_lng double precision, p_accuracy double precision) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.city_hunt_check_in(p_hunt, p_lat, p_lng, p_accuracy)) $wrapper$;

create or replace function public.hunt_finish(p_hunt text, p_lat double precision, p_lng double precision, p_accuracy double precision) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.city_hunt_finish(p_hunt, p_lat, p_lng, p_accuracy)) $wrapper$;

create or replace function public.sea_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision) returns TABLE(id uuid, hint text, vessel text, lat double precision, lng double precision, shore_zh text, shore_en text, sealed_at timestamp with time zone, washed_up_at timestamp with time zone, returns integer, sender jsonb) language sql set search_path='' as $wrapper$ select * from public.public_capsule_nearby(p_lat, p_lng, p_accuracy) $wrapper$;

create or replace function public.sea_return(p_id uuid) returns void language sql set search_path='' as $wrapper$ select * from public.public_capsule_return(p_id) $wrapper$;

create or replace function public.sea_throw(p_message text, p_hint text, p_vessel text, p_drift_days integer, p_lat double precision, p_lng double precision, p_accuracy double precision) returns TABLE(id uuid, shore_zh text, shore_en text, washes_up_at timestamp with time zone) language sql set search_path='' as $wrapper$ select * from public.public_capsule_drop(p_message, p_hint, p_vessel, p_drift_days, p_lat, p_lng, p_accuracy) $wrapper$;

create or replace function public.sea_report(p_id uuid, p_reason text) returns void language sql set search_path='' as $wrapper$ select * from public.public_capsule_report(p_id, p_reason) $wrapper$;

create or replace function public.sea_pick_up(p_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision) returns void language sql set search_path='' as $wrapper$ select * from public.public_capsule_pick_up(p_id, p_lat, p_lng, p_accuracy) $wrapper$;

create or replace function public.corrupted_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.game_nearby(p_lat, p_lng, p_accuracy)) $wrapper$;

create or replace function public.corrupted_throw(p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision, p_ball text, p_ring double precision, p_hit boolean) returns TABLE(result text, vessel text, copies integer, stars integer, is_new boolean, xp_gained integer, wax_balls integer, gold_balls integer, attempts_left integer) language sql set search_path='' as $wrapper$ select * from public.capsule_throw(p_spawn, p_lat, p_lng, p_accuracy, p_ball, p_ring, p_hit) $wrapper$;

create or replace function public.hunt_list(p_lat double precision, p_lng double precision) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.city_hunt_list(p_lat, p_lng)) $wrapper$;

create or replace function public.hunt_create(p_draft jsonb) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.private_hunt_create(p_draft)) $wrapper$;

create or replace function public.hunt_update(p_hunt text, p_draft jsonb) returns void language sql set search_path='' as $wrapper$ select * from public.private_hunt_update(p_hunt, p_draft) $wrapper$;

create or replace function public.hunt_publish(p_hunt text) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.private_hunt_publish(p_hunt)) $wrapper$;

create or replace function public.hunt_waypoint_save(p_hunt text, p_waypoint jsonb) returns void language sql set search_path='' as $wrapper$ select * from public.private_hunt_quest_save(p_hunt, private.current_hunt_keys(p_waypoint)) $wrapper$;

create or replace function public.hunt_waypoint_delete(p_waypoint uuid) returns void language sql set search_path='' as $wrapper$ select * from public.private_hunt_quest_delete(p_waypoint) $wrapper$;

create or replace function public.hunt_close(p_hunt text) returns void language sql set search_path='' as $wrapper$ select * from public.private_hunt_close(p_hunt) $wrapper$;

create or replace function public.hunt_edit_state(p_hunt text) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.private_hunt_edit_state(p_hunt)) $wrapper$;

create or replace function public.my_hunts() returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.private_hunt_organized()) $wrapper$;

create or replace function public.hunt_review(p_hunt text) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.private_hunt_review(p_hunt)) $wrapper$;

create or replace function public.hunt_private_mine() returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.private_hunt_joined()) $wrapper$;

create or replace function public.hunt_mission_complete(p_waypoint uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_answer text, p_qr text) returns jsonb language sql set search_path='' as $wrapper$ select private.legacy_hunt_keys(public.private_hunt_quest_complete(p_waypoint, p_lat, p_lng, p_accuracy, p_answer, p_qr)) $wrapper$;

drop function public.sea_pickups_left();

notify pgrst, 'reload schema';
commit;
