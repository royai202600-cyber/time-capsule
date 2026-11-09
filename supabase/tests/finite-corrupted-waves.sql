-- Append after the finite-wave migration without COMMIT. All writes roll back.
insert into auth.users(id,email) values('087e002a-3aee-4cb4-a1ad-a6d001dbbad8','finite-wave-sql@example.invalid');
insert into public.profiles(id,name) values('087e002a-3aee-4cb4-a1ad-a6d001dbbad8','Finite wave QA');
insert into private.game_speed_allowlist(user_id) values('087e002a-3aee-4cb4-a1ad-a6d001dbbad8');
select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbbad8',true);
set local role authenticated;
create temp table initial_batch as select public.corrupted_nearby(25.037546,121.562754,10)->'spawns' as spawns;
do $$ begin if (select jsonb_array_length(spawns) from initial_batch)<>6 then raise exception 'initial target';end if;end $$;
reset role;
insert into public.corrupted_catches(user_id,spawn_id,attempts,result,vessel)
select '087e002a-3aee-4cb4-a1ad-a6d001dbbad8',(spawns->0)->>'spawn_id',1,'caught',(spawns->0)->>'vessel' from initial_batch;
set local role authenticated;
do $$ declare visible jsonb; begin
 visible:=public.corrupted_nearby(25.037546,121.562754,10)->'spawns';
 if jsonb_array_length(visible)<>5 then raise exception 'caught capsule was refilled';end if;
 if exists(select 1 from jsonb_array_elements(visible) current where not exists(select 1 from initial_batch b cross join lateral jsonb_array_elements(b.spawns) old where current->>'spawn_id'=old->>'spawn_id')) then raise exception 'new ID entered old wave';end if;
end $$;
reset role;
insert into public.corrupted_catches(user_id,spawn_id,attempts,result,vessel)
select '087e002a-3aee-4cb4-a1ad-a6d001dbbad8',s->>'spawn_id',1,'caught',s->>'vessel' from initial_batch b cross join lateral jsonb_array_elements(b.spawns) s
on conflict(user_id,spawn_id) do nothing;
set local role authenticated;
do $$ begin
 if jsonb_array_length(public.corrupted_nearby(25.037546,121.562754,10)->'spawns')<>0 then raise exception 'cleared wave refilled';end if;
end $$;
reset role;
select 'PASS: stable six -> five -> zero; no refill before next ten-minute wave' as result;
rollback;
