-- Deploy the app with all regional art before applying this migration.
insert into public.vessels(id, price_mop, sort, brand, edition_total, earned_place)
values
  ('pineapple-cake', 12, 69, null, null, null),
  ('teapot', 18, 70, null, null, null),
  ('sky-lantern', 24, 71, null, null, null),
  ('rwb-bag', 12, 72, null, null, null),
  ('bolo-bun', 16, 73, null, null, null),
  ('tram', 26, 74, null, null, null),
  ('tiffin', 12, 75, null, null, null),
  ('kamcheng', 18, 76, null, null, null),
  ('orchid', 24, 77, null, null, null),
  ('egg-tart', 12, 78, null, null, null),
  ('rooster', 16, 79, null, null, null),
  ('pedicab', 24, 80, null, null, null);

insert into private.vessel_spawn_rules(vessel, rarity, regions)
values
  ('pineapple-cake', 'common', array['Taiwan']),
  ('teapot', 'uncommon', array['Taiwan']),
  ('sky-lantern', 'rare', array['Taiwan']),
  ('rwb-bag', 'common', array['Hong Kong']),
  ('bolo-bun', 'uncommon', array['Hong Kong']),
  ('tram', 'rare', array['Hong Kong']),
  ('tiffin', 'common', array['Singapore']),
  ('kamcheng', 'uncommon', array['Singapore']),
  ('orchid', 'rare', array['Singapore']),
  ('egg-tart', 'common', array['Macau']),
  ('rooster', 'uncommon', array['Macau']),
  ('pedicab', 'rare', array['Macau']);

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
  select r.vessel, r.rarity into picked, rarity from private.vessel_spawn_rules r
    where (case when spot.city in ('Taipei','Taiwan','Kaohsiung','Taichung','Tainan') then 'Taiwan' else spot.city end)=any(r.regions)
      and (r.habitat is null or r.habitat=spot.habitat)
      and (r.local_start_hour is null
        or (r.local_start_hour < r.local_end_hour and local_hour >= r.local_start_hour and local_hour < r.local_end_hour)
        or (r.local_start_hour > r.local_end_hour and (local_hour >= r.local_start_hour or local_hour < r.local_end_hour)))
      and (r.month_day_start is null
        or (r.month_day_start <= r.month_day_end and local_md between r.month_day_start and r.month_day_end)
        or (r.month_day_start > r.month_day_end and (local_md >= r.month_day_start or local_md <= r.month_day_end)))
    -- Prefer the rolled tier, then the neighboring tiers, lower first.
    order by array_position(case chosen_rarity
        when 'common' then array['common','uncommon','rare']
        when 'uncommon' then array['uncommon','common','rare']
        else array['rare','uncommon','common'] end, r.rarity),
      private.game_roll(p_spot::text||':'||p_wave||':vessel:'||r.vessel), r.vessel
    limit 1;
  if picked is null then return; end if;
  visible_minutes := cfg.visible_min_minutes + floor(
    private.game_roll(p_spot::text||':'||p_wave||':duration') *
    (cfg.visible_max_minutes-cfg.visible_min_minutes+1))::integer;
  spawn_id := p_spot::text||':'||p_wave::text;
  vessel := picked;
  expires_at := wave_at + make_interval(mins=>visible_minutes);
  -- Temporary Roy QA spots expire at their fixed ten-minute batch boundary.
  if spot.source_ref ~ '^qa:roy-taipei-game:[0-9]+:[0-9]+$' then
    expires_at := least(expires_at,to_timestamp((split_part(spot.source_ref,':',3)::bigint+1)*600));
  end if;
  return next;
end $function$;
