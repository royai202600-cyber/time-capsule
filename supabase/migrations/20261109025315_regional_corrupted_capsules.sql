-- Roy-approved ten-minute waves and three collectible types per supported region.
-- These lists affect system spawns; existing ownership, starters and Landmark rewards remain valid.
begin;
alter table private.vessel_spawn_rules add column regions text[] not null default '{}'
  check(regions <@ array['Taiwan','Hong Kong','Singapore','Macau']::text[]);
update private.vessel_spawn_rules set regions=case
  when vessel in ('bubble-tea','bento','hot-air-balloon') then array['Taiwan']
  when vessel in ('dim-sum-steamer','postbox','phone-booth') then array['Hong Kong']
  when vessel in ('lucky-stars','mixtape','instant-camera') then array['Singapore']
  when vessel in ('candy-box','musicbox','pocket-watch') then array['Macau']
  else '{}'::text[] end;
update private.game_config set wave_minutes=10,visible_min_minutes=10,visible_max_minutes=10 where singleton;

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
      and (case when spot.city in ('Taipei','Taiwan','Kaohsiung','Taichung','Tainan') then 'Taiwan' else spot.city end)=any(r.regions)
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

-- Dense public park-path seed. OSM API extracts, 2026-11-09; ODbL.
-- Reproduce with scripts/seed-game-public-paths.py; source_ref records path, offset and park.
-- extract tc-osm-hong-kong-kowloon.xml SHA256 ef61680a9f75ba371cfe4aa1a1edce65f3c97c794a11080c9e5271adc693df52
-- extract tc-osm-hong-kong-west.xml SHA256 5c6fcefa6dac722e83263fd4a9ad04b2eed99b89619fd1e4b7dfcf836f2b3133
-- extract tc-osm-hong-kong-waterfront.xml SHA256 f91ee53f1f002c8e20a0f6decc486ebb940620d2a29ed794522bdb84e5eb8edc
insert into public.sea_shores(name_zh,name_en,city_zh,city_en,lat,lng,game_enabled,source_ref,scene) values
('Kowloon Park','Kowloon Park','香港','Hong Kong',22.2995787,114.1702674,true,'osm:way/28379385@125m;park/way/4977404','park'),
('Tsim Sha Tsui Promenade','Tsim Sha Tsui Promenade','香港','Hong Kong',22.2959442,114.1768474,true,'osm:way/102642100@50m;park/relation/12919867','park'),
('Tsim Sha Tsui Promenade','Tsim Sha Tsui Promenade','香港','Hong Kong',22.2989241,114.1846531,true,'osm:way/184475460@25m;park/relation/12919867','park'),
('Public park','Public park','香港','Hong Kong',22.3010396,114.1768303,true,'osm:way/184762372@0m;park/way/605420849','park'),
('Nursery Park','Nursery Park','香港','Hong Kong',22.3021459,114.1545145,true,'osm:way/569303475@25m;park/way/640754028','park'),
('Public park','Public park','香港','Hong Kong',22.2950635,114.1700684,true,'osm:way/605236403@0m;park/way/605236404','park'),
('King George V Memorial Park, Kowloon','King George V Memorial Park, Kowloon','香港','Hong Kong',22.3048384,114.167954,true,'osm:way/839840777@75m;park/way/149524425','park'),
('New Hung Hom Harbourfront','New Hung Hom Harbourfront','香港','Hong Kong',22.297669,114.1824636,true,'osm:way/1495455732@75m;park/way/1495454623','park')
on conflict (source_ref) where source_ref is not null do nothing;
insert into public.corrupted_spots(city,timezone,lat,lng,habitat,source_ref) values
('Hong Kong','Asia/Hong_Kong',22.2995787,114.1702674,'park','osm:way/28379385@125m;park/way/4977404'),
('Hong Kong','Asia/Hong_Kong',22.2959442,114.1768474,'park','osm:way/102642100@50m;park/relation/12919867'),
('Hong Kong','Asia/Hong_Kong',22.2970224,114.1780799,'park','osm:way/102642100@225m;park/relation/12919867'),
('Hong Kong','Asia/Hong_Kong',22.2989241,114.1846531,'park','osm:way/184475460@25m;park/relation/12919867'),
('Hong Kong','Asia/Hong_Kong',22.299504,114.1859678,'park','osm:way/184475460@175m;park/relation/12919867'),
('Hong Kong','Asia/Hong_Kong',22.3010396,114.1768303,'park','osm:way/184762372@0m;park/way/605420849'),
('Hong Kong','Asia/Hong_Kong',22.3012737,114.1707463,'park','osm:way/205701338@0m;park/way/4977404'),
('Hong Kong','Asia/Hong_Kong',22.3021459,114.1545145,'park','osm:way/569303475@25m;park/way/640754028'),
('Hong Kong','Asia/Hong_Kong',22.2950635,114.1700684,'park','osm:way/605236403@0m;park/way/605236404'),
('Hong Kong','Asia/Hong_Kong',22.3048384,114.167954,'park','osm:way/839840777@75m;park/way/149524425'),
('Hong Kong','Asia/Hong_Kong',22.2986857,114.1828091,'park','osm:way/1495454627@100m;park/way/1495454623')
on conflict(source_ref) do nothing;

-- Refresh only the temporary QA batch: old hourly spawn IDs now expire.
delete from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:%';
select private.refresh_taipei_game_demo();
commit;
