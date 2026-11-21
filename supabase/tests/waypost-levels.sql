-- Run with the WL1 migration in a transaction and roll back.
create function pg_temp.wl1_expect_error(statement text, expected text) returns void
language plpgsql as $$
begin
  execute statement;
  raise exception 'Expected error %', expected;
exception when others then
  if sqlerrm <> expected then raise; end if;
end $$;

do $$
declare
  player uuid := 'f0710000-0000-4000-8000-000000000001';
  editor uuid := 'f0710000-0000-4000-8000-000000000002';
  viewer uuid := 'f0710000-0000-4000-8000-000000000003';
  post public.public_capsule_spots;
  other_post public.public_capsule_spots;
  capsule uuid;
  spin record;
  cfg private.game_config;
  audit private.admin_actions;
  original jsonb;
  rewards jsonb;
  progress jsonb;
  rare text;
  wax_range jsonb := '[{"kind":"wax","min":14,"max":16,"chance":100}]';
  gold_drops integer := 0;
  wax_counts integer[] := '{}';
  roll_seed double precision;
  gold_seed double precision;
  no_gold_seed double precision;
  old_wax integer;
begin
  insert into auth.users(id,email) values (player,'wl1-player@example.invalid'),
    (editor,'wl1-editor@example.invalid'), (viewer,'wl1-viewer@example.invalid');
  insert into public.profiles(id,name) values (player,'WL1 player'),(editor,'WL1 admin'),(viewer,'WL1 viewer')
    on conflict do nothing;
  insert into private.admin_members(user_id,role) values (editor,'admin'),(viewer,'viewer');
  insert into private.game_speed_allowlist(user_id) values (player);

  select * into strict post from public.public_capsule_spots
    where city_en = 'Taipei' and kind = 'common' and game_enabled and hidden_at is null order by id limit 1;
  select * into strict other_post from public.public_capsule_spots
    where city_en = 'Taipei' and kind = 'common' and game_enabled and hidden_at is null and id <> post.id
    order by id limit 1;
  assert not has_function_privilege('anon','public.waypost_level(uuid)','execute');
  assert not has_table_privilege('authenticated','private.waypost_xp_daily','select');

  select * into strict cfg from private.game_config where singleton;
  assert cfg.spin_wax_min = 10 and cfg.spin_wax_max = 10 and cfg.spin_gold_chance = 0.05 and cfg.spin_gold_award = 1;
  assert not exists (
    select 1
    from (values (1,0,10,5,0),(2,100,12,5,0),(3,300,12,10,0),(4,700,14,20,0),(5,1500,15,20,5))
      as expected(level, xp, wax, gold_chance, rare_chance)
    left join private.waypost_levels l using (level)
    where l.xp_from is distinct from expected.xp
      or l.items is distinct from jsonb_build_array(
        jsonb_build_object('kind','wax','vessel',null,'min',expected.wax,'max',expected.wax,'chance',100),
        jsonb_build_object('kind','gold','vessel',null,'min',1,'max',1,'chance',expected.gold_chance)
      ) || case when expected.rare_chance > 0 then
        jsonb_build_array(jsonb_build_object('kind','vessel','vessel',null,'min',1,'max',1,'chance',expected.rare_chance))
      else '[]'::jsonb end
  ), 'The seeded wax counts and gold and vessel odds must match the nondecreasing default levels';

  -- Match the pre-WL1 roll order: the first draw selects the wax count
  -- and the second rolls gold. Find a seed for each outcome, then use
  -- those same seeds on actual level-one spins.
  for i in 1..128 loop
    roll_seed := i / 128.0;
    perform setseed(roll_seed);
    old_wax := cfg.spin_wax_min + floor(random() * (cfg.spin_wax_max - cfg.spin_wax_min + 1))::integer;
    assert old_wax = 10;
    if random() < cfg.spin_gold_chance then gold_seed := roll_seed;
    else no_gold_seed := roll_seed;
    end if;
    exit when gold_seed is not null and no_gold_seed is not null;
  end loop;
  assert gold_seed is not null and no_gold_seed is not null;

  perform set_config('request.jwt.claim.sub',player::text,true);
  perform pg_temp.wl1_expect_error('select public.admin_waypost_levels()', 'forbidden');
  perform pg_temp.wl1_expect_error(format('select public.admin_waypost_level_set(4,700,%L)',wax_range), 'forbidden');
  perform pg_temp.wl1_expect_error(format('select * from public.waypost_spin(%L,0,0,10)', post.id), 'too_far');

  progress := public.waypost_level(post.id);
  assert progress @> '{"level":1,"xp":0,"level_xp":0,"next_xp":100,"me":{"spins":0,"capsules":0,"opened":0}}';
  perform setseed(no_gold_seed);
  select * into strict spin from public.waypost_spin(post.id,post.lat,post.lng,10);
  assert spin.wax_awarded = 10 and spin.gold_awarded = 0 and spin.vessel_awarded is null;
  assert spin.cooldown_end > now() and spin.xp_gained > 0;
  perform pg_temp.wl1_expect_error(format('select * from public.waypost_spin(%L,%L,%L,10)',post.id,post.lat,post.lng), 'cooldown');
  update public.waypost_spins set spun_at = now() - interval '1 day' where user_id = player;
  perform setseed(gold_seed);
  select * into strict spin from public.waypost_spin(post.id,post.lat,post.lng,10);
  assert spin.wax_awarded = 10 and spin.gold_awarded = cfg.spin_gold_award and spin.vessel_awarded is null;
  assert (public.waypost_level(post.id)->>'xp')::integer = 5;

  for i in 1..2 loop
    perform public.rack_leave(post.id,post.lat,post.lng,10,'A test letter','WL1 test',1);
  end loop;
  assert (public.waypost_level(post.id)->>'xp')::integer = 20;
  assert (public.waypost_rack(post.id,'mine',null)->>'count')::integer = 2;

  for i in 1..4 loop
    perform set_config('request.jwt.claim.sub',editor::text,true);
    capsule := (public.rack_leave(post.id,post.lat,post.lng,10,'A test letter','WL1 test',1,'Test question','Test answer')->>'capsule_id')::uuid;
    update public.capsules set open_at = now()-interval '1 hour' where id = capsule;
    perform set_config('request.jwt.claim.sub',player::text,true);
    perform pg_temp.wl1_expect_error(format('select public.rack_open(%L,%L,%L,10,%L)', capsule,post.lat,post.lng,'wrong'), 'wrong_answer');
    assert public.rack_open(capsule,post.lat,post.lng,10,'Test answer')->>'message' = 'A test letter';
    perform pg_temp.wl1_expect_error(format('select public.rack_open(%L,%L,%L,10,%L)', capsule,post.lat,post.lng,'Test answer'), 'taken');
  end loop;
  assert public.waypost_level(post.id) @> '{"level":2,"xp":110,"level_xp":100,"next_xp":300,"me":{"spins":1,"capsules":1,"opened":3}}';
  assert exists (select 1 from private.waypost_xp_daily where user_id=player and waypost_id=post.id
    and local_day=(statement_timestamp() at time zone 'Asia/Taipei')::date);
  update private.waypost_xp_daily set local_day = local_day-1 where user_id=player and waypost_id=post.id;
  update public.waypost_spins set spun_at = now()-interval '1 day' where user_id=player;
  select * into strict spin from public.waypost_spin(post.id,post.lat,post.lng,10);
  assert spin.wax_awarded = 12 and (public.waypost_level(post.id)->>'xp')::integer = 115;
  perform public.rack_leave(other_post.id,other_post.lat,other_post.lng,10,'A second post','WL1 test',1);
  assert public.waypost_level(other_post.id) @> '{"level":1,"xp":15,"me":{"spins":0,"capsules":1,"opened":0}}';

  update private.waypost_xp set xp=95 where waypost_id=other_post.id;
  select * into strict spin from public.waypost_spin(other_post.id,other_post.lat,other_post.lng,10);
  assert spin.wax_awarded = 10;
  assert public.waypost_level(other_post.id) @> '{"level":2,"xp":100,"level_xp":100,"next_xp":300}';

  -- Check the exact default boundaries and their spin rewards. The player
  -- already reached today's spin cap at this Waypost.
  for boundary in 3..5 loop
    update private.waypost_xp set xp=(select xp_from from private.waypost_levels where level=boundary)
      where waypost_id=other_post.id;
    update public.waypost_spins set spun_at=now()-interval '1 day' where user_id=player;
    assert (public.waypost_level(other_post.id)->>'level')::integer = boundary;
    select * into strict spin from public.waypost_spin(other_post.id,other_post.lat,other_post.lng,10);
    assert spin.wax_awarded = (array[12,14,15])[boundary-2] and spin.gold_awarded in (0,1);
  end loop;

  delete from public.owned_vessels where user_id=player;

  perform set_config('request.jwt.claim.sub',viewer::text,true);
  assert jsonb_array_length(public.admin_waypost_levels()) = 5;
  assert public.waypost_level(post.id) @> '{"me":{"spins":0,"capsules":0,"opened":0}}';
  perform pg_temp.wl1_expect_error(format('select public.admin_waypost_level_set(4,700,%L)',wax_range), 'forbidden');

  perform set_config('request.jwt.claim.sub',editor::text,true);
  perform pg_temp.wl1_expect_error(format('select public.admin_waypost_level_set(1,1,%L)',wax_range), 'order');
  perform pg_temp.wl1_expect_error(format('select public.admin_waypost_level_set(4,300,%L)',wax_range), 'order');
  perform pg_temp.wl1_expect_error(format('select public.admin_waypost_level_set(4,1500,%L)',wax_range), 'order');
  perform pg_temp.wl1_expect_error($q$select public.admin_waypost_level_set(4,700,'[]')$q$, 'items');
  perform pg_temp.wl1_expect_error($q$select public.admin_waypost_level_set(4,700,'[{"kind":"gold","min":1,"max":99,"chance":0}]')$q$, 'range');
  perform pg_temp.wl1_expect_error($q$select public.admin_waypost_level_set(4,700,'[{"kind":"gold","min":1.5,"max":99,"chance":100}]')$q$, 'range');
  perform pg_temp.wl1_expect_error($q$select public.admin_waypost_level_set(4,700,'[{"kind":"gold","min":1,"max":100,"chance":100}]')$q$, 'range');

  original := public.admin_waypost_levels();
  perform public.admin_waypost_level_set(4,700,wax_range,'WL1 range check');
  select * into strict audit from private.admin_actions where actor=editor and action='config.waypost_level';
  assert audit.note = 'WL1 range check' and public.admin_activity(5,null)::text like '%WL1 range check%';
  assert public.admin_undo(audit.id) = audit.before;
  assert public.admin_waypost_levels() = original;
  perform pg_temp.wl1_expect_error(format('select public.admin_undo(%s)',audit.id), 'stale');
  assert public.admin_set_spin_reward(9,9,'WL1 legacy check') = '{"spin_wax_min":9,"spin_wax_max":9}';
  assert public.admin_spawning()->'config' @> '{"spin_wax_min":9,"spin_wax_max":9}';
  select * into strict audit from private.admin_actions where actor=editor and action='config.spin';
  assert public.admin_undo(audit.id) = '{"spin_wax_min":10,"spin_wax_max":10}';

  -- Deterministic range and probability coverage, with only the disposable
  -- player's cooldown timestamps aged between rolls.
  rewards := wax_range || '[{"kind":"gold","min":1,"max":1,"chance":20},
    {"kind":"vessel","min":2,"max":2,"chance":100,"vessel":null},
    {"kind":"vessel","min":3,"max":3,"chance":100,"vessel":"bottle"}]';
  perform public.admin_waypost_level_set(5,1500,rewards,'WL1 controlled drops');
  update private.waypost_xp set xp=1500 where waypost_id=post.id;
  perform set_config('request.jwt.claim.sub',player::text,true);
  rare := private.waypost_rare_vessel('Taipei');
  assert rare is not null;
  assert public.waypost_level(post.id) @> '{"level":5,"xp":1500,"next_xp":null,"next_items":null}';
  perform setseed(0.123);
  for i in 1..30 loop
    update public.waypost_spins set spun_at=now()-interval '1 day' where user_id=player;
    select * into strict spin from public.waypost_spin(post.id,post.lat,post.lng,10);
    assert spin.wax_awarded between 14 and 16 and spin.gold_awarded in (0,1) and spin.vessel_awarded is not null;
    gold_drops := gold_drops + spin.gold_awarded;
    wax_counts := array_append(wax_counts, spin.wax_awarded);
  end loop;
  assert gold_drops between 1 and 29;
  assert wax_counts @> array[14,15,16];
  assert (select sum(copies) = 60 from public.owned_vessels where user_id=player and vessel <> 'bottle');
  assert exists (select 1 from public.owned_vessels where user_id=player and vessel='bottle' and copies is null);
  assert (public.waypost_level(post.id)->>'xp')::integer = 1500;
end $$;

select 'PASS: WL1 levels, spin/rack XP, local day, rewards, roles, Activity and Undo' as result;
