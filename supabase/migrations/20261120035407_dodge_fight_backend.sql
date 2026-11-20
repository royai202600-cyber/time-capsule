-- The old throw RPC stays available during the app rollout. Both paths take the
-- player_game row lock in track_position before locking or changing any fight.
create table private.corrupted_fights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  spawn_id text not null,
  max_health integer not null check (max_health between 3 and 5),
  health integer not null check (health between 1 and max_health),
  started_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  unique (user_id, spawn_id)
);
alter table private.corrupted_fights enable row level security;
revoke all on private.corrupted_fights from public, anon, authenticated, service_role;

-- Keep accepted outcomes after the fight expires so a lost reply can be retried.
create table private.fight_finish_receipts (
  kind text not null check (kind in ('corrupted','landmark')),
  fight_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response jsonb not null,
  primary key (kind,fight_id)
);
create index fight_finish_receipts_user_idx on private.fight_finish_receipts (user_id);
alter table private.fight_finish_receipts enable row level security;
revoke all on private.fight_finish_receipts from public, anon, authenticated, service_role;

-- Serialize receipts and ball spending with legacy actions using the same player lock.
create function private.fight_finish_receipt(p_kind text,p_fight uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare accepted jsonb;
begin
  perform 1 from public.player_game where user_id=auth.uid() for update;
  if not found then raise exception 'expired'; end if;
  select r.response into accepted from private.fight_finish_receipts r
    where r.kind=p_kind and r.fight_id=p_fight and r.user_id=auth.uid();
  return accepted;
end $$;

create function private.spend_fight_balls(
  p_result text,p_wax_used integer,p_gold_used integer,p_health integer,
  p_started_at timestamptz,p_player public.player_game
)
returns public.player_game language plpgsql set search_path = '' as $$
declare player public.player_game;
begin
  if p_result is null or p_result not in ('won','lost')
     or p_wax_used is null or p_gold_used is null or p_wax_used<0 or p_gold_used<0
    then raise exception 'rejected'; end if;
  if p_player.wax_balls<p_wax_used or p_player.gold_balls<p_gold_used
    then raise exception 'no_balls'; end if;
  if p_result='won' and p_wax_used+2::bigint*p_gold_used<p_health
    then raise exception 'not_enough_damage'; end if;
  if extract(epoch from clock_timestamp()-p_started_at)<(p_wax_used::bigint+p_gold_used)*0.8
    then raise exception 'too_soon'; end if;
  update public.player_game set wax_balls=wax_balls-p_wax_used,gold_balls=gold_balls-p_gold_used
    where user_id=auth.uid() returning * into strict player;
  return player;
end $$;
update private.game_config set landmark_cracks=20, landmark_seconds=150 where singleton;

create function private.corrupted_target(
  p_spawn text, p_lat double precision, p_lng double precision, p_config private.game_config
)
returns table(spot_id uuid, quest_spawn private.quest_spawns, vessel text, rarity text,
  expires_at timestamptz, attempts_left integer)
language plpgsql set search_path = '' as $$
declare
  spot public.corrupted_spots;
  quest private.quest_spawns;
  caught public.corrupted_catches;
  wave bigint;
  current_wave bigint;
  released record;
begin
  if p_spawn is null or p_spawn !~
    '^(quest:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}:[0-9]{1,18})$'
    then raise exception 'expired'; end if;

  if p_spawn like 'quest:%' then
    select * into quest from private.quest_spawns
      where id=split_part(p_spawn,':',2)::uuid and user_id=auth.uid();
    if not found or not private.quest_spawn_available(quest) then raise exception 'expired'; end if;
    quest_spawn := quest;
    spot.lat := quest.location_lat;
    spot.lng := quest.location_lng;
    vessel := quest.vessel;
    rarity := quest.rarity;
    expires_at := quest.expires_at;
  else
    wave := split_part(p_spawn,':',2)::bigint;
    select w.wave into current_wave from private.game_wave_at(clock_timestamp()) w;
    if wave not between current_wave-1 and current_wave then raise exception 'expired'; end if;
    select * into spot from public.corrupted_spots
      where id=split_part(p_spawn,':',1)::uuid and hidden_at is null for share;
    if not found then raise exception 'expired'; end if;
    select * into released from private.resolve_spawn(spot.id,wave);
    if released.spawn_id is distinct from p_spawn then raise exception 'expired'; end if;
    spot_id := spot.id;
    vessel := released.vessel;
    rarity := released.rarity;
    expires_at := released.expires_at;
  end if;

  if expires_at<=clock_timestamp() then raise exception 'expired'; end if;
  if public.distance_m(p_lat,p_lng,spot.lat,spot.lng)>p_config.action_radius_m
    then raise exception 'too_far'; end if;
  select * into caught from public.corrupted_catches
    where user_id=auth.uid() and spawn_id=p_spawn for update;
  if caught.result='caught' then raise exception 'already_caught'; end if;
  attempts_left := p_config.max_attempts-coalesce(caught.attempts,0);
  if attempts_left<=0 then raise exception 'no_attempts'; end if;
  return next;
end $$;

create function private.fight_spend_ball(p_ball text, p_player public.player_game)
returns public.player_game language plpgsql set search_path = '' as $$
declare player public.player_game;
begin
  if (p_ball='wax' and p_player.wax_balls<1) or (p_ball='gold' and p_player.gold_balls<1)
    then raise exception 'no_balls'; end if;
  update public.player_game set
    wax_balls=case when p_ball='wax' then wax_balls-1 else wax_balls end,
    gold_balls=case when p_ball='gold' then gold_balls-1 else gold_balls end
    where user_id=auth.uid() returning * into strict player;
  return player;
end $$;

-- A finished try either records a loss or awards the existing restore result.
create function private.finish_corrupted_try(
  p_spawn text, p_vessel text, p_spot_id uuid, p_quest private.quest_spawns,
  p_lat double precision, p_lng double precision, p_restored boolean,
  p_attempts_left integer, p_config private.game_config
)
returns table(copies integer, stars integer, is_new boolean, xp_gained integer)
language plpgsql set search_path = '' as $$
begin
  insert into public.corrupted_catches(user_id,spawn_id,attempts,result,vessel,caught_at)
    values(auth.uid(),p_spawn,1,
      case when p_restored then 'caught' when p_attempts_left=0 then 'failed' else 'pending' end,
      p_vessel,case when p_restored then now() end)
    on conflict (user_id,spawn_id) do update
      set attempts=corrupted_catches.attempts+1, result=excluded.result, caught_at=excluded.caught_at;

  is_new := false;
  xp_gained := 0;
  if p_restored then
    is_new := not exists (select 1 from public.owned_vessels
      where user_id=auth.uid() and vessel=p_vessel);
    copies := private.award_catch_copies(auth.uid(),p_vessel);
    stars := 1; -- Compatibility field for older apps.
    xp_gained := private.award_xp(auth.uid(),'catch',p_spawn,p_config.xp_catch);
    if is_new then
      xp_gained := xp_gained+private.award_xp(auth.uid(),'new_vessel',p_vessel,p_config.xp_new_vessel);
    end if;
    xp_gained := xp_gained+private.award_xp(auth.uid(),'first_catch_day',
      (now() at time zone 'UTC')::date::text,p_config.xp_first_daily_catch);
    begin
      if p_quest.id is not null then
        perform private.quest_record_catch(p_quest);
      else
        perform private.city_hunt_record_quest('restore',p_spot_id,p_lat,p_lng);
      end if;
    exception when others then
      raise warning 'hunt restore bookkeeping failed: %',sqlerrm;
    end;
  end if;
  return next;
end $$;

create or replace function public.corrupted_capsule_throw(
  p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision,
  p_ball text, p_ring double precision, p_hit boolean
)
returns table(result text, vessel text, copies integer, stars integer, is_new boolean,
  xp_gained integer, wax_balls integer, gold_balls integer, attempts_left integer)
language plpgsql security definer set search_path = '' as $$
declare
  player public.player_game;
  cfg private.game_config;
  target record;
  chance double precision;
  restored boolean;
begin
  if p_ball is null or p_ball not in ('wax','gold') or p_ring is null or p_hit is null
    or p_ring::text in ('NaN','Infinity','-Infinity') then raise exception 'rejected'; end if;
  player := private.track_position(p_lat,p_lng,p_accuracy);
  select * into strict cfg from private.game_config where singleton;
  select * into strict target from private.corrupted_target(p_spawn,p_lat,p_lng,cfg);
  player := private.fight_spend_ball(p_ball,player);

  vessel := target.vessel;
  result := 'miss';
  is_new := false;
  xp_gained := 0;
  attempts_left := target.attempts_left;
  if p_hit then
    -- A legacy hit finishes a try and invalidates a resumed dodge fight for that try.
    delete from private.corrupted_fights where user_id=auth.uid() and spawn_id=p_spawn;
    attempts_left := attempts_left-1;
    chance := case target.rarity when 'common' then cfg.restore_common
      when 'uncommon' then cfg.restore_uncommon else cfg.restore_rare end;
    chance := least(1.0,chance+cfg.restore_ring_bonus*least(1.0,greatest(0.0,p_ring))
      +case when p_ball='gold' then cfg.restore_gold_bonus else 0 end);
    restored := random()<chance;
    select f.copies,f.stars,f.is_new,f.xp_gained into copies,stars,is_new,xp_gained
      from private.finish_corrupted_try(p_spawn,vessel,target.spot_id,target.quest_spawn,
        p_lat,p_lng,restored,attempts_left,cfg) f;
    result := case when restored then 'restored' else 'not_restored' end;
  end if;
  wax_balls := player.wax_balls;
  gold_balls := player.gold_balls;
  return next;
end $$;

create function public.corrupted_fight_start(
  p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision
)
returns table(fight_id uuid, health integer, max_health integer, expires_at timestamptz, attempts_left integer)
language plpgsql security definer set search_path = '' as $$
declare
  cfg private.game_config;
  target record;
  fight private.corrupted_fights;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into strict cfg from private.game_config where singleton;
  select * into strict target from private.corrupted_target(p_spawn,p_lat,p_lng,cfg);
  delete from private.corrupted_fights f where f.user_id=auth.uid() and f.expires_at<=clock_timestamp();
  select * into fight from private.corrupted_fights where user_id=auth.uid() and spawn_id=p_spawn;
  if not found then
    max_health := case target.rarity when 'common' then 3 when 'uncommon' then 4 else 5 end;
    insert into private.corrupted_fights(user_id,spawn_id,max_health,health,expires_at)
      values(auth.uid(),p_spawn,max_health,max_health,target.expires_at) returning * into fight;
  end if;
  fight_id := fight.id;
  health := fight.health;
  max_health := fight.max_health;
  expires_at := fight.expires_at;
  attempts_left := target.attempts_left;
  return next;
end $$;

create function public.corrupted_fight_finish(
  p_fight uuid,p_result text,p_wax_used integer,p_gold_used integer,
  p_lat double precision,p_lng double precision,p_accuracy double precision
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player public.player_game;
  cfg private.game_config;
  target record;
  fight private.corrupted_fights;
  reward record;
  response jsonb;
begin
  response := private.fight_finish_receipt('corrupted',p_fight);
  if response is not null then return response; end if;

  select * into fight from private.corrupted_fights where id=p_fight and user_id=auth.uid() for update;
  if not found or fight.expires_at<=clock_timestamp() then raise exception 'expired'; end if;
  player := private.track_position(p_lat,p_lng,p_accuracy);
  select * into strict cfg from private.game_config where singleton;
  select * into strict target from private.corrupted_target(fight.spawn_id,p_lat,p_lng,cfg);
  player := private.spend_fight_balls(p_result,p_wax_used,p_gold_used,fight.health,fight.started_at,player);
  select * into strict reward from private.finish_corrupted_try(fight.spawn_id,target.vessel,target.spot_id,target.quest_spawn,
    p_lat,p_lng,p_result='won',target.attempts_left-1,cfg);
  response := jsonb_build_object('result',p_result,'vessel',target.vessel,
    'copies',reward.copies,'stars',reward.stars,'is_new',reward.is_new,'xp_gained',reward.xp_gained,
    'wax_balls',player.wax_balls,'gold_balls',player.gold_balls,'attempts_left',target.attempts_left-1);
  delete from private.corrupted_fights where id=p_fight;
  insert into private.fight_finish_receipts values('corrupted',p_fight,auth.uid(),response);
  return response;
end $$;

create or replace function public.landmark_start(
  p_waypost uuid, p_lat double precision, p_lng double precision, p_accuracy double precision
)
returns table(attempt_id uuid, cracks integer, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  cfg private.game_config;
  post public.public_capsule_spots;
  active public.landmark_attempts;
  started timestamptz;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into strict cfg from private.game_config where singleton;
  select * into post from public.public_capsule_spots
    where id=p_waypost and game_enabled and kind='landmark';
  if not found or public.distance_m(p_lat,p_lng,post.lat,post.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;

  started := clock_timestamp();
  select * into active from public.landmark_attempts a
    where a.user_id=auth.uid() and a.won_at is null and a.expires_at>started
    order by a.expires_at desc limit 1 for update;
  if found then
    if active.waypost_id<>p_waypost then raise exception 'active_attempt'; end if;
  else
    insert into public.landmark_attempts(user_id,waypost_id,cracks_left,started_at,expires_at)
      values(auth.uid(),p_waypost,cfg.landmark_cracks,started,started+make_interval(secs=>cfg.landmark_seconds))
      returning * into active;
  end if;
  attempt_id := active.id;
  cracks := active.cracks_left;
  expires_at := active.expires_at;
  return next;
end $$;

create function private.active_landmark_attempt(
  p_attempt uuid, p_lat double precision, p_lng double precision, p_config private.game_config
)
returns table(attempt public.landmark_attempts, waypost public.public_capsule_spots)
language plpgsql set search_path = '' as $$
begin
  select a.* into attempt from public.landmark_attempts a
    where a.id=p_attempt and a.user_id=auth.uid() for update;
  if not found or attempt.expires_at<=clock_timestamp() or attempt.won_at is not null
    then raise exception 'expired'; end if;
  select s.* into waypost from public.public_capsule_spots s
    where s.id=attempt.waypost_id and s.game_enabled and s.kind='landmark' for share;
  if not found or public.distance_m(p_lat,p_lng,waypost.lat,waypost.lng)>p_config.action_radius_m
    then raise exception 'too_far'; end if;
  return next;
end $$;

-- The legacy landmark_hit implementation and signature stay available to the flick screen.
create function public.landmark_finish(
  p_fight uuid,p_result text,p_wax_used integer,p_gold_used integer,
  p_lat double precision,p_lng double precision,p_accuracy double precision
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  response jsonb;
  player public.player_game;
  cfg private.game_config;
  attempt public.landmark_attempts;
  post public.public_capsule_spots;
  target record;
  reward text;
  is_new boolean := false;
  xp_gained integer := 0;
begin
  response := private.fight_finish_receipt('landmark',p_fight);
  if response is not null then return response; end if;

  player := private.track_position(p_lat,p_lng,p_accuracy);
  select * into strict cfg from private.game_config where singleton;
  select * into strict target from private.active_landmark_attempt(p_fight,p_lat,p_lng,cfg);
  attempt := target.attempt;
  post := target.waypost;
  player := private.spend_fight_balls(p_result,p_wax_used,p_gold_used,attempt.cracks_left,attempt.started_at,player);
  if p_result='won' then
    update public.landmark_attempts set cracks_left=0,won_at=clock_timestamp() where id=p_fight;
    select id into reward from public.vessels where earned_place=post.place;
    if reward is null then raise exception 'missing landmark vessel'; end if;
    is_new := not exists (select 1 from public.owned_vessels where user_id=auth.uid() and vessel=reward);
    insert into public.owned_vessels(user_id,vessel,copies)
      values(auth.uid(),reward,null) on conflict on constraint owned_vessels_pkey do nothing;
    insert into public.passport_stamps(user_id,place,first_at,how_earned)
      values(auth.uid(),post.place,now(),'landmark') on conflict (user_id,place) do nothing;
    xp_gained := private.award_xp(auth.uid(),'landmark_win',post.place,cfg.xp_landmark);
    begin
      perform private.city_hunt_record_quest('landmark',post.id,p_lat,p_lng);
    exception when others then
      raise warning 'hunt landmark bookkeeping failed: %',sqlerrm;
    end;
  else
    update public.landmark_attempts set expires_at=least(expires_at,clock_timestamp()) where id=p_fight;
  end if;
  response := jsonb_build_object('result',p_result,'vessel',reward,'copies',null,
    'stars',case when p_result='won' then 1 else 0 end,'is_new',is_new,'xp_gained',xp_gained,
    'wax_balls',player.wax_balls,'gold_balls',player.gold_balls,'attempts_left',0);
  insert into private.fight_finish_receipts values('landmark',p_fight,auth.uid(),response);
  return response;
end $$;

revoke all on function
  private.corrupted_target(text,double precision,double precision,private.game_config),
  private.fight_spend_ball(text,public.player_game),
  private.finish_corrupted_try(text,text,uuid,private.quest_spawns,double precision,double precision,boolean,integer,private.game_config),
  private.active_landmark_attempt(uuid,double precision,double precision,private.game_config),
  private.fight_finish_receipt(text,uuid),
  private.spend_fight_balls(text,integer,integer,integer,timestamptz,public.player_game)
from public, anon, authenticated, service_role;

revoke all on function
  public.corrupted_fight_start(text,double precision,double precision,double precision),
  public.corrupted_fight_finish(uuid,text,integer,integer,double precision,double precision,double precision),
  public.landmark_finish(uuid,text,integer,integer,double precision,double precision,double precision)
from public, anon, authenticated, service_role;

grant execute on function
  public.corrupted_fight_start(text,double precision,double precision,double precision),
  public.corrupted_fight_finish(uuid,text,integer,integer,double precision,double precision,double precision),
  public.landmark_finish(uuid,text,integer,integer,double precision,double precision,double precision)
to authenticated;

notify pgrst, 'reload schema';
