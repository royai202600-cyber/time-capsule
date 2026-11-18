-- Run after the migration SQL in the same transaction. Roll back both.
create function pg_temp.require_ok(ok boolean, label text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'assertion failed: %', label; end if;
end;
$$;

create function pg_temp.expect_error(command text, expected text) returns void
language plpgsql as $$
begin
  begin
    execute command;
  exception when raise_exception or insufficient_privilege then
    if sqlerrm = expected then return; end if;
    raise;
  end;
  raise exception 'expected % for %', expected, command;
end;
$$;

do $$
declare
  sender_id uuid := gen_random_uuid();
  finder_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  moderator_id uuid := gen_random_uuid();
  viewer_id uuid := gen_random_uuid();
  owner_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  post_id uuid := gen_random_uuid();
  capsule_id uuid;
  legacy_id uuid;
  opened jsonb;
  page jsonb;
  page_two jsonb;
  removal jsonb;
  origin constant text := '25, 121, 10';
begin
  insert into auth.users (id, email) select id, id::text || '@rack-test.invalid'
  from unnest(array[sender_id, finder_id, other_id, moderator_id, viewer_id, owner_id, admin_id]) id;
  insert into public.profiles (id, name) select id, 'HL-C1 rollback fixture'
  from unnest(array[sender_id, finder_id, other_id, moderator_id, viewer_id, owner_id, admin_id]) id
  on conflict do nothing;
  insert into private.admin_members (user_id, role)
  values (moderator_id, 'moderator'), (viewer_id, 'viewer'), (owner_id, 'owner'), (admin_id, 'admin');
  insert into public.friendships (user_id, friend_id) values (finder_id, sender_id);
  insert into public.public_capsule_spots (id, lat, lng, name_zh, name_en, city_zh, city_en, game_enabled, kind)
  values (post_id, 25, 121, '測試', 'HL-C1 rollback fixture', '台北', 'Taipei', true, 'common');

  perform pg_temp.require_ok(not private.text_allowed('prefixGO DIEsuffix')
    and not private.text_allowed('請你去死啦') and private.text_allowed('Good morning'), 'shared word check');

  perform set_config('request.jwt.claim.sub', sender_id::text, true);
  perform pg_temp.expect_error(format('select public.rack_leave(%L,0,0,10,%L,%L,1)', post_id, 'Letter', ''), 'too_far');
  perform pg_temp.expect_error(format('select public.rack_leave(%L,25,121,201,%L,%L,1)', post_id, 'Letter', ''), 'too_far');
  perform pg_temp.expect_error(format('select public.rack_leave(%L,%s,%L,%L,2)', post_id, origin, 'Letter', ''), 'bad_wait');
  perform pg_temp.expect_error(format('select public.rack_leave(%L,%s,%L,%L,1)', post_id, origin, 'Go Die now', ''), 'blocked_words');
  perform pg_temp.expect_error(format('select public.rack_leave(%L,%s,%L,%L,1)', post_id, origin, 'Letter', '請你去死啦'), 'blocked_words');
  perform pg_temp.expect_error(format('select public.rack_leave(%L,%s,%L,%L,1,%L,%L)', post_id, origin, 'Letter', '', 'Go die?', 'no'), 'blocked_words');
  perform pg_temp.expect_error(format('select public.rack_leave(%L,%s,%L,%L,1,%L,%L)', post_id, origin, 'Letter', '', 'Name?', '　 '), 'no_answer');
  capsule_id := (public.rack_leave(post_id, 25, 121, 10, 'Sealed test letter', 'A hint', 1,
    'Which city?', ' New York ')->>'capsule_id')::uuid;
  for i in 1..25 loop
    perform public.rack_leave(post_id, 25, 121, 10, 'More mail', '', 7);
  end loop;
  perform pg_temp.require_ok((public.waypost_rack(post_id, 'mine')->>'count')::integer = 26, 'mine');
  perform pg_temp.expect_error(format('select * from public.open_capsule(%L)', capsule_id), 'capsule not found');

  perform set_config('request.jwt.claim.sub', finder_id::text, true);
  page := public.waypost_rack(post_id, 'friends');
  page_two := public.waypost_rack(post_id, 'friends', page->'next_cursor');
  perform pg_temp.require_ok((page->>'count')::integer = 26 and (page_two->>'count')::integer = 26
    and jsonb_array_length(page->'items') = 24 and jsonb_array_length(page_two->'items') = 2
    and page_two->'next_cursor' = 'null'::jsonb and not exists (
      select 1 from jsonb_array_elements(page->'items') a, jsonb_array_elements(page_two->'items') b
      where a->>'capsule_id' = b->>'capsule_id'
    ), 'friends, total, stable paging');
  page := public.waypost_rack(post_id, 'has_question');
  perform pg_temp.require_ok((page->>'count')::integer = 1 and page#>>'{items,0,lock_question}' = 'Which city?'
    and not ((page#>'{items,0}') ?| array['body','message','answer','lock_answer'])
    and (public.waypost_rack(post_id, 'waiting')->>'count')::integer = 26
    and (public.waypost_rack(post_id, 'ready')->>'count')::integer = 0
    and (public.waypost_rack(post_id, 'mine')->>'count')::integer = 0, 'filters and sealed metadata');
  perform pg_temp.expect_error(format('select public.waypost_rack(%L,%L)', post_id, 'question'), 'bad_filter');
  perform pg_temp.expect_error(format('select public.rack_open(%L,25.002,121,10)', capsule_id), 'too_far');
  perform pg_temp.expect_error(format('select public.rack_open(%L,%s)', capsule_id, origin), 'too_early');
  perform public.public_capsule_report(capsule_id, 'other');
  perform pg_temp.require_ok((public.waypost_rack(post_id, 'has_question')->>'count')::integer = 0, 'first report hides');
  perform pg_temp.expect_error(format('select public.rack_open(%L,%s)', capsule_id, origin), 'taken');
  perform pg_temp.expect_error(format('select public.admin_waypost_rack(%L)', post_id), 'forbidden');

  perform set_config('request.jwt.claim.sub', viewer_id::text, true);
  perform pg_temp.require_ok(not exists (select 1 from jsonb_array_elements(public.admin_waypost_rack(post_id)->'items') a
    where a->>'body' is not null), 'viewer cannot read bodies');
  perform pg_temp.expect_error(format('select public.admin_rack_remove(%L,%L)', capsule_id, 'Test'), 'forbidden');

  perform set_config('request.jwt.claim.sub', moderator_id::text, true);
  page := public.admin_waypost_rack(post_id);
  page_two := public.admin_waypost_rack(post_id, page->'next_cursor');
  perform pg_temp.require_ok(exists (select 1 from jsonb_array_elements((page->'items') || (page_two->'items')) a
    where a->>'capsule_id' = capsule_id::text and a->>'status' = 'reported' and a->>'report_count' = '1'
      and a->>'body' = 'Sealed test letter' and not (a ? 'lock_answer'))
    and exists (select 1 from jsonb_array_elements(public.admin_queue('open')) a
      where a->>'id' = capsule_id::text and a->>'title' = 'Which city?'), 'moderator can read reported body and question');
  perform public.admin_queue_resolve('public_capsule_report', capsule_id::text, 'restore', null);
  removal := public.admin_rack_remove(capsule_id, 'Test remove');
  perform pg_temp.require_ok((public.waypost_rack(post_id,'has_question')->>'count')::integer = 0, 'admin remove hides');
  perform public.admin_undo((removal->>'action_id')::bigint);
  perform pg_temp.require_ok((public.waypost_rack(post_id,'has_question')->>'count')::integer = 1, 'moderator undo');
  perform pg_temp.require_ok(exists (select 1 from private.admin_actions where actor = viewer_id and action = 'rack.list')
    and exists (select 1 from private.admin_actions where actor = moderator_id and action = 'undo')
    and exists (select 1 from private.admin_actions where actor = moderator_id and action = 'rack.remove'
      and note = 'Test remove'), 'audited reads and writes');

  update public.capsules c set open_at = now() - interval '1 minute' where c.id = capsule_id;
  perform set_config('request.jwt.claim.sub', finder_id::text, true);
  perform pg_temp.expect_error(format('select public.rack_open(%L,%s,%L)', capsule_id, origin, 'London'), 'wrong_answer');
  opened := public.rack_open(capsule_id, 25.0002, 121, 10, 'nEW  yOrK');
  perform pg_temp.require_ok(opened->>'message' = 'Sealed test letter' and not (opened ? 'lock_answer')
    and exists (select 1 from public.capsules c where c.id = capsule_id and c.recipient = finder_id
      and opened_at is not null and opened_lat = 25.0002 and opened_lng = 121 and opened_distance_m = 22),
    'opening content and Inbox location');
  perform set_config('request.jwt.claim.sub', other_id::text, true);
  perform pg_temp.expect_error(format('select public.rack_open(%L,%s,%L)', capsule_id, origin, 'New York'), 'taken');

  perform set_config('request.jwt.claim.sub', finder_id::text, true);
  -- Second report uses the same queue, without a new report by the first reporter.
  select (public.rack_leave(post_id, 25, 121, 10, 'Another letter', '', 1)->>'capsule_id')::uuid into legacy_id;
  update public.capsules c set open_at = now() - interval '1 minute' where c.id = legacy_id;
  perform set_config('request.jwt.claim.sub', other_id::text, true);
  perform public.rack_open(legacy_id, 25, 121, 10);
  perform public.public_capsule_report(legacy_id, 'spam');
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.admin_queue_resolve('public_capsule_report', legacy_id::text, 'remove', null);
  perform pg_temp.require_ok(exists (select 1 from public.capsules c where c.id = legacy_id
    and c.recipient is null and c.opened_at is not null), 'queue Remove preserves opening and revokes Inbox');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  removal := public.admin_rack_remove(capsule_id, 'Remove opened');
  perform pg_temp.expect_error(format('select public.admin_undo(%s)', removal->>'action_id'), 'not_undoable');
  perform set_config('request.jwt.claim.sub', finder_id::text, true);
  perform pg_temp.expect_error(format('select * from public.open_capsule(%L)', capsule_id), 'capsule not found');

  -- A capsule claimed by the old pickup RPC can have an Inbox recipient
  -- while still sealed and located at a retired point.
  insert into public.capsules (sender, recipient, vessel, open_at, is_public, public_capsule_drop_place)
  select sender_id, finder_id, 'tin', now(), true, d.id
  from private.public_capsule_drop_places d limit 1 returning id into legacy_id;
  if legacy_id is not null then
    perform public.public_capsule_report(legacy_id, 'other');
    perform set_config('request.jwt.claim.sub', moderator_id::text, true);
    perform public.admin_queue_resolve('public_capsule_report', legacy_id::text, 'remove', null);
    perform pg_temp.require_ok(exists (select 1 from public.capsules c where c.id = legacy_id
      and c.recipient is null and c.rack_removed_at is not null), 'legacy claimed and sealed removal');
  end if;

  perform set_config('request.jwt.claim.sub', sender_id::text, true);
  select d.id into legacy_id from public.sea_throw('Legacy letter', '', 'tin', 1, 25, 121, 10) d;
  perform pg_temp.require_ok(exists (select 1 from public.capsules c where c.id = legacy_id
    and c.vessel = 'bottle' and c.public_capsule_spot = post_id), 'legacy nearest rack and vessel');
  perform pg_temp.require_ok(not exists (select 1 from public.sea_nearby(25,121,10))
    and not exists (select 1 from public.public_capsule_nearby(25,121,10)), 'empty legacy pins');
  perform pg_temp.expect_error('select public.public_capsule_drop(''Letter'', '''', ''tin'', 1, 0, 0, 10)', 'no_shore');
  perform pg_temp.expect_error(format('select public.sea_pick_up(%L,%s)', legacy_id, origin), 'not_allowed');
  perform pg_temp.expect_error(format('select public.sea_return(%L)', legacy_id), 'not_allowed');
  update public.public_capsule_spots set hidden_at = now() where id = post_id;
  perform pg_temp.require_ok((public.waypost_rack(post_id)->>'count')::integer = 0, 'hidden Waypost has no player rack');

  perform pg_temp.require_ok((select relrowsecurity from pg_class where oid = 'public.capsule_contents'::regclass)
    and not has_column_privilege('anon','public.capsule_contents','lock_answer','select')
    and not has_function_privilege('anon','public.waypost_rack(uuid,text,jsonb)','execute')
    and not has_function_privilege('anon','public.rack_leave(uuid,double precision,double precision,double precision,text,text,integer,text,text)','execute')
    and not has_function_privilege('anon','public.rack_open(uuid,double precision,double precision,double precision,text)','execute')
    and not has_function_privilege('authenticated','private.text_allowed(text)','execute')
    and not has_table_privilege('authenticated','private.blocked_words','select')
    and to_regclass('private.public_capsule_drop_places') is not null
    and to_regclass('private.public_capsule_points') is null, 'RLS, grants and retained drop-place table');
  execute 'set local role authenticated';
  perform pg_temp.expect_error('select lock_answer from public.capsule_contents', 'permission denied for table capsule_contents');
  execute 'reset role';
end;
$$;
