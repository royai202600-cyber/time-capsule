-- Predict me: additive sealed content; preserve the hosted time/place/voice guards.
-- The pending batch-1 catalogue insert is intentionally NOT a dependency.
begin;

alter table public.capsules
  add column kind text not null default 'letter' check (kind in ('letter', 'prediction')),
  add column verdict boolean,
  add column verdict_at timestamptz;
alter table public.capsule_contents
  add column prediction text check (prediction is null or (
    char_length(prediction) between 1 and 140
    and prediction = btrim(prediction, E' \t\n\r\f' || chr(11))
  )),
  drop constraint capsule_contents_has_content,
  add constraint capsule_contents_has_content check (
    message is not null or drawing is not null or prediction is not null
  );

-- Avoid ambiguous PostgREST overloads; trailing defaults keep old callers valid.
drop function public.send_capsule(uuid, text, text, text, timestamptz, text, text, text, text, integer);
CREATE FUNCTION public.send_capsule(p_recipient uuid, p_vessel text, p_message text, p_hint text, p_open_at timestamp with time zone, p_place text DEFAULT NULL::text, p_drawing text DEFAULT NULL::text, p_photo text DEFAULT NULL::text, p_voice text DEFAULT NULL::text, p_voice_ms integer DEFAULT NULL::integer, p_kind text DEFAULT 'letter'::text, p_prediction text DEFAULT NULL::text)
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
  if v.price_mop > 0 then
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

-- An extended RETURNS TABLE requires DROP/CREATE in the same transaction.
drop function public.open_capsule(uuid, double precision, double precision, double precision);
CREATE FUNCTION public.open_capsule(p_id uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_accuracy double precision DEFAULT NULL::double precision)
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
  end if;
  return query select cc.message, cc.drawing, cc.photo, c.opened_at, c.gift_code, cc.voice_path, cc.voice_ms, cc.prediction, c.verdict
    from public.capsule_contents cc where cc.capsule_id = p_id;
end $function$
;
revoke all on function public.open_capsule(uuid, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.open_capsule(uuid, double precision, double precision, double precision) to authenticated, service_role;

create function public.set_prediction_verdict(p_id uuid, p_verdict boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.capsules c
    set verdict = p_verdict, verdict_at = case when p_verdict is null then null else now() end
    where c.id = p_id and c.recipient = auth.uid()
      and c.kind = 'prediction' and c.opened_at is not null;
  if not found then raise exception 'opened prediction not found'; end if;
end;
$$;

-- Sender sees only their prediction, and only after the recipient opened it.
create function public.prediction_for_sender(p_id uuid)
returns table(prediction text, verdict boolean, verdict_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select cc.prediction, c.verdict, c.verdict_at
  from public.capsules c join public.capsule_contents cc on cc.capsule_id = c.id
  where c.id = p_id and c.sender = (select auth.uid())
    and c.kind = 'prediction' and c.opened_at is not null;
$$;

-- One row per capsule. A self-capsule is 'sent' with no other person.
create function public.prediction_record()
returns table(capsule_id uuid, role text, other uuid, prediction text, verdict boolean,
  sealed_at timestamptz, opened_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, case when c.sender = (select auth.uid()) then 'sent' else 'received' end,
    case when c.sender = c.recipient then null::uuid
      when c.sender = (select auth.uid()) then c.recipient else c.sender end,
    cc.prediction, c.verdict, c.sealed_at, c.opened_at
  from public.capsules c join public.capsule_contents cc on cc.capsule_id = c.id
  where c.kind = 'prediction' and c.opened_at is not null
    and ((select auth.uid()) = c.sender or (select auth.uid()) = c.recipient)
  order by c.opened_at desc, c.id;
$$;

revoke all on function public.set_prediction_verdict(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.prediction_for_sender(uuid) from public, anon, authenticated, service_role;
revoke all on function public.prediction_record() from public, anon, authenticated, service_role;
grant execute on function public.set_prediction_verdict(uuid, boolean) to authenticated;
grant execute on function public.prediction_for_sender(uuid) to authenticated;
grant execute on function public.prediction_record() to authenticated;

-- No new table grants or policies: capsule_contents remains unreadable to clients.
notify pgrst, 'reload schema';
commit;
