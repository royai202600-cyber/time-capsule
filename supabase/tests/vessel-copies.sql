-- Run after the migration inside a transaction that is rolled back.
insert into auth.users(id,email) values
 ('ac000000-0000-4000-8000-000000000001','copies-rollback-1@example.invalid'),
 ('ac000000-0000-4000-8000-000000000002','copies-rollback-2@example.invalid');
insert into public.profiles(id,name) values
 ('ac000000-0000-4000-8000-000000000001','Copies test'),
 ('ac000000-0000-4000-8000-000000000002','Copies admin') on conflict (id) do nothing;
insert into private.admin_members(user_id,role) values ('ac000000-0000-4000-8000-000000000002','admin');
insert into public.owned_vessels(user_id,vessel,copies) values ('ac000000-0000-4000-8000-000000000001','photo-strip',1);
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000001',true);
do $$
declare cap_id uuid; n integer; x record; v text;
begin
  if exists(select 1 from public.owned_vessels o join public.vessels v on v.id=o.vessel where (v.unlimited_copies and o.copies is not null) or (not v.unlimited_copies and o.copies<>10 and o.user_id<>'ac000000-0000-4000-8000-000000000001')) then raise exception 'backfill incorrect'; end if;
  if exists(select 1 from public.vessels where (id in ('dome','bottle','envelope','tin') or earned_place is not null) and not unlimited_copies) then raise exception 'missing unlimited'; end if;
  cap_id:=public.send_capsule('ac000000-0000-4000-8000-000000000001','photo-strip','test','',now()+interval '1 day');
  select copies into n from public.owned_vessels where user_id=auth.uid() and vessel='photo-strip';
  if n<>0 then raise exception 'send did not consume'; end if;
  begin
    perform public.send_capsule(auth.uid(),'photo-strip','test','',now()+interval '1 day');
    raise exception 'send at zero succeeded';
  exception when raise_exception then if sqlerrm<>'no_copies' then raise; end if; end;
  select * into x from public.my_collection() where vessel='photo-strip';
  if x.copies<>0 or x.stars<>1 then raise exception 'zero not collected'; end if;
  foreach v in array array['dome','bottle','envelope','tin'] loop
    perform public.send_capsule(auth.uid(),v,'test','',now()+interval '1 day');
  end loop;
  insert into public.owned_vessels(user_id,vessel) select auth.uid(),id from public.vessels where earned_place is not null limit 1 returning vessel into v;
  if (select copies from public.owned_vessels where user_id=auth.uid() and vessel=v) is not null then raise exception 'landmark not unlimited'; end if;
  perform public.send_capsule(auth.uid(),v,'test','',now()+interval '1 day');
  begin
    perform public.admin_player_adjust_copies(auth.uid(),'photo-strip',3);
    raise exception 'non-admin permitted';
  exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000002',true);
do $$
begin
  perform public.admin_player_adjust_copies('ac000000-0000-4000-8000-000000000001','photo-strip',3,'test');
  if (select copies from public.owned_vessels where user_id='ac000000-0000-4000-8000-000000000001' and vessel='photo-strip')<>3 then raise exception 'adjust failed'; end if;
  perform public.admin_copies_per_catch_set(5,'test');
  if private.copies_per_catch(auth.uid())<>5 then raise exception 'setting failed'; end if;
  perform public.admin_vessel_set_unlimited('photo-strip',true,'test');
  if (select copies from public.owned_vessels where user_id='ac000000-0000-4000-8000-000000000001' and vessel='photo-strip') is not null then raise exception 'toggle failed'; end if;
  if (select count(*) from private.admin_actions where actor=auth.uid() and action in ('player_adjust_copies','copies_per_catch_set','vessel_set_unlimited'))<>3 then raise exception 'missing audit'; end if;
end $$;
