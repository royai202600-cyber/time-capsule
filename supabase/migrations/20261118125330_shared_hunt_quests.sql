-- A quest rule snapshots the public prompt and grading data at authoring time.
-- Context tables own membership, ordering, elapsed time and rewards.
create type private.quest_type as enum ('arrive','question','price','catch','landmark');
create table private.quest_rules (
  id uuid primary key default gen_random_uuid(),
  type private.quest_type not null,
  location_lat double precision not null check(location_lat between -90 and 90),
  location_lng double precision not null check(location_lng between -180 and 180),
  name_zh text not null,
  name_en text not null,
  image text,
  pool_id uuid references private.question_pool(id),
  question jsonb,
  price jsonb,
  correct_answer jsonb,
  typed_aliases text[],
  catch_count integer check (catch_count between 1 and 5),
  landmark_id uuid references public.public_capsule_spots(id),
  check ((question is not null) = (type = 'question')),
  check ((price is not null) = (type = 'price')),
  check ((correct_answer is not null) = (type in ('question','price'))),
  check ((catch_count is not null) = (type = 'catch')),
  check ((landmark_id is not null) = (type = 'landmark'))
);
create index quest_rules_pool on private.quest_rules(pool_id) where pool_id is not null;
create index quest_rules_landmark on private.quest_rules(landmark_id) where landmark_id is not null;

update public.private_hunt_quests set quest_type = 'arrive' where quest_type = 'spin';
alter table public.private_hunt_quests drop constraint private_quest_type,
  drop constraint private_quest_location,
  add column rule_id uuid unique references private.quest_rules(id),
  add constraint private_quest_type check (quest_type in ('arrive','puzzle','restore','question','price','catch','landmark')),
  add constraint private_quest_location check (
    (quest_type = 'restore' and location_lat is null and location_lng is null and catch_count is not null and catch_count between 1 and 20)
    or (quest_type <> 'restore' and location_lat is not null and location_lng is not null and
      case when quest_type = 'catch' then catch_count is not null and catch_count between 1 and 5
        else catch_count is null end)
  );

create table private.city_hunt_located_quests (
  hunt_id text not null references public.hunts(id) on delete cascade,
  quest_id uuid primary key references private.quest_rules(id),
  ordinal integer not null check (ordinal > 0),
  points integer not null default 0 check (points >= 0),
  available_since timestamptz not null default now(),
  legacy_type text check (legacy_type in ('spin','restore','landmark')),
  unique(hunt_id,ordinal)
);
create table private.city_hunt_located_progress (
  quest_id uuid not null references private.city_hunt_located_quests(quest_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_at timestamptz not null,
  tries integer not null default 0,
  wait_until timestamptz,
  caught integer not null default 0,
  completed_at timestamptz,
  primary key(quest_id,user_id)
);
create index city_hunt_located_progress_user on private.city_hunt_located_progress(user_id);

create table private.quest_spawns (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null,
  context text not null check(context in ('city_hunt','private_hunt')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_at timestamptz not null,
  slot integer not null check (slot between 1 and 5),
  expires_at timestamptz not null,
  location_lat double precision not null,
  location_lng double precision not null,
  vessel text not null references public.vessels(id),
  unique(context,quest_id,user_id,slot)
);
create index quest_spawns_user on private.quest_spawns(user_id);
create index quest_spawns_vessel on private.quest_spawns(vessel);
alter table private.quest_rules enable row level security;
alter table private.city_hunt_located_quests enable row level security;
alter table private.city_hunt_located_progress enable row level security;
alter table private.quest_spawns enable row level security;
revoke all on private.quest_rules, private.city_hunt_located_quests, private.city_hunt_located_progress,
  private.quest_spawns from public,anon,authenticated,service_role;

create function private.quest_json(p_id uuid, p_ordinal int, r private.quest_rules,
  p_points int, p_done boolean, p_locked boolean, p_tries int)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'quest_id',p_id,'ordinal',p_ordinal,'type',r.type,
    'location_lat',r.location_lat,'location_lng',r.location_lng,
    'name_zh',r.name_zh,'name_en',r.name_en,'image',r.image,
    'points',p_points,'done',p_done,'locked',p_locked)
    || case when r.question is not null then jsonb_build_object('question',r.question) else '{}' end
    || case when r.price is not null then jsonb_build_object('price',r.price ||
       jsonb_build_object('tries_left',greatest(0,3-coalesce(p_tries,0)))) else '{}' end
    || case when r.catch_count is not null then jsonb_build_object('catch_count',r.catch_count) else '{}' end
    || case when r.landmark_id is not null then jsonb_build_object('landmark_id',r.landmark_id) else '{}' end
$$;

create function private.quest_at_pin(r private.quest_rules,p_lat double precision,p_lng double precision,p_accuracy double precision)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(p_lat between -90 and 90 and p_lng between -180 and 180
    and p_accuracy > 0 and p_accuracy <= 200 and
    public.distance_m(p_lat,p_lng,r.location_lat,r.location_lng) <=
      (select action_radius_m from private.game_config where singleton),false)
$$;

create function private.quest_rule_from_pool(p_id uuid,p_type private.quest_type)
returns private.quest_rules language plpgsql stable set search_path = '' as $$
declare p private.question_pool;
declare s private.question_pool_secrets;
declare r private.quest_rules;
begin
  select * into p from private.question_pool
    where id=p_id and status='published' and type=p_type::text
      and location_lat is not null and location_lng is not null;
  if not found then raise exception 'bad_rule'; end if;
  select * into strict s from private.question_pool_secrets where id=p.id;
  r.type:=p_type;
  r.pool_id:=p.id;
  r.location_lat:=p.location_lat;
  r.location_lng:=p.location_lng;
  r.name_zh:=p.place_zh;
  r.name_en:=p.place_en;
  r.image:=p.photo;
  if p_type='question' then
    r.question:=jsonb_strip_nulls(jsonb_build_object('kind',p.kind,
      'prompt_zh',p.prompt_zh,'prompt_en',p.prompt_en,'choices',p.choices));
    r.correct_answer:=case p.kind when 'choice' then jsonb_build_object('choice',s.answer)
      else jsonb_build_object('text',s.answer) end;
    r.typed_aliases:=s.typed_aliases;
  else
    r.price:=jsonb_build_object('place_zh',p.place_zh,'place_en',p.place_en,
      'prompt_zh',p.prompt_zh,'prompt_en',p.prompt_en,'currency',p.currency,'rate',p.rate);
    r.correct_answer:=jsonb_build_object('usd',s.usd,'local_amount',s.local_amount);
  end if;
  return r;
end $$;

-- A miss consumes a try, but only a valid answer can start a cooldown.
create function private.quest_grade(r private.quest_rules, a jsonb, tries int, wait_until timestamptz, at_time timestamptz)
returns jsonb language plpgsql stable set search_path = '' as $$
declare guess numeric;
declare target numeric;
declare is_right boolean;
declare tries_after int;
begin
  if r.type='price' then
    if tries>=3 then raise exception 'no_tries'; end if;
    if jsonb_typeof(a->'usd') is distinct from 'number' then raise exception 'bad_answer'; end if;
    guess:=(a->>'usd')::numeric;
    if guess <= 0 or guess > 1000000 or scale(guess)>2 then raise exception 'bad_answer'; end if;
    target:=(r.correct_answer->>'usd')::numeric;
    is_right:=abs(guess-target)<=target*0.10;
    return jsonb_strip_nulls(jsonb_build_object('ok',is_right,'done',is_right,'points',0,
      'tries_left',3-tries-1,
      'hint',case when not is_right and guess<target then 'higher' when not is_right then 'lower' end,
      'correct_answer',case when is_right then r.correct_answer end));
  elsif r.type='question' then
    if wait_until>at_time then raise exception 'no_tries'; end if;
    if r.question->>'kind'='choice' then
      if jsonb_typeof(a->'choice') is distinct from 'number' then raise exception 'bad_answer'; end if;
      guess:=(a->>'choice')::numeric;
      if guess<>trunc(guess) or guess<0 or guess>=jsonb_array_length(r.question->'choices')
      then raise exception 'bad_answer'; end if;
      is_right:=a->'choice'=r.correct_answer->'choice';
    else
      if jsonb_typeof(a->'text') is distinct from 'string' or length(btrim(a->>'text')) not between 1 and 120
      then raise exception 'bad_answer'; end if;
      is_right:=private.private_hunt_normalize_answer(a->>'text') =
        private.private_hunt_normalize_answer(r.correct_answer->>'text')
        or exists (select 1 from unnest(r.typed_aliases) alias
          where private.private_hunt_normalize_answer(a->>'text')=private.private_hunt_normalize_answer(alias));
    end if;
    tries_after:=case when wait_until is not null then 1 else tries+1 end;
    return jsonb_strip_nulls(jsonb_build_object('ok',is_right,'done',is_right,'points',0,
      'tries_left',3-tries_after,'correct_answer',case when is_right then r.correct_answer end));
  end if;
  return jsonb_build_object('ok',true,'done',r.type='arrive','points',0);
end $$;

alter function public.private_hunt_quest_save(text,jsonb) rename to private_hunt_quest_save_legacy;
alter function public.private_hunt_quest_save_legacy(text,jsonb) set schema private;
revoke all on function private.private_hunt_quest_save_legacy(text,jsonb) from public,anon,authenticated,service_role;

create function public.private_hunt_quest_save(p_hunt text,p_quest jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare h public.hunts;
declare w public.private_hunt_quests;
declare existing public.private_hunt_quests;
declare r private.quest_rules;
declare post public.public_capsule_spots;
declare requested text := coalesce(p_quest->>'type',p_quest->>'quest_type');
declare pool uuid := (p_quest->>'pool_id')::uuid;
begin
  h:=private.private_hunt_lock_owned(p_hunt);
  if requested is null or requested not in ('arrive','puzzle','question','price','catch','landmark')
  then raise exception 'bad_rule'; end if;
  if h.status='closed' or (h.status='published' and h.ends_at<=now()) then raise exception 'closed'; end if;
  if h.first_joined_at is not null then raise exception 'hunt_locked' using errcode='PT409'; end if;
  w:=jsonb_populate_record(null::public.private_hunt_quests,p_quest);
  if w.id is not null then
    select * into existing from public.private_hunt_quests where id=w.id and hunt_id=h.id;
    if not found then raise exception 'not allowed' using errcode='42501'; end if;
  elsif exists(select 1 from public.private_hunt_quests where hunt_id=h.id offset 29)
  then raise exception 'too_many';
  end if;

  if requested in ('arrive','puzzle') then
    if (w.location_lat between -90 and 90 and w.location_lng between -180 and 180) is not true
    then raise exception 'bad_rule'; end if;
    perform private.private_hunt_quest_save_legacy(p_hunt,
      p_quest || jsonb_build_object('quest_type',requested,'name',coalesce(w.name,p_quest->>'name_en'),'catch_count',null));
    if existing.rule_id is not null then
      update public.private_hunt_quests set rule_id=null where id=existing.id;
      delete from private.quest_rules where id=existing.rule_id;
    end if;
    return;
  end if;

  if requested in ('question','price') then
    r:=private.quest_rule_from_pool(pool,requested::private.quest_type);
  else
    if (w.location_lat between -90 and 90 and w.location_lng between -180 and 180) is not true
    then raise exception 'bad_rule'; end if;
    r.type:=requested::private.quest_type;
    r.location_lat:=w.location_lat;
    r.location_lng:=w.location_lng;
    if requested='landmark' then
      select * into post from public.public_capsule_spots
      where kind='landmark' and game_enabled and hidden_at is null
        and (p_quest->>'landmark_id' is null or id=(p_quest->>'landmark_id')::uuid)
        and public.distance_m(lat,lng,w.location_lat,w.location_lng)<=2000
      order by public.distance_m(lat,lng,w.location_lat,w.location_lng),id limit 1;
      if post.id is null then raise exception 'bad_rule'; end if;
      r.landmark_id:=post.id;
      r.location_lat:=post.lat;
      r.location_lng:=post.lng;
      r.name_zh:=post.name_zh;
      r.name_en:=post.name_en;
    else
      r.catch_count:=coalesce(w.catch_count,3);
      if r.catch_count not between 1 and 5 then raise exception 'bad_rule'; end if;
    end if;
  end if;
  r.name_en:=coalesce(nullif(btrim(p_quest->>'name_en'),''),nullif(btrim(w.name),''),r.name_en);
  r.name_zh:=coalesce(nullif(btrim(p_quest->>'name_zh'),''),r.name_zh,r.name_en);
  r.image:=coalesce(nullif(w.image,''),r.image,'tpl:park');
  if r.name_en is null or w.ordinal is null or w.points is null then raise exception 'bad_rule'; end if;
  r.id:=gen_random_uuid();
  w.id:=coalesce(w.id,gen_random_uuid());
  insert into private.quest_rules select r.*;
  insert into public.private_hunt_quests
    (id,hunt_id,ordinal,location_lat,location_lng,name,quest_type,points,description,image,arrive_check,catch_count,rule_id)
  values(w.id,h.id,w.ordinal,r.location_lat,r.location_lng,left(r.name_en,60),requested,w.points,
    coalesce(w.description,''),coalesce(nullif(w.image,''),'tpl:park'),'gps',r.catch_count,r.id)
  on conflict(id) do update set
    (ordinal,location_lat,location_lng,name,quest_type,points,description,image,arrive_check,catch_count,rule_id,puzzle_kind,choices)=
    (excluded.ordinal,excluded.location_lat,excluded.location_lng,excluded.name,excluded.quest_type,
     excluded.points,excluded.description,excluded.image,excluded.arrive_check,excluded.catch_count,excluded.rule_id,null,null);
  delete from private.private_hunt_quest_secrets where quest_id=w.id;
  delete from private.quest_rules where id=existing.rule_id;
end $$;

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
      (to_jsonb(w) - 'hunt_id' - 'rule_id') || jsonb_build_object(
        'puzzle_kind', coalesce(w.puzzle_kind, 'choice'),
        'choices', coalesce(w.choices, '[]'::jsonb), 'answer', '')
      || case when r.id is null then '{}'::jsonb else
        private.quest_json(w.id,w.ordinal,r,w.points,false,false,0)
        || jsonb_strip_nulls(jsonb_build_object('pool_id',r.pool_id)) end
      || case when s.qr_token is null then '{}'::jsonb else jsonb_build_object('qr_token', s.qr_token) end
      order by w.ordinal)
      from public.private_hunt_quests w left join private.private_hunt_quest_secrets s on s.quest_id = w.id
      left join private.quest_rules r on r.id=w.rule_id
      where w.hunt_id = h.id), '[]'::jsonb));
end $function$
;

revoke all on function public.private_hunt_edit_state(p_hunt text) from public,anon,authenticated;

grant execute on function public.private_hunt_edit_state(p_hunt text) to authenticated;

create function private.private_quest_rule(w public.private_hunt_quests)
returns private.quest_rules language plpgsql stable set search_path='' as $$
declare r private.quest_rules;
begin
  if w.rule_id is not null then
    select * into r from private.quest_rules where id=w.rule_id;
    return r;
  end if;
  if w.quest_type='restore' then return null; end if;
  r.type:=case when w.quest_type='puzzle' then 'question' else 'arrive' end;
  r.location_lat:=w.location_lat;
  r.location_lng:=w.location_lng;
  r.name_zh:=w.name;
  r.name_en:=w.name;
  r.image:=w.image;
  if w.quest_type='puzzle' then
    r.question:=jsonb_strip_nulls(jsonb_build_object('kind',w.puzzle_kind,
      'prompt_zh',coalesce(nullif(w.description,''),w.name),
      'prompt_en',coalesce(nullif(w.description,''),w.name),
      'choices',case when w.puzzle_kind='choice' then (
        select jsonb_agg(jsonb_build_object('zh',c,'en',c) order by n)
        from jsonb_array_elements_text(w.choices) with ordinality as a(c,n)) end));
  end if;
  return r;
end $$;

create function private.private_quest_is_locked(h public.hunts,m public.private_hunt_members,ordinal int)
returns boolean language sql stable set search_path='' as $$
  select coalesce(m.started_at is null or now()<h.starts_at or now()>=least(h.ends_at,
    m.started_at+make_interval(mins=>h.time_limit_min)) or h.status<>'published'
    or (h.route_mode='ordered' and exists (
      select 1 from public.private_hunt_quests e where e.hunt_id=h.id and e.ordinal<$3
      and not exists(select 1 from public.private_hunt_quest_progress c where c.quest_id=e.id
        and c.user_id=m.user_id and c.completed_at is not null))),true)
$$;

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
      select jsonb_agg((to_jsonb(w) - 'hunt_id' - 'rule_id') || jsonb_build_object(
        'caught_count',coalesce(c.catch_count,0), 'done_at', c.completed_at, 'tries', coalesce(c.tries, 0), 'wait_until', c.wait_until)
        || case when w.quest_type='restore' then '{}'::jsonb else
          private.quest_json(w.id,w.ordinal,private.private_quest_rule(w),w.points,c.completed_at is not null,
            c.completed_at is null and private.private_quest_is_locked(h,m,w.ordinal),c.tries) end
        order by w.ordinal)
      from public.private_hunt_quests w
      left join public.private_hunt_quest_progress c on c.quest_id = w.id and c.user_id = m.user_id
      where w.hunt_id = h.id and m.user_id is not null
    ), '[]'::jsonb),
    -- A preview preserves the older empty quests array. The shared array
    -- describes pins from a valid invite, locked until the player starts.
    'quest_objects',coalesce((
      select jsonb_agg(private.quest_json(w.id,w.ordinal,private.private_quest_rule(w),w.points,
        c.completed_at is not null,
        c.completed_at is null and private.private_quest_is_locked(h,m,w.ordinal),c.tries) order by w.ordinal)
      from public.private_hunt_quests w
      left join public.private_hunt_quest_progress c on c.quest_id=w.id and c.user_id=m.user_id
      where w.hunt_id=h.id and w.quest_type<>'restore'
    ),'[]'::jsonb))
$function$;

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
  if w.quest_type in ('restore','catch') then raise exception 'catch_required'; end if;
  if w.quest_type not in ('arrive','puzzle') then raise exception 'bad_rule'; end if;
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


create function private.quest_start_spawns(p_context text,p_id uuid,r private.quest_rules,p_run timestamptz,
  p_remaining int,p_end timestamptz)
returns void language sql set search_path='' as $$
  insert into private.quest_spawns (quest_id,context,user_id,run_at,slot,expires_at,location_lat,location_lng,vessel)
  select p_id,p_context,auth.uid(),p_run,n,least(p_end,now()+interval '10 minutes'),
    r.location_lat,r.location_lng,v.id
  from generate_series(1,p_remaining) n
  cross join lateral (select id from public.vessels where earned_place is null and price_mop=0
    order by id limit 1) v
  on conflict(context,quest_id,user_id,slot) do update set
    id=gen_random_uuid(),run_at=excluded.run_at,expires_at=excluded.expires_at
  where quest_spawns.run_at<>excluded.run_at or quest_spawns.expires_at<=now()
    or exists (select 1 from public.corrupted_catches c where c.user_id=auth.uid()
      and c.spawn_id='quest:'||quest_spawns.id and c.result in ('caught','failed'))
$$;

create function private.private_quest_finish(h public.hunts,w public.private_hunt_quests,p_at timestamptz)
returns void language plpgsql set search_path='' as $$
begin
  insert into public.private_hunt_quest_progress(hunt_id,quest_id,user_id,completed_at)
  values(h.id,w.id,auth.uid(),p_at)
  on conflict(quest_id,user_id) do update set completed_at=excluded.completed_at,wait_until=null
    where private_hunt_quest_progress.completed_at is null;
  if not found then return; end if;
  update public.private_hunt_members m set points=m.points+w.points,
    finished_at=case when not exists (select 1 from public.private_hunt_quests q
      where q.hunt_id=h.id and not exists (select 1 from public.private_hunt_quest_progress c
        where c.quest_id=q.id and c.user_id=auth.uid() and c.completed_at is not null)) then p_at end
  where m.hunt_id=h.id and m.user_id=auth.uid();
end $$;

create function public.private_hunt_quest_attempt(payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.hunts;
declare m public.private_hunt_members;
declare w public.private_hunt_quests;
declare c public.private_hunt_quest_progress;
declare r private.quest_rules;
declare result jsonb;
declare a jsonb := payload->'answer';
declare lat double precision := (payload->>'lat')::double precision;
declare lng double precision := (payload->>'lng')::double precision;
declare accuracy double precision := (payload->>'accuracy')::double precision;
declare choice numeric;
declare submitted text;
declare at_time timestamptz;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  select * into w from public.private_hunt_quests where id=(payload->>'quest_id')::uuid;
  select * into h from public.hunts where id=w.hunt_id and kind='private' and hidden_at is null for share;
  select * into m from public.private_hunt_members where hunt_id=h.id and user_id=auth.uid() for update;
  if not found then raise exception 'not_joined'; end if;
  -- Re-read the quest after taking the hunt lock.
  select * into strict w from public.private_hunt_quests where id=w.id and hunt_id=h.id;
  select * into c from public.private_hunt_quest_progress where quest_id=w.id and user_id=auth.uid();
  at_time:=clock_timestamp();
  if h.status<>'published' then raise exception 'closed'; end if;
  if m.started_at is null or at_time<greatest(m.started_at,h.starts_at) then raise exception 'not_started'; end if;
  if at_time>=least(h.ends_at,m.started_at+make_interval(mins=>h.time_limit_min)) then raise exception 'time_up'; end if;
  if c.completed_at is not null then raise exception 'already_done'; end if;
  if private.private_quest_is_locked(h,m,w.ordinal) then raise exception 'locked'; end if;
  if w.quest_type='restore' then raise exception 'catch_required'; end if;
  r:=private.private_quest_rule(w);
  if not private.quest_at_pin(r,lat,lng,accuracy) then raise exception 'too_far'; end if;

  if w.rule_id is null then
    if w.quest_type='puzzle' then
      if w.puzzle_kind='choice' then
        if jsonb_typeof(a->'choice') is distinct from 'number' then raise exception 'bad_answer'; end if;
        choice:=(a->>'choice')::numeric;
        if choice<>trunc(choice) or choice<0 or choice>=jsonb_array_length(w.choices) then raise exception 'bad_answer'; end if;
        submitted:=w.choices->>(choice::int);
      else
        if jsonb_typeof(a->'text') is distinct from 'string' or length(btrim(a->>'text')) not between 1 and 120
        then raise exception 'bad_answer'; end if;
        submitted:=a->>'text';
      end if;
    end if;
    result:=public.private_hunt_quest_complete(w.id,lat,lng,accuracy,submitted,a->>'qr');
    if result ? 'message' then
      perform set_config('response.status','200',true);
      return jsonb_build_object('ok',false,'done',false,'points',0,'tries_left',
        (result->>'details')::jsonb->'tries_left');
    end if;
    return jsonb_strip_nulls(jsonb_build_object('ok',true,'done',true,'points',w.points,
      'correct_answer',case when w.quest_type='puzzle' then
        case when w.puzzle_kind='choice' then jsonb_build_object('choice',choice)
        else (select jsonb_build_object('text',answer) from private.private_hunt_quest_secrets where quest_id=w.id) end
      end));
  end if;

  result:=private.quest_grade(r,a,coalesce(c.tries,0),c.wait_until,at_time);
  if r.type='catch' then
    perform private.quest_start_spawns('private_hunt',w.id,r,m.started_at,r.catch_count-coalesce(c.catch_count,0),
      least(h.ends_at,m.started_at+make_interval(mins=>h.time_limit_min)));
  elsif (result->>'done')::boolean then
    perform private.private_quest_finish(h,w,at_time);
    return result || jsonb_build_object('points',w.points);
  elsif r.type in ('question','price') then
    insert into public.private_hunt_quest_progress(hunt_id,quest_id,user_id,tries,wait_until)
    values(h.id,w.id,auth.uid(),3-(result->>'tries_left')::int,
      case when r.type='question' and (result->>'tries_left')::int=0 then at_time+interval '60 seconds' end)
    on conflict(quest_id,user_id) do update set tries=excluded.tries,wait_until=excluded.wait_until;
  end if;
  return result;
end $$;

alter table private.city_hunt_located_quests add column legacy_goal integer;
alter table public.city_hunt_quest_progress add column located_run_at timestamptz;

create function private.city_quest_done(q private.city_hunt_located_quests,p public.city_hunt_quest_progress)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from private.city_hunt_located_progress c
    where c.quest_id=q.quest_id and c.user_id=p.user_id and c.run_at=p.checked_in_at and c.completed_at is not null)
    or ((p.located_run_at is distinct from p.checked_in_at and
        (p.checked_in_at<q.available_since or p.finished_at is not null))
      and coalesce(case q.legacy_type when 'spin' then p.spin_count
        when 'restore' then p.restore_count when 'landmark' then p.landmark_count end >= q.legacy_goal,false))
$$;

create function private.city_quest_locked(h public.hunts,q private.city_hunt_located_quests,p public.city_hunt_quest_progress)
returns boolean language sql stable set search_path='' as $$
  select h.hidden_at is not null or h.status<>'published' or now()<h.starts_at
    or p.checked_in_at is null or p.finished_at is not null
    or now()>=private.city_hunt_run_end(h,p.checked_in_at)
    or exists(select 1 from private.city_hunt_located_quests e where e.hunt_id=q.hunt_id and e.ordinal<q.ordinal
      and not private.city_quest_done(e,p))
$$;

create function public.city_hunt_quests(hunt_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  return coalesce((
    select jsonb_agg(private.quest_json(q.quest_id,q.ordinal,r,q.points,d.done,
      not d.done and private.city_quest_locked(h,q,p),c.tries) order by q.ordinal)
    from public.hunts h
    join public.city_hunt_quest_progress p on p.hunt_id=h.id and p.user_id=auth.uid() and p.checked_in_at is not null
    join private.city_hunt_located_quests q on q.hunt_id=h.id
    join private.quest_rules r on r.id=q.quest_id
    left join private.city_hunt_located_progress c on c.quest_id=q.quest_id and c.user_id=p.user_id and c.run_at=p.checked_in_at
    cross join lateral (select private.city_quest_done(q,p) as done) d
    where h.id=city_hunt_quests.hunt_id and h.kind='system' and h.hidden_at is null
  ),'[]');
end $$;

create function public.city_hunt_quest_attempt(payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.hunts;
declare p public.city_hunt_quest_progress;
declare q private.city_hunt_located_quests;
declare c private.city_hunt_located_progress;
declare r private.quest_rules;
declare result jsonb;
declare lat double precision := (payload->>'lat')::double precision;
declare lng double precision := (payload->>'lng')::double precision;
declare accuracy double precision := (payload->>'accuracy')::double precision;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  select * into q from private.city_hunt_located_quests where quest_id=(payload->>'quest_id')::uuid;
  select * into h from public.hunts where id=q.hunt_id and kind='system' and hidden_at is null for share;
  if not found then raise exception 'not_joined'; end if;
  select * into p from public.city_hunt_quest_progress where hunt_id=h.id and user_id=auth.uid() for update;
  if not found then raise exception 'not_joined'; end if;
  if h.status<>'published' or now()>=h.ends_at then raise exception 'closed'; end if;
  if p.checked_in_at is null or now()<h.starts_at then raise exception 'not_started'; end if;
  if now()>=private.city_hunt_run_end(h,p.checked_in_at) then raise exception 'time_up'; end if;
  if p.finished_at is not null then raise exception 'already_done'; end if;

  select * into strict r from private.quest_rules where id=q.quest_id;
  if not private.quest_at_pin(r,lat,lng,accuracy) then raise exception 'too_far'; end if;
  if p.located_run_at is distinct from p.checked_in_at then
    -- Snapshot carried legacy progress once when a run first uses the new pins.
    -- Legacy actions after this point cannot advance located quests.
    insert into private.city_hunt_located_progress(quest_id,user_id,run_at,caught,completed_at)
    select e.quest_id,auth.uid(),p.checked_in_at,
      case when e.legacy_type='restore' and p.checked_in_at<e.available_since
        then least(coalesce(e.legacy_goal,0),p.restore_count) else 0 end,
      case when private.city_quest_done(e,p) then p.checked_in_at end
    from private.city_hunt_located_quests e where e.hunt_id=h.id
    on conflict(quest_id,user_id) do update set run_at=excluded.run_at,tries=0,wait_until=null,
      caught=excluded.caught,completed_at=excluded.completed_at;
    update public.city_hunt_quest_progress set located_run_at=checked_in_at
      where hunt_id=h.id and user_id=auth.uid() returning * into p;
  end if;
  if private.city_quest_done(q,p) then raise exception 'already_done'; end if;
  if private.city_quest_locked(h,q,p) then raise exception 'locked'; end if;

  select * into c from private.city_hunt_located_progress
    where quest_id=q.quest_id and user_id=auth.uid() and run_at=p.checked_in_at;
  result:=private.quest_grade(r,payload->'answer',coalesce(c.tries,0),c.wait_until,clock_timestamp());
  if r.type='catch' then
    perform private.quest_start_spawns('city_hunt',q.quest_id,r,p.checked_in_at,r.catch_count-coalesce(c.caught,0),
      private.city_hunt_run_end(h,p.checked_in_at));
  elsif (result->>'done')::boolean or r.type in ('question','price') then
    insert into private.city_hunt_located_progress(quest_id,user_id,run_at,tries,wait_until,completed_at)
    values(q.quest_id,auth.uid(),p.checked_in_at,3-coalesce((result->>'tries_left')::int,3),
      case when r.type='question' and not (result->>'done')::boolean and (result->>'tries_left')::int=0
        then clock_timestamp()+interval '60 seconds' end,
      case when (result->>'done')::boolean then clock_timestamp() end)
    on conflict(quest_id,user_id) do update set run_at=excluded.run_at,tries=excluded.tries,
      wait_until=excluded.wait_until,completed_at=excluded.completed_at;
  end if;
  return result || jsonb_build_object('points',case when (result->>'done')::boolean then q.points else 0 end);
end $$;

create function private.quest_spawn_available(s private.quest_spawns)
returns boolean language sql stable set search_path='' as $$
  select s.user_id=auth.uid() and s.expires_at>now() and case s.context
    when 'private_hunt' then exists(
      select 1 from public.private_hunt_quests w
      join public.hunts h on h.id=w.hunt_id and h.hidden_at is null
      join public.private_hunt_members m on m.hunt_id=h.id and m.user_id=auth.uid() and m.started_at=s.run_at
      where w.id=s.quest_id and w.quest_type='catch' and not private.private_quest_is_locked(h,m,w.ordinal)
        and not exists (select 1 from public.private_hunt_quest_progress c
          where c.quest_id=w.id and c.user_id=m.user_id and c.completed_at is not null))
    when 'city_hunt' then exists(
      select 1 from private.city_hunt_located_quests q
      join public.hunts h on h.id=q.hunt_id
      join public.city_hunt_quest_progress p on p.hunt_id=h.id and p.user_id=auth.uid()
        and p.checked_in_at=s.run_at and p.located_run_at=s.run_at
      where q.quest_id=s.quest_id and not private.city_quest_locked(h,q,p) and not private.city_quest_done(q,p))
    else false end
$$;

create function private.quest_record_catch(s private.quest_spawns)
returns void language plpgsql set search_path='' as $$
declare h public.hunts;
declare q private.city_hunt_located_quests;
declare w public.private_hunt_quests;
declare r private.quest_rules;
declare total int;
begin
  if s.context='private_hunt' then
    select * into w from public.private_hunt_quests where id=s.quest_id;
    select * into h from public.hunts where id=w.hunt_id for share;
    perform 1 from public.private_hunt_members where hunt_id=h.id and user_id=auth.uid() for update;
    if not private.quest_spawn_available(s) then return; end if;
    insert into public.private_hunt_quest_progress(hunt_id,quest_id,user_id,catch_count)
    values(h.id,w.id,auth.uid(),1)
    on conflict(quest_id,user_id) do update set catch_count=private_hunt_quest_progress.catch_count+1
    returning catch_count into total;
    if total>=w.catch_count then perform private.private_quest_finish(h,w,clock_timestamp()); end if;
  else
    select * into q from private.city_hunt_located_quests where quest_id=s.quest_id;
    perform 1 from public.city_hunt_quest_progress where hunt_id=q.hunt_id and user_id=auth.uid() for update;
    if not private.quest_spawn_available(s) then return; end if;
    select * into r from private.quest_rules where id=q.quest_id;
    update private.city_hunt_located_progress c set caught=c.caught+1,
      completed_at=case when c.caught+1>=r.catch_count then clock_timestamp() end
    where c.quest_id=q.quest_id and c.user_id=auth.uid() and c.run_at=s.run_at;
  end if;
end $$;

create function private.quest_record_landmark(p_post uuid,p_lat double precision,p_lng double precision)
returns void language plpgsql set search_path='' as $$
declare w public.private_hunt_quests;
declare q private.city_hunt_located_quests;
declare h public.hunts;
declare m public.private_hunt_members;
declare p public.city_hunt_quest_progress;
begin
  for w in select wp.* from public.private_hunt_quests wp join private.quest_rules r on r.id=wp.rule_id
    join public.private_hunt_members member on member.hunt_id=wp.hunt_id and member.user_id=auth.uid()
    where r.landmark_id=p_post order by wp.hunt_id,wp.ordinal
  loop
    select * into h from public.hunts where id=w.hunt_id and hidden_at is null for share;
    if not found then continue; end if;
    select * into m from public.private_hunt_members where hunt_id=h.id and user_id=auth.uid() for update;
    if not found or private.private_quest_is_locked(h,m,w.ordinal) or m.finished_at is not null
      or not private.quest_at_pin(private.private_quest_rule(w),p_lat,p_lng,1)
    then continue; end if;
    perform private.private_quest_finish(h,w,clock_timestamp());
  end loop;

  for q in select cq.* from private.city_hunt_located_quests cq join private.quest_rules r on r.id=cq.quest_id
    join public.city_hunt_quest_progress progress on progress.hunt_id=cq.hunt_id and progress.user_id=auth.uid()
    where r.landmark_id=p_post
  loop
    select * into h from public.hunts where id=q.hunt_id;
    select * into p from public.city_hunt_quest_progress where hunt_id=h.id and user_id=auth.uid() for update;
    if p.located_run_at is distinct from p.checked_in_at or private.city_quest_locked(h,q,p)
      or private.city_quest_done(q,p) then continue; end if;
    insert into private.city_hunt_located_progress(quest_id,user_id,run_at,completed_at)
    values(q.quest_id,auth.uid(),p.checked_in_at,clock_timestamp())
    on conflict(quest_id,user_id) do update set run_at=excluded.run_at,completed_at=excluded.completed_at;
  end loop;
end $$;

create function private.quest_spawn_markers(p_lat double precision,p_lng double precision,p_radius double precision)
returns jsonb language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'spawn_id','quest:'||s.id,'vessel',s.vessel,'rarity','common',
    'lat',s.location_lat,'lng',s.location_lng,'expires_at',s.expires_at,
    'attempts_left',cfg.max_attempts-coalesce(c.attempts,0),'already_caught',false,
    'quest_id',s.quest_id) order by s.quest_id,s.slot),'[]')
  from private.quest_spawns s cross join private.game_config cfg
  left join public.corrupted_catches c on c.user_id=s.user_id and c.spawn_id='quest:'||s.id
  where s.user_id=auth.uid() and cfg.singleton and private.quest_spawn_available(s)
    and public.distance_m(p_lat,p_lng,s.location_lat,s.location_lng)<=p_radius
    and coalesce(c.result,'pending')='pending' and coalesce(c.attempts,0)<cfg.max_attempts
$$;

create or replace function private.question_pool_uses(p_id uuid) returns jsonb
language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(value),'[]') from (
    select jsonb_build_object('context','city_puzzle','id',legacy_price_id) as value
    from private.question_pool where id=p_id and legacy_price_id is not null
    union all
    select jsonb_build_object('context','city_hunt','id',q.hunt_id,'quest_id',q.quest_id)
    from private.city_hunt_located_quests q join private.quest_rules r on r.id=q.quest_id where r.pool_id=p_id
    union all
    select jsonb_build_object('context','private_hunt','id',q.hunt_id,'quest_id',q.id)
    from public.private_hunt_quests q join private.quest_rules r on r.id=q.rule_id where r.pool_id=p_id
  ) uses
$$;

-- Quest definitions are snapshots. Remove unused snapshots when a private
-- organizer deletes a quest or its hunt.
create function private.delete_private_quest_rule() returns trigger
language plpgsql set search_path='' as $$
begin
  delete from private.quest_spawns where context='private_hunt' and quest_id=old.id;
  delete from private.quest_rules where id=old.rule_id;
  return null;
end $$;
create trigger delete_private_quest_rule after delete on public.private_hunt_quests
for each row execute function private.delete_private_quest_rule();

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
  return jsonb_build_object('spawns',result_spawns || private.quest_spawn_markers(p_lat,p_lng,cfg.action_radius_m),'wayposts',result_wayposts);
end $function$;

CREATE OR REPLACE FUNCTION public.corrupted_capsule_throw(p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision, p_ball text, p_ring double precision, p_hit boolean)
 RETURNS TABLE(result text, vessel text, copies integer, stars integer, is_new boolean, xp_gained integer, wax_balls integer, gold_balls integer, attempts_left integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pg public.player_game; cfg private.game_config; spot public.corrupted_spots;
  released record; caught public.corrupted_catches; wave bigint; current_wave bigint;
  chance double precision; did_catch boolean; quest_spawn private.quest_spawns;
begin
  if p_spawn is null or p_spawn !~
    '^(quest:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}:[0-9]{1,18})$'
    then raise exception 'expired'; end if;
  if p_ball is null or p_ball not in ('wax','gold') or p_ring is null or p_hit is null
    or p_ring::text in ('NaN','Infinity','-Infinity') then raise exception 'rejected'; end if;
  pg := private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  if p_spawn like 'quest:%' then
    select * into quest_spawn from private.quest_spawns where id=split_part(p_spawn,':',2)::uuid
      and user_id=auth.uid();
    if not found or not private.quest_spawn_available(quest_spawn) then raise exception 'expired'; end if;
    spot.lat:=quest_spawn.location_lat;
    spot.lng:=quest_spawn.location_lng;
    select quest_spawn.vessel as vessel, 'common'::text as rarity into released;
  else
    if p_spawn !~ '^[0-9a-f-]{36}:[0-9]{1,18}$' then raise exception 'expired'; end if;
    wave := split_part(p_spawn,':',2)::bigint;
    current_wave := (select w.wave from private.game_wave_at(now()) w);
    if wave not between current_wave-1 and current_wave then raise exception 'expired'; end if;
    select * into spot from public.corrupted_spots where id=split_part(p_spawn,':',1)::uuid and hidden_at is null for share;
    if spot.id is null then raise exception 'expired'; end if;
    select * into released from private.resolve_spawn(spot.id,wave);
    if released.spawn_id is null or released.spawn_id<>p_spawn or released.expires_at<=now()
      then raise exception 'expired'; end if;
  end if;
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
        if quest_spawn.id is not null then
          perform private.quest_record_catch(quest_spawn);
        else
          perform private.city_hunt_record_quest('restore',spot.id,p_lat,p_lng);
        end if;
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

CREATE OR REPLACE FUNCTION private.city_hunt_record_quest(p_kind text, p_id uuid, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hunts; p public.city_hunt_quest_progress; credited uuid;
begin
  if p_kind='landmark' then
    begin perform private.quest_record_landmark(p_id,p_lat,p_lng);
    exception when others then raise warning 'located Landmark progress failed: %', SQLSTATE; end;
  end if;
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
  if p.located_run_at=p.checked_in_at then
    if exists (select 1 from private.city_hunt_located_quests q
      where q.hunt_id=h.id and not private.city_quest_done(q,p))
    then raise exception 'hunt incomplete'; end if;
  elsif required_spin is null or required_restore is null or required_landmark is null
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


revoke all on function private.quest_json(uuid,int,private.quest_rules,int,boolean,boolean,int),
  private.quest_at_pin(private.quest_rules,double precision,double precision,double precision),
  private.quest_rule_from_pool(uuid,private.quest_type),
  private.quest_grade(private.quest_rules,jsonb,int,timestamptz,timestamptz),
  private.private_quest_rule(public.private_hunt_quests),
  private.private_quest_is_locked(public.hunts,public.private_hunt_members,int),
  private.quest_start_spawns(text,uuid,private.quest_rules,timestamptz,int,timestamptz),
  private.private_quest_finish(public.hunts,public.private_hunt_quests,timestamptz),
  private.city_quest_done(private.city_hunt_located_quests,public.city_hunt_quest_progress),
  private.city_quest_locked(public.hunts,private.city_hunt_located_quests,public.city_hunt_quest_progress),
  private.quest_spawn_available(private.quest_spawns),private.quest_record_catch(private.quest_spawns),
  private.quest_record_landmark(uuid,double precision,double precision),
  private.quest_spawn_markers(double precision,double precision,double precision),
  private.delete_private_quest_rule()
  from public,anon,authenticated,service_role;
revoke all on function public.private_hunt_quest_save(text,jsonb),public.private_hunt_quest_attempt(jsonb),
  public.city_hunt_quests(text),public.city_hunt_quest_attempt(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.private_hunt_quest_save(text,jsonb),public.private_hunt_quest_attempt(jsonb),
  public.city_hunt_quests(text),public.city_hunt_quest_attempt(jsonb) to authenticated;
