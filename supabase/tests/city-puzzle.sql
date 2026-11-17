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
    select city from public.city_puzzle_questions where published group by city having count(*) = 20
  ) catalog), '80 published questions across four cities');
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
  and (private.city_puzzle_question('taipei', date '2026-12-07')).seq = 1,
  'Asia/Taipei midnight advances puzzle and the catalog wraps');

select pg_temp.require_ok(
  (select public and file_size_limit = 300000 and allowed_mime_types = array['image/jpeg']
   from storage.buckets where id = 'city-puzzle'),
  'public bucket with JPEG and size limits');

select pg_temp.require_ok(
  (select bool_and(btrim(venue_zh) <> '' and btrim(venue_en) <> '')
   from public.city_puzzle_questions where published)
  and (select count(*) = 52 from public.city_puzzle_questions where photo_path is not null)
  and not exists (
    select 1 from public.city_puzzle_questions
    where vessel in ('red-bird', 'senado-fountain')
       or (published and vessel is null and photo_path is null)
  ), 'published venues, licensed photos, and appropriate fallback vessels');

insert into auth.users (id, email) values
  ('c61c0de8-8629-4fd6-a8e0-44af1647e6f2', 'city-puzzle-admin-sql@example.invalid');
insert into public.profiles (id, name) values
  ('c61c0de8-8629-4fd6-a8e0-44af1647e6f2', 'City puzzle Undo fixture') on conflict (id) do nothing;
insert into private.admin_members (user_id, role) values
  ('c61c0de8-8629-4fd6-a8e0-44af1647e6f2', 'owner');
select set_config('request.jwt.claim.sub', 'c61c0de8-8629-4fd6-a8e0-44af1647e6f2', true);

-- The production admin entry points operate on the actual game wave state.
do $$
declare
  initial_wave jsonb;
  effective_at timestamptz;
  change_id bigint;
  win_before jsonb;
  miss_before jsonb;
  win_after jsonb;
  miss_after jsonb;
  puzzle_date date := private.city_puzzle_date(statement_timestamp());
  current_minutes integer;
  next_minutes integer;
begin
  win_before := public.city_puzzle_guess('macau',
    (select round(local_price / usd_rate, 2) from private.city_puzzle_question('macau', puzzle_date)));
  for i in 1..6 loop
    miss_before := public.city_puzzle_guess('singapore', 1000000);
  end loop;

  initial_wave := private.admin_wave_length_state();
  select minutes into current_minutes from private.game_wave_at(now());
  select m into next_minutes
  from unnest(array[5, 10, 15, 20, 30, 60]) m
  where m <> current_minutes and m <> (initial_wave->>'minutes')::integer
  limit 1;
  effective_at := public.admin_wave_length_set(next_minutes, 'CE1 rollback check');
  perform pg_temp.require_ok(effective_at > now() and
    (select minutes from private.game_wave_at(effective_at)) = next_minutes, 'admin schedules a wave-length change');
  select max(id) into change_id from private.admin_actions
  where action = 'config.wave_length' and actor = auth.uid();
  perform public.admin_undo(change_id, 'CE1 rollback check');
  perform pg_temp.require_ok(private.admin_wave_length_state() = initial_wave
    and exists(select 1 from private.admin_actions where action = 'undo' and after->>'undo_of' = change_id::text),
    'admin Undo restores the prior wave-length state and logs the undo');

  win_after := public.city_puzzle_guess('taipei',
    (select round(local_price / usd_rate, 2) from private.city_puzzle_question('taipei', puzzle_date)));
  for i in 1..6 loop
    miss_after := public.city_puzzle_guess('hongkong', 1000000);
  end loop;
  perform pg_temp.require_ok(
    win_before#>>'{puzzle,reward}' = '3' and win_after#>>'{puzzle,reward}' = '3'
    and miss_before#>>'{puzzle,reward}' = '1' and miss_after#>>'{puzzle,reward}' = '1'
    and (win_after#>>'{state,wax_balls}')::integer = (miss_before#>>'{state,wax_balls}')::integer + 3
    and (miss_after#>>'{state,wax_balls}')::integer = (win_after#>>'{state,wax_balls}')::integer + 1,
    'a solve still pays 3 wax and six misses pay 1 after admin Undo');
end $$;

insert into auth.users (id, email)
values ('c61c0de8-8629-4fd6-a8e0-44af1647e6f1', 'city-puzzle-sql@example.invalid');
insert into public.profiles (id, name)
values ('c61c0de8-8629-4fd6-a8e0-44af1647e6f1', 'City puzzle rollback') on conflict (id) do nothing;
select set_config('request.jwt.claim.sub', 'c61c0de8-8629-4fd6-a8e0-44af1647e6f1', true);

-- Force an exact US$100 answer and cover both visual branches on any test date.
update public.city_puzzle_questions set local_price = usd_rate * 100,
  photo_path = 'taipei-pearl-milk-tea.jpg', photo_credit = 'takuma mori', photo_license = 'CC BY 2.0',
  photo_link = 'https://commons.wikimedia.org/wiki/File:2009-12-30_cups_of_bubble_tea_at_a_Chunshuitang_in_Taipei.jpg'
where id = (private.city_puzzle_question('taipei', private.city_puzzle_date(statement_timestamp()))).id;
update public.city_puzzle_questions set photo_path = null, photo_credit = null,
  photo_license = null, photo_link = null, vessel = 'tram'
where id = (private.city_puzzle_question('hongkong', private.city_puzzle_date(statement_timestamp()))).id;
insert into public.city_puzzle_plays (user_id, city, play_date, question_id, guesses, done, won, reward)
select auth.uid(), q.city, private.city_puzzle_date(statement_timestamp()) - past.days, q.id,
  '[{"usd":100,"hint":"solved","close":true}]', true, true, 3
from public.city_puzzle_questions q
cross join (values (1), (2), (4)) past(days)
where q.seq = 1 and q.city in ('hongkong','macau');

set local role authenticated;
do $$
declare day jsonb; result jsonb; mark jsonb; base integer; taipei jsonb; hongkong jsonb;
begin
  day := public.city_puzzle_today();
  perform pg_temp.require_ok(jsonb_array_length(day->'puzzles') = 4 and day->>'streak' = '2',
    'four cities, two prior consecutive days despite repeated cities and an older gap');
  perform pg_temp.require_ok(
    (select bool_and(p->'answer' = 'null' and p->'reward' = 'null'
      and not p ?| array['local_price', 'usd', 'fact_en', 'source'])
     from jsonb_array_elements(day->'puzzles') p), 'unfinished answers hidden');

  taipei := day#>'{puzzles,0}';
  hongkong := day#>'{puzzles,1}';
  perform pg_temp.require_ok(
    length(taipei->>'venue_zh') > 0 and length(taipei->>'venue_en') > 0
    and taipei#>>'{photo,credit}' = 'takuma mori'
    and taipei#>>'{photo,license}' = 'CC BY 2.0'
    and taipei#>>'{photo,link}' like 'https://commons.wikimedia.org/wiki/File:%'
    and taipei#>>'{photo,url}' like '%/storage/v1/object/public/city-puzzle/taipei-pearl-milk-tea.jpg'
    and hongkong->'photo' = 'null' and hongkong->>'vessel' = 'tram',
    'today exposes both venue labels and credited photo or fallback vessel');

  perform pg_temp.expect_guess_error(null, 'bad_guess');
  perform pg_temp.expect_guess_error(0, 'bad_guess');
  perform pg_temp.expect_guess_error(-1, 'bad_guess');
  perform pg_temp.expect_guess_error(1000000.01, 'bad_guess');
  perform pg_temp.expect_guess_error(1.001, 'bad_guess');
  perform pg_temp.expect_guess_error('NaN', 'bad_guess');
  perform pg_temp.expect_guess_error('Infinity', 'bad_guess');

  select wax_balls into base from public.game_state();
  result := public.city_puzzle_guess('taipei', 74.99);
  perform pg_temp.require_ok((result->'puzzle')->'photo' = taipei->'photo'
    and (result->'puzzle')->'venue_zh' = taipei->'venue_zh'
    and (result->'puzzle')->'venue_en' = taipei->'venue_en', 'guess preserves photo and both venue labels');
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
