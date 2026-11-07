-- Hosted transaction/rollback integration tests; never modifies real accounts.
-- Run with: npx supabase db query --remote=<project> --file supabase/tests/landmark-vessels.sql --yes
begin;
insert into auth.users (id,email) values
 ('987e002a-3aee-4cb4-a1ad-a6d001dbbad1','landmark-sql-sender@example.invalid'),
 ('987e002a-3aee-4cb4-a1ad-a6d001dbbad2','landmark-sql-recipient@example.invalid');
insert into public.profiles (id,name) values
 ('987e002a-3aee-4cb4-a1ad-a6d001dbbad1','Landmark test sender'),
 ('987e002a-3aee-4cb4-a1ad-a6d001dbbad2','Landmark test recipient');
insert into public.friendships (user_id,friend_id) values
 ('987e002a-3aee-4cb4-a1ad-a6d001dbbad1','987e002a-3aee-4cb4-a1ad-a6d001dbbad2');
create function pg_temp.expect_failure(statement text, expected_hint text default null)
returns void language plpgsql as $$
declare actual_hint text;
begin
  begin execute statement;
  exception when others then
    get stacked diagnostics actual_hint = pg_exception_hint;
    if expected_hint is not null and actual_hint is distinct from expected_hint then
      raise exception 'wrong denial: % / %', sqlerrm, actual_hint;
    end if;
    return;
  end;
  raise exception 'unexpected success: %', statement;
end $$;
select set_config('request.jwt.claim.sub','987e002a-3aee-4cb4-a1ad-a6d001dbbad1',true);
set local role authenticated;
do $$
declare v record;
begin
  for v in select id from public.vessels where earned_place is not null loop
    perform pg_temp.expect_failure(format('select public.acquire_vessel(%L)',v.id),'earned_only');
    perform pg_temp.expect_failure(format('select public.send_capsule(%L,%L,%L,%L,now()+interval ''1 hour'')',auth.uid(),v.id,'test','test'),'not_owned');
  end loop;
  -- Ordinary paid acquisition still works, without changing its price.
  perform public.acquire_vessel('vinyl');
  perform public.send_capsule(auth.uid(),'vinyl','paid vessel regression','test',now()+interval '1 hour');
  perform public.send_capsule(auth.uid(),'photo-strip','free vessel regression','test',now()+interval '1 hour');
end $$;
reset role;
-- Every place: one ready capsule and one time-locked capsule.
insert into public.capsules(id,sender,recipient,vessel,hint,open_at,place)
select gen_random_uuid(),'987e002a-3aee-4cb4-a1ad-a6d001dbbad1','987e002a-3aee-4cb4-a1ad-a6d001dbbad2',
 'photo-strip','landmark ready test',now()-interval '1 minute',earned_place
from public.vessels where earned_place is not null;
insert into public.capsule_contents(capsule_id,message)
select id,'recipient-only content' from public.capsules where hint='landmark ready test' and sender='987e002a-3aee-4cb4-a1ad-a6d001dbbad1';
insert into public.capsules(sender,recipient,vessel,hint,open_at,place)
values('987e002a-3aee-4cb4-a1ad-a6d001dbbad1','987e002a-3aee-4cb4-a1ad-a6d001dbbad2','photo-strip','landmark locked test',now()+interval '1 hour','tst-clock');
insert into public.capsule_contents(capsule_id,message)
select id,'locked' from public.capsules where hint='landmark locked test' and sender='987e002a-3aee-4cb4-a1ad-a6d001dbbad1';
insert into public.capsules(sender,recipient,vessel,hint,open_at,place)
select '987e002a-3aee-4cb4-a1ad-a6d001dbbad1','987e002a-3aee-4cb4-a1ad-a6d001dbbad2','photo-strip','landmark repeat test',now()-interval '1 minute','tst-clock';
insert into public.capsule_contents(capsule_id,message)
select id,'Already owned reward' from public.capsules where hint='landmark repeat test' and sender='987e002a-3aee-4cb4-a1ad-a6d001dbbad1';
-- Sender cannot open another recipient's capsule or receive its reward.
set local role authenticated;
do $$ declare c uuid; begin
 select id into c from public.capsules where hint='landmark ready test' limit 1;
 perform pg_temp.expect_failure(format('select * from public.open_capsule(%L,22.29359,114.16954,10)',c));
end $$;
reset role;
select set_config('request.jwt.claim.sub','987e002a-3aee-4cb4-a1ad-a6d001dbbad2',true);
set local role authenticated;
do $$
declare c record; opened timestamptz; again timestamptz; v text;
begin
  perform pg_temp.expect_failure(format('select * from public.open_capsule(%L,22.29359,114.16954,10)',
    (select id from public.capsules where hint='landmark locked test')),'locked');
  for c in select cap.id,p.lat,p.lng,p.id as place from public.capsules cap join public.places p on p.id=cap.place where cap.hint='landmark ready test' loop
    select id into v from public.vessels where earned_place=c.place;
    perform pg_temp.expect_failure(format('select * from public.open_capsule(%L)',c.id),'no_location');
    perform pg_temp.expect_failure(format('select * from public.open_capsule(%L,%s,%s,201)',c.id,c.lat,c.lng),'inaccurate');
    perform pg_temp.expect_failure(format('select * from public.open_capsule(%L,0,0,10)',c.id),'far');
    if exists(select 1 from public.owned_vessels where user_id=auth.uid() and vessel=v) then raise exception 'reward before successful open'; end if;
    select o.opened_at into opened from public.open_capsule(c.id,c.lat,c.lng,10) o;
    if not exists(select 1 from public.owned_vessels where user_id=auth.uid() and vessel=v) then raise exception 'missing reward at %',c.place; end if;
    select o.opened_at into again from public.open_capsule(c.id) o;
    if opened is distinct from again then raise exception 'repeat open changed timestamp'; end if;
    if (select count(*) from public.owned_vessels where user_id=auth.uid() and vessel=v)<>1 then raise exception 'duplicate reward'; end if;
    -- Earned owner can send it; it still cannot be acquired through Shop.
    perform public.send_capsule(auth.uid(),v,'earned vessel regression','test',now()+interval '1 hour');
    perform pg_temp.expect_failure(format('select public.acquire_vessel(%L)',v),'earned_only');
  end loop;
  perform public.open_capsule((select id from public.capsules where hint='landmark repeat test'),22.29359,114.16954,10);
  if (select count(*) from public.owned_vessels where user_id=auth.uid())<>10 then raise exception 'expected ten landmark rewards'; end if;
  perform pg_temp.expect_failure('insert into public.owned_vessels(user_id,vessel) values(auth.uid(),''vinyl'')');
  perform pg_temp.expect_failure('select * from public.capsule_contents');
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.owned_vessels where user_id='987e002a-3aee-4cb4-a1ad-a6d001dbbad1' and vessel in(select id from public.vessels where earned_place is not null)) then raise exception 'sender received reward'; end if;
 if has_function_privilege('anon','public.acquire_vessel(text)','execute') or has_function_privilege('anon','public.open_capsule(uuid,double precision,double precision,double precision)','execute') then raise exception 'anonymous execute granted'; end if;
end $$;
select 'PASS: all 10 acquisition/send denials, all 10 verified rewards, retry idempotence, ownership, time/location/RLS and ordinary-vessel regressions' as result;
rollback;
