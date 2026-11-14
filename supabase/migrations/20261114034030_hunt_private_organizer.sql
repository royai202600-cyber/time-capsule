begin;

alter table public.profiles add column can_create_hunts boolean not null default false;
-- Keep profile upserts working while reserving the pilot flag for administrators.
revoke insert, update on public.profiles from public, anon, authenticated;
grant insert (id, name, avatar, created_at, city, remind_open, remind_nearby),
      update (id, name, avatar, created_at, city, remind_open, remind_nearby)
  on public.profiles to authenticated;

-- Verified Roy organizer account. The shared development fixture stays unprivileged.
update public.profiles set can_create_hunts = true
where id = '1fd214ef-4de5-4b4f-81bc-77c3328441fe';

alter table public.hunts
  add column kind text not null default 'system' check (kind in ('system', 'private')),
  add column first_joined_at timestamptz,
  add column owner uuid references public.profiles(id) on delete cascade,
  add column status text not null default 'published' check (status in ('draft', 'published', 'closed')),
  add column join_code text unique check (join_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  add column description text not null default '' check (char_length(description) <= 500),
  add column cover text,
  add column route_mode text not null default 'any' check (route_mode in ('any', 'ordered')),
  add column leaderboard_visible boolean not null default true,
  add column if not exists time_limit_min integer,
  alter column city_zh drop not null,
  alter column city_en drop not null,
  alter column keeper_lat drop not null,
  alter column keeper_lng drop not null,
  alter column keeper_spot_zh drop not null,
  alter column keeper_spot_en drop not null,
  alter column area_lat drop not null,
  alter column area_lng drop not null,
  alter column area_radius_m drop not null,
  alter column landmark drop not null,
  alter column reward_xp drop not null,
  alter column reward_gold drop not null,
  add constraint hunts_private_fields check (
    (kind = 'system' and owner is null and join_code is null
      and num_nonnulls(city_zh, city_en, keeper_lat, keeper_lng, keeper_spot_zh, keeper_spot_en,
                      area_lat, area_lng, area_radius_m, landmark, reward_xp, reward_gold) = 12)
    or
    (kind = 'private' and owner is not null and isfinite(starts_at) and isfinite(ends_at)
      and char_length(name_en) between 1 and 60
      and (time_limit_min is null or time_limit_min > 0)
      and (status <> 'published' or join_code is not null)
      and (status <> 'draft' or join_code is null)
      and num_nonnulls(city_zh, city_en, keeper_lat, keeper_lng, keeper_spot_zh, keeper_spot_en,
                      area_lat, area_lng, area_radius_m, landmark, reward_xp, reward_gold) = 0)
  );
create index hunts_owner_idx on public.hunts(owner) where kind = 'private';

create table public.hunt_waypoints (
  id uuid primary key default gen_random_uuid(),
  hunt_id text not null references public.hunts(id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  mission_type text not null check (mission_type in ('arrive', 'spin', 'puzzle')),
  points integer not null check (points between 1 and 999),
  description text not null default '' check (char_length(description) <= 500),
  image text not null default 'tpl:park',
  constraint hunt_waypoints_image_reference check (
    image in ('tpl:park', 'tpl:garden', 'tpl:waterfront', 'tpl:square', 'tpl:publicArt')
    or (
      split_part(image, '/', 1) = hunt_id
      and substr(image, char_length(hunt_id) + 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
    )
  ),
  puzzle_kind text check (puzzle_kind in ('text', 'choice')),
  choices jsonb,
  arrive_check text not null default 'gps' check (arrive_check in ('gps', 'gps_qr')),
  unique (hunt_id, ordinal),
  unique (hunt_id, id),
  check ((mission_type = 'puzzle') = (puzzle_kind is not null)),
  check (arrive_check = 'gps' or mission_type = 'arrive')
);

create table private.hunt_waypoint_secrets (
  waypoint_id uuid primary key references public.hunt_waypoints(id) on delete cascade,
  answer text check (char_length(answer) between 1 and 80),
  qr_token text unique
);

create table public.hunt_members (
  hunt_id text not null references public.hunts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  started_at timestamptz not null,
  finished_at timestamptz check (finished_at >= started_at),
  points integer not null default 0 check (points >= 0),
  primary key (hunt_id, user_id),
  check (started_at >= joined_at)
);
create index hunt_members_user_idx on public.hunt_members(user_id);

create table public.hunt_completions (
  hunt_id text not null,
  waypoint_id uuid not null,
  user_id uuid not null,
  completed_at timestamptz,
  tries integer not null default 0 check (tries >= 0),
  wait_until timestamptz,
  primary key (waypoint_id, user_id),
  foreign key (hunt_id, waypoint_id) references public.hunt_waypoints(hunt_id, id) on delete cascade,
  foreign key (hunt_id, user_id) references public.hunt_members(hunt_id, user_id) on delete cascade
);
create index hunt_completions_member_idx on public.hunt_completions(hunt_id, user_id);

alter table public.hunt_waypoints enable row level security;
alter table public.hunt_members enable row level security;
alter table public.hunt_completions enable row level security;
alter table private.hunt_waypoint_secrets enable row level security;
revoke all on public.hunt_waypoints, public.hunt_members, public.hunt_completions,
  private.hunt_waypoint_secrets from public, anon, authenticated;

-- P2 joins and organizer edits serialize on the same hunt row.
create function private.private_hunt_member_cap() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.hunt_id = old.hunt_id then return new; end if;
  perform 1 from public.hunts where id = new.hunt_id and kind = 'private' for update;
  if not found then raise exception 'unknown private hunt'; end if;
  if exists (select 1 from public.hunt_members where hunt_id = new.hunt_id offset 499)
     and not exists (select 1 from public.hunt_members where hunt_id = new.hunt_id and user_id = new.user_id)
  then raise exception 'too_many'; end if;
  return new;
end $$;
create trigger hunt_members_cap before insert or update of hunt_id on public.hunt_members
for each row execute function private.private_hunt_member_cap();

-- Keep the editor locked even if the first player later leaves or deletes their account.
create function private.mark_hunt_first_join() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.hunts set first_joined_at = new.joined_at
  where id = new.hunt_id and first_joined_at is null;
  return new;
end $$;
create trigger hunt_members_first_join after insert or update of hunt_id on public.hunt_members
for each row execute function private.mark_hunt_first_join();

create function private.lock_owned_hunt(p_hunt text) returns public.hunts
language plpgsql set search_path = '' as $$
declare h public.hunts;
begin
  select * into h from public.hunts
  where id = p_hunt and kind = 'private' and owner = auth.uid() for update;
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
  return h;
end $$;

create function private.private_hunt_area(p_hunt text) returns jsonb
language sql stable set search_path = '' as $$
  with centre as (
    select avg(lat) as lat, avg(lng) as lng from public.hunt_waypoints where hunt_id = p_hunt
  )
  select jsonb_build_object('lat', coalesce(c.lat, 0), 'lng', coalesce(c.lng, 0),
    'radius_m', case when c.lat is null then 200 else
      ceil(greatest(200, 1.25 * (select max(public.distance_m(c.lat, c.lng, w.lat, w.lng))
        from public.hunt_waypoints w where w.hunt_id = p_hunt)))::integer end)
  from centre c
$$;

create function private.hunt_apply_draft(p_hunt text, p_draft jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  h public.hunts := private.lock_owned_hunt(p_hunt);
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
end $$;

create function public.hunt_create(p_draft jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  perform private.hunt_apply_draft(hunt_id, p_draft);
  return jsonb_build_object('id', hunt_id);
end $$;

create function public.hunt_update(p_hunt text, p_draft jsonb) returns void
language sql security definer set search_path = '' as $$
  select private.hunt_apply_draft(p_hunt, p_draft)
$$;

create function public.hunt_waypoint_save(p_hunt text, p_waypoint jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h public.hunts := private.lock_owned_hunt(p_hunt);
  w public.hunt_waypoints;
  answer_text text;
  choice_list jsonb;
  waypoint_id uuid;
begin
  if h.status = 'closed' or (h.status = 'published' and h.ends_at <= now())
  then raise exception 'closed'; end if;
  if h.first_joined_at is not null then raise exception 'hunt_locked' using errcode = 'PT409'; end if;

  select * into w from jsonb_populate_record(null::public.hunt_waypoints, p_waypoint);
  waypoint_id := coalesce(w.id, gen_random_uuid());
  if w.id is not null and not exists (
    select 1 from public.hunt_waypoints where id = w.id and hunt_id = h.id
  ) then raise exception 'not allowed' using errcode = '42501'; end if;
  if w.id is null and exists (select 1 from public.hunt_waypoints where hunt_id = h.id offset 29)
  then raise exception 'too_many'; end if;

  if w.mission_type = 'puzzle' then
    if w.puzzle_kind is null then raise exception 'puzzle type required'; end if;
    answer_text := nullif(btrim(p_waypoint->>'answer'), '');
    if answer_text is null then
      select s.answer into answer_text from private.hunt_waypoint_secrets s where s.waypoint_id = w.id;
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

  insert into public.hunt_waypoints (
    id, hunt_id, ordinal, lat, lng, name, mission_type, points, description, image, puzzle_kind, choices, arrive_check
  ) values (
    waypoint_id, h.id, w.ordinal, w.lat, w.lng, btrim(w.name), w.mission_type, w.points,
    coalesce(w.description, ''), coalesce(nullif(w.image, ''), 'tpl:park'),
    case when w.mission_type = 'puzzle' then w.puzzle_kind end, choice_list,
    case when w.mission_type = 'arrive' then coalesce(w.arrive_check, 'gps') else 'gps' end
  )
  on conflict (id) do update set
    ordinal = excluded.ordinal, lat = excluded.lat, lng = excluded.lng, name = excluded.name,
    mission_type = excluded.mission_type, points = excluded.points, description = excluded.description,
    image = excluded.image, puzzle_kind = excluded.puzzle_kind, choices = excluded.choices,
    arrive_check = excluded.arrive_check;
  if w.mission_type = 'arrive' and w.arrive_check = 'gps_qr' then
    insert into private.hunt_waypoint_secrets as s (waypoint_id, qr_token)
    values (waypoint_id, encode(extensions.gen_random_bytes(16), 'hex'))
    on conflict on constraint hunt_waypoint_secrets_pkey do update
      set answer = null, qr_token = coalesce(s.qr_token, excluded.qr_token);
  elsif w.mission_type = 'puzzle' then
    insert into private.hunt_waypoint_secrets (waypoint_id, answer) values (waypoint_id, answer_text)
    on conflict on constraint hunt_waypoint_secrets_pkey do update set answer = excluded.answer, qr_token = null;
  else
    delete from private.hunt_waypoint_secrets s where s.waypoint_id = w.id;
  end if;
end $$;

create function public.hunt_waypoint_delete(p_waypoint uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.hunts;
begin
  h := private.lock_owned_hunt((select hunt_id from public.hunt_waypoints where id = p_waypoint));
  if h.status = 'closed' or (h.status = 'published' and h.ends_at <= now())
  then raise exception 'closed'; end if;
  if h.first_joined_at is not null then raise exception 'hunt_locked' using errcode = 'PT409'; end if;
  delete from public.hunt_waypoints where id = p_waypoint and hunt_id = h.id;
end $$;

create function public.hunt_publish(p_hunt text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  h public.hunts := private.lock_owned_hunt(p_hunt);
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  if h.status = 'closed' or h.ends_at <= now()
     or not exists (select 1 from public.hunt_waypoints where hunt_id = h.id)
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
end $$;

create function public.hunt_close(p_hunt text) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.hunts := private.lock_owned_hunt(p_hunt);
begin
  update public.hunts set status = 'closed' where id = h.id;
end $$;

create function private.private_hunt_draft(h public.hunts) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'name', h.name_en, 'description', h.description, 'cover', h.cover, 'route_mode', h.route_mode,
    'leaderboard_visible', h.leaderboard_visible, 'starts_at', h.starts_at, 'ends_at', h.ends_at,
    'time_limit_min', h.time_limit_min)
$$;

create function public.hunt_edit_state(p_hunt text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare h public.hunts;
begin
  select * into h from public.hunts where id = p_hunt and kind = 'private' and owner = auth.uid();
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object('draft', private.private_hunt_draft(h), 'status', h.status, 'code', h.join_code,
    'locked', h.first_joined_at is not null,
    'waypoints', coalesce((select jsonb_agg(
      (to_jsonb(w) - 'hunt_id') || jsonb_build_object(
        'puzzle_kind', coalesce(w.puzzle_kind, 'choice'),
        'choices', coalesce(w.choices, '[]'::jsonb), 'answer', '')
      || case when s.qr_token is null then '{}'::jsonb else jsonb_build_object('qr_token', s.qr_token) end
      order by w.ordinal)
      from public.hunt_waypoints w left join private.hunt_waypoint_secrets s on s.waypoint_id = w.id
      where w.hunt_id = h.id), '[]'::jsonb));
end $$;

create function public.my_hunts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.private_hunt_draft(h) || jsonb_build_object(
    'id', h.id, 'status', h.status, 'join_code', h.join_code, 'area', private.private_hunt_area(h.id),
    'joined', (select count(*) from public.hunt_members m where m.hunt_id = h.id),
    'joined_at', null, 'finished_at', null, 'points', 0, 'preview', false,
    'waypoints', coalesce((select jsonb_agg(to_jsonb(w) - 'hunt_id' order by w.ordinal)
      from public.hunt_waypoints w where w.hunt_id = h.id), '[]'::jsonb))
    order by h.starts_at desc, h.id), '[]'::jsonb)
  from public.hunts h where h.kind = 'private' and h.owner = auth.uid()
$$;

create function public.hunt_review(p_hunt text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.hunts where id = p_hunt and kind = 'private' and owner = auth.uid())
  then raise exception 'not allowed' using errcode = '42501'; end if;
  return (
    with members as (
      select p.id as "user", p.name, p.avatar, m.points, m.finished_at,
        extract(epoch from m.finished_at - m.started_at)::integer as duration_s,
        p.id = auth.uid() as you
      from public.hunt_members m join public.profiles p on p.id = m.user_id where m.hunt_id = p_hunt
    )
    select jsonb_build_object('members', coalesce(jsonb_agg(to_jsonb(m)
      order by points desc, duration_s nulls last, name, "user"), '[]'::jsonb),
      'stats', jsonb_build_object('joined', count(*), 'finished', count(finished_at),
        'per_waypoint', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'done',
          (select count(*) from public.hunt_completions c where c.waypoint_id = w.id
            and c.completed_at is not null)) order by w.ordinal)
          from public.hunt_waypoints w where w.hunt_id = p_hunt), '[]'::jsonb)))
    from members m
  );
end $$;

revoke all on function private.private_hunt_member_cap(), private.mark_hunt_first_join(), private.lock_owned_hunt(text),
  private.private_hunt_area(text), private.hunt_apply_draft(text, jsonb),
  private.private_hunt_draft(public.hunts) from public, anon, authenticated;

revoke all on function public.hunt_create(jsonb), public.hunt_update(text, jsonb),
  public.hunt_waypoint_save(text, jsonb), public.hunt_waypoint_delete(uuid),
  public.hunt_publish(text), public.hunt_close(text), public.hunt_edit_state(text),
  public.my_hunts(), public.hunt_review(text) from public, anon, authenticated, service_role;
grant execute on function public.hunt_create(jsonb), public.hunt_update(text, jsonb),
  public.hunt_waypoint_save(text, jsonb), public.hunt_waypoint_delete(uuid),
  public.hunt_publish(text), public.hunt_close(text), public.hunt_edit_state(text),
  public.my_hunts(), public.hunt_review(text) to authenticated;

-- Quest photos use <hunt_id>/<uuid>.jpg in hunt-media. Owners and members resolve
-- these private paths with the Storage client.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hunt-media', 'hunt-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']);

create function private.can_access_hunt_media(object_name text, owner_only boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.hunts h
    where h.id = (storage.foldername(object_name))[1] and h.kind = 'private'
      and (h.owner = auth.uid() or (not owner_only and exists (
        select 1 from public.hunt_members m where m.hunt_id = h.id and m.user_id = auth.uid()
      )))
  )
$$;
revoke all on function private.can_access_hunt_media(text, boolean) from public, anon, authenticated;
grant execute on function private.can_access_hunt_media(text, boolean) to authenticated;

create policy hunt_media_read on storage.objects for select to authenticated
  using (bucket_id = 'hunt-media' and private.can_access_hunt_media(name, false));
create policy hunt_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'hunt-media' and private.can_access_hunt_media(name, true));
create policy hunt_media_update on storage.objects for update to authenticated
  using (bucket_id = 'hunt-media' and private.can_access_hunt_media(name, true))
  with check (bucket_id = 'hunt-media' and private.can_access_hunt_media(name, true));
create policy hunt_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'hunt-media' and private.can_access_hunt_media(name, true));

-- Keep every existing system implementation and add the kind predicate at its
-- lookup. This also preserves the timed system bodies if Part A lands first.
do $$
declare
  signature regprocedure;
  original text;
  scoped text;
begin
  foreach signature in array array[
    'public.hunt_list(double precision,double precision)'::regprocedure,
    'public.hunt_join(text)'::regprocedure,
    'public.hunt_check_in(text,double precision,double precision,double precision)'::regprocedure,
    'public.hunt_finish(text,double precision,double precision,double precision)'::regprocedure,
    'private.hunt_object(text,uuid)'::regprocedure,
    'private.hunt_action(text,uuid,double precision,double precision)'::regprocedure
  ] loop
    original := pg_get_functiondef(signature);
    scoped := case signature::oid
      when 'public.hunt_list(double precision,double precision)'::regprocedure::oid then
        replace(original, 'from public.hunts h where', 'from public.hunts h where h.kind = ''system'' and')
      when 'private.hunt_object(text,uuid)'::regprocedure::oid then
        replace(original, 'where h.id=p_hunt', 'where h.kind = ''system'' and h.id=p_hunt')
      when 'private.hunt_action(text,uuid,double precision,double precision)'::regprocedure::oid then
        replace(original, 'from public.hunts x', 'from (select * from public.hunts where kind = ''system'') x')
      else
        replace(original, 'from public.hunts where id=p_hunt', 'from public.hunts where kind = ''system'' and id=p_hunt')
    end;
    if scoped = original then raise exception 'System hunt lookup changed in %', signature; end if;
    execute scoped;
  end loop;
end $$;

commit;
