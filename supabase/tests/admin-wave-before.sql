-- Inside the same transaction, run this before the migration body and
-- admin-wave-after.sql after it. Omit the migration's outer BEGIN and COMMIT.
create temp table admin_test_wave_inputs on commit drop as
select p.id as spot, w.wave
from public.corrupted_spots p
cross join private.game_config cfg
cross join lateral generate_series(
  floor(extract(epoch from date_trunc('day', now(), 'Asia/Taipei')) / (cfg.wave_minutes * 60))::bigint,
  floor(extract(epoch from date_trunc('day', now(), 'Asia/Taipei')) / (cfg.wave_minutes * 60))::bigint
    + 1440 / cfg.wave_minutes - 1
) w(wave)
where cfg.singleton;

create temp table admin_test_waves_before on commit drop as
select i.*, s.spawn_id, s.vessel, s.rarity, s.expires_at
from admin_test_wave_inputs i left join lateral private.resolve_spawn(i.spot, i.wave) s on true;
