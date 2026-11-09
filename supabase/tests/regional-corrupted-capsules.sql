-- Append to the regional migration without COMMIT; hosted transaction rolls back.
do $$ declare region text; spot uuid; seen integer; now_wave bigint; begin
  if not exists(select 1 from private.game_config where wave_minutes=10 and visible_min_minutes=10 and visible_max_minutes=10) then raise exception 'wrong duration';end if;
  if (select count(*) from private.vessel_spawn_rules r cross join lateral unnest(r.regions) region)<>12 then raise exception 'wrong total pool';end if;
  for region in select unnest(array['Taiwan','Hong Kong','Singapore','Macau']) loop
    if (select count(*) from private.vessel_spawn_rules r where region=any(r.regions))<>3 then raise exception 'wrong pool for %',region;end if;
    if (select count(distinct rarity) from private.vessel_spawn_rules r where region=any(r.regions))<>3 then raise exception 'missing rarity for %',region;end if;
    if exists(select 1 from private.vessel_spawn_rules r join public.vessels v on v.id=r.vessel where region=any(r.regions) and (v.brand is not null or v.edition_total is not null or v.earned_place is not null)) then raise exception 'restricted spawn';end if;
    select id into strict spot from public.corrupted_spots where city=case when region='Taiwan' then 'Taipei' else region end and source_ref not like 'qa:%' limit 1;
    now_wave:=floor(extract(epoch from now())/600)::bigint;
    if exists(select 1 from generate_series(now_wave,now_wave+599) w cross join lateral private.resolve_spawn(spot,w) s where not exists(select 1 from private.vessel_spawn_rules r where r.vessel=s.vessel and region=any(r.regions))) then raise exception 'out of pool %',region;end if;
    select count(distinct s.vessel) into seen from generate_series(now_wave,now_wave+599) w cross join lateral private.resolve_spawn(spot,w) s;
    if seen<>3 then raise exception 'unavailable region vessels: %, %',region,seen;end if;
    if exists(select 1 from generate_series(now_wave,now_wave+20) w cross join lateral private.resolve_spawn(spot,w) s where s.expires_at<>to_timestamp((w+1)*600)) then raise exception 'wave expiry';end if;
  end loop;
  if exists(select 1 from public.sea_shores where game_enabled and kind='common' and scene not in ('park','garden','waterfront','square','publicArt')) then raise exception 'bad scene';end if;
  if (select count(*) from public.corrupted_spots where city='Hong Kong')<10 then raise exception 'missing HK spots';end if;
  if exists(select 1 from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:%') then raise exception 'superseded temporary batch';end if;
end $$;
select 'PASS: ten-minute waves, fixed expiry, 12 allowed vessels, three rarities/types per region across 600 waves each, safe HK seeds and QA batch' as result;
rollback;
