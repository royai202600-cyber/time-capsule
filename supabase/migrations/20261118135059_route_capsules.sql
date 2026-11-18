-- Share C3's rule snapshots and grading. Only counts belong on the visible capsule.
alter table public.capsules
  add column route_total integer not null default 0,
  add column route_done integer not null default 0,
  add constraint capsule_route_counts check (route_total between 0 and 5 and route_done between 0 and route_total);

create table private.capsule_route_stops (
  quest_id uuid primary key references private.quest_rules(id),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  ordinal integer not null check (ordinal between 1 and 5),
  tries integer not null default 0,
  wait_until timestamptz,
  caught integer not null default 0,
  activated_at timestamptz,
  completed_at timestamptz,
  unique(capsule_id,ordinal)
);
alter table private.capsule_route_stops enable row level security;
revoke all on private.capsule_route_stops from public,anon,authenticated,service_role;

alter table private.quest_spawns drop constraint quest_spawns_context_check,
  add constraint quest_spawns_context_check check (context in ('city_hunt','private_hunt','route'));

create function private.delete_capsule_route_stop() returns trigger
language plpgsql set search_path='' as $$
begin
  delete from private.quest_spawns where context='route' and quest_id=old.quest_id;
  delete from private.quest_rules where id=old.quest_id;
  return old;
end $$;
create trigger delete_capsule_route_stop after delete on private.capsule_route_stops
for each row execute function private.delete_capsule_route_stop();

create function private.route_pool_preview(p private.question_pool) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('pool_id',p.id,'type',p.type,'location_lat',p.location_lat,
    'location_lng',p.location_lng,'name_zh',p.place_zh,'name_en',p.place_en)
  || case when p.type='question' then jsonb_build_object('question',jsonb_strip_nulls(
    jsonb_build_object('kind',p.kind,'prompt_zh',p.prompt_zh,'prompt_en',p.prompt_en,'choices',p.choices)))
  else jsonb_build_object('price',jsonb_build_object('place_zh',p.place_zh,'place_en',p.place_en,
    'prompt_zh',p.prompt_zh,'prompt_en',p.prompt_en,'currency',p.currency,'rate',p.rate,'tries_left',3))
  end
$$;

create function public.route_pool_pick(p_city text,p_type text,p_lat double precision,
  p_lng double precision,p_exclude uuid[] default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  if p_type is null or p_type not in ('question','price')
    or not coalesce(p_lat between -90 and 90 and p_lng between -180 and 180,false)
  then raise exception 'bad_rule'; end if;
  return (select private.route_pool_preview(p)
    from private.question_pool p
    where p.city=p_city and p.type=p_type and p.status='published'
      and p.location_lat is not null and p.location_lng is not null
      and array_position(p_exclude,p.id) is null
      and public.distance_m(p_lat,p_lng,p.location_lat,p.location_lng)<=2000
    order by public.distance_m(p_lat,p_lng,p.location_lat,p.location_lng),p.id limit 1);
end $$;

create function public.route_templates(p_city text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  return (
    with city_landmark(city,place) as (values
      ('taipei','taipei101'),('hongkong','hkust'),('macau','senado'),('singapore','merlion')
    ), template(slot,name_zh,name_en) as (values
      (1,'地標漫步','Landmark Walk'),(2,'街角探索','Around the Corner'),(3,'城市小徑','City Trail')
    ), anchor as (
      select s.lat,s.lng from city_landmark c join public.public_capsule_spots s on s.place=c.place
      where c.city=p_city and s.kind='landmark' and s.hidden_at is null and s.game_enabled
      order by s.id limit 1
    ), places as (
      select distinct on (p.location_lat,p.location_lng) p as item,
        public.distance_m(a.lat,a.lng,p.location_lat,p.location_lng) as distance
      from private.question_pool p cross join anchor a
      where p.city=p_city and p.status='published'
        and p.location_lat is not null and p.location_lng is not null
        and public.distance_m(a.lat,a.lng,p.location_lat,p.location_lng)<=1500
      order by p.location_lat,p.location_lng,p.id
    ), ranked as (
      select item,row_number() over (order by distance,(item).id) as rank,count(*) over () as total
      from places
    ), routes as (
      select t.slot,t.name_zh,t.name_en,jsonb_agg(
        private.route_pool_preview(r.item) || jsonb_build_object('ordinal',s.ordinal)
        order by s.ordinal) as stops
      from template t cross join generate_series(1,3) s(ordinal)
      join ranked r on r.total>=3 and r.rank=1+mod((t.slot-1)*r.total/3+s.ordinal-1,r.total)
      group by t.slot,t.name_zh,t.name_en
    )
    select coalesce(jsonb_agg(jsonb_build_object('template_id',p_city||'-'||slot,
      'name_zh',name_zh,'name_en',name_en,'stops',stops) order by slot),'[]') from routes
  );
end $$;

-- Validate a route catch using the same wave and habitat rules used at activation.
create function private.quest_pin_pool(r private.quest_rules) returns private.game_spawn_pool
language plpgsql stable set search_path='' as $$
declare region private.game_regions;
declare habitat text;
declare wave record;
declare revision private.game_spawn_revisions;
declare pool private.game_spawn_pool;
begin
  select g.* into region from private.game_regions g
  join private.game_map_coverage b on b.id=g.coverage_id
  where g.city is not null and r.location_lat between b.south and b.north
    and r.location_lng between b.west and b.east
  order by public.distance_m(r.location_lat,r.location_lng,g.center_lat,g.center_lng),g.id
  limit 1;
  if not found then raise exception 'bad_rule'; end if;

  -- A nearby public spot supplies the habitat. A pin without a mapped
  -- habitat can use the city's rules that do not require one.
  select s.habitat into habitat from public.corrupted_spots s
  where s.city=region.city and s.hidden_at is null and s.source_ref not like 'qa:%'
    and s.lat between r.location_lat-0.01 and r.location_lat+0.01
    and public.distance_m(s.lat,s.lng,r.location_lat,r.location_lng) <=
      (select action_radius_m from private.game_config where singleton)
  order by public.distance_m(s.lat,s.lng,r.location_lat,r.location_lng),s.id limit 1;

  select * into wave from private.game_wave_at(now());
  revision:=private.game_spawn_at(wave.starts_at);
  pool:=private.game_spawn_pool(private.game_spawn_city_rules(revision,region.city),
    habitat,wave.starts_at at time zone region.timezone);
  if num_nonnulls(pool.common,pool.uncommon,pool.rare)=0 then raise exception 'bad_rule'; end if;
  return pool;
end $$;

create or replace function private.quest_start_spawns(p_context text,p_id uuid,r private.quest_rules,p_run timestamptz,
  p_remaining int,p_end timestamptz)
returns void language plpgsql set search_path='' as $$
declare wave record;
declare revision private.game_spawn_revisions;
declare pool private.game_spawn_pool;
declare seed_ids uuid[];
begin
  select * into wave from private.game_wave_at(now());
  revision:=private.game_spawn_at(wave.starts_at);
  pool:=private.quest_pin_pool(r);
  -- Quests guarantee their requested releases. The resolver still uses the
  -- wave's rarity weights, city assignments, windows and vessel selection.
  revision.config.spawn_chance:=1;
  select array_agg(gen_random_uuid() order by n) into seed_ids from generate_series(1,p_remaining) n;
  insert into private.quest_spawns
    (id,quest_id,context,user_id,run_at,slot,expires_at,location_lat,location_lng,vessel,rarity)
  select chosen.spot,p_id,p_context,auth.uid(),p_run,array_position(seed_ids,chosen.spot),
    least(p_end,now()+interval '10 minutes'),r.location_lat,r.location_lng,chosen.vessel,chosen.rarity
  from private.game_secret key
  cross join lateral private.resolve_spawn_batch(seed_ids,wave.wave,wave.ends_at,revision.config,pool,key.secret) chosen
  where key.singleton
  on conflict(context,quest_id,user_id,slot) do update set
    id=excluded.id,run_at=excluded.run_at,expires_at=excluded.expires_at,
    vessel=excluded.vessel,rarity=excluded.rarity
  where quest_spawns.run_at<>excluded.run_at or quest_spawns.expires_at<=now()
    or exists (select 1 from public.corrupted_catches c where c.user_id=auth.uid()
      and c.spawn_id='quest:'||quest_spawns.id and c.result in ('caught','failed'));
end $$;

create function private.capsule_route_rule(stop jsonb) returns private.quest_rules
language plpgsql stable set search_path='' as $$
declare
  rule private.quest_rules;
  post public.public_capsule_spots;
  prompt text := btrim(stop->>'own_question');
  answer text := btrim(stop->>'own_answer');
  place_name text := btrim(stop->>'name');
begin
  if jsonb_typeof(stop) is distinct from 'object' or stop->>'type' is null then
    raise exception 'bad_rule';
  end if;
  rule.type := (stop->>'type')::private.quest_type;
  if stop->>'pool_id' is not null then
    if rule.type not in ('question','price') or prompt is not null or answer is not null then
      raise exception 'bad_rule';
    end if;
    return private.quest_rule_from_pool((stop->>'pool_id')::uuid,rule.type);
  end if;

  rule.location_lat := (stop->>'location_lat')::double precision;
  rule.location_lng := (stop->>'location_lng')::double precision;
  if not coalesce(rule.location_lat between -90 and 90 and rule.location_lng between -180 and 180,false)
    or rule.type='price'
  then raise exception 'bad_rule'; end if;
  if not coalesce(char_length(place_name) between 1 and 200,false) then raise exception 'rejected'; end if;
  rule.name_zh := place_name;
  rule.name_en := place_name;
  if rule.type='question' then
    if char_length(stop->>'own_question')>280 or char_length(stop->>'own_answer')>120
      or jsonb_typeof(stop->'own_question') is distinct from 'string' or prompt=''
    then raise exception 'rejected'; end if;
    if nullif(private.private_hunt_normalize_answer(answer),'') is null then raise exception 'no_answer'; end if;
    if jsonb_typeof(stop->'own_answer') is distinct from 'string' then raise exception 'rejected'; end if;
    if not private.text_allowed(prompt) then raise exception 'blocked_words'; end if;
    rule.question := jsonb_build_object('kind','text','prompt_zh',prompt,'prompt_en',prompt);
    rule.correct_answer := jsonb_build_object('text',answer);
  elsif prompt is not null or answer is not null then
    raise exception 'bad_rule';
  elsif rule.type='catch' then
    rule.catch_count := (stop->>'catch_count')::integer;
    if not coalesce(rule.catch_count between 1 and 5,false) then raise exception 'bad_rule'; end if;
    perform private.quest_pin_pool(rule);
  elsif rule.type='landmark' then
    select * into post from public.public_capsule_spots s
    where s.kind='landmark' and s.game_enabled and s.hidden_at is null
      and public.distance_m(s.lat,s.lng,rule.location_lat,rule.location_lng)<=2000
    order by public.distance_m(s.lat,s.lng,rule.location_lat,rule.location_lng),s.id limit 1;
    if not found then raise exception 'bad_rule'; end if;
    rule.landmark_id := post.id;
    rule.location_lat := post.lat;
    rule.location_lng := post.lng;
  end if;
  return rule;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'bad_rule';
end $$;

-- Preserve the C2 send path and its attachment and inventory checks. Replacing the
-- original public signature avoids ambiguity for old clients that omit optional args.
alter function public.send_capsule(uuid,text,text,text,timestamptz,text,text,text,text,integer,text,text)
  set schema private;
revoke all on function private.send_capsule(uuid,text,text,text,timestamptz,text,text,text,text,integer,text,text)
  from public,anon,authenticated,service_role;

create function public.send_capsule(
  p_recipient uuid,p_vessel text,p_message text,p_hint text,p_open_at timestamptz,
  p_place text default null,p_drawing text default null,p_photo text default null,
  p_voice text default null,p_voice_ms integer default null,p_kind text default 'letter',
  p_prediction text default null,p_route jsonb default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  capsule uuid;
  stop jsonb;
  rule private.quest_rules;
  step integer := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_route is not null then
    if p_place is not null or p_recipient is null or jsonb_typeof(p_route)<>'array' then
      raise exception 'bad_rule';
    end if;
    if jsonb_array_length(p_route) not between 1 and 5 then raise exception 'bad_rule'; end if;
  end if;

  capsule := private.send_capsule(p_recipient,p_vessel,p_message,p_hint,p_open_at,p_place,
    p_drawing,p_photo,p_voice,p_voice_ms,p_kind,p_prediction);
  if p_route is null then return capsule; end if;

  -- A rejected stop rolls back the send, including any consumed vessel copy.
  for stop in select value from jsonb_array_elements(p_route) loop
    rule := private.capsule_route_rule(stop);
    rule.id := gen_random_uuid();
    insert into private.quest_rules select (rule).*;
    step := step+1;
    insert into private.capsule_route_stops(quest_id,capsule_id,ordinal) values(rule.id,capsule,step);
  end loop;
  update public.capsules set route_total=step where id=capsule;
  return capsule;
end $$;

create function public.route_progress(p_capsule uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare capsule public.capsules;
begin
  select * into capsule from public.capsules where id=p_capsule and recipient=auth.uid();
  if not found then raise exception 'capsule not found'; end if;
  return (select coalesce(jsonb_agg(
      private.quest_json(s.quest_id,s.ordinal,r,0,s.completed_at is not null,
        s.ordinal>capsule.route_done+1,s.tries)
      order by s.ordinal),'[]')
    from private.capsule_route_stops s join private.quest_rules r on r.id=s.quest_id
    where s.capsule_id=capsule.id);
end $$;

create function private.complete_capsule_route_stop(stop private.capsule_route_stops) returns void
language plpgsql set search_path='' as $$
begin
  -- Every caller holds the capsule row lock and has checked the stop's order.
  update private.capsule_route_stops set completed_at=clock_timestamp()
    where quest_id=stop.quest_id and completed_at is null;
  if found then update public.capsules set route_done=route_done+1 where id=stop.capsule_id; end if;
end $$;

create function public.route_attempt(p_capsule uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  capsule public.capsules;
  stop private.capsule_route_stops;
  rule private.quest_rules;
  result jsonb;
begin
  select * into capsule from public.capsules where id=p_capsule and recipient=auth.uid() for update;
  if not found then raise exception 'capsule not found'; end if;
  select * into stop from private.capsule_route_stops
    where capsule_id=capsule.id and quest_id=(p_payload->>'quest_id')::uuid;
  if not found then raise exception 'bad_rule'; end if;
  if stop.completed_at is not null then raise exception 'already_done'; end if;
  if stop.ordinal<>capsule.route_done+1 then raise exception 'locked'; end if;

  select * into strict rule from private.quest_rules where id=stop.quest_id;
  if not private.quest_at_pin(rule,(p_payload->>'lat')::double precision,
    (p_payload->>'lng')::double precision,(p_payload->>'accuracy')::double precision)
  then raise exception 'too_far'; end if;

  result := private.quest_grade(rule,p_payload->'answer',stop.tries,stop.wait_until,clock_timestamp());
  if rule.type='catch' then
    perform private.quest_start_spawns('route',stop.quest_id,rule,capsule.sealed_at,
      rule.catch_count-stop.caught,'infinity');
  elsif rule.type='landmark' then
    update private.capsule_route_stops set activated_at=coalesce(activated_at,clock_timestamp())
      where quest_id=stop.quest_id;
  elsif rule.type in ('question','price') then
    update private.capsule_route_stops set tries=3-(result->>'tries_left')::int,
      wait_until=case when rule.type='question' and not (result->>'done')::boolean
        and (result->>'tries_left')::int=0 then clock_timestamp()+interval '60 seconds' end
      where quest_id=stop.quest_id;
  end if;
  if (result->>'done')::boolean then perform private.complete_capsule_route_stop(stop); end if;
  return result;
end $$;

create or replace function private.quest_spawn_available(s private.quest_spawns)
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
    when 'route' then exists(
      select 1 from private.capsule_route_stops stop
      join public.capsules capsule on capsule.id=stop.capsule_id
      where stop.quest_id=s.quest_id and capsule.recipient=auth.uid() and capsule.sealed_at=s.run_at
        and stop.ordinal=capsule.route_done+1 and stop.completed_at is null)
    else false end
$$;

create or replace function private.quest_record_catch(s private.quest_spawns)
returns void language plpgsql set search_path='' as $$
declare h public.hunts;
declare q private.city_hunt_located_quests;
declare w public.private_hunt_quests;
declare r private.quest_rules;
declare total int;
declare route_stop private.capsule_route_stops;
begin
  if s.context='route' then
    select * into route_stop from private.capsule_route_stops where quest_id=s.quest_id;
    perform 1 from public.capsules where id=route_stop.capsule_id and recipient=auth.uid() for update;
    if not private.quest_spawn_available(s) then return; end if;
    select * into strict r from private.quest_rules where id=s.quest_id;
    update private.capsule_route_stops set caught=caught+1 where quest_id=s.quest_id returning caught into total;
    if total>=r.catch_count then perform private.complete_capsule_route_stop(route_stop); end if;
  elsif s.context='private_hunt' then
    select * into w from public.private_hunt_quests where id=s.quest_id;
    select * into h from public.hunts where id=w.hunt_id for share;
    perform 1 from public.private_hunt_members where hunt_id=h.id and user_id=auth.uid() for update;
    if not private.quest_spawn_available(s) then return; end if;
    insert into public.private_hunt_quest_progress(hunt_id,quest_id,user_id,catch_count)
    values(h.id,w.id,auth.uid(),1)
    on conflict(quest_id,user_id) do update set catch_count=private_hunt_quest_progress.catch_count+1
    returning catch_count into total;
    if total>=w.catch_count then perform private.private_quest_finish(h,w,clock_timestamp(),w.points,0); end if;
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

create or replace function private.quest_record_landmark(p_post uuid,p_lat double precision,p_lng double precision)
returns void language plpgsql set search_path='' as $$
declare w public.private_hunt_quests;
declare q private.city_hunt_located_quests;
declare h public.hunts;
declare m public.private_hunt_members;
declare p public.city_hunt_quest_progress;
declare route_stop private.capsule_route_stops;
declare sealed public.capsules;
declare route_rule private.quest_rules;
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
    perform private.private_quest_finish(h,w,clock_timestamp(),w.points,0);
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

  for route_stop in
    select s.* from private.capsule_route_stops s
    join private.quest_rules r on r.id=s.quest_id
    join public.capsules c on c.id=s.capsule_id
    where c.recipient=auth.uid() and r.landmark_id=p_post
      and s.ordinal=c.route_done+1 and s.activated_at is not null and s.completed_at is null
    order by c.id
  loop
    select * into sealed from public.capsules where id=route_stop.capsule_id and recipient=auth.uid() for update;
    if not found or route_stop.ordinal<>sealed.route_done+1 then continue; end if;
    select * into strict route_rule from private.quest_rules where id=route_stop.quest_id;
    if private.quest_at_pin(route_rule,p_lat,p_lng,1) then
      perform private.complete_capsule_route_stop(route_stop);
    end if;
  end loop;
end $$;


create or replace function public.open_capsule(p_id uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_accuracy double precision DEFAULT NULL::double precision)
 returns table(message text, drawing text, photo text, opened_at timestamptz, gift_code text, voice_path text, voice_ms integer, prediction text, verdict boolean)
 language plpgsql security definer set search_path = '' as $function$
declare c public.capsules; pl public.places; d double precision; g text;
  cfg private.game_config; waited_days integer;
begin
  select * into c from public.capsules
    where id = p_id and recipient = auth.uid() for update;
  if c.id is null then raise exception 'capsule not found'; end if;
  if c.opened_at is null then
    if c.open_at > now() then raise exception 'not yet' using hint = 'locked'; end if;
    if c.route_done <> c.route_total then raise exception 'route incomplete' using hint = 'route_locked'; end if;
    if c.place is not null or c.place_lat is not null then
      if c.place is not null then
        select * into strict pl from public.places where id = c.place;
      end if;
      if p_lat is null or p_lng is null then raise exception 'location needed' using hint = 'no_location'; end if;
      if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
        raise exception 'invalid location' using hint = 'no_location';
      end if;
      if p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200 then
        raise exception 'location not accurate enough' using hint = 'inaccurate';
      end if;
      d := public.distance_m(p_lat, p_lng, coalesce(c.place_lat, pl.lat), coalesce(c.place_lng, pl.lng));
      if d > coalesce(pl.radius_m, 100) then raise exception 'too far: % m', round(d) using hint = 'far'; end if;
      if pl.brand_vessel is not null and pl.brand_vessel = c.vessel then
        g := 'AUR-' || lpad(coalesce(c.edition_no, 0)::text, 3, '0') || '-' || upper(substr(md5(random()::text || c.id::text), 1, 4));
      end if;
    end if;
    update public.capsules
      set opened_at = now(), seen_at = coalesce(seen_at, now()),
          opened_lat = p_lat, opened_lng = p_lng,
          opened_distance_m = case when d is null then null else round(d) end,
          gift_code = g
      where id = p_id
      returning * into c;
    if c.place is not null then
      insert into public.owned_vessels (user_id, vessel, copies)
        select c.recipient, v.id, null::integer from public.vessels v where v.earned_place = c.place
        on conflict (user_id, vessel) do nothing;
    end if;
    begin
      if c.place is not null then
      insert into public.passport_stamps(user_id,place,first_at,how_earned)
        values(c.recipient,c.place,c.opened_at,'capsule')
        on conflict (user_id,place) do nothing;
      end if;
    select * into cfg from private.game_config where singleton;
    waited_days:=least(cfg.xp_open_day_cap,
      floor(extract(epoch from c.opened_at-c.sealed_at)/86400)::integer);
    if waited_days>=cfg.xp_open_min_days then
      perform private.ensure_player(c.recipient);
      perform private.award_xp(c.recipient,'capsule_open',c.id::text,
        cfg.xp_open_base+cfg.xp_open_per_day*waited_days);
    end if;
    exception when others then
      raise warning 'Time Capsule game rewards failed for capsule %: %',c.id,sqlerrm;
    end;
  end if;
  return query select cc.message, cc.drawing, cc.photo, c.opened_at, c.gift_code, cc.voice_path, cc.voice_ms, cc.prediction, c.verdict
    from public.capsule_contents cc where cc.capsule_id = p_id;
end $function$;

revoke all on function private.delete_capsule_route_stop(),private.route_pool_preview(private.question_pool),
  private.quest_pin_pool(private.quest_rules),private.capsule_route_rule(jsonb),
  private.complete_capsule_route_stop(private.capsule_route_stops)
  from public,anon,authenticated,service_role;

revoke all on function public.route_templates(text),public.route_pool_pick(text,text,double precision,double precision,uuid[]),
  public.route_progress(uuid),public.route_attempt(uuid,jsonb),
  public.send_capsule(uuid,text,text,text,timestamptz,text,text,text,text,integer,text,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.route_templates(text),public.route_pool_pick(text,text,double precision,double precision,uuid[]),
  public.route_progress(uuid),public.route_attempt(uuid,jsonb),
  public.send_capsule(uuid,text,text,text,timestamptz,text,text,text,text,integer,text,text,jsonb)
  to authenticated;
