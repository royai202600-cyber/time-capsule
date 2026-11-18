-- Run inside a transaction and roll back the fixtures and clock adjustments.
create function pg_temp.route_expect(statement text, expected text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlerrm=expected then return; end if;
    raise;
  end;
  raise exception 'Expected %',expected;
end $$;

create function pg_temp.route_payload(quest jsonb, answer jsonb default null) returns jsonb
language sql as $$
  select jsonb_build_object('quest_id',quest->'quest_id','lat',quest->'location_lat',
    'lng',quest->'location_lng','accuracy',10,'answer',answer)
$$;

-- Two cities with three distinct walking stops, a city with only one stop,
-- plus draft, hidden, distant and location-free rows.
insert into private.question_pool(id,city,type,place_zh,place_en,location_lat,location_lng,
    prompt_zh,prompt_en,kind,currency,rate,status,source_url,checked_on)
select ('70710000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  case when i<=7 then 'taipei' when i<=10 then 'hongkong' else 'macau' end,
  case when i=3 then 'price' else 'question' end,
  '測試 '||i,'Route fixture '||i,
  case when i<>4 then s.lat+case when i=7 then 0.05 when i in (5,6) then 0 else i*0.0002 end end,
  case when i<>4 then s.lng end,
  '問題','Prompt',case when i<>3 then 'text' end,
  case when i=3 then 'NT$' end,case when i=3 then 32 end,
  case i when 5 then 'draft' when 6 then 'hidden' else 'published' end,'https://example.invalid',current_date
from generate_series(1,11) i
join public.public_capsule_spots s on s.kind='landmark'
  and s.place=case when i<=7 then 'taipei101' when i<=10 then 'hkust' else 'senado' end;

insert into private.question_pool_secrets(id,answer,usd,local_amount)
select id,case when type='question' then to_jsonb('Tea'::text) end,
  case when type='price' then 10 end,case when type='price' then 320 end
from private.question_pool where place_en like 'Route fixture %';

do $$
declare
  sender uuid := gen_random_uuid();
  recipient uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  post public.public_capsule_spots;
  point jsonb;
  stop jsonb;
  route jsonb;
  previews jsonb;
  quests jsonb;
  response jsonb;
  capsule uuid;
  memory uuid;
  legacy uuid;
  legacy_point uuid;
  anywhere uuid;
  question_id uuid := '70710000-0000-4000-8000-000000000001';
  price_id uuid := '70710000-0000-4000-8000-000000000003';
  test_city text;
  spawn text;
  fight uuid;
  result text;
begin
  insert into auth.users(id,email) values
    (sender,sender||'@route.example.invalid'),(recipient,recipient||'@route.example.invalid'),
    (stranger,stranger||'@route.example.invalid');
  insert into public.profiles(id,name) values(sender,'Sender'),(recipient,'Recipient'),(stranger,'Stranger') on conflict do nothing;
  insert into public.friendships(user_id,friend_id) values(sender,recipient),(recipient,sender);
  perform set_config('request.jwt.claim.sub',sender::text,true);
  select * into strict post from public.public_capsule_spots where place='taipei101' and kind='landmark';
  foreach test_city in array array['taipei','hongkong'] loop
    previews:=public.route_templates(test_city);
    assert jsonb_array_length(previews)=3;
    assert not exists(select 1 from jsonb_array_elements(previews) t
      where jsonb_array_length(t->'stops')<>3 or t::text like '%correct_answer%'
        or t::text like '%local_amount%' or t::text like '%Tea%');
    assert not exists(select 1 from jsonb_array_elements(previews) t
      cross join lateral jsonb_array_elements(t->'stops') s
      where not exists(select 1 from private.question_pool p where p.id=(s->>'pool_id')::uuid
        and p.city=test_city and p.status='published' and p.location_lat is not null
        and p.place_en not in ('Route fixture 7')));
  end loop;
  assert public.route_templates('macau')='[]'::jsonb;
  assert public.route_pool_pick('taipei','question',post.lat,post.lng,null)->>'pool_id'=question_id::text;
  assert public.route_pool_pick('taipei','question',post.lat,post.lng,array[question_id,null])->>'name_en'='Route fixture 2';
  assert public.route_pool_pick('taipei','price',post.lat,post.lng)->>'pool_id'=price_id::text;
  assert public.route_pool_pick('taipei','price',post.lat,post.lng,array[price_id]) is null;
  assert public.route_pool_pick('taipei','question',0,0) is null;

  point:=jsonb_build_object('location_lat',post.lat,'location_lng',post.lng,'name','Taipei test');
  stop:=point||'{"type":"question","own_question":"What is the answer?"}';
  perform pg_temp.route_expect(format('select public.send_capsule(%L,%L,%L,%L,now()+interval ''1 hour'',p_route=>%L)',
    recipient,'dome','Body','Hint',jsonb_build_array(stop)),'no_answer');
  perform pg_temp.route_expect(format('select public.send_capsule(%L,%L,%L,%L,now()+interval ''1 hour'',p_route=>%L)',
    recipient,'dome','Body','Hint',jsonb_build_array(stop||'{"own_question":"go die","own_answer":"Tea"}')),'blocked_words');
  perform pg_temp.route_expect(format('select public.send_capsule(%L,%L,%L,%L,now()+interval ''1 hour'',p_route=>%L)',
    recipient,'dome','Body','Hint',jsonb_build_array(point||'{"type":"arrive","name":"Go die"}')),'blocked_words');
  perform pg_temp.route_expect(format('select public.send_capsule(%L,%L,%L,%L,now()+interval ''1 hour'',p_route=>%L)',
    recipient,'dome','Body','Hint',jsonb_build_array(stop||'{"own_answer":"Go die"}')),'blocked_words');
  perform pg_temp.route_expect(format('select public.send_capsule(%L,%L,%L,%L,now()+interval ''1 hour'',p_route=>%L)',
    recipient,'dome','Body','Hint',jsonb_build_array(stop||jsonb_build_object('own_answer',repeat('a',121)))),'rejected');
  perform pg_temp.route_expect(format('select public.send_capsule(%L,%L,%L,%L,now()+interval ''1 hour'',p_route=>%L)',
    recipient,'dome','Body','Hint',jsonb_build_array(stop||jsonb_build_object('own_question',repeat('a',281),'own_answer','Tea'))),'rejected');
  for stop in select value from jsonb_array_elements(jsonb_build_array(
    point||'{"type":"catch","catch_count":6}',point||'{"type":"catch","catch_count":1,"location_lat":0,"location_lng":0}',
    point||'{"type":"landmark","location_lat":0,"location_lng":0}',
    jsonb_build_object('type','question','pool_id','70710000-0000-4000-8000-000000000004'),
    jsonb_build_object('type','question','pool_id','70710000-0000-4000-8000-000000000005')
  )) loop
    perform pg_temp.route_expect(format('select public.send_capsule(%L,%L,%L,%L,now()+interval ''1 hour'',p_route=>%L)',
      recipient,'dome','Body','Hint',jsonb_build_array(stop)),'bad_rule');
  end loop;

  route:=jsonb_build_array(point||'{"type":"arrive"}',
    jsonb_build_object('type','question','pool_id',question_id,'location_lat',0,'location_lng',0),
    jsonb_build_object('type','price','pool_id',price_id),
    point||'{"type":"catch","catch_count":2}',
    point||jsonb_build_object('type','landmark','location_lat',post.lat+0.01));
  capsule:=public.send_capsule(recipient,'dome','Sealed letter','Hint',now()+interval '1 hour',p_route=>route);
  memory:=public.send_capsule(sender,'dome','Memory','',now()+interval '1 hour',
    p_route=>jsonb_build_array(point||jsonb_build_object('type','question','own_question',repeat('Q',280),'own_answer',repeat('A',120))));
  legacy:=public.send_capsule(recipient,'dome','Old place','',now()+interval '1 hour',p_place=>'taipei101');
  legacy_point:=public.send_capsule(recipient,'dome','Old coordinates','',now()+interval '1 hour',
    p_place_lat=>post.lat,p_place_lng=>post.lng,p_place_name=>'Old place');
  anywhere:=public.send_capsule(recipient,'dome','Anywhere','',now()+interval '1 hour');

  set local role authenticated;
  assert exists(select 1 from public.capsules where id=capsule and route_total=5 and route_done=0);
  perform pg_temp.route_expect(format('select public.route_progress(%L)',capsule),'capsule not found');
  perform pg_temp.route_expect(format('select * from public.open_capsule(%L)',capsule),'capsule not found');
  perform pg_temp.route_expect('select * from public.capsule_contents','permission denied for table capsule_contents');
  quests:=public.route_progress(memory);
  assert public.route_attempt(memory,pg_temp.route_payload(quests->0,jsonb_build_object('text',repeat('a',120))))->>'done'='true';

  perform set_config('request.jwt.claim.sub',stranger::text,true);
  assert not exists(select 1 from public.capsules where id=capsule);
  perform pg_temp.route_expect(format('select public.route_progress(%L)',capsule),'capsule not found');
  perform set_config('request.jwt.claim.sub',recipient::text,true);
  quests:=public.route_progress(capsule);
  assert jsonb_array_length(quests)=5 and (quests->0->>'locked')::boolean=false;
  assert (quests->4->>'locked')::boolean and quests->4->>'landmark_id'=post.id::text;
  assert (quests->1->>'location_lat')::double precision=post.lat+0.0002;
  assert quests::text not like '%correct_answer%' and quests::text not like '%Sealed letter%';
  perform pg_temp.route_expect(format('select public.route_attempt(%L,%L)',capsule,
    pg_temp.route_payload(quests->1,'{"text":"Tea"}')),'locked');
  perform pg_temp.route_expect(format('select public.route_attempt(%L,%L)',capsule,
    pg_temp.route_payload(quests->0)||'{"accuracy":201}'),'too_far');
  perform pg_temp.route_expect(format('select * from public.open_capsule(%L)',capsule),'not yet');

  reset role;
  update public.capsules set open_at=now()-interval '1 second' where id in (capsule,legacy,legacy_point,anywhere,memory);
  insert into private.game_speed_allowlist(user_id) values(recipient) on conflict do nothing;
  perform private.ensure_player(recipient);
  update public.player_game set wax_balls=100,gold_balls=100 where user_id=recipient;
  set local role authenticated;
  perform pg_temp.route_expect(format('select * from public.open_capsule(%L)',capsule),'route incomplete');
  assert public.route_attempt(capsule,pg_temp.route_payload(quests->0))='{"ok":true,"done":true,"points":0}';
  for i in 1..3 loop
    response:=public.route_attempt(capsule,pg_temp.route_payload(quests->1,'{"text":"wrong"}'));
    assert (response->>'tries_left')::int=3-i and not (response ? 'correct_answer');
  end loop;
  perform pg_temp.route_expect(format('select public.route_attempt(%L,%L)',capsule,
    pg_temp.route_payload(quests->1,'{"text":"Tea"}')),'no_tries');
  reset role;
  update private.capsule_route_stops set wait_until=clock_timestamp()-interval '1 second'
    where capsule_id=capsule and ordinal=2;
  set local role authenticated;
  assert public.route_attempt(capsule,pg_temp.route_payload(quests->1,'{"text":"Tea"}'))->'correct_answer'='{"text":"Tea"}';
  for i in 1..2 loop
    response:=public.route_attempt(capsule,pg_temp.route_payload(quests->2,'{"usd":1}'));
    assert response->>'hint'='higher' and not (response ? 'correct_answer');
  end loop;
  response:=public.route_attempt(capsule,pg_temp.route_payload(quests->2,'{"usd":20}'));
  assert response='{"ok":false,"done":true,"points":0,"tries_left":0,"correct_answer":{"usd":10,"local_amount":320}}';
  assert public.route_attempt(capsule,pg_temp.route_payload(quests->3))->>'done'='false';
  for spawn in select s->>'spawn_id' from jsonb_array_elements(public.game_nearby(post.lat,post.lng,10)->'spawns') s
    where s->>'quest_id'=quests->3->>'quest_id'
  loop
    select t.result into result from public.corrupted_capsule_throw(spawn,post.lat,post.lng,10,'gold',1,true) t;
    assert result='restored';
  end loop;
  assert (public.route_progress(capsule)->3->>'done')::boolean;
  assert public.route_attempt(capsule,pg_temp.route_payload(quests->4))->>'done'='false';
  select attempt_id into fight from public.landmark_start(post.id,post.lat,post.lng,10);
  for i in 1..30 loop
    select t.result into result from public.landmark_hit(fight,post.lat,post.lng,10,'gold',1) t;
    if result='won' then exit; end if;
  end loop;
  assert result='won';
  assert exists(select 1 from public.capsules where id=capsule and route_done=5);
  perform pg_temp.route_expect('select * from public.capsule_contents','permission denied for table capsule_contents');
  assert (select message from public.open_capsule(capsule))='Sealed letter';
  perform pg_temp.route_expect(format('select * from public.open_capsule(%L)',legacy),'location needed');
  assert (select message from public.open_capsule(legacy,post.lat,post.lng,10))='Old place';
  assert (select message from public.open_capsule(legacy_point,post.lat,post.lng,10))='Old coordinates';
  assert (select message from public.open_capsule(anywhere))='Anywhere';
  perform set_config('request.jwt.claim.sub',sender::text,true);
  assert exists(select 1 from public.capsules where id=capsule and route_total=5 and route_done=5);
  assert (select message from public.open_capsule(memory))='Memory';
  perform pg_temp.route_expect(format('select public.route_progress(%L)',capsule),'capsule not found');
  reset role;
  assert not has_function_privilege('anon','public.route_progress(uuid)','execute');
  assert not has_table_privilege('authenticated','private.capsule_route_stops','select');
end $$;
select 'PASS: HL-C5 templates, pool selection, all route stops and both opening locks' as result;
