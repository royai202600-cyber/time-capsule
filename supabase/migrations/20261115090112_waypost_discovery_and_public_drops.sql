-- Keep public capsule destinations stable when adding game-only Wayposts.
alter table public.public_capsule_spots
  add column public_drop boolean not null default true;

create index public_capsule_spots_game_lat_lng_idx
  on public.public_capsule_spots (lat, lng) where game_enabled;

create index corrupted_spots_lat_lng_idx
  on public.corrupted_spots (lat, lng);

-- CREATE OR REPLACE preserves existing grants, ownership and legacy wrappers.
CREATE OR REPLACE FUNCTION public.game_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cfg private.game_config; result_spawns jsonb; result_wayposts jsonb; wave bigint; candidate jsonb; pass integer; spawn_candidates jsonb; attempt_spawns jsonb;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  wave := floor(extract(epoch from now())/(cfg.wave_minutes*60))::bigint;
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
      exit when jsonb_array_length(attempt_spawns)>=cfg.nearby_spawn_target;
    end loop;
    if jsonb_array_length(attempt_spawns)>jsonb_array_length(result_spawns) then result_spawns:=attempt_spawns;end if;
    exit when jsonb_array_length(result_spawns)>=cfg.nearby_spawn_target;
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
  return jsonb_build_object('spawns',result_spawns,'wayposts',result_wayposts);
end $function$;

CREATE OR REPLACE FUNCTION public.public_capsule_drop(p_message text, p_hint text, p_vessel text, p_drift_days integer, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS TABLE(id uuid, spot_zh text, spot_en text, available_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.vessels; v_ed integer; s public.public_capsule_spots; v_id uuid;
  v_message text; v_hint text; v_scan text; v_open_at timestamptz; w text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  v_message := btrim(coalesce(p_message, ''));
  v_hint := btrim(coalesce(p_hint, ''));
  if char_length(v_message) not between 1 and 280 or char_length(v_hint) > 40
    or p_drift_days is null or p_drift_days not in (1,7,30,365) then
    raise exception 'rejected';
  end if;
  -- First-pass safety gate, deliberately small and reviewable. A future
  -- moderation service can replace it after Roy chooses one. Check the hint too.
  v_scan := lower(v_message || ' ' || v_hint);
  if v_scan ~* '[[:alnum:]._%+\-]+@[[:alnum:].\-]+\.[[:alpha:]]{2,}'
    or v_scan ~* '(https?://|www\.|[[:alnum:]\-]+\.(com|net|org|io|cn|hk|tw|sg|my|jp|kr)(/|\b))'
    or v_scan ~ '(\+?[0-9][0-9 ()+.-]{6,}[0-9])'
  then raise exception 'rejected'; end if;
  foreach w in array array['kill yourself','go die','fuck you','bitch','nigger','去死','滾開','傻逼','操你','冚家剷'] loop
    if position(w in v_scan) > 0 then raise exception 'rejected'; end if;
  end loop;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180
    or p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200 then
    raise exception 'no_shore';
  end if;
  select * into s from public.public_capsule_spots x
    where x.public_drop and public.distance_m(p_lat, p_lng, x.lat, x.lng) <= 3000
    order by public.distance_m(p_lat, p_lng, x.lat, x.lng), x.id limit 1;
  if s.id is null then raise exception 'no_shore'; end if;
  -- Exactly the current send_capsule vessel rule: free catalogue items are
  -- available; priced and place-earned vessels must already be owned.
  select * into v from public.vessels where public.vessels.id = p_vessel;
  if v.id is null then raise exception 'unknown vessel'; end if;
  if v.price_mop > 0 or v.earned_place is not null then
    select edition_no into v_ed from public.owned_vessels where user_id = auth.uid() and vessel = p_vessel;
    if not found then raise exception 'vessel not owned' using hint = 'not_owned'; end if;
  end if;
  v_open_at := now() + make_interval(days => p_drift_days);
  insert into public.capsules (sender, recipient, vessel, hint, open_at, edition_no, is_public, public_capsule_spot)
    values (auth.uid(), null, p_vessel, v_hint, v_open_at, v_ed, true, s.id)
    returning public.capsules.id into v_id;
  insert into public.capsule_contents (capsule_id, message) values (v_id, v_message);
  return query select v_id, s.name_zh, s.name_en, v_open_at;
end $function$;

CREATE OR REPLACE FUNCTION public.public_capsule_return(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.capsules; previous_spot public.public_capsule_spots; next_spot public.public_capsule_spots;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from public.capsules where id = p_id for update;
  if c.id is null or not c.is_public or c.recipient is distinct from auth.uid() or c.opened_at is null then
    raise exception 'taken';
  end if;
  select * into previous_spot from public.public_capsule_spots where id = c.public_capsule_spot;
  select * into next_spot from public.public_capsule_spots s
    where s.public_drop and s.id <> previous_spot.id
      and public.distance_m(s.lat, s.lng, previous_spot.lat, previous_spot.lng) >= 1000
    order by case when s.city_en = previous_spot.city_en then 0 else 1 end, random() limit 1;
  if next_spot.id is null then raise exception 'no_shore'; end if;
  update public.capsules set recipient = null, public_capsule_spot = next_spot.id,
    open_at = now() + interval '1 day', public_capsule_returns = public_capsule_returns + 1,
    opened_at = null, seen_at = null, opened_lat = null, opened_lng = null,
    opened_distance_m = null, gift_code = null
    where id = p_id;
end $function$;
