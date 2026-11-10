-- One-time City Hunt Keeper copy: the meeting spot and Landmark names come from hunt data.
begin;

alter table public.hunts add column keeper_spot_zh text;
alter table public.hunts add column keeper_spot_en text;

update public.hunts
set keeper_spot_zh = '市府廣場', keeper_spot_en = 'Civic Square'
where id = 'xinyi-2026-11';

-- Fail the migration if another hunt was added without its Keeper spot.
alter table public.hunts alter column keeper_spot_zh set not null;
alter table public.hunts alter column keeper_spot_en set not null;

create or replace function private.hunt_object(p_hunt text,p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',h.id,'name_zh',h.name_zh,'name_en',h.name_en,
    'city_zh',h.city_zh,'city_en',h.city_en,
    'starts_at',h.starts_at,'ends_at',h.ends_at,
    'keeper',jsonb_build_object('lat',h.keeper_lat,'lng',h.keeper_lng),
    'keeper_spot_zh',h.keeper_spot_zh,'keeper_spot_en',h.keeper_spot_en,
    'area',jsonb_build_object('lat',h.area_lat,'lng',h.area_lng,'radius_m',h.area_radius_m),
    'landmark',h.landmark,
    'landmark_name_zh',s.name_zh,'landmark_name_en',s.name_en,
    'reward',jsonb_build_object('xp',h.reward_xp,'gold',h.reward_gold),
    'steps',(select jsonb_agg(jsonb_build_object('key',st.step_key,'goal',st.goal,
      'count',least(st.goal,case st.step_key when 'checkin' then case when p.checked_in_at is null then 0 else 1 end
      when 'spin' then coalesce(p.spin_count,0)
      when 'restore' then coalesce(p.restore_count,0)
      when 'landmark' then coalesce(p.landmark_count,0)
      when 'return' then case when p.finished_at is null then 0 else 1 end end))
      order by st.ordinal) from public.hunt_steps st where st.hunt_id=h.id),
    'joined_at',p.joined_at,'checked_in_at',p.checked_in_at,'finished_at',p.finished_at)
  from public.hunts h
  join public.sea_shores s on s.id=h.landmark
  left join public.hunt_progress p on p.hunt_id=h.id and p.user_id=p_user
  where h.id=p_hunt
$$;

commit;
