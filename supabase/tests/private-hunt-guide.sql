-- Run inside a transaction; caller rolls back all fixtures.
do $$
declare u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); h text; q uuid; code text; draft jsonb; state jsonb; mode text; spot uuid; started timestamptz;
begin
 insert into auth.users(id,email) values(u,u||'@guide.invalid'),(outsider,outsider||'@guide.invalid');
 insert into public.profiles(id,name,can_create_hunts) values(u,'Guide rollback',true),(outsider,'Outsider',false);
 perform set_config('request.jwt.claim.sub',u::text,true);
 foreach mode in array array['fixed','near'] loop
  draft:=jsonb_build_object('name','Guide rollback','description','','route_mode','any','leaderboard_visible',true,'starts_at',now()-interval '1 hour','ends_at',now()+interval '1 hour','time_limit_min',10,'guide_mode',mode,'guide_lat',case when mode='fixed' then 25 end,'guide_lng',case when mode='fixed' then 121 end);
  h:=public.private_hunt_create(draft)->>'id';
  if mode='near' then assert private.private_hunt_area(h)->>'lat' is null; end if;
  perform public.private_hunt_quest_save(h,jsonb_build_object('name','Arrive','quest_type','arrive','ordinal',1,'points',10,'location_lat',25,'location_lng',121));
  perform public.private_hunt_quest_save(h,jsonb_build_object('name','Catch','quest_type','restore','ordinal',2,'points',20,'catch_count',1));
  select id into q from public.private_hunt_quests where hunt_id=h and quest_type='restore';
  code:=public.private_hunt_publish(h)->>'join_code';
  state:=public.private_hunt_join_code(code);
  assert state->>'run_started_at' is null;
  select id into spot from public.corrupted_spots limit 1;
  -- A catch before start must not create progress, even when the spot is in the area.
  update public.hunts set guide_lat=case when mode='fixed' then (select lat from public.corrupted_spots where id=spot) else null end,guide_lng=case when mode='fixed' then (select lng from public.corrupted_spots where id=spot) else null end where id=h;
  update public.private_hunt_quests set location_lat=(select lat from public.corrupted_spots where id=spot), location_lng=(select lng from public.corrupted_spots where id=spot) where hunt_id=h and quest_type='arrive';
  perform private.private_hunt_record_catch(spot,(select lat from public.corrupted_spots where id=spot),(select lng from public.corrupted_spots where id=spot));
  update public.private_hunt_quests set location_lat=25,location_lng=121 where hunt_id=h and quest_type='arrive';
  assert not exists(select 1 from public.private_hunt_quest_progress where quest_id=q);
  update public.hunts set guide_lat=case when mode='fixed' then 25 else null end,guide_lng=case when mode='fixed' then 121 else null end where id=h;
  state:=public.private_hunt_start(h,25,121,10);started:=(state->>'started_at')::timestamptz;
  assert started>=now();
  perform private.private_hunt_record_catch(spot,0,0);
  assert not exists(select 1 from public.private_hunt_quest_progress where quest_id=q);
  update public.hunts set route_mode='ordered' where id=h;
  update public.private_hunt_quests set location_lat=(select lat from public.corrupted_spots where id=spot),location_lng=(select lng from public.corrupted_spots where id=spot) where hunt_id=h and quest_type='arrive';
  perform private.private_hunt_record_catch(spot,(select lat from public.corrupted_spots where id=spot),(select lng from public.corrupted_spots where id=spot));
  assert not exists(select 1 from public.private_hunt_quest_progress where quest_id=q);
  update public.hunts set route_mode='any' where id=h;
  update public.private_hunt_members set joined_at=now()-interval '20 minutes',started_at=now()-interval '20 minutes' where hunt_id=h;
  perform private.private_hunt_record_catch(spot,(select lat from public.corrupted_spots where id=spot),(select lng from public.corrupted_spots where id=spot));
  assert not exists(select 1 from public.private_hunt_quest_progress where quest_id=q);
  begin perform public.private_hunt_quest_complete((select id from public.private_hunt_quests where hunt_id=h and quest_type='arrive'),25,121,10,null,null);raise exception 'expected time_up';exception when raise_exception then if sqlerrm<>'time_up' then raise;end if;end;
  update public.hunts set ends_at=now()-interval '1 second' where id=h;
  begin perform public.private_hunt_collect_reward(h);raise exception 'expected not_finished';exception when raise_exception then if sqlerrm<>'not_finished' then raise;end if;end;
  update public.private_hunt_members set finished_at=now()-interval '2 seconds' where hunt_id=h;
  state:=public.private_hunt_collect_reward(h);assert state->>'reward_collected_at' is not null;
  assert exists(select 1 from public.my_passport() where place=h and how_earned='private_hunt');
 end loop;
 assert not has_function_privilege('anon','public.private_hunt_start(text,double precision,double precision,double precision)','execute');
 assert not has_function_privilege('authenticated','private.private_hunt_record_catch(uuid,double precision,double precision)','execute');
 execute $ddl$create or replace function private.private_hunt_record_catch(p_spot uuid,p_lat double precision,p_lng double precision) returns void language plpgsql security definer set search_path='' as $fault$begin raise exception 'injected bookkeeping failure';end$fault$;$ddl$;
 perform private.city_hunt_record_quest('restore',spot,25,121);
end $$;
select 'guide rollback assertions passed' as result;
