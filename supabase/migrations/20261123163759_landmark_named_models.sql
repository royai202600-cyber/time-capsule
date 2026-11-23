-- Release after the client can draw the three named Landmark models.
begin;

select private.lock_game_edits();

-- Older clients may still send custom tiers.
create or replace function private.validate_monument(p_monument jsonb)
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
        or not coalesce(shape->>'kind' in (
          'tower','pagoda','gate','fountain','column','pavilion','dome','statue','taipei101','senado','hkust'),false)
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

-- A builder may have added a model alongside the custom tiers while this
-- migration was held. Stop for review if converting would replace that model.
do $$
begin
  if exists (
    select from public.public_capsule_spots w
    where w.kind = 'landmark' and w.place in ('taipei101','senado','hkust')
      and jsonb_typeof(w.monument->'custom') = 'object'
      and nullif(w.monument->'model', 'null'::jsonb) is not null
  ) then raise exception 'landmark_named_model_conflict'; end if;
end;
$$;

with candidates as materialized (
  select w.id, to_jsonb(w) as before,
    (w.monument - 'custom') || jsonb_build_object('model', jsonb_build_object(
      'kind', w.place,
      'size', 'm',
      'rotate', 0,
      'color', w.monument#>>'{custom,color}'
    )) as monument
  from public.public_capsule_spots w
  where w.kind = 'landmark' and w.place in ('taipei101','senado','hkust')
    and jsonb_typeof(w.monument->'custom') = 'object'
  order by w.id
  for update
), changed as (
  update public.public_capsule_spots w
  set monument = c.monument
  from candidates c
  where w.id = c.id
  returning w.id, w.name_en, c.before, to_jsonb(w) as after
)
insert into private.admin_actions (actor, actor_snapshot, action, target_type,
  target_id, target_label, before, after, note)
select '00000000-0000-0000-0000-000000000000',
  '{"id":"00000000-0000-0000-0000-000000000000","name":"Map Builder migration","avatar":null}',
  'landmark.set', 'waypost_batch',
  string_agg(id::text, ',' order by id),
  string_agg(name_en, ', ' order by id),
  jsonb_object_agg(id, before),
  jsonb_build_object('rows', jsonb_object_agg(id, after), 'count', count(*)),
  'Convert the three seeded custom Landmark shapes to named models.'
from changed
having count(*) > 0;

commit;
