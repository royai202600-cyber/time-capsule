-- Lock the capsule row before checking its state. Concurrent calls must preserve
-- the first opening's timestamp, coordinates, distance, and gift code.
-- Reject impossible GPS accuracy values instead of trusting a negative number.
create or replace function public.open_capsule(
  p_id uuid, p_lat double precision default null, p_lng double precision default null, p_accuracy double precision default null
)
returns table (message text, drawing text, photo text, opened_at timestamptz, gift_code text)
language plpgsql security definer set search_path = '' as $$
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
  return query select cc.message, cc.drawing, cc.photo, c.opened_at, c.gift_code
    from public.capsule_contents cc where cc.capsule_id = p_id;
end $$;

revoke execute on function public.open_capsule(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.open_capsule(uuid, double precision, double precision, double precision) to authenticated;

-- The invite preview is public by design, but grant it only to API roles.
revoke execute on function public.invite_info(text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;
