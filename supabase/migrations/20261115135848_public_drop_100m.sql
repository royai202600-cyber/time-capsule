begin;

-- Keep the existing point reference for existing capsules and capsules placed
-- on Wayposts or drop places. A Corrupted Capsule spot has its own foreign key.
alter table public.capsules
  add column corrupted_drop_spot uuid references public.corrupted_spots(id),
  drop constraint capsules_sea_shore_check,
  add constraint capsules_public_drop_point_check check (
    (is_public and place is null and num_nonnulls(public_capsule_spot, corrupted_drop_spot) = 1)
    or (not is_public and num_nonnulls(public_capsule_spot, corrupted_drop_spot) = 0)
  );
create index capsules_corrupted_drop_spot_idx on public.capsules (corrupted_drop_spot)
  where corrupted_drop_spot is not null;

-- Keep ineligible points readable for capsules that already lie on them.
create view private.public_capsule_points with (security_invoker = true) as
  select id, false as corrupted, lat, lng, name_zh, name_en, city_en,
    game_enabled or public_drop as eligible
  from public.public_capsule_spots
  union all
  select s.id, true, s.lat, s.lng, coalesce(w.name_zh, g.name_zh, s.city),
    coalesce(w.name_en, s.city), s.city, s.source_ref not like 'qa:%'
  from public.corrupted_spots s
  left join private.game_regions g on g.city = s.city
  left join public.public_capsule_spots w on w.source_ref = s.source_ref;
revoke all on private.public_capsule_points from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.public_capsule_drop(p_message text, p_hint text, p_vessel text, p_drift_days integer, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS TABLE(id uuid, spot_zh text, spot_en text, available_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.vessels; v_ed integer; s private.public_capsule_points; v_id uuid;
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
  select x.* into s from private.public_capsule_points x
    where x.eligible and public.distance_m(p_lat, p_lng, x.lat, x.lng) <= 100
    order by public.distance_m(p_lat, p_lng, x.lat, x.lng), x.corrupted, x.id limit 1;
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
  insert into public.capsules (sender, recipient, vessel, hint, open_at, edition_no, is_public,
    public_capsule_spot, corrupted_drop_spot)
    values (auth.uid(), null, p_vessel, v_hint, v_open_at, v_ed, true,
      case when not s.corrupted then s.id end, case when s.corrupted then s.id end)
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
declare c public.capsules; previous_spot private.public_capsule_points; next_spot private.public_capsule_points;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from public.capsules where id = p_id for update;
  if c.id is null or not c.is_public or c.recipient is distinct from auth.uid() or c.opened_at is null then
    raise exception 'taken';
  end if;
  select * into previous_spot from private.public_capsule_points s
    where (not s.corrupted and s.id = c.public_capsule_spot) or (s.corrupted and s.id = c.corrupted_drop_spot);
  select * into next_spot from private.public_capsule_points s
    where s.eligible
      and public.distance_m(s.lat, s.lng, previous_spot.lat, previous_spot.lng) >= 1000
    order by case when s.city_en = previous_spot.city_en then 0 else 1 end, random() limit 1;
  if next_spot.id is null then raise exception 'no_shore'; end if;
  update public.capsules set recipient = null,
    public_capsule_spot = case when not next_spot.corrupted then next_spot.id end,
    corrupted_drop_spot = case when next_spot.corrupted then next_spot.id end,
    open_at = now() + interval '1 day', public_capsule_returns = public_capsule_returns + 1,
    opened_at = null, seen_at = null, opened_lat = null, opened_lng = null,
    opened_distance_m = null, gift_code = null
    where id = p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.public_capsule_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS TABLE(id uuid, hint text, vessel text, lat double precision, lng double precision, spot_zh text, spot_en text, sealed_at timestamp with time zone, available_at timestamp with time zone, returns integer, sender jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.id, c.hint, c.vessel, s.lat, s.lng, s.name_zh, s.name_en,
    c.sealed_at, c.open_at, c.public_capsule_returns,
    jsonb_build_object('id', p.id, 'name', p.name, 'avatar', p.avatar, 'city', p.city)
  from public.capsules c
  join private.public_capsule_points s
    on (not s.corrupted and s.id = c.public_capsule_spot) or (s.corrupted and s.id = c.corrupted_drop_spot)
  join public.profiles p on p.id = c.sender
  where auth.uid() is not null
    and p_lat between -90 and 90 and p_lng between -180 and 180
    and p_accuracy > 0 and p_accuracy <= 200
    and c.is_public and c.recipient is null and c.open_at <= now()
    and c.sender <> auth.uid()
    and public.distance_m(p_lat, p_lng, s.lat, s.lng) <= 5000
    and not exists (select 1 from public.public_capsule_pickups x where x.capsule_id = c.id and x.finder = auth.uid())
    and not exists (select 1 from public.public_capsule_reports r where r.capsule_id = c.id and r.reporter = auth.uid())
    and not private.public_capsule_is_hidden(c.id)
  order by public.distance_m(p_lat, p_lng, s.lat, s.lng), c.open_at
  limit 100;
$function$;

CREATE OR REPLACE FUNCTION public.public_capsule_pick_up(p_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.capsules; s private.public_capsule_points;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from public.capsules where id = p_id for update;
  if c.id is null or not c.is_public then raise exception 'taken'; end if;
  if c.sender = auth.uid() then raise exception 'own_bottle'; end if;
  if c.recipient is not null or c.open_at > now()
    or exists (select 1 from public.public_capsule_pickups x where x.capsule_id = p_id and x.finder = auth.uid())
    or exists (select 1 from public.public_capsule_reports r where r.capsule_id = p_id and r.reporter = auth.uid())
    or private.public_capsule_is_hidden(p_id)
  then raise exception 'taken'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180
    or p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200
  then raise exception 'too_far'; end if;
  select p.* into s from private.public_capsule_points p
    where (not p.corrupted and p.id = c.public_capsule_spot) or (p.corrupted and p.id = c.corrupted_drop_spot);
  if s.id is null or public.distance_m(p_lat, p_lng, s.lat, s.lng) > 100 then
    raise exception 'too_far';
  end if;
  insert into public.public_capsule_pickups (capsule_id, finder) values (p_id, auth.uid());
  update public.capsules set recipient = auth.uid() where id = p_id;
end $function$;

commit;
