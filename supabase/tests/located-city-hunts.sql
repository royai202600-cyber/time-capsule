-- Run with hosted rollback fixtures and the located routes migration.
do $$
declare h public.hunts;
declare q jsonb;
declare spawn jsonb;
declare result jsonb;
declare fight record;
declare hit record;
declare player uuid := 'c3a10000-0000-4000-8000-000000000004';
declare quest_lat double precision;
declare quest_lng double precision;
declare count_done integer;
begin
  insert into private.game_speed_allowlist(user_id) values(player) on conflict do nothing;
  perform pg_temp.pool_user(4);
  update private.game_config set restore_common=1 where singleton;
  for h in select * from public.hunts where id in ('xinyi-2026-11','senado-square-2026-11','hkust-2026-11') order by id
  loop
    assert public.city_hunt_quests(h.id)='[]'::jsonb;
    perform public.city_hunt_join(h.id);
    assert public.city_hunt_quests(h.id)='[]'::jsonb;
    perform public.city_hunt_check_in(h.id,h.keeper_lat,h.keeper_lng,10);
    assert jsonb_array_length(public.city_hunt_quests(h.id))=5;
    -- Simulate a player who had already spun one Waypost and caught two
    -- capsules before upgrading. The first pin and the two catches carry over.
    update public.city_hunt_quest_progress set spin_count=1,restore_count=2,
      checked_in_at=now()-interval '1 second',joined_at=now()-interval '2 seconds'
    where hunt_id=h.id and user_id=player;
    assert public.city_hunt_quests(h.id)->0->>'done'='true';
    assert public.city_hunt_quests(h.id)->1->>'locked'='false';
    assert public.city_hunt_quests(h.id)->4->>'locked'='true';

    q:=public.city_hunt_quests(h.id)->4;
    perform pg_temp.pool_expect(format('select public.city_hunt_quest_attempt(%L)',
      pg_temp.quest_payload((q->>'quest_id')::uuid,(q->>'location_lat')::float8,(q->>'location_lng')::float8)),'locked');
    perform pg_temp.pool_expect(format('select public.city_hunt_finish(%L,%L,%L,10)',
      h.id,h.keeper_lat,h.keeper_lng),'hunt incomplete');

    for q in select value from jsonb_array_elements(public.city_hunt_quests(h.id)) where value->>'done'='false'
    loop
      quest_lat:=(q->>'location_lat')::float8;
      quest_lng:=(q->>'location_lng')::float8;
      perform pg_temp.pool_expect(format('select public.city_hunt_quest_attempt(%L)',
        pg_temp.quest_payload((q->>'quest_id')::uuid,0,0)),'too_far');
      result:=public.city_hunt_quest_attempt(pg_temp.quest_payload((q->>'quest_id')::uuid,quest_lat,quest_lng));
      assert result->>'ok'='true';
      case q->>'type'
        when 'arrive' then assert result->>'done'='true';
        when 'catch' then
          assert result->>'done'='false' and q->>'catch_count'='5';
          result:=public.game_nearby(quest_lat,quest_lng,10);
          assert (select count(*)=3 from jsonb_array_elements(result->'spawns') where value->>'quest_id'=q->>'quest_id');
          update public.player_game set wax_balls=100 where user_id=player;
          for spawn in select value from jsonb_array_elements(result->'spawns') where value->>'quest_id'=q->>'quest_id'
          loop
            select * into hit from public.corrupted_capsule_throw(spawn->>'spawn_id',quest_lat,quest_lng,10,'wax',1,true);
            assert hit.result='restored';
          end loop;
        when 'landmark' then
          assert result->>'done'='false' and (q->>'landmark_id')::uuid=h.landmark;
          select * into fight from public.landmark_start(h.landmark,quest_lat,quest_lng,10);
          for i in 1..30 loop
            select * into hit from public.landmark_hit(fight.attempt_id,quest_lat,quest_lng,10,'wax',1);
            exit when hit.result='won';
          end loop;
          assert hit.result='won';
        else raise exception 'Unexpected seeded quest type';
      end case;
    end loop;
    select count(*) into count_done from jsonb_array_elements(public.city_hunt_quests(h.id)) where value->>'done'='true';
    assert count_done=5;
    result:=public.city_hunt_finish(h.id,h.keeper_lat,h.keeper_lng,10);
    assert result->>'state'='finished' and (result->>'gold_gained')::int=h.reward_gold;
    assert exists(select 1 from public.my_passport() where place=h.id and how_earned='hunt');
    perform pg_temp.pool_expect(format('select public.city_hunt_finish(%L,%L,%L,10)',
      h.id,h.keeper_lat,h.keeper_lng),'already finished');
  end loop;
end $$;

-- An old client can complete its original three actions and claim at the Keeper.
do $$
declare h public.hunts;
declare w public.public_capsule_spots;
declare s record;
declare fight record;
declare hit record;
declare reward jsonb;
declare player uuid := 'c3a10000-0000-4000-8000-000000000003';
declare wave bigint;
begin
  perform pg_temp.pool_user(3);
  insert into private.game_speed_allowlist(user_id) values(player) on conflict do nothing;
  select * into h from public.hunts where id='xinyi-2026-11';
  perform public.hunt_join(h.id);
  perform public.hunt_check_in(h.id,h.keeper_lat,h.keeper_lng,10);
  for w in select * from public.public_capsule_spots where kind='common' and game_enabled and hidden_at is null
    and public.distance_m(lat,lng,h.area_lat,h.area_lng)<=h.area_radius_m order by id limit 3
  loop
    perform public.waypost_spin(w.id,w.lat,w.lng,10);
  end loop;
  -- Preserve normal spawn validation in the legacy throw endpoint.
  update private.game_config set spawn_chance=1,restore_common=1,restore_uncommon=1,restore_rare=1 where singleton;
  select t.wave into wave from private.game_wave_at(now()) t;
  update public.player_game set wax_balls=100 where user_id=player;
  for s in select c.lat,c.lng,r.spawn_id from public.corrupted_spots c cross join lateral private.resolve_spawn(c.id,wave) r
    where c.hidden_at is null and r.expires_at>now()
      and public.distance_m(c.lat,c.lng,h.area_lat,h.area_lng)<=h.area_radius_m
    order by c.id limit 5
  loop
    select * into hit from public.corrupted_throw(s.spawn_id,s.lat,s.lng,10,'wax',1,true);
    assert hit.result='restored';
  end loop;
  select * into w from public.public_capsule_spots where id=h.landmark;
  select * into fight from public.landmark_start(w.id,w.lat,w.lng,10);
  for i in 1..30 loop
    select * into hit from public.landmark_hit(fight.attempt_id,w.lat,w.lng,10,'wax',1);
    exit when hit.result='won';
  end loop;
  assert hit.result='won';
  reward:=public.hunt_finish(h.id,h.keeper_lat,h.keeper_lng,10);
  assert reward->>'state'='finished';
  assert public.city_hunt_quests(h.id)->4->>'done'='true';
end $$;

-- An old timed run should not carry located progress past its daily reset.
do $$
declare h public.hunts;
declare reward jsonb;
declare player uuid := 'c3a10000-0000-4000-8000-000000000004';
begin
  perform pg_temp.pool_user(4);
  select * into h from public.hunts where id='xinyi-2026-11';
  update public.city_hunt_quest_progress p set joined_at=now()-interval '2 days',
    checked_in_at=now()-interval '1 day',located_run_at=now()-interval '1 day'
  where p.hunt_id=h.id and p.user_id=player;
  update public.city_hunt_runs r set day=r.day-1,
    started_at=r.started_at-interval '1 day',finished_at=r.finished_at-interval '1 day'
  where r.hunt_id=h.id and r.user_id=player;
  update private.city_hunt_located_progress c set run_at=now()-interval '1 day'
  from private.city_hunt_located_quests q
  where c.quest_id=q.quest_id and q.hunt_id=h.id and c.user_id=player;
  perform public.city_hunt_check_in(h.id,h.keeper_lat,h.keeper_lng,10);
  assert (select count(*)=0 from jsonb_array_elements(public.city_hunt_quests(h.id)) where value->>'done'='true');
  assert exists(select 1 from public.city_hunt_passport_stamps where hunt_id=h.id and user_id=player);
  update public.city_hunt_quest_progress set spin_count=3,restore_count=5,landmark_count=1
    where hunt_id=h.id and user_id=player;
  reward:=public.city_hunt_finish(h.id,h.keeper_lat,h.keeper_lng,10);
  assert reward->>'gold_gained'='0' and (reward->>'xp_gained')::int=h.repeat_xp;
  assert (select count(*)=1 from public.city_hunt_passport_stamps where hunt_id=h.id and user_id=player);
end $$;
select 'PASS: all three located City Hunt runs, carried progress, legacy actions, reward and daily reset' as result;
