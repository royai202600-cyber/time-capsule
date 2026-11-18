-- Additional assertions after C2, C1 and C3 have all run inside rollback.
do $$
declare h public.hunts;
declare rule private.quest_rules;
declare points integer := 20;
declare result jsonb;
declare quest jsonb;
begin
  perform pg_temp.pool_user(5);
  select * into strict h from public.hunts where id='xinyi-2026-11';
  rule:=private.quest_rule_from_pool((select id from private.question_pool
    where prompt_en='Price prompt'), 'price');
  rule.id:=gen_random_uuid();
  insert into private.quest_rules select rule.*;
  -- Give the fixture a price quest before its five normal pins.
  update private.city_hunt_located_quests set ordinal=ordinal+10 where hunt_id=h.id;
  insert into private.city_hunt_located_quests(hunt_id,quest_id,ordinal,points)
  values(h.id,rule.id,1,points);

  insert into private.game_speed_allowlist(user_id) values(auth.uid()) on conflict do nothing;
  perform public.city_hunt_join(h.id);
  perform public.city_hunt_check_in(h.id,h.keeper_lat,h.keeper_lng,10);
  for i in 1..2 loop
    result:=public.city_hunt_quest_attempt(pg_temp.quest_payload(rule.id,rule.location_lat,rule.location_lng,'{"usd":8}'));
    assert not (result ? 'correct_answer') and result->>'done'='false';
  end loop;
  result:=public.city_hunt_quest_attempt(pg_temp.quest_payload(rule.id,rule.location_lat,rule.location_lng,'{"usd":8}'));
  assert result='{"ok":false,"done":true,"points":0,"tries_left":0,"correct_answer":{"usd":10,"local_amount":320}}'::jsonb;
  quest:=public.city_hunt_quests(h.id)->0;
  assert quest->>'done'='true' and quest->'price'->>'tries_left'='0';
  assert public.city_hunt_quests(h.id)->1->>'locked'='false';
  perform pg_temp.pool_expect(format('select public.city_hunt_quest_attempt(%L)',
    pg_temp.quest_payload(rule.id,rule.location_lat,rule.location_lng,'{"usd":10}')),'already_done');
  update private.city_hunt_located_progress c set completed_at=now()
    from private.city_hunt_located_quests q
    where q.quest_id=c.quest_id and q.hunt_id=h.id and c.user_id=auth.uid();
  result:=public.city_hunt_finish(h.id,h.keeper_lat,h.keeper_lng,10);
  assert result->>'state'='finished';
end $$;

-- Force an ordinary wave to contain only a starter while exercising the
-- actual resolve_spawn and throw path. Restore the revision after this check.
savepoint starter_wave;
do $$
declare spawn record;
declare result record;
declare active_wave record;
declare config private.game_config;
declare starter private.vessel_spawn_rules;
begin
  perform pg_temp.pool_user(5);
  select * into active_wave from private.game_wave_at(now());
  select * into config from private.game_config where singleton;
  config.spawn_chance:=1;
  starter.vessel:='dome';
  starter.rarity:='common';
  insert into private.game_spawn_revisions(starts_at,config,rules,places)
    values(active_wave.starts_at,config,array[starter],
      array[row('taipei','dome')::private.vessel_spawn_places])
  on conflict(starts_at) do update set config=excluded.config,rules=excluded.rules,places=excluded.places;
  select s.spawn_id,p.lat,p.lng into strict spawn
  from public.corrupted_spots p
  cross join lateral private.resolve_spawn(p.id,active_wave.wave) s
  where p.city='Taipei' and p.hidden_at is null and s.vessel='dome' limit 1;
  update public.player_game set wax_balls=100 where user_id=auth.uid();
  select * into strict result from public.corrupted_capsule_throw(spawn.spawn_id,spawn.lat,spawn.lng,10,'wax',1,true);
  assert result.result='restored' and result.vessel='dome' and result.copies is null and result.stars=1;
  assert exists(select 1 from public.owned_vessels where user_id=auth.uid() and vessel='dome' and copies is null);
end $$;
rollback to starter_wave;

select 'PASS: C3 price exhaustion in both contexts, City Hunt completion and starter catch with C2' as result;
