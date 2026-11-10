-- Hosted rollback preflight: append after the migration's final COMMIT is removed.
-- All fixtures and game tuning disappear with the enclosing ROLLBACK.
create function pg_temp.require_ok(ok boolean, why text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'H1 assertion: %',why; end if; end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
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

select pg_temp.require_ok((select count(*)=1 from public.hunts where id='xinyi-2026-11'),
  'seeded Xinyi hunt');
select pg_temp.require_ok((select count(*)=5 from public.hunt_wayposts where hunt_id='xinyi-2026-11'),
  'five distinct hunt Wayposts');
select pg_temp.require_ok(not has_function_privilege('anon',
  'public.hunt_finish(text,double precision,double precision,double precision)','execute'),
  'anonymous hunt finish denied');
select pg_temp.require_ok(not has_function_privilege('service_role',
  'public.hunt_finish(text,double precision,double precision,double precision)','execute'),
  'hunt RPC granted to authenticated only');
select pg_temp.require_ok(not has_table_privilege('authenticated','public.hunt_progress','insert')
  and not has_table_privilege('authenticated','public.hunt_progress','update'),
  'direct progress writes denied');

insert into auth.users(id,email) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba01','h1-a@example.invalid'),
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba02','h1-b@example.invalid');
insert into public.profiles(id,name) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba01','H1 A'),
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba02','H1 B');
insert into private.game_speed_allowlist(user_id)
  values ('087e002a-3aee-4cb4-a1ad-a6d001dbba01'),('087e002a-3aee-4cb4-a1ad-a6d001dbba02');
update private.game_config set spawn_chance=1,visible_min_minutes=wave_minutes,
  visible_max_minutes=wave_minutes,restore_common=1,restore_uncommon=1,restore_rare=1;

create temp table h1_posts on commit drop as
  select row_number() over(order by s.name_en) n,s.id,s.lat,s.lng
  from public.hunt_wayposts w join public.sea_shores s on s.id=w.waypost_id
  where w.hunt_id='xinyi-2026-11';
create temp table h1_spawns on commit drop as
  select row_number() over(order by p.source_ref) n,p.id,p.lat,p.lng,r.spawn_id,
    public.distance_m(p.lat,p.lng,25.033263,121.564887) as area_distance
  from public.corrupted_spots p
  cross join lateral private.resolve_spawn(p.id,
    floor(extract(epoch from now())/((select wave_minutes from private.game_config where singleton)*60))::bigint) r
  where p.city='Taipei' and p.source_ref not like 'qa:%'
    and (public.distance_m(p.lat,p.lng,25.033263,121.564887)<=1200
      or p.id=(select x.id from public.corrupted_spots x where x.city='Taipei'
        and public.distance_m(x.lat,x.lng,25.033263,121.564887)>1200
        order by public.distance_m(x.lat,x.lng,25.033263,121.564887) limit 1))
  order by area_distance;
create temp table h1_nonhunt on commit drop as
  select s.id,s.lat,s.lng from public.sea_shores s where s.game_enabled and s.kind='common'
    and public.distance_m(s.lat,s.lng,25.033263,121.564887)<=1200
    and not exists (select 1 from public.hunt_wayposts w where w.waypost_id=s.id)
    order by s.name_en limit 1;
create temp table h1_landmark on commit drop as
  select s.id,s.lat,s.lng from public.hunts h join public.sea_shores s on s.id=h.landmark
    where h.id='xinyi-2026-11';
grant select on h1_posts,h1_spawns,h1_nonhunt,h1_landmark to authenticated;
select pg_temp.require_ok((select count(*)=5 from h1_posts),'five route posts');
select pg_temp.require_ok((select count(*)>=5 from h1_spawns where area_distance<=1200),
  'five in-area spawns');

select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbba01',true);
set local role authenticated;
select pg_temp.require_ok(jsonb_array_length(public.hunt_list(25.037546,121.562754))>=1,
  'hunt list is visible');
select pg_temp.require_ok(public.hunt_join('xinyi-2026-11')->>'joined_at' is not null,
  'join works anywhere');
select pg_temp.expect_error(
  'select public.hunt_check_in(''xinyi-2026-11'',25.033263,121.564887,10)',
  'too_far');
select public.waypost_spin(id,lat,lng,10) from h1_posts where n=1;
select pg_temp.require_ok((select spin_count=0 and checked_in_at is null
  from public.hunt_progress where hunt_id='xinyi-2026-11'),
  'spin before check-in does not count');
select pg_temp.require_ok(public.hunt_check_in('xinyi-2026-11',25.037546,121.562754,10)
  ->>'checked_in_at' is not null,'keeper check-in works');
select pg_temp.expect_error(
  'select public.hunt_finish(''xinyi-2026-11'',25.037546,121.562754,10)',
  'hunt incomplete');

do $$ declare r record; v record;
begin
  for r in select * from h1_posts where n between 2 and 4 order by n loop
    select * into v from public.waypost_spin(r.id,r.lat,r.lng,10);
    perform pg_temp.require_ok(v.wax_awarded>=0,'successful spin preserved');
  end loop;
  perform pg_temp.require_ok((select spin_count=3 from public.hunt_progress
    where hunt_id='xinyi-2026-11'),'three unique Wayposts count');
end $$;
select pg_temp.require_ok((select count(*)=3 from public.hunt_spin_credits
  where hunt_id='xinyi-2026-11'),'distinct spin credit rows');
reset role;
update public.waypost_spins set spun_at=now()-interval '1 day'
  where user_id='087e002a-3aee-4cb4-a1ad-a6d001dbba01'
    and waypost_id=(select id from h1_posts where n=2);
set local role authenticated;
select public.waypost_spin(id,lat,lng,10) from h1_posts where n=2;
select pg_temp.require_ok((select spin_count=3 from public.hunt_progress
  where hunt_id='xinyi-2026-11'),'repeat Waypost spin counted once');

-- A non-hunt Waypost in the same area succeeds but adds no hunt credit.
do $$ declare s record; v record;
begin
  select * into s from h1_nonhunt limit 1;
  perform pg_temp.require_ok(s.id is not null,'non-hunt Waypost fixture');
  select * into v from public.waypost_spin(s.id,s.lat,s.lng,10);
  perform pg_temp.require_ok(v.wax_awarded>=0,'ordinary non-hunt spin succeeds');
  perform pg_temp.require_ok((select spin_count=3 from public.hunt_progress
    where hunt_id='xinyi-2026-11'),'non-hunt spin not counted');
end $$;

do $$ declare s record; v record;
begin
  for s in select * from h1_spawns where area_distance<=1200 order by n limit 5 loop
    select * into v from public.corrupted_throw(s.spawn_id,s.lat,s.lng,10,'wax',1,true);
    perform pg_temp.require_ok(v.result='restored','deterministic successful catch');
  end loop;
  perform pg_temp.require_ok((select restore_count=5 from public.hunt_progress
    where hunt_id='xinyi-2026-11'),'five in-area catches count');
  select * into s from h1_spawns where area_distance>1200 limit 1;
  perform pg_temp.require_ok(s.id is not null,'outside-area spot fixture');
  select * into v from public.corrupted_throw(s.spawn_id,s.lat,s.lng,10,'wax',1,true);
  perform pg_temp.require_ok(v.result='restored','ordinary outside-area catch succeeds');
  perform pg_temp.require_ok((select restore_count=5 from public.hunt_progress
    where hunt_id='xinyi-2026-11'),'outside-area catch not counted');
end $$;
select pg_temp.expect_error(
  'select public.hunt_finish(''xinyi-2026-11'',25.037546,121.562754,10)',
  'hunt incomplete');

do $$ declare a record; v record; landmark record;
begin
  select * into landmark from h1_landmark;
  for i in 1..2 loop
    select * into a from public.landmark_start(landmark.id,landmark.lat,landmark.lng,10);
    loop
      select * into v from public.landmark_hit(a.attempt_id,landmark.lat,landmark.lng,10,'wax',1);
      exit when v.result='won';
    end loop;
  end loop;
  perform pg_temp.require_ok((select landmark_count=2 from public.hunt_progress
    where hunt_id='xinyi-2026-11'),'repeat landmark wins count');
end $$;
select pg_temp.expect_error(
  'select public.hunt_finish(''xinyi-2026-11'',25.033263,121.564887,10)',
  'too_far');
do $$ declare reward jsonb;
begin
  reward:=public.hunt_finish('xinyi-2026-11',25.037546,121.562754,10);
  perform pg_temp.require_ok(reward->>'state'='finished','hunt finishes at keeper');
  perform pg_temp.require_ok((reward->>'xp_gained')::integer=300,'300 XP awarded');
  perform pg_temp.require_ok((reward->>'gold_gained')::integer=5,'five Gold awarded');
end $$;
select pg_temp.expect_error(
  'select public.hunt_finish(''xinyi-2026-11'',25.037546,121.562754,10)',
  'already finished');
select pg_temp.require_ok((select count(*)=1 from public.hunt_passport_stamps
  where hunt_id='xinyi-2026-11'),'one hunt stamp');
select pg_temp.require_ok((select count(*)=1 from public.my_passport()
  where place='xinyi-2026-11' and how_earned='hunt'),'Passport includes hunt');
select pg_temp.require_ok((select gold_balls>=5 from public.game_state()),'Gold reward paid');
select public.waypost_spin(id,lat,lng,10) from h1_posts where n=5;
select pg_temp.require_ok((select spin_count=3 from public.hunt_progress
  where hunt_id='xinyi-2026-11'),'post-finish spin not counted');

-- Other players cannot read or write this player's progress.
select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbba02',true);
select pg_temp.require_ok((select count(*)=0 from public.hunt_progress),'other progress hidden');
select pg_temp.expect_error('update public.hunt_progress set spin_count=99','permission denied');
select public.waypost_spin(id,lat,lng,10) from h1_posts where n=1;
select pg_temp.require_ok((select count(*)=0 from public.hunt_progress),
  'nonparticipant spin unaffected');
select pg_temp.require_ok(public.hunt_join('xinyi-2026-11')->>'joined_at' is not null,
  'second player joins');
select pg_temp.require_ok((select count(*)=1 from public.hunt_progress),'own progress visible');
select pg_temp.require_ok((select count(*)=0 from public.my_passport()
  where how_earned='hunt'),'other stamp hidden');
select public.hunt_check_in('xinyi-2026-11',25.037546,121.562754,10);
reset role;
update public.hunts set starts_at=now()-interval '1 day',ends_at=now()-interval '1 hour'
  where id='xinyi-2026-11';
set local role authenticated;
select public.waypost_spin(id,lat,lng,10) from h1_posts where n=2;
select pg_temp.require_ok((select spin_count=0 from public.hunt_progress
  where hunt_id='xinyi-2026-11'),'spin after window not counted');
select pg_temp.expect_error(
  'select public.hunt_finish(''xinyi-2026-11'',25.037546,121.562754,10)',
  'hunt closed');
reset role;

-- Dedicated Taipei account is allowlisted for the map-tap walk route.
select pg_temp.require_ok(exists(select 1 from private.game_speed_allowlist a
  join auth.users u on u.id=a.user_id
  where u.email='expo-test-a138d8@timecapsule.test'),
  'dedicated Taipei test account allowlisted');
select set_config('request.jwt.claim.sub',
  (select u.id::text from auth.users u where u.email='expo-test-a138d8@timecapsule.test'),true);
set local role authenticated;
select public.corrupted_nearby(25.037546,121.562754,10);
select public.corrupted_nearby(lat,lng,10) from h1_posts order by n;
select public.corrupted_nearby(25.033263,121.564887,10);
select public.corrupted_nearby(25.037546,121.562754,10);
reset role;
