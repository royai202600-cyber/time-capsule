-- Run after the migration body within a single rollback transaction.
insert into auth.users(id,email)
select ('afd20000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'admin-phase-two-rollback-' || n || '@example.invalid'
from generate_series(1,5) n;
insert into public.profiles(id,name)
select id,'Admin Phase 2 fixture' from auth.users
where email like 'admin-phase-two-rollback-%@example.invalid' on conflict (id) do nothing;
insert into private.admin_members(user_id,role)
select ('afd20000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,role
from (values (1,'owner'),(2,'admin'),(3,'moderator'),(4,'viewer')) m(n,role);

create function pg_temp.a2_user(p_number integer) returns void language sql as $$
  select set_config('request.jwt.claim.sub', 'afd20000-0000-4000-8000-' || lpad(p_number::text,12,'0'), true);
$$;
create function pg_temp.a2_expect(p_query text, p_error text) returns void language plpgsql as $$
begin
  begin execute p_query;
  exception when others then
    if sqlerrm = p_error then return; end if;
    raise exception 'expected %, got % from %', p_error, sqlerrm, p_query;
  end;
  raise exception 'expected % but succeeded: %', p_error, p_query;
end;
$$;

set local role authenticated;
do $$
declare q text;
begin
  for i in 3..5 loop
    perform pg_temp.a2_user(i);
    foreach q in array array[
      'select public.admin_waypost_add(null,null,null,null,null,null,false)',
      'select public.admin_waypost_update(null)',
      'select public.admin_waypost_set_visible(null,false)',
      'select public.admin_spot_set_visible(null,false)',
      'select public.admin_spawn_place_add(null,null)',
      'select public.admin_spawn_place_remove(null,null)',
      'select public.admin_spawn_rule_set(null,null,null,null,null,null,null)',
      'select public.admin_wave_config_set(null,null,null,null,null)',
      'select public.admin_wave_length_set(null)',
      'select public.admin_spawn_preview(null)',
      'select public.admin_undo(null)'
    ] loop perform pg_temp.a2_expect(q,'forbidden'); end loop;
    if i = 5 then
      perform pg_temp.a2_expect('select public.admin_waypost_check(null,null,null)','forbidden');
    else
      perform public.admin_waypost_check('taipei',25.038,121.564);
    end if;
  end loop;
end;
$$;
reset role;

do $$
declare post uuid;
declare point_id uuid := 'afd20000-0000-4000-8000-000000000099';
declare landmark uuid;
declare cap uuid;
declare after_hide uuid;
declare history bigint;
declare latest bigint;
declare earliest bigint;
declare rule_id text;
declare saved jsonb;
declare baseline jsonb;
declare proposed jsonb;
declare audit_count bigint;
declare pending_effective timestamptz;
declare previous record;
declare next_wave record;
declare preview_ms double precision;
declare clock_started timestamptz;
begin
  perform pg_temp.a2_user(2);
  if has_function_privilege('anon','public.admin_wave_length_set(integer,text)','EXECUTE')
    or has_function_privilege('service_role','public.admin_wave_length_set(integer,text)','EXECUTE')
  then raise exception 'RPC grant leaked'; end if;
  perform pg_temp.a2_expect($q$select public.admin_waypost_add('taipei',25.058,121.5207,'測試','Test','park',false)$q$,'not_checked');
  perform pg_temp.a2_expect($q$select public.admin_waypost_add('taipei',0,0,'測試','Test','park',true)$q$,'outside_coverage');
  perform pg_temp.a2_expect($q$select public.admin_waypost_add('taipei',25.058,121.5207,'Latin','Test','park',true)$q$,'bad_name');
  perform pg_temp.a2_expect($q$select public.admin_waypost_add('taipei',25.058,121.5207,'測試','Test','road',true)$q$,'bad_scene');
  perform pg_temp.a2_expect($q$select public.admin_waypost_add('taipei',25.0375,121.5628,'測試','Test','park',true)$q$,'too_close');
  perform pg_temp.a2_expect('select public.admin_waypost_set_visible(null,null)','bad_visibility');
  perform pg_temp.a2_expect('select public.admin_waypost_update(null)','not_found');
  perform pg_temp.a2_expect('select public.admin_spot_set_visible(null,true)','not_found');
  select p.id into landmark from public.public_capsule_spots p where p.kind='landmark' limit 1;
  perform pg_temp.a2_expect(format('select public.admin_waypost_update(%L)',landmark),'landmark');
  perform pg_temp.a2_expect(format('select public.admin_waypost_set_visible(%L,false)',landmark),'landmark');

  if (public.admin_waypost_check('taipei',25.0375,121.5628)->'nearest'->>'meters')::float8 >= 250
  then raise exception 'missing close-waypost warning'; end if;
  post := (public.admin_waypost_add('taipei',25.0375,121.5628,'測試','Close override','park',true,'verified override')->>'id')::uuid;
  select id into latest from private.admin_actions where target_id=post::text order by id desc limit 1;
  saved := public.admin_undo(latest,'undo add preserves the row');
  if saved->>'hidden_at' is null or (saved->>'game_enabled')::boolean
  then raise exception 'undo add did not hide retained Waypost'; end if;

  post := (public.admin_waypost_add('taipei',25.058,121.5207,'測試','Test Waypost','park',true,'fixture')->>'id')::uuid;
  select id into earliest from private.admin_actions where target_id=post::text order by id desc limit 1;
  perform pg_temp.a2_expect(format('select public.admin_waypost_update(%L,0,0)',post),'outside_coverage');
  perform public.admin_waypost_update(post,p_name_en=>'Edited Waypost');
  select id into latest from private.admin_actions where target_id=post::text order by id desc limit 1;
  perform pg_temp.a2_expect(format('select public.admin_undo(%s)',earliest),'stale');
  if public.admin_undo(latest)->>'name_en' <> 'Test Waypost' then raise exception 'undo edit failed'; end if;

  update public.hunts set area_lat=25.058,area_lng=121.5207,area_radius_m=10,
    starts_at=now()-interval '1 day',ends_at=now()+interval '1 day',hidden_at=null,status='published'
  where id='xinyi-2026-11';
  if not found then raise exception 'missing Xinyi hunt fixture'; end if;
  if jsonb_array_length(public.admin_waypost_check('taipei',25.058,121.5207,post)->'live_hunts') = 0
  then raise exception 'missing live-hunt warning'; end if;
  perform pg_temp.a2_expect(format('select public.admin_waypost_set_visible(%L,false)',post),'hunt_needs_wayposts');
  perform pg_temp.a2_expect(format('select public.admin_waypost_update(%L,25.061,121.5207,p_note=>%L)',post,'fixture'),
    'hunt_needs_wayposts');
  update public.hunts set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day'
    where id='xinyi-2026-11';

  perform pg_temp.a2_user(1);
  select id into cap from public.public_capsule_drop('Waypost test','','tin',1,25.058,121.5207,10);
  if (select public_capsule_spot from public.capsules where id=cap) is distinct from post
  then raise exception 'visible Waypost not used for a new drop'; end if;
  perform public.admin_waypost_set_visible(post,false);
  select id into after_hide from public.public_capsule_drop('After hide','','tin',1,25.058,121.5207,10);
  if (select public_capsule_spot from public.capsules where id=after_hide) = post
    or exists(select 1 from private.public_capsule_points where id=post and eligible)
  then raise exception 'hidden Waypost remained in pool'; end if;
  if not exists (select 1 from jsonb_array_elements(public.admin_city_map('taipei')->'wayposts') j
    where j->>'id'=post::text and j->>'hidden_at' is not null)
  then raise exception 'hidden Waypost missing from admin map'; end if;
  select id into latest from private.admin_actions where target_id=post::text order by id desc limit 1;
  if not (public.admin_undo(latest)->>'game_enabled')::boolean then raise exception 'undo hide failed'; end if;
  perform public.admin_waypost_set_visible(post,false);
  perform public.admin_waypost_set_visible(post,true);

  insert into public.corrupted_spots(id,city,timezone,lat,lng,habitat,source_ref)
  values (point_id,'Taipei','Asia/Taipei',25.058,121.5215,'park','fixture:admin-phase-two');
  select id into cap from public.public_capsule_drop('Corrupted spot test','','tin',1,25.058,121.5215,10);
  if (select corrupted_drop_spot from public.capsules where id=cap) is distinct from point_id
    or not exists (select 1 from private.admin_wave('Taipei') where spot=point_id)
  then raise exception 'visible spot not used for a new drop and wave'; end if;
  perform public.admin_spot_set_visible(point_id,false);
  select id into after_hide from public.public_capsule_drop('After spot hide','','tin',1,25.058,121.5215,10);
  if (select corrupted_drop_spot from public.capsules where id=after_hide) = point_id
    or exists(select 1 from private.public_capsule_points where id=point_id and eligible)
    or exists(select 1 from private.admin_wave('Taipei') where spot=point_id)
  then raise exception 'hidden spot still spawning or taking drops'; end if;
  if not exists (select 1 from jsonb_array_elements(public.admin_city_map('taipei')->'spots') j
    where j->>'id'=point_id::text and j->>'hidden_at' is not null)
  then raise exception 'hidden spot missing from admin map'; end if;
  select id into latest from private.admin_actions where target_id=point_id::text order by id desc limit 1;
  perform pg_temp.a2_expect(format('select public.admin_undo(%s)',latest),'not_undoable');
  update public.capsules set open_at=now()-interval '1 minute' where id=cap;
  perform pg_temp.a2_user(5);
  perform public.public_capsule_pick_up(cap,25.058,121.5215,10);
  perform public.open_capsule(cap);
  perform public.public_capsule_return(cap);
  if not exists (
    select 1 from public.capsules c join private.public_capsule_points p
      on p.id = coalesce(c.public_capsule_spot,c.corrupted_drop_spot,c.public_capsule_drop_place)
    where c.id=cap and p.eligible and p.city_en='Taipei'
      and public.distance_m(25.058,121.5215,p.lat,p.lng)>=1000)
  then raise exception 'pass-on used an ineligible point'; end if;
  perform pg_temp.a2_user(1);
  perform public.admin_spot_set_visible(point_id,true);

  perform pg_temp.a2_expect($q$select public.admin_spawn_place_add('taipei','tin')$q$,'not_spawnable');
  perform pg_temp.a2_expect($q$select public.admin_spawn_place_add('invalid-region','bubble-tea')$q$,'not_found');
  select vessel into rule_id from private.vessel_spawn_places where region_id='hong-kong' order by vessel limit 1;
  perform pg_temp.a2_expect(format('select public.admin_spawn_place_add(%L,%L)','hong-kong',rule_id),'already_assigned');
  perform pg_temp.a2_expect($q$select public.admin_spawn_rule_set('bubble-tea','common',null,1,null,null,null)$q$,'bad_rule');
  perform pg_temp.a2_expect($q$select public.admin_spawn_rule_set('bubble-tea','common',null,1,2,'02-30','03-01')$q$,'bad_rule');
  perform pg_temp.a2_expect($q$select public.admin_wave_config_set(0.8,0,0,0,6)$q$,'bad_rule');
  perform pg_temp.a2_expect($q$select public.admin_wave_length_set(7)$q$,'bad_rule');
  perform pg_temp.a2_expect($q$select public.admin_spawn_preview('{"call":"admin_waypost_add","args":{}}')$q$,'bad_rule');
  perform pg_temp.a2_expect('select public.admin_undo(-1)','not_found');

  begin
    select count(*)-1 into history from private.vessel_spawn_places where region_id='hong-kong';
    for rule_id in select vessel from private.vessel_spawn_places where region_id='hong-kong' order by vessel limit history
    loop perform public.admin_spawn_place_remove('hong-kong',rule_id); end loop;
    select vessel into rule_id from private.vessel_spawn_places where region_id='hong-kong';
    perform pg_temp.a2_expect(format('select public.admin_spawn_place_remove(%L,%L)','hong-kong',rule_id),'place_needs_vessel');
    raise exception using errcode='PVA02';
  exception when sqlstate 'PVA02' then null;
  end;

  select count(*) into audit_count from private.admin_actions;
  baseline := to_jsonb(private.game_spawn_at('infinity'::timestamptz));
  clock_started := clock_timestamp();
  proposed := public.admin_spawn_preview('{"call":"wave","args":{
    "p_spawn_chance":0.1,"p_common_weight":60,"p_uncommon_weight":30,"p_rare_weight":10,"p_nearby_target":6}}');
  preview_ms := extract(epoch from clock_timestamp()-clock_started)*1000;
  if jsonb_array_length(proposed->'regions') <> 4
    or exists (select 1 from jsonb_array_elements(proposed->'regions') g where g->'before' = g->'after')
    or baseline is distinct from to_jsonb(private.game_spawn_at('infinity'::timestamptz))
    or audit_count <> (select count(*) from private.admin_actions)
  then raise exception 'preview changed state or failed to simulate'; end if;
  perform set_config('test.a2.preview_ms',preview_ms::text,true);

  select a.vessel into rule_id from private.vessel_spawn_places a where a.region_id='hong-kong'
    and not exists (select 1 from private.vessel_spawn_places p where p.region_id='taiwan' and p.vessel=a.vessel)
    order by a.vessel limit 1;
  perform public.admin_spawn_place_add('taiwan',rule_id);
  if not exists (select 1 from private.vessel_spawn_places where region_id='taiwan' and vessel=rule_id)
  then raise exception 'country placement missing'; end if;
  perform public.admin_spawn_place_remove('taiwan',rule_id);
  select id into latest from private.admin_actions where target_type='spawn_place' and target_id='taiwan:'||rule_id
    order by id desc limit 1;
  perform public.admin_undo(latest);
  perform public.admin_spawn_rule_set('bubble-tea','common',null,22,2,'12-29','01-03');
  if (select local_end_hour from private.vessel_spawn_rules where vessel='bubble-tea')<>2
  then raise exception 'exclusive hour end not stored'; end if;
  select id into latest from private.admin_actions where target_type='spawn_rule' and target_id='bubble-tea'
    order by id desc limit 1;
  perform public.admin_undo(latest);

  perform public.admin_wave_config_set(0.25,60,30,10,7);
  select * into previous from private.game_wave_at(now());
  if ((private.game_spawn_at(previous.starts_at)).config).spawn_chance <> 1
    or ((private.game_spawn_at(previous.ends_at)).config).spawn_chance <> 0.25
  then raise exception 'config changed the current wave or failed to change next wave'; end if;
  select id into latest from private.admin_actions where target_type='config' and target_id='wave' order by id desc limit 1;
  perform public.admin_undo(latest);

  pending_effective := public.admin_wave_length_set(15);
  select * into previous from private.game_wave_at(pending_effective-interval '1 second');
  select * into next_wave from private.game_wave_at(pending_effective);
  if previous.minutes <> 10 or next_wave.minutes<>15 or previous.ends_at <> pending_effective
    or next_wave.wave<>previous.wave+1 or previous.ends_at<>next_wave.starts_at
    or mod(extract(epoch from pending_effective),1800)<>0
    or (public.admin_spawning()->'config'->>'wave_minutes')::integer<>10
    or (public.admin_spawning()->'config'->'next_length'->>'minutes')::integer<>15
  then raise exception 'wave transition did not preserve shared boundary and IDs'; end if;
  select id into latest from private.admin_actions where target_type='config' and target_id='wave_length' order by id desc limit 1;
  perform public.admin_undo(latest);
  if exists(select 1 from private.game_wave_periods where starts_at>now())
    or not exists(select 1 from private.admin_actions where action='undo' and after->>'undo_of'=latest::text)
  then raise exception 'undo did not cancel a pending change or log its source'; end if;
end;
$$;

select 'PASS: roles, errors, map and drop visibility, hunt and spawn guards, preview rollback, wave transition, undo' as checks,
  current_setting('test.a2.preview_ms')::float8 as preview_ms;
