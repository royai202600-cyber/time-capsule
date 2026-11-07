-- Apply only after PR #62's illustrated vessel wiring is confirmed in production.
-- Preserve all existing send/open time, place, prediction, voice and edition rules.
begin;
alter table public.vessels add column earned_place text references public.places(id);
create unique index vessels_earned_place on public.vessels (earned_place) where earned_place is not null;
insert into public.vessels (id, price_mop, edition_total, brand, sort, earned_place) values
  ('vinyl', 22, null, null, 18, null),
  ('vhs', 16, null, null, 19, null),
  ('photo-strip', 0, null, null, 20, null),
  ('arcade', 22, null, null, 21, null),
  ('pager', 14, null, null, 22, null),
  ('rotary-phone', 18, null, null, 23, null),
  ('umbrella', 16, null, null, 24, null),
  ('love-padlock', 18, null, null, 25, null),
  ('lucky-stars', 12, null, null, 26, null),
  ('paper-plane', 0, null, null, 27, null),
  ('lucky-cat', 18, null, null, 28, null),
  ('mooncake-tin', 16, null, null, 29, null),
  ('cake-box', 0, null, null, 30, null),
  ('candy-box', 16, null, null, 31, null),
  ('chocolate-heart', 16, null, null, 32, null),
  ('stocking', 16, null, null, 33, null),
  ('pumpkin', 16, null, null, 34, null),
  ('rice-dumpling', 16, null, null, 35, null),
  ('wish-tag', 16, null, null, 36, null),
  ('river-lantern', 0, null, null, 37, null),
  ('clock-tower', 0, null, null, 38, 'tst-clock'),
  ('senado-fountain', 0, null, null, 39, 'senado'),
  ('bamboo-tower', 0, null, null, 40, 'taipei101'),
  ('gate-lantern', 0, null, null, 41, 'sensoji'),
  ('torii-scroll', 0, null, null, 42, 'fushimi'),
  ('palace-pavilion', 0, null, null, 43, 'gyeongbok'),
  ('lionfish-fountain', 0, null, null, 44, 'merlion'),
  ('golden-roof', 0, null, null, 45, 'grandpal'),
  ('gate-lacquer', 0, null, null, 46, 'wumen'),
  ('twin-towers', 0, null, null, 47, 'petronas');

create or replace function public.acquire_vessel(p_vessel text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v public.vessels; n integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v from public.vessels where id = p_vessel;
  if v.id is null then raise exception 'unknown vessel'; end if;
  if v.earned_place is not null then raise exception 'vessel must be earned at its place' using hint = 'earned_only'; end if;
  if v.price_mop = 0 then return null; end if;
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
end $$;


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
  if v.price_mop > 0 or v.earned_place is not null then
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
revoke all on function public.send_capsule(uuid, text, text, text, timestamptz, text, text, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.send_capsule(uuid, text, text, text, timestamptz, text, text, text, text, integer, text, text) to authenticated, service_role;


CREATE OR REPLACE FUNCTION public.open_capsule(p_id uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_accuracy double precision DEFAULT NULL::double precision)
 RETURNS TABLE(message text, drawing text, photo text, opened_at timestamp with time zone, gift_code text, voice_path text, voice_ms integer, prediction text, verdict boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.capsules; pl public.places; d double precision; g text;
begin
  select * into c from public.capsules
    where id = p_id and recipient = auth.uid() for update;
  if c.id is null then raise exception 'capsule not found'; end if;
  if c.opened_at is null then
    if c.open_at > now() then raise exception 'not yet' using hint = 'locked'; end if;
    if c.place is not null then
      select * into pl from public.places where id = c.place;
      if p_lat is null or p_lng is null then raise exception 'location needed' using hint = 'no_location'; end if;
      if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
        raise exception 'invalid location' using hint = 'no_location';
      end if;
      if p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200 then
        raise exception 'location not accurate enough' using hint = 'inaccurate';
      end if;
      d := public.distance_m(p_lat, p_lng, pl.lat, pl.lng);
      if d > pl.radius_m then raise exception 'too far: % m', round(d) using hint = 'far'; end if;
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
    -- Only reached on a first, successfully time/location-verified opening.
    -- The capsule row lock and unique ownership key make retries/concurrent opens safe.
    if c.place is not null then
      insert into public.owned_vessels (user_id, vessel)
        select c.recipient, v.id from public.vessels v where v.earned_place = c.place
        on conflict (user_id, vessel) do nothing;
    end if;
  end if;
  return query select cc.message, cc.drawing, cc.photo, c.opened_at, c.gift_code, cc.voice_path, cc.voice_ms, cc.prediction, c.verdict
    from public.capsule_contents cc where cc.capsule_id = p_id;
end $function$
;
revoke all on function public.open_capsule(uuid, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.open_capsule(uuid, double precision, double precision, double precision) to authenticated, service_role;


notify pgrst, 'reload schema';
commit;
