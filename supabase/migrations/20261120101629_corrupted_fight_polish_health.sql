begin;

-- Active fights retain the health they started with.
alter table private.corrupted_fights
  drop constraint corrupted_fights_max_health_check,
  add constraint corrupted_fights_max_health_check check (max_health between 3 and 7);

create or replace function public.corrupted_fight_start(
  p_spawn text, p_lat double precision, p_lng double precision, p_accuracy double precision
)
returns table(fight_id uuid, health integer, max_health integer, expires_at timestamptz, attempts_left integer)
language plpgsql security definer set search_path = '' as $$
declare
  cfg private.game_config;
  target record;
  fight private.corrupted_fights;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into strict cfg from private.game_config where singleton;
  select * into strict target from private.corrupted_target(p_spawn,p_lat,p_lng,cfg);
  delete from private.corrupted_fights f
    where f.user_id=auth.uid() and f.expires_at+interval '60 seconds'<=clock_timestamp();
  select * into fight from private.corrupted_fights where user_id=auth.uid() and spawn_id=p_spawn;
  if not found then
    max_health := case target.rarity when 'common' then 5 when 'uncommon' then 6 else 7 end;
    insert into private.corrupted_fights(user_id,spawn_id,max_health,health,expires_at)
      values(auth.uid(),p_spawn,max_health,max_health,target.expires_at) returning * into fight;
  end if;
  fight_id := fight.id;
  health := fight.health;
  max_health := fight.max_health;
  expires_at := fight.expires_at+interval '60 seconds';
  attempts_left := target.attempts_left;
  return next;
end $$;

commit;
