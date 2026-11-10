-- HKUST's Piazza is the action point for its existing place and red-bird
-- earned vessel. The map monument shows the curved academic building.
begin;

insert into public.sea_shores
  (name_zh,name_en,city_zh,city_en,lat,lng,kind,place,game_enabled,source_ref)
select '香港科技大學','HKUST','香港','Hong Kong',
  22.3374255,114.2629606,'landmark','hkust',true,'osm:node/2439950828'
where exists (select 1 from public.places p
    where p.id='hkust' and p.lat=22.3374255 and p.lng=114.2629606)
  and exists (select 1 from public.vessels v
    where v.id='red-bird' and v.earned_place='hkust')
on conflict (source_ref) where source_ref is not null do nothing;

do $$ begin
  if (select count(*) from public.sea_shores
      where kind='landmark' and place='hkust' and game_enabled
        and lat=22.3374255 and lng=114.2629606
        and source_ref='osm:node/2439950828')<>1 then
    raise exception 'HKUST Landmark seed missing';
  end if;
end $$;

commit;
