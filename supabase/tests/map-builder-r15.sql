-- Run after R1.5, or append within the transaction used to rehearse the migration.
begin;

create function pg_temp.expect_error(statement text, message text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'expected error %', message;
exception when others then
  if sqlerrm <> message then raise; end if;
end;
$$;

do $$
declare
  editor uuid;
  player uuid := gen_random_uuid();
  p record;
  q record;
  draft uuid;
  other uuid;
  spot uuid;
  saved jsonb;
  undo_id bigint;
  edited_batch bigint;
  area jsonb;
  wave bigint;
  draft_id uuid;
  legacy_spot uuid;
  legacy_capsule uuid;
  conflicting_posts uuid[];
  rule private.quest_rules;
begin
  assert not exists (select 1 from public.public_capsule_spots
    where status <> 'deleted' group by s2_cell17 having count(*) > 1), 'unique occupied cells';
  assert not exists (select 1 from public.public_capsule_spots
    where game_enabled <> (status = 'live') or (hidden_at is null) <> (status = 'live')), 'Waypost status sync';
  assert not exists (select 1 from public.corrupted_spots
    where (hidden_at is null) <> (status = 'live')), 'spot status sync';
  assert not exists (select 1 from public.public_capsule_spots where status = 'draft'),
    'backfill never makes legacy places draft';
  assert not exists (select 1 from public.capsules c join public.public_capsule_spots w
    on w.id = c.public_capsule_spot where w.status = 'deleted'), 'references moved';
  assert (select count(*) from private.admin_actions where action = 'map_builder.cell_cleanup') = 1, 'one cleanup event';
  assert not exists (select 1 from private.admin_actions a
    cross join lateral jsonb_array_elements(a.after->'cells') x
    where a.action = 'map_builder.cell_cleanup' and
      (select count(*) from public.waypost_spins where waypost_id = (x->>'deleted_id')::uuid)
      <> (x->>'deleted_spins')::bigint), 'spin history retained';
  perform private.assert_map_builder_hunts();
  for rule in select quest.* from private.quest_rules quest
    where quest.type = 'catch' and (
      exists (select 1 from private.city_hunt_located_quests c where c.quest_id = quest.id)
      or exists (select 1 from private.todays_hunt_schedule t where t.quest_id = quest.id
        and t.hunt_date = private.todays_hunt_date(t.city, now()))
    )
  loop
    perform private.quest_pin_pool(rule);
  end loop;

  select user_id into editor from private.admin_members where role = 'owner' order by user_id limit 1;
  if editor is null then
    editor := gen_random_uuid();
    insert into auth.users (id, email) values (editor, 'r15-rollback-editor@example.invalid');
    insert into public.profiles (id, name) values (editor, 'R1.5 rollback editor') on conflict do nothing;
    insert into private.admin_members (user_id, role) values (editor, 'admin');
  end if;
  insert into auth.users (id, email) values (player, 'r15-rollback-player@example.invalid');
  insert into public.profiles (id, name) values (player, 'R1.5 rollback player') on conflict do nothing;

  -- A retained old capsule uses its own unlock fields. Its recorded drop
  -- point can be hidden without preventing the recipient opening it.
  select id into strict legacy_spot from public.public_capsule_spots
  where status = 'hidden' and not game_enabled and public_drop order by id limit 1;
  insert into public.capsules (sender, recipient, vessel, open_at, is_public, public_capsule_spot)
  values (editor, player, 'bottle', now() - interval '1 hour', true, legacy_spot)
  returning id into legacy_capsule;
  insert into public.capsule_contents (capsule_id, message) values (legacy_capsule, 'Legacy opening test');
  perform set_config('request.jwt.claim.sub', player::text, true);
  assert (select message from public.open_capsule(legacy_capsule, null, null, null)) = 'Legacy opening test',
    'recipient can open older capsule with a hidden drop point';
  perform set_config('request.jwt.claim.sub', editor::text, true);

  -- Two free cells away from every existing live Waypost within drop range.
  create temp table r15_test_points on commit drop as
  with candidates as (
    select distinct on (cell) lat, lng, cell from (
    select 25.062 + i*0.0005 as lat, 121.552 + j*0.0005 as lng,
      private.s2_cell17(25.062 + i*0.0005, 121.552 + j*0.0005) as cell
    from generate_series(-7,7) i cross join generate_series(-7,7) j
    where private.admin_inside_border('taipei', 25.062 + i*0.0005, 121.552 + j*0.0005)
      and not exists (select 1 from public.public_capsule_spots w where w.status <> 'deleted'
        and (w.s2_cell17 = private.s2_cell17(25.062 + i*0.0005, 121.552 + j*0.0005)
          or public.distance_m(w.lat, w.lng, 25.062 + i*0.0005, 121.552 + j*0.0005) <= 110))
    ) available
    where private.s2_cell17(lat + 0.000001, lng) = cell
      and private.admin_inside_border('taipei', lat + 0.000001, lng)
    order by cell, lat, lng
  ), first_point as (select * from candidates order by cell limit 1)
  select * from first_point
  union all (
    select c.* from candidates c cross join first_point f
    where public.distance_m(c.lat, c.lng, f.lat, f.lng) > 110 order by c.cell limit 1
  );
  select * into strict p from r15_test_points order by cell limit 1;
  select * into strict q from r15_test_points order by cell offset 1 limit 1;
  draft := (public.admin_waypost_add('taipei', p.lat, p.lng, '測試廣場', 'R1.5 rollback', 'square', p_status => 'draft')->>'id')::uuid;
  assert (public.admin_waypost_check('taipei', p.lat, p.lng)->>'cell_taken')::boolean, 'draft holds cell';
  assert not (public.admin_waypost_check('taipei', p.lat, p.lng, draft)->>'cell_taken')::boolean, 'own cell excluded';
  perform pg_temp.expect_error(format('select public.admin_waypost_add(%L,%L,%L,%L,%L,%L)',
    'taipei', p.lat, p.lng, '測試廣場', 'Duplicate', 'square'), 'cell_taken');
  saved := public.admin_waypost_update(draft, p.lat + 0.000001, p.lng);
  assert (saved->>'s2_cell17') = p.cell and saved->>'status' = 'draft', 'move within own cell';
  other := (public.admin_waypost_add('taipei', q.lat, q.lng, '測試廣場', 'R1.5 other', 'square')->>'id')::uuid;
  perform pg_temp.expect_error(format('select public.admin_waypost_update(%L,%L,%L)', draft, q.lat, q.lng), 'cell_taken');

  spot := (public.admin_spot_add('taipei', p.lat, p.lng, 'park', p_status => 'draft')->>'id')::uuid;
  select w.wave into wave from private.game_wave_at(now()) w;
  assert not exists (select 1 from private.resolve_spawn(spot, wave + 1)), 'draft never spawns';
  assert (public.admin_city_map('taipei')->'wayposts') @> jsonb_build_array(jsonb_build_object('id', draft, 'status', 'draft')), 'admin sees draft';

  perform set_config('request.jwt.claim.sub', player::text, true);
  assert not (public.game_nearby(p.lat, p.lng, 8)->'wayposts') @> jsonb_build_array(jsonb_build_object('id', draft)), 'nearby excludes draft';
  assert jsonb_array_length(public.waypost_rack(draft)->'items') = 0 or
    not (public.waypost_rack(draft) ? 'items'), 'rack excludes draft';
  perform pg_temp.expect_error(format('select public.rack_leave(%L,%L,%L,8,%L,%L,0)',
    draft, p.lat, p.lng, 'QA safe message', ''), 'too_far');
  perform pg_temp.expect_error(format('select * from public.public_capsule_drop(%L,%L,%L,1,%L,%L,8)',
    'QA safe message', '', 'bottle', p.lat, p.lng), 'no_shore');
  perform pg_temp.expect_error(format('select public.admin_place_set_status(%L,array[%L]::uuid[],%L)',
    'waypost', draft, 'live'), 'forbidden');
  perform set_config('request.jwt.claim.sub', editor::text, true);

  perform public.admin_place_set_status('waypost', array[draft], 'live');
  perform public.admin_place_set_status('waypost', array[draft], 'deleted');
  select max(id) into undo_id from private.admin_actions where action = 'waypost.status' and target_id = draft::text;
  assert not (public.admin_city_map('taipei')->'wayposts') @> jsonb_build_array(jsonb_build_object('id', draft)), 'admin omits deleted';
  perform public.admin_undo(undo_id);
  assert (select status from public.public_capsule_spots where id = draft) = 'live', 'Undo delete restores live';
  perform public.admin_place_set_status('waypost', array[draft], 'hidden');
  assert (public.admin_waypost_check('taipei', p.lat, p.lng)->>'cell_taken')::boolean, 'hidden holds cell';

  saved := public.admin_waypost_add_batch('taipei', jsonb_build_array(
    jsonb_build_object('lat', p.lat, 'lng', p.lng, 'name_zh', '測試廣場', 'name_en', 'Occupied', 'scene', 'square'),
    jsonb_build_object('lat', q.lat, 'lng', q.lng, 'name_zh', '測試廣場', 'name_en', 'Occupied', 'scene', 'square'),
    jsonb_build_object('lat', 1, 'lng', 1, 'name_zh', '測試廣場', 'name_en', 'Outside', 'scene', 'square')));
  assert (saved->'skipped') = '[{"index":0,"reason":"cell_taken"},{"index":1,"reason":"cell_taken"},{"index":2,"reason":"outside_border"}]'::jsonb, 'per-item skips';
  saved := public.admin_spot_add_batch('taipei', jsonb_build_array(
    jsonb_build_object('lat', p.lat, 'lng', p.lng, 'habitat', 'park'),
    jsonb_build_object('lat', q.lat, 'lng', q.lng, 'habitat', 'invalid')));
  draft_id := (saved->'added'->0->>'id')::uuid;
  assert jsonb_array_length(saved->'added') = 1 and saved->'skipped' = '[{"index":1,"reason":"bad_habitat"}]'::jsonb, 'batch adds drafts and skips invalid habitat';
  select max(id) into edited_batch from private.admin_actions where action = 'spot.add_batch' and target_id = draft_id::text;
  perform public.admin_undo(edited_batch);
  assert (select status from public.corrupted_spots where id = draft_id) = 'deleted', 'Undo batch soft-deletes rows';

  perform pg_temp.expect_error('select public.admin_area_suggest(''taipei'',''waypost'',25,121,26,122,150)', 'area_too_big');
  area := public.admin_area_suggest('taipei', 'waypost', 25.03, 121.55, 25.039, 121.56, 100);
  assert jsonb_array_length(area) between 1 and 100, 'bounded nonempty safe suggestions';
  assert not exists (
    select 1 from jsonb_to_recordset(area) x(lat float8, lng float8)
    where not exists (select 1 from private.public_capsule_drop_places d
      where d.region_id = 'taipei' and d.lat = x.lat and d.lng = x.lng)
      or not private.admin_inside_border('taipei', x.lat, x.lng)
      or exists (select 1 from public.public_capsule_spots w where w.status <> 'deleted'
        and (w.s2_cell17 = private.s2_cell17(x.lat,x.lng) or public.distance_m(w.lat,w.lng,x.lat,x.lng) < 100))
  ), 'safe, free and spaced from existing places';
  assert not exists (
    select 1 from jsonb_to_recordset(area) x(lat float8, lng float8)
    join jsonb_to_recordset(area) y(lat float8, lng float8) on (x.lat,x.lng) < (y.lat,y.lng)
    where private.s2_cell17(x.lat,x.lng) = private.s2_cell17(y.lat,y.lng)
      or public.distance_m(x.lat,x.lng,y.lat,y.lng) < 100
  ), 'suggestions separated from each other';

  select array_agg(w.id order by w.id) into conflicting_posts
  from public.hunts h join public.public_capsule_spots w
    on public.distance_m(w.lat,w.lng,h.area_lat,h.area_lng) <= h.area_radius_m
  where h.id = 'hkust-2026-11' and w.kind = 'common' and w.status = 'live';
  perform pg_temp.expect_error(format('select public.admin_place_set_status(%L,%L::uuid[],%L)',
    'waypost', conflicting_posts, 'deleted'), 'hunt_needs_wayposts');
  assert not exists (select 1 from public.public_capsule_spots where id = any(conflicting_posts) and status <> 'live'),
    'bulk refusal rolls back all changes';
end;
$$;

-- Test Publish against a pre-existing data conflict injected inside this
-- rollback only. Normal draft creation reserves the cell immediately.
do $$
declare
  a uuid;
  b uuid;
  p record;
  q record;
begin
  select * into strict p from r15_test_points order by cell limit 1;
  select * into strict q from r15_test_points order by cell offset 1 limit 1;
  select id into strict a from public.public_capsule_spots where s2_cell17 = p.cell and status = 'hidden';
  select id into strict b from public.public_capsule_spots where s2_cell17 = q.cell and status = 'live';
  perform public.admin_place_set_status('waypost', array[a], 'draft');
  drop index public.public_capsule_spots_r15_cell_idx;
  alter table public.public_capsule_spots disable trigger map_builder_waypost_status;
  update public.public_capsule_spots set lat = q.lat, lng = q.lng where id = a;
  alter table public.public_capsule_spots enable trigger map_builder_waypost_status;
  perform pg_temp.expect_error(format('select public.admin_place_set_status(%L,array[%L]::uuid[],%L)',
    'waypost', a, 'live'), 'cell_taken');
  assert (select status from public.public_capsule_spots where id = b) = 'live', 'holder stays live';
end;
$$;

select 'R1.5 SQL rollback checks passed' as result;
rollback;
