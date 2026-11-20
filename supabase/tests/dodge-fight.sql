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
  spawn text := fixture->'spawns'->'common'->>0;
  lat double precision := (fixture->>'lat')::double precision;
  lng double precision := (fixture->>'lng')::double precision;
  fight record;
  resumed record;
  outcome jsonb;
begin
  insert into auth.users(id,email) values (player,'df1-'||player||'@example.invalid'),
    (rival,'df1-'||rival||'@example.invalid');
  insert into public.profiles(id,name) values (player,'DF1 player'),(rival,'DF1 rival') on conflict do nothing;
  perform set_config('request.jwt.claim.sub',player::text,true);
  select * into strict fight from public.corrupted_fight_start(spawn,lat,lng,10);
  select * into strict resumed from public.corrupted_fight_start(spawn,lat,lng,10);
  assert resumed.fight_id=fight.fight_id and fight.health=3;

  perform set_config('request.jwt.claim.sub',rival::text,true);
  perform pg_temp.expect_fight_error(format('select public.corrupted_fight_finish(%L,''lost'',0,0,%L,%L,10)',fight.fight_id,lat,lng),'expired');
  perform set_config('request.jwt.claim.sub',player::text,true);
  update private.corrupted_fights set started_at=clock_timestamp()-interval '10 seconds' where id=fight.fight_id;
  update public.player_game set last_lat=lat+.004,last_position_at=clock_timestamp() where user_id=player;
  perform pg_temp.expect_fight_error(format('select public.corrupted_fight_finish(%L,''lost'',1,0,%L,%L,10)',fight.fight_id,lat,lng),'too_fast');
  update public.player_game set last_lat=lat where user_id=player;
  outcome := public.corrupted_fight_finish(fight.fight_id,'won',3,0,lat,lng,10);
  assert outcome->>'result'='won';
  -- Replay returns the exact stored outcome without reading the current balance or GPS again.
  assert public.corrupted_fight_finish(fight.fight_id,'lost',0,0,0,0,10)=outcome;
  assert not has_table_privilege('authenticated','private.fight_finish_receipts','select');
  assert not has_function_privilege('anon','public.landmark_finish(uuid,text,integer,integer,double precision,double precision,double precision)','execute');
end $$;

select 'PASS: fight starts, ownership, finish GPS and idempotent receipt grants' as result;

-- A win through the public fight RPCs must count in both current hunt contexts.
create function pg_temp.dodge_win(spawn text, lat double precision, lng double precision)
returns void language plpgsql as $$
declare fight record; outcome jsonb;
begin
  select * into strict fight from public.corrupted_fight_start(spawn,lat,lng,10);
  update private.corrupted_fights set started_at=clock_timestamp()-interval '10 seconds' where id=fight.fight_id;
  outcome := public.corrupted_fight_finish(fight.fight_id,'won',fight.max_health,0,lat,lng,10);
  assert outcome->>'result'='won';
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
