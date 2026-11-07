-- Add sealed sender voice notes without exposing capsule_contents.
-- Existing RPC bodies were copied from the hosted project. Only the voice
-- validation, writes and two trailing return columns are added.
begin;

alter table public.capsules add column has_voice boolean not null default false;
alter table public.capsule_contents
  add column voice_path text unique,
  add column voice_ms integer check (voice_ms between 500 and 60000),
  add constraint capsule_contents_voice_pair check ((voice_path is null) = (voice_ms is null));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-notes', 'voice-notes', false, 2097152,
  array['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/webm']);

-- capsule_contents deliberately has RLS with no client policies. This narrow
-- boolean helper can inspect it for Storage without granting content access.
-- private is not an exposed Data API schema.
create schema if not exists private;
grant usage on schema private to authenticated;
create function private.can_read_capsule_voice(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.capsule_contents cc
      join public.capsules c on c.id = cc.capsule_id
    where cc.voice_path = object_name
      and c.recipient = auth.uid() and c.opened_at is not null
  );
$$;
revoke all on function private.can_read_capsule_voice(text) from public, anon, authenticated;
grant execute on function private.can_read_capsule_voice(text) to authenticated;

create policy "voice-notes: upload once to own folder"
on storage.objects for insert to authenticated with check (
  bucket_id = 'voice-notes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(m4a|webm)$'
);
create policy "voice-notes: opened recipient only"
on storage.objects for select to authenticated using (
  bucket_id = 'voice-notes' and private.can_read_capsule_voice(name)
);
-- No client UPDATE or DELETE policies: neither the sender nor the recipient
-- can replace or remove a sealed recording. Abandoned uploads remain unreadable.

drop function public.send_capsule(uuid, text, text, text, timestamptz, text, text, text);
CREATE FUNCTION public.send_capsule(p_recipient uuid, p_vessel text, p_message text, p_hint text, p_open_at timestamp with time zone, p_place text DEFAULT NULL::text, p_drawing text DEFAULT NULL::text, p_photo text DEFAULT NULL::text, p_voice text DEFAULT NULL::text, p_voice_ms integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v public.vessels; v_ed integer; pl public.places; v_voice_object uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
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
  insert into public.capsules (sender, recipient, vessel, hint, open_at, place, handwritten, edition_no, has_voice)
    values (auth.uid(), p_recipient, p_vessel, coalesce(trim(p_hint), ''), p_open_at, p_place, p_drawing is not null, v_ed, p_voice is not null)
    returning id into v_id;
  insert into public.capsule_contents (capsule_id, message, drawing, photo, voice_path, voice_ms)
    values (v_id, nullif(trim(coalesce(p_message, '')), ''), p_drawing, p_photo, p_voice, p_voice_ms);
  return v_id;
end $function$;

revoke all on function public.send_capsule(uuid, text, text, text, timestamptz, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.send_capsule(uuid, text, text, text, timestamptz, text, text, text, text, integer) to authenticated, service_role;

-- Postgres requires DROP/CREATE when extending a RETURNS TABLE. Do both in this
-- transaction; keep the exact time/place/GPS/row-lock/gift-code logic and grants.
drop function public.open_capsule(uuid, double precision, double precision, double precision);
CREATE FUNCTION public.open_capsule(p_id uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_accuracy double precision DEFAULT NULL::double precision)
 RETURNS TABLE(message text, drawing text, photo text, opened_at timestamp with time zone, gift_code text, voice_path text, voice_ms integer)
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
  return query select cc.message, cc.drawing, cc.photo, c.opened_at, c.gift_code, cc.voice_path, cc.voice_ms
    from public.capsule_contents cc where cc.capsule_id = p_id;
end $function$;

revoke all on function public.open_capsule(uuid, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.open_capsule(uuid, double precision, double precision, double precision) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
