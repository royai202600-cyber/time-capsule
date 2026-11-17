-- Run after the migration inside the same transaction, then ROLLBACK.
create function pg_temp.require_ok(ok boolean, reason text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'assertion failed: %', reason; end if;
end $$;

create function pg_temp.expect_guess_error(guess numeric, expected text)
returns void language plpgsql as $$
begin
  begin
    perform public.city_puzzle_guess('taipei', guess);
  exception when raise_exception then
    if sqlerrm = expected then return; end if;
    raise;
  end;
  raise exception 'expected % for guess %', expected, guess;
end $$;

select pg_temp.require_ok(
  (select count(*) = 4 from (
    select city from public.city_puzzle_questions where published group by city having count(*) = 28
  ) catalog), '112 published questions across four cities');
select pg_temp.require_ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.city_puzzle_questions'::regclass, 'public.city_puzzle_plays'::regclass
  ))
  and not has_table_privilege('authenticated', 'public.city_puzzle_questions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.city_puzzle_plays', 'INSERT,UPDATE,DELETE')
  and not has_function_privilege('anon', 'public.city_puzzle_today()', 'EXECUTE'),
  'RLS and least privilege');

select pg_temp.require_ok(
  private.city_puzzle_date('2026-11-17 15:59:59+00') = date '2026-11-17'
  and private.city_puzzle_date('2026-11-17 16:00:00+00') = date '2026-11-18'
  and private.city_puzzle_no(date '2026-11-17') + 1 = private.city_puzzle_no(date '2026-11-18')
  and (private.city_puzzle_question('taipei', date '2026-11-17')).seq = 1
  and (private.city_puzzle_question('taipei', date '2026-11-18')).seq = 2
  and (private.city_puzzle_question('taipei', date '2026-12-15')).seq = 1,
  'Asia/Taipei midnight advances puzzle and the catalog wraps');

insert into auth.users (id, email)
values ('c61c0de8-8629-4fd6-a8e0-44af1647e6f1', 'city-puzzle-sql@example.invalid');
insert into public.profiles (id, name)
values ('c61c0de8-8629-4fd6-a8e0-44af1647e6f1', 'City puzzle rollback') on conflict (id) do nothing;
select set_config('request.jwt.claim.sub', 'c61c0de8-8629-4fd6-a8e0-44af1647e6f1', true);

-- Test exact margin boundaries with a US$100 answer while leaving the seed untouched.
update public.city_puzzle_questions set local_price = usd_rate * 100
where id = (private.city_puzzle_question('taipei', private.city_puzzle_date(statement_timestamp()))).id;
insert into public.city_puzzle_plays (user_id, city, play_date, question_id, guesses, done, won, reward)
select auth.uid(), q.city, private.city_puzzle_date(statement_timestamp()) - past.days, q.id,
  '[{"usd":100,"hint":"solved","close":true}]', true, true, 3
from public.city_puzzle_questions q
cross join (values (1), (2), (4)) past(days)
where q.seq = 1 and q.city in ('hongkong','macau');

set local role authenticated;
do $$
declare day jsonb; result jsonb; mark jsonb; base integer;
begin
  day := public.city_puzzle_today();
  perform pg_temp.require_ok(jsonb_array_length(day->'puzzles') = 4 and day->>'streak' = '2',
    'four cities, two prior consecutive days despite repeated cities and an older gap');
  perform pg_temp.require_ok(
    (select bool_and(p->'answer' = 'null' and p->'reward' = 'null'
      and not p ?| array['local_price', 'usd', 'fact_en', 'source'])
     from jsonb_array_elements(day->'puzzles') p), 'unfinished answers hidden');

  perform pg_temp.expect_guess_error(null, 'bad_guess');
  perform pg_temp.expect_guess_error(0, 'bad_guess');
  perform pg_temp.expect_guess_error(-1, 'bad_guess');
  perform pg_temp.expect_guess_error(1000000.01, 'bad_guess');
  perform pg_temp.expect_guess_error(1.001, 'bad_guess');
  perform pg_temp.expect_guess_error('NaN', 'bad_guess');
  perform pg_temp.expect_guess_error('Infinity', 'bad_guess');

  select wax_balls into base from public.game_state();
  result := public.city_puzzle_guess('taipei', 74.99);
  mark := result #> '{puzzle,guesses,0}';
  perform pg_temp.require_ok(mark->>'hint' = 'higher' and mark->>'close' = 'false'
    and result#>'{puzzle,answer}' = 'null' and result->'state' = 'null', 'outside close margin');
  result := public.city_puzzle_guess('taipei', 75);
  mark := result #> '{puzzle,guesses,1}';
  perform pg_temp.require_ok(mark->>'hint' = 'higher' and mark->>'close' = 'true', '25% low edge');
  result := public.city_puzzle_guess('taipei', 125);
  mark := result #> '{puzzle,guesses,2}';
  perform pg_temp.require_ok(mark->>'hint' = 'lower' and mark->>'close' = 'true', '25% high edge');
  result := public.city_puzzle_guess('taipei', 110);
  perform pg_temp.require_ok(result#>>'{puzzle,guesses,3,hint}' = 'solved'
    and result#>>'{puzzle,won}' = 'true' and result#>>'{puzzle,reward}' = '3'
    and (result#>>'{puzzle,answer,usd}')::numeric = 100
    and result#>>'{puzzle,answer,source}' like 'https://%'
    and (result#>>'{state,wax_balls}')::integer = base + 3 and result->>'streak' = '3',
    '10% win edge reveals answer, pays three wax and extends streak');
  perform pg_temp.expect_guess_error(100, 'already_done');

  for i in 1..6 loop
    result := public.city_puzzle_guess('hongkong', 1000000);
  end loop;
  perform pg_temp.require_ok(result#>>'{puzzle,done}' = 'true' and result#>>'{puzzle,won}' = 'false'
    and result#>>'{puzzle,reward}' = '1'
    and jsonb_array_length(result#>'{puzzle,guesses}') = 6
    and (result#>>'{state,wax_balls}')::integer = base + 4 and result->>'streak' = '3',
    'six misses reveal answer, pay once, and count at most one day for streak');
  perform pg_temp.require_ok(public.city_puzzle_today()->>'streak' = '3', 'today returns the same streak');
end $$;
reset role;

select pg_temp.require_ok(private.city_puzzle_streak(auth.uid(),
  private.city_puzzle_date(statement_timestamp()) + 2) = 0, 'missed day breaks the streak');
