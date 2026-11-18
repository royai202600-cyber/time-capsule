-- Run before the pool migration in the same transaction.
insert into auth.users(id,email)
select ('c3a10000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'question-pool-rollback-' || n || '@example.invalid'
from generate_series(1,5) n;
insert into public.profiles(id,name)
select id,'Question pool fixture' from auth.users
where email like 'question-pool-rollback-%@example.invalid' on conflict (id) do nothing;
insert into private.admin_members(user_id,role)
select ('c3a10000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,role
from (values (1,'owner'),(2,'admin'),(3,'moderator'),(4,'viewer')) m(n,role);

create function pg_temp.pool_user(n integer) returns void language sql as $$
  select set_config('request.jwt.claim.sub', 'c3a10000-0000-4000-8000-' || lpad(n::text,12,'0'), true)
$$;
create function pg_temp.pool_eq(actual jsonb, expected jsonb, context text) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then raise exception '% changed', context; end if;
end $$;
create function pg_temp.pool_expect(statement text, message text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlerrm = message then return; end if;
    raise;
  end;
  raise exception 'expected %', message;
end $$;

select pg_temp.pool_user(1);
select set_config('test.ce1_before', public.city_puzzle_today()::text, true);
do $$
declare baseline jsonb;
begin
  begin
    baseline := public.city_puzzle_guess('taipei',0.01);
    raise sqlstate 'P9001';
  exception when sqlstate 'P9001' then
    perform set_config('test.ce1_guess_before',baseline::text,true);
  end;
end $$;
