-- Append to the six-target migration without COMMIT. All fixtures roll back.
insert into auth.users(id,email) values('087e002a-3aee-4cb4-a1ad-a6d001dbbad7','six-target-sql@example.invalid');
insert into public.profiles(id,name) values('087e002a-3aee-4cb4-a1ad-a6d001dbbad7','Six target QA');
insert into private.game_speed_allowlist(user_id) values('087e002a-3aee-4cb4-a1ad-a6d001dbbad7');
create temp table test_locations as
select city_en,lat,lng from (
 select s.city_en,s.lat,s.lng,row_number() over(partition by s.city_en order by count(p.id) desc,s.id) as rank
 from public.sea_shores s join public.corrupted_spots p on p.city=s.city_en
   and p.lat between s.lat-.001 and s.lat+.001 and p.lng between s.lng-.0011 and s.lng+.0011
   and public.distance_m(s.lat,s.lng,p.lat,p.lng)<=100
 where s.game_enabled and s.kind='common' and s.city_en in ('Taipei','Hong Kong','Singapore','Macau')
 group by s.city_en,s.id,s.lat,s.lng
) ranked where rank=1;
grant select on test_locations to authenticated;
select set_config('request.jwt.claim.sub','087e002a-3aee-4cb4-a1ad-a6d001dbbad7',true);
set local role authenticated;
do $$ declare p record; result jsonb; other jsonb; x jsonb; begin
 if (select count(*) from test_locations)<>4 then raise exception 'missing region';end if;
 for p in select * from test_locations loop
  result:=public.corrupted_nearby(p.lat,p.lng,10);
  if jsonb_array_length(result->'spawns')<>6 then raise exception 'six unavailable at %: %',p.city_en,result->'spawns';end if;
  if result<>public.corrupted_nearby(p.lat,p.lng,10) then raise exception 'refresh rerolls the wave';end if;
  for x in select * from jsonb_array_elements(result->'spawns') loop
   if public.distance_m(p.lat,p.lng,(x->>'lat')::float,(x->>'lng')::float)>100 then raise exception 'outside reach';end if;
   if (x->>'expires_at')::timestamptz<>to_timestamp((floor(extract(epoch from now())/600)+1)*600) then raise exception 'wrong expiry';end if;
   if x->>'spawn_id' like 'dev-%' or (x->>'already_caught')::boolean then raise exception 'invalid available release';end if;
   for other in select * from jsonb_array_elements(result->'spawns') loop
    if x->>'spawn_id'<>other->>'spawn_id' and public.distance_m((x->>'lat')::float,(x->>'lng')::float,(other->>'lat')::float,(other->>'lng')::float)<28 then raise exception 'overlapping positions';end if;
   end loop;
  end loop;
 end loop;
 -- A private/non-public location may have fewer spots; safety wins over filling a quota.
 if jsonb_array_length(public.corrupted_nearby(0,0,10)->'spawns')<>0 then raise exception 'unsafe filler';end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from cron.job where jobname='time-capsule-taipei-test-batch') then raise exception 'background QA timer still active';end if;
 if exists(select 1 from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:%') then raise exception 'temporary grid retained';end if;
 if has_table_privilege('authenticated','public.corrupted_spots','select') or has_function_privilege('anon','public.corrupted_nearby(double precision,double precision,double precision)','execute') then raise exception 'security regression';end if;
end $$;
select 'PASS: six per region, 100 m reach, irregular spacing, stable waves, expiry, no unsafe filler or background timer, private spots/RPC grants' as result;
rollback;
