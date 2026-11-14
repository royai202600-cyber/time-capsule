-- Run with P1 and P2 inside a transaction ending in ROLLBACK.
insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000000201','p2-owner@example.invalid'),
  ('00000000-0000-4000-8000-000000000202','p2-player@example.invalid'),
  ('00000000-0000-4000-8000-000000000203','p2-other@example.invalid');
insert into public.profiles(id,name,can_create_hunts) values
  ('00000000-0000-4000-8000-000000000201','Organizer',true),
  ('00000000-0000-4000-8000-000000000202','Player',false),
  ('00000000-0000-4000-8000-000000000203','Other',false);

create function pg_temp.expected_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when raise_exception then
    if sqlerrm = expected then return; end if;
    raise;
  end;
  raise exception 'expected % from %', expected, statement;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$
declare
  h text;
  draft jsonb := jsonb_build_object('name','P2 route','cover','tpl:park','description','Route',
    'route_mode','ordered','leaderboard_visible',false,'starts_at',now() + interval '10 minutes',
    'ends_at',now() + interval '40 minutes','time_limit_min',15);
  waypoint jsonb := '{"name":"Quest","ordinal":1,"lat":25,"lng":121,"points":10,"mission_type":"arrive","arrive_check":"gps_qr","image":"tpl:square"}';
  state jsonb;
begin
  h := public.hunt_create(draft)->>'id';
  perform public.hunt_waypoint_save(h, waypoint);
  perform public.hunt_waypoint_save(h, waypoint || '{"ordinal":2,"mission_type":"spin"}');
  perform public.hunt_waypoint_save(h, waypoint || '{"ordinal":3,"mission_type":"puzzle","puzzle_kind":"text","answer":"Blue Door"}');
  state := public.hunt_edit_state(h);
  perform set_config('test.hunt',h,true);
  perform set_config('test.first',state->'waypoints'->0->>'id',true);
  perform set_config('test.spin',state->'waypoints'->1->>'id',true);
  perform set_config('test.puzzle',state->'waypoints'->2->>'id',true);
  perform set_config('test.qr',state->'waypoints'->0->>'qr_token',true);
  perform set_config('test.code',public.hunt_publish(h)->>'join_code',true);
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
do $$
declare
  h jsonb;
  code text := current_setting('test.code');
  first uuid := current_setting('test.first')::uuid;
begin
  assert public.hunt_private_mine() = '[]'::jsonb;
  h := public.hunt_preview(lower(code));
  assert h->>'cover' = 'tpl:park' and h->>'description' = 'Route';
  assert h->'waypoints' = '[]'::jsonb and h->>'joined_at' is null;
  perform pg_temp.expected_error(format('select public.hunt_mission_complete(%L,25,121,10,null,null)',first),'not_joined');
  h := public.hunt_join_code(code);
  assert h->>'run_started_at' = h->>'starts_at';
  assert (h->>'run_ends_at')::timestamptz = (h->>'starts_at')::timestamptz + interval '15 minutes';
  assert public.hunt_join_code(code)->>'joined_at' = h->>'joined_at';
  assert h->'waypoints'->0->>'image' = 'tpl:square';
  assert not (h->'waypoints'->0 ? 'qr_token') and not (h->'waypoints'->2 ? 'answer');
  perform pg_temp.expected_error(format('select public.hunt_mission_complete(%L,25,121,10,null,null)',first),'not_started');
  perform pg_temp.expected_error(format('select public.hunt_leaderboard(%L)',h->>'id'),'not_allowed');
end $$;

reset role;
-- Advance the fixtures without waiting in real time.
update public.hunts set starts_at = now() - interval '10 minutes' where id = current_setting('test.hunt');
update public.hunt_members set joined_at = now() - interval '5 minutes', started_at = now() - interval '5 minutes'
where hunt_id = current_setting('test.hunt');

set local role authenticated;
do $$
declare
  first uuid := current_setting('test.first')::uuid;
  spin uuid := current_setting('test.spin')::uuid;
  puzzle uuid := current_setting('test.puzzle')::uuid;
  result jsonb;
begin
  perform pg_temp.expected_error(format('select public.hunt_mission_complete(%L,25,121,10,null,null)',spin),'locked');
  perform pg_temp.expected_error(format('select public.hunt_mission_complete(%L,25,121,201,null,null)',first),'too_far');
  perform pg_temp.expected_error(format('select public.hunt_mission_complete(%L,25,122,10,null,null)',first),'too_far');
  perform pg_temp.expected_error(format('select public.hunt_mission_complete(%L,25,121,10,null,null)',first),'wrong_qr');
  result := public.hunt_mission_complete(first,25,121,200,null,'timecapsule://quest/' || upper(current_setting('test.qr')));
  assert result->>'points_gained' = '10';
  perform pg_temp.expected_error(format('select public.hunt_mission_complete(%L,25,121,10,null,null)',first),'already_done');
  result := public.hunt_mission_complete(spin,25,121,10,null,null);
  assert result->'hunt'->>'points' = '20';
  for attempt in 1..3 loop
    result := public.hunt_mission_complete(puzzle,25,121,10,'wrong',null);
    assert result->>'message' = case when attempt < 3 then 'wrong_answer' else 'no_tries' end;
    assert (result->>'details')::jsonb->>'tries_left' = (3 - attempt)::text;
  end loop;
  assert (result->>'details')::jsonb->>'wait_s' = '60';
  perform pg_temp.expected_error(format('select public.hunt_mission_complete(%L,25,121,10,%L,null)',puzzle,'Blue Door'),'no_tries');
end $$;

reset role;
update public.hunt_completions set wait_until = now() - interval '1 second'
where waypoint_id = current_setting('test.puzzle')::uuid;
set local role authenticated;
do $$
declare
  result jsonb;
  hunt text := current_setting('test.hunt');
begin
  result := public.hunt_mission_complete(current_setting('test.puzzle')::uuid,25,121,10,U&' BLUE\3000door！ ',null);
  assert result->'hunt'->>'points' = '30' and result->'hunt'->>'finished_at' is not null;
  assert (select count(*) = 1 from public.my_passport() where place = hunt and how_earned = 'private_hunt');
  assert public.hunt_private_mine()->0->>'id' = hunt;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000203',true);
do $$
begin
  perform pg_temp.expected_error(format('select public.hunt_report(%L)',current_setting('test.hunt')),'not_joined');
  perform public.hunt_join_code(current_setting('test.code'));
end $$;
reset role;

update public.hunt_members set joined_at = now() - interval '16 minutes', started_at = now() - interval '16 minutes'
where hunt_id = current_setting('test.hunt') and user_id = '00000000-0000-4000-8000-000000000203';
update public.hunts set leaderboard_visible = true where id = current_setting('test.hunt');

set local role authenticated;
do $$
declare hunt text := current_setting('test.hunt');
begin
  perform pg_temp.expected_error(format('select public.hunt_mission_complete(%L,25,121,10,null,null)',
    current_setting('test.first')),'time_up');
  assert public.hunt_leaderboard(hunt)->0->>'points' = '30';
  perform public.hunt_report(hunt);
  perform public.hunt_report(hunt);
  assert jsonb_array_length(public.hunt_private_mine()) = 1;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
do $$
begin
  perform public.hunt_report(current_setting('test.hunt'));
  assert public.hunt_private_mine() = '[]'::jsonb;
  perform pg_temp.expected_error(format('select public.hunt_preview(%L)',current_setting('test.code')),'bad_code');
end $$;
reset role;

do $$
begin
  assert not exists (select 1 from public.player_game
    where user_id in ('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000203'));
end $$;
