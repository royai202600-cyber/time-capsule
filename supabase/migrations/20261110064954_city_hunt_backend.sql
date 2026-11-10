-- H1 City Hunt. The app screens release separately.
begin;

-- The map depicts the Landmark as the Taipei 101 tower; action range follows
-- the building centre, while the hunt area remains centred on its plaza.
do $$
declare changed integer;
begin
  update public.sea_shores
    set name_zh='台北101',name_en='Taipei 101',lat=25.033667,lng=121.564810
    where kind='landmark' and place='taipei101'
      and source_ref='osm:node/6936432822';
  get diagnostics changed = row_count;
  if changed<>1 then raise exception 'Taipei 101 Landmark row missing'; end if;
end $$;

create table public.hunts (
  id text primary key,
  name_zh text not null, name_en text not null,
  city_zh text not null, city_en text not null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  keeper_lat double precision not null check (keeper_lat between -90 and 90),
  keeper_lng double precision not null check (keeper_lng between -180 and 180),
  area_lat double precision not null check (area_lat between -90 and 90),
  area_lng double precision not null check (area_lng between -180 and 180),
  area_radius_m integer not null check (area_radius_m > 0),
  landmark uuid not null references public.sea_shores(id),
  reward_xp integer not null check (reward_xp > 0),
  reward_gold integer not null check (reward_gold >= 0),
  check (starts_at < ends_at)
);
create table public.hunt_steps (
  hunt_id text not null references public.hunts(id) on delete cascade,
  step_key text not null check (step_key in ('checkin','spin','restore','landmark','return')),
  ordinal integer not null check (ordinal between 1 and 5),
  goal integer not null check (goal > 0),
  primary key (hunt_id,step_key), unique (hunt_id,ordinal)
);
create table public.hunt_progress (
  hunt_id text not null references public.hunts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  checked_in_at timestamptz,
  spin_count integer not null default 0 check (spin_count >= 0),
  restore_count integer not null default 0 check (restore_count >= 0),
  landmark_count integer not null default 0 check (landmark_count >= 0),
  finished_at timestamptz,
  primary key (hunt_id,user_id),
  check (checked_in_at is null or checked_in_at >= joined_at),
  check (finished_at is null or checked_in_at is not null)
);
create table public.hunt_spin_credits (
  hunt_id text not null, user_id uuid not null,
  waypost_id uuid not null references public.sea_shores(id),
  primary key (hunt_id,user_id,waypost_id),
  foreign key (hunt_id,user_id) references public.hunt_progress(hunt_id,user_id) on delete cascade
);
create table public.hunt_passport_stamps (
  hunt_id text not null references public.hunts(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  first_at timestamptz not null,
  primary key (hunt_id,user_id)
);
alter table public.hunts enable row level security;
alter table public.hunt_steps enable row level security;
alter table public.hunt_progress enable row level security;
alter table public.hunt_spin_credits enable row level security;
alter table public.hunt_passport_stamps enable row level security;
create policy "hunt progress: own read" on public.hunt_progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "hunt spin credits: own read" on public.hunt_spin_credits for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "hunt stamps: own read" on public.hunt_passport_stamps for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.hunts,public.hunt_steps,
  public.hunt_progress,public.hunt_spin_credits,public.hunt_passport_stamps
  from public,anon,authenticated;
grant select on public.hunt_progress,public.hunt_spin_credits,public.hunt_passport_stamps to authenticated;

insert into public.hunts(id,name_zh,name_en,city_zh,city_en,starts_at,ends_at,
  keeper_lat,keeper_lng,area_lat,area_lng,area_radius_m,landmark,reward_xp,reward_gold)
select 'xinyi-2026-11','信義城市尋寶','Xinyi City Hunt','台北','Taipei',now(),
  ('2026-11-30 23:59:00 Asia/Taipei')::timestamptz,
  25.037546,121.562754,25.033263,121.564887,1200,s.id,300,5
from public.sea_shores s where s.source_ref='osm:node/6936432822' and s.kind='landmark';
do $$ begin
  if not exists (select 1 from public.hunts where id='xinyi-2026-11') then
    raise exception 'Xinyi landmark seed missing';
  end if;
end $$;
insert into public.hunt_steps(hunt_id,step_key,ordinal,goal) values
  ('xinyi-2026-11','checkin',1,1),('xinyi-2026-11','spin',2,3),
  ('xinyi-2026-11','restore',3,5),('xinyi-2026-11','landmark',4,1),
  ('xinyi-2026-11','return',5,1);

create function private.hunt_object(p_hunt text,p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',h.id,'name_zh',h.name_zh,'name_en',h.name_en,
    'city_zh',h.city_zh,'city_en',h.city_en,
    'starts_at',h.starts_at,'ends_at',h.ends_at,
    'keeper',jsonb_build_object('lat',h.keeper_lat,'lng',h.keeper_lng),
    'area',jsonb_build_object('lat',h.area_lat,'lng',h.area_lng,'radius_m',h.area_radius_m),
    'landmark',h.landmark,
    'reward',jsonb_build_object('xp',h.reward_xp,'gold',h.reward_gold),
    'steps',(select jsonb_agg(jsonb_build_object('key',st.step_key,'goal',st.goal,
      'count',least(st.goal,case st.step_key when 'checkin' then case when p.checked_in_at is null then 0 else 1 end
      when 'spin' then coalesce(p.spin_count,0)
      when 'restore' then coalesce(p.restore_count,0)
      when 'landmark' then coalesce(p.landmark_count,0)
      when 'return' then case when p.finished_at is null then 0 else 1 end end))
      order by st.ordinal) from public.hunt_steps st where st.hunt_id=h.id),
    'joined_at',p.joined_at,'checked_in_at',p.checked_in_at,'finished_at',p.finished_at)
  from public.hunts h left join public.hunt_progress p on p.hunt_id=h.id and p.user_id=p_user
  where h.id=p_hunt
$$;

create function public.hunt_list(p_lat double precision,p_lng double precision) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_lat is null or p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180
    or p_lat::text in ('NaN','Infinity','-Infinity') or p_lng::text in ('NaN','Infinity','-Infinity')
    then raise exception 'too_far'; end if;
  select coalesce(jsonb_agg(private.hunt_object(h.id,auth.uid())
    order by case when h.starts_at<=now() then 0 else 1 end,
      public.distance_m(p_lat,p_lng,h.keeper_lat,h.keeper_lng),h.starts_at),'[]'::jsonb)
    into result from public.hunts h where h.ends_at>now();
  return result;
end $$;

create function public.hunt_join(p_hunt text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.hunts;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.hunts where id=p_hunt;
  if h.id is null then raise exception 'unknown hunt'; end if;
  if h.ends_at<=now() then raise exception 'hunt closed'; end if;
  insert into public.hunt_progress(hunt_id,user_id) values(h.id,auth.uid())
    on conflict (hunt_id,user_id) do nothing;
  return private.hunt_object(h.id,auth.uid());
end $$;

create function public.hunt_check_in(p_hunt text,p_lat double precision,p_lng double precision,
  p_accuracy double precision) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.hunts; p public.hunt_progress; cfg private.game_config;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.hunts where id=p_hunt;
  if h.id is null or now()<h.starts_at or now()>=h.ends_at then raise exception 'hunt closed'; end if;
  select * into p from public.hunt_progress where hunt_id=h.id and user_id=auth.uid() for update;
  if p.user_id is null then raise exception 'join first'; end if;
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  if public.distance_m(p_lat,p_lng,h.keeper_lat,h.keeper_lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  update public.hunt_progress set checked_in_at=coalesce(checked_in_at,now())
    where hunt_id=h.id and user_id=auth.uid();
  return private.hunt_object(h.id,auth.uid());
end $$;

create function private.hunt_action(p_kind text,p_id uuid,p_lat double precision,p_lng double precision)
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
    if p.user_id is null or p.checked_in_at is null or p.finished_at is not null then continue; end if;
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

create function public.hunt_finish(p_hunt text,p_lat double precision,p_lng double precision,
  p_accuracy double precision) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.hunts; p public.hunt_progress; cfg private.game_config;
  required_spin integer; required_restore integer; required_landmark integer;
  paid integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.hunts where id=p_hunt;
  if h.id is null or now()<h.starts_at or now()>=h.ends_at then raise exception 'hunt closed'; end if;
  select * into p from public.hunt_progress where hunt_id=h.id and user_id=auth.uid() for update;
  if p.user_id is null or p.checked_in_at is null then raise exception 'check in first'; end if;
  if p.finished_at is not null then raise exception 'already finished'; end if;
  select max(goal) filter (where step_key='spin'),max(goal) filter (where step_key='restore'),
    max(goal) filter (where step_key='landmark') into required_spin,required_restore,required_landmark
    from public.hunt_steps where hunt_id=h.id;
  if required_spin is null or required_restore is null or required_landmark is null
    or p.spin_count<required_spin or p.restore_count<required_restore
    or p.landmark_count<required_landmark then raise exception 'hunt incomplete'; end if;
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  if public.distance_m(p_lat,p_lng,h.keeper_lat,h.keeper_lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  update public.hunt_progress set finished_at=now()
    where hunt_id=h.id and user_id=auth.uid();
  paid:=private.award_xp(auth.uid(),'hunt',h.id,h.reward_xp);
  update public.player_game set gold_balls=gold_balls+h.reward_gold where user_id=auth.uid();
  insert into public.hunt_passport_stamps(hunt_id,user_id,first_at)
    values(h.id,auth.uid(),now()) on conflict do nothing;
  return jsonb_build_object('hunt',private.hunt_object(h.id,auth.uid()),
    'xp_gained',paid,'gold_gained',h.reward_gold,'state','finished');
end $$;

revoke all on function private.hunt_object(text,uuid),private.hunt_action(text,uuid,double precision,double precision)
  from public,anon,authenticated,service_role;
revoke all on function public.hunt_list(double precision,double precision),public.hunt_join(text),
  public.hunt_check_in(text,double precision,double precision,double precision),
  public.hunt_finish(text,double precision,double precision,double precision)
  from public,anon,authenticated,service_role;
grant execute on function public.hunt_list(double precision,double precision),public.hunt_join(text),
  public.hunt_check_in(text,double precision,double precision,double precision),
  public.hunt_finish(text,double precision,double precision,double precision)
  to authenticated;

-- Existing action RPCs and my_passport keep their API signatures and result shapes.
create or replace function public.corrupted_throw(
  p_spawn text,p_lat double precision,p_lng double precision,p_accuracy double precision,
  p_ball text,p_ring double precision,p_hit boolean
) returns table(result text,vessel text,copies integer,stars integer,is_new boolean,
  xp_gained integer,wax_balls integer,gold_balls integer,attempts_left integer)
language plpgsql security definer set search_path = '' as $$
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
        where user_id=auth.uid() and public.owned_vessels.vessel=corrupted_throw.vessel);
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
        perform private.hunt_action('restore',spot.id,p_lat,p_lng);
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
end $$;

create or replace function public.waypost_spin(
  p_id uuid,p_lat double precision,p_lng double precision,p_accuracy double precision
) returns table(wax_awarded integer,gold_awarded integer,xp_gained integer,
  wax_balls integer,gold_balls integer,cooldown_end timestamptz)
language plpgsql security definer set search_path = '' as $$
declare pg public.player_game; cfg private.game_config; post public.sea_shores;
  last_spin timestamptz; spin_id uuid;
begin
  pg:=private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  select * into post from public.sea_shores where id=p_id and game_enabled and kind='common';
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
    perform private.hunt_action('spin',post.id,p_lat,p_lng);
  exception when others then
    raise warning 'hunt spin bookkeeping failed: %',sqlerrm;
  end;
  return next;
end $$;

create or replace function public.landmark_hit(
  p_attempt uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,
  p_ball text,p_ring double precision
) returns table(result text,cracks integer,expires_at timestamptz,vessel text,
  copies integer,stars integer,is_new boolean,xp_gained integer,
  wax_balls integer,gold_balls integer)
language plpgsql security definer set search_path = '' as $$
declare pg public.player_game; cfg private.game_config; active public.landmark_attempts;
  post public.sea_shores; damage integer; reward text;
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
  select * into post from public.sea_shores
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
      perform private.hunt_action('landmark',post.id,p_lat,p_lng);
    exception when others then
      raise warning 'hunt landmark bookkeeping failed: %',sqlerrm;
    end;
  end if;
  wax_balls:=pg.wax_balls; gold_balls:=pg.gold_balls;
  return next;
end $$;

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
    ) q order by q.first_at,q.place_sort;
end $$;

notify pgrst,'reload schema';
commit;
