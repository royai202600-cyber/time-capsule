-- Run inside a transaction with the prerequisite and Today's Hunt migrations.
do $$
declare
  player uuid := gen_random_uuid();
  friend uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  editor uuid := gen_random_uuid();
  taipei_day date := private.todays_hunt_date('taipei',statement_timestamp());
  macau_day date := private.todays_hunt_date('macau',statement_timestamp());
  future_day date := taipei_day+1;
  hk_day date := private.todays_hunt_date('hongkong',statement_timestamp());
  hkust public.public_capsule_spots;
  tst public.places;
  fixture_lat double precision;
  fixture_lng double precision;
  city_name text;
  kind_name text;
  pool_id uuid;
  fresh_id uuid;
  old_id uuid;
  action_id bigint;
  result jsonb;
  before_day jsonb;
  previous jsonb;
  balance integer;
  pin record;
  day_reason text;
begin
  assert private.todays_hunt_date('taipei','2026-11-18 15:59:59+00') = date '2026-11-18';
  assert private.todays_hunt_date('macau','2026-11-18 16:00:00+00') = date '2026-11-19';
  assert not has_function_privilege('anon','public.todays_hunt(text)','execute');
  assert not has_table_privilege('authenticated','private.todays_hunt_schedule','select');
  assert not has_table_privilege('authenticated','private.todays_hunt_plays','select');

  insert into auth.users(id,email) select u,u || '@example.invalid' from unnest(array[player,friend,outsider,editor]) u;
  insert into public.profiles(id,name) select u,'HL-C4 fixture' from unnest(array[player,friend,outsider,editor]) u
    on conflict(id) do nothing;
  insert into private.admin_members(user_id,role) values (editor,'admin');
  insert into public.friendships(user_id,friend_id) values (player,friend),(friend,player);
  perform set_config('request.jwt.claim.sub',editor::text,true);

  -- Imported legacy prices have no locations and do not produce a partial day.
  result := public.admin_todays_hunt_calendar('taipei',taipei_day,1)->0;
  assert result->>'unavailable_reason'='missing_question' and result->'quests'='[]'::jsonb;
  select * into strict hkust from public.public_capsule_spots
    where place='hkust' and kind='landmark' and game_enabled and hidden_at is null;
  select * into strict tst from public.places where id='tst-clock';
  assert exists (select 1 from private.todays_hunt_center('hongkong') c
    where c.lat=hkust.lat and c.lng=hkust.lng);
  foreach city_name in array array['taipei','macau','hongkong'] loop
    select * into strict pin from private.todays_hunt_center(city_name);
    foreach kind_name in array array['question','price'] loop
      for n in 1..4 loop
        fixture_lat := case
          when city_name='hongkong' and n=4 then tst.lat
          when city_name='hongkong' and n=3 then hkust.lat+0.0136
          when city_name='hongkong' and n=2 then hkust.lat+0.0134
          when n=4 then pin.lat+0.1 else pin.lat end;
        fixture_lng := case when city_name='hongkong' and n=4 then tst.lng else pin.lng end;
        insert into private.question_pool(city,type,place_zh,place_en,location_lat,location_lng,
          prompt_zh,prompt_en,kind,choices,currency,rate,source_url,checked_on,status)
        values (city_name,kind_name,'測試','Fixture',fixture_lat,fixture_lng,
          '問題','Prompt',case when kind_name='question' then 'choice' end,
          case when kind_name='question' then '[{"zh":"甲","en":"A"},{"zh":"乙","en":"B"}]'::jsonb end,
          case when kind_name='price' then 'NT$' end,case when kind_name='price' then 10 end,
          'https://example.invalid',taipei_day,'published')
        returning id into pool_id;
        insert into private.question_pool_secrets(id,answer,usd,local_amount)
        values (pool_id,case when kind_name='question' then '0'::jsonb end,
          case when kind_name='price' then 10 end,case when kind_name='price' then 100 end);
      end loop;
    end loop;
  end loop;

  -- Both types have two eligible rows at HKUST, one just outside 1,500 m
  -- and one at the old Tsim Sha Tsui centre.
  assert (select count(*) from private.todays_hunt_pool('hongkong'))=4;
  assert (select count(*) from private.todays_hunt_pool('hongkong')
    where location_lat=hkust.lat+0.0134)=2;
  assert not exists (select 1 from private.todays_hunt_pool('hongkong')
    where location_lat in (tst.lat,hkust.lat+0.0136));
  result := public.todays_hunt('hongkong');
  assert jsonb_array_length(result->'quests')=3;
  assert not exists (select 1 from jsonb_array_elements(result->'quests') as q
    where public.distance_m(hkust.lat,hkust.lng,
      (q->>'location_lat')::double precision,(q->>'location_lng')::double precision)>1500);
  update public.public_capsule_spots set hidden_at=statement_timestamp() where id=hkust.id;
  assert not exists (select 1 from private.todays_hunt_center('hongkong'));
  assert public.admin_todays_hunt_calendar('hongkong',hk_day,1)->0->>'unavailable_reason'='missing_landmark';
  begin
    perform public.todays_hunt('hongkong');
    raise exception 'expected refusal';
  exception when raise_exception then assert sqlerrm='hunt_unavailable'; end;
  begin
    perform public.todays_hunt_attempt('hongkong',1,'{"choice":0}');
    raise exception 'expected refusal';
  exception when raise_exception then assert sqlerrm='hunt_unavailable'; end;
  begin
    perform public.todays_hunt_friends('hongkong');
    raise exception 'expected refusal';
  exception when raise_exception then assert sqlerrm='hunt_unavailable'; end;
  update public.public_capsule_spots set hidden_at=null where id=hkust.id;
  assert public.todays_hunt('hongkong')=result;

  day_reason := private.todays_hunt_fill('taipei',taipei_day-1);
  assert day_reason is null;
  select r.pool_id into old_id from private.todays_hunt_schedule q join private.quest_rules r on r.id=q.quest_id
    where q.city='taipei' and q.hunt_date=taipei_day-1 and q.ordinal=1;
  before_day := public.admin_todays_hunt_calendar('taipei',taipei_day,2);
  assert before_day->0->>'started'='true' and before_day->1->>'started'='false';
  assert (before_day->0->'quests'->0->>'pool_id')::uuid <> old_id;
  assert before_day->0->'quests'->0->'correct_answer' = '{"choice":0}';
  assert jsonb_array_length(before_day->1->'quests')=3;
  assert public.admin_todays_hunt_calendar('taipei',taipei_day,2)=before_day;
  result := public.admin_todays_hunt_calendar('taipei',taipei_day+2,1)->0;
  assert result->>'unavailable_reason'='recent_question' and result->'quests'='[]'::jsonb;

  fresh_id := (before_day->0->'quests'->0->>'pool_id')::uuid;
  result := public.admin_todays_hunt_set('taipei',future_day,1,fresh_id);
  assert (result->'quests'->0->>'pool_id')::uuid=fresh_id;
  select max(id) into action_id from private.admin_actions where actor=editor and action='todays_hunt.set';
  assert public.admin_undo(action_id)=before_day->1;
  select * into strict pin from private.todays_hunt_center('taipei');
  result := public.admin_todays_hunt_set('taipei',future_day,3,
    p_location_lat=>pin.lat,p_location_lng=>pin.lng,p_catch_count=>5);
  assert result->'quests'->2->>'catch_count'='5';
  select max(id) into action_id from private.admin_actions where actor=editor and action='todays_hunt.set';
  assert public.admin_undo(action_id)=before_day->1;

  result := public.admin_todays_hunt_swap('taipei',future_day,1,3);
  assert result->'quests'->0->>'type'='catch' and result->'quests'->2->>'type'='question';
  select max(id) into action_id from private.admin_actions where actor=editor and action='todays_hunt.swap';
  assert public.admin_undo(action_id)=before_day->1;
  begin
    perform public.admin_todays_hunt_swap('taipei',taipei_day,1,3);
    raise exception 'expected refusal';
  exception when raise_exception then assert sqlerrm='day_started'; end;

  insert into private.todays_hunt_plays(user_id,city,hunt_date,finished,streak)
    values (player,'taipei',taipei_day-1,true,3),(player,'macau',macau_day-2,true,5);
  perform set_config('request.jwt.claim.sub',player::text,true);
  begin
    perform public.admin_todays_hunt_calendar('taipei',taipei_day,1);
    raise exception 'expected refusal';
  exception when raise_exception then assert sqlerrm='forbidden'; end;

  begin
    perform public.todays_hunt_attempt('taipei',null,'{}');
    raise exception 'expected refusal';
  exception when raise_exception then assert sqlerrm='bad_ordinal'; end;
  begin
    perform public.todays_hunt_attempt('taipei',3,'{"caught":2.5}');
    raise exception 'expected refusal';
  exception when raise_exception then assert sqlerrm='bad_answer'; end;
  begin
    perform public.todays_hunt('bad');
    raise exception 'expected refusal';
  exception when raise_exception then assert sqlerrm='bad_city'; end;

  previous := public.todays_hunt('taipei');
  assert previous->>'streak'='3';
  assert previous->'quests'->0->>'type'='question' and previous->'quests'->2->>'color'='blue';
  assert not jsonb_path_exists(previous,'$.quests[*].correct_answer');
  perform private.ensure_player(player);
  select wax_balls into balance from public.player_game where user_id=player;
  result := public.todays_hunt_attempt('taipei',1,'{"choice":1}');
  assert result='{"ok":false,"done":true,"points":2,"correct_answer":{"choice":0}}';
  result := public.todays_hunt_attempt('taipei',2,'{"usd":5}');
  assert result='{"ok":false,"done":false,"points":0,"tries_left":2,"hint":"higher"}';
  result := public.todays_hunt_attempt('taipei',2,'{"usd":20}');
  assert result->>'hint'='lower' and not (result ? 'correct_answer');
  result := public.todays_hunt_attempt('taipei',2,'{"usd":8}');
  assert result->>'points'='2' and result->>'tries_left'='0' and result->'correct_answer'->>'usd'='10';
  assert (select wax_balls from public.player_game where user_id=player)=balance;
  assert public.todays_hunt_attempt('taipei',3,'{"caught":20}')='{"ok":true,"done":true,"points":10}';
  begin
    perform public.todays_hunt_attempt('taipei',3,'{"caught":3}');
    raise exception 'expected refusal';
  exception when raise_exception then assert sqlerrm='already_done'; end;
  assert (select wax_balls from public.player_game where user_id=player)=balance+3;
  assert not exists (select 1 from public.owned_vessels where user_id=player
    and copies is not null);
  result := public.todays_hunt('taipei');
  assert result->>'finished'='true' and result->>'score'='14' and result->>'streak'='4';
  assert result->'quests'->0->'correct_answer'='{"choice":0}';

  assert public.todays_hunt('macau')->>'streak'='0';
  assert public.todays_hunt_attempt('macau',3,'{"caught":2}')='{"ok":false,"done":true,"points":2}';
  assert (select wax_balls from public.player_game where user_id=player)=balance+3;
  assert public.todays_hunt_attempt('macau',2,'{"usd":11}')->>'points'='10';
  assert public.todays_hunt_attempt('macau',1,'{"choice":0}')->>'points'='10';
  assert public.todays_hunt('macau')->>'streak'='1';
  assert (select wax_balls from public.player_game where user_id=player)=balance+6;

  perform set_config('request.jwt.claim.sub',friend::text,true);
  assert public.todays_hunt('taipei')->'quests'=previous->'quests';
  perform public.todays_hunt_attempt('taipei',1,'{"choice":0}');
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  perform public.todays_hunt_attempt('taipei',1,'{"choice":0}');
  perform set_config('request.jwt.claim.sub',player::text,true);
  result := public.todays_hunt_friends('taipei');
  assert jsonb_array_length(result)=2 and result->0->'user'->>'id'=player::text;
  assert result->1->'user'->>'id'=friend::text and result->1->>'score'='10';
  assert jsonb_array_length(public.city_puzzle_today()->'puzzles')=4;
  result := public.city_puzzle_guess('taipei',1);
  assert result is not null;
end $$;
select 'HL-C4 SQL checks passed' as result;
