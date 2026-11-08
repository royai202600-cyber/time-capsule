-- Append this body after the migration's final COMMIT is removed, then ROLLBACK.
-- Hosted transaction only. All fixture users, rows, and tuning changes disappear.
insert into auth.users(id,email) values
 ('087e002a-3aee-4cb4-a1ad-a6d001dbbad1','game-sql-a@example.invalid'),
 ('087e002a-3aee-4cb4-a1ad-a6d001dbbad2','game-sql-b@example.invalid');
insert into public.profiles(id,name) values
 ('087e002a-3aee-4cb4-a1ad-a6d001dbbad1','Game test A'),
 ('087e002a-3aee-4cb4-a1ad-a6d001dbbad2','Game test B');
insert into public.friendships(user_id,friend_id) values
 ('087e002a-3aee-4cb4-a1ad-a6d001dbbad1','087e002a-3aee-4cb4-a1ad-a6d001dbbad2');

create function pg_temp.require_ok(ok boolean, why text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'assertion failed: %',why; end if; end $$;
create function pg_temp.expect_error(statement text, expected text)
returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement;
  exception when others then
    actual:=sqlerrm;
    if position(expected in actual)=0 then raise exception 'expected %, got %',expected,actual; end if;
    return;
  end;
  raise exception 'unexpected success: %',statement;
end $$;

select pg_temp.require_ok(
  (select count(*)=67 from public.vessels),'existing catalogue count');
select pg_temp.require_ok(
  (select count(*)=56 from private.vessel_spawn_rules),'ordinary rules only');
select pg_temp.require_ok(
  (select count(*)=3 from public.sea_shores where kind='landmark'),'three landmark Wayposts');
select pg_temp.require_ok(
  (select count(*)=2 from private.game_speed_allowlist),'existing test accounts allowlisted');
select pg_temp.require_ok(
  has_schema_privilege('authenticated','private','usage')
    and has_function_privilege('authenticated','private.can_read_capsule_voice(text)','execute'),
  'existing private voice helper remains callable');
select pg_temp.require_ok(
  not has_function_privilege('authenticated','private.resolve_spawn(uuid,bigint)','execute')
    and not has_table_privilege('authenticated','private.vessel_spawn_rules','select')
    and not has_table_privilege('authenticated','private.game_secret','select'),
  'game rules and secret remain private');
select pg_temp.require_ok(
  not has_function_privilege('anon','public.game_state()','execute')
    and not has_function_privilege('anon',
      'public.corrupted_throw(text,double precision,double precision,double precision,text,double precision,boolean)','execute')
    and not has_function_privilege('anon',
      'public.open_capsule(uuid,double precision,double precision,double precision)','execute'),
  'anonymous RPC execution denied');
select city_en,count(*) from public.sea_shores
  where game_enabled and city_en in ('Taipei','Singapore','Macau')
  group by city_en order by city_en;
select city,count(*) from public.corrupted_spots group by city order by city;

select pg_temp.require_ok((select count(*)=54 from public.sea_shores where game_enabled and city_en='Taipei'), 'Taipei dense Wayposts');
select pg_temp.require_ok((select count(*)=77 from public.corrupted_spots where city='Taipei'), 'Taipei dense spots');
select pg_temp.require_ok((select count(*)=42 from public.sea_shores where game_enabled and city_en='Singapore'), 'Singapore dense Wayposts');
select pg_temp.require_ok((select count(*)=58 from public.corrupted_spots where city='Singapore'), 'Singapore dense spots');
select pg_temp.require_ok((select count(*)=33 from public.sea_shores where game_enabled and city_en='Macau'), 'Macau dense Wayposts');
select pg_temp.require_ok((select count(*)=36 from public.corrupted_spots where city='Macau'), 'Macau dense spots');

-- Stable release for behavioral checks, with every probability forced to a bound.
update private.game_config set spawn_chance=1,visible_min_minutes=60,visible_max_minutes=60,
  restore_common=1,restore_uncommon=1,restore_rare=1;
create temp table game_spawns on commit drop as
  select row_number() over(order by p.source_ref) as n,
    s.spawn_id,s.vessel,p.lat,p.lng,p.id as spot_id
  from public.corrupted_spots p
  cross join lateral private.resolve_spawn(
    p.id,floor(extract(epoch from now())/3600)::bigint) s
  where p.city='Taipei' order by p.source_ref limit 3;
grant select on game_spawns to authenticated;
select pg_temp.require_ok((select count(*)=3 from game_spawns),'three active test spawns');

-- A real signed-in test account must be present in the private allow-list.
select pg_temp.require_ok(exists(
  select 1 from private.game_speed_allowlist a join auth.users u on u.id=a.user_id
  where u.email='expo-test-a138d8@timecapsule.test'),'dedicated test account');
select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbbad1',true);
set local role authenticated;
select pg_temp.require_ok((select wax_balls=30 and gold_balls=2 and level=1
  from public.game_state()),'starting balls and level');
select pg_temp.expect_error('select * from private.vessel_spawn_rules','permission denied');
select pg_temp.expect_error('select * from public.corrupted_spots','permission denied');
select pg_temp.expect_error('select * from public.capsule_contents','permission denied');
select pg_temp.require_ok(
  (select jsonb_array_length(public.corrupted_nearby(lat,lng,10)->'spawns')>0
   from game_spawns where n=1),'shared release visible nearby');
select pg_temp.expect_error(
  'select public.corrupted_nearby(25.037,121.563,201)','too_far');
select pg_temp.expect_error(
  'select public.corrupted_nearby(91,121.563,10)','too_far');
select pg_temp.expect_error(
  'select public.corrupted_nearby(1.2868,103.8543,10)','too_fast');
reset role;

-- Flights after the comparison window and small GPS jitter must be accepted.
update public.player_game set last_position_at=clock_timestamp()-interval '1801 seconds'
  where user_id='087e002a-3aee-4cb4-a1ad-a6d001dbbad1';
set local role authenticated;
select public.corrupted_nearby(1.2868,103.8543,10);
reset role;
update public.player_game set last_lat=25.037,last_lng=121.563,
  last_position_at=clock_timestamp()
  where user_id='087e002a-3aee-4cb4-a1ad-a6d001dbbad1';
set local role authenticated;
select public.corrupted_nearby(25.038,121.563,10);
select pg_temp.expect_error(
  'select public.corrupted_nearby(1.2868,103.8543,10)','too_fast');
reset role;

-- The allow-list skips speed only; distance and accuracy checks still apply.
insert into private.game_speed_allowlist(user_id) values
 ('087e002a-3aee-4cb4-a1ad-a6d001dbbad1');
set local role authenticated;
select public.corrupted_nearby(1.2868,103.8543,10);
select pg_temp.expect_error(
  'select public.waypost_spin(id,0,0,10) from public.sea_shores where place=''taipei101''',
  'too_far');
select pg_temp.expect_error(
  'select public.corrupted_throw(spawn_id,0,0,10,''wax'',0.5,true) from game_spawns where n=1',
  'too_far');
select pg_temp.expect_error(
  'select public.corrupted_throw(spawn_id,lat,lng,201,''wax'',0.5,true) from game_spawns where n=1',
  'too_far');
select pg_temp.expect_error(
  'select public.corrupted_throw(''00000000-0000-0000-0000-000000000000:0'',25,121,10,''wax'',0.5,true)',
  'expired');
select pg_temp.expect_error(
  'select public.corrupted_throw(spawn_id||''9'',lat,lng,10,''wax'',0.5,true) from game_spawns where n=1',
  'expired');

-- A miss spends one ball but no restoring attempt. A guaranteed hit catches once.
select pg_temp.require_ok(
  (select result='miss' and wax_balls=29 and attempts_left=3
   from game_spawns s cross join lateral
   public.corrupted_throw(s.spawn_id,s.lat,s.lng,10,'wax',0.5,false) t where s.n=1),
  'miss spends ball only');
select pg_temp.require_ok(
  (select result='restored' and copies=1 and stars=1 and is_new
     and xp_gained=900 and attempts_left=2
   from game_spawns s cross join lateral
   public.corrupted_throw(s.spawn_id,s.lat,s.lng,10,'wax',0.5,true) t where s.n=1),
  'first catch, new vessel and daily XP');
select pg_temp.expect_error(
  'select public.corrupted_throw(spawn_id,lat,lng,10,''wax'',1,true) from game_spawns where n=1',
  'already_caught');
reset role;
select pg_temp.require_ok((select count(*)=3 from public.xp_events
  where user_id='087e002a-3aee-4cb4-a1ad-a6d001dbbad1'),
  'one catch, new and daily XP event');

-- Force failed hits on a second release to verify three attempts exactly.
update private.game_config set restore_common=0,restore_uncommon=0,restore_rare=0,
  restore_ring_bonus=0,restore_gold_bonus=0;
set local role authenticated;
do $$
declare s record; i integer; t record;
begin
  select * into s from game_spawns where n=2;
  for i in 1..3 loop
    select * into t from public.corrupted_throw(s.spawn_id,s.lat,s.lng,10,'wax',0,true);
    perform pg_temp.require_ok(t.result='not_restored' and t.attempts_left=3-i,'failed hit count');
  end loop;
  perform pg_temp.expect_error(
    format('select public.corrupted_throw(%L,%s,%s,10,''wax'',0,true)',s.spawn_id,s.lat,s.lng),
    'no_attempts');
end $$;
reset role;
update private.game_config set restore_common=1,restore_uncommon=1,restore_rare=1;

-- Common Waypost grants balls and XP, then enforces a per-player cooldown.
set local role authenticated;
select pg_temp.require_ok(
  (select wax_awarded between 3 and 5 and gold_awarded between 0 and 1
    and xp_gained=20 and cooldown_end>now()
   from public.sea_shores s cross join lateral
   public.waypost_spin(s.id,s.lat,s.lng,10) t
   where s.city_en='Taipei' and s.kind='common' limit 1),'Waypost spin');
select pg_temp.expect_error(
  'select public.waypost_spin(id,lat,lng,10) from public.sea_shores where city_en=''Taipei'' and kind=''common'' limit 1',
  'cooldown');
reset role;

-- Solo Landmark: six strong wax hits close 12 cracks, award one vessel and stamp.
set local role authenticated;
create temp table game_attempt on commit drop as
  select a.attempt_id from public.sea_shores s
  cross join lateral public.landmark_start(s.id,s.lat,s.lng,10) a
  where s.place='taipei101';
do $$
declare p record; a uuid; h record; i integer;
begin
  select * into p from public.sea_shores where place='taipei101';
  select attempt_id into a from game_attempt;
  for i in 1..6 loop select * into h from public.landmark_hit(a,p.lat,p.lng,10,'wax',0.8); end loop;
  perform pg_temp.require_ok(h.result='won' and h.cracks=0
    and h.vessel='bamboo-tower' and h.copies=1 and h.xp_gained=2000,'solo win');
  perform pg_temp.expect_error(
    format('select public.landmark_hit(%L,%s,%s,10,''wax'',0.9)',a,p.lat,p.lng),
    'expired');
end $$;
select pg_temp.require_ok(
  (select how_earned='landmark' from public.my_passport() where place='taipei101'),
  'Passport landmark stamp');
select pg_temp.require_ok(
  (select copies=1 and stars=1 from public.my_collection() where vessel='bamboo-tower'),
  'Cabinet landmark vessel');
reset role;

-- Repeat win adds a copy but cannot duplicate place XP or the Passport row.
set local role authenticated;
do $$
declare p record; a uuid; h record; i integer;
begin
  select * into p from public.sea_shores where place='taipei101';
  select attempt_id into a from public.landmark_start(p.id,p.lat,p.lng,10);
  for i in 1..6 loop select * into h from public.landmark_hit(a,p.lat,p.lng,10,'wax',0.9); end loop;
  perform pg_temp.require_ok(h.result='won' and h.copies=2 and h.xp_gained=0,'repeat win copy');
end $$;
reset role;
select pg_temp.require_ok((select count(*)=1 from public.xp_events
  where source='landmark_win' and reference='taipei101'),'landmark XP unique');
select pg_temp.require_ok((select count(*)=1 from public.passport_stamps
  where place='taipei101' and user_id='087e002a-3aee-4cb4-a1ad-a6d001dbbad1'),
  'Passport stamp unique');

-- A third win crosses the 3-copy threshold and produces two stars.
set local role authenticated;
do $$
declare p record; a uuid; h record; i integer;
begin
  select * into p from public.sea_shores where place='taipei101';
  select attempt_id into a from public.landmark_start(p.id,p.lat,p.lng,10);
  for i in 1..6 loop select * into h from public.landmark_hit(a,p.lat,p.lng,10,'wax',0.9); end loop;
  perform pg_temp.require_ok(h.copies=3 and h.stars=2 and h.xp_gained=0,
    'third copy raises stars without duplicate XP');
end $$;
reset role;

-- Timeout closes an active attempt without spending a ball.
set local role authenticated;
create temp table timed_attempt on commit drop as
  select a.attempt_id from public.sea_shores s
  cross join lateral public.landmark_start(s.id,s.lat,s.lng,10) a
  where s.place='merlion';
select pg_temp.require_ok(
  (select h.cracks=10 from public.sea_shores s cross join lateral
   public.landmark_hit((select attempt_id from timed_attempt),s.lat,s.lng,10,'gold',0) h
   where s.place='merlion'),'gold ball closes two cracks');
reset role;
update public.landmark_attempts set expires_at=now()-interval '1 second'
  where id=(select attempt_id from timed_attempt);
set local role authenticated;
select pg_temp.expect_error(
  'select public.landmark_hit((select attempt_id from timed_attempt),s.lat,s.lng,10,''wax'',1) from public.sea_shores s where s.place=''merlion''',
  'expired');
reset role;

update public.player_game set wax_balls=0,gold_balls=0
  where user_id='087e002a-3aee-4cb4-a1ad-a6d001dbbad1';
set local role authenticated;
select pg_temp.expect_error(
  'select public.corrupted_throw(spawn_id,lat,lng,10,''wax'',0,true) from game_spawns where n=3',
  'no_balls');
select pg_temp.expect_error(
  'select public.landmark_hit(a.attempt_id,s.lat,s.lng,10,''wax'',0) from public.sea_shores s cross join lateral public.landmark_start(s.id,s.lat,s.lng,10) a where s.place=''merlion''',
  'no_balls');
reset role;

-- Existing send, Shop, stranger-capsule and sealed-content guards still work.
select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbbad2',true);
set local role authenticated;
select pg_temp.require_ok(
  public.send_capsule(auth.uid(),'dome','self letter','hint',now()+interval '1 hour') is not null,
  'existing free send');
select pg_temp.require_ok(public.acquire_vessel('vinyl') is null,'ordinary Shop acquisition');
select pg_temp.require_ok(
  (select count(*)=1 from public.sea_throw('Hello from the test','hint','dome',1,
    25.037546,121.562754,10)),'existing stranger send');
select pg_temp.expect_error('select * from public.capsule_contents','permission denied');
reset role;

-- A full three-day wait pays 160 XP exactly once; early and short waits pay none.
insert into public.capsules(id,sender,recipient,vessel,hint,sealed_at,open_at)
  values('087e002a-3aee-4cb4-a1ad-a6d001dbbad3',
    '087e002a-3aee-4cb4-a1ad-a6d001dbbad1',
    '087e002a-3aee-4cb4-a1ad-a6d001dbbad2','dome','waited',
    now()-interval '3 days',now()-interval '1 hour');
insert into public.capsule_contents(capsule_id,message)
  values('087e002a-3aee-4cb4-a1ad-a6d001dbbad3','sealed');
insert into public.capsules(id,sender,recipient,vessel,hint,sealed_at,open_at)
  values('087e002a-3aee-4cb4-a1ad-a6d001dbbad4',
    '087e002a-3aee-4cb4-a1ad-a6d001dbbad1',
    '087e002a-3aee-4cb4-a1ad-a6d001dbbad2','dome','early',now(),now()+interval '1 hour');
insert into public.capsule_contents(capsule_id,message)
  values('087e002a-3aee-4cb4-a1ad-a6d001dbbad4','locked');
select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbbad1',true);
set local role authenticated;
select pg_temp.expect_error(
  'select * from public.open_capsule(''087e002a-3aee-4cb4-a1ad-a6d001dbbad3'')',
  'capsule not found');
reset role;
select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbbad2',true);
set local role authenticated;
select pg_temp.expect_error(
  'select * from public.open_capsule(''087e002a-3aee-4cb4-a1ad-a6d001dbbad4'')','not yet');
select pg_temp.require_ok(
  (select message='sealed' from public.open_capsule(
    '087e002a-3aee-4cb4-a1ad-a6d001dbbad3')),'recipient opens waited letter');
select public.open_capsule('087e002a-3aee-4cb4-a1ad-a6d001dbbad3');
select pg_temp.require_ok((select xp=160 from public.game_state()),'waited XP once');
reset role;
select pg_temp.require_ok((select count(*)=1 from public.xp_events
  where user_id='087e002a-3aee-4cb4-a1ad-a6d001dbbad2' and source='capsule_open'),
  'open event unique');

-- Existing place opening still enforces GPS and awards its earned vessel.
insert into public.capsules(id,sender,recipient,vessel,hint,sealed_at,open_at,place)
  values('087e002a-3aee-4cb4-a1ad-a6d001dbbad5',
    '087e002a-3aee-4cb4-a1ad-a6d001dbbad1',
    '087e002a-3aee-4cb4-a1ad-a6d001dbbad2','dome','place',
    now()-interval '12 hours',now()-interval '1 hour','tst-clock');
insert into public.capsule_contents(capsule_id,message)
  values('087e002a-3aee-4cb4-a1ad-a6d001dbbad5','place sealed');
set local role authenticated;
select pg_temp.expect_error(
  'select * from public.open_capsule(''087e002a-3aee-4cb4-a1ad-a6d001dbbad5'')',
  'location needed');
select pg_temp.expect_error(
  'select * from public.open_capsule(''087e002a-3aee-4cb4-a1ad-a6d001dbbad5'',22.29359,114.16954,201)',
  'location not accurate enough');
select pg_temp.expect_error(
  'select * from public.open_capsule(''087e002a-3aee-4cb4-a1ad-a6d001dbbad5'',0,0,10)',
  'too far');
select pg_temp.require_ok(
  (select message='place sealed' from public.open_capsule(
    '087e002a-3aee-4cb4-a1ad-a6d001dbbad5',22.29359,114.16954,10)),
  'place capsule opened');
select pg_temp.require_ok((select xp=160 from public.game_state()),
  'under one day pays no opening XP');
select pg_temp.require_ok(
  (select copies=1 from public.my_collection() where vessel='clock-tower'),
  'existing landmark opening reward');
select pg_temp.require_ok(
  (select how_earned='capsule' from public.my_passport() where place='tst-clock'),
  'Passport capsule stamp');
reset role;

-- Optional game writes must never prevent delivery or the original place reward.
savepoint optional_reward_failure;
insert into public.capsules(id,sender,recipient,vessel,hint,sealed_at,open_at,place)
values('087e002a-3aee-4cb4-a1ad-a6d001dbbad6',
 '087e002a-3aee-4cb4-a1ad-a6d001dbbad1','087e002a-3aee-4cb4-a1ad-a6d001dbbad2',
 'dome','reward failure',now()-interval '3 days',now()-interval '1 hour','senado');
insert into public.capsule_contents(capsule_id,message)
values('087e002a-3aee-4cb4-a1ad-a6d001dbbad6','delivered despite game failure');
create function pg_temp.fail_game_xp() returns trigger language plpgsql as $$
begin raise exception 'forced optional game failure'; end $$;
create trigger force_game_xp_failure before insert on public.xp_events
for each row execute function pg_temp.fail_game_xp();
set local role authenticated;
select pg_temp.require_ok((select message='delivered despite game failure' and opened_at is not null
 from public.open_capsule('087e002a-3aee-4cb4-a1ad-a6d001dbbad6',22.19383,113.53999,10)),
 'game failure still delivers content');
select pg_temp.require_ok((select copies=1 from public.my_collection()
 where vessel='senado-fountain'),'original place vessel reward survives');
reset role;
select pg_temp.require_ok(not exists(select 1 from public.passport_stamps
 where user_id='087e002a-3aee-4cb4-a1ad-a6d001dbbad2' and place='senado'),
 'optional block rolled back independently');
rollback to optional_reward_failure;

-- Private rules: daytime fireflies and off-season festivals cannot be selected.
savepoint season_checks;
delete from private.vessel_spawn_rules where vessel<>'firefly-jar';
update private.vessel_spawn_rules set rarity='common' where vessel='firefly-jar';
update private.game_config set rarity_common_weight=100,rarity_uncommon_weight=0,
  rarity_rare_weight=0;
select pg_temp.require_ok(
  (select count(*)=0 from public.corrupted_spots p cross join lateral
   private.resolve_spawn(p.id,
     floor(extract(epoch from timestamptz '2026-11-09 13:00:00+08')/3600)::bigint) s
   where p.city='Taipei'),'fireflies absent by day');
select pg_temp.require_ok(
  (select count(*)>0 from public.corrupted_spots p cross join lateral
   private.resolve_spawn(p.id,
     floor(extract(epoch from timestamptz '2026-11-09 20:00:00+08')/3600)::bigint) s
   where p.city='Taipei'),'fireflies present after dark');
rollback to season_checks;
savepoint festival_checks;
delete from private.vessel_spawn_rules where vessel<>'stocking';
update private.vessel_spawn_rules set rarity='common' where vessel='stocking';
update private.game_config set rarity_common_weight=100,rarity_uncommon_weight=0,
  rarity_rare_weight=0;
select pg_temp.require_ok(
  (select count(*)=0 from public.corrupted_spots p cross join lateral
   private.resolve_spawn(p.id,
     floor(extract(epoch from timestamptz '2026-11-09 20:00:00+08')/3600)::bigint) s
   where p.city='Taipei'),'festival vessel absent off season');
select pg_temp.require_ok(
  (select count(*)>0 from public.corrupted_spots p cross join lateral
   private.resolve_spawn(p.id,
     floor(extract(epoch from timestamptz '2026-12-25 20:00:00+08')/3600)::bigint) s
   where p.city='Taipei'),'festival vessel present in season');
rollback to festival_checks;

select 'PASS: Time Capsule game rollback integration checks' as result;
rollback;
