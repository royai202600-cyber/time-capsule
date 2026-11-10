-- Release gate: deploy the red-bird app wiring before applying this migration.
-- This registers the earned reward and its place identity. The HKUST Landmark
-- Waypost, map coverage and City Hunt are separate work.
begin;

insert into public.places(id,name_zh,name_en,city_zh,city_en,lat,lng,radius_m,sort,why_zh,why_en)
values ('hkust','香港科技大學','HKUST','香港','Hong Kong',
  22.3374255,114.2629606,100,11,
  '入口廣場的弧形教學大樓','The curved academic building around the Entrance Piazza');

insert into public.vessels(id,price_mop,edition_total,brand,sort,earned_place)
values ('red-bird',0,null,null,68,'hkust');

do $$
begin
  if not exists (select 1 from public.vessels
    where id='red-bird' and earned_place='hkust' and price_mop=0
      and edition_total is null and brand is null) then
    raise exception 'HKUST earned vessel seed missing';
  end if;
end $$;

commit;
