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

-- This route existed before HL-C3 and includes both grandfathered rules.
do $$
declare h text;
declare spot public.corrupted_spots;
begin
  select * into spot from public.corrupted_spots where hidden_at is null order by id limit 1;
  update public.profiles set can_create_hunts=true where id=auth.uid();
  h:=public.private_hunt_create(jsonb_build_object('name','Legacy quest fixture','route_mode','ordered',
    'leaderboard_visible',false,'starts_at',now()-interval '1 hour','ends_at',now()+interval '1 hour',
    'guide_mode','fixed','guide_lat',spot.lat,'guide_lng',spot.lng))->>'id';
  perform public.private_hunt_quest_save(h,jsonb_build_object('name','Legacy Spin','quest_type','spin',
    'ordinal',1,'points',10,'location_lat',spot.lat,'location_lng',spot.lng));
  perform public.private_hunt_quest_save(h,jsonb_build_object('name','Legacy Catch','quest_type','restore',
    'ordinal',2,'points',10,'catch_count',1));
  perform set_config('test.legacy_hunt',h,true);
  perform set_config('test.legacy_spot',spot.id::text,true);
  perform set_config('test.legacy_code',public.private_hunt_publish(h)->>'join_code',true);
end $$;
