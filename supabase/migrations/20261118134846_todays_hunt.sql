create table private.todays_hunt_schedule (
  city text not null,
  hunt_date date not null,
  ordinal integer not null check (ordinal between 1 and 3),
  quest_id uuid not null unique references private.quest_rules(id),
  primary key (city, hunt_date, ordinal)
);

create table private.todays_hunt_plays (
  user_id uuid not null references public.profiles(id) on delete cascade,
  city text not null,
  hunt_date date not null,
  results jsonb not null default '{}',
  score integer not null default 0 check (score between 0 and 30),
  finished boolean not null default false,
  streak integer not null default 0,
  primary key (user_id, city, hunt_date)
);

alter table private.todays_hunt_schedule enable row level security;
alter table private.todays_hunt_plays enable row level security;
revoke all on private.todays_hunt_schedule, private.todays_hunt_plays from public, anon, authenticated, service_role;

create function private.todays_hunt_date(p_city text, p_at timestamptz)
returns date language plpgsql stable set search_path = '' as $$
declare zone text;
begin
  select timezone into zone from private.game_regions
  where id = case p_city when 'hongkong' then 'hong-kong' else p_city end
    and p_city in ('taipei', 'hongkong', 'macau', 'singapore');
  if zone is null then raise exception 'bad_city'; end if;
  return (p_at at time zone zone)::date;
end $$;

create function private.todays_hunt_center(p_city text)
returns table(lat double precision, lng double precision)
language sql stable set search_path = '' as $$
  select s.lat,s.lng
  from public.public_capsule_spots s
  where s.place = case p_city when 'taipei' then 'taipei101' when 'hongkong' then 'hkust'
    when 'macau' then 'senado' when 'singapore' then 'merlion' end
    and s.kind = 'landmark' and s.game_enabled and s.hidden_at is null
  order by s.id limit 1
$$;

create function private.todays_hunt_pool(p_city text)
returns setof private.question_pool language sql stable set search_path = '' as $$
  select p.* from private.question_pool p
  join private.question_pool_secrets s on s.id = p.id
  cross join private.todays_hunt_center(p_city) c
  where p.city = p_city and p.status = 'published'
    and p.location_lat is not null and p.location_lng is not null
    and public.distance_m(c.lat,c.lng,p.location_lat,p.location_lng) <= 1500
    and ((p.type = 'question' and p.kind = 'choice' and jsonb_typeof(s.answer) = 'number')
         or (p.type = 'price' and s.usd > 0 and s.local_amount > 0))
$$;

create function private.todays_hunt_lock(p_city text)
returns void language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('todays-hunt-schedule:' || p_city,0))
$$;

-- Share a date lock with players so a calendar edit in flight across midnight
-- cannot change a schedule that a player has already read or attempted.
create function private.todays_hunt_date_key(p_city text,p_date date)
returns bigint language sql immutable set search_path = '' as $$
  select hashtextextended('todays-hunt-date:' || p_city || ':' || (p_date-date '2000-01-01'),0)
$$;

-- Return a calendar reason instead of creating a partial automatic schedule.
-- Existing future bookings also reserve their 30-day window if filled out of order.
create function private.todays_hunt_fill(p_city text, p_date date)
returns text language plpgsql set search_path = '' as $$
declare
  rules private.quest_rules[] := '{}';
  rule private.quest_rules;
  quest_type private.quest_type;
  pos integer;
  pick uuid;
  pin public.public_capsule_spots;
begin
  if not exists (select 1 from private.todays_hunt_center(p_city)) then
    return 'missing_landmark';
  end if;
  if (select count(*) from private.todays_hunt_schedule where city=p_city and hunt_date=p_date) = 3 then
    return null;
  end if;
  perform private.todays_hunt_lock(p_city);
  for pos in 1..3 loop
    if exists (select 1 from private.todays_hunt_schedule
               where city=p_city and hunt_date=p_date and ordinal=pos) then
      continue;
    end if;
    quest_type := (array['question','price','catch']::private.quest_type[])[pos];
    if quest_type = 'catch' then
      select w.* into pin from public.public_capsule_spots w
      cross join private.todays_hunt_center(p_city) c
      where w.kind='common' and w.game_enabled and w.hidden_at is null
        and public.distance_m(c.lat,c.lng,w.lat,w.lng) <= 1500
      order by md5(p_city || ':' || (p_date - date '2000-01-01') || ':' || w.id), w.id
      limit 1;
      if not found then return 'missing_catch_pin'; end if;
      rule := null;
      rule.type := 'catch';
      rule.location_lat := pin.lat;
      rule.location_lng := pin.lng;
      rule.name_zh := pin.name_zh;
      rule.name_en := pin.name_en;
      rule.catch_count := 3;
    else
      select p.id into pick from private.todays_hunt_pool(p_city) p
      where p.type=quest_type::text and not exists (
        select 1 from private.todays_hunt_schedule d join private.quest_rules r on r.id=d.quest_id
        where d.city=p_city and d.hunt_date between p_date-30 and p_date+30 and r.pool_id=p.id
      )
      order by md5(p_city || ':' || (p_date - date '2000-01-01') || ':' ||
        coalesce(p.legacy_price_id::text,p.id::text)), p.id
      limit 1;
      if not found then
        if exists (select 1 from private.todays_hunt_pool(p_city) p where p.type=quest_type::text) then
          return 'recent_' || quest_type::text;
        end if;
        return 'missing_' || quest_type::text;
      end if;
      rule := private.quest_rule_from_pool(pick,quest_type);
    end if;
    rules[pos] := rule;
  end loop;
  for pos in 1..3 loop
    rule := rules[pos];
    if rule.type is null then continue; end if;
    rule.id := gen_random_uuid();
    insert into private.quest_rules select rule.*;
    insert into private.todays_hunt_schedule values (p_city,p_date,pos,rule.id);
  end loop;
  return null;
end $$;

create function private.todays_hunt_streak(p_user uuid, p_city text, p_date date)
returns integer language sql stable set search_path = '' as $$
  select coalesce((
    select streak from private.todays_hunt_plays
    where user_id=p_user and city=p_city and hunt_date in (p_date,p_date-1) and finished
    order by hunt_date desc limit 1
  ),0)
$$;

create function public.todays_hunt(p_city text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player uuid := auth.uid();
  local_day date;
  play private.todays_hunt_plays;
  quests jsonb;
begin
  if player is null then raise exception 'not authenticated'; end if;
  local_day := private.todays_hunt_date(p_city,statement_timestamp());
  perform pg_advisory_xact_lock_shared(private.todays_hunt_date_key(p_city,local_day));
  if private.todays_hunt_fill(p_city,local_day) is not null then raise exception 'hunt_unavailable'; end if;
  select * into play from private.todays_hunt_plays
  where user_id=player and city=p_city and hunt_date=local_day;
  select jsonb_agg(
    private.quest_json(q.quest_id,q.ordinal,r,coalesce((res.value->>'points')::int,0),
      coalesce((res.value->>'done')::boolean,false),false,
      3-coalesce((res.value->>'tries_left')::int,3))
    || jsonb_build_object('color','blue')
    || case when (res.value->>'done')::boolean and res.value ? 'correct_answer'
      then jsonb_build_object('correct_answer',res.value->'correct_answer') else '{}' end
    order by q.ordinal
  ) into quests
  from private.todays_hunt_schedule q join private.quest_rules r on r.id=q.quest_id
  cross join lateral (select play.results->(q.ordinal::text) as value) res
  where q.city=p_city and q.hunt_date=local_day;
  return jsonb_build_object('date',local_day,'quests',quests,'score',coalesce(play.score,0),
    'finished',coalesce(play.finished,false),'streak',private.todays_hunt_streak(player,p_city,local_day));
end $$;

create function public.todays_hunt_attempt(p_city text, p_ordinal integer, p_answer jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player uuid := auth.uid();
  local_day date;
  rule private.quest_rules;
  play private.todays_hunt_plays;
  result jsonb;
  ordinal_key text := p_ordinal::text;
  caught numeric;
  finished_now boolean;
  awarded_points integer;
begin
  if player is null then raise exception 'not authenticated'; end if;
  perform private.todays_hunt_date(p_city,statement_timestamp());
  if p_ordinal is null or p_ordinal not between 1 and 3 then raise exception 'bad_ordinal'; end if;
  -- Serialize across ordinals and across midnight for this player and city.
  perform pg_advisory_xact_lock(hashtextextended('todays-hunt-player:' || player || ':' || p_city,0));
  local_day := private.todays_hunt_date(p_city,clock_timestamp());
  perform pg_advisory_xact_lock_shared(private.todays_hunt_date_key(p_city,local_day));
  if private.todays_hunt_fill(p_city,local_day) is not null then raise exception 'hunt_unavailable'; end if;
  select * into play from private.todays_hunt_plays
  where user_id=player and city=p_city and hunt_date=local_day;
  if (play.results->ordinal_key->>'done')::boolean then raise exception 'already_done'; end if;
  if jsonb_typeof(p_answer) is distinct from 'object' then raise exception 'bad_answer'; end if;
  select r.* into strict rule from private.todays_hunt_schedule q
  join private.quest_rules r on r.id=q.quest_id
  where q.city=p_city and q.hunt_date=local_day and q.ordinal=p_ordinal;

  if rule.type = 'catch' then
    if jsonb_typeof(p_answer->'caught') is distinct from 'number' then raise exception 'bad_answer'; end if;
    caught := (p_answer->>'caught')::numeric;
    if caught < 0 or caught <> trunc(caught) then raise exception 'bad_answer'; end if;
    caught := least(caught,rule.catch_count);
    result := jsonb_build_object('ok',caught=rule.catch_count,'done',true);
  else
    result := private.quest_grade(rule,p_answer,
      3-coalesce((play.results->ordinal_key->>'tries_left')::int,3),null,statement_timestamp());
    if rule.type = 'question' then
      result := (result-'tries_left') || jsonb_build_object('done',true,'correct_answer',rule.correct_answer);
    end if;
  end if;
  awarded_points := case when not (result->>'done')::boolean then 0
    when (result->>'ok')::boolean then 10 else 2 end;
  result := result || jsonb_build_object('points',awarded_points);
  play.results := coalesce(play.results,'{}') || jsonb_build_object(ordinal_key,result);
  select count(*) = 3 into finished_now from jsonb_each(play.results) where (value->>'done')::boolean;
  insert into private.todays_hunt_plays(user_id,city,hunt_date,results,score,finished,streak)
  values (player,p_city,local_day,play.results,coalesce(play.score,0)+awarded_points,finished_now,
    case when finished_now then private.todays_hunt_streak(player,p_city,local_day)+1 else 0 end)
  on conflict (user_id,city,hunt_date) do update set
    (results,score,finished,streak) = (excluded.results,excluded.score,excluded.finished,excluded.streak);
  if finished_now then
    perform private.ensure_player(player);
    update public.player_game set wax_balls=wax_balls+3 where user_id=player;
  end if;
  return result;
end $$;

create function public.todays_hunt_friends(p_city text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  player uuid := auth.uid();
  local_day date;
begin
  if player is null then raise exception 'not authenticated'; end if;
  local_day := private.todays_hunt_date(p_city,statement_timestamp());
  if not exists (select 1 from private.todays_hunt_center(p_city)) then
    raise exception 'hunt_unavailable';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('user',private.admin_person(people.id),
      'score',coalesce(p.score,0),'finished',coalesce(p.finished,false),
      'streak',private.todays_hunt_streak(people.id,p_city,local_day))
      order by (people.id=player) desc, p.score desc nulls last, people.id),'[]')
    from (select player as id union all select friend_id from public.friendships where user_id=player) people
    left join private.todays_hunt_plays p on p.user_id=people.id and p.city=p_city and p.hunt_date=local_day
    where people.id=player or p.user_id is not null
  );
end $$;

create function private.todays_hunt_admin_day(p_city text, p_date date, p_started boolean, p_reason text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('date',p_date,'started',p_started,'unavailable_reason',p_reason,
    'quests',coalesce(jsonb_agg(
      private.quest_json(q.quest_id,q.ordinal,r,0,false,false,0)
      || jsonb_build_object('color','blue','pool_id',r.pool_id,'correct_answer',r.correct_answer)
      order by q.ordinal),'[]'))
  from private.todays_hunt_schedule q join private.quest_rules r on r.id=q.quest_id
  where q.city=p_city and q.hunt_date=p_date
$$;

create function public.admin_todays_hunt_calendar(p_city text, p_from date, p_days integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  today date;
  day date;
  day_reason text;
  days jsonb := '[]';
begin
  perform private.require_game_editor();
  today := private.todays_hunt_date(p_city,statement_timestamp());
  if p_from is null or not isfinite(p_from) or p_days is null or p_days not between 1 and 31 then
    raise exception 'bad_range';
  end if;
  -- Browsing future dates should not reserve today's pool items before today's hunt.
  if p_from > today then perform private.todays_hunt_fill(p_city,today); end if;
  for offset_days in 0..p_days-1 loop
    day := p_from + offset_days;
    if day >= today then
      day_reason := private.todays_hunt_fill(p_city,day);
    else
      day_reason := case when (select count(*) from private.todays_hunt_schedule
        where city=p_city and hunt_date=day) < 3 then 'not_scheduled' end;
    end if;
    days := days || jsonb_build_array(private.todays_hunt_admin_day(p_city,day,day<=today,day_reason));
  end loop;
  return days;
end $$;

create function private.todays_hunt_lock_future(p_city text,p_date date)
returns void language plpgsql set search_path = '' as $$
begin
  perform private.todays_hunt_date(p_city,statement_timestamp());
  if p_date is null or not isfinite(p_date) then raise exception 'bad_range'; end if;
  perform pg_advisory_xact_lock(private.todays_hunt_date_key(p_city,p_date));
  perform private.todays_hunt_lock(p_city);
  if p_date <= private.todays_hunt_date(p_city,clock_timestamp()) then raise exception 'day_started'; end if;
  if not exists (select 1 from private.todays_hunt_center(p_city)) then
    raise exception 'hunt_unavailable';
  end if;
end $$;

-- Audit only the slot references. The answers stay in private quest rules.
create function private.todays_hunt_slots(p_city text,p_date date,p_ordinals integer[])
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_object_agg(o.ordinal,q.quest_id)
  from unnest(p_ordinals) as o(ordinal)
  left join private.todays_hunt_schedule q
    on q.city=p_city and q.hunt_date=p_date and q.ordinal=o.ordinal
$$;

create function private.todays_hunt_write_slots(p_city text,p_date date,p_slots jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  delete from private.todays_hunt_schedule
  where city=p_city and hunt_date=p_date and p_slots ? ordinal::text;
  insert into private.todays_hunt_schedule(city,hunt_date,ordinal,quest_id)
  select p_city,p_date,key::int,value::uuid from jsonb_each_text(p_slots) where value is not null;
end $$;

create function public.admin_todays_hunt_set(
  p_city text, p_date date, p_ordinal integer, p_pool_id uuid default null,
  p_location_lat double precision default null, p_location_lng double precision default null,
  p_catch_count integer default 3, p_name_zh text default null, p_name_en text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  rule private.quest_rules;
  quest_type private.quest_type;
  old_slots jsonb;
  new_slots jsonb;
begin
  perform private.require_game_editor();
  perform private.todays_hunt_lock_future(p_city,p_date);
  if p_ordinal is null or p_ordinal not between 1 and 3 then raise exception 'bad_ordinal'; end if;
  select r.type into quest_type from private.todays_hunt_schedule q
  join private.quest_rules r on r.id=q.quest_id
  where q.city=p_city and q.hunt_date=p_date and q.ordinal=p_ordinal;
  quest_type := coalesce(quest_type,(array['question','price','catch']::private.quest_type[])[p_ordinal]);
  if quest_type = 'catch' then
    if p_pool_id is not null or p_catch_count is null or p_catch_count not between 1 and 5
      or not exists (select 1 from private.todays_hunt_center(p_city) c
        where p_location_lat between -90 and 90 and p_location_lng between -180 and 180
          and public.distance_m(c.lat,c.lng,p_location_lat,p_location_lng) <= 1500)
      or (p_name_zh is not null and (length(btrim(p_name_zh)) not between 1 and 120 or not private.text_allowed(p_name_zh)))
      or (p_name_en is not null and (length(btrim(p_name_en)) not between 1 and 120 or not private.text_allowed(p_name_en)))
    then raise exception 'bad_rule'; end if;
    rule.type := 'catch';
    rule.location_lat := p_location_lat;
    rule.location_lng := p_location_lng;
    rule.catch_count := p_catch_count;
    rule.name_zh := coalesce(btrim(p_name_zh),'捕捉破損膠囊');
    rule.name_en := coalesce(btrim(p_name_en),'Catch Corrupted Capsules');
  else
    if p_location_lat is not null or p_location_lng is not null or p_name_zh is not null or p_name_en is not null
      or not exists (select 1 from private.todays_hunt_pool(p_city) p where p.id=p_pool_id and p.type=quest_type::text)
    then raise exception 'bad_rule'; end if;
    rule := private.quest_rule_from_pool(p_pool_id,quest_type);
  end if;
  rule.id := gen_random_uuid();
  insert into private.quest_rules select rule.*;
  old_slots := private.todays_hunt_slots(p_city,p_date,array[p_ordinal]);
  new_slots := jsonb_build_object(p_ordinal::text,rule.id);
  perform private.todays_hunt_write_slots(p_city,p_date,new_slots);
  perform private.admin_log('todays_hunt.set','todays_hunt',p_city || '/' || to_char(p_date,'YYYY-MM-DD'),
    p_city || ' ' || to_char(p_date,'YYYY-MM-DD'),old_slots,new_slots);
  return private.todays_hunt_admin_day(p_city,p_date,false,null);
end $$;

create function public.admin_todays_hunt_swap(p_city text,p_date date,p_a integer,p_b integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare old_slots jsonb;
declare new_slots jsonb;
begin
  perform private.require_game_editor();
  perform private.todays_hunt_lock_future(p_city,p_date);
  if p_a is null or p_b is null or p_a not between 1 and 3 or p_b not between 1 and 3 or p_a=p_b then
    raise exception 'bad_ordinal';
  end if;
  old_slots := private.todays_hunt_slots(p_city,p_date,array[p_a,p_b]);
  if old_slots->>p_a::text is null or old_slots->>p_b::text is null then raise exception 'bad_rule'; end if;
  new_slots := jsonb_build_object(p_a::text,old_slots->p_b::text,p_b::text,old_slots->p_a::text);
  perform private.todays_hunt_write_slots(p_city,p_date,new_slots);
  perform private.admin_log('todays_hunt.swap','todays_hunt',p_city || '/' || to_char(p_date,'YYYY-MM-DD'),
    p_city || ' ' || to_char(p_date,'YYYY-MM-DD'),old_slots,new_slots);
  return private.todays_hunt_admin_day(p_city,p_date,false,null);
end $$;

alter function public.admin_undo(bigint,text) rename to admin_undo_before_todays_hunt;
alter function public.admin_undo_before_todays_hunt(bigint,text) set schema private;
revoke all on function private.admin_undo_before_todays_hunt(bigint,text) from public, anon, authenticated, service_role;

create function public.admin_undo(p_action_id bigint,p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event private.admin_actions;
  city text;
  day date;
  ordinals integer[];
begin
  select * into event from private.admin_actions where id=p_action_id;
  if event.target_type is distinct from 'todays_hunt' then
    return private.admin_undo_before_todays_hunt(p_action_id,p_note);
  end if;
  perform private.require_game_editor();
  if event.action not in ('todays_hunt.set','todays_hunt.swap') then raise exception 'not_undoable'; end if;
  city := split_part(event.target_id,'/',1);
  day := split_part(event.target_id,'/',2)::date;
  perform private.todays_hunt_lock_future(city,day);
  select array_agg(key::int) into ordinals from jsonb_object_keys(event.after) as keys(key);
  if private.todays_hunt_slots(city,day,ordinals) is distinct from event.after
    or exists (select 1 from private.admin_actions a where a.target_type='todays_hunt'
      and a.target_id=event.target_id and a.after->>'undo_of'=event.id::text)
  then raise exception 'stale'; end if;
  perform private.todays_hunt_write_slots(city,day,event.before);
  perform private.admin_log('undo','todays_hunt',event.target_id,event.target_label,
    event.after,event.before || jsonb_build_object('undo_of',event.id),p_note);
  return private.todays_hunt_admin_day(city,day,false,null);
end $$;

revoke all on function private.todays_hunt_date(text,timestamptz), private.todays_hunt_center(text),
  private.todays_hunt_pool(text), private.todays_hunt_lock(text), private.todays_hunt_date_key(text,date),
  private.todays_hunt_fill(text,date),
  private.todays_hunt_streak(uuid,text,date), private.todays_hunt_admin_day(text,date,boolean,text),
  private.todays_hunt_lock_future(text,date), private.todays_hunt_slots(text,date,integer[]),
  private.todays_hunt_write_slots(text,date,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.todays_hunt(text), public.todays_hunt_attempt(text,integer,jsonb),
  public.todays_hunt_friends(text), public.admin_todays_hunt_calendar(text,date,integer),
  public.admin_todays_hunt_set(text,date,integer,uuid,double precision,double precision,integer,text,text),
  public.admin_todays_hunt_swap(text,date,integer,integer), public.admin_undo(bigint,text)
  from public, anon, authenticated, service_role;
grant execute on function public.todays_hunt(text), public.todays_hunt_attempt(text,integer,jsonb),
  public.todays_hunt_friends(text), public.admin_todays_hunt_calendar(text,date,integer),
  public.admin_todays_hunt_set(text,date,integer,uuid,double precision,double precision,integer,text,text),
  public.admin_todays_hunt_swap(text,date,integer,integer), public.admin_undo(bigint,text) to authenticated;
