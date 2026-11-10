-- Hosted preflight: run the migration body and these assertions in one
-- transaction, then ROLLBACK. Use an existing disposable allow-listed user.
select set_config('request.jwt.claim.sub',
  '4d43fcfb-09d6-4557-9bc3-e2738852a4b3',true);
do $$
declare s record; a record; cfg integer;
begin
  select * into s from public.sea_shores
    where kind='landmark' and place='senado'
      and source_ref='osm:way/192573684';
  if s.lat<>22.193683 or s.lng<>113.539890 then
    raise exception 'Senado fountain action point differs';
  end if;
  select action_radius_m into cfg from private.game_config where singleton;
  if public.distance_m(22.19383,113.53999,s.lat,s.lng)>=cfg then
    raise exception 'former Senado point should remain within action range';
  end if;
  if public.distance_m(22.1955,113.539890,s.lat,s.lng)<=cfg then
    raise exception 'far point unexpectedly in action range';
  end if;
  if not (select ends_at='infinity'::timestamptz from public.hunts
      where id='senado-square-2026-11') then
    raise exception 'Senado hunt should be open-ended';
  end if;
  if not exists(select 1 from jsonb_array_elements(
      public.hunt_list(22.193683,113.539890)) h
      where h->>'id'='senado-square-2026-11'
        and h->>'ends_at'='infinity') then
    raise exception 'open-ended hunt is not listed';
  end if;
end $$;

set local role authenticated;
do $$
declare s record; a record; denied boolean:=false;
begin
  select * into s from public.sea_shores
    where kind='landmark' and place='senado'
      and source_ref='osm:way/192573684';
  select * into a from public.landmark_start(s.id,22.193683,113.539890,10);
  if a.attempt_id is null then raise exception 'fountain start failed'; end if;
  begin
    perform public.landmark_start(s.id,22.1955,113.539890,10);
  exception when others then
    if position('too_far' in sqlerrm)>0 then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'far Landmark start succeeded'; end if;
end $$;
reset role;
