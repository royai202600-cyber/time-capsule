begin;
alter table public.hunts add column guide_mode text not null default 'near' check (guide_mode in ('fixed','near')),
 add column guide_lat double precision check (guide_lat between -90 and 90),
 add column guide_lng double precision check (guide_lng between -180 and 180),
 add constraint private_guide_location check (kind <> 'private' or (guide_mode='fixed' and guide_lat is not null and guide_lng is not null) or (guide_mode='near' and guide_lat is null and guide_lng is null));
alter table public.private_hunt_members alter column started_at drop not null,
 add column reward_collected_at timestamptz,
 add constraint private_reward_finished check (reward_collected_at is null or (finished_at is not null and reward_collected_at>=finished_at));
-- Preserve existing runs and earned stamps; only future joins wait for the guide.
update public.private_hunt_members set reward_collected_at=finished_at where finished_at is not null;
alter table public.private_hunt_quests alter column location_lat drop not null, alter column location_lng drop not null,
 drop constraint hunt_waypoints_mission_type_check,
 add constraint private_quest_type check (quest_type in ('arrive','spin','puzzle','restore')),
 add column catch_count integer,
 add constraint private_quest_location check ((quest_type='restore' and location_lat is null and location_lng is null and catch_count is not null and catch_count between 1 and 20) or (quest_type<>'restore' and location_lat is not null and location_lng is not null and catch_count is null));
alter table public.private_hunt_quest_progress add column catch_count integer not null default 0 check(catch_count between 0 and 20);

CREATE OR REPLACE FUNCTION private.private_hunt_draft(h hunts)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'name', h.name_en, 'description', h.description, 'cover', h.cover, 'route_mode', h.route_mode,
    'leaderboard_visible', h.leaderboard_visible, 'starts_at', h.starts_at, 'ends_at', h.ends_at,
    'time_limit_min', h.time_limit_min, 'guide_mode',h.guide_mode,'guide_lat',h.guide_lat,'guide_lng',h.guide_lng)
$function$;

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
    starts_at timestamptz, ends_at timestamptz, time_limit_min integer, guide_mode text, guide_lat double precision, guide_lng double precision);
  draft.guide_mode := coalesce(draft.guide_mode,h.guide_mode);
  if not (p_draft ? 'guide_mode') then draft.guide_lat:=h.guide_lat; draft.guide_lng:=h.guide_lng; end if;
  if nullif(btrim(draft.name), '') is null then raise exception 'name required'; end if;
  if h.first_joined_at is not null
    and (h.starts_at, h.ends_at, h.route_mode, h.time_limit_min,h.guide_mode,h.guide_lat,h.guide_lng) is distinct from
        (draft.starts_at, draft.ends_at, draft.route_mode, draft.time_limit_min,draft.guide_mode,draft.guide_lat,draft.guide_lng)
  then raise exception 'hunt_locked' using errcode = 'PT409'; end if;
  update public.hunts set name_en = btrim(draft.name), name_zh = btrim(draft.name),
    description = coalesce(draft.description, ''), cover = draft.cover,
    route_mode = draft.route_mode, leaderboard_visible = draft.leaderboard_visible,
    starts_at = draft.starts_at, ends_at = draft.ends_at, time_limit_min = draft.time_limit_min, guide_mode=draft.guide_mode,guide_lat=draft.guide_lat,guide_lng=draft.guide_lng
  where id = h.id;
end $function$;

CREATE OR REPLACE FUNCTION private.private_hunt_area(p_hunt text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with centre as (
    select avg(location_lat) as lat, avg(location_lng) as lng from (select location_lat,location_lng from public.private_hunt_quests where hunt_id=p_hunt and location_lat is not null union all select guide_lat,guide_lng from public.hunts where id=p_hunt and guide_mode='fixed' and not exists(select 1 from public.private_hunt_quests where hunt_id=p_hunt and location_lat is not null)) locations
  )
  select jsonb_build_object('lat', c.lat, 'lng', c.lng,
    'radius_m', case when c.lat is null then 200 else
      ceil(greatest(200, 1.25 * (select max(public.distance_m(c.lat, c.lng, w.location_lat, w.location_lng))
        from public.private_hunt_quests w where w.hunt_id = p_hunt)))::integer end)
  from centre c
$function$;

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
  if h.guide_mode='near' and not exists(select 1 from public.private_hunt_quests where hunt_id=h.id and location_lat is not null) then raise exception 'area_required'; end if;
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
end $function$;
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
    values (h.id, player, joined, null) returning * into m;
  end if;
  return private.private_hunt_player_object(h, m);
end $function$;

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
    'reward_collected_at',m.reward_collected_at, 'started_at',m.started_at, 'run_started_at', m.started_at,
    'run_ends_at', case when m.started_at is not null then
      least(h.ends_at, m.started_at + make_interval(mins => h.time_limit_min)) end,
    'quests', coalesce((
      select jsonb_agg((to_jsonb(w) - 'hunt_id') || jsonb_build_object(
        'caught_count',coalesce(c.catch_count,0), 'done_at', c.completed_at, 'tries', coalesce(c.tries, 0), 'wait_until', c.wait_until)
        order by w.ordinal)
      from public.private_hunt_quests w
      left join public.private_hunt_quest_progress c on c.quest_id = w.id and c.user_id = m.user_id
      where w.hunt_id = h.id and m.user_id is not null
    ), '[]'::jsonb))
$function$;

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
    id, hunt_id, ordinal, location_lat, location_lng, name, quest_type, points, description, image, puzzle_kind, choices, arrive_check, catch_count
  ) values (
    quest_id, h.id, w.ordinal, w.location_lat, w.location_lng, btrim(w.name), w.quest_type, w.points,
    coalesce(w.description, ''), coalesce(nullif(w.image, ''), 'tpl:park'),
    case when w.quest_type = 'puzzle' then w.puzzle_kind end, choice_list,
    case when w.quest_type = 'arrive' then coalesce(w.arrive_check, 'gps') else 'gps' end, w.catch_count
  )
  on conflict (id) do update set
    ordinal = excluded.ordinal, location_lat = excluded.location_lat, location_lng = excluded.location_lng, name = excluded.name,
    quest_type = excluded.quest_type, points = excluded.points, description = excluded.description,
    image = excluded.image, puzzle_kind = excluded.puzzle_kind, choices = excluded.choices,
    arrive_check = excluded.arrive_check, catch_count=excluded.catch_count;
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
end $function$;

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
  if m.started_at is null or checked_at < greatest(m.started_at,h.starts_at) then raise exception 'not_started'; end if;
  if w.quest_type='restore' then raise exception 'catch_required'; end if;
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
end $function$;

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
        m.reward_collected_at,'private_hunt'::text,2147483647
      from public.private_hunt_members m join public.hunts h on h.id=m.hunt_id
      where m.user_id=auth.uid() and m.reward_collected_at is not null and h.kind='private'
    ) q order by q.first_at,q.place_sort;
end $function$;

-- Internal location predicate; caller holds the hunt and member locks.
create function private.private_hunt_at_guide(h public.hunts, p_lat double precision,p_lng double precision,p_accuracy double precision)
returns boolean language sql stable set search_path='' as $$
 select coalesce(p_lat between -90 and 90 and p_lng between -180 and 180 and p_accuracy>0 and p_accuracy<=200 and
 case when h.guide_mode='fixed' then public.distance_m(p_lat,p_lng,h.guide_lat,h.guide_lng)<=50
 else public.distance_m(p_lat,p_lng,(a->>'lat')::double precision,(a->>'lng')::double precision)<=(a->>'radius_m')::double precision end,false)
 from (select private.private_hunt_area(h.id) a) area
$$;
revoke all on function private.private_hunt_at_guide(public.hunts,double precision,double precision,double precision) from public,anon,authenticated;

create function public.private_hunt_start(p_hunt text,p_lat double precision,p_lng double precision,p_accuracy double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.hunts; m public.private_hunt_members; at_time timestamptz;
begin
 if auth.uid() is null then raise exception 'not_allowed'; end if;
 select * into h from public.hunts where id=p_hunt and kind='private' and hidden_at is null for share;
 if not found then raise exception 'not_joined'; end if;
 select * into m from public.private_hunt_members where hunt_id=h.id and user_id=auth.uid() for update;
 if not found then raise exception 'not_joined'; end if;
 at_time:=clock_timestamp();
 if h.status<>'published' or at_time>=h.ends_at then raise exception 'closed'; end if;
 if at_time<h.starts_at then raise exception 'not_started'; end if;
 if not private.private_hunt_at_guide(h,p_lat,p_lng,p_accuracy) then raise exception 'too_far'; end if;
 -- Retrying cannot restart or extend a timer.
 if m.started_at is null then
 update public.private_hunt_members set started_at=greatest(at_time,h.starts_at) where hunt_id=h.id and user_id=m.user_id returning * into m;
 end if;
 return private.private_hunt_player_object(h,m);
end $$;
revoke all on function public.private_hunt_start(text,double precision,double precision,double precision) from public,anon,authenticated;
grant execute on function public.private_hunt_start(text,double precision,double precision,double precision) to authenticated;

create function public.private_hunt_collect_reward(p_hunt text,p_lat double precision default null,p_lng double precision default null,p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.hunts; m public.private_hunt_members;
begin
 if auth.uid() is null then raise exception 'not_allowed'; end if;
 select * into h from public.hunts where id=p_hunt and kind='private' for share;
 if not found then raise exception 'not_joined'; end if;
 select * into m from public.private_hunt_members where hunt_id=h.id and user_id=auth.uid() for update;
 if not found then raise exception 'not_joined'; end if;
 if m.finished_at is null then raise exception 'not_finished'; end if;
 if m.reward_collected_at is null then
  -- Only the scheduled end releases the guide requirement, not an early close.
  if clock_timestamp()<h.ends_at and not private.private_hunt_at_guide(h,p_lat,p_lng,p_accuracy) then raise exception 'too_far'; end if;
  update public.private_hunt_members set reward_collected_at=clock_timestamp() where hunt_id=h.id and user_id=m.user_id returning * into m;
 end if;
 return private.private_hunt_player_object(h,m);
end $$;
revoke all on function public.private_hunt_collect_reward(text,double precision,double precision,double precision) from public,anon,authenticated;
grant execute on function public.private_hunt_collect_reward(text,double precision,double precision,double precision) to authenticated;

create function private.private_hunt_record_catch(p_spot uuid,p_lat double precision,p_lng double precision)
returns void language plpgsql security definer set search_path='' as $$
declare h public.hunts; m public.private_hunt_members; v_quest public.private_hunt_quests; a jsonb; caught integer; at_time timestamptz;
begin
 if auth.uid() is null then return; end if;
 for h in select * from public.hunts where kind='private' and status='published' and hidden_at is null
 and exists(select 1 from public.private_hunt_members where hunt_id=hunts.id and user_id=auth.uid()) order by id for share
 loop
  select * into m from public.private_hunt_members where hunt_id=h.id and user_id=auth.uid() for update;
  at_time:=clock_timestamp();
  if m.started_at is null or m.finished_at is not null or at_time<greatest(h.starts_at,m.started_at)
   or at_time>=least(h.ends_at,m.started_at+make_interval(mins=>h.time_limit_min)) then continue; end if;
  a:=private.private_hunt_area(h.id);
  if not exists(select 1 from public.corrupted_spots s where s.id=p_spot and
   public.distance_m(s.lat,s.lng,(a->>'lat')::double precision,(a->>'lng')::double precision)<=(a->>'radius_m')::double precision)
   or (public.distance_m(p_lat,p_lng,(a->>'lat')::double precision,(a->>'lng')::double precision)<=(a->>'radius_m')::double precision) is not true then continue; end if;
  for v_quest in select * from public.private_hunt_quests w where hunt_id=h.id and quest_type='restore'
   and not exists(select 1 from public.private_hunt_quest_progress c where c.quest_id=w.id and c.user_id=m.user_id and c.completed_at is not null)
   and (h.route_mode='any' or not exists(select 1 from public.private_hunt_quests e where e.hunt_id=h.id and e.ordinal<w.ordinal and not exists(select 1 from public.private_hunt_quest_progress c where c.quest_id=e.id and c.user_id=m.user_id and c.completed_at is not null))) order by ordinal
  loop
   insert into public.private_hunt_quest_progress as progress(hunt_id,quest_id,user_id,catch_count)
   values(h.id,v_quest.id,m.user_id,1) on conflict(quest_id,user_id) do update set catch_count=least(v_quest.catch_count,progress.catch_count+1) returning catch_count into caught;
   if caught>=v_quest.catch_count then
    update public.private_hunt_quest_progress set completed_at=at_time where quest_id=v_quest.id and user_id=m.user_id;
    update public.private_hunt_members set points=points+v_quest.points where hunt_id=h.id and user_id=m.user_id;
   end if;
  end loop;
  if not exists(select 1 from public.private_hunt_quests q where q.hunt_id=h.id and not exists(select 1 from public.private_hunt_quest_progress c where c.quest_id=q.id and c.user_id=m.user_id and c.completed_at is not null)) then
   update public.private_hunt_members set finished_at=at_time where hunt_id=h.id and user_id=m.user_id;
  end if;
 end loop;
end $$;
revoke all on function private.private_hunt_record_catch(uuid,double precision,double precision) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.city_hunt_record_quest(p_kind text, p_id uuid, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts; p public.city_hunt_quest_progress; credited uuid;
begin
  -- Separate exception boundary: private hunt bookkeeping cannot undo a catch or City Hunt credit.
  if p_kind='restore' then
    begin perform private.private_hunt_record_catch(p_id,p_lat,p_lng);
    exception when others then raise warning 'private hunt catch bookkeeping failed: %', SQLSTATE; end;
  end if;
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
end $function$;
notify pgrst,'reload schema';
commit;
