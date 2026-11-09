-- Append to the release migration without its final COMMIT, then roll back.
insert into auth.users(id,email) values('187e002a-3aee-4cb4-a1ad-a6d001dbbad1','game-release-sql@example.invalid');
insert into public.profiles(id,name) values('187e002a-3aee-4cb4-a1ad-a6d001dbbad1','Release rollback test');
create function pg_temp.expect_hint(statement text, expected text) returns void language plpgsql as $$
declare h text;
begin
 begin execute statement;
 exception when others then get stacked diagnostics h=pg_exception_hint;
  if h is distinct from expected then raise exception 'expected %, got %: %',expected,h,sqlerrm; end if;
  return;
 end;
 raise exception 'unexpected success: %',statement;
end $$;
select set_config('request.jwt.claim.sub','187e002a-3aee-4cb4-a1ad-a6d001dbbad1',true);
set local role authenticated;
select public.send_capsule(auth.uid(),'bottle','starter','',now()+interval '1 hour');
select pg_temp.expect_hint('select public.send_capsule(auth.uid(),''memorial-candle'',''unowned'','''',now()+interval ''1 hour'')','not_owned');
select pg_temp.expect_hint('select public.acquire_vessel(''vhs'')','collect_only');
select pg_temp.expect_hint('select public.acquire_vessel(''bamboo-tower'')','earned_only');
select public.acquire_vessel('maison');
select public.send_capsule(auth.uid(),'maison','owned brand','',now()+interval '1 hour');
select public.sea_throw('A hello to whoever passes','hint','bottle',1,25.037546,121.562754,10);
reset role;
insert into public.owned_vessels(user_id,vessel) values('187e002a-3aee-4cb4-a1ad-a6d001dbbad1','memorial-candle');
set local role authenticated;
select public.send_capsule(auth.uid(),'memorial-candle','owned free','',now()+interval '1 hour');
do $$ declare p jsonb; begin
 p:=public.corrupted_nearby(25.037546,121.562754,10);
 if not exists(select 1 from jsonb_array_elements(p->'wayposts') w where w->>'scene' in ('park','garden','waterfront','square','publicArt')) then raise exception 'missing scene'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.sea_shores where kind='landmark' and scene is not null) then raise exception 'landmark scene must be null';end if;
 if exists(select 1 from public.sea_shores where kind='common' and scene is null) then raise exception 'common scene missing';end if;
end $$;
select 'PASS: release sending, acquisition and scene rollback checks' as result;
rollback;
