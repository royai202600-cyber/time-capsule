-- Align the Senado fight with its fountain seal. The test hunt has no planned
-- end date; PostgreSQL infinity keeps the existing RPC window checks intact.
begin;

do $$
declare changed integer;
begin
  update public.sea_shores
    set lat=22.193683,lng=113.539890
    where kind='landmark' and place='senado'
      and source_ref='osm:way/192573684';
  get diagnostics changed = row_count;
  if changed<>1 then raise exception 'Senado Landmark row missing'; end if;

  update public.hunts set ends_at='infinity'::timestamptz
    where id='senado-square-2026-11';
  get diagnostics changed = row_count;
  if changed<>1 then raise exception 'Senado test hunt row missing'; end if;
end $$;

commit;
