-- Roy-requested persistent public testing demos, separate from disposable release QA.
-- Run once; existing demo shores make retries idempotent. Do not remove older Roy bottles.
begin;
do $$
declare sender_id uuid; shore_id uuid; capsule_id uuid; i integer; n integer;
  demo_lat double precision; demo_lng double precision; north double precision; east double precision;
  placed boolean;
begin
  select id into strict sender_id from auth.users where email='sea-s1-demo-3844bd@timecapsule.test';
  for i in 1..3 loop
    if exists(select 1 from public.sea_shores where source_ref='qa:roy-taipei-public:'||i) then continue; end if;
    placed:=false;
    for n in 1..2000 loop
      north:=random()*160-80;east:=random()*110-55;
      if north*north+east*east not between 25*25 and 85*85 then continue;end if;
      demo_lat:=25.037546+north/111195;
      demo_lng:=121.562754+east/(111195*cos(radians(25.037546)));
      -- This rectangle stays in the inspected OSM Civic Square public park polygon.
      if exists(select 1 from public.sea_shores s where s.source_ref like 'qa:roy-taipei-public:%'
        and public.distance_m(demo_lat,demo_lng,s.lat,s.lng)<30) then continue;end if;
      if exists(select 1 from public.corrupted_spots s where s.source_ref like 'qa:roy-taipei-game:%'
        and public.distance_m(demo_lat,demo_lng,s.lat,s.lng)<28) then continue;end if;
      placed:=true;exit;
    end loop;
    if not placed then raise exception 'Could not place Taipei public test capsule';end if;
    insert into public.sea_shores(name_zh,name_en,city_zh,city_en,lat,lng,game_enabled,source_ref)
      values('市民廣場測試膠囊 '||i,'Civic Square test capsule '||i,'台北','Taipei',demo_lat,demo_lng,false,'qa:roy-taipei-public:'||i) returning id into shore_id;
    insert into public.capsules(sender,recipient,vessel,hint,sealed_at,open_at,sea,shore)
      values(sender_id,null,'bottle','測試膠囊 / Test capsule',now()-interval '1 day',now()-interval '1 minute',true,shore_id) returning id into capsule_id;
    insert into public.capsule_contents(capsule_id,message) values(capsule_id,
      E'這是一個測試用的公開膠囊。謝謝你停下來，願你今天有個小小的驚喜。\n\nThis is a public test capsule. Thanks for stopping by—may today bring you a small surprise.');
  end loop;
end $$;
select c.id,s.lat,s.lng,round(public.distance_m(25.037546,121.562754,s.lat,s.lng)) as distance_m,c.open_at
from public.capsules c join public.sea_shores s on s.id=c.shore where s.source_ref like 'qa:roy-taipei-public:%';
commit;
