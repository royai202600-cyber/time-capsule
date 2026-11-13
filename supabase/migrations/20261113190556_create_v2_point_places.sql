begin;

alter table public.capsules
  add column place_lat double precision,
  add column place_lng double precision,
  add column place_name text,
  add constraint capsule_point_place_complete check (
    (place_lat is null and place_lng is null and place_name is null)
    or (
      place is null and place_lat is not null and place_lng is not null and place_name is not null
      and place_lat between -90 and 90 and place_lng between -180 and 180
      and char_length(btrim(place_name)) between 1 and 200
    )
  );

-- The required point arguments distinguish this overload from the legacy RPC.
create function public.send_capsule(
  p_recipient uuid, p_vessel text, p_message text, p_hint text, p_open_at timestamptz,
  p_place_lat double precision, p_place_lng double precision, p_place_name text,
  p_drawing text default null, p_photo text default null, p_voice text default null,
  p_voice_ms integer default null, p_kind text default 'letter', p_prediction text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare capsule_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_place_lat is null or p_place_lng is null or p_place_name is null
     or p_place_lat not between -90 and 90 or p_place_lng not between -180 and 180
     or char_length(btrim(p_place_name)) not between 1 and 200 then
    raise exception 'invalid opening place';
  end if;

  capsule_id := public.send_capsule(
    p_recipient, p_vessel, p_message, p_hint, p_open_at, null::text,
    p_drawing, p_photo, p_voice, p_voice_ms, p_kind, p_prediction
  );
  update public.capsules
    set place_lat = p_place_lat, place_lng = p_place_lng, place_name = btrim(p_place_name)
    where id = capsule_id and sender = auth.uid();
  return capsule_id;
end $$;

revoke all on function public.send_capsule(uuid,text,text,text,timestamptz,double precision,double precision,text,text,text,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.send_capsule(uuid,text,text,text,timestamptz,double precision,double precision,text,text,text,text,integer,text,text) to authenticated;

create or replace function public.open_capsule(p_id uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_accuracy double precision DEFAULT NULL::double precision)
 returns table(message text, drawing text, photo text, opened_at timestamptz, gift_code text, voice_path text, voice_ms integer, prediction text, verdict boolean)
 language plpgsql security definer set search_path = '' as $function$
declare c public.capsules; pl public.places; d double precision; g text;
  cfg private.game_config; waited_days integer;
begin
  select * into c from public.capsules
    where id = p_id and recipient = auth.uid() for update;
  if c.id is null then raise exception 'capsule not found'; end if;
  if c.opened_at is null then
    if c.open_at > now() then raise exception 'not yet' using hint = 'locked'; end if;
    if c.place is not null or c.place_lat is not null then
      if c.place is not null then
        select * into strict pl from public.places where id = c.place;
      end if;
      if p_lat is null or p_lng is null then raise exception 'location needed' using hint = 'no_location'; end if;
      if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
        raise exception 'invalid location' using hint = 'no_location';
      end if;
      if p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200 then
        raise exception 'location not accurate enough' using hint = 'inaccurate';
      end if;
      d := public.distance_m(p_lat, p_lng, coalesce(c.place_lat, pl.lat), coalesce(c.place_lng, pl.lng));
      if d > coalesce(pl.radius_m, 100) then raise exception 'too far: % m', round(d) using hint = 'far'; end if;
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
    if c.place is not null then
      insert into public.owned_vessels (user_id, vessel)
        select c.recipient, v.id from public.vessels v where v.earned_place = c.place
        on conflict (user_id, vessel) do nothing;
    end if;
    begin
      if c.place is not null then
      insert into public.passport_stamps(user_id,place,first_at,how_earned)
        values(c.recipient,c.place,c.opened_at,'capsule')
        on conflict (user_id,place) do nothing;
      end if;
    select * into cfg from private.game_config where singleton;
    waited_days:=least(cfg.xp_open_day_cap,
      floor(extract(epoch from c.opened_at-c.sealed_at)/86400)::integer);
    if waited_days>=cfg.xp_open_min_days then
      perform private.ensure_player(c.recipient);
      perform private.award_xp(c.recipient,'capsule_open',c.id::text,
        cfg.xp_open_base+cfg.xp_open_per_day*waited_days);
    end if;
    exception when others then
      raise warning 'Time Capsule game rewards failed for capsule %: %',c.id,sqlerrm;
    end;
  end if;
  return query select cc.message, cc.drawing, cc.photo, c.opened_at, c.gift_code, cc.voice_path, cc.voice_ms, cc.prediction, c.verdict
    from public.capsule_contents cc where cc.capsule_id = p_id;
end $function$;

notify pgrst, 'reload schema';
commit;
