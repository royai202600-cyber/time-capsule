-- Hosted rollback preflight. Append after the three HKUST migration bodies
-- inside one transaction, then ROLLBACK; the fixtures never persist.
create function pg_temp.hkust_ok(ok boolean, why text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'HKUST: %',why; end if; end $$;
create function pg_temp.hkust_error(statement text, expected text) returns void language plpgsql as $$
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

select pg_temp.hkust_ok((select count(*)=6 from public.sea_shores
  where kind='common' and game_enabled and source_ref like '%;hkust-outdoor'),
  'six outdoor Wayposts');
select pg_temp.hkust_ok((select count(*)=11 from public.corrupted_spots
  where city='Hong Kong' and timezone='Asia/Hong_Kong'
    and source_ref like '%;hkust-outdoor'), 'eleven outdoor capsule spots');
select pg_temp.hkust_ok((select count(*)=1 from public.sea_shores
  where kind='landmark' and game_enabled and place='hkust'
    and lat=22.3374255 and lng=114.2629606), 'Piazza Landmark');
select pg_temp.hkust_ok((select count(*)=1 from public.vessels
  where id='red-bird' and earned_place='hkust'), 'earned vessel');
select pg_temp.hkust_ok((select count(*)=1 from public.hunts
  where id='hkust-2026-11' and reset_timezone='Asia/Hong_Kong'
    and ends_at='infinity'::timestamptz and reward_xp=300 and reward_gold=5),
  'daily-reset hunt');
select pg_temp.hkust_ok((select count(*)=5 from public.hunt_steps
  where hunt_id='hkust-2026-11'), 'five steps');

insert into auth.users(id,email) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbbb01','hkust-a@example.invalid'),
  ('087e002a-3aee-4cb4-a1ad-a6d001dbbb02','hkust-b@example.invalid');
insert into public.profiles(id,name) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbbb01','HKUST A'),
  ('087e002a-3aee-4cb4-a1ad-a6d001dbbb02','HKUST B');
insert into private.game_speed_allowlist(user_id) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbbb01'),
  ('087e002a-3aee-4cb4-a1ad-a6d001dbbb02');
update private.game_config set restore_common=1,restore_uncommon=1,restore_rare=1;

create temp table hkust_posts on commit drop as
  select row_number() over(order by source_ref) n,id,lat,lng
  from public.sea_shores where kind='common' and game_enabled
    and source_ref like '%;hkust-outdoor';
create temp table hkust_spawns on commit drop as
  select row_number() over(order by p.source_ref) n,p.lat,p.lng,r.spawn_id,r.vessel
  from public.corrupted_spots p
  cross join lateral private.resolve_spawn(p.id,
    floor(extract(epoch from now())/600)::bigint) r
  where p.source_ref like '%;hkust-outdoor';
create temp table hkust_landmark on commit drop as
  select id,lat,lng from public.sea_shores
  where place='hkust' and kind='landmark';
grant select on hkust_posts,hkust_spawns,hkust_landmark to authenticated;
select pg_temp.hkust_ok((select count(*)=11 from hkust_spawns),
  'all outdoor spots resolve to Hong Kong vessels');
select pg_temp.hkust_ok((select count(*)=11 from hkust_spawns
  where vessel in ('dim-sum-steamer','postbox','phone-booth')),
  'Hong Kong vessel set');

select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbbb01',true);
set local role authenticated;
select pg_temp.hkust_ok((select count(*)=1 from jsonb_array_elements(
  public.hunt_list(22.3390965,114.2641011)) h
  where h->>'id'='hkust-2026-11'), 'hunt listed');
select pg_temp.hkust_ok(public.hunt_join('hkust-2026-11')
  ->>'keeper_spot_en'='LG7 Lawn', 'Keeper spot');
select pg_temp.hkust_error(
  'select public.hunt_check_in(''hkust-2026-11'',22.3374255,114.2629606,10)',
  'too_far');
select public.waypost_spin(id,lat,lng,10) from hkust_posts where n=1;
select pg_temp.hkust_ok((select spin_count=0 from public.hunt_progress
  where hunt_id='hkust-2026-11' and user_id=auth.uid()),
  'pre-check-in spin ignored');
select pg_temp.hkust_ok(public.hunt_check_in('hkust-2026-11',
  22.3390965,114.2641011,10)->>'checked_in_at' is not null,'checked in');
select pg_temp.hkust_error(
  'select public.hunt_finish(''hkust-2026-11'',22.3390965,114.2641011,10)',
  'hunt incomplete');
select public.waypost_spin(id,lat,lng,10) from hkust_posts where n between 2 and 4;
select pg_temp.hkust_ok((select spin_count=3 from public.hunt_progress
  where hunt_id='hkust-2026-11' and user_id=auth.uid()),
  'three distinct spins');
reset role;
update public.waypost_spins set spun_at=now()-interval '1 day'
  where user_id='087e002a-3aee-4cb4-a1ad-a6d001dbbb01'
    and waypost_id=(select id from hkust_posts where n=2);
set local role authenticated;
select public.waypost_spin(id,lat,lng,10) from hkust_posts where n=2;
select pg_temp.hkust_ok((select spin_count=3 from public.hunt_progress
  where hunt_id='hkust-2026-11' and user_id=auth.uid()),
  'repeat spin ignored');

do $$ declare s record; v record;
begin
  for s in select * from hkust_spawns order by n limit 5 loop
    select * into v from public.corrupted_throw(s.spawn_id,s.lat,s.lng,10,'wax',1,true);
    perform pg_temp.hkust_ok(v.result='restored','catch succeeds');
  end loop;
  perform pg_temp.hkust_ok((select restore_count=5 from public.hunt_progress
    where hunt_id='hkust-2026-11' and user_id=auth.uid()),
    'five catches counted');
end $$;
do $$ declare a record; v record; s record;
begin
  select * into s from hkust_landmark;
  select * into a from public.landmark_start(s.id,s.lat,s.lng,10);
  loop
    select * into v from public.landmark_hit(a.attempt_id,s.lat,s.lng,10,'wax',1);
    exit when v.result='won';
  end loop;
  perform pg_temp.hkust_ok(v.vessel='red-bird','Landmark awards red-bird');
  perform pg_temp.hkust_ok((select landmark_count=1 from public.hunt_progress
    where hunt_id='hkust-2026-11' and user_id=auth.uid()),
    'Landmark win counts');
end $$;
select pg_temp.hkust_ok((public.hunt_finish('hkust-2026-11',
  22.3390965,114.2641011,10)->>'xp_gained')::integer=300,'300 XP');
select pg_temp.hkust_error(
  'select public.hunt_finish(''hkust-2026-11'',22.3390965,114.2641011,10)',
  'already finished');
select pg_temp.hkust_ok((select count(*)=1 from public.my_passport()
  where place='hkust' and how_earned='landmark'), 'Landmark stamp');
select pg_temp.hkust_ok((select count(*)=1 from public.my_passport()
  where place='hkust-2026-11' and how_earned='hunt'), 'hunt stamp');

select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbbb02',true);
select pg_temp.hkust_ok((select count(*)=0 from public.hunt_progress
  where hunt_id='hkust-2026-11'), 'other progress hidden by RLS');
select pg_temp.hkust_error('update public.hunt_progress set spin_count=99',
  'permission denied');
select public.waypost_spin(id,lat,lng,10) from hkust_posts where n=5;
select pg_temp.hkust_ok((select count(*)=0 from public.hunt_progress
  where hunt_id='hkust-2026-11'), 'nonparticipant spin unaffected');
reset role;
