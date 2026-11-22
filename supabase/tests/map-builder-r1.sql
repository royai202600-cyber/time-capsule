-- Run after the R1 migration body in a single rollback transaction.
create function pg_temp.r1_expect(p_sql text, p_error text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected failure: %', p_error;
exception when others then
  if sqlerrm <> p_error then raise; end if;
end;
$$;

create function pg_temp.r1_user(p_number integer) returns void language sql as $$
  select set_config('request.jwt.claim.sub', 'fb100000-0000-4000-8000-' || lpad(p_number::text,12,'0'), true);
$$;

insert into auth.users(id,email)
select ('fb100000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'map-builder-r1-rollback-' || n || '@example.invalid'
from generate_series(1,5) n;
insert into public.profiles(id,name)
select id,'Map builder R1 test' from auth.users
where id::text like 'fb100000-0000-4000-8000-%' on conflict do nothing;
insert into private.admin_members(user_id,role)
select ('fb100000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,role
from (values (1,'owner'),(2,'admin'),(3,'moderator'),(4,'viewer')) roles(n,role);

-- Fixed comparison vectors produced with npm s2-geometry@1.2.10.
do $$
begin
  assert not exists (
    select 1 from (values
    -- Taipei
    (25.033667, 121.56481, '1/22020111113123123'),
    (25.033767, 121.56496, '1/22020111113123122'),
    (25.033517, 121.56506, '1/22020111113123122'),
    (25.036667, 121.56281, '1/22020111113123232'),
    (25.032167, 121.56751, '1/22020111113120231'),
    (25.031667, 121.56181, '1/22020111113122323'),
    (25.038667, 121.56981, '1/22020111113131203'),
    (25.029667, 121.57081, '1/22020111113121000'),
    -- Hong Kong
    (22.3374255, 114.2629606, '1/22000200020311121'),
    (22.3375255, 114.2631106, '1/22000200020311112'),
    (22.3372755, 114.2632106, '1/22000200020311121'),
    (22.3404255, 114.2609606, '1/22000200020133320'),
    (22.3359255, 114.2656606, '1/22000200020311133'),
    (22.3354255, 114.2599606, '1/22000200020022132'),
    (22.3424255, 114.2679606, '1/22000200020200220'),
    (22.3334255, 114.2689606, '1/22000200020310223'),
    -- Macau
    (22.193683, 113.53989, '1/22000023311313300'),
    (22.193783, 113.54004, '1/22000023311313300'),
    (22.193533, 113.54014, '1/22000023311313233'),
    (22.196683, 113.53789, '1/22000023311302210'),
    (22.192183, 113.54259, '1/22000023311313212'),
    (22.191683, 113.53689, '1/22000023311320322'),
    (22.198683, 113.54489, '1/22000023311303121'),
    (22.189683, 113.54589, '1/22000023311310201'),
    -- Singapore
    (1.286798, 103.854301, '1/20323100302010023'),
    (1.286898, 103.854451, '1/20323100302010023'),
    (1.286648, 103.854551, '1/20323100302010132'),
    (1.289798, 103.852301, '1/20323100303103231'),
    (1.285298, 103.857001, '1/20323100302003003'),
    (1.284798, 103.851301, '1/20323100302010222'),
    (1.291798, 103.859301, '1/20323100303110133'),
    (1.282798, 103.860301, '1/20323100302002020')
    ) expected(lat,lng,token)
    where private.s2_cell17(lat,lng) is distinct from token
  ), 'S2 browser parity';
  assert not exists (select 1 from public.public_capsule_spots p
    where (p.game_enabled or p.hidden_at is not null or p.kind = 'landmark')
      and p.s2_cell17 is distinct from private.s2_cell17(p.lat,p.lng)), 'Waypost and Landmark backfill';

  assert (select count(*) from private.game_regions where border is not null) = 4;
  assert not exists (
    select 1 from private.game_regions r join private.game_map_coverage c on c.id = r.coverage_id
    where r.border is not null and (extensions.st_isempty(r.border) or not extensions.st_isvalid(r.border)
      or not extensions.st_coveredby(r.border, extensions.st_makeenvelope(c.west,c.south,c.east,c.north,4326)))
  ), 'valid borders stay inside their coverage rectangles';

  assert (select public and file_size_limit = 2097152 and allowed_mime_types = array['image/jpeg','image/webp']
    from storage.buckets where id = 'waypost-photos'), 'public photo bucket configuration';
  assert not has_function_privilege('anon','public.admin_waypost_stats(uuid)','execute');
  assert not has_function_privilege('service_role','public.admin_spot_move(uuid,double precision,double precision,text)','execute');
  assert has_function_privilege('authenticated','public.admin_spot_add(text,double precision,double precision,text,text)','execute');
end;
$$;

-- Rows below are synthetic metadata only. The real JWT test uses Storage.
set local storage.allow_delete_query = 'true';
set local role authenticated;
do $$
declare
  path constant text := 'taipei/fb100000-0000-4000-8000-000000000011.webp';
  query text;
  deleted bigint;
begin
  for i in 1..5 loop
    perform pg_temp.r1_user(i);
    if i <= 4 then
      assert jsonb_array_length(public.admin_cities()) = 4;
      assert public.admin_city_map('taipei')->'region'->'border'->>'type' = 'MultiPolygon';
      assert (public.admin_waypost_check('taipei',25.033667,121.564810)->>'inside_border')::boolean;
    else
      perform pg_temp.r1_expect('select public.admin_cities()', 'forbidden');
      perform pg_temp.r1_expect('select public.admin_city_map(''taipei'')', 'forbidden');
      perform pg_temp.r1_expect('select public.admin_waypost_stats(null)', 'forbidden');
      perform pg_temp.r1_expect('select public.admin_waypost_check(''taipei'',25.033667,121.564810)', 'forbidden');
    end if;

    if i <= 2 then
      insert into storage.objects (bucket_id,name) values ('waypost-photos',path);
      delete from storage.objects where bucket_id = 'waypost-photos' and name = path;
      get diagnostics deleted = row_count;
      assert deleted = 1;
    else
      foreach query in array array[
        'select public.admin_spot_add(null,null,null,null)',
        'select public.admin_spot_move(null,null,null)',
        'select public.admin_waypost_add(null,null,null,null,null,null)',
        'select public.admin_waypost_update(null)',
        'select public.admin_undo(null)'
      ] loop perform pg_temp.r1_expect(query,'forbidden'); end loop;
      perform pg_temp.r1_expect(format('insert into storage.objects (bucket_id,name) values (%L,%L)',
        'waypost-photos',path),'new row violates row-level security policy for table "objects"');
    end if;
  end loop;

  perform pg_temp.r1_user(1);
  insert into storage.objects (bucket_id,name) values ('waypost-photos',path);
  perform pg_temp.r1_user(4);
  delete from storage.objects where bucket_id = 'waypost-photos' and name = path;
  get diagnostics deleted = row_count;
  assert deleted = 0;
end;
$$;
reset role;

do $$
declare
  point record;
  editor constant uuid := 'fb100000-0000-4000-8000-000000000002';
  player constant uuid := 'fb100000-0000-4000-8000-000000000005';
  photo constant text := 'taipei/fb100000-0000-4000-8000-000000000011.webp';
  wrong_region constant text := 'macau/fb100000-0000-4000-8000-000000000012.jpg';
  newer constant text := 'taipei/fb100000-0000-4000-8000-000000000013.jpg';
  lat constant float8 := 25.033667;
  lng constant float8 := 121.564810;
  prior_id bigint;
  latest_id bigint;
  post uuid;
  post2 uuid;
  spot uuid;
  cap uuid;
  result jsonb;
  original jsonb;
  legacy jsonb;
  current_wave bigint;
begin
  perform pg_temp.r1_user(2);
  insert into storage.objects (bucket_id,name) values ('waypost-photos',wrong_region),('waypost-photos',newer);
  for point in select * from (values
    ('taipei',25.0127,121.5154), -- towards Yonghe, inside tile bounds
    ('taipei',25.0051,121.5130), -- towards Zhonghe, inside tile bounds
    ('taipei',24.9970,121.6040), -- southeast, inside tile bounds
    ('taipei',24.9880,121.5450), -- Taipei City, just south of tile coverage
    ('hong-kong',22.3501,114.1800),
    ('macau',22.2280,113.5500), -- inside tile bounds but beyond the SAR
    ('singapore',1.3380,103.8500)
  ) p(region,lat,lng)
  loop
    result := public.admin_waypost_check(point.region,point.lat,point.lng);
    assert result @> '{"inside_border":false,"inside_coverage":false}', point::text;
    perform pg_temp.r1_expect(format('select public.admin_waypost_add(%L,%L,%L,%L,%L,%L)',
      point.region,point.lat,point.lng,'測試','Test','park'),'outside_border');
    perform pg_temp.r1_expect(format('select public.admin_spot_add(%L,%L,%L,%L)',
      point.region,point.lat,point.lng,'park'),'outside_border');
  end loop;
  assert private.admin_inside_border('taipei',24.988493,121.5820), 'southern coverage edge belongs to Taipei';
  assert private.admin_inside_border('hong-kong',22.3374255,114.2629606);
  assert private.admin_inside_border('macau',22.193683,113.539890);
  assert private.admin_inside_border('singapore',1.286798,103.854301);

  perform pg_temp.r1_expect(format('select public.admin_waypost_add(%L,%L,%L,%L,%L,%L,p_photo=>%L)',
    'taipei',lat,lng,'測試','Test','park',wrong_region),'bad_photo');
  perform pg_temp.r1_expect(format('select public.admin_waypost_add(%L,%L,%L,%L,%L,%L,p_photo=>%L)',
    'taipei',lat,lng,'測試','Test','park','taipei/fb100000-0000-4000-8000-000000000014.webp'),'bad_photo');
  perform pg_temp.r1_expect(format('select public.admin_waypost_add(%L,%L,%L,%L,%L,%L,p_photo=>%L)',
    'taipei',lat,lng,'測試','Test','park','https://example.invalid/test.webp'),'bad_photo');

  post := (public.admin_waypost_add('taipei',lat,lng,'測試','R1 test','park',false,
    p_photo=>photo,p_photo_credit=>'Fixture credit')->>'id')::uuid;
  assert (select count(*) from private.admin_actions where target_id=post::text) = 1;
  select id into strict prior_id from private.admin_actions where target_id=post::text;
  result := public.admin_waypost_check('taipei',lat,lng,post);
  assert result @> '{"inside_border":true}';
  assert not (result->'same_cell' @> jsonb_build_array(jsonb_build_object('id',post)));
  assert exists (select 1 from jsonb_array_elements(result->'same_cell') w
    join public.public_capsule_spots p on p.id = (w->>'id')::uuid
    where p.kind = 'landmark' and w ?& array['meters','name_zh','name_en']);
  assert jsonb_typeof(result->'live_hunts') = 'array';

  perform pg_temp.r1_user(1);
  post2 := (public.admin_waypost_add('taipei',lat,lng,'測試',null,'park')->>'id')::uuid;
  assert (public.admin_waypost_check('taipei',lat,lng,post2)->'same_cell') @>
    jsonb_build_array(jsonb_build_object('id',post,'meters',0));
  select id into strict latest_id from private.admin_actions where target_id=post2::text;
  result := public.admin_undo(latest_id);
  assert (result->>'game_enabled')::boolean = false and result->>'hidden_at' is not null;
  assert not (public.admin_waypost_check('taipei',lat,lng)->'same_cell' @>
    jsonb_build_array(jsonb_build_object('id',post2)));

  perform pg_temp.r1_user(2);
  perform pg_temp.r1_expect(format('select public.admin_waypost_update(%L,25.0127,121.5154)',post),'outside_border');
  result := public.admin_waypost_update(post,p_photo=>newer,p_photo_credit=>null);
  assert result->>'photo' = newer and result->>'photo_credit' = 'Fixture credit';
  result := public.admin_waypost_update(post,p_photo=>'',p_photo_credit=>'');
  assert result @> '{"photo":null,"photo_credit":null}';
  select max(id) into latest_id from private.admin_actions where target_id=post::text;
  perform pg_temp.r1_expect(format('select public.admin_undo(%s)',prior_id),'stale');
  result := public.admin_undo(latest_id);
  assert result->>'photo' = newer and result->>'photo_credit' = 'Fixture credit';

  original := public.admin_spot_add('taipei',lat,lng,'square');
  spot := (original->>'id')::uuid;
  current_wave := (select wave from private.game_wave_at(clock_timestamp()));
  assert original->>'source_ref' = 'admin:'||spot and original->>'timezone' = 'Asia/Taipei';
  assert (original->>'first_spawn_wave')::bigint > current_wave - 1;
  assert not exists (select 1 from private.resolve_spawn(spot,(original->>'first_spawn_wave')::bigint - 1));
  perform pg_temp.r1_expect(format('select public.admin_spot_move(%L,24.997,121.604)',spot),'outside_border');
  result := public.admin_spot_move(spot,25.034,121.5649,'Move fixture');
  assert result->>'lat' = '25.034';
  select max(id), min(id) into latest_id, prior_id from private.admin_actions where target_id=spot::text;
  perform pg_temp.r1_expect(format('select public.admin_undo(%s)',prior_id),'stale');
  assert public.admin_undo(latest_id) = original;
  perform pg_temp.r1_expect(format('select public.admin_undo(%s)',latest_id),'stale');
  assert (public.admin_city_map('taipei')->'spots') @> jsonb_build_array(jsonb_build_object('id',spot,'lat',lat));
  spot := (public.admin_spot_add('taipei',lat,lng,'park')->>'id')::uuid;
  select id into strict latest_id from private.admin_actions where target_id=spot::text;
  assert public.admin_undo(latest_id)->>'hidden_at' is not null;

  -- Compare the admin rack count and stats against real spin and rack records.
  insert into public.waypost_spins(user_id,waypost_id,spun_at,wax_awarded,gold_awarded)
    values (player,post,now()-interval '15 days',10,0);
  insert into private.waypost_xp(waypost_id,xp) values (post,100);
  cap := (public.rack_leave(post,lat,lng,10,'R1 fixture','',1)->>'capsule_id')::uuid;
  result := public.admin_waypost_stats(post);
  assert result @> '{"total_spins":1,"level":2,"xp":100,"rack_count":1}', result::text;
  assert (result->>'last_spin_at')::timestamptz = now()-interval '15 days';
  assert public.waypost_rack(post)->>'photo' = newer;
  update public.capsules set rack_removed_at=now() where id=cap;
  assert (public.admin_waypost_stats(post)->>'rack_count')::integer = 0;

  -- S2 and photo columns were absent from Activity snapshots before R1.
  select to_jsonb(p) - array['s2_cell17','photo','photo_credit'] into legacy
  from public.public_capsule_spots p where p.id=post2;
  perform private.admin_log('waypost.edit','waypost',post2::text,'Legacy fixture',
    legacy || '{"name_en":"Earlier name"}',legacy);
  select max(id) into latest_id from private.admin_actions where target_id=post2::text and actor=editor;
  assert public.admin_undo(latest_id)->>'name_en' = 'Earlier name';
end;
$$;

do $$
declare city record;
begin
  perform pg_temp.r1_user(4);
  for city in select g.* from private.game_regions g where g.border is not null loop
    assert (select value->>'cells_used' from jsonb_array_elements(public.admin_cities())
      where value->>'id'=city.id)::integer = (select count(distinct p.s2_cell17)
      from public.public_capsule_spots p where p.city_en=city.city and p.game_enabled and p.hidden_at is null);
    assert (public.admin_city_map(city.id)->'region'->>'idle_14d')::integer = (
      select count(*) from public.public_capsule_spots p where p.city_en=city.city and p.kind='common'
        and p.game_enabled and p.hidden_at is null and not exists (select 1 from public.waypost_spins s
          where s.waypost_id=p.id and s.spun_at>=now()-interval '14 days'));
    assert (public.admin_city_map(city.id)->'region'->'border') is not null;
  end loop;
end;
$$;

-- Give both route validation and spawn creation a pool that needs a water spot.
-- The only such spot is staged for the next wave.
do $$
declare
  spot_id constant uuid := 'fb100000-0000-4000-8000-000000000021';
  wave record;
  rule private.quest_rules;
begin
  select * into wave from private.game_wave_at(now());
  rule.location_lat := 25.033667;
  rule.location_lng := 121.564810;

  update public.corrupted_spots set hidden_at = now()
  where city = 'Taipei' and public.distance_m(lat,lng,rule.location_lat,rule.location_lng) <=
    (select action_radius_m from private.game_config where singleton);
  update private.game_spawn_revisions
  set rules = array[row('tin','common','water',null,null,null,null)::private.vessel_spawn_rules],
      places = array[row('taipei','tin')::private.vessel_spawn_places]
  where starts_at = (private.game_spawn_at(wave.starts_at)).starts_at;
  insert into public.corrupted_spots (id,city,timezone,lat,lng,habitat,source_ref,first_spawn_wave)
  values (spot_id,'Taipei','Asia/Taipei',rule.location_lat,rule.location_lng,'water','admin:'||spot_id,wave.wave+1);

  perform pg_temp.r1_expect(format('select private.quest_pin_pool(%L::private.quest_rules)',rule),'bad_rule');
  perform pg_temp.r1_expect(format(
    'select private.quest_start_spawns(%L,%L,%L::private.quest_rules,now(),1,now()+interval ''5 minutes'')',
    'route',spot_id,rule),'bad_rule');

  update public.corrupted_spots set first_spawn_wave=wave.wave where id=spot_id;
  assert (private.quest_pin_pool(rule)).common = array['tin'];
  perform pg_temp.r1_user(5);
  perform private.quest_start_spawns('route',spot_id,rule,now(),1,now()+interval '5 minutes');
  assert exists (select 1 from private.quest_spawns where quest_id=spot_id and vessel='tin');
end;
$$;

select 'Map builder R1 rollback checks passed, including 32 browser S2 tokens' as result;
