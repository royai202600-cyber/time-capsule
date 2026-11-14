-- The hosted rollback runner inserts the migration at the marker below.
begin;

create temporary table guide_upgrade_fixture (
  hunt_id text, member_id uuid, finisher_id uuid, done_quest uuid, next_quest uuid,
  progress jsonb, finished_member jsonb
) on commit drop;

do $$
declare
  player uuid := gen_random_uuid();
  finisher uuid := gen_random_uuid();
  hunt text;
  done_id uuid;
  next_id uuid;
  code text;
begin
  insert into auth.users(id,email) values
    (player,player||'@guide.invalid'),(finisher,finisher||'@guide.invalid');
  insert into public.profiles(id,name,can_create_hunts) values
    (player,'Guide upgrade',true),(finisher,'Guide upgrade finisher',false);
  perform set_config('request.jwt.claim.sub',player::text,true);
  hunt := public.private_hunt_create(jsonb_build_object(
    'name','Guide upgrade','route_mode','any','leaderboard_visible',true,
    'starts_at',now()-interval '15 minutes','ends_at',now()+interval '1 hour','time_limit_min',30
  ))->>'id';
  perform public.private_hunt_quest_save(hunt,jsonb_build_object(
    'name','First','quest_type','arrive','ordinal',1,'points',10,'location_lat',25,'location_lng',121));
  perform public.private_hunt_quest_save(hunt,jsonb_build_object(
    'name','Next','quest_type','puzzle','ordinal',2,'points',20,'location_lat',25,'location_lng',121,
    'puzzle_kind','text','answer','answer'));
  select id into done_id from public.private_hunt_quests where hunt_id=hunt and ordinal=1;
  select id into next_id from public.private_hunt_quests where hunt_id=hunt and ordinal=2;
  code := public.private_hunt_publish(hunt)->>'join_code';
  perform public.private_hunt_join_code(code);
  perform public.private_hunt_quest_complete(done_id,25,121,10,null,null);
  insert into public.private_hunt_quest_progress(hunt_id,quest_id,user_id,tries,wait_until)
    values(hunt,next_id,player,2,now()+interval '30 seconds');
  perform set_config('request.jwt.claim.sub',finisher::text,true);
  perform public.private_hunt_join_code(code);
  perform public.private_hunt_quest_complete(done_id,25,121,10,null,null);
  perform public.private_hunt_quest_complete(next_id,25,121,10,'answer',null);
  assert exists(select 1 from public.my_passport() where place=hunt and how_earned='private_hunt');
  insert into guide_upgrade_fixture select hunt,player,finisher,done_id,next_id,
    (select jsonb_agg(to_jsonb(p) order by p.quest_id) from public.private_hunt_quest_progress p where p.hunt_id=hunt),
    to_jsonb(m)
    from public.private_hunt_members m where m.hunt_id=hunt and m.user_id=finisher;
end $$;

-- INSERT GUIDE MIGRATION HERE

do $$
declare f guide_upgrade_fixture; result jsonb; q jsonb; stage text;
begin
  select * into strict f from guide_upgrade_fixture;
  perform set_config('request.jwt.claim.sub',f.member_id::text,true);
  select h into strict result from jsonb_array_elements(public.private_hunt_joined()) h where h->>'id'=f.hunt_id;
  assert result->>'started_at' is null and result->>'run_started_at' is null and result->>'run_ends_at' is null;
  assert result->>'finished_at' is null and result->>'reward_collected_at' is null;
  assert (result->>'points')::int=10;
  -- The UI's guideStage uses these timestamps; only playing hunts contribute quest pins.
  stage := case when coalesce(result->>'started_at',result->>'run_started_at') is null then 'start' else 'playing' end;
  assert stage='start';
  assert (select count(*) from jsonb_array_elements(result->'quests') pin where stage='playing' and pin->>'location_lat' is not null)=0;
  begin
    perform public.private_hunt_quest_complete(f.next_quest,25,121,10,'answer',null);
    raise exception 'expected not_started';
  exception when raise_exception then if sqlerrm<>'not_started' then raise; end if; end;
  result := public.private_hunt_start(f.hunt_id,25,121,10);
  assert (result->>'started_at')::timestamptz>=now();
  assert result->>'run_started_at'=result->>'started_at' and result->>'run_ends_at' is not null;
  select x into strict q from jsonb_array_elements(result->'quests') x where x->>'id'=f.done_quest::text;
  assert q->>'done_at' is not null and (result->>'points')::int=10;
  assert (select jsonb_agg(to_jsonb(p)-'catch_count' order by p.quest_id)
          from public.private_hunt_quest_progress p where p.hunt_id=f.hunt_id)=f.progress;
  assert (select to_jsonb(m)-'reward_collected_at'=f.finished_member and m.reward_collected_at=m.finished_at
          from public.private_hunt_members m where m.hunt_id=f.hunt_id and m.user_id=f.finisher_id);
  perform set_config('request.jwt.claim.sub',f.finisher_id::text,true);
  assert exists(select 1 from public.my_passport() where place=f.hunt_id and how_earned='private_hunt');
end $$;
select 'legacy guide upgrade assertions passed' as result;

rollback;
