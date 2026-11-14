-- Run after the organizer migration body in a transaction that rolls back.
insert into auth.users(id, email) values
  ('00000000-0000-4000-8000-000000000101', 'private-owner@example.invalid'),
  ('00000000-0000-4000-8000-000000000102', 'private-player@example.invalid');
insert into public.profiles(id, name, can_create_hunts) values
  ('00000000-0000-4000-8000-000000000101', 'Organizer', true),
  ('00000000-0000-4000-8000-000000000102', 'Player', false);
do $$
begin
  assert (select count(*) = 1 from public.profiles
    where can_create_hunts and id not in ('00000000-0000-4000-8000-000000000101'));
  assert not has_function_privilege('anon', 'public.hunt_create(jsonb)', 'execute');
  assert not has_table_privilege('authenticated', 'private.hunt_waypoint_secrets', 'select');
  assert not has_column_privilege('authenticated', 'public.profiles', 'can_create_hunts', 'update');
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
do $$
declare
  draft jsonb := jsonb_build_object('name', 'Pilot', 'description', 'Walk',
    'route_mode', 'ordered', 'leaderboard_visible', false,
    'starts_at', now() - interval '5 minutes', 'ends_at', now() + interval '1 hour',
    'time_limit_min', 30, 'radius_m', 99999);
  h text;
  state jsonb;
  w jsonb;
  base jsonb := '{"ordinal":1,"lat":25.03,"lng":121.56,"name":"Arrive","mission_type":"arrive","points":999,"arrive_check":"gps_qr","qr_token":"supplied"}';
  token text;
  code text;
begin
  begin
    perform public.hunt_create(draft || '{"ends_at":"infinity"}');
    raise exception 'infinite end accepted';
  exception when check_violation then null; end;
  h := public.hunt_create(draft)->>'id';
  perform set_config('test.private_hunt_id', h, true);
  perform public.hunt_update(h, draft || '{"name":"Pilot revised"}');
  assert public.hunt_edit_state(h)->'draft'->>'name' = 'Pilot revised';
  begin
    perform public.hunt_publish(h);
    raise exception 'empty hunt published';
  exception when raise_exception then
    if sqlerrm <> 'not_ready' then raise; end if;
  end;
  perform public.hunt_waypoint_save(h, base);
  state := public.hunt_edit_state(h);
  token := state->'waypoints'->0->>'qr_token';
  assert token ~ '^[0-9a-f]{32}$';
  perform public.hunt_waypoint_save(h, base || jsonb_build_object('id', state->'waypoints'->0->>'id'));
  assert public.hunt_edit_state(h)->'waypoints'->0->>'qr_token' = token;
  assert (public.my_hunts()->0->'area'->>'radius_m')::integer = 200;
  w := '{"ordinal":2,"lat":25.05,"lng":121.56,"name":"Puzzle","mission_type":"puzzle",
          "points":1,"puzzle_kind":"choice","choices":["first","second"],"answer":"second"}';
  perform public.hunt_waypoint_save(h, w);
  assert public.hunt_edit_state(h)->'waypoints'->1->>'answer' = '';
  assert (public.my_hunts()->0->'area'->>'radius_m')::integer between 1389 and 1391;
  assert not (public.my_hunts()->0->'waypoints'->0 ? 'qr_token');
  assert not (public.my_hunts()->0->'waypoints'->1 ? 'answer');
  begin
    perform public.hunt_waypoint_save(h, w || '{"ordinal":3,"points":1000}');
    raise exception '1000 points accepted';
  exception when check_violation then null; end;
  for i in 3..30 loop
    perform public.hunt_waypoint_save(h, base || jsonb_build_object('ordinal', i));
  end loop;
  begin
    perform public.hunt_waypoint_save(h, base || '{"ordinal":31}');
    raise exception '31st waypoint accepted';
  exception when raise_exception then
    if sqlerrm <> 'too_many' then raise; end if;
  end;
  perform public.hunt_waypoint_delete((public.hunt_edit_state(h)->'waypoints'->29->>'id')::uuid);
  assert jsonb_array_length(public.hunt_edit_state(h)->'waypoints') = 29;
  code := public.hunt_publish(h)->>'join_code';
  assert code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$';
  assert public.hunt_publish(h)->>'join_code' = code;
  assert not (public.hunt_list(25.03,121.56) @> jsonb_build_array(jsonb_build_object('id',h)));
  begin
    perform public.hunt_join(h);
    raise exception 'joined private hunt via system RPC';
  exception when raise_exception then
    if sqlerrm <> 'unknown hunt' then raise; end if;
  end;
  perform public.hunt_create(draft);
  perform public.hunt_create(draft);
  begin
    perform public.hunt_create(draft);
    raise exception 'fourth unfinished hunt created';
  exception when raise_exception then
    if sqlerrm <> 'too_many' then raise; end if;
  end;
  insert into storage.objects(bucket_id, name) values ('hunt-media', h || '/cover.png');
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
do $$
declare h text := current_setting('test.private_hunt_id');
begin
  assert public.my_hunts() = '[]'::jsonb;
  begin
    perform public.hunt_create('{}');
    raise exception 'unapproved organizer created hunt';
  exception when insufficient_privilege then null; end;
  begin
    perform public.hunt_edit_state(h);
    raise exception 'stranger read edit state';
  exception when insufficient_privilege then null; end;
  begin
    perform public.hunt_review(h);
    raise exception 'stranger read review';
  exception when insufficient_privilege then null; end;
  assert not exists (select 1 from storage.objects where bucket_id = 'hunt-media');
  insert into public.profiles(id, name) values (auth.uid(), 'Player')
    on conflict (id) do update set name = excluded.name;
end $$;

reset role;
insert into public.hunt_members(hunt_id, user_id, started_at, finished_at, points)
values (current_setting('test.private_hunt_id'), '00000000-0000-4000-8000-000000000102',
  now(), now() + interval '1 minute', 999);
insert into public.hunt_completions(hunt_id, waypoint_id, user_id, completed_at)
select hunt_id, id, '00000000-0000-4000-8000-000000000102', now()
from public.hunt_waypoints where hunt_id = current_setting('test.private_hunt_id') and ordinal = 1;

set local role authenticated;
do $$
declare h text := current_setting('test.private_hunt_id');
begin
  assert exists (select 1 from storage.objects where bucket_id = 'hunt-media' and name = h || '/cover.png');
  begin
    insert into storage.objects(bucket_id, name) values ('hunt-media', h || '/member.png');
    raise exception 'member wrote hunt media';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
do $$
declare
  h text := current_setting('test.private_hunt_id');
  review jsonb := public.hunt_review(h);
begin
  assert review->'stats'->>'finished' = '1';
  assert review->'stats'->'per_waypoint'->0->>'done' = '1';
  assert review->'members'->0->>'duration_s' = '60';
  perform public.hunt_close(h);
  assert public.hunt_edit_state(h)->>'status' = 'closed';
end $$;
reset role;

-- Exercise the participant cap using transactional fixtures.
with fixtures as (
  insert into auth.users(id, email)
  select gen_random_uuid(), 'private-cap-' || i || '@example.invalid' from generate_series(1,500) i
  returning id
)
insert into public.profiles(id, name) select id, 'Cap fixture' from fixtures;
insert into public.hunt_members(hunt_id, user_id, started_at)
select current_setting('test.private_hunt_id'), p.id, now()
from public.profiles p join auth.users u on u.id = p.id
where u.email like 'private-cap-%@example.invalid' and u.email <> 'private-cap-500@example.invalid';
do $$
begin
  assert (select count(*) from public.hunt_members where hunt_id = current_setting('test.private_hunt_id')) = 500;
  begin
    insert into public.hunt_members(hunt_id, user_id, started_at)
    select current_setting('test.private_hunt_id'), id, now()
    from auth.users where email = 'private-cap-500@example.invalid';
    raise exception '501st participant accepted';
  exception when raise_exception then
    if sqlerrm <> 'too_many' then raise; end if;
  end;
end $$;
