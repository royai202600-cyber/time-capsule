-- Run after loading R2 in a transaction, then roll back.
-- Supply app.seed_monuments from the MONUMENT_SEED export before running.
create function pg_temp.expect_r2_failure(p_query text, p_error text, p_hint text default null)
returns void language plpgsql as $$
declare actual_hint text;
begin
  begin
    execute p_query;
  exception when others then
    get stacked diagnostics actual_hint = pg_exception_hint;
    assert sqlerrm = p_error, format('expected %s, got %s', p_error, sqlerrm);
    assert p_hint is null or p_hint = actual_hint, actual_hint;
    return;
  end;
  raise exception 'unexpected success: %', p_query;
end;
$$;

do $$
declare
  owner_id uuid := gen_random_uuid();
  player_id uuid := gen_random_uuid();
  viewer_id uuid := gen_random_uuid();
  moderator_id uuid := gen_random_uuid();
  east double precision[]; north double precision[];
  lat_now double precision; lng_now double precision;
  seed jsonb := current_setting('app.seed_monuments')::jsonb;
  default_info constant jsonb := '{"monument":null,"vessel":"landmark-keepsake","stamp":"landmark-default","fight_health":40,"fight_seconds":150}';
  shapes constant jsonb := '[
    {"buildings":{"ids":[35184577873359,9223372036854775807],"real_top":26.2,"top":12,"color":"ink"}},
    {"model":{"kind":"tower","size":"m","rotate":0,"color":"light"}},
    {"custom":{"tiers":[[3,0,3],[0,3,6,{"rect":[2,1],"dx":1,"dy":-2}]],"color":"brass"}}
  ]';
  shape jsonb;
  invalid jsonb;
  post jsonb;
  historic jsonb;
  i integer;
  pid uuid;
  empty_id uuid;
  default_id uuid;
  other_id uuid;
  custom_id uuid;
  action_id bigint;
  restore_id bigint;
  rack_id uuid;
  old_attempt record;
  current_attempt record;
  won jsonb;
  result jsonb;
  reward text;
  role_id uuid;
  stamp_first_at timestamptz;
begin
  assert not exists (
    select from public.public_capsule_spots p
    where p.kind='landmark' and (
      p.monument is distinct from seed->p.place or p.landmark_stamp is distinct from coalesce(p.place,'landmark-default')
      or p.fight_health <> 40 or p.fight_seconds <> 150
      or p.landmark_vessel is distinct from
        (select coalesce(max(v.id),'landmark-keepsake') from public.vessels v where v.earned_place=p.place)
    )
  ), 'Landmark backfill differs from the seed or existing earned mapping';
  assert (select count(distinct place) from public.public_capsule_spots where kind='landmark' and seed ? place) = 3;
  assert exists (select from public.vessels where id='landmark-keepsake' and earned_only and earned_place is null
    and brand is null and edition_total is null and unlimited_copies);
  assert not has_function_privilege('anon','public.admin_landmark_set(uuid,jsonb,text)','execute');

  insert into auth.users(id,email)
    select id, 'map-builder-r2-'||id||'@example.invalid' from unnest(array[owner_id,player_id,viewer_id,moderator_id]) id;
  insert into public.profiles(id,name)
    select id,'R2 rollback' from unnest(array[owner_id,player_id,viewer_id,moderator_id]) id on conflict do nothing;
  insert into private.admin_members(user_id,role)
    values (owner_id,'admin'),(viewer_id,'viewer'),(moderator_id,'moderator');

  with points as (
    select distinct on (cell) lat, lng, cell from (
      select 25.062+x*.0006 as lat,121.552+j*.0006 as lng,private.s2_cell17(25.062+x*.0006,121.552+j*.0006) as cell
      from generate_series(-7,7) x cross join generate_series(-7,7) j
      where private.admin_inside_border('taipei',25.062+x*.0006,121.552+j*.0006)
    ) candidates where not exists (select from public.public_capsule_spots w where w.status<>'deleted' and w.s2_cell17=candidates.cell)
    order by cell,lat,lng limit 6
  ) select array_agg(lng order by cell),array_agg(lat order by cell) into east,north from points;
  assert cardinality(east)=6;

  foreach role_id in array array[viewer_id,moderator_id,player_id] loop
    perform set_config('request.jwt.claim.sub',role_id::text,true);
    perform pg_temp.expect_r2_failure('select public.admin_landmark_set(gen_random_uuid(),''{}'')','forbidden');
    perform pg_temp.expect_r2_failure('select public.admin_waypost_add(''taipei'',25,121,''測試'',''test'',''square'',p_kind=>''landmark'')','forbidden');
  end loop;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);

  post := public.admin_waypost_add('taipei',north[1],east[1],'測試地標','R2 default','square',p_kind=>'landmark',p_status=>'draft');
  default_id := (post->>'id')::uuid;
  assert post->>'kind'='landmark' and post->>'status'='draft';
  select w->'landmark' into result from jsonb_array_elements(public.admin_city_map('taipei')->'wayposts') w
    where w->>'id'=default_id::text;
  assert result=default_info, 'Landmark defaults';
  perform pg_temp.expect_r2_failure(format(
    'select public.admin_waypost_add(''taipei'',%L,%L,''測試地標'',''R2 duplicate'',''square'',p_kind=>''landmark'')',
    north[1],east[1]),'cell_taken');
  perform pg_temp.expect_r2_failure(
    'select public.admin_waypost_add(''taipei'',0,0,''測試地標'',''R2 outside'',''square'',p_kind=>''landmark'')','outside_border');
  perform public.admin_place_set_status('waypost',array[default_id],'live');

  for i in 0..2 loop
    shape := shapes->i;
    post := public.admin_waypost_add('taipei',north[i+2],east[i+2],'測試地標','R2 shape '||i,'square',
      p_kind=>'landmark',p_landmark=>jsonb_build_object('monument',shape));
    assert post->'monument'=shape, 'monument did not round-trip';
    if i=0 then other_id := (post->>'id')::uuid; end if;
    if i=2 then custom_id := (post->>'id')::uuid; end if;
  end loop;

  for invalid in select value from jsonb_array_elements('[
    [], {"unexpected":1}, {"buildings":{"ids":[1.1],"real_top":1,"top":1,"color":"ink"}},
    {"buildings":{"ids":[9223372036854775808],"real_top":1,"top":1,"color":"ink"}},
    {"buildings":{"ids":[1],"real_top":0,"top":1,"color":"ink"}},
    {"buildings":{"ids":[1],"real_top":1,"top":61,"color":"ink"}},
    {"model":{"kind":"gate","size":"xl","rotate":0,"color":"ink"}},
    {"model":{"kind":"gate","size":"s","rotate":360,"color":"fish"}},
    {"model":{"kind":"spacecraft","size":"s","rotate":0,"color":"ink"}},
    {"custom":{"tiers":[[1,0,1,{"arc":{"inner":0,"from":0,"to":720}}]],"color":"landmark"}},
    {"custom":{"tiers":[[1,0,1,{"rect":[1,"x"]}]],"color":"landmark"}}
  ]'::jsonb) loop
    perform pg_temp.expect_r2_failure(format('select public.admin_landmark_set(%L,%L)',default_id,
      jsonb_build_object('monument',invalid)),'bad_monument');
  end loop;
  perform pg_temp.expect_r2_failure(format('select public.admin_landmark_set(%L,%L)',default_id,
    '{"vessel":"tin"}'),'bad_vessel');
  perform pg_temp.expect_r2_failure(format('select public.admin_landmark_set(%L,%L)',default_id,
    '{"stamp":"Wrong!"}'),'bad_stamp');
  perform pg_temp.expect_r2_failure(format('select public.admin_landmark_set(%L,%L)',default_id,
    '{"fight_health":10.5}'),'bad_fight');

  post := public.admin_waypost_add('taipei',north[5],east[5],'測試地標','R2 conversion','square');
  empty_id := (post->>'id')::uuid;
  assert post->>'kind'='common';
  -- Emulate an older Activity snapshot that predates the new Landmark columns.
  historic := post - array['monument','landmark_vessel','landmark_stamp','fight_health','fight_seconds'];
  update public.public_capsule_spots set name_en='R2 prior edit' where id=empty_id;
  insert into private.admin_actions(actor, actor_snapshot, action, target_type, target_id, target_label, before, after)
    values (owner_id,private.admin_person(owner_id),'waypost.edit','waypost',empty_id::text,'R2 prior edit',
      historic,historic || '{"name_en":"R2 prior edit"}')
    returning id into restore_id;
  assert public.admin_undo(restore_id)=post, 'legacy Activity Undo failed';
  insert into public.waypost_spins(user_id,waypost_id,wax_awarded,gold_awarded) values (player_id,empty_id,10,0);
  perform set_config('request.jwt.claim.sub',player_id::text,true);
  result := public.rack_leave(empty_id,north[5],east[5],8,'R2 test letter','',1);
  rack_id := (result->>'capsule_id')::uuid;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform pg_temp.expect_r2_failure(format('select public.admin_landmark_set(%L,''{}'')',empty_id),'rack_not_empty');
  update public.capsules set rack_removed_at=now() where id=rack_id;
  action_id := public.admin_landmark_set(empty_id,'{"stamp":"r2-converted"}','R2 conversion test');
  assert exists (select from private.admin_actions where id=action_id and before->>'kind'='common' and after->>'kind'='landmark');
  result := public.admin_undo(action_id);
  assert result=post, 'conversion Undo did not restore the complete Waypost';
  assert exists (select from public.waypost_spins where user_id=player_id and waypost_id=empty_id);

  -- Check move and status Undo on Landmark rows.
  perform public.admin_waypost_update(custom_id,north[6],east[6]);
  select id into restore_id from private.admin_actions where target_id=custom_id::text order by id desc limit 1;
  result := public.admin_undo(restore_id);
  assert (result->>'lat')::double precision=north[4] and (result->>'lng')::double precision=east[4];
  perform public.admin_place_set_status('waypost',array[custom_id],'hidden');
  select id into restore_id from private.admin_actions where target_id=custom_id::text order by id desc limit 1;
  result := public.admin_undo(restore_id);
  assert result->custom_id::text->>'status'='live';

  select id into strict reward from public.vessels where earned_place='hkust';
  perform public.admin_landmark_set(custom_id,jsonb_build_object('monument',shapes->2,
    'vessel',reward,'stamp','r2-custom','fight_health',12,'fight_seconds',90));
  perform public.admin_landmark_set(default_id,'{"fight_health":10}');
  perform public.admin_landmark_set(other_id,'{"fight_health":10,"monument":{"buildings":{"ids":[1],"real_top":2,"top":1,"color":"landmark"}}}');

  perform set_config('request.jwt.claim.sub',player_id::text,true);
  perform pg_temp.expect_r2_failure('select public.acquire_vessel(''landmark-keepsake'')','vessel must be earned','earned_only');
  perform pg_temp.expect_r2_failure(
    'select public.send_capsule(auth.uid(),''landmark-keepsake'',''test'','''',now()+interval ''1 hour'')','vessel not owned','not_owned');
  perform private.track_position(north[4],east[4],8);
  update public.player_game set wax_balls=300,gold_balls=300 where user_id=player_id;
  select * into strict old_attempt from public.landmark_start(custom_id,north[4],east[4],8);
  assert old_attempt.max_health=12 and old_attempt.cracks=12;
  assert (select expires_at-started_at=interval '90 seconds' from public.landmark_attempts where id=old_attempt.attempt_id);

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.admin_landmark_set(custom_id,jsonb_build_object('monument',shapes->2,
    'vessel',reward,'stamp','r2-custom','fight_health',14,'fight_seconds',120));
  perform set_config('request.jwt.claim.sub',player_id::text,true);
  select * into strict current_attempt from public.landmark_start(custom_id,north[4],east[4],8);
  assert (current_attempt.attempt_id,current_attempt.max_health,current_attempt.expires_at)
    is not distinct from (old_attempt.attempt_id,old_attempt.max_health,old_attempt.expires_at);

  -- Age the fixture to satisfy the production throw cadence.
  update public.landmark_attempts set started_at=clock_timestamp()-interval '25 seconds' where id=current_attempt.attempt_id;
  won := public.landmark_finish(current_attempt.attempt_id,'won',12,0,north[4],east[4],8);
  assert won->>'vessel'=reward and won->>'stars'='1' and won->>'is_new'='true' and won->'copies'='null';
  assert public.landmark_finish(current_attempt.attempt_id,'won',12,0,north[4],east[4],8)=won;

  select * into strict current_attempt from public.landmark_start(custom_id,north[4],east[4],8);
  assert current_attempt.max_health=14;
  assert (select expires_at-started_at=interval '120 seconds' from public.landmark_attempts where id=current_attempt.attempt_id);
  for i in 1..14 loop
    select to_jsonb(h) into won from public.landmark_hit(current_attempt.attempt_id,north[4],east[4],8,'gold',1) h;
    exit when won->>'result'='won';
  end loop;
  assert won->>'vessel'=reward and won->>'stars'='2' and won->>'is_new'='false';
  assert (select landmark_copies=2 and copies is null from public.owned_vessels where user_id=player_id and vessel=reward);
  assert (select count(*) from public.my_passport() where landmark=custom_id)=1;
  assert exists (select from public.my_passport() where landmark=custom_id and stamp='r2-custom'
    and name_en='R2 shape 2' and name_zh='測試地標' and how_earned='landmark');
  select first_at into strict stamp_first_at from public.my_passport() where landmark=custom_id;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  action_id := public.admin_landmark_set(custom_id,jsonb_build_object('monument',shapes->2,
    'vessel',reward,'stamp','r2-updated','fight_health',14,'fight_seconds',120));
  perform set_config('request.jwt.claim.sub',player_id::text,true);
  assert (select stamp='r2-updated' and first_at=stamp_first_at
    from public.my_passport() where landmark=custom_id), 'Passport must use the current stamp and original earn time';
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.admin_undo(action_id);
  perform set_config('request.jwt.claim.sub',player_id::text,true);
  assert (select stamp='r2-custom' and first_at=stamp_first_at
    from public.my_passport() where landmark=custom_id), 'Undo must restore the prior stamp art';


  foreach pid in array array[default_id,other_id] loop
    select lat,lng into lat_now,lng_now from public.public_capsule_spots where id=pid;
    select * into strict current_attempt from public.landmark_start(pid,lat_now,lng_now,8);
    update public.landmark_attempts set started_at=clock_timestamp()-interval '25 seconds' where id=current_attempt.attempt_id;
    won := public.landmark_finish(current_attempt.attempt_id,'won',10,0,lat_now,lng_now,8);
    assert won->>'vessel'='landmark-keepsake';
  end loop;
  assert (select count(distinct landmark) from public.my_passport() where stamp='landmark-default')=2;
  assert exists (select from public.my_collection() where vessel='landmark-keepsake' and copies is null and stars=2);
  perform public.send_capsule(auth.uid(),'landmark-keepsake','R2 earned test','',now()+interval '1 hour');

  result := public.game_nearby(north[4],east[4],8);
  assert exists (select from jsonb_array_elements(result->'wayposts') w where w->>'id'=custom_id::text
    and w ? 'place' and w->'monument'=shapes->2 and w->>'vessel'=reward and w->>'stamp'='r2-custom');
  assert exists (select from jsonb_array_elements(result->'wayposts') w where w->>'place'='taipei101');
  result := public.corrupted_nearby(north[4],east[4],8);
  assert exists (select from jsonb_array_elements(result->'wayposts') w where w->>'id'=custom_id::text
    and w ? 'place' and w->'monument'=shapes->2 and w->>'vessel'=reward and w->>'stamp'='r2-custom');
end;
$$;

select 'PASS: R2 seed, writes and Undo, roles, fight configuration, duplicate rewards, stamps, catalogue and old nearby contracts' as result;
