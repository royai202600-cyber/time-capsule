-- Run after dodge-fight-fixtures.sql inside the migration's rollback transaction.
create function pg_temp.expect_fight_error(query text, expected text) returns void language plpgsql as $$
begin
  execute query;
  raise exception 'Expected % from %',expected,query;
exception when others then
  if sqlerrm<>expected then raise; end if;
end $$;

do $$
declare
  player uuid := gen_random_uuid();
  rival uuid := gen_random_uuid();
  fixture jsonb := pg_temp.dodge_fixture();
  spawns jsonb := fixture->'spawns';
  lat double precision := (fixture->>'lat')::double precision;
  lng double precision := (fixture->>'lng')::double precision;
  post uuid := (fixture->>'waypost')::uuid;
  cfg private.game_config;
  tier text;
  spawn text;
  hp integer;
  fight record;
  resumed record;
  out record;
  first_fight uuid;
  prev_balance integer;
  request text;
begin
  insert into auth.users(id,email) values (player,'df1-'||player||'@example.invalid'),
    (rival,'df1-'||rival||'@example.invalid');
  insert into public.profiles(id,name) values (player,'DF1 rollback'),(rival,'DF1 rival') on conflict do nothing;
  perform set_config('request.jwt.claim.sub',player::text,true);
  perform private.ensure_player(player);
  update public.player_game set wax_balls=100,gold_balls=100 where user_id=player;
  select * into strict cfg from private.game_config where singleton;
  assert cfg.landmark_cracks=20 and cfg.landmark_seconds=150;

  for tier,hp in select * from (values ('common',3),('uncommon',4),('rare',5)) v loop
    spawn := spawns->tier->>0;
    select * into strict fight from public.corrupted_fight_start(spawn,lat,lng,10);
    assert fight.health=hp and fight.max_health=hp and fight.attempts_left=cfg.max_attempts;
    for i in 1..hp loop
      select * into strict out from public.corrupted_fight_throw(fight.fight_id,lat,lng,10,'wax');
      assert out.health=hp-i;
      if i<hp then
        assert out.result='hit' and out.attempts_left=cfg.max_attempts and out.xp_gained=0;
        if i=1 then
          request := format('select public.corrupted_fight_throw(%L,%L,%L,10,''wax'')',fight.fight_id,lat,lng);
          perform pg_temp.expect_fight_error(request,'too_soon');
          select * into strict resumed from public.corrupted_fight_start(spawn,lat,lng,10);
          assert resumed.fight_id=fight.fight_id and resumed.health=hp-1;
          assert (select wax_balls=out.wax_balls from public.player_game where user_id=player);
        end if;
        update private.corrupted_fights set last_throw_at=clock_timestamp()-interval '800 milliseconds'
          where id=fight.fight_id;
      else
        assert out.result='restored' and out.attempts_left=cfg.max_attempts-1 and out.stars=1;
        assert out.is_new and out.copies=(select copies_per_catch from private.vessel_copy_settings where singleton);
        assert out.xp_gained=cfg.xp_catch+cfg.xp_new_vessel+
          case when tier='common' then cfg.xp_first_daily_catch else 0 end;
        perform pg_temp.expect_fight_error(format('select public.corrupted_fight_start(%L,%L,%L,10)',spawn,lat,lng),'already_caught');
      end if;
    end loop;
  end loop;

  spawn := spawns->'common'->>1;
  select * into strict fight from public.corrupted_fight_start(spawn,lat,lng,10);
  first_fight := fight.fight_id;
  select * into strict out from public.corrupted_fight_throw(first_fight,lat,lng,10,'gold');
  assert out.result='hit' and out.health=1 and out.gold_balls=99;
  prev_balance := out.gold_balls;
  perform set_config('request.jwt.claim.sub',rival::text,true);
  perform pg_temp.expect_fight_error(format('select public.corrupted_fight_loss(%L,%L,%L,10)',first_fight,lat,lng),'expired');
  perform set_config('request.jwt.claim.sub',player::text,true);
  for i in 1..cfg.max_attempts loop
    select * into strict out from public.corrupted_fight_loss(fight.fight_id,lat,lng,10);
    assert out.result='lost' and out.attempts_left=cfg.max_attempts-i;
    perform pg_temp.expect_fight_error(format('select public.corrupted_fight_loss(%L,%L,%L,10)',fight.fight_id,lat,lng),'expired');
    if i<cfg.max_attempts then
      select * into strict fight from public.corrupted_fight_start(spawn,lat,lng,10);
      assert fight.fight_id<>first_fight and fight.health=3 and fight.attempts_left=cfg.max_attempts-i;
    end if;
  end loop;
  assert (select gold_balls=prev_balance from public.player_game where user_id=player);
  assert (select result='failed' and attempts=cfg.max_attempts from public.corrupted_catches
    where user_id=player and spawn_id=spawn);
  perform pg_temp.expect_fight_error(format('select public.corrupted_fight_start(%L,%L,%L,10)',spawn,lat,lng),'no_attempts');

  spawn := spawns->'common'->>2;
  select * into strict fight from public.corrupted_fight_start(spawn,lat,lng,10);
  select * into strict out from public.corrupted_capsule_throw(spawn,lat,lng,10,'wax',1,false);
  assert out.result='miss' and out.attempts_left=cfg.max_attempts;
  select * into strict out from public.corrupted_capsule_throw(spawn,lat,lng,10,'wax',1,true);
  assert out.result='restored' and not out.is_new and out.xp_gained=cfg.xp_catch;
  perform pg_temp.expect_fight_error(format('select public.corrupted_fight_throw(%L,%L,%L,10,''gold'')',fight.fight_id,lat,lng),'expired');

  spawn := spawns->'common'->>3;
  select * into strict fight from public.corrupted_fight_start(spawn,lat,lng,10);
  perform pg_temp.expect_fight_error(format('select public.corrupted_fight_throw(%L,%L,%L,10,''wax'')',fight.fight_id,lat+(cfg.speed_ignore_m+10)/111195.0,lng),'too_fast');
  update public.player_game set last_position_at=null where user_id=player;
  perform pg_temp.expect_fight_error(format('select public.corrupted_fight_throw(%L,%L,%L,10,''wax'')',fight.fight_id,0,0),'too_far');
  update public.corrupted_spots set hidden_at=now() where id=split_part(spawn,':',1)::uuid;
  perform pg_temp.expect_fight_error(format('select public.corrupted_fight_throw(%L,%L,%L,10,''wax'')',fight.fight_id,lat,lng),'expired');

  select * into strict fight from public.landmark_start(post,lat,lng,10);
  assert fight.cracks=20 and (select expires_at-started_at=interval '150 seconds'
    from public.landmark_attempts where id=fight.attempt_id);
  -- The legacy caller still sends p_ring. Even a strong wax throw deals one.
  select * into strict out from public.landmark_hit(fight.attempt_id,lat,lng,10,'wax',1);
  assert out.result='hit' and out.cracks=19;
  request := format('select public.landmark_hit(%L,%L,%L,10,''gold'')',fight.attempt_id,lat,lng);
  perform pg_temp.expect_fight_error(request,'too_soon');
  for i in 1..10 loop
    update public.landmark_attempts set last_throw_at=clock_timestamp()-interval '800 milliseconds' where id=fight.attempt_id;
    select * into strict out from public.landmark_hit(fight.attempt_id,lat,lng,10,'gold');
    assert out.cracks=greatest(0,19-i*2);
  end loop;
  assert out.result='won' and out.stars=1 and out.is_new and out.copies is null and out.xp_gained=cfg.xp_landmark;
  assert exists(select 1 from public.passport_stamps where user_id=player and place='taipei101');
  perform pg_temp.expect_fight_error(request,'expired');

  select * into strict fight from public.landmark_start(post,lat,lng,10);
  select * into strict out from public.landmark_loss(fight.attempt_id,lat,lng,10);
  assert out.result='lost' and out.expires_at<=clock_timestamp();
  perform pg_temp.expect_fight_error(format('select public.landmark_hit(%L,%L,%L,10,''wax'')',fight.attempt_id,lat,lng),'expired');
  select * into strict resumed from public.landmark_start(post,lat,lng,10);
  assert resumed.attempt_id<>fight.attempt_id and resumed.cracks=20;
  update public.landmark_attempts set expires_at=clock_timestamp()-interval '1 second' where id=resumed.attempt_id;
  perform pg_temp.expect_fight_error(format('select public.landmark_hit(%L,%L,%L,10,''wax'')',resumed.attempt_id,lat,lng),'expired');
  perform pg_temp.expect_fight_error(format('select public.landmark_loss(%L,%L,%L,10)',resumed.attempt_id,lat,lng),'expired');
  assert not has_function_privilege('anon','public.landmark_loss(uuid,double precision,double precision,double precision)','execute');
  assert not has_table_privilege('authenticated','private.corrupted_fights','select');
end $$;

select 'PASS: dodge health, rewards, spacing, losses, expiry, GPS and legacy calls' as result;

-- A win through the public fight RPCs must count in both current hunt contexts.
create function pg_temp.dodge_win(spawn text, lat double precision, lng double precision)
returns void language plpgsql as $$
declare fight record; hit record;
begin
  select * into strict fight from public.corrupted_fight_start(spawn,lat,lng,10);
  for i in 1..fight.max_health loop
    select * into strict hit from public.corrupted_fight_throw(fight.fight_id,lat,lng,10,'wax');
    exit when hit.result='restored';
    update private.corrupted_fights set last_throw_at=clock_timestamp()-interval '800 milliseconds'
    where id=fight.fight_id;
  end loop;
  assert hit.result='restored';
end $$;

do $$
declare
  player uuid := gen_random_uuid();
  organizer uuid := gen_random_uuid();
  fixtures jsonb := pg_temp.dodge_fixture();
  lat double precision := (fixtures->>'lat')::double precision;
  lng double precision := (fixtures->>'lng')::double precision;
  city public.hunts;
  rule private.quest_rules;
  quest uuid;
  hunt text;
  join_code text;
  spawn record;
  out jsonb;
begin
  insert into auth.users(id,email) values (player,'df1-'||player||'@example.invalid'),
    (organizer,'df1-'||organizer||'@example.invalid');
  insert into public.profiles(id,name) values (player,'DF1 hunter'),(organizer,'DF1 organizer') on conflict do nothing;
  update public.profiles set can_create_hunts=true where id=organizer;
  insert into private.game_speed_allowlist(user_id) values (player);

  perform set_config('request.jwt.claim.sub',organizer::text,true);
  hunt := public.private_hunt_create(jsonb_build_object('name','DF1 private hunt','route_mode','ordered',
    'leaderboard_visible',false,'starts_at',now()-interval '1 hour','ends_at',now()+interval '1 hour',
    'guide_mode','fixed','guide_lat',lat,'guide_lng',lng))->>'id';
  perform public.private_hunt_quest_save(hunt,jsonb_build_object('name','DF1 Catch',
    'type','catch','ordinal',1,'points',10,'catch_count',1,'location_lat',lat,'location_lng',lng));
  join_code := public.private_hunt_publish(hunt)->>'join_code';
  select id into strict quest from public.private_hunt_quests where hunt_id=hunt;

  perform set_config('request.jwt.claim.sub',player::text,true);
  perform public.private_hunt_join_code(join_code);
  perform public.private_hunt_start(hunt,lat,lng,10);
  out := public.private_hunt_quest_attempt(jsonb_build_object('quest_id',quest,'lat',lat,'lng',lng,'accuracy',10));
  assert out->>'done'='false';
  select 'quest:'||id as spawn_id into strict spawn from private.quest_spawns
    where quest_id=quest and user_id=player;
  perform pg_temp.dodge_win(spawn.spawn_id,lat,lng);
  assert (select catch_count=1 and completed_at is not null from public.private_hunt_quest_progress
    where quest_id=quest and user_id=player);
  assert (select points=10 from public.private_hunt_members where hunt_id=hunt and user_id=player);

  select * into strict city from public.hunts where id='xinyi-2026-11';
  perform public.city_hunt_join(city.id);
  perform public.city_hunt_check_in(city.id,city.keeper_lat,city.keeper_lng,10);
  -- Positions remain real; seed only the player's completed lead-in quests.
  insert into private.city_hunt_located_progress(quest_id,user_id,run_at,completed_at)
    select q.quest_id,player,p.checked_in_at,now()
    from private.city_hunt_located_quests q
    join public.city_hunt_quest_progress p on p.hunt_id=q.hunt_id and p.user_id=player
    where q.hunt_id=city.id and q.ordinal<4;
  select r.* into strict rule from private.city_hunt_located_quests q
    join private.quest_rules r on r.id=q.quest_id where q.hunt_id=city.id and q.legacy_type='restore';
  out := public.city_hunt_quest_attempt(jsonb_build_object('quest_id',rule.id,
    'lat',rule.location_lat,'lng',rule.location_lng,'accuracy',10));
  assert out->>'done'='false';
  update public.player_game set wax_balls=100 where user_id=player;
  for spawn in select 'quest:'||id as spawn_id from private.quest_spawns
    where quest_id=rule.id and user_id=player
  loop
    perform pg_temp.dodge_win(spawn.spawn_id,rule.location_lat,rule.location_lng);
  end loop;
  assert (select caught=rule.catch_count and completed_at is not null
    from private.city_hunt_located_progress where quest_id=rule.id and user_id=player);
  -- The ordinary-spawn path still updates the legacy City Hunt counter.
  perform pg_temp.dodge_win(fixtures->'spawns'->'common'->>0,lat,lng);
  assert (select restore_count=1 from public.city_hunt_quest_progress where hunt_id=city.id and user_id=player);
end $$;

select 'PASS: dodge wins count for located City Hunt, private hunt and legacy City Hunt' as result;
