-- RELEASE GATE: confirm PR #81 game UI live in production before applying.
-- Created from current hosted function definitions; CREATE OR REPLACE preserves grants.
begin;
alter table public.sea_shores add column scene text
  check (scene in ('park','garden','waterfront','square','publicArt'));
-- OSM-derived public feature names are stored alongside their source_ref.
update public.sea_shores set scene = case
  when (name_en||' '||name_zh) ~* 'garden|botanic|花園|植物園' then 'garden'
  when (name_en||' '||name_zh) ~* 'sculpture|statue|public art|museum|arts|雕塑|藝術|美術' then 'publicArt'
  when (name_en||' '||name_zh) ~* 'water|river|harbour|harbor|bay|pier|wharf|shore|beach|quay|marina|lake|pond|河|港|灣|碼頭|海|湖|濱|岸' then 'waterfront'
  when (name_en||' '||name_zh) ~* 'square|plaza|praça|largo|廣場|前地' then 'square'
  else 'park' end where kind='common';
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
  select * into v from public.vessels where id = p_vessel;
  if v.id is null then raise exception 'unknown vessel'; end if;
  if v.id not in ('dome','bottle','envelope','tin') or v.earned_place is not null then
    select edition_no into v_ed from public.owned_vessels where user_id = auth.uid() and vessel = p_vessel;
    if not found then raise exception 'vessel not owned' using hint = 'not_owned'; end if;
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
CREATE OR REPLACE FUNCTION public.acquire_vessel(p_vessel text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.vessels; n integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v from public.vessels where id = p_vessel;
  if v.id is null then raise exception 'unknown vessel'; end if;
  if v.earned_place is not null then raise exception 'vessel must be earned at its place' using hint = 'earned_only'; end if;
  if v.brand is null and v.edition_total is null then
    raise exception 'vessel must be collected' using hint = 'collect_only';
  end if;
  if exists (select 1 from public.owned_vessels where user_id = auth.uid() and vessel = p_vessel) then
    raise exception 'already owned' using hint = 'owned';
  end if;
  if v.edition_total is not null then
    perform pg_advisory_xact_lock(hashtext('vessel:' || p_vessel));   -- number editions one at a time
    select coalesce(max(edition_no), 0) + 1 into n from public.owned_vessels where vessel = p_vessel;
    if n > v.edition_total then raise exception 'sold out' using hint = 'sold_out'; end if;
  end if;
  insert into public.owned_vessels (user_id, vessel, edition_no) values (auth.uid(), p_vessel, n);
  return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.corrupted_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cfg private.game_config; result_spawns jsonb; result_wayposts jsonb; wave bigint;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  wave := floor(extract(epoch from now())/(cfg.wave_minutes*60))::bigint;
  select coalesce(jsonb_agg(jsonb_build_object(
    'spawn_id',s.spawn_id,'vessel',s.vessel,'rarity',s.rarity,
    'lat',p.lat,'lng',p.lng,'expires_at',s.expires_at,
    'attempts_left',greatest(0,cfg.max_attempts-coalesce(c.attempts,0)),
    'already_caught',coalesce(c.result='caught',false))
    order by s.expires_at), '[]'::jsonb) into result_spawns
  from public.corrupted_spots p
  cross join lateral generate_series(wave-1,wave) w(n)
  cross join lateral private.resolve_spawn(p.id,w.n) s
  left join public.corrupted_catches c on c.user_id=auth.uid() and c.spawn_id=s.spawn_id
  where public.distance_m(p_lat,p_lng,p.lat,p.lng)<=cfg.nearby_radius_m
    and s.expires_at>now()
    and to_timestamp(w.n*cfg.wave_minutes*60)<=now();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'kind',s.kind,'name_zh',s.name_zh,'name_en',s.name_en,
    'city_zh',s.city_zh,'city_en',s.city_en,'place',s.place,
    'lat',s.lat,'lng',s.lng,'scene',s.scene,
    'cooldown_end',case when s.kind='common'
      then (select max(spun_at)+make_interval(secs=>cfg.spin_cooldown_seconds)
        from public.waypost_spins x where x.user_id=auth.uid() and x.waypost_id=s.id)
      else null end)
    order by s.kind,s.name_en),'[]'::jsonb) into result_wayposts
  from public.sea_shores s
  where s.game_enabled and public.distance_m(p_lat,p_lng,s.lat,s.lng)<=cfg.nearby_radius_m;
  return jsonb_build_object('spawns',result_spawns,'wayposts',result_wayposts);
end $function$
;
notify pgrst,'reload schema';
commit;
