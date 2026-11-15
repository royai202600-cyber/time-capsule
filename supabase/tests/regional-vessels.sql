-- Run after the regional migration inside a transaction. The final fixtures
-- temporarily change rules to exercise fallback, so roll back the transaction.
do $check$
declare
  sample record;
  result record;
  wave bigint;
  sample_count integer;
begin
  if (select count(*) from public.vessels where sort between 69 and 80
      and brand is null and edition_total is null and earned_place is null) <> 12
    or exists (select 1 from public.vessels where id in ('north-gate','durian','lighthouse')) then
    raise exception 'Regional catalogue mismatch';
  end if;

  if not exists (select 1 from private.game_config where singleton
      and wave_minutes=10 and visible_min_minutes=10 and visible_max_minutes=10) then
    raise exception 'Ten-minute wave configuration changed';
  end if;

  for sample in
    select distinct on (city) city, id
    from public.corrupted_spots
    where city in ('Taipei','Hong Kong','Singapore','Macau')
      and source_ref not like 'qa:%'
    order by city, id
  loop
    -- A week of ten-minute batches per region covers both vessels in each tier.
    for result in
      with actual as (
        select s.vessel, s.rarity, count(*) as n
        from generate_series(2990000,2991439) as w
        cross join lateral private.resolve_spawn(sample.id,w) s
        where s.expires_at=to_timestamp((w+1)*600) and s.spawn_id=sample.id::text||':'||w
        group by 1,2
      ), expected as (
        select r.vessel,r.rarity
        from private.vessel_spawn_rules r
        where (case sample.city when 'Taipei' then 'Taiwan' else sample.city end)=any(r.regions)
      )
      select coalesce(e.vessel,a.vessel) as vessel, e.rarity, a.n,
        count(*) over (partition by e.rarity) as pool_size,
        sum(a.n) over (partition by e.rarity) as tier_count
      from expected e full join actual a using (vessel,rarity)
    loop
      if result.rarity is null or result.pool_size <> 2 or result.n is null
        or result.n::numeric / result.tier_count not between .30 and .70 then
        raise exception 'Unexpected pool or choice distribution: % %',sample.city,result;
      end if;
    end loop;
  end loop;

  select id into sample from public.corrupted_spots
    where city='Taipei' and source_ref not like 'qa:%' order by id limit 1;

  select w into wave
  from generate_series(2990000,2991439) w
  cross join lateral private.resolve_spawn(sample.id,w) s
  where s.rarity='rare'
  limit 1;
  if wave is null then raise exception 'No rare fallback test wave'; end if;

  -- The same rolled rare wave falls back first to uncommon, then common.
  update private.vessel_spawn_rules set regions=array_remove(regions,'Taiwan')
    where 'Taiwan'=any(regions) and rarity='rare';
  select * into result from private.resolve_spawn(sample.id,wave);
  if result.rarity is distinct from 'uncommon' then raise exception 'Expected uncommon fallback: %',result; end if;

  update private.vessel_spawn_rules set regions=array_remove(regions,'Taiwan')
    where 'Taiwan'=any(regions) and rarity='uncommon';
  select * into result from private.resolve_spawn(sample.id,wave);
  if result.rarity is distinct from 'common' then raise exception 'Expected common fallback: %',result; end if;

  update private.vessel_spawn_rules set regions=array_remove(regions,'Taiwan') where 'Taiwan'=any(regions);
  select count(*) into sample_count from private.resolve_spawn(sample.id,wave);
  if sample_count <> 0 then raise exception 'Borrowed a vessel from another region'; end if;
end
$check$;
