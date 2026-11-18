begin;
alter table public.vessels add column unlimited_copies boolean not null default false;
update public.vessels set unlimited_copies=true where id in ('dome','bottle','envelope','tin') or earned_place is not null;
alter table public.owned_vessels alter column copies drop not null;
alter table public.owned_vessels drop constraint owned_vessels_copies_check;
alter table public.owned_vessels add constraint owned_vessels_copies_check check (copies is null or copies >= 0);
update public.owned_vessels o set copies=case when v.unlimited_copies then null else 10 end from public.vessels v where v.id=o.vessel;
-- Kept separate because spawn revisions store the game_config composite type.
create table private.vessel_copy_settings (singleton boolean primary key default true check(singleton), copies_per_catch integer not null default 3 check(copies_per_catch between 1 and 1000));
insert into private.vessel_copy_settings default values;
revoke all on private.vessel_copy_settings from public,anon,authenticated;
-- Extension point for future level-based awards.
create function private.copies_per_catch(p_user uuid) returns integer language sql stable set search_path='' as $$
  select copies_per_catch from private.vessel_copy_settings where singleton;
$$;
revoke all on function private.copies_per_catch(uuid) from public,anon,authenticated;

-- Existing acquisition paths omit copies; normalize unlimited ownership on insertion.
create function private.vessel_copies_on_insert() returns trigger language plpgsql set search_path='' as $$
declare is_unlimited boolean;
begin
  select v.unlimited_copies into is_unlimited from public.vessels v where v.id=new.vessel for share;
  if is_unlimited then new.copies:=null; end if;
  return new;
end $$;
create trigger vessel_copies_on_insert before insert on public.owned_vessels for each row execute function private.vessel_copies_on_insert();
revoke all on function private.vessel_copies_on_insert() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_capsule(p_recipient uuid, p_vessel text, p_message text, p_hint text, p_open_at timestamp with time zone, p_place text DEFAULT NULL::text, p_drawing text DEFAULT NULL::text, p_photo text DEFAULT NULL::text, p_voice text DEFAULT NULL::text, p_voice_ms integer DEFAULT NULL::integer, p_kind text DEFAULT 'letter'::text, p_prediction text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v public.vessels; v_ed integer; pl public.places; v_voice_object uuid; v_prediction text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_kind is null or p_kind not in ('letter', 'prediction') then raise exception 'invalid capsule kind'; end if;
  if p_kind = 'prediction' then
    v_prediction := btrim(coalesce(p_prediction, ''), E' \t\n\r\f' || chr(11));
    if char_length(v_prediction) not between 1 and 140 then
      raise exception 'prediction must contain 1 to 140 characters';
    end if;
  elsif p_prediction is not null then
    raise exception 'letter cannot contain a prediction';
  end if;
  if p_recipient <> auth.uid() and not exists (
    select 1 from public.friendships where user_id = auth.uid() and friend_id = p_recipient
  ) then raise exception 'recipient is not a friend'; end if;
  select * into v from public.vessels where id = p_vessel for share;
  if v.id is null then raise exception 'unknown vessel'; end if;
  if v.id not in ('dome','bottle','envelope','tin') or v.earned_place is not null then
    select edition_no into v_ed from public.owned_vessels where user_id = auth.uid() and vessel = p_vessel;
    if not found then raise exception 'vessel not owned' using hint = 'not_owned'; end if;
  end if;
  if not v.unlimited_copies then
    update public.owned_vessels set copies = copies - 1
      where user_id = auth.uid() and vessel = p_vessel and copies > 0;
    if not found then raise exception 'no_copies' using hint = 'no_copies'; end if;
  end if;
  if p_open_at <= now() then raise exception 'open time must be in the future'; end if;
  if p_place is not null then
    select * into pl from public.places where id = p_place;
    if pl.id is null then raise exception 'unknown place'; end if;
    if pl.brand_vessel is not null and pl.brand_vessel <> p_vessel then raise exception 'place needs brand vessel' using hint = 'brand_place'; end if;
  end if;
  if p_voice is null then
    if p_voice_ms is not null then raise exception 'voice duration without voice'; end if;
  else
    if p_voice !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(m4a|webm)$'
       or (storage.foldername(p_voice))[1] <> auth.uid()::text then
      raise exception 'invalid voice path';
    end if;
    if p_voice_ms is null or p_voice_ms < 500 or p_voice_ms > 60000 then
      raise exception 'invalid voice duration';
    end if;
    -- Serialize attachment attempts; UNIQUE is a final concurrent-reuse guard.
    select o.id into v_voice_object from storage.objects o
      where o.bucket_id = 'voice-notes' and o.name = p_voice
        and o.owner_id = auth.uid()::text
      for update;
    if v_voice_object is null then raise exception 'voice upload not found or not owned'; end if;
    if exists (select 1 from public.capsule_contents cc where cc.voice_path = p_voice) then
      raise exception 'voice already attached';
    end if;
  end if;
  insert into public.capsules (sender, recipient, vessel, hint, open_at, place, handwritten, edition_no, has_voice, kind)
    values (auth.uid(), p_recipient, p_vessel, coalesce(trim(p_hint), ''), p_open_at, p_place, p_drawing is not null, v_ed, p_voice is not null, p_kind)
    returning id into v_id;
  insert into public.capsule_contents (capsule_id, message, drawing, photo, voice_path, voice_ms, prediction)
    values (v_id, nullif(trim(coalesce(p_message, '')), ''), p_drawing, p_photo, p_voice, p_voice_ms, v_prediction);
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.corrupted_capsule_throw(p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision, p_ball text, p_ring double precision, p_hit boolean)
 RETURNS TABLE(result text, vessel text, copies integer, stars integer, is_new boolean, xp_gained integer, wax_balls integer, gold_balls integer, attempts_left integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  current_wave := (select w.wave from private.game_wave_at(now()) w);
  if wave not between current_wave-1 and current_wave then raise exception 'expired'; end if;
  select * into spot from public.corrupted_spots where id=split_part(p_spawn,':',1)::uuid and hidden_at is null for share;
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
        where user_id=auth.uid() and public.owned_vessels.vessel=corrupted_capsule_throw.vessel);
      -- Single hook for a future level-based award; today it is the configured amount.
      perform 1 from public.vessels v where v.id=corrupted_capsule_throw.vessel for share;
      insert into public.owned_vessels(user_id,vessel,copies)
        values(auth.uid(),vessel,case when (select v.unlimited_copies from public.vessels v where v.id=corrupted_capsule_throw.vessel) then null else private.copies_per_catch(auth.uid()) end)
        on conflict on constraint owned_vessels_pkey do update
          set copies=case when (select v.unlimited_copies from public.vessels v where v.id=corrupted_capsule_throw.vessel) then null else public.owned_vessels.copies+private.copies_per_catch(auth.uid()) end
        returning public.owned_vessels.copies into copies;
      stars := 1; -- Compatibility field for older apps; duplicates no longer increase stars.
      xp_gained := private.award_xp(auth.uid(),'catch',p_spawn,cfg.xp_catch);
      if is_new then xp_gained := xp_gained+
        private.award_xp(auth.uid(),'new_vessel',vessel,cfg.xp_new_vessel); end if;
      xp_gained := xp_gained+private.award_xp(auth.uid(),'first_catch_day',
        (now() at time zone 'UTC')::date::text,cfg.xp_first_daily_catch);
      result := 'restored';
      begin
        perform private.city_hunt_record_quest('restore',spot.id,p_lat,p_lng);
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

CREATE OR REPLACE FUNCTION public.landmark_hit(p_attempt uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_ball text, p_ring double precision)
 RETURNS TABLE(result text, cracks integer, expires_at timestamp with time zone, vessel text, copies integer, stars integer, is_new boolean, xp_gained integer, wax_balls integer, gold_balls integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pg public.player_game; cfg private.game_config; active public.landmark_attempts;
  post public.public_capsule_spots; damage integer; reward text;
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
  select * into post from public.public_capsule_spots
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
    perform 1 from public.vessels v where v.id=reward for share;
    insert into public.owned_vessels(user_id,vessel,copies)
      values(auth.uid(),reward,case when (select v.unlimited_copies from public.vessels v where v.id=reward) then null else 1 end)
      on conflict on constraint owned_vessels_pkey do nothing;
    select o.copies into copies from public.owned_vessels o where o.user_id=auth.uid() and o.vessel=reward;
    stars := 1;
    insert into public.passport_stamps(user_id,place,first_at,how_earned)
      values(auth.uid(),post.place,now(),'landmark')
      on conflict (user_id,place) do nothing;
    -- The first win at a place pays XP; the vessel remains collected.
    xp_gained:=private.award_xp(auth.uid(),'landmark_win',post.place,cfg.xp_landmark);
    result:='won';
    begin
      perform private.city_hunt_record_quest('landmark',post.id,p_lat,p_lng);
    exception when others then
      raise warning 'hunt landmark bookkeeping failed: %',sqlerrm;
    end;
  end if;
  wax_balls:=pg.wax_balls; gold_balls:=pg.gold_balls;
  return next;
end $function$
;

create or replace function public.my_collection()
returns table(vessel text,copies integer,stars integer,edition_no integer,acquired_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return query select o.vessel,o.copies,1,o.edition_no,o.acquired_at
    from public.owned_vessels o join public.vessels v on v.id=o.vessel
    where o.user_id=auth.uid() order by v.sort,o.vessel;
end $$;

CREATE OR REPLACE FUNCTION public.admin_spawning()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  return (
    with cities as materialized (
      select g.*, date_trunc('day', now() at time zone g.timezone) at time zone g.timezone as day_start,
        date_trunc('week', now() at time zone g.timezone) at time zone g.timezone as week_start
      from private.game_regions g where g.center_lat is not null
    ), caught as (
      select p.city, count(*) filter (where c.caught_at >= g.day_start) as today, count(*) as week
      from cities g join public.corrupted_spots p on p.city = g.city
      join public.corrupted_catches c on split_part(c.spawn_id, ':', 1) = p.id::text
      where c.result = 'caught' and c.caught_at >= g.week_start
        and p.source_ref not like 'qa:roy-taipei-game:%'
      group by p.city
    )
    select jsonb_build_object(
      'config', jsonb_build_object(
        'wave_minutes', (select w.minutes from private.game_wave_at(now()) w),
        'next_length', (select jsonb_build_object('minutes', w.minutes, 'starts_at', w.starts_at)
          from private.game_wave_periods w where w.starts_at > now() order by w.starts_at limit 1),
        'spawn_chance', cfg.spawn_chance, 'nearby_max', cfg.nearby_spawn_target,
        'copies_per_catch', (select copies_per_catch from private.vessel_copy_settings where singleton),
        'weights', jsonb_build_object('common', cfg.rarity_common_weight,
          'uncommon', cfg.rarity_uncommon_weight, 'rare', cfg.rarity_rare_weight)),
      'places', (select jsonb_agg(jsonb_build_object('id', g.id, 'parent', g.parent_id,
        'name_zh', g.name_zh, 'name_en', g.name_en, 'country_zh', g.country_zh, 'country_en', g.country_en,
        'has_spots', exists (select 1 from private.game_regions child
          join public.corrupted_spots p on p.city = child.city and p.source_ref not like 'qa:%'
          where g.id in (child.id, child.parent_id))) order by g.country_en, g.name_en)
        from private.game_regions g),
      'rules', (select coalesce(jsonb_agg(jsonb_build_object(
        'vessel', v.id, 'unlimited_copies', v.unlimited_copies, 'rarity', r.rarity, 'habitat', r.habitat,
        'hours', case when r.local_start_hour is not null then jsonb_build_array(r.local_start_hour, (r.local_end_hour + 23) % 24) end,
        'dates', case when r.month_day_start is not null then jsonb_build_array(r.month_day_start, r.month_day_end) end,
        'regions', (select coalesce(jsonb_agg(g.id order by g.id), '[]'::jsonb) from cities g
          where exists (select 1 from private.vessel_spawn_places a where a.vessel = v.id
            and a.region_id in (g.id, g.parent_id))),
        'places', (select coalesce(jsonb_agg(a.region_id order by a.region_id), '[]'::jsonb)
          from private.vessel_spawn_places a where a.vessel = v.id),
        'never', case when v.earned_place is not null then 'earned'
          when v.brand is not null or v.edition_total is not null then 'brand'
          when v.id in ('dome', 'bottle', 'envelope', 'tin') then 'starter' end
        ) order by v.sort, v.id), '[]'::jsonb)
        from public.vessels v left join private.vessel_spawn_rules r on r.vessel = v.id),
      'stats', (select coalesce(jsonb_object_agg(g.id, jsonb_build_object(
        'out_now', (select count(*) from private.admin_wave(g.city) where not caught),
        'caught_today', coalesce(c.today, 0), 'caught_week', coalesce(c.week, 0))), '{}'::jsonb)
        from cities g left join caught c on c.city = g.city)
    )
    from private.game_config cfg where cfg.singleton
  );
end;
$function$;

-- Administrative writes are serialized with sends/catches and recorded with before/after values.
create function public.admin_vessel_set_unlimited(p_vessel text,p_unlimited boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare before_value boolean; result jsonb;
begin
  if not private.admin_can('edit') then raise exception 'forbidden'; end if;
  if p_unlimited is null then raise exception 'invalid_unlimited'; end if;
  select unlimited_copies into before_value from public.vessels where id=p_vessel for update;
  if not found then raise exception 'unknown vessel'; end if;
  if before_value is distinct from p_unlimited then
    update public.vessels set unlimited_copies=p_unlimited where id=p_vessel;
    update public.owned_vessels set copies=case when p_unlimited then null else 0 end where vessel=p_vessel;
  end if;
  result:=jsonb_build_object('unlimited_copies',p_unlimited);
  perform private.admin_log('vessel_set_unlimited','vessel',p_vessel,p_vessel,jsonb_build_object('unlimited_copies',before_value),result,p_note);
  return result;
end $$;
create function public.admin_player_adjust_copies(p_user uuid,p_vessel text,p_delta integer,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare before_value integer; after_value integer; unlimited boolean; result jsonb;
begin
  if not private.admin_can('edit') then raise exception 'forbidden'; end if;
  if p_delta is null or p_delta=0 then raise exception 'invalid_delta'; end if;
  select unlimited_copies into unlimited from public.vessels where id=p_vessel for share;
  if not found then raise exception 'unknown vessel'; end if;
  if unlimited then raise exception 'unlimited_vessel'; end if;
  select copies into before_value from public.owned_vessels where user_id=p_user and vessel=p_vessel for update;
  if not found then raise exception 'vessel_not_owned'; end if;
  if before_value::bigint+p_delta < 0 or before_value::bigint+p_delta > 2147483647 then raise exception 'invalid_copies'; end if;
  update public.owned_vessels set copies=before_value+p_delta where user_id=p_user and vessel=p_vessel returning copies into after_value;
  result:=jsonb_build_object('copies',after_value);
  perform private.admin_log('player_adjust_copies','player_vessel',p_user::text||':'||p_vessel,p_vessel,jsonb_build_object('copies',before_value),result,p_note);
  return result;
end $$;
create function public.admin_copies_per_catch_set(p_copies integer,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_value integer; result jsonb;
begin
  if not private.admin_can('edit') then raise exception 'forbidden'; end if;
  if p_copies is null or p_copies not between 1 and 1000 then raise exception 'invalid_copies'; end if;
  select copies_per_catch into old_value from private.vessel_copy_settings where singleton for update;
  update private.vessel_copy_settings set copies_per_catch=p_copies where singleton;
  result:=jsonb_build_object('copies_per_catch',p_copies);
  perform private.admin_log('copies_per_catch_set','game_config','singleton','copies_per_catch',jsonb_build_object('copies_per_catch',old_value),result,p_note);
  return result;
end $$;
revoke all on function public.admin_vessel_set_unlimited(text,boolean,text),public.admin_player_adjust_copies(uuid,text,integer,text),public.admin_copies_per_catch_set(integer,text) from public,anon,authenticated;
grant execute on function public.admin_vessel_set_unlimited(text,boolean,text),public.admin_player_adjust_copies(uuid,text,integer,text),public.admin_copies_per_catch_set(integer,text) to authenticated;
commit;
