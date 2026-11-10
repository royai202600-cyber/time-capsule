-- Always-open HKUST outdoor pilot. Unfinished attempts reset at Hong Kong's
-- local midnight; finished rewards and stamps remain once-only. The Keeper
-- stands on the public footway beside LG7 Lawn (OSM way/240091530@170m),
-- about 220 m from the Piazza Landmark.
begin;

insert into public.hunts(
  id,name_zh,name_en,city_zh,city_en,starts_at,ends_at,
  keeper_lat,keeper_lng,keeper_spot_zh,keeper_spot_en,
  area_lat,area_lng,area_radius_m,landmark,reward_xp,reward_gold,reset_timezone)
select 'hkust-2026-11','香港科技大學城市尋寶','HKUST City Hunt',
  '香港','Hong Kong',now(),'infinity'::timestamptz,
  22.3390965,114.2641011,'LG7草坪','LG7 Lawn',
  22.3374255,114.2629606,800,s.id,300,5,'Asia/Hong_Kong'
from public.sea_shores s
where s.kind='landmark' and s.game_enabled and s.place='hkust'
  and s.source_ref='osm:node/2439950828';

do $$ begin
  if (select count(*) from public.hunts where id='hkust-2026-11')<>1 then
    raise exception 'HKUST Landmark seed missing';
  end if;
  if exists (select 1 from public.hunts h where h.id='hkust-2026-11'
      and public.distance_m(h.keeper_lat,h.keeper_lng,
        h.area_lat,h.area_lng) not between 150 and 400) then
    raise exception 'HKUST Keeper distance outside approved campus exception';
  end if;
  if (select count(*) from public.sea_shores s where s.kind='common'
      and s.game_enabled and public.distance_m(22.3374255,114.2629606,s.lat,s.lng)<=800)<5 then
    raise exception 'HKUST needs five eligible Wayposts';
  end if;
  if (select count(*) from public.corrupted_spots s
      where public.distance_m(22.3374255,114.2629606,s.lat,s.lng)<=800)<5 then
    raise exception 'HKUST needs five capsule spots';
  end if;
end $$;

insert into public.hunt_steps(hunt_id,step_key,ordinal,goal) values
  ('hkust-2026-11','checkin',1,1),
  ('hkust-2026-11','spin',2,3),
  ('hkust-2026-11','restore',3,5),
  ('hkust-2026-11','landmark',4,1),
  ('hkust-2026-11','return',5,1);

commit;
