create temp table admin_test_waves_after on commit drop as
select i.*, s.spawn_id, s.vessel, s.rarity, s.expires_at
from admin_test_wave_inputs i left join lateral private.resolve_spawn(i.spot, i.wave) s on true;

do $$
begin
  if not exists (select 1 from admin_test_waves_before where spawn_id is not null)
    or exists (
      (select * from admin_test_waves_before except all select * from admin_test_waves_after)
      union all
      (select * from admin_test_waves_after except all select * from admin_test_waves_before)
    )
  then raise exception 'resolved waves changed'; end if;
end;
$$;

select count(distinct spot) as spots, count(distinct wave) as waves, count(*) as compared,
  count(spawn_id) as spawned
from admin_test_waves_after;
