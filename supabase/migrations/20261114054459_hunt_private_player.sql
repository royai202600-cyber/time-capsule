begin;

alter table public.hunts add column hidden_at timestamptz;

create table private.hunt_reports (
  hunt_id text not null references public.hunts(id) on delete cascade,
  reporter uuid not null references public.profiles(id) on delete cascade,
  reported_at timestamptz not null default now(),
  primary key (hunt_id, reporter)
);
alter table private.hunt_reports enable row level security;
revoke all on private.hunt_reports from public, anon, authenticated;

create function private.hunt_player_object(h public.hunts, m public.hunt_members) returns jsonb
language sql stable set search_path = '' as $$
  select private.private_hunt_draft(h) || jsonb_build_object(
    'id', h.id, 'join_code', h.join_code, 'status', h.status,
    'area', case when m.user_id is not null then private.private_hunt_area(h.id) end,
    'joined_at', m.joined_at, 'finished_at', m.finished_at, 'points', coalesce(m.points, 0),
    'run_started_at', m.started_at,
    'run_ends_at', case when m.user_id is not null then
      least(h.ends_at, m.started_at + make_interval(mins => h.time_limit_min)) end,
    'waypoints', coalesce((
      select jsonb_agg((to_jsonb(w) - 'hunt_id') || jsonb_build_object(
        'done_at', c.completed_at, 'tries', coalesce(c.tries, 0), 'wait_until', c.wait_until)
        order by w.ordinal)
      from public.hunt_waypoints w
      left join public.hunt_completions c on c.waypoint_id = w.id and c.user_id = m.user_id
      where w.hunt_id = h.id and m.user_id is not null
    ), '[]'::jsonb))
$$;

create function private.hunt_clean_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(upper(p_code collate "C"), '[^A-Z0-9]', '', 'g')
$$;

create function private.hunt_normalize_answer(p_answer text) returns text
language sql immutable set search_path = '' as $$
  -- Match sameAnswer, including the whitespace and punctuation it ignores.
  select regexp_replace(lower(p_answer),
    U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF，。、！？,.!?]', '', 'g')
$$;

create function public.hunt_private_mine() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.hunt_player_object(h, m)
    order by m.joined_at desc, h.id), '[]'::jsonb)
  from public.hunt_members m join public.hunts h on h.id = m.hunt_id
  where m.user_id = auth.uid() and h.kind = 'private' and h.hidden_at is null
$$;

create function public.hunt_preview(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare h public.hunts;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  select * into h from public.hunts where join_code = private.hunt_clean_code(p_code)
    and kind = 'private' and hidden_at is null;
  if not found then raise exception 'bad_code'; end if;
  if h.status <> 'published' or now() >= h.ends_at then raise exception 'closed'; end if;
  return private.hunt_player_object(h, null::public.hunt_members);
end $$;

create function public.hunt_join_code(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  h public.hunts;
  m public.hunt_members;
  player uuid := auth.uid();
  joined timestamptz;
begin
  if not exists (select 1 from public.profiles where id = player) then raise exception 'not_allowed'; end if;
  select * into h from public.hunts where join_code = private.hunt_clean_code(p_code)
    and kind = 'private' and hidden_at is null for update;
  if not found then raise exception 'bad_code'; end if;
  joined := clock_timestamp();
  if h.status <> 'published' or joined >= h.ends_at then raise exception 'closed'; end if;
  select * into m from public.hunt_members where hunt_id = h.id and user_id = player;
  if not found then
    insert into public.hunt_members (hunt_id, user_id, joined_at, started_at)
    values (h.id, player, joined, greatest(joined, h.starts_at)) returning * into m;
  end if;
  return private.hunt_player_object(h, m);
end $$;

create function public.hunt_mission_complete(
  p_waypoint uuid, p_lat double precision, p_lng double precision, p_accuracy double precision,
  p_answer text, p_qr text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  h public.hunts;
  m public.hunt_members;
  w public.hunt_waypoints;
  c public.hunt_completions;
  secret private.hunt_waypoint_secrets;
  checked_at timestamptz;
  answer text;
  attempts integer;
  retry_at timestamptz;
  error_message text;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  -- Lock in hunt/member order so joining, closing and reporting see a consistent run.
  select * into h from public.hunts
  where id = (select hunt_id from public.hunt_waypoints where id = p_waypoint)
    and kind = 'private' for share;
  if not found or h.hidden_at is not null then raise exception 'not_joined'; end if;
  select * into m from public.hunt_members where hunt_id = h.id and user_id = auth.uid() for update;
  if not found then raise exception 'not_joined'; end if;
  select * into w from public.hunt_waypoints where id = p_waypoint and hunt_id = h.id;
  if not found then raise exception 'not_joined'; end if;
  select * into c from public.hunt_completions where waypoint_id = w.id and user_id = m.user_id;

  checked_at := clock_timestamp();
  if h.status <> 'published' then raise exception 'closed'; end if;
  if checked_at < m.started_at then raise exception 'not_started'; end if;
  if c.completed_at is not null then raise exception 'already_done'; end if;
  if checked_at >= least(h.ends_at, m.started_at + make_interval(mins => h.time_limit_min))
  then raise exception 'time_up'; end if;
  if h.route_mode = 'ordered' and exists (
    select 1 from public.hunt_waypoints earlier
    where earlier.hunt_id = h.id and earlier.ordinal < w.ordinal and not exists (
      select 1 from public.hunt_completions done where done.waypoint_id = earlier.id
        and done.user_id = m.user_id and done.completed_at is not null
    )
  ) then raise exception 'locked'; end if;

  if (p_lat between -90 and 90 and p_lng between -180 and 180
      and p_accuracy > 0 and p_accuracy <= 200) is not true
  then raise exception 'too_far'; end if;
  if (public.distance_m(p_lat, p_lng, w.lat, w.lng) <=
      (select action_radius_m from private.game_config where singleton)) is not true
  then raise exception 'too_far'; end if;

  if w.arrive_check = 'gps_qr' or w.mission_type = 'puzzle' then
    select * into secret from private.hunt_waypoint_secrets where waypoint_id = w.id;
  end if;
  if w.arrive_check = 'gps_qr' and (
    secret.qr_token is null or lower(regexp_replace(btrim(p_qr), '^timecapsule://quest/', '', 'i') collate "C")
      is distinct from lower(secret.qr_token collate "C")
  ) then raise exception 'wrong_qr'; end if;

  if w.mission_type = 'puzzle' then
    answer := private.hunt_normalize_answer(p_answer);
    if c.wait_until > checked_at then
      raise exception 'no_tries' using detail = jsonb_build_object(
        'tries_left', 0, 'wait_s', ceil(extract(epoch from c.wait_until - checked_at)))::text;
    end if;
    if coalesce(answer, '') = '' or answer is distinct from private.hunt_normalize_answer(secret.answer) then
      attempts := case when c.wait_until is not null then 1 else coalesce(c.tries, 0) + 1 end;
      if attempts >= 3 then retry_at := checked_at + interval '60 seconds'; end if;
      insert into public.hunt_completions (hunt_id, waypoint_id, user_id, tries, wait_until)
      values (h.id, w.id, m.user_id, attempts, retry_at)
      on conflict (waypoint_id, user_id) do update set tries = excluded.tries, wait_until = excluded.wait_until;

      -- Raising an exception here would roll back the attempt. PostgREST can
      -- return the normal error shape and a 400 status while committing the row.
      error_message := case when retry_at is null then 'wrong_answer' else 'no_tries' end;
      perform set_config('response.status', '400', true);
      return jsonb_build_object('message', error_message, 'code', 'P0001', 'hint', null,
        'details', jsonb_build_object('tries_left', greatest(0, 3 - attempts),
          'wait_s', case when retry_at is null then 0 else 60 end)::text);
    end if;
  end if;

  insert into public.hunt_completions (hunt_id, waypoint_id, user_id, completed_at)
  values (h.id, w.id, m.user_id, checked_at)
  on conflict (waypoint_id, user_id) do update set completed_at = excluded.completed_at, tries = 0, wait_until = null;

  update public.hunt_members as member set points = member.points + w.points,
    finished_at = case when not exists (
      select 1 from public.hunt_waypoints wp where wp.hunt_id = h.id and not exists (
        select 1 from public.hunt_completions done where done.waypoint_id = wp.id
          and done.user_id = m.user_id and done.completed_at is not null
      )
    ) then checked_at end
  where member.hunt_id = h.id and member.user_id = m.user_id returning * into m;

  return jsonb_build_object('hunt', private.hunt_player_object(h, m),
    'points_gained', w.points, 'tries_left', 3, 'wait_s', 0);
end $$;

create function public.hunt_leaderboard(p_hunt text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare h public.hunts;
begin
  select * into h from public.hunts where id = p_hunt and kind = 'private';
  if auth.uid() is null or not found then raise exception 'not_allowed'; end if;
  if h.owner <> auth.uid() then
    if h.hidden_at is not null or not exists (
      select 1 from public.hunt_members where hunt_id = h.id and user_id = auth.uid()
    ) then raise exception 'not_joined'; end if;
    if not h.leaderboard_visible then raise exception 'not_allowed'; end if;
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.points desc, r.duration_s nulls last, r.name, r."user"), '[]'::jsonb)
    from (
      select p.id as "user", p.name, p.avatar, m.points, m.finished_at,
        extract(epoch from m.finished_at - m.started_at)::integer as duration_s, p.id = auth.uid() as you
      from public.hunt_members m join public.profiles p on p.id = m.user_id
      where m.hunt_id = h.id
    ) r
  );
end $$;

create function public.hunt_report(p_hunt text) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.hunts;
begin
  select * into h from public.hunts where id = p_hunt and kind = 'private' for update;
  if auth.uid() is null or not found or h.owner = auth.uid() then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.hunt_members where hunt_id = h.id and user_id = auth.uid())
  then raise exception 'not_joined'; end if;
  insert into private.hunt_reports (hunt_id, reporter) values (h.id, auth.uid()) on conflict do nothing;
  if h.hidden_at is null and exists (select 1 from private.hunt_reports where hunt_id = h.id offset 1) then
    update public.hunts set hidden_at = clock_timestamp() where id = h.id;
  end if;
end $$;

-- Owners retain review access. A hidden hunt no longer grants member media access.
create or replace function private.can_access_hunt_media(object_name text, owner_only boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.hunts h
    where h.id = (storage.foldername(object_name))[1] and h.kind = 'private'
      and (h.owner = auth.uid() or (not owner_only and h.hidden_at is null and exists (
        select 1 from public.hunt_members m where m.hunt_id = h.id and m.user_id = auth.uid()
      )))
  )
$$;

create or replace function public.my_passport()
returns table(place text,name_zh text,name_en text,city_zh text,city_en text,
  first_at timestamptz,how_earned text)
language plpgsql stable security definer set search_path = '' as $$
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
      from public.hunt_passport_stamps s join public.hunts h on h.id=s.hunt_id
      where s.user_id=auth.uid()
      union all
      select h.id,h.name_zh,h.name_en,''::text,''::text,
        m.finished_at,'private_hunt'::text,2147483647
      from public.hunt_members m join public.hunts h on h.id=m.hunt_id
      where m.user_id=auth.uid() and m.finished_at is not null and h.kind='private'
    ) q order by q.first_at,q.place_sort;
end $$;

revoke all on function private.hunt_player_object(public.hunts, public.hunt_members),
  private.hunt_clean_code(text), private.hunt_normalize_answer(text) from public, anon, authenticated;
revoke all on function public.hunt_private_mine(), public.hunt_preview(text), public.hunt_join_code(text),
  public.hunt_mission_complete(uuid, double precision, double precision, double precision, text, text),
  public.hunt_leaderboard(text), public.hunt_report(text) from public, anon, authenticated, service_role;
grant execute on function public.hunt_private_mine(), public.hunt_preview(text), public.hunt_join_code(text),
  public.hunt_mission_complete(uuid, double precision, double precision, double precision, text, text),
  public.hunt_leaderboard(text), public.hunt_report(text) to authenticated;

notify pgrst, 'reload schema';
commit;
