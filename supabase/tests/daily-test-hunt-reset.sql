-- Append after the migration body, with its BEGIN/COMMIT removed, inside a
-- hosted transaction that ends in ROLLBACK. All fixtures are disposable.
create function pg_temp.require_ok(ok boolean, why text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'daily hunt reset: %',why; end if; end $$;
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

insert into auth.users(id,email) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba13','daily-reset@example.invalid');
insert into public.profiles(id,name) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba13','Daily Reset');
insert into private.game_speed_allowlist(user_id) values
  ('087e002a-3aee-4cb4-a1ad-a6d001dbba13');
update public.hunts set reset_timezone='Asia/Taipei',time_limit_min=null where id='xinyi-2026-11';
select pg_temp.require_ok((select count(*)=1 from public.hunts
  where id='xinyi-2026-11' and reset_timezone='Asia/Taipei'), 'opt-in timezone');

select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbba13',true);
set local role authenticated;
select pg_temp.require_ok(public.hunt_join('xinyi-2026-11')->>'joined_at' is not null,
  'joined');
select pg_temp.require_ok(public.hunt_check_in('xinyi-2026-11',25.037546,121.562754,10)
  ->>'checked_in_at' is not null,'initial check-in');
reset role;

-- An attempt made yesterday must appear reset without a scheduled job.
update public.hunt_progress set joined_at=now()-interval '2 days',
  checked_in_at=now()-interval '1 day',spin_count=2,restore_count=4,landmark_count=1
  where hunt_id='xinyi-2026-11' and user_id='087e002a-3aee-4cb4-a1ad-a6d001dbba13';
insert into public.hunt_spin_credits(hunt_id,user_id,waypost_id)
select 'xinyi-2026-11','087e002a-3aee-4cb4-a1ad-a6d001dbba13',s.id
from public.sea_shores s where s.source_ref='osm:node/12396028030';
select pg_temp.require_ok((select count(*)=1 from public.hunt_spin_credits
  where user_id='087e002a-3aee-4cb4-a1ad-a6d001dbba13'),'old spin credit fixture');

set local role authenticated;
create temp table daily_obj as select public.hunt_join('xinyi-2026-11') obj;
select pg_temp.require_ok((select obj->>'checked_in_at' is null from daily_obj),
  'expired check-in hidden');
select pg_temp.require_ok((select sum((step->>'count')::int)=0
  from daily_obj cross join lateral jsonb_array_elements(obj->'steps') step),
  'all unfinished step counts appear zero');
select pg_temp.expect_error(
  'select public.hunt_finish(''xinyi-2026-11'',25.037546,121.562754,10)',
  'check in first');
select public.waypost_spin(s.id,s.lat,s.lng,10) from public.sea_shores s
  where s.source_ref='osm:way/1341042550';
select pg_temp.require_ok((select spin_count=2 from public.hunt_progress
  where hunt_id='xinyi-2026-11' and user_id=auth.uid()),
  'action before renewed check-in does not count');
select pg_temp.require_ok(public.hunt_check_in('xinyi-2026-11',25.037546,121.562754,10)
  ->>'checked_in_at' is not null,'new day check-in');
select pg_temp.require_ok((select spin_count=0 and restore_count=0 and landmark_count=0
  from public.hunt_progress where hunt_id='xinyi-2026-11' and user_id=auth.uid()),
  'counts reset on new check-in');
select pg_temp.require_ok((select count(*)=0 from public.hunt_spin_credits
  where hunt_id='xinyi-2026-11' and user_id=auth.uid()),
  'old distinct Waypost credits cleared');
select public.waypost_spin(s.id,s.lat,s.lng,10) from public.sea_shores s
  where s.source_ref='osm:node/12396028030';
select pg_temp.require_ok((select spin_count=1 from public.hunt_progress
  where hunt_id='xinyi-2026-11' and user_id=auth.uid()),
  'same Waypost credits on new day');
reset role;

-- Finished progress remains finished even on a later local date.
update public.hunt_progress set joined_at=now()-interval '3 days',
  checked_in_at=now()-interval '2 days',finished_at=now()-interval '1 day',
  spin_count=3,restore_count=5,landmark_count=1
  where hunt_id='xinyi-2026-11' and user_id='087e002a-3aee-4cb4-a1ad-a6d001dbba13';
set local role authenticated;
create temp table finished_obj as select public.hunt_join('xinyi-2026-11') obj;
select pg_temp.require_ok((select obj->>'finished_at' is not null
  and (select (step->>'count')::int from jsonb_array_elements(obj->'steps') step
    where step->>'key'='spin')=3 from finished_obj),'finished progress kept');
select pg_temp.expect_error(
  'select public.hunt_finish(''xinyi-2026-11'',25.037546,121.562754,10)',
  'already finished');
reset role;

-- Hunts without the setting retain their previous cross-day progress.
update public.hunts set reset_timezone=null where id='xinyi-2026-11';
update public.hunt_progress set finished_at=null
  where hunt_id='xinyi-2026-11' and user_id='087e002a-3aee-4cb4-a1ad-a6d001dbba13';
set local role authenticated;
create temp table legacy_obj as select public.hunt_join('xinyi-2026-11') obj;
select pg_temp.require_ok((select obj->>'checked_in_at' is not null
  and (select (step->>'count')::int from jsonb_array_elements(obj->'steps') step
    where step->>'key'='spin')=3 from legacy_obj),'unconfigured hunt unchanged');
reset role;
