-- Run inside a transaction after the migration body, then roll back.
create temp table drop_check (kind text primary key, id uuid not null);
grant select, insert on drop_check to authenticated;

insert into auth.users (id, email)
select ('afd10000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'drop-rollback-' || n || '@example.invalid'
from generate_series(1,4) n;
insert into public.profiles (id, name)
select id, 'Public drop fixture' from auth.users where email like 'drop-rollback-%@example.invalid'
on conflict (id) do nothing;

create function pg_temp.drop_expect(q text, expected text) returns void
language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if sqlerrm = expected then return; end if;
    raise exception 'expected %, got %', expected, sqlerrm;
  end;
  raise exception 'expected % but request succeeded', expected;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'afd10000-0000-4000-8000-000000000001', true);
insert into drop_check select 'walk', id from public.public_capsule_drop('Test letter from Civic Square', '', 'tin', 1, 25.0375, 121.5628, 10);
insert into drop_check select 'reports', id from public.public_capsule_drop('Test letter for review', '', 'tin', 7, 25.03727, 121.56262, 10);
do $$
begin
  perform pg_temp.drop_expect($q$select public.public_capsule_drop('Test', '', 'tin', 1, 0, 0, 10)$q$, 'no_shore');
  perform pg_temp.drop_expect($q$select public.public_capsule_drop('Test', '', 'tin', 1, 25.0375, 121.5628, 201)$q$, 'no_shore');
  perform pg_temp.drop_expect($q$select public.public_capsule_drop('Test', 'user@example.org', 'tin', 1, 25.0375, 121.5628, 10)$q$, 'rejected');
end;
$$;
reset role;

-- Direct fixture writes only shorten the configured drift for test pickup.
do $$
declare s private.public_capsule_points;
declare expected private.public_capsule_points;
begin
  select p.* into s from public.capsules c join private.public_capsule_points p
    on ((p.corrupted and p.id = c.corrupted_drop_spot) or (not p.corrupted and p.id = c.public_capsule_spot))
  where c.id = (select id from drop_check where kind = 'walk');
  select p.* into expected from private.public_capsule_points p
  where p.eligible order by public.distance_m(25.0375,121.5628,p.lat,p.lng), p.corrupted, p.id limit 1;
  if s.id is distinct from expected.id or s.corrupted is distinct from expected.corrupted
    or public.distance_m(25.0375,121.5628,s.lat,s.lng) not between 0.01 and 100
  then raise exception 'drop did not snap to the nearest eligible point'; end if;
  if not exists (select 1 from public.capsules where id = (select id from drop_check where kind = 'reports') and corrupted_drop_spot is not null and open_at = now() + interval '7 days')
  then raise exception 'drift timing changed'; end if;
  perform set_config('test.drop.lat',s.lat::text,true);
  perform set_config('test.drop.lng',s.lng::text,true);
  perform set_config('test.drop.city',s.city_en,true);
end;
$$;
update public.capsules set open_at=now() - interval '1 minute' where id in (select id from drop_check);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'afd10000-0000-4000-8000-000000000002', true);
do $$
declare cap uuid := (select id from drop_check where kind='walk');
declare point_lat double precision := current_setting('test.drop.lat')::double precision;
declare point_lng double precision := current_setting('test.drop.lng')::double precision;
begin
  if not exists (select 1 from public.public_capsule_nearby(point_lat,point_lng,10) n where n.id=cap and n.lat=point_lat and n.lng=point_lng)
  then raise exception 'Journey coordinates differ from the drop'; end if;
  perform pg_temp.drop_expect(format('select public.public_capsule_pick_up(%L,%s,%s,10)',cap,point_lat+150.0/111195,point_lng),'too_far');
  perform public.public_capsule_pick_up(cap,point_lat+70.0/111195,point_lng,10);
  if not exists (select 1 from public.open_capsule(cap) where message='Test letter from Civic Square')
  then raise exception 'finder could not open the letter'; end if;
  perform public.public_capsule_return(cap);
end;
$$;
reset role;
do $$
declare point_lat double precision := current_setting('test.drop.lat')::double precision;
declare point_lng double precision := current_setting('test.drop.lng')::double precision;
begin
  if not exists (
    select 1 from public.capsules c join private.public_capsule_points p
    on ((p.corrupted and p.id = c.corrupted_drop_spot) or (not p.corrupted and p.id = c.public_capsule_spot))
    where c.id=(select id from drop_check where kind='walk') and c.recipient is null
      and c.open_at=now()+interval '1 day' and c.public_capsule_returns=1
      and p.eligible and p.city_en=current_setting('test.drop.city') and public.distance_m(point_lat,point_lng,p.lat,p.lng)>=1000
  ) then raise exception 'pass it on changed its distance, same-city preference or timing'; end if;
end;
$$;

set local role authenticated;
do $$
declare cap uuid := (select id from drop_check where kind='reports');
declare point_lat double precision := current_setting('test.drop.lat')::double precision;
declare point_lng double precision := current_setting('test.drop.lng')::double precision;
begin
  for i in 2..3 loop
    perform set_config('request.jwt.claim.sub', 'afd10000-0000-4000-8000-' || lpad(i::text,12,'0'), true);
    perform public.public_capsule_pick_up(cap,point_lat,point_lng,10);
    perform public.open_capsule(cap);
    perform public.public_capsule_report(cap,'other');
  end loop;
  perform set_config('request.jwt.claim.sub','afd10000-0000-4000-8000-000000000004',true);
  if exists (select 1 from public.public_capsule_nearby(point_lat,point_lng,10) n where n.id=cap)
  then raise exception 'two reports did not hide the capsule'; end if;
  perform pg_temp.drop_expect(format('select public.public_capsule_pick_up(%L,%s,%s,10)',cap,point_lat,point_lng),'taken');

  perform set_config('request.jwt.claim.sub','1fd214ef-4de5-4b4f-81bc-77c3328441fe',true);
  perform public.admin_queue_resolve('public_capsule_report',cap::text,'restore',null);
  perform set_config('request.jwt.claim.sub','afd10000-0000-4000-8000-000000000004',true);
  perform public.public_capsule_pick_up(cap,point_lat,point_lng,10);
  perform public.open_capsule(cap);
  if not exists (select 1 from public.capsules where id=cap and recipient=auth.uid() and opened_at is not null)
  then raise exception 'restored capsule was not in the finder Inbox'; end if;
end;
$$;

-- File a new report without clearing the current finder's Inbox before Remove.
reset role;
insert into public.public_capsule_reports(capsule_id,reporter,reason)
select id,'afd10000-0000-4000-8000-000000000004','other' from drop_check where kind='reports';
set local role authenticated;
select set_config('request.jwt.claim.sub','1fd214ef-4de5-4b4f-81bc-77c3328441fe',true);
select public.admin_queue_resolve('public_capsule_report',id::text,'remove',null) from drop_check where kind='reports';
select set_config('request.jwt.claim.sub','afd10000-0000-4000-8000-000000000004',true);
do $$
begin
  if exists (select 1 from public.capsules c join drop_check f on f.id=c.id where f.kind='reports')
  then raise exception 'admin Remove left an opened capsule in the finder Inbox'; end if;
end;
$$;
reset role;
select 'PASS: nearest safe point, 100 m refusal, stored Journey position, 70/150 m pickup, pass it on, two-report hide, admin Remove' as result;
