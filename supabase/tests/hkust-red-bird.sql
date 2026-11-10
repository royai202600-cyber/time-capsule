-- Hosted transaction/rollback preflight: append after the migration body,
-- then ROLLBACK. No catalogue or place rows persist.
do $$
begin
  if not exists (select 1 from public.places where id='hkust'
      and name_zh='香港科技大學' and name_en='HKUST'
      and lat=22.3374255 and lng=114.2629606) then
    raise exception 'HKUST place identity missing';
  end if;
  if not exists (select 1 from public.vessels where id='red-bird'
      and earned_place='hkust' and price_mop=0 and brand is null
      and edition_total is null and sort=68) then
    raise exception 'red-bird is not an earned HKUST vessel';
  end if;
  if (select count(*) from public.vessels where earned_place='hkust')<>1 then
    raise exception 'HKUST reward is not unique';
  end if;
end $$;

select set_config('request.jwt.claim.sub',
  '4d43fcfb-09d6-4557-9bc3-e2738852a4b3',true);
set local role authenticated;
do $$
declare refused boolean:=false;
begin
  begin
    perform public.acquire_vessel('red-bird');
  exception when others then
    refused:=position('vessel must be earned at its place' in sqlerrm)>0;
  end;
  if not refused then raise exception 'Shop acquisition of red-bird was allowed'; end if;
end $$;
reset role;
