-- Map Builder R2. A Landmark keeps its Waypost identity, including when converted.
begin;

alter table public.vessels
  add column earned_only boolean not null default false,
  add constraint vessels_earned_only_unlimited check (not earned_only or unlimited_copies);

insert into public.vessels (id, price_mop, sort, earned_only, unlimited_copies)
values ('landmark-keepsake', 0, (select coalesce(max(sort), 0) + 1 from public.vessels), true, true);

alter table public.public_capsule_spots
  drop constraint sea_shores_landmark_place,
  add constraint waypost_common_place check (kind = 'landmark' or place is null),
  add column monument jsonb,
  add column landmark_vessel text references public.vessels(id),
  add column landmark_stamp text check (landmark_stamp ~ '^[a-z0-9-]{1,40}$'),
  add column fight_health integer check (fight_health between 10 and 200),
  add column fight_seconds integer check (fight_seconds between 60 and 600);

update public.public_capsule_spots p
set landmark_vessel = coalesce((select v.id from public.vessels v where v.earned_place = p.place), 'landmark-keepsake'),
    landmark_stamp = coalesce(p.place, 'landmark-default'),
    fight_health = 40,
    fight_seconds = 150
where p.kind = 'landmark';

-- MONUMENT_SEED from PR #211 at 41ddc4a, serialized directly from monuments.ts.
update public.public_capsule_spots p set monument = seed.value
from jsonb_each($monuments${"taipei101":{"custom":{"color":"landmark","tiers":[[62,0,18],[36,18,24],[24,24,30],[21,30,36],[14,36,38.8],[16.25,38.8,41.6],[18.5,41.6,44],[14,44,46.8],[16.25,46.8,49.6],[18.5,49.6,52],[14,52,54.8],[16.25,54.8,57.6],[18.5,57.6,60],[14,60,62.8],[16.25,62.8,65.6],[18.5,65.6,68],[14,68,70.8],[16.25,70.8,73.6],[18.5,73.6,76],[14,76,78.8],[16.25,78.8,81.6],[18.5,81.6,84],[14,84,86.8],[16.25,86.8,89.6],[18.5,89.6,92],[14,92,94.8],[16.25,94.8,97.6],[18.5,97.6,100],[12,100,106],[8,106,112],[4,112,116],[1.6,116,142]]}},"senado":{"buildings":{"color":"landmark","real_top":26.2,"top":12,"ids":[35184577873359,35185133855962,35185133855963,35184763410348,35185029968552,35185133855967,35185133855964,35185133855966,35185133855960,35185133855961,35184763410351,35185190550958,35185133855953,35184637522361,35184702457087,35185152337983,35184702457086]},"custom":{"color":"landmark","tiers":[[13,0,0.5,{"round":true}],[9,0.5,3.5,{"arc":{"inner":7.4,"from":0,"to":180}}],[9,0.5,3.5,{"arc":{"inner":7.4,"from":180,"to":360}}],[7.4,0.5,1.6,{"round":true}],[4,1.6,5,{"round":true}],[1.6,5,7.5,{"round":true}],[2.2,7.5,8.5,{"round":true}],[3.2,8.5,10,{"round":true}],[3.6,10,11.5,{"round":true}],[3.2,11.5,13,{"round":true}],[2.2,13,14,{"round":true}],[1.5,14,15,{"round":true}],[4.6,10.3,11.2,{"arc":{"inner":4.1,"from":0,"to":180}}],[4.6,10.3,11.2,{"arc":{"inner":4.1,"from":180,"to":360}}]]}},"hkust":{"buildings":{"color":"landmark","real_top":38,"top":14,"ids":[35184588150781,35184588150874,35184588151507,35184588151845,35184604980730,35184604980739,35184605712876,35184605712877,35184605712878,35184605712879,35184605712885,35184607417841,35184607417844,35184607417847,35184607417851,35184607946900,35184607946908,35184608001582,35184608002636,35184608003256,35184608003258,35184608003259,35184608003393,35184608118220,35184608118222,35184608118225,35184608118226,35184608118228,35184608234791,35184608234793,35184608234794,35184609084167,35184612483705,35184612483717,35184612546772,35184612546783,35184612546784,35184635582360,35184635582361,35184650365030,35184650365035,35184650365036,35184650365040,35184650365043,35184650365055,35184650365059,35184660294276,35184675660611,35184687662679,35184687793739,35184740860876,35184961096812,35185113745772,35185113746500,35185113746501,35185113746502,35185132194864,35185133480445,35185133480455,35185301575605,35185382178161,35185478357636,35185478357638,35185478357639,35185478357640,35185684953432,35185684953433,35185684953434,35185684953436,35185797136924,35185797136925,35185797136926,35185797136927,35185797247856,35185797247857,35185930730155,35185932128835,35185932223402,35185932693361,35185932930162,35185932930163,35185933216948,52776561307952]},"custom":{"color":"landmark","tiers":[[64,0,14,{"arc":{"inner":50,"from":-80,"to":100}}],[62,14,18,{"arc":{"inner":53,"from":-76,"to":96}}],[8,0,0.5,{"round":true}],[2.6,0.5,1.5,{"round":true,"dx":-9}],[2.6,0.5,1.5,{"round":true,"dx":-7.5,"dy":-1}],[1.7,0.5,3,{"round":true,"dx":-8,"dy":3.5}],[1.5,3,5,{"round":true,"dx":-9,"dy":4.5}],[2.5,0.5,2.5,{"round":true,"dx":-5.5}],[2.4,2.5,4.5,{"round":true,"dx":-3.5}],[2.3,4.5,6.5,{"round":true,"dx":-1.5}],[2.2,6.5,8.5,{"round":true}],[2,8.5,10.5,{"round":true,"dx":0.8}],[1.9,10.5,12.5,{"round":true,"dx":0.8}],[1.8,12.5,14.5,{"round":true}],[1.7,14.5,16,{"round":true,"dx":1.5}],[1.6,16,17.5,{"round":true,"dx":3}],[1.5,17.5,19,{"round":true,"dx":4.5}],[1.5,19,20,{"round":true,"dx":6}]]}}}$monuments$::jsonb) as seed
where p.kind = 'landmark' and p.place = seed.key;

alter table public.public_capsule_spots add constraint waypost_landmark_fields check (
  (kind = 'landmark' and landmark_vessel is not null and landmark_stamp is not null
    and fight_health is not null and fight_seconds is not null)
  or (kind = 'common' and monument is null and landmark_vessel is null and landmark_stamp is null
    and fight_health is null and fight_seconds is null)
);

-- Unlimited sending still uses copies = NULL. Count the copies won separately.
alter table public.owned_vessels
  add column landmark_copies integer not null default 0 check (landmark_copies >= 0);
update public.owned_vessels o set landmark_copies = 1
from public.vessels v where o.vessel = v.id and v.earned_place is not null;

create table private.landmark_passport_stamps (
  user_id uuid not null references auth.users(id) on delete cascade,
  waypost_id uuid not null references public.public_capsule_spots(id),
  stamp text not null check (stamp ~ '^[a-z0-9-]{1,40}$'),
  first_at timestamptz not null,
  primary key (user_id, waypost_id)
);
create index landmark_passport_stamps_waypost_idx on private.landmark_passport_stamps(waypost_id);

insert into private.landmark_passport_stamps(user_id, waypost_id, stamp, first_at)
select s.user_id, p.id, p.landmark_stamp, s.first_at
from public.passport_stamps s
cross join lateral (
  select w.id, w.landmark_stamp from public.public_capsule_spots w
  where w.place = s.place and w.kind = 'landmark'
  order by (w.status = 'live') desc, w.id limit 1
) p
where s.how_earned = 'landmark';

create function private.validate_monument(p_monument jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  part text;
  shape jsonb;
  item jsonb;
  opts jsonb;
  arc jsonb;
  dimension jsonb;
begin
  if p_monument is null or p_monument = 'null'::jsonb then return; end if;
  if jsonb_typeof(p_monument) <> 'object' or p_monument - array['buildings','model','custom'] <> '{}' then
    raise exception 'bad_monument';
  end if;

  for part, shape in select key, value from jsonb_each(p_monument) loop
    if shape = 'null'::jsonb then continue; end if;
    if jsonb_typeof(shape) <> 'object' or not coalesce(
      shape->>'color' in ('landmark','ink','light','glass','wax','brass'), false)
    then raise exception 'bad_monument'; end if;

    case part
    when 'buildings' then
      if shape - array['ids','real_top','top','color'] <> '{}'
        or jsonb_typeof(shape->'ids') is distinct from 'array'
        or jsonb_typeof(shape->'real_top') is distinct from 'number'
        or jsonb_typeof(shape->'top') is distinct from 'number'
      then raise exception 'bad_monument'; end if;
      if jsonb_array_length(shape->'ids') > 300
        or (shape->>'real_top')::double precision <= 0
        or (shape->>'top')::numeric not between 1 and 60
      then raise exception 'bad_monument'; end if;
      for item in select value from jsonb_array_elements(shape->'ids') loop
        if jsonb_typeof(item) <> 'number' then raise exception 'bad_monument'; end if;
        if item::numeric <> trunc(item::numeric) then raise exception 'bad_monument'; end if;
        perform item::numeric::bigint;
      end loop;

    when 'model' then
      if shape - array['kind','size','rotate','color'] <> '{}'
        or not coalesce(shape->>'kind' in ('tower','pagoda','gate','fountain','column','pavilion','dome','statue'),false)
        or not coalesce(shape->>'size' in ('s','m','l'),false)
        or jsonb_typeof(shape->'rotate') is distinct from 'number'
      then raise exception 'bad_monument'; end if;
      if (shape->>'rotate')::numeric not between 0 and 359 then raise exception 'bad_monument'; end if;

    when 'custom' then
      if shape - array['tiers','color'] <> '{}' or jsonb_typeof(shape->'tiers') is distinct from 'array'
      then raise exception 'bad_monument'; end if;
      if jsonb_array_length(shape->'tiers') > 60 then raise exception 'bad_monument'; end if;
      for item in select value from jsonb_array_elements(shape->'tiers') loop
        if jsonb_typeof(item) <> 'array' then raise exception 'bad_monument'; end if;
        if jsonb_array_length(item) not between 3 and 4
          or jsonb_typeof(item->0) is distinct from 'number'
          or jsonb_typeof(item->1) is distinct from 'number'
          or jsonb_typeof(item->2) is distinct from 'number'
        then raise exception 'bad_monument'; end if;
        if (item->>0)::double precision < 0 or (item->>1)::double precision < 0
          or (item->>2)::double precision <= (item->>1)::double precision
        then raise exception 'bad_monument'; end if;

        opts := item->3;
        if opts is null then continue; end if;
        if jsonb_typeof(opts) <> 'object' or opts - array['round','rect','dx','dy','arc'] <> '{}'
          or (opts ? 'round' and jsonb_typeof(opts->'round') <> 'boolean')
          or (opts ? 'dx' and jsonb_typeof(opts->'dx') <> 'number')
          or (opts ? 'dy' and jsonb_typeof(opts->'dy') <> 'number')
        then raise exception 'bad_monument'; end if;
        perform (opts->>'dx')::double precision, (opts->>'dy')::double precision;

        dimension := opts->'rect';
        if dimension is not null then
          if jsonb_typeof(dimension) <> 'array' then raise exception 'bad_monument'; end if;
          if jsonb_array_length(dimension) <> 2
            or jsonb_typeof(dimension->0) <> 'number' or jsonb_typeof(dimension->1) <> 'number'
          then raise exception 'bad_monument'; end if;
          if (dimension->>0)::double precision <= 0 or (dimension->>1)::double precision <= 0
          then raise exception 'bad_monument'; end if;
        end if;

        arc := opts->'arc';
        if arc is not null then
          if jsonb_typeof(arc) <> 'object' or arc - array['inner','from','to'] <> '{}'
            or jsonb_typeof(arc->'inner') is distinct from 'number'
            or jsonb_typeof(arc->'from') is distinct from 'number'
            or jsonb_typeof(arc->'to') is distinct from 'number'
          then raise exception 'bad_monument'; end if;
          -- Drawing cost grows with the angle swept by the arc.
          if (arc->>'inner')::double precision < 0 or (arc->>'inner')::double precision >= (item->>0)::double precision
            or abs((arc->>'to')::double precision - (arc->>'from')::double precision) not between 0.000001 and 360
          then raise exception 'bad_monument'; end if;
        end if;
      end loop;
    end case;
  end loop;
exception when numeric_value_out_of_range then
  raise exception 'bad_monument';
end;
$$;

create function private.landmark_fields(p_post public.public_capsule_spots)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('monument', p_post.monument, 'vessel', p_post.landmark_vessel,
    'stamp', p_post.landmark_stamp, 'fight_health', p_post.fight_health, 'fight_seconds', p_post.fight_seconds)
$$;

-- The caller holds the Waypost row lock. rack_leave takes a conflicting share
-- lock before inserting, so a conversion cannot race a new rack capsule.
create function private.save_landmark(p_post public.public_capsule_spots, p_fields jsonb)
returns public.public_capsule_spots language plpgsql set search_path = '' as $$
declare
  fields jsonb := coalesce(p_fields, '{}'::jsonb);
  shape jsonb := nullif(fields->'monument', 'null'::jsonb);
  reward text := coalesce(fields->>'vessel', 'landmark-keepsake');
  stamp_key text := coalesce(fields->>'stamp', 'landmark-default');
  health numeric := 40;
  seconds numeric := 150;
  saved public.public_capsule_spots;
begin
  if jsonb_typeof(fields) <> 'object' or fields - array['monument','vessel','stamp','fight_health','fight_seconds'] <> '{}'
  then raise exception 'bad_landmark'; end if;
  perform private.validate_monument(shape);

  if (fields ? 'vessel' and jsonb_typeof(fields->'vessel') <> 'string')
    or not exists (select 1 from public.vessels v where v.id = reward and (v.earned_only or v.earned_place is not null))
  then raise exception 'bad_vessel'; end if;
  if (fields ? 'stamp' and jsonb_typeof(fields->'stamp') <> 'string')
    or stamp_key !~ '^[a-z0-9-]{1,40}$'
  then raise exception 'bad_stamp'; end if;
  if (fields ? 'fight_health' and jsonb_typeof(fields->'fight_health') <> 'number')
    or (fields ? 'fight_seconds' and jsonb_typeof(fields->'fight_seconds') <> 'number')
  then raise exception 'bad_fight'; end if;
  health := coalesce((fields->>'fight_health')::numeric, health);
  seconds := coalesce((fields->>'fight_seconds')::numeric, seconds);
  if health not between 10 and 200 or health <> trunc(health)
    or seconds not between 60 and 600 or seconds <> trunc(seconds)
  then raise exception 'bad_fight'; end if;

  if p_post.kind = 'common' and exists (
    select from public.capsules c where c.public_capsule_spot = p_post.id
      and c.is_public and c.recipient is null and c.opened_at is null and c.rack_removed_at is null
  ) then raise exception 'rack_not_empty'; end if;

  update public.public_capsule_spots w set kind = 'landmark', monument = shape,
    landmark_vessel = reward, landmark_stamp = stamp_key, fight_health = health, fight_seconds = seconds
  where w.id = p_post.id returning w.* into strict saved;
  return saved;
end;
$$;

drop function public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text,text,text,text);

create function public.admin_waypost_add(p_region text, p_lat double precision, p_lng double precision,
  p_name_zh text, p_name_en text, p_scene text, p_checked boolean default null, p_note text default null,
  p_photo text default null, p_photo_credit text default null, p_status text default 'live',
  p_kind text default 'common', p_landmark jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare post public.public_capsule_spots;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  if p_kind is null or p_kind not in ('common','landmark') then raise exception 'bad_kind'; end if;
  if p_kind = 'common' and p_landmark is not null then raise exception 'bad_landmark'; end if;

  post := private.create_map_waypost(p_region, p_lat, p_lng, p_name_zh, p_name_en, p_scene,
    p_photo, p_photo_credit, p_status);
  if p_kind = 'landmark' then post := private.save_landmark(post, p_landmark); end if;
  perform private.admin_log('waypost.add', 'waypost', post.id::text, post.name_en, null, to_jsonb(post), p_note);
  return to_jsonb(post);
end;
$$;

create function public.admin_landmark_set(p_id uuid, p_landmark jsonb, p_note text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  post public.public_capsule_spots;
  saved public.public_capsule_spots;
  action_id bigint;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  post := private.admin_waypost_row(p_id);
  saved := private.save_landmark(post, p_landmark);
  if post.kind = 'common' and post.status = 'live' then
    perform private.assert_map_builder_hunts();
  end if;
  insert into private.admin_actions (actor, actor_snapshot, action, target_type, target_id, target_label,
    before, after, note)
  values (auth.uid(), private.admin_person(auth.uid()), 'landmark.set', 'waypost', post.id::text, post.name_en,
    to_jsonb(post), to_jsonb(saved), p_note)
  returning id into action_id;
  return action_id;
end;
$$;

CREATE OR REPLACE FUNCTION private.admin_waypost_row(p_id uuid)
 RETURNS public_capsule_spots
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.public_capsule_spots;
begin
  select * into p from public.public_capsule_spots s where s.id = p_id
    and s.status <> 'deleted' for update;
  if not found then raise exception 'not_found'; end if;
  return p;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_undo(p_action_id bigint, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  event private.admin_actions;
  post public.public_capsule_spots;
  old_post public.public_capsule_spots;
  spot public.corrupted_spots;
  old_spot public.corrupted_spots;
  target uuid;
  kind text;
  is_batch boolean;
  is_status boolean;
  is_add boolean;
  current_state jsonb;
  expected jsonb;
  previous jsonb;
  before_rows jsonb := '{}';
  after_rows jsonb := '{}';
  saved jsonb;
  landmark_fields constant text[] := array['monument','landmark_vessel','landmark_stamp','fight_health','fight_seconds'];
  status_fields text[] := array['status','game_enabled','hidden_at','first_spawn_wave'];
  recheck_hunts boolean := false;
begin
  select * into event from private.admin_actions where id = p_action_id;
  if not coalesce(event.action in ('waypost.add','waypost.edit','waypost.move','waypost.hide','waypost.show',
    'landmark.set','spot.add','spot.move','spot.hide','spot.show','waypost.status','spot.status','waypost.add_batch','spot.add_batch'), false)
  then return private.admin_undo_before_map_builder(p_action_id, p_note); end if;

  perform private.require_game_editor();
  perform private.lock_game_edits();
  kind := case when event.action = 'landmark.set' then 'waypost' else split_part(event.action, '.', 1) end;
  is_status := event.action in ('waypost.status','spot.status');
  is_batch := event.target_type in ('waypost_batch','spot_batch');
  is_add := event.action in ('waypost.add','spot.add','waypost.add_batch','spot.add_batch');

  for target in select unnest(string_to_array(event.target_id, ',')::uuid[]) loop
    if exists (
      select 1 from private.admin_actions a
      where a.id > event.id and a.target_type in (kind, kind || '_batch')
        and target::text = any(string_to_array(a.target_id, ','))
    ) then raise exception 'stale'; end if;

    if kind = 'waypost' then
      select * into post from public.public_capsule_spots where id = target for update;
      if not found then raise exception 'stale'; end if;
      current_state := to_jsonb(post);
    else
      select * into spot from public.corrupted_spots where id = target for update;
      if not found then raise exception 'stale'; end if;
      current_state := to_jsonb(spot);
    end if;

    previous := case when is_batch then event.before->target::text else event.before end;
    -- Compare legacy Activity snapshots without the columns they predate.
    if kind = 'waypost' and not coalesce((case when is_status then previous
      when is_batch then event.after->'rows'->target::text else event.after end) ? 'landmark_vessel', false)
    then current_state := current_state - landmark_fields; end if;
    if is_status then
      if current_state->>'status' is distinct from event.after->>'status'
        or (current_state - status_fields) is distinct from (previous - status_fields)
      then raise exception 'stale'; end if;
    else
      expected := case when is_batch then event.after->'rows'->target::text else event.after end;
      -- Actions before R1.5 have neither status nor the new draft snapshots.
      -- The old status and spawn metadata are still valid for those actions.
      if not (expected ? 'status') then current_state := current_state - 'status'; end if;
      if kind = 'waypost' and not (expected ? 's2_cell17') then
        current_state := current_state - array['s2_cell17','photo','photo_credit'];
      elsif kind = 'spot' and not (expected ? 'first_spawn_wave') then
        current_state := current_state - 'first_spawn_wave';
      end if;
      if current_state is distinct from expected then raise exception 'stale'; end if;
    end if;

    if kind = 'waypost' then
      old_post := jsonb_populate_record(null::public.public_capsule_spots, previous);
      update public.public_capsule_spots w set
        kind = case when event.action = 'landmark.set' then old_post.kind else post.kind end,
        monument = case when event.action = 'landmark.set' then old_post.monument else post.monument end,
        landmark_vessel = case when event.action = 'landmark.set' then old_post.landmark_vessel else post.landmark_vessel end,
        landmark_stamp = case when event.action = 'landmark.set' then old_post.landmark_stamp else post.landmark_stamp end,
        fight_health = case when event.action = 'landmark.set' then old_post.fight_health else post.fight_health end,
        fight_seconds = case when event.action = 'landmark.set' then old_post.fight_seconds else post.fight_seconds end,
        status = case when is_add then case when is_batch then 'deleted' else 'hidden' end
          else coalesce(old_post.status,
            case when old_post.game_enabled and old_post.hidden_at is null then 'live' else 'hidden' end) end,
        hidden_at = case when is_add then now() else old_post.hidden_at end,
        lat = case when is_add then post.lat else old_post.lat end,
        lng = case when is_add then post.lng else old_post.lng end,
        name_zh = case when is_add then post.name_zh else old_post.name_zh end,
        name_en = case when is_add then post.name_en else old_post.name_en end,
        scene = case when is_add then post.scene else old_post.scene end,
        photo = case when is_add then post.photo else old_post.photo end,
        photo_credit = case when is_add then post.photo_credit else old_post.photo_credit end
      where id = target returning to_jsonb(w) into saved;
      recheck_hunts := recheck_hunts or (post.status = 'live' and
        (saved->>'status' <> 'live' or (post.lat, post.lng) is distinct from (old_post.lat, old_post.lng)));
    else
      old_spot := jsonb_populate_record(null::public.corrupted_spots, previous);
      update public.corrupted_spots s set
        status = case when is_add then case when is_batch then 'deleted' else 'hidden' end
          else coalesce(old_spot.status, case when old_spot.hidden_at is not null then 'hidden' else 'live' end) end,
        hidden_at = case when is_add then now() else old_spot.hidden_at end,
        lat = case when is_add then spot.lat else old_spot.lat end,
        lng = case when is_add then spot.lng else old_spot.lng end,
        first_spawn_wave = case when is_add or not (previous ? 'first_spawn_wave')
          then spot.first_spawn_wave else old_spot.first_spawn_wave end
      where id = target returning to_jsonb(s) into saved;
    end if;
    before_rows := before_rows || jsonb_build_object(target, current_state);
    after_rows := after_rows || jsonb_build_object(target, saved);
  end loop;

  if recheck_hunts then perform private.assert_map_builder_hunts(); end if;
  perform private.admin_log('undo', event.target_type, event.target_id, event.target_label,
    case when is_batch then before_rows else current_state end,
    (case when is_batch then jsonb_build_object('rows', after_rows) else saved end)
      || jsonb_build_object('undo_of', event.id), p_note);
  return case when is_batch then after_rows else saved end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_city_map(p_region text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  city private.game_regions;
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  select * into city from private.game_regions where id = p_region and center_lat is not null;
  if not found then raise exception 'not_found'; end if;

  return (
    with wave as materialized (select * from private.admin_wave(city.city))
    select jsonb_build_object(
      'region', private.admin_region(city, (select count(*) from wave where not caught)),
      'wayposts', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name_zh', p.name_zh, 'name_en', p.name_en, 'lat', p.lat, 'lng', p.lng,
        'kind', p.kind, 'game_enabled', p.game_enabled, 'source_ref', p.source_ref,
        'scene', p.scene, 'hidden_at', p.hidden_at, 'place', p.place,
        'status', p.status, 's2_cell17', p.s2_cell17, 'photo', p.photo, 'photo_credit', p.photo_credit
      ) || case when p.kind = 'landmark' then jsonb_build_object('landmark', private.landmark_fields(p))
        else '{}'::jsonb end order by p.id), '[]'::jsonb)
        from public.public_capsule_spots p where p.city_en = city.city and p.status <> 'deleted'),
      'spots', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'lat', p.lat, 'lng', p.lng, 'habitat', p.habitat, 'hidden_at', p.hidden_at, 'status', p.status
      ) order by p.id), '[]'::jsonb) from public.corrupted_spots p
        where p.city = city.city and p.status <> 'deleted' and p.source_ref not like 'qa:roy-taipei-game:%'),
      'wave', (select coalesce(jsonb_agg(to_jsonb(w) order by w.spot), '[]'::jsonb) from wave w),
      'keepers', (select coalesce(jsonb_agg(jsonb_build_object(
        'hunt', h.id, 'name_zh', h.keeper_spot_zh, 'name_en', h.keeper_spot_en,
        'lat', h.keeper_lat, 'lng', h.keeper_lng, 'landmark', h.landmark
      ) order by h.id), '[]'::jsonb) from public.hunts h
        where h.kind = 'system' and h.city_en = city.city and h.status = 'published'
          and h.starts_at <= now() and now() < h.ends_at),
      'private_quests', (select coalesce(jsonb_agg(to_jsonb(q) order by q.hunt, q.id), '[]'::jsonb)
        from private.admin_region_quests(city) q)
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.game_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cfg private.game_config; result_spawns jsonb; result_wayposts jsonb; wave bigint; wave_start timestamptz; nearby_target integer; candidate jsonb; pass integer; spawn_candidates jsonb; attempt_spawns jsonb;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  select w.wave, w.starts_at into wave, wave_start from private.game_wave_at(now()) w;
  nearby_target := ((private.game_spawn_at(wave_start)).config).nearby_spawn_target;
  -- Eligible positions are static public paths; releases are derived only for this request.
  select coalesce(jsonb_agg(jsonb_build_object(
      'spawn_id',s.spawn_id,'vessel',s.vessel,'rarity',s.rarity,
      'lat',p.lat,'lng',p.lng,'expires_at',s.expires_at,
      'attempts_left',greatest(0,cfg.max_attempts-coalesce(c.attempts,0)),
      'already_caught',coalesce(c.result='caught',false))),'[]'::jsonb) into spawn_candidates
    from public.corrupted_spots p
    cross join lateral private.resolve_spawn(p.id,wave) s
    left join public.corrupted_catches c on c.user_id=auth.uid() and c.spawn_id=s.spawn_id
    where p.lat between p_lat-cfg.action_radius_m/110000.0 and p_lat+cfg.action_radius_m/110000.0
      and p.lng between p_lng-cfg.action_radius_m/(110000.0*cos(radians(p_lat))) and p_lng+cfg.action_radius_m/(110000.0*cos(radians(p_lat)))
      and public.distance_m(p_lat,p_lng,p.lat,p.lng)<=cfg.action_radius_m
      and p.hidden_at is null
      and p.source_ref not like 'qa:roy-taipei-game:%'
      and s.expires_at>now()
;
  result_spawns := '[]'::jsonb;
  -- Stable wave-specific shuffles avoid a ring/grid. Retry spacing so one unlucky
  -- early pick does not unnecessarily reduce the count in a narrow public corridor.
  for pass in 0..7 loop
    attempt_spawns := '[]'::jsonb;
    for candidate in select value from jsonb_array_elements(spawn_candidates)
      order by case when pass=7 then (value->>'lat')::double precision
        else private.game_roll((value->>'spawn_id')||':nearby:'||pass) end,value->>'spawn_id'
    loop
      if exists(select 1 from jsonb_array_elements(attempt_spawns) chosen
        where public.distance_m((candidate->>'lat')::double precision,(candidate->>'lng')::double precision,
          (chosen->>'lat')::double precision,(chosen->>'lng')::double precision)<28) then continue;end if;
      attempt_spawns := attempt_spawns || jsonb_build_array(candidate);
      exit when jsonb_array_length(attempt_spawns)>=nearby_target;
    end loop;
    if jsonb_array_length(attempt_spawns)>jsonb_array_length(result_spawns) then result_spawns:=attempt_spawns;end if;
    exit when jsonb_array_length(result_spawns)>=nearby_target;
  end loop;
  -- Choose the wave's batch before hiding caught/exhausted releases.
  -- Removing one must leave a vacancy until the next wave, rather than refill it.
  select coalesce(jsonb_agg(value),'[]'::jsonb) into result_spawns
  from jsonb_array_elements(result_spawns)
  where not (value->>'already_caught')::boolean and (value->>'attempts_left')::integer>0;
  -- Use a conservative longitude bound at the poleward edge of the search.
  -- Shift the bound by a full turn for positions near the antimeridian.
  with bounds as (
    select 5000 / 110000.0 as lat_delta,
      case when abs(p_lat) + 5000 / 110000.0 >= 90 then 180
        else least(180, 5000 / (110000.0 * cos(radians(abs(p_lat) + 5000 / 110000.0))))
      end as lng_delta
  ), nearby as (
    select s.*, public.distance_m(p_lat,p_lng,s.lat,s.lng) as distance
    from public.public_capsule_spots s cross join bounds b
    where s.game_enabled and s.hidden_at is null
      and s.lat between p_lat-b.lat_delta and p_lat+b.lat_delta
      and (s.lng between p_lng-b.lng_delta and p_lng+b.lng_delta
        or s.lng between p_lng-b.lng_delta+360 and p_lng+b.lng_delta+360
        or s.lng between p_lng-b.lng_delta-360 and p_lng+b.lng_delta-360)
      and public.distance_m(p_lat,p_lng,s.lat,s.lng)<=5000
  ), shown as (
    select * from nearby where kind='landmark'
    union all
    (select * from nearby where kind='common' order by distance,id limit 200)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'kind',s.kind,'name_zh',s.name_zh,'name_en',s.name_en,
    'city_zh',s.city_zh,'city_en',s.city_en,'place',s.place,
    'lat',s.lat,'lng',s.lng,'scene',s.scene,'photo',s.photo,
    'cooldown_end',case when s.kind='common'
      then (select max(spun_at)+make_interval(secs=>cfg.spin_cooldown_seconds)
        from public.waypost_spins x where x.user_id=auth.uid() and x.waypost_id=s.id)
      else null end)
    || case when s.kind = 'landmark'
      then jsonb_build_object('monument',s.monument,'vessel',s.landmark_vessel,'stamp',s.landmark_stamp)
      else '{}'::jsonb end
    order by s.distance,s.id),'[]'::jsonb) into result_wayposts
  from shown s;
  return jsonb_build_object('spawns',result_spawns || private.quest_spawn_markers(p_lat,p_lng,cfg.action_radius_m),'wayposts',result_wayposts);
end $function$;

-- corrupted_nearby still delegates to game_nearby via its compatibility wrapper.

CREATE OR REPLACE FUNCTION public.landmark_start(p_waypost uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS TABLE(attempt_id uuid, cracks integer, expires_at timestamp with time zone, max_health integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  player public.player_game;
  cfg private.game_config;
  post public.public_capsule_spots;
  active public.landmark_attempts;
  started timestamptz;
begin
  player := private.track_position(p_lat,p_lng,p_accuracy);
  select * into strict cfg from private.game_config where singleton;
  select * into post from public.public_capsule_spots
    where id=p_waypost and game_enabled and kind='landmark';
  if not found or public.distance_m(p_lat,p_lng,post.lat,post.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;

  started := clock_timestamp();
  select * into active from public.landmark_attempts a
    where a.user_id=auth.uid() and a.won_at is null and a.expires_at>started
    order by a.expires_at desc limit 1 for update;
  if found then
    if active.waypost_id<>p_waypost then raise exception 'active_attempt'; end if;
  else
    insert into public.landmark_attempts(user_id,waypost_id,cracks_left,max_health,started_at,expires_at)
      values(auth.uid(),p_waypost,post.fight_health,post.fight_health,started,
        started+make_interval(secs=>post.fight_seconds))
      returning * into active;
  end if;
  if player.wax_balls + 2::bigint * player.gold_balls < active.cracks_left then
    raise exception 'no_balls';
  end if;
  attempt_id := active.id;
  cracks := active.cracks_left;
  expires_at := active.expires_at;
  max_health := active.max_health;
  return next;
end $function$;

CREATE OR REPLACE FUNCTION public.landmark_finish(p_fight uuid, p_result text, p_wax_used integer, p_gold_used integer, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  response jsonb;
  player public.player_game;
  cfg private.game_config;
  attempt public.landmark_attempts;
  post public.public_capsule_spots;
  target record;
  reward text;
  is_new boolean := false;
  xp_gained integer := 0;
  stars integer := 0;
begin
  response := private.fight_finish_receipt('landmark',p_fight);
  if response is not null then return response; end if;

  player := private.track_position(p_lat,p_lng,p_accuracy);
  select * into strict cfg from private.game_config where singleton;
  select * into strict target from private.active_landmark_attempt(p_fight,p_lat,p_lng,cfg);
  attempt := target.attempt;
  post := target.waypost;
  player := private.spend_fight_balls(p_result,p_wax_used,p_gold_used,attempt.cracks_left,attempt.started_at,player);
  if p_result='won' then
    update public.landmark_attempts set cracks_left=0,won_at=clock_timestamp() where id=p_fight;
    reward := post.landmark_vessel;
    select a.is_new, a.stars, a.xp_gained into is_new, stars, xp_gained
    from private.award_landmark_win(post,cfg.xp_landmark) a;
    begin
      perform private.city_hunt_record_quest('landmark',post.id,p_lat,p_lng);
    exception when others then
      raise warning 'hunt landmark bookkeeping failed: %',sqlerrm;
    end;
  else
    update public.landmark_attempts set expires_at=least(expires_at,clock_timestamp()) where id=p_fight;
  end if;
  response := jsonb_build_object('result',p_result,'vessel',reward,'copies',null,
    'stars',stars,'is_new',is_new,'xp_gained',xp_gained,
    'wax_balls',player.wax_balls,'gold_balls',player.gold_balls,'attempts_left',0);
  insert into private.fight_finish_receipts values('landmark',p_fight,auth.uid(),response);
  return response;
end $function$;

CREATE OR REPLACE FUNCTION public.landmark_hit(p_attempt uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_ball text, p_ring double precision)
 RETURNS TABLE(result text, cracks integer, expires_at timestamp with time zone, vessel text, copies integer, stars integer, is_new boolean, xp_gained integer, wax_balls integer, gold_balls integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pg public.player_game; cfg private.game_config; active public.landmark_attempts;
  post public.public_capsule_spots; damage integer;
begin
  if p_ball is null or p_ball not in ('wax','gold') or p_ring is null
    or p_ring::text in ('NaN','Infinity','-Infinity')
    then raise exception 'rejected'; end if;
  pg:=private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  select * into active from public.landmark_attempts
    where id=p_attempt and user_id=auth.uid() for update;
  if active.id is null or active.expires_at<=now() or active.won_at is not null
    then raise exception 'expired'; end if;
  select * into post from public.public_capsule_spots
    where id=active.waypost_id and game_enabled and kind='landmark';
  if post.id is null or public.distance_m(p_lat,p_lng,post.lat,post.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  if (p_ball='wax' and pg.wax_balls<1) or (p_ball='gold' and pg.gold_balls<1)
    then raise exception 'no_balls'; end if;
  update public.player_game set
    wax_balls=public.player_game.wax_balls-case when p_ball='wax' then 1 else 0 end,
    gold_balls=public.player_game.gold_balls-case when p_ball='gold' then 1 else 0 end
    where user_id=auth.uid() returning * into pg;
  damage:=case when p_ball='gold' or
    least(1.0,greatest(0.0,p_ring))>=cfg.landmark_strong_ring
    then cfg.landmark_strong_damage else cfg.landmark_normal_damage end;
  update public.landmark_attempts
    set cracks_left=greatest(0,cracks_left-damage),
      won_at=case when cracks_left<=damage then now() else null end
    where id=p_attempt returning cracks_left,public.landmark_attempts.expires_at
      into cracks,expires_at;
  result:='hit'; vessel:=null; copies:=null; stars:=null; is_new:=false; xp_gained:=0;
  if cracks=0 then
    vessel := post.landmark_vessel;
    select a.is_new, a.stars, a.xp_gained into is_new, stars, xp_gained
    from private.award_landmark_win(post,cfg.xp_landmark) a;
    result:='won';
    begin
      perform private.city_hunt_record_quest('landmark',post.id,p_lat,p_lng);
    exception when others then
      raise warning 'hunt landmark bookkeeping failed: %',sqlerrm;
    end;
  end if;
  wax_balls:=pg.wax_balls; gold_balls:=pg.gold_balls;
  return next;
end $function$;

CREATE OR REPLACE FUNCTION public.my_collection()
 RETURNS TABLE(vessel text, copies integer, stars integer, edition_no integer, acquired_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return query select o.vessel,o.copies,least(greatest(o.landmark_copies,1),5),o.edition_no,o.acquired_at
    from public.owned_vessels o join public.vessels v on v.id=o.vessel
    where o.user_id=auth.uid() order by v.sort,o.vessel;
end $function$;

CREATE OR REPLACE FUNCTION public.acquire_vessel(p_vessel text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.vessels; n integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v from public.vessels where id = p_vessel for share;
  if v.id is null then raise exception 'unknown vessel'; end if;
  if v.earned_only or v.earned_place is not null then raise exception 'vessel must be earned' using hint = 'earned_only'; end if;
  if v.brand is null and v.edition_total is null then
    raise exception 'vessel must be collected' using hint = 'collect_only';
  end if;
  if exists (select 1 from public.owned_vessels where user_id = auth.uid() and vessel = p_vessel) then
    raise exception 'already owned' using hint = 'owned';
  end if;
  if v.edition_total is not null then
    perform pg_advisory_xact_lock(hashtext('vessel:' || p_vessel));   -- number editions one at a time
    select coalesce(max(edition_no), 0) + 1 into n from public.owned_vessels where vessel = p_vessel;
    if n > v.edition_total then raise exception 'sold out' using hint = 'sold_out'; end if;
  end if;
  insert into public.owned_vessels (user_id, vessel, edition_no, copies)
    values (auth.uid(), p_vessel, n, case when v.unlimited_copies then null else 10 end);
  return n;
end $function$;

CREATE OR REPLACE FUNCTION private.admin_spawnable(p_vessel text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.vessels v where v.id = p_vessel
    and v.id not in ('dome','bottle','envelope','tin')
    and not v.earned_only and v.earned_place is null and v.brand is null and v.edition_total is null)
  then raise exception 'not_spawnable'; end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_spawning()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  return (
    with cities as materialized (
      select g.*, date_trunc('day', now() at time zone g.timezone) at time zone g.timezone as day_start,
        date_trunc('week', now() at time zone g.timezone) at time zone g.timezone as week_start
      from private.game_regions g where g.center_lat is not null
    ), caught as (
      select p.city, count(*) filter (where c.caught_at >= g.day_start) as today, count(*) as week
      from cities g join public.corrupted_spots p on p.city = g.city
      join public.corrupted_catches c on split_part(c.spawn_id, ':', 1) = p.id::text
      where c.result = 'caught' and c.caught_at >= g.week_start
        and p.source_ref not like 'qa:roy-taipei-game:%'
      group by p.city
    )
    select jsonb_build_object(
      'config', jsonb_build_object(
        'wave_minutes', (select w.minutes from private.game_wave_at(now()) w),
        'next_length', (select jsonb_build_object('minutes', w.minutes, 'starts_at', w.starts_at)
          from private.game_wave_periods w where w.starts_at > now() order by w.starts_at limit 1),
        'spin_wax_min', spin.reward->'spin_wax_min', 'spin_wax_max', spin.reward->'spin_wax_max',
        'spawn_chance', cfg.spawn_chance, 'nearby_max', cfg.nearby_spawn_target,
        'copies_per_catch', (select copies_per_catch from private.vessel_copy_settings where singleton),
        'weights', jsonb_build_object('common', cfg.rarity_common_weight,
          'uncommon', cfg.rarity_uncommon_weight, 'rare', cfg.rarity_rare_weight)),
      'places', (select jsonb_agg(jsonb_build_object('id', g.id, 'parent', g.parent_id,
        'name_zh', g.name_zh, 'name_en', g.name_en, 'country_zh', g.country_zh, 'country_en', g.country_en,
        'has_spots', exists (select 1 from private.game_regions child
          join public.corrupted_spots p on p.city = child.city and p.source_ref not like 'qa:%'
          where g.id in (child.id, child.parent_id))) order by g.country_en, g.name_en)
        from private.game_regions g),
      'rules', (select coalesce(jsonb_agg(jsonb_build_object(
        'vessel', v.id, 'unlimited_copies', v.unlimited_copies, 'rarity', r.rarity, 'habitat', r.habitat,
        'hours', case when r.local_start_hour is not null then jsonb_build_array(r.local_start_hour, (r.local_end_hour + 23) % 24) end,
        'dates', case when r.month_day_start is not null then jsonb_build_array(r.month_day_start, r.month_day_end) end,
        'regions', (select coalesce(jsonb_agg(g.id order by g.id), '[]'::jsonb) from cities g
          where exists (select 1 from private.vessel_spawn_places a where a.vessel = v.id
            and a.region_id in (g.id, g.parent_id))),
        'places', (select coalesce(jsonb_agg(a.region_id order by a.region_id), '[]'::jsonb)
          from private.vessel_spawn_places a where a.vessel = v.id),
        'never', case when v.earned_only or v.earned_place is not null then 'earned'
          when v.brand is not null or v.edition_total is not null then 'brand'
          when v.id in ('dome', 'bottle', 'envelope', 'tin') then 'starter' end
        ) order by v.sort, v.id), '[]'::jsonb)
        from public.vessels v left join private.vessel_spawn_rules r on r.vessel = v.id),
      'stats', (select coalesce(jsonb_object_agg(g.id, jsonb_build_object(
        'out_now', (select count(*) from private.admin_wave(g.city) where not caught),
        'caught_today', coalesce(c.today, 0), 'caught_week', coalesce(c.week, 0))), '{}'::jsonb)
        from cities g left join caught c on c.city = g.city)
    )
    from private.game_config cfg
    cross join (select private.admin_spin_reward_state() as reward) spin where cfg.singleton
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_vessel_set_unlimited(vessel_id text, "on" boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  before_state jsonb;
  after_state jsonb;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  if "on" is null then raise exception 'invalid_unlimited'; end if;
  perform 1 from public.vessels where id = vessel_id for update;
  if not found then raise exception 'unknown vessel'; end if;
  before_state := private.vessel_copy_snapshot(vessel_id);
  if (before_state->>'unlimited_copies')::boolean = "on" then
    return jsonb_build_object('unlimited_copies', "on");
  end if;
  if not "on" and exists (select 1 from public.vessels
    where id = vessel_id and (id in ('dome','bottle','envelope','tin') or earned_only or earned_place is not null))
  then raise exception 'required_unlimited'; end if;

  update public.vessels set unlimited_copies = "on" where id = vessel_id;
  update public.owned_vessels set copies = case when "on" then null else 10 end where vessel = vessel_id;
  after_state := private.vessel_copy_snapshot(vessel_id);
  perform private.admin_log('vessel.unlimited', 'vessel_copies', vessel_id, vessel_id, before_state, after_state);
  return jsonb_build_object('unlimited_copies', "on");
end $function$;

-- Both fight entry points share the same award. Player state is already locked
-- by track_position, so the ownership check and increment serialize per user.
create function private.award_landmark_win(p_post public.public_capsule_spots, p_xp integer)
returns table(is_new boolean, stars integer, xp_gained integer)
language plpgsql set search_path = '' as $$
declare
  reward text := p_post.landmark_vessel;
  legacy_place text := p_post.place;
  won_copies integer;
begin
  is_new := not exists (select from public.owned_vessels o where o.user_id = auth.uid() and o.vessel = reward);
  insert into public.owned_vessels as o (user_id, vessel, copies, landmark_copies)
    values (auth.uid(), reward, null, 1)
    on conflict on constraint owned_vessels_pkey do update
      set landmark_copies = greatest(1, o.landmark_copies) + 1
    returning landmark_copies into won_copies;
  stars := least(won_copies, 5);

  if legacy_place is not null then
    insert into public.passport_stamps(user_id, place, first_at, how_earned)
      values (auth.uid(), legacy_place, now(), 'landmark') on conflict (user_id, place) do nothing;
  end if;
  insert into private.landmark_passport_stamps(user_id, waypost_id, stamp, first_at)
    values (auth.uid(), p_post.id, p_post.landmark_stamp,
      coalesce((select s.first_at from public.passport_stamps s
        where s.user_id = auth.uid() and s.place = legacy_place), now()))
    on conflict (user_id, waypost_id) do nothing;
  xp_gained := private.award_xp(auth.uid(), 'landmark_win', coalesce(legacy_place, p_post.id::text), p_xp);
  return next;
end;
$$;

drop function public.my_passport();
create function public.my_passport()
returns table(place text, name_zh text, name_en text, city_zh text, city_en text,
  first_at timestamptz, how_earned text, stamp text, waypost_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return query
    select q.place, q.name_zh, q.name_en, q.city_zh, q.city_en, q.first_at, q.how_earned, q.stamp, q.waypost_id
    from (
      select coalesce(w.place,w.id::text) as place, w.name_zh, w.name_en, w.city_zh, w.city_en,
        s.first_at, 'landmark'::text as how_earned, s.stamp, s.waypost_id, coalesce(p.sort,2147483647) as place_sort
      from private.landmark_passport_stamps s join public.public_capsule_spots w on w.id=s.waypost_id
      left join public.places p on p.id=w.place
      where s.user_id=auth.uid()
      union all
      select p.id,p.name_zh,p.name_en,p.city_zh,p.city_en,
        s.first_at,s.how_earned,null::text,null::uuid,p.sort
      from public.passport_stamps s join public.places p on p.id=s.place
      where s.user_id=auth.uid() and not exists (
        select from private.landmark_passport_stamps l
        join public.public_capsule_spots w on w.id=l.waypost_id
        where l.user_id=s.user_id and w.place=s.place
      )
      union all
      select h.id,h.name_zh,h.name_en,h.city_zh,h.city_en,
        s.first_at,'hunt'::text,null::text,null::uuid,2147483647
      from public.city_hunt_passport_stamps s join public.hunts h on h.id=s.hunt_id
      where s.user_id=auth.uid()
      union all
      select h.id,h.name_zh,h.name_en,''::text,''::text,
        m.reward_collected_at,'private_hunt'::text,null::text,null::uuid,2147483647
      from public.private_hunt_members m join public.hunts h on h.id=m.hunt_id
      where m.user_id=auth.uid() and m.reward_collected_at is not null and h.kind='private'
    ) q order by q.first_at,q.place_sort,q.place;
end;
$$;

revoke all on table private.landmark_passport_stamps from public, anon, authenticated, service_role;
revoke all on function private.validate_monument(jsonb), private.landmark_fields(public.public_capsule_spots),
  private.save_landmark(public.public_capsule_spots,jsonb),
  private.award_landmark_win(public.public_capsule_spots,integer),
  public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text,text,text,text,text,jsonb),
  public.admin_landmark_set(uuid,jsonb,text), public.my_passport()
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_waypost_add(text,double precision,double precision,text,text,text,boolean,text,text,text,text,text,jsonb),
  public.admin_landmark_set(uuid,jsonb,text) to authenticated;
grant execute on function public.my_passport() to authenticated, service_role;

commit;
