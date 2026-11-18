-- Run after the migration body in the same transaction, then roll back.
insert into auth.users(id,email)
select ('ac000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  'copies-rollback-' || i || '@example.invalid'
from generate_series(1,5) i;
insert into public.profiles(id,name)
select id,'Copies fixture' from auth.users where email like 'copies-rollback-%@example.invalid'
on conflict (id) do nothing;
insert into private.admin_members(user_id,role)
select ('ac000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid, role
from (values (2,'admin'), (3,'owner'), (4,'moderator'), (5,'viewer')) as staff(i,role);

create function pg_temp.copies_user(i integer) returns uuid language sql as $$
  select set_config('request.jwt.claim.sub', 'ac000000-0000-4000-8000-' || lpad(i::text,12,'0'), true)::uuid;
$$;
create function pg_temp.copies_error(q text, expected text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if sqlerrm = expected then return; end if;
    raise exception 'Expected %, got %', expected, sqlerrm;
  end;
  raise exception 'Expected %, query succeeded', expected;
end $$;

do $$
begin
  if exists (select 1 from public.owned_vessels o join public.vessels v on v.id=o.vessel
    where o.copies is distinct from (case when v.unlimited_copies then null else 10 end))
  then raise exception 'Backfill incorrect'; end if;
  if exists (select 1 from public.vessels where
    (id in ('dome','bottle','envelope','tin') or earned_place is not null) and not unlimited_copies)
  then raise exception 'Missing unlimited vessels'; end if;
end $$;

select pg_temp.copies_user(1);
insert into public.owned_vessels(user_id,vessel,copies) values (auth.uid(),'photo-strip',2);
set local role authenticated;
do $$
declare v text; collection record;
begin
  perform public.send_capsule(auth.uid(),'photo-strip','test','',now()+interval '1 day');
  perform public.send_capsule(auth.uid(),'photo-strip','test','',now()+interval '1 day',25.03::float8,121.56::float8,'point');
  perform pg_temp.copies_error($q$select public.send_capsule(auth.uid(),'photo-strip','test','',now()+interval '1 day')$q$,'no_copies');
  select * into strict collection from public.my_collection() where vessel='photo-strip';
  if collection.copies <> 0 or collection.stars <> 1 then raise exception 'Zero not collected'; end if;
  foreach v in array array['dome','bottle','envelope','tin'] loop
    perform public.send_capsule(auth.uid(),v,'test','',now()+interval '1 day');
  end loop;
  if exists(select 1 from public.vessel_stock() where copies is distinct from 0) then
    raise exception 'Unowned finite limited stock leaked a balance';
  end if;
  for i in 1..5 loop
    if i in (2,3) then continue; end if;
    perform pg_temp.copies_user(i);
    perform pg_temp.copies_error($q$select public.admin_vessel_set_unlimited('photo-strip',true)$q$,'forbidden');
    perform pg_temp.copies_error($q$select public.admin_player_adjust_copies(auth.uid(),'photo-strip',1,'test')$q$,'forbidden');
    perform pg_temp.copies_error($q$select public.admin_wave_config_set(p_copies_per_catch=>5)$q$,'forbidden');
    perform pg_temp.copies_error($q$select public.admin_undo(0)$q$,'forbidden');
  end loop;
end $$;
reset role;

select pg_temp.copies_user(1);
do $$
declare v text; x record; spawn record; post record; attempt uuid; balance integer;
begin
  insert into public.owned_vessels(user_id,vessel)
    select auth.uid(),id from public.vessels where earned_place is not null limit 1 returning vessel into v;
  select * into strict x from public.my_collection() where vessel=v;
  if x.copies is not null or x.stars<>1 then raise exception 'Landmark collection incorrect'; end if;
  perform public.send_capsule(auth.uid(),v,'test','',now()+interval '1 day');
  if private.award_catch_copies(auth.uid(),v) is not null then raise exception 'Unlimited catch has balance'; end if;

  -- A different account starts without Landmark ownership.
  perform pg_temp.copies_user(5);
  select w.id, w.lat, w.lng, r.id as vessel into strict post
    from public.public_capsule_spots w join public.vessels r on r.earned_place=w.place
    where w.kind='landmark' and w.game_enabled limit 1;
  select attempt_id into strict attempt from public.landmark_start(post.id,post.lat,post.lng,10);
  update public.landmark_attempts set cracks_left=1 where id=attempt;
  select * into strict x from public.landmark_hit(attempt,post.lat,post.lng,10,'wax',1);
  if x.result <> 'won' or x.vessel <> post.vessel or x.copies is not null or x.stars <> 1 or not x.is_new
  then raise exception 'Landmark win incorrect: %', row_to_json(x); end if;
  perform pg_temp.copies_user(1);

  -- Keep the real spawn resolver and throw path. Force catch odds only within this rollback.
  update private.game_config set restore_common=1,restore_uncommon=1,restore_rare=1 where singleton;
  select s.spawn_id,s.vessel,p.lat,p.lng into strict spawn
  from public.corrupted_spots p cross join private.game_wave_at(now()) w
  cross join lateral private.resolve_spawn(p.id,w.wave) s
  join public.vessels v on v.id=s.vessel
  where not v.unlimited_copies and s.vessel<>'photo-strip' limit 1;
  select * into strict x from public.corrupted_capsule_throw(spawn.spawn_id,spawn.lat,spawn.lng,10,'wax',1,true);
  if x.result<>'restored' or x.copies<>3 or x.stars<>1 or not x.is_new then
    raise exception 'First catch result incorrect: %', row_to_json(x);
  end if;
  balance:=private.award_catch_copies(auth.uid(),spawn.vessel);
  if balance<>6 then raise exception 'Duplicate catch balance incorrect'; end if;
end $$;

do $$
declare player uuid := pg_temp.copies_user(1); event_id bigint; expected jsonb;
begin
  perform pg_temp.copies_user(2);
  perform pg_temp.copies_error(format('select public.admin_player_adjust_copies(%L,%L,-1,%L)',player,'photo-strip','test'),'invalid_copies');
  expected:=public.admin_player_adjust_copies(player,'photo-strip',3,'qa grant');
  if expected<>'{"copies":3}'::jsonb then raise exception 'Adjust failed'; end if;
  select id into strict event_id from private.admin_actions where actor=auth.uid()
    and action='vessel.player_copies' and note='qa grant';
  if public.admin_undo(event_id)<>'{"copies":0}'::jsonb then raise exception 'Adjust undo failed'; end if;
  perform public.admin_player_adjust_copies(player,'photo-strip',3,'qa restore');

  perform public.admin_wave_config_set(p_copies_per_catch=>5);
  if private.copies_per_catch(player)<>5 then raise exception 'Setting failed'; end if;
  select id into strict event_id from private.admin_actions where actor=auth.uid() and action='config.copies_per_catch';
  if public.admin_undo(event_id)<>'{"copies_per_catch":3}'::jsonb then raise exception 'Setting undo failed'; end if;

  perform pg_temp.copies_user(3);
  perform pg_temp.copies_error($q$select public.admin_vessel_set_unlimited('bottle',false)$q$,'required_unlimited');
  perform public.admin_vessel_set_unlimited('photo-strip',true);
  if (select copies from public.owned_vessels where user_id=player and vessel='photo-strip') is not null then raise exception 'Toggle on failed'; end if;
  select id into strict event_id from private.admin_actions where actor=auth.uid() and action='vessel.unlimited';
  if (public.admin_undo(event_id)->>'unlimited_copies')::boolean or
     (select copies from public.owned_vessels where user_id=player and vessel='photo-strip')<>3
  then raise exception 'Toggle undo did not restore finite balance'; end if;
  perform public.admin_vessel_set_unlimited('photo-strip',true);
  perform public.admin_vessel_set_unlimited('photo-strip',false);
  if (select copies from public.owned_vessels where user_id=player and vessel='photo-strip')<>0 then raise exception 'Toggle off failed'; end if;
end $$;
