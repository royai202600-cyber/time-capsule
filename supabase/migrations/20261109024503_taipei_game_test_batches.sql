-- Roy-requested temporary production QA, scoped to Civic Square's 100 m pickup circle.
-- Existing OSM spots, catches, capsule ownership, gameplay settings and RPC grants stay intact.
begin;
create extension if not exists pg_cron;

create function private.refresh_taipei_game_demo() returns void
language plpgsql set search_path='' as $$
declare
  batch bigint := floor(extract(epoch from now())/600)::bigint;
  wave bigint; i integer; n integer; spot uuid; released record;
  north double precision; east double precision; demo_lat double precision; demo_lng double precision;
  placed boolean;
  -- OSM way/309157011, inspected 2026-11-09. Clip samples to the public park polygon.
  safe_area polygon := '((121.5634500,25.0390412),(121.5634144,25.0373910),(121.5633978,25.0366291),(121.5633737,25.0360564),(121.5633501,25.0360012),(121.5631544,25.0360047),(121.5620735,25.0360240),(121.5620570,25.0360396),(121.5620932,25.0377011),(121.5620942,25.0377529),(121.5623006,25.0377481),(121.5623019,25.0378122),(121.5623114,25.0382507),(121.5623209,25.0387012),(121.5623233,25.0388075),(121.5623255,25.0389155),(121.5623275,25.0390118),(121.5623291,25.0390898),(121.5634181,25.0390713),(121.5634500,25.0390412))';
begin
  perform pg_advisory_xact_lock(hashtext('roy-taipei-game-demo'));
  if (select count(*) from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:'||batch||':%')=5 then return; end if;
  delete from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:%';
  select floor(extract(epoch from now())/(wave_minutes*60))::bigint into wave from private.game_config where singleton;
  for i in 1..5 loop
    placed := false;
    for n in 1..2000 loop
      -- Independent random positions; no ring, grid, equal angles or fixed radii.
      north := random()*176-88; east := random()*176-88;
      if north*north+east*east not between 28*28 and 88*88 then continue; end if;
      demo_lat := 25.037546+north/111195;
      demo_lng := 121.562754+east/(111195*cos(radians(25.037546)));
      if not point(demo_lng,demo_lat) <@ safe_area then continue; end if;
      if exists(select 1 from public.corrupted_spots s where s.source_ref like 'qa:roy-taipei-game:%'
        and public.distance_m(demo_lat,demo_lng,s.lat,s.lng)<36) then continue; end if;
      spot := gen_random_uuid();
      insert into public.corrupted_spots(id,city,timezone,lat,lng,habitat,source_ref)
        values(spot,'Taipei','Asia/Taipei',demo_lat,demo_lng,'square','qa:roy-taipei-game:'||batch||':'||i);
      select * into released from private.resolve_spawn(spot,wave);
      if released.spawn_id is not null and released.expires_at>now() then placed:=true; exit; end if;
      delete from public.corrupted_spots where id=spot;
    end loop;
    if not placed then raise exception 'Could not place temporary Taipei test batch'; end if;
  end loop;
end $$;
revoke all on function private.refresh_taipei_game_demo() from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.resolve_spawn(p_spot uuid, p_wave bigint)
 RETURNS TABLE(spawn_id text, vessel text, rarity text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare spot public.corrupted_spots; cfg private.game_config; wave_at timestamptz;
  local_hour integer; local_md text; chosen_rarity text; picked text;
  rarity_roll double precision; total_weight integer; visible_minutes integer;
begin
  select * into spot from public.corrupted_spots where id=p_spot;
  if spot.id is null then return; end if;
  select * into cfg from private.game_config where singleton;
  wave_at := to_timestamp(p_wave * cfg.wave_minutes * 60);
  if private.game_roll(p_spot::text||':'||p_wave||':show') >= cfg.spawn_chance
    then return; end if;
  local_hour := extract(hour from wave_at at time zone spot.timezone)::integer;
  local_md := to_char(wave_at at time zone spot.timezone,'MM-DD');
  rarity_roll := private.game_roll(p_spot::text||':'||p_wave||':rarity');
  total_weight := cfg.rarity_common_weight+cfg.rarity_uncommon_weight+cfg.rarity_rare_weight;
  chosen_rarity := case
    when rarity_roll < cfg.rarity_common_weight::double precision/total_weight then 'common'
    when rarity_roll < (cfg.rarity_common_weight+cfg.rarity_uncommon_weight)::double precision/total_weight
      then 'uncommon' else 'rare' end;
  select r.vessel into picked from private.vessel_spawn_rules r
    where r.rarity = chosen_rarity
      and (r.habitat is null or r.habitat=spot.habitat)
      and (r.local_start_hour is null
        or (r.local_start_hour < r.local_end_hour and local_hour >= r.local_start_hour and local_hour < r.local_end_hour)
        or (r.local_start_hour > r.local_end_hour and (local_hour >= r.local_start_hour or local_hour < r.local_end_hour)))
      and (r.month_day_start is null
        or (r.month_day_start <= r.month_day_end and local_md between r.month_day_start and r.month_day_end)
        or (r.month_day_start > r.month_day_end and (local_md >= r.month_day_start or local_md <= r.month_day_end)))
    order by private.game_roll(p_spot::text||':'||p_wave||':vessel:'||r.vessel)
    limit 1;
  if picked is null then return; end if;
  visible_minutes := cfg.visible_min_minutes + floor(
    private.game_roll(p_spot::text||':'||p_wave||':duration') *
    (cfg.visible_max_minutes-cfg.visible_min_minutes+1))::integer;
  spawn_id := p_spot::text||':'||p_wave::text;
  vessel := picked; rarity := chosen_rarity;
  expires_at := wave_at + make_interval(mins=>visible_minutes);
  -- Temporary Roy QA spots expire at their fixed ten-minute batch boundary.
  if spot.source_ref ~ '^qa:roy-taipei-game:[0-9]+:[0-9]+$' then
    expires_at := least(expires_at,to_timestamp((split_part(spot.source_ref,':',3)::bigint+1)*600));
  end if;
  return next;
end $function$;

select private.refresh_taipei_game_demo();
select cron.schedule('time-capsule-taipei-test-batch','*/10 * * * *','select private.refresh_taipei_game_demo();');
commit;
