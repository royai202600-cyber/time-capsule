-- Run with dodge-fight-fixtures.sql inside a rollback transaction.
create function pg_temp.df3_expect_error(statement text, expected text) returns void
language plpgsql as $$
begin
  execute statement;
  raise exception 'Expected error %', expected;
exception when others then
  if sqlerrm <> expected then raise; end if;
end $$;

do $$
declare
  player uuid := 'd3f30000-0000-4000-8000-000000000001';
  editor uuid := 'd3f30000-0000-4000-8000-000000000002';
  moderator uuid := 'd3f30000-0000-4000-8000-000000000003';
  viewer uuid := 'd3f30000-0000-4000-8000-000000000004';
  fixture jsonb := pg_temp.dodge_fixture();
  lat double precision := (fixture->>'lat')::double precision;
  lng double precision := (fixture->>'lng')::double precision;
  landmark uuid := (fixture->>'waypost')::uuid;
  target record;
  fight record;
  attempt record;
  outcome jsonb;
  reward jsonb;
  audit private.admin_actions;
  hunt public.hunts;
  cfg private.game_config;
  spin record;
begin
  insert into auth.users(id,email) values
    (player,'df3-player@example.invalid'),(editor,'df3-editor@example.invalid'),
    (moderator,'df3-moderator@example.invalid'),(viewer,'df3-viewer@example.invalid');
  insert into public.profiles(id,name) values (player,'DF3 player'),(editor,'DF3 admin'),
    (moderator,'DF3 moderator'),(viewer,'DF3 viewer') on conflict do nothing;
  insert into private.admin_members(user_id,role) values (editor,'admin'),(moderator,'moderator'),(viewer,'viewer');
  insert into private.game_speed_allowlist(user_id) values (player);
  perform set_config('request.jwt.claim.sub',player::text,true);
  perform private.ensure_player(player);

  select * into strict cfg from private.game_config where singleton;
  assert cfg.spin_wax_min = 10 and cfg.spin_wax_max = 10;
  update public.player_game set wax_balls=9,gold_balls=0 where user_id=player;
  perform pg_temp.df3_expect_error(format('select * from public.corrupted_fight_start(%L,%L,%L,10)',
    fixture->'spawns'->'common'->>0,lat,lng),'no_balls');
  assert not exists (select 1 from private.corrupted_fights where user_id=player);
  perform pg_temp.df3_expect_error(format('select * from public.landmark_start(%L,%L,%L,10)',
    landmark,lat,lng),'no_balls');
  assert not exists (select 1 from public.landmark_attempts where user_id=player);
  update public.player_game set wax_balls=100,gold_balls=20 where user_id=player;

  for target in select * from (values ('common',10),('uncommon',12),('rare',14)) t(rarity,hp) loop
    select * into strict fight from public.corrupted_fight_start(fixture->'spawns'->target.rarity->>0,lat,lng,10);
    assert fight.health = target.hp and fight.max_health = target.hp;
    assert (select health=target.hp from private.corrupted_fights where id=fight.fight_id);
    perform pg_temp.df3_expect_error(format('select public.corrupted_fight_finish(%L,''won'',%s,0,%L,%L,10)',
      fight.fight_id,target.hp-1,lat,lng),'not_enough_damage');
    perform pg_temp.df3_expect_error(format('select public.corrupted_fight_finish(%L,''won'',%s,0,%L,%L,10)',
      fight.fight_id,target.hp,lat,lng),'too_soon');
    update private.corrupted_fights set started_at=clock_timestamp()-interval '15 seconds' where id=fight.fight_id;
    outcome := public.corrupted_fight_finish(fight.fight_id,'won',target.hp,0,lat,lng,10);
    assert outcome->>'result' = 'won';
    assert public.corrupted_fight_finish(fight.fight_id,'won',target.hp,0,lat,lng,10) = outcome;
  end loop;
  assert (select wax_balls=64 and gold_balls=20 from public.player_game where user_id=player);

  select * into strict attempt from public.landmark_start(landmark,lat,lng,10);
  assert attempt.cracks = 40;
  assert (select cracks_left=40 and expires_at-started_at=interval '150 seconds'
    from public.landmark_attempts where id=attempt.attempt_id);
  perform pg_temp.df3_expect_error(format('select public.landmark_finish(%L,''won'',0,19,%L,%L,10)',
    attempt.attempt_id,lat,lng),'not_enough_damage');
  perform pg_temp.df3_expect_error(format('select public.landmark_finish(%L,''won'',0,20,%L,%L,10)',
    attempt.attempt_id,lat,lng),'too_soon');
  update public.landmark_attempts set started_at=clock_timestamp()-interval '17 seconds' where id=attempt.attempt_id;
  outcome := public.landmark_finish(attempt.attempt_id,'won',0,20,lat,lng,10);
  assert outcome->>'result' = 'won' and (outcome->>'gold_balls')::int = 0;
  perform pg_temp.df3_expect_error(format('select * from public.waypost_spin(%L,%L,%L,10)',
    landmark,lat,lng),'too_far');

  select * into strict hunt from public.hunts where id='hkust-2026-11';
  assert public.city_hunt_join(hunt.id)->>'id'=hunt.id;
  assert public.city_hunt_check_in(hunt.id,hunt.keeper_lat,hunt.keeper_lng,10)->>'checked_in_at' is not null;
  for target in
    select row_number() over (order by id) as n, s.*
    from public.public_capsule_spots s
    where kind='common' and game_enabled and source_ref like '%;hkust-outdoor'
    order by id limit 3
  loop
    select * into strict spin from public.waypost_spin(target.id,target.lat,target.lng,10);
    assert spin.wax_awarded=case when target.n=2 then 8 else 10 end;
    assert spin.gold_awarded in (0,cfg.spin_gold_award);
    assert (select spin.cooldown_end - spun_at = make_interval(secs=>cfg.spin_cooldown_seconds)
      from public.waypost_spins where user_id=player and waypost_id=target.id);
    perform pg_temp.df3_expect_error(format('select * from public.waypost_spin(%L,%L,%L,10)',
      target.id,target.lat,target.lng),'cooldown');
    if target.n=1 then
      perform set_config('request.jwt.claim.sub',moderator::text,true);
      perform pg_temp.df3_expect_error('select public.admin_set_spin_reward(8,8)','forbidden');
      perform set_config('request.jwt.claim.sub',viewer::text,true);
      perform pg_temp.df3_expect_error('select public.admin_set_spin_reward(8,8)','forbidden');
      perform set_config('request.jwt.claim.sub',editor::text,true);
      perform pg_temp.df3_expect_error('select public.admin_set_spin_reward(null,8)','bad_rule');
      perform pg_temp.df3_expect_error('select public.admin_set_spin_reward(9,8)','bad_rule');
      perform pg_temp.df3_expect_error('select public.admin_set_spin_reward(-1,8)','bad_rule');
      perform pg_temp.df3_expect_error('select public.admin_set_spin_reward(0,51)','bad_rule');
      reward := public.admin_set_spin_reward(8,8,'DF3 spin test');
      assert reward = '{"spin_wax_min":8,"spin_wax_max":8}'::jsonb;
      assert public.admin_spawning()->'config' @> reward;
      select * into strict audit from private.admin_actions where actor=editor and action='config.spin';
      assert audit.note = 'DF3 spin test';
      assert audit.before = '{"spin_wax_min":10,"spin_wax_max":10}'::jsonb and audit.after = reward;
      perform set_config('request.jwt.claim.sub',moderator::text,true);
      perform pg_temp.df3_expect_error(format('select public.admin_undo(%s)',audit.id),'forbidden');
    elsif target.n=2 then
      perform set_config('request.jwt.claim.sub',editor::text,true);
      assert public.admin_undo(audit.id) = audit.before;
      assert public.admin_spawning()->'config' @> audit.before;
      perform pg_temp.df3_expect_error(format('select public.admin_undo(%s)',audit.id),'stale');
      assert exists (select 1 from private.admin_actions where actor=editor and action='undo'
        and after->>'undo_of'=audit.id::text);
    end if;
    perform set_config('request.jwt.claim.sub',player::text,true);
  end loop;
  assert (select spin_count=3 from public.city_hunt_quest_progress where user_id=player and hunt_id=hunt.id);
  assert (select wax_balls=92 from public.player_game where user_id=player);
  assert not has_function_privilege('anon','public.admin_set_spin_reward(integer,integer,text)','execute');
  assert has_function_privilege('authenticated','public.admin_set_spin_reward(integer,integer,text)','execute');
end $$;

select 'PASS: DF3 starts, settlement, roles, audit/Undo, cooldown, and City Hunt spins' as result;
