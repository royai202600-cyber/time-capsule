-- Senado Square test hunt. Keeper sits on the public footway through
-- Jorge Alvares Square (OSM way/422643353); the existing Landmark is the
-- Senado Square fountain seal, without a map monument.
begin;

insert into public.hunts(
  id,name_zh,name_en,city_zh,city_en,starts_at,ends_at,
  keeper_lat,keeper_lng,keeper_spot_zh,keeper_spot_en,
  area_lat,area_lng,area_radius_m,landmark,reward_xp,reward_gold,reset_timezone)
select 'senado-square-2026-11','議事亭前地城市尋寶','Senado Square City Hunt',
  '澳門','Macau',now(),('2026-11-30 23:59:00 Asia/Macau')::timestamptz,
  22.1911014,113.5395126,'區華利前地','Jorge Álvares Square',
  22.19383,113.53999,800,s.id,300,5,'Asia/Macau'
from public.sea_shores s
where s.kind='landmark' and s.game_enabled and s.place='senado'
  and s.source_ref='osm:way/192573684';

do $$
begin
  if (select count(*) from public.hunts where id='senado-square-2026-11')<>1 then
    raise exception 'Senado Square Landmark seed missing';
  end if;
  if (select count(*) from public.sea_shores s where s.kind='common' and s.game_enabled
    and public.distance_m(22.19383,113.53999,s.lat,s.lng)<=800)<5 then
    raise exception 'Senado Square needs five eligible Wayposts';
  end if;
  if (select count(*) from public.corrupted_spots s
    where public.distance_m(22.19383,113.53999,s.lat,s.lng)<=800)<5 then
    raise exception 'Senado Square needs five capsule spots';
  end if;
end $$;

insert into public.hunt_steps(hunt_id,step_key,ordinal,goal) values
  ('senado-square-2026-11','checkin',1,1),
  ('senado-square-2026-11','spin',2,3),
  ('senado-square-2026-11','restore',3,5),
  ('senado-square-2026-11','landmark',4,1),
  ('senado-square-2026-11','return',5,1);

commit;
