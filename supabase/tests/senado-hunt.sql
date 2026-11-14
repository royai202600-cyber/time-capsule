-- Hosted rollback preflight for the Senado hunt. Append after both migration
-- bodies inside one transaction, then ROLLBACK. Fixtures never persist.
create function pg_temp.require_ok(ok boolean, why text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'Senado hunt: %',why; end if; end $$;
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

select pg_temp.require_ok((select count(*)=1 from public.hunts
  where id='senado-square-2026-11' and reset_timezone='Asia/Macau'
    and area_radius_m=800 and reward_xp=300 and reward_gold=5),
  'hunt seed and settings');
select pg_temp.require_ok((select count(*)=9 from public.sea_shores s
  where s.kind='common' and s.game_enabled
    and public.distance_m(22.19383,113.53999,s.lat,s.lng)<=800),
  'nine eligible Wayposts');
select pg_temp.require_ok((select count(*)=24 from public.corrupted_spots s
  where public.distance_m(22.19383,113.53999,s.lat,s.lng)<=800),
  '24 eligible capsule spots');
-- The fountain action point moved in 20261110102000. Its Keeper is about 290 m away.
select pg_temp.require_ok((select public.distance_m(h.keeper_lat,h.keeper_lng,s.lat,s.lng)
  between 280 and 700 from public.hunts h join public.sea_shores s on s.id=h.landmark
  where h.id='senado-square-2026-11'),'Keeper distance');
select pg_temp.require_ok((select count(*)=5 from public.hunt_steps
  where hunt_id='senado-square-2026-11'),'five steps');

insert into auth.users(id,email) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba14','senado-a@example.invalid'),
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba15','senado-b@example.invalid');
insert into public.profiles(id,name) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba14','Senado A'),
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba15','Senado B');
insert into private.game_speed_allowlist(user_id) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba14'),
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba15');
update private.game_config set spawn_chance=1,visible_min_minutes=wave_minutes,
  visible_max_minutes=wave_minutes,restore_common=1,restore_uncommon=1,restore_rare=1;

create temp table senado_posts on commit drop as
  select row_number() over(order by s.source_ref) n,s.id,s.lat,s.lng,s.source_ref
  from public.sea_shores s where s.kind='common' and s.game_enabled
    and (s.source_ref like '%346900281%' or s.source_ref like '%183840226%')
    and public.distance_m(22.19383,113.53999,s.lat,s.lng)<=800;
create temp table senado_spawns on commit drop as
  select row_number() over(order by s.source_ref) n,s.id,s.lat,s.lng,r.spawn_id
  from public.corrupted_spots s
  cross join lateral private.resolve_spawn(s.id,
    floor(extract(epoch from now())/((select wave_minutes from private.game_config where singleton)*60))::bigint) r
  where s.source_ref like '%346900281%' or s.source_ref like '%183840226%';
create temp table senado_landmark on commit drop as
  select s.id,s.lat,s.lng from public.hunts h join public.sea_shores s on s.id=h.landmark
  where h.id='senado-square-2026-11';
create temp table senado_outside_post on commit drop as
  select s.id,s.lat,s.lng from public.sea_shores s
  where s.kind='common' and s.game_enabled
    and public.distance_m(22.19383,113.53999,s.lat,s.lng)>800
  order by public.distance_m(22.19383,113.53999,s.lat,s.lng) limit 1;
create temp table senado_outside_spawn on commit drop as
  select s.id,s.lat,s.lng,r.spawn_id from public.corrupted_spots s
  cross join lateral private.resolve_spawn(s.id,
    floor(extract(epoch from now())/((select wave_minutes from private.game_config where singleton)*60))::bigint) r
  where s.city='Macau' and public.distance_m(22.19383,113.53999,s.lat,s.lng)>800
  order by public.distance_m(22.19383,113.53999,s.lat,s.lng) limit 1;
grant select on senado_posts,senado_spawns,senado_landmark,
  senado_outside_post,senado_outside_spawn to authenticated;
select pg_temp.require_ok((select count(*)>=3 from senado_posts),
  'all-hours Jorge Alvares and Vasco da Gama Wayposts');
select pg_temp.require_ok((select count(*)>=5 from senado_spawns),
  'all-hours Jorge Alvares and Vasco da Gama capsule spots');
select pg_temp.require_ok((select count(*)=1 from senado_outside_post)
  and (select count(*)=1 from senado_outside_spawn),'outside-area fixtures');

select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbba14',true);
set local role authenticated;
select pg_temp.require_ok((select count(*)=1 from jsonb_array_elements(
  public.hunt_list(22.1911014,113.5395126)) h
  where h->>'id'='senado-square-2026-11'), 'hunt listed');
select pg_temp.require_ok(public.hunt_join('senado-square-2026-11')
  ->>'keeper_spot_zh'='區華利前地','Keeper Chinese spot');
select pg_temp.require_ok(public.hunt_join('senado-square-2026-11')
  ->>'landmark_name_en'='Senado Square','Landmark English name');
select pg_temp.expect_error(
  'select public.hunt_check_in(''senado-square-2026-11'',22.19383,113.53999,10)',
  'too_far');
select public.waypost_spin(id,lat,lng,10) from senado_posts where n=1;
select pg_temp.require_ok((select spin_count=0 from public.hunt_progress
  where hunt_id='senado-square-2026-11' and user_id=auth.uid()),
  'pre-check-in spin ignored');
select pg_temp.require_ok(public.hunt_check_in('senado-square-2026-11',
  22.1911014,113.5395126,10)->>'checked_in_at' is not null,'checked in');
select pg_temp.expect_error(
  'select public.hunt_finish(''senado-square-2026-11'',22.1911014,113.5395126,10)',
  'hunt incomplete');
select public.waypost_spin(id,lat,lng,10) from senado_posts where n between 2 and 4;
select pg_temp.require_ok((select spin_count=3 from public.hunt_progress
  where hunt_id='senado-square-2026-11' and user_id=auth.uid()),
  'three unique Wayposts counted');
reset role;
update public.waypost_spins set spun_at=now()-interval '1 day'
  where user_id='087e002a-3aee-4cb4-a1ad-a6d001dbba14'
    and waypost_id=(select id from senado_posts where n=2);
set local role authenticated;
select public.waypost_spin(id,lat,lng,10) from senado_posts where n=2;
select pg_temp.require_ok((select spin_count=3 from public.hunt_progress
  where hunt_id='senado-square-2026-11' and user_id=auth.uid()),
  'repeat Waypost ignored');
select public.waypost_spin(id,lat,lng,10) from senado_outside_post;
select pg_temp.require_ok((select spin_count=3 from public.hunt_progress
  where hunt_id='senado-square-2026-11' and user_id=auth.uid()),
  'outside-area Waypost ignored');

do $$ declare s record; v record;
begin
  for s in select * from senado_spawns order by n limit 5 loop
    select * into v from public.corrupted_throw(s.spawn_id,s.lat,s.lng,10,'wax',1,true);
    perform pg_temp.require_ok(v.result='restored','catch succeeds');
  end loop;
  perform pg_temp.require_ok((select restore_count=5 from public.hunt_progress
    where hunt_id='senado-square-2026-11' and user_id=auth.uid()),
    'five catches counted');
  select * into s from senado_outside_spawn;
  select * into v from public.corrupted_throw(s.spawn_id,s.lat,s.lng,10,'wax',1,true);
  perform pg_temp.require_ok(v.result='restored','outside-area catch succeeds');
  perform pg_temp.require_ok((select restore_count=5 from public.hunt_progress
    where hunt_id='senado-square-2026-11' and user_id=auth.uid()),
    'outside-area catch ignored');
end $$;
do $$ declare a record; v record; s record;
begin
  select * into s from senado_landmark;
  select * into a from public.landmark_start(s.id,s.lat,s.lng,10);
  loop
    select * into v from public.landmark_hit(a.attempt_id,s.lat,s.lng,10,'wax',1);
    exit when v.result='won';
  end loop;
  perform pg_temp.require_ok((select landmark_count=1 from public.hunt_progress
    where hunt_id='senado-square-2026-11' and user_id=auth.uid()),
    'Landmark win counted');
end $$;
do $$ declare reward jsonb;
begin
  reward:=public.hunt_finish('senado-square-2026-11',22.1911014,113.5395126,10);
  perform pg_temp.require_ok(reward->>'state'='finished','finished');
  perform pg_temp.require_ok((reward->>'xp_gained')::integer=300,'300 XP');
  perform pg_temp.require_ok((reward->>'gold_gained')::integer=5,'five Gold');
end $$;
select pg_temp.expect_error(
  'select public.hunt_finish(''senado-square-2026-11'',22.1911014,113.5395126,10)',
  'already finished');
select pg_temp.require_ok((select count(*)=1 from public.my_passport()
  where place='senado-square-2026-11' and how_earned='hunt'),
  'Passport hunt stamp');

select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbba15',true);
select pg_temp.require_ok((select count(*)=0 from public.hunt_progress),
  'other progress hidden by RLS');
select pg_temp.expect_error('update public.hunt_progress set spin_count=99',
  'permission denied');
select public.waypost_spin(id,lat,lng,10) from senado_posts where n=4;
select pg_temp.require_ok((select count(*)=0 from public.hunt_progress),
  'nonparticipant action unaffected');
reset role;

update public.hunts set starts_at=now()-interval '2 days',
  ends_at=now()-interval '1 hour'
  where id='senado-square-2026-11';
set local role authenticated;
select pg_temp.expect_error(
  'select public.hunt_join(''senado-square-2026-11'')','hunt closed');
reset role;
