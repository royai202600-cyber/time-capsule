-- Run only in a rollback transaction or in a disposable database.
create function pg_temp.dodge_fixture() returns jsonb language plpgsql as $$
declare
  post public.public_capsule_spots;
  wave record;
  cfg private.game_config;
  rules private.vessel_spawn_rules[];
  places private.vessel_spawn_places[];
  spawns jsonb;
begin
  select * into strict post from public.public_capsule_spots where kind='landmark' and place='taipei101';
  select * into strict wave from private.game_wave_at(now());
  select * into strict cfg from private.game_config where singleton;
  cfg.spawn_chance:=1;
  cfg.rarity_common_weight:=1;
  cfg.rarity_uncommon_weight:=1;
  cfg.rarity_rare_weight:=1;
  select array_agg(row(vessel,rarity,null,null,null,null,null)::private.vessel_spawn_rules),
    array_agg(row('taipei',vessel)::private.vessel_spawn_places)
    into rules,places
    from (values ('photo-strip','common'),('bubble-tea','uncommon'),('bento','rare')) v(vessel,rarity);
  insert into private.game_spawn_revisions(starts_at,config,rules,places)
    values(wave.starts_at,cfg,rules,places)
    on conflict(starts_at) do update set config=excluded.config,rules=excluded.rules,places=excluded.places;
  -- Cover a wave rollover while API requests are still in progress.
  insert into private.game_spawn_revisions(starts_at,config,rules,places)
    values(wave.ends_at,cfg,rules,places)
    on conflict(starts_at) do update set config=excluded.config,rules=excluded.rules,places=excluded.places;
  update private.game_config set restore_common=1,restore_uncommon=1,restore_rare=1 where singleton;

  insert into public.corrupted_spots(city,timezone,lat,lng,habitat,source_ref)
    select 'Taipei','Asia/Taipei',post.lat,post.lng,'square','qa:df1:'||gen_random_uuid()
    from generate_series(1,120);
  select jsonb_object_agg(rarity,ids) into spawns
  from (
    select s.rarity,jsonb_agg(s.spawn_id order by s.spawn_id) as ids
    from public.corrupted_spots p
    cross join lateral private.resolve_spawn(p.id,wave.wave) s
    where p.source_ref like 'qa:df1:%'
    group by s.rarity
  ) options;
  assert jsonb_array_length(spawns->'common')>=8;
  assert jsonb_array_length(spawns->'uncommon')>=1;
  assert jsonb_array_length(spawns->'rare')>=1;
  return jsonb_build_object('waypost',post.id,'lat',post.lat,'lng',post.lng,'spawns',spawns);
end $$;
