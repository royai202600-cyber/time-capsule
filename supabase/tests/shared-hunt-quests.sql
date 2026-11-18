-- Run after the two HL-C3 migrations and question-pool-before.sql.
create function pg_temp.quest_payload(q uuid,p_lat double precision,p_lng double precision,a jsonb default null)
returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('quest_id',q,'lat',p_lat,'lng',p_lng,'accuracy',10,'answer',a))
$$;

do $$
declare h text;
declare code text;
declare post public.public_capsule_spots;
declare a jsonb;
declare result jsonb;
declare q uuid;
declare pool uuid;
declare choice_id uuid;
declare text_id uuid;
declare price_id uuid;
declare spawn text;
declare attempts record;
declare target record;
declare player uuid := 'c3a10000-0000-4000-8000-000000000002';
declare organizer uuid := 'c3a10000-0000-4000-8000-000000000001';
begin
  update public.profiles set can_create_hunts=true where id=organizer;
  select * into strict post from public.public_capsule_spots where kind='landmark' and place='taipei101';
  update private.game_config set restore_common=1,restore_uncommon=1,restore_rare=1 where singleton;
  perform pg_temp.pool_user(1);
  h:=public.private_hunt_create(jsonb_build_object('name','Quest rollback','route_mode','ordered','leaderboard_visible',true,
    'starts_at',now()-interval '1 hour','ends_at',now()+interval '1 hour',
    'guide_mode','fixed','guide_lat',post.lat,'guide_lng',post.lng))->>'id';
  a:=jsonb_build_object('name','Fixture','points',10,'ordinal',1,'location_lat',post.lat,'location_lng',post.lng);
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_save(%L,%L)',h,a||'{"type":"spin"}'),'bad_rule');
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_save(%L,%L)',h,a||'{"type":"restore"}'),'bad_rule');
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_save(%L,%L)',h,
    a||'{"type":"landmark","location_lat":0,"location_lng":0}'),'bad_rule');
  select id into pool from private.question_pool where legacy_price_id is not null limit 1;
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_save(%L,%L)',h,
    a||jsonb_build_object('type','price','pool_id',pool)),'bad_rule');

  perform public.private_hunt_quest_save(h,a||'{"type":"arrive","arrive_check":"gps_qr"}');
  result:=public.admin_question_pool_save(a||'{"city":"taipei","type":"question","kind":"choice","answer":1,
    "place_zh":"廣場","place_en":"Square","prompt_zh":"問題","prompt_en":"Choice prompt",
    "choices":[{"zh":"甲","en":"A"},{"zh":"乙","en":"B"}],"source_url":"https://example.invalid","checked_on":"2026-11-18"}');
  choice_id:=(result->>'id')::uuid;
  perform public.admin_question_pool_set_status(choice_id,'published');
  result:=public.admin_question_pool_save(a||'{"city":"taipei","type":"question","kind":"text","answer":"Taipei",
    "typed_aliases":["Taipei City"],"place_zh":"廣場","place_en":"Square","prompt_zh":"問題","prompt_en":"Text prompt",
    "source_url":"https://example.invalid","checked_on":"2026-11-18"}');
  text_id:=(result->>'id')::uuid;
  perform public.admin_question_pool_set_status(text_id,'published');
  result:=public.admin_question_pool_save(a||'{"city":"taipei","type":"price","local_amount":320,"rate":32,"currency":"NT$",
    "place_zh":"商店","place_en":"Named shop","prompt_zh":"價格","prompt_en":"Price prompt",
    "source_url":"https://example.invalid","checked_on":"2026-11-18"}');
  price_id:=(result->>'id')::uuid;
  perform public.admin_question_pool_set_status(price_id,'published');
  perform public.private_hunt_quest_save(h,a||jsonb_build_object('type','question','ordinal',2,'pool_id',choice_id));
  perform public.private_hunt_quest_save(h,a||jsonb_build_object('type','question','ordinal',3,'pool_id',text_id));
  perform public.private_hunt_quest_save(h,a||jsonb_build_object('type','price','ordinal',4,'pool_id',price_id));
  perform public.private_hunt_quest_save(h,a||'{"type":"catch","ordinal":5,"catch_count":1}');
  perform public.private_hunt_quest_save(h,a||'{"type":"landmark","ordinal":6}');
  result:=public.private_hunt_edit_state(h);
  assert result->'quests'->1->>'pool_id'=choice_id::text;
  assert result->'quests'->3->'price'->>'place_en'='Named shop';
  assert not (result->'quests'->3->'price' ? 'local_amount');
  code:=public.private_hunt_publish(h)->>'join_code';

  perform pg_temp.pool_user(2);
  result:=public.private_hunt_preview(code);
  assert jsonb_array_length(result->'quest_objects')=6 and jsonb_array_length(result->'quests')=0;
  result:=public.private_hunt_join_code(code);
  assert (result->'quests'->1->>'type') = 'question';
  assert (result->'quests'->3->'price'->>'place_en') = 'Named shop';
  assert result::text not like '%correct_answer%';
  assert result::text not like '%Taipei City%';
  select id into q from public.private_hunt_quests where hunt_id=h and ordinal=1;
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_attempt(%L)',pg_temp.quest_payload(q,post.lat,post.lng)),'not_started');
  perform public.private_hunt_start(h,post.lat,post.lng,10);
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_attempt(%L)',pg_temp.quest_payload(q,0,0)),'too_far');
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_attempt(%L)',pg_temp.quest_payload(q,post.lat,post.lng)),'wrong_qr');
  result:=public.private_hunt_quest_attempt(pg_temp.quest_payload(q,post.lat,post.lng,
    (select jsonb_build_object('qr',s.qr_token) from private.private_hunt_quest_secrets s where quest_id=q)));
  assert result='{"ok":true,"done":true,"points":10}'::jsonb;

  select id into q from public.private_hunt_quests where hunt_id=h and ordinal=2;
  for i in 1..3 loop
    result:=public.private_hunt_quest_attempt(pg_temp.quest_payload(q,post.lat,post.lng,'{"choice":0}'));
    assert (result->>'tries_left')::int=3-i and not (result ? 'correct_answer');
  end loop;
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_attempt(%L)',
    pg_temp.quest_payload(q,post.lat,post.lng,'{"choice":1}')),'no_tries');
  update public.private_hunt_quest_progress set wait_until=clock_timestamp()-interval '1 second' where quest_id=q;
  result:=public.private_hunt_quest_attempt(pg_temp.quest_payload(q,post.lat,post.lng,'{"choice":1}'));
  assert result->'correct_answer'='{"choice":1}'::jsonb and result->>'points'='10';

  select id into q from public.private_hunt_quests where hunt_id=h and ordinal=3;
  result:=public.private_hunt_quest_attempt(pg_temp.quest_payload(q,post.lat,post.lng,'{"text":"  TAIPEI CITY  "}'));
  assert result->'correct_answer'='{"text":"Taipei"}'::jsonb;

  select id into q from public.private_hunt_quests where hunt_id=h and ordinal=4;
  result:=public.private_hunt_quest_attempt(pg_temp.quest_payload(q,post.lat,post.lng,'{"usd":8}'));
  assert result->>'hint'='higher' and result->>'tries_left'='2' and not (result ? 'correct_answer');
  result:=public.private_hunt_quest_attempt(pg_temp.quest_payload(q,post.lat,post.lng,'{"usd":12}'));
  assert result->>'hint'='lower' and result->>'tries_left'='1' and not (result ? 'correct_answer');
  result:=public.private_hunt_quest_attempt(pg_temp.quest_payload(q,post.lat,post.lng,'{"usd":9}'));
  assert result->'correct_answer'='{"usd":10,"local_amount":320}'::jsonb;
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_attempt(%L)',
    pg_temp.quest_payload(q,post.lat,post.lng,'{"usd":10}')),'already_done');

  select id into q from public.private_hunt_quests where hunt_id=h and ordinal=5;
  result:=public.private_hunt_quest_attempt(pg_temp.quest_payload(q,post.lat,post.lng));
  assert result->>'done'='false';
  perform private.city_hunt_record_quest('restore',(select id from public.corrupted_spots
    order by public.distance_m(lat,lng,post.lat,post.lng) limit 1),post.lat,post.lng);
  assert not exists(select 1 from public.private_hunt_quest_progress where quest_id=q);
  result:=public.game_nearby(post.lat,post.lng,10);
  select value->>'spawn_id' into strict spawn from jsonb_array_elements(result->'spawns')
    where value->>'quest_id'=q::text;
  perform pg_temp.pool_user(3);
  perform pg_temp.pool_expect(format('select * from public.corrupted_capsule_throw(%L,%L,%L,10,''wax'',1,true)',
    spawn,post.lat,post.lng),'expired');
  perform pg_temp.pool_user(2);
  update public.player_game set wax_balls=100 where user_id=player;
  select * into target from public.corrupted_capsule_throw(spawn,post.lat,post.lng,10,'wax',1,true);
  assert target.result='restored' and target.copies=3 and target.stars=1;
  assert (select not unlimited_copies from public.vessels where id=target.vessel);
  assert (select copies=3 from public.owned_vessels where user_id=player and vessel=target.vessel);
  assert exists (
    select 1 from private.game_wave_at(now()) wave
    cross join lateral unnest(private.game_spawn_city_rules(private.game_spawn_at(wave.starts_at),'Taipei')) rule
    join private.quest_spawns release on release.vessel=rule.vessel and release.rarity=rule.rarity
    where 'quest:'||release.id=spawn
  );
  assert (select completed_at is not null from public.private_hunt_quest_progress where quest_id=q);

  select * into attempts from public.landmark_start(post.id,post.lat,post.lng,10);
  for i in 1..30 loop
    select * into target from public.landmark_hit(attempts.attempt_id,post.lat,post.lng,10,'wax',1);
    exit when target.result='won';
  end loop;
  assert target.result='won';
  result:=public.private_hunt_collect_reward(h,post.lat,post.lng,10);
  assert result->>'reward_collected_at' is not null and result->>'points'='60';
  assert (select count(*)=6 from jsonb_array_elements(result->'quests') where value->>'done'='true');
  assert exists(select 1 from public.my_passport() where place=h);

  -- A fresh player has three independent price tries. Malformed inputs do not use one.
  perform pg_temp.pool_user(3);
  perform public.private_hunt_join_code(code);
  perform public.private_hunt_start(h,post.lat,post.lng,10);
  select id into q from public.private_hunt_quests where hunt_id=h and ordinal=4;
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_attempt(%L)',
    pg_temp.quest_payload(q,post.lat,post.lng,'{"usd":10}')),'locked');
  update public.hunts set route_mode='any' where id=h;
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_attempt(%L)',
    pg_temp.quest_payload(q,post.lat,post.lng,'{"usd":"10"}')),'bad_answer');
  for i in 1..2 loop
    result:=public.private_hunt_quest_attempt(pg_temp.quest_payload(q,post.lat,post.lng,'{"usd":8}'));
    assert result->>'done'='false' and (result->>'tries_left')::int=3-i and not (result ? 'correct_answer');
  end loop;
  result:=public.private_hunt_quest_attempt(pg_temp.quest_payload(q,post.lat,post.lng,'{"usd":8}'));
  assert result='{"ok":false,"done":true,"points":0,"tries_left":0,"correct_answer":{"usd":10,"local_amount":320}}'::jsonb;
  assert (select points=0 from public.private_hunt_members where hunt_id=h and user_id=auth.uid());
  assert (select completed_at is not null and tries=3 from public.private_hunt_quest_progress
    where quest_id=q and user_id=auth.uid());
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_attempt(%L)',
    pg_temp.quest_payload(q,post.lat,post.lng,'{"usd":10}')),'already_done');
  update public.hunts set ends_at=now()-interval '1 second' where id=h;
  perform pg_temp.pool_expect(format('select public.private_hunt_quest_attempt(%L)',
    pg_temp.quest_payload(q,post.lat,post.lng,'{"usd":10}')),'time_up');
end $$;
select 'PASS: shared quest types and private hunt completion' as result;

do $$
declare h text := current_setting('test.legacy_hunt');
declare s public.corrupted_spots;
declare q uuid;
declare result jsonb;
begin
  perform pg_temp.pool_user(5);
  select * into strict s from public.corrupted_spots where id=current_setting('test.legacy_spot')::uuid;
  select id into strict q from public.private_hunt_quests where hunt_id=h and ordinal=1
    and quest_type='arrive' and location_lat=s.lat and location_lng=s.lng;
  result:=public.hunt_join_code(current_setting('test.legacy_code'));
  assert result->>'id'=h;
  perform public.private_hunt_start(h,s.lat,s.lng,10);
  perform public.hunt_mission_complete(q,s.lat,s.lng,10,null,null);
  perform private.city_hunt_record_quest('restore',s.id,s.lat,s.lng);
  result:=public.private_hunt_collect_reward(h,s.lat,s.lng,10);
  assert result->>'reward_collected_at' is not null and result->>'points'='20';
  assert jsonb_array_length(result->'quest_objects')=1;
  assert result->'quests'->1->>'quest_type'='restore';
end $$;
select 'PASS: all five private quest types, reward, and legacy spin/restore compatibility' as result;
