begin;

alter table public.hunts
  add column time_limit_min integer check (time_limit_min > 0),
  add column repeat_xp integer not null default 50 check (repeat_xp >= 0);

update public.hunts
set time_limit_min = case when id = 'senado-square-2026-11' then 45 else 60 end,
    reset_timezone = case id
      when 'xinyi-2026-11' then 'Asia/Taipei'
      when 'hkust-2026-11' then 'Asia/Hong_Kong'
      else 'Asia/Macau'
    end,
    ends_at = 'infinity',
    name_zh = replace(name_zh, '城市尋寶', '城市定向')
where id in ('xinyi-2026-11', 'hkust-2026-11', 'senado-square-2026-11');

-- hunt_progress holds the current attempt; only successful timed runs enter the history.
-- Legacy finishes retain their stamp and rewards but do not set a timed record.
create table public.hunt_runs (
  hunt_id text not null,
  user_id uuid not null,
  day date not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_s integer not null check (duration_s >= 0),
  primary key (hunt_id, user_id, day),
  foreign key (hunt_id, user_id) references public.hunt_progress(hunt_id, user_id) on delete cascade,
  check (finished_at >= started_at)
);
alter table public.hunt_runs enable row level security;
revoke all on public.hunt_runs from public, anon, authenticated;

create function private.hunt_local_day(h public.hunts, at_time timestamptz) returns date
language sql stable set search_path = '' as $$
  select (at_time at time zone coalesce(h.reset_timezone, 'UTC'))::date
$$;

create function private.hunt_run_end(h public.hunts, started_at timestamptz) returns timestamptz
language sql stable strict set search_path = '' as $$
  select least(h.ends_at,
    started_at + make_interval(mins => h.time_limit_min),
    ((private.hunt_local_day(h, started_at) + 1)::timestamp at time zone h.reset_timezone))
$$;

revoke all on function private.hunt_local_day(public.hunts, timestamptz),
  private.hunt_run_end(public.hunts, timestamptz) from public, anon, authenticated;

create or replace function private.hunt_object(p_hunt text, p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
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
    'steps',(select jsonb_agg(jsonb_build_object('key',st.step_key,'goal',st.goal,
      'count',case when status.reset or status.timed_out then 0
        else least(st.goal,case st.step_key
          when 'checkin' then case when p.checked_in_at is null then 0 else 1 end
          when 'spin' then coalesce(p.spin_count,0)
          when 'restore' then coalesce(p.restore_count,0)
          when 'landmark' then coalesce(p.landmark_count,0)
          when 'return' then case when p.finished_at is null then 0 else 1 end end)
        end) order by st.ordinal)
      from public.hunt_steps st where st.hunt_id=h.id),
    'joined_at',p.joined_at,
    'checked_in_at',case when not status.reset and not status.timed_out then p.checked_in_at end,
    'finished_at',case when not status.reset then p.finished_at end,
    'time_limit_min',h.time_limit_min,
    -- Keep the expired same-day deadline visible so the client can show "time's up".
    'run_started_at',case when h.time_limit_min is not null and not status.reset then p.checked_in_at end,
    'run_ends_at',case when h.time_limit_min is not null and not status.reset then deadline.ends_at end,
    'best_s',records.best_s,'today_s',records.today_s,
    'finished_today',coalesce(private.hunt_local_day(h,p.finished_at)=day.today,false))
  from public.hunts h
  join public.sea_shores s on s.id=h.landmark
  left join public.hunt_progress p on p.hunt_id=h.id and p.user_id=p_user
  cross join lateral (select private.hunt_local_day(h,now()) as today) day
  cross join lateral (select private.hunt_run_end(h,p.checked_in_at) as ends_at) deadline
  cross join lateral (select
    coalesce(h.reset_timezone is not null and (p.finished_at is null or h.time_limit_min is not null)
      and private.hunt_local_day(h,p.checked_in_at)<day.today,false) as reset,
    coalesce(h.time_limit_min is not null and p.finished_at is null and now()>=deadline.ends_at,false) as timed_out
  ) status
  cross join lateral (select min(r.duration_s) as best_s,
    min(r.duration_s) filter (where r.day=day.today) as today_s
    from public.hunt_runs r where r.hunt_id=h.id and r.user_id=p_user) records
  where h.id=p_hunt
$$;

create or replace function public.hunt_check_in(p_hunt text,p_lat double precision,p_lng double precision,
  p_accuracy double precision) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.hunts; p public.hunt_progress; cfg private.game_config;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.hunts where id=p_hunt;
  if h.id is null or now()<h.starts_at or now()>=h.ends_at then raise exception 'hunt closed'; end if;
  if not exists (select 1 from public.hunt_progress where hunt_id=h.id and user_id=auth.uid())
    then raise exception 'join first'; end if;
  -- Match the game actions' lock order: player_game before hunt_progress.
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  if public.distance_m(p_lat,p_lng,h.keeper_lat,h.keeper_lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  select * into p from public.hunt_progress where hunt_id=h.id and user_id=auth.uid() for update;
  if p.user_id is null then raise exception 'join first'; end if;

  if (h.reset_timezone is not null and (p.finished_at is null or h.time_limit_min is not null)
      and private.hunt_local_day(h,p.checked_in_at)<private.hunt_local_day(h,now()))
    or (h.time_limit_min is not null and p.finished_at is null
      and now()>=private.hunt_run_end(h,p.checked_in_at)) then
    delete from public.hunt_spin_credits where hunt_id=h.id and user_id=auth.uid();
    update public.hunt_progress set checked_in_at=now(),finished_at=null,
      spin_count=0,restore_count=0,landmark_count=0
      where hunt_id=h.id and user_id=auth.uid();
  elsif p.checked_in_at is null then
    update public.hunt_progress set checked_in_at=now()
      where hunt_id=h.id and user_id=auth.uid();
  end if;
  return private.hunt_object(h.id,auth.uid());
end $$;

create or replace function private.hunt_action(p_kind text,p_id uuid,p_lat double precision,p_lng double precision)
returns void language plpgsql security definer set search_path = '' as $$
declare h public.hunts; p public.hunt_progress; credited uuid;
begin
  for h in select x.* from public.hunts x
    where now()>=x.starts_at and now()<x.ends_at
      and public.distance_m(p_lat,p_lng,x.area_lat,x.area_lng)<=x.area_radius_m
      and (p_kind='spin' and exists (select 1 from public.sea_shores s
        where s.id=p_id and s.kind='common' and s.game_enabled
          and public.distance_m(s.lat,s.lng,x.area_lat,x.area_lng)<=x.area_radius_m)
        or p_kind='restore' and exists (select 1 from public.corrupted_spots s
          where s.id=p_id and public.distance_m(s.lat,s.lng,x.area_lat,x.area_lng)<=x.area_radius_m)
        or p_kind='landmark' and x.landmark=p_id)
  loop
    select * into p from public.hunt_progress
      where hunt_id=h.id and user_id=auth.uid() for update;
    if p.user_id is null or p.checked_in_at is null or p.finished_at is not null
      or now()>=private.hunt_run_end(h,p.checked_in_at) then continue; end if;
    if p_kind='spin' then
      insert into public.hunt_spin_credits(hunt_id,user_id,waypost_id)
        values(h.id,auth.uid(),p_id) on conflict do nothing returning waypost_id into credited;
      if credited is not null then
        update public.hunt_progress set spin_count=spin_count+1
          where hunt_id=h.id and user_id=auth.uid();
      end if;
    elsif p_kind='restore' then
      update public.hunt_progress set restore_count=restore_count+1
        where hunt_id=h.id and user_id=auth.uid();
    elsif p_kind='landmark' then
      update public.hunt_progress set landmark_count=landmark_count+1
        where hunt_id=h.id and user_id=auth.uid();
    end if;
  end loop;
end $$;

create or replace function public.hunt_finish(p_hunt text,p_lat double precision,p_lng double precision,
  p_accuracy double precision) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.hunts; p public.hunt_progress; cfg private.game_config;
  required_spin integer; required_restore integer; required_landmark integer;
  paid integer := 0; gold integer := 0; first_finish boolean;
  today date;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.hunts where id=p_hunt;
  if h.id is null or now()<h.starts_at or now()>=h.ends_at then raise exception 'hunt closed'; end if;
  if not exists (select 1 from public.hunt_progress where hunt_id=h.id and user_id=auth.uid())
    then raise exception 'check in first'; end if;
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into p from public.hunt_progress where hunt_id=h.id and user_id=auth.uid() for update;
  today:=private.hunt_local_day(h,now());
  if p.checked_in_at is null
    or (h.reset_timezone is not null and (p.finished_at is null or h.time_limit_min is not null)
      and private.hunt_local_day(h,p.checked_in_at)<today) then raise exception 'check in first'; end if;
  if p.finished_at is not null then raise exception 'already finished'; end if;
  if h.time_limit_min is not null and now()>=private.hunt_run_end(h,p.checked_in_at)
    then raise exception 'time_up' using hint = 'time_up'; end if;
  select max(goal) filter (where step_key='spin'),max(goal) filter (where step_key='restore'),
    max(goal) filter (where step_key='landmark') into required_spin,required_restore,required_landmark
    from public.hunt_steps where hunt_id=h.id;
  if required_spin is null or required_restore is null or required_landmark is null
    or p.spin_count<required_spin or p.restore_count<required_restore
    or p.landmark_count<required_landmark then raise exception 'hunt incomplete'; end if;
  select * into cfg from private.game_config where singleton;
  if public.distance_m(p_lat,p_lng,h.keeper_lat,h.keeper_lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;

  if h.time_limit_min is not null then
    insert into public.hunt_runs(hunt_id,user_id,day,started_at,finished_at,duration_s)
      values(h.id,auth.uid(),today,p.checked_in_at,now(),
        floor(extract(epoch from now()-p.checked_in_at))::integer);
  end if;
  update public.hunt_progress set finished_at=now()
    where hunt_id=h.id and user_id=auth.uid();

  insert into public.hunt_passport_stamps(hunt_id,user_id,first_at)
    values(h.id,auth.uid(),now()) on conflict do nothing;
  first_finish:=found;
  if first_finish then
    paid:=private.award_xp(auth.uid(),'hunt',h.id,h.reward_xp);
    gold:=h.reward_gold;
    update public.player_game set gold_balls=gold_balls+gold where user_id=auth.uid();
  elsif h.time_limit_min is not null and h.repeat_xp>0 then
    paid:=private.award_xp(auth.uid(),'hunt_repeat',h.id||':'||today::text,h.repeat_xp);
  end if;
  return jsonb_build_object('hunt',private.hunt_object(h.id,auth.uid()),
    'xp_gained',paid,'gold_gained',gold,'state','finished');
end $$;

commit;
