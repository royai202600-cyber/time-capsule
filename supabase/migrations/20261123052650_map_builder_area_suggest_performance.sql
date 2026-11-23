-- Keep the 4 km² limit and exact spacing. Let the existing corrupted_spots
-- latitude indexes prune occupied places before computing great-circle distances.
begin;

create or replace function public.admin_area_suggest(p_region text, p_kind text, p_south double precision,
  p_west double precision, p_north double precision, p_east double precision, p_spacing_m double precision)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  region private.game_regions;
  candidate record;
  picks jsonb := '[]';
  cells text[] := '{}';
  -- One degree of latitude spans about 111195 m in distance_m's sphere.
  -- The slightly wider band is a conservative filter. distance_m still decides spacing.
  lat_margin double precision := p_spacing_m / 111000.0;
begin
  perform private.require_game_editor();
  if p_kind is null or p_kind not in ('waypost','spot') then raise exception 'bad_kind'; end if;
  if (p_south >= -90 and p_north <= 90 and p_south < p_north
      and p_west >= -180 and p_east <= 180 and p_west < p_east) is not true
  then raise exception 'bad_area'; end if;
  if (p_spacing_m > 0 and p_spacing_m < 'Infinity'::double precision) is not true
  then raise exception 'bad_spacing'; end if;
  if p_north - p_south > 5 or p_east - p_west > 5
    or extensions.st_area(extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::extensions.geography) > 4000000
  then raise exception 'area_too_big'; end if;
  select * into region from private.game_regions r where r.id = p_region and r.border is not null;
  if not found then raise exception 'outside_border'; end if;

  for candidate in
    with safe as materialized (
      select p.lat, p.lng, p.id,
        case when p_kind = 'waypost' then private.s2_cell17(p.lat, p.lng) end as cell
      from private.public_capsule_drop_places p
      where p.region_id = p_region
        and point(p.lng, p.lat) <@ box(point(p_west, p_south), point(p_east, p_north))
        and extensions.st_covers(region.border, extensions.st_setsrid(extensions.st_makepoint(p.lng, p.lat), 4326))
    )
    select s.lat, s.lng, s.cell from safe s
    where (s.cell is null or not exists (select 1 from public.public_capsule_spots p
      where p.status <> 'deleted' and p.s2_cell17 = s.cell))
      and (p_kind <> 'waypost' or not exists (
        select 1 from public.public_capsule_spots p where p.status <> 'deleted'
          and p.lat between s.lat - lat_margin and s.lat + lat_margin
          and public.distance_m(s.lat, s.lng, p.lat, p.lng) < p_spacing_m))
      and (p_kind <> 'spot' or not exists (
        select 1 from public.corrupted_spots p where p.status <> 'deleted'
          and p.lat between s.lat - lat_margin and s.lat + lat_margin
          and public.distance_m(s.lat, s.lng, p.lat, p.lng) < p_spacing_m))
    order by s.lat, s.lng, s.id
  loop
    if candidate.cell = any(cells) or exists (
      select 1 from jsonb_to_recordset(picks) as p(lat double precision, lng double precision)
      where public.distance_m(candidate.lat, candidate.lng, p.lat, p.lng) < p_spacing_m
    ) then continue; end if;
    picks := picks || jsonb_build_array(jsonb_build_object('lat', candidate.lat, 'lng', candidate.lng));
    if candidate.cell is not null then cells := array_append(cells, candidate.cell); end if;
    exit when jsonb_array_length(picks) = 100;
  end loop;
  return picks;
end;
$$;

commit;
