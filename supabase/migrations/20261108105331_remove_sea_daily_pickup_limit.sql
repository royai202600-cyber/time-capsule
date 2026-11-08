-- Roy, 2026-11-08: Sea pickups have no daily cap.
-- Preserve bottle row locks, GPS/accuracy checks, finder history, sealed content and grants.
-- sea_pickups_left remains as a legacy compatibility RPC for older clients;
-- it no longer represents an enforced limit, and the new client never calls it.
create or replace function public.sea_pick_up(p_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns void
language plpgsql security definer set search_path = '' as $$
declare c public.capsules; s public.sea_shores;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from public.capsules where id = p_id for update;
  if c.id is null or not c.sea then raise exception 'taken'; end if;
  if c.sender = auth.uid() then raise exception 'own_bottle'; end if;
  if c.recipient is not null or c.open_at > now()
    or exists (select 1 from public.sea_pickups x where x.capsule_id = p_id and x.finder = auth.uid())
    or exists (select 1 from public.sea_reports r where r.capsule_id = p_id and r.reporter = auth.uid())
    or (select count(*) from public.sea_reports r where r.capsule_id = p_id) >= 2
  then raise exception 'taken'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180
    or p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200
  then raise exception 'too_far'; end if;
  select * into s from public.sea_shores where id = c.shore;
  if s.id is null or public.distance_m(p_lat, p_lng, s.lat, s.lng) > 100 then
    raise exception 'too_far';
  end if;
  insert into public.sea_pickups (capsule_id, finder) values (p_id, auth.uid());
  update public.capsules set recipient = auth.uid() where id = p_id;
end $$;
