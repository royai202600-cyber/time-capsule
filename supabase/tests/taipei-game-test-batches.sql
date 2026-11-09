-- Append to the temporary Taipei migration without COMMIT; all checks roll back.
do $$ declare wave bigint; ids uuid[]; norm jsonb; begin
 select floor(extract(epoch from now())/(wave_minutes*60))::bigint into wave from private.game_config where singleton;
 if (select count(*) from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:%')<>5 then raise exception 'wrong count';end if;
 if exists(select 1 from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:%' and public.distance_m(25.037546,121.562754,lat,lng) not between 28 and 89) then raise exception 'outside pickup sample';end if;
 if exists(select 1 from public.corrupted_spots a join public.corrupted_spots b on a.id<b.id where a.source_ref like 'qa:roy-taipei-game:%' and b.source_ref like 'qa:roy-taipei-game:%' and public.distance_m(a.lat,a.lng,b.lat,b.lng)<36) then raise exception 'overlap';end if;
 if (select count(*) from public.corrupted_spots p cross join lateral private.resolve_spawn(p.id,wave) r where p.source_ref like 'qa:roy-taipei-game:%' and r.expires_at>now() and r.expires_at<=to_timestamp((floor(extract(epoch from now())/600)+1)*600))<>5 then raise exception 'expiry';end if;
 select array_agg(id) into ids from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:%';
 perform private.refresh_taipei_game_demo();
 if exists(select 1 from public.corrupted_spots where source_ref like 'qa:roy-taipei-game:%' and id<>all(ids)) then raise exception 'not idempotent';end if;
 update public.corrupted_spots set source_ref=replace(source_ref,split_part(source_ref,':',3),(floor(extract(epoch from now())/600)-1)::text) where id=any(ids);
 if exists(select 1 from public.corrupted_spots p cross join lateral private.resolve_spawn(p.id,wave) r where p.id=any(ids) and r.expires_at>now()) then raise exception 'old batch did not expire';end if;
 perform private.refresh_taipei_game_demo();
 if exists(select 1 from public.corrupted_spots where id=any(ids)) then raise exception 'old batch retained';end if;
 if has_function_privilege('authenticated','private.refresh_taipei_game_demo()','execute') then raise exception 'helper exposed';end if;
end $$;
select 'PASS: five irregular reachable spots, spacing, fixed expiry, idempotence, old-batch cleanup and private grants' as result;
rollback;
