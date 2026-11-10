-- Unfinished test hunts start a fresh attempt after local midnight.
-- Null keeps the existing one-shot behaviour (including Xinyi) unchanged.
begin;

alter table public.hunts add column reset_timezone text;

create or replace function private.hunt_object(p_hunt text,p_user uuid) returns jsonb
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
      'count',case when stale.expired and st.step_key <> 'return' then 0
        else least(st.goal,case st.step_key
          when 'checkin' then case when p.checked_in_at is null then 0 else 1 end
          when 'spin' then coalesce(p.spin_count,0)
          when 'restore' then coalesce(p.restore_count,0)
          when 'landmark' then coalesce(p.landmark_count,0)
          when 'return' then case when p.finished_at is null then 0 else 1 end end)
        end) order by st.ordinal)
      from public.hunt_steps st where st.hunt_id=h.id),
    'joined_at',p.joined_at,
    'checked_in_at',case when stale.expired then null else p.checked_in_at end,
    'finished_at',p.finished_at)
  from public.hunts h
  join public.sea_shores s on s.id=h.landmark
  left join public.hunt_progress p on p.hunt_id=h.id and p.user_id=p_user
  cross join lateral (select coalesce(p.finished_at is null
    and h.reset_timezone is not null and p.checked_in_at is not null
    and (p.checked_in_at at time zone h.reset_timezone)::date
      < (now() at time zone h.reset_timezone)::date,false) as expired) stale
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
  select * into p from public.hunt_progress where hunt_id=h.id and user_id=auth.uid() for update;
  if p.user_id is null then raise exception 'join first'; end if;
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  if public.distance_m(p_lat,p_lng,h.keeper_lat,h.keeper_lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  if h.reset_timezone is not null and p.finished_at is null and p.checked_in_at is not null
    and (p.checked_in_at at time zone h.reset_timezone)::date
      < (now() at time zone h.reset_timezone)::date then
    delete from public.hunt_spin_credits
      where hunt_id=h.id and user_id=auth.uid();
    update public.hunt_progress set checked_in_at=now(),spin_count=0,
      restore_count=0,landmark_count=0
      where hunt_id=h.id and user_id=auth.uid();
  else
    update public.hunt_progress set checked_in_at=coalesce(checked_in_at,now())
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
      or (h.reset_timezone is not null
        and (p.checked_in_at at time zone h.reset_timezone)::date
          < (now() at time zone h.reset_timezone)::date) then continue; end if;
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
  paid integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.hunts where id=p_hunt;
  if h.id is null or now()<h.starts_at or now()>=h.ends_at then raise exception 'hunt closed'; end if;
  select * into p from public.hunt_progress where hunt_id=h.id and user_id=auth.uid() for update;
  if p.user_id is null or p.checked_in_at is null
    or (h.reset_timezone is not null and p.finished_at is null
      and (p.checked_in_at at time zone h.reset_timezone)::date
        < (now() at time zone h.reset_timezone)::date) then raise exception 'check in first'; end if;
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

commit;
