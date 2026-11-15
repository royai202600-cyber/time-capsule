-- Run after the migration body in a transaction that will roll back.
insert into auth.users (id, email)
select ('aec11000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'admin-a1-rollback-' || i || '@example.invalid' from generate_series(1, 7) i;
insert into public.profiles (id, name)
select id, split_part(email, '@', 1) from auth.users where email like 'admin-a1-rollback-%@example.invalid'
on conflict (id) do update set name = excluded.name;

insert into public.capsules (id, sender, recipient, vessel, hint, open_at, is_public, public_capsule_spot)
values
  ('aec11000-0000-4000-8001-000000000001', 'aec11000-0000-4000-8000-000000000001', null,
   'tin', 'A1 reported', now() - interval '1 minute', true,
   (select id from public.public_capsule_spots where city_en = 'Taipei' order by id limit 1)),
  ('aec11000-0000-4000-8001-000000000002', 'aec11000-0000-4000-8000-000000000001',
   'aec11000-0000-4000-8000-000000000002', 'tin', 'A1 private', now() + interval '1 day', false, null),
  ('aec11000-0000-4000-8001-000000000003', 'aec11000-0000-4000-8000-000000000001', null,
   'tin', 'A1 unreported', now() - interval '1 minute', true,
   (select id from public.public_capsule_spots where city_en = 'Taipei' order by id limit 1));
insert into public.capsule_contents (capsule_id, message) values
  ('aec11000-0000-4000-8001-000000000001', 'A1 REPORTED PUBLIC PREVIEW'),
  ('aec11000-0000-4000-8001-000000000002', 'A1 SEALED PRIVATE LETTER'),
  ('aec11000-0000-4000-8001-000000000003', 'A1 UNREPORTED PUBLIC LETTER');
insert into public.public_capsule_reports (capsule_id, reporter, reason)
values ('aec11000-0000-4000-8001-000000000001', 'aec11000-0000-4000-8000-000000000002', 'spam'),
       ('aec11000-0000-4000-8001-000000000001', 'aec11000-0000-4000-8000-000000000003', 'personal'),
       -- Even a stray report must never expose a private letter.
       ('aec11000-0000-4000-8001-000000000002', 'aec11000-0000-4000-8000-000000000002', 'personal');

insert into public.hunts (id, name_zh, name_en, starts_at, ends_at, kind, owner, join_code, description, hidden_at)
values ('admin-a1-rollback', 'A1 hunt', 'A1 hunt', now() - interval '1 day', now() + interval '1 day',
  'private', 'aec11000-0000-4000-8000-000000000001', 'A7ACD9', 'A1 HUNT PREVIEW', now());
insert into private.private_hunt_reports (hunt_id, reporter)
values ('admin-a1-rollback', 'aec11000-0000-4000-8000-000000000002'),
       ('admin-a1-rollback', 'aec11000-0000-4000-8000-000000000003');
insert into public.private_hunt_quests (hunt_id, ordinal, location_lat, location_lng, name, quest_type, points)
values ('admin-a1-rollback', 1, 25.033, 121.565, 'Test quest', 'arrive', 10);
insert into public.private_hunt_members (hunt_id, user_id, joined_at, started_at)
values ('admin-a1-rollback', 'aec11000-0000-4000-8000-000000000004', now(), now());

-- Helper executes SQL under the caller's role and verifies the exact message.
create function pg_temp.admin_expect(p_sql text, p_error text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_error then return; end if;
    raise exception 'expected % from %, got %', p_error, p_sql, sqlerrm;
  end;
  raise exception 'expected % from %, got success', p_error, p_sql;
end;
$$;

do $$
declare
  api record;
begin
  for api in select p.oid, p.proname from pg_proc p join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public' and p.proname like 'admin\_%' escape '\'
  loop
    if not has_function_privilege('authenticated', api.oid, 'EXECUTE')
      or has_function_privilege('anon', api.oid, 'EXECUTE')
      or has_function_privilege('service_role', api.oid, 'EXECUTE')
    then raise exception 'unexpected grants on %', api.proname; end if;
  end loop;
  perform pg_temp.admin_expect('delete from private.admin_actions', 'append_only');
  perform pg_temp.admin_expect('truncate private.admin_actions', 'append_only');
  perform pg_temp.admin_expect('update private.admin_actions set note = null', 'append_only');
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aec11000-0000-4000-8000-000000000007', true);

do $$
declare
  call_sql text;
begin
  if public.admin_me() is not null then raise exception 'non-member returned a role'; end if;
  foreach call_sql in array array[
    'select public.admin_members_list()', 'select public.admin_member_add(null, null)',
    'select public.admin_member_set_role(null, null)', 'select public.admin_member_remove(null)',
    'select public.admin_cities()', 'select public.admin_city_map(null)', 'select public.admin_spawning()',
    'select public.admin_queue(null)', 'select public.admin_queue_resolve(null, null, null, null)',
    'select public.admin_activity(null, null)'
  ] loop
    perform pg_temp.admin_expect(call_sql, 'forbidden');
  end loop;
end;
$$;

select set_config('request.jwt.claim.sub', '1fd214ef-4de5-4b4f-81bc-77c3328441fe', true);
do $$
declare
  roy constant uuid := '1fd214ef-4de5-4b4f-81bc-77c3328441fe';
  target constant uuid := 'aec11000-0000-4000-8000-000000000005';
  starting_actions integer := jsonb_array_length(public.admin_activity(100, null));
begin
  if public.admin_me()->>'role' is distinct from 'owner' then raise exception 'owner not seeded'; end if;
  perform pg_temp.admin_expect(format('select public.admin_member_remove(%L)', roy), 'last_owner');
  perform pg_temp.admin_expect(format('select public.admin_member_set_role(%L, %L)', roy, 'viewer'), 'last_owner');
  perform pg_temp.admin_expect('select public.admin_member_add(''missing-admin-a1@example.invalid'', ''viewer'')', 'not_found');
  perform public.admin_member_add(' ADMIN-A1-ROLLBACK-2@example.invalid ', 'admin');
  perform public.admin_member_add('admin-a1-rollback-3@example.invalid', 'moderator');
  perform public.admin_member_add('admin-a1-rollback-4@example.invalid', 'viewer');
  perform public.admin_member_add('admin-a1-rollback-5@example.invalid', 'viewer');
  perform pg_temp.admin_expect('select public.admin_member_add(''admin-a1-rollback-4@example.invalid'', ''viewer'')', 'already_member');
  perform public.admin_member_set_role(target, 'owner');
  if not (public.admin_members_list() @> jsonb_build_array(jsonb_build_object('id', target, 'role', 'owner'))) then
    raise exception 'role was not updated';
  end if;
  perform public.admin_member_remove(target);
  perform pg_temp.admin_expect(format('select public.admin_member_remove(%L)', target), 'not_found');
  if jsonb_array_length(public.admin_activity(100, null)) <> starting_actions + 6 then
    raise exception 'membership actions were not logged exactly once';
  end if;
  if jsonb_array_length(public.admin_activity(2, null)) <> 2
    or (public.admin_activity(1, (public.admin_activity(1, null)->0->>'id')::bigint)->0->>'id')::bigint
      >= (public.admin_activity(1, null)->0->>'id')::bigint
  then raise exception 'activity pagination'; end if;
end;
$$;

do $$
declare
  i integer;
  member_role text;
  queue jsonb;
  cities jsonb;
  region_map jsonb;
  spawning jsonb;
begin
  for i in 1..4 loop
    perform set_config('request.jwt.claim.sub', case when i = 1 then '1fd214ef-4de5-4b4f-81bc-77c3328441fe'
      else 'aec11000-0000-4000-8000-' || lpad(i::text, 12, '0') end, true);
    member_role := (array['owner','admin','moderator','viewer'])[i];
    if public.admin_me()->>'role' is distinct from member_role then raise exception 'wrong role: %', member_role; end if;
    cities := public.admin_cities();
    region_map := public.admin_city_map('taipei');
    spawning := public.admin_spawning();
    if jsonb_array_length(cities) <> 4 or jsonb_array_length(region_map->'wave') < 1
      or not (cities @> jsonb_build_array(region_map->'region'))
      or not (spawning->'config' @> '{"wave_minutes":10,"nearby_max":6}'::jsonb)
      or jsonb_array_length(public.admin_activity(10, null)) < 1
    then raise exception 'invalid dashboard payload for %', member_role; end if;
    queue := public.admin_queue('open');
    if not queue @> jsonb_build_array(jsonb_build_object(
      'id', 'aec11000-0000-4000-8001-000000000001', 'hidden', true, 'reports', 2,
      'preview', case when i < 4 then 'A1 REPORTED PUBLIC PREVIEW' end
    )) or queue::text like '%A1 SEALED PRIVATE LETTER%' or queue::text like '%A1 UNREPORTED PUBLIC LETTER%'
    then raise exception 'queue preview/visibility for %', member_role; end if;
    begin
      if exists (select 1 from public.capsule_contents) then raise exception 'direct content read for %', member_role; end if;
    exception when insufficient_privilege then null;
    end;
    if i > 1 then
      perform pg_temp.admin_expect('select public.admin_members_list()', 'forbidden');
      perform pg_temp.admin_expect('select public.admin_member_add(null, ''viewer'')', 'forbidden');
      perform pg_temp.admin_expect('select public.admin_member_set_role(null, ''viewer'')', 'forbidden');
      perform pg_temp.admin_expect('select public.admin_member_remove(null)', 'forbidden');
    end if;
    if i = 4 then
      perform pg_temp.admin_expect(
        'select public.admin_queue_resolve(''hunt_report'', ''admin-a1-rollback'', ''restore'', null)', 'forbidden');
    end if;
  end loop;
end;
$$;

-- Moderator restores the public capsule, removing the previous global hide.
-- A new report reopens the queue, then an admin removes it permanently.
select set_config('request.jwt.claim.sub', 'aec11000-0000-4000-8000-000000000003', true);
select public.admin_queue_resolve('public_capsule_report', 'aec11000-0000-4000-8001-000000000001', 'restore', 'A1 restore');
select public.admin_queue_resolve('hunt_report', 'admin-a1-rollback', 'restore', 'A1 hunt restore');

select set_config('request.jwt.claim.sub', 'aec11000-0000-4000-8000-000000000004', true);
select public.private_hunt_report('admin-a1-rollback');
do $$
begin
  if not public.admin_queue('open') @> '[{"id":"admin-a1-rollback","hidden":false,"reports":3}]'
    or not public.admin_queue('done') @> '[{"id":"aec11000-0000-4000-8001-000000000001","decision":"restore","hidden":false}]'
  then raise exception 'restoring reported items failed'; end if;
end;
$$;

reset role;
insert into public.public_capsule_reports (capsule_id, reporter, reason)
values ('aec11000-0000-4000-8001-000000000001', 'aec11000-0000-4000-8000-000000000004', 'other');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aec11000-0000-4000-8000-000000000002', true);
select public.admin_queue_resolve('public_capsule_report', 'aec11000-0000-4000-8001-000000000001', 'remove', 'A1 remove');
select public.admin_queue_resolve('hunt_report', 'admin-a1-rollback', 'remove', 'A1 hunt remove');

do $$
begin
  if not public.admin_queue('done') @> '[
    {"id":"admin-a1-rollback","decision":"remove","hidden":true},
    {"id":"aec11000-0000-4000-8001-000000000001","decision":"remove","hidden":true}
  ]' then raise exception 'removing reported items failed'; end if;
  perform pg_temp.admin_expect(
    'select public.admin_queue_resolve(''hunt_report'', ''admin-a1-rollback'', ''restore'', null)', 'not_found');
end;
$$;
reset role;

do $$
begin
  if (select count(*) from private.admin_actions where action in ('queue.restore', 'queue.remove')) <> 4
    or (select count(*) from public.public_capsule_reports where capsule_id = 'aec11000-0000-4000-8001-000000000001') <> 3
    or not private.public_capsule_is_hidden('aec11000-0000-4000-8001-000000000001')
  then raise exception 'review audit, history or permanence failed'; end if;
end;
$$;
select 'PASS: RPC grants, non-member and four roles, last owner, sealed content, review decisions and audit' as result;
