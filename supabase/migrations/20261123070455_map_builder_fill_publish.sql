-- Fill an area can publish immediately or save its two kinds as one draft group.
begin;

-- Replace the old signatures so omitted defaults still select exactly one RPC.
drop function public.admin_waypost_add_batch(text,jsonb,text);
drop function public.admin_spot_add_batch(text,jsonb,text);
drop function private.add_map_places_batch(text,text,jsonb,text);

create function private.add_map_places_batch(p_kind text, p_region text, p_items jsonb, p_note text,
  p_status text, p_batch uuid) returns jsonb language plpgsql set search_path = '' as $$
declare
  item jsonb;
  idx integer;
  post public.public_capsule_spots;
  spot public.corrupted_spots;
  saved jsonb;
  ids text[] := '{}';
  added jsonb := '[]';
  skipped jsonb := '[]';
  snapshots jsonb := '{}';
  lat double precision;
  lng double precision;
  label text;
  reason text;
  action_id bigint;
begin
  perform private.require_game_editor();
  perform private.lock_game_edits();
  if p_status is null or p_status not in ('draft', 'live') then raise exception 'bad_status'; end if;
  if not exists (select 1 from private.game_regions where id = p_region and border is not null)
  then raise exception 'outside_border'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'bad_item'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'too_many'; end if;

  for item, idx in select value, ordinality::integer - 1
    from jsonb_array_elements(p_items) with ordinality
  loop
    begin
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'lat') is distinct from 'number'
        or jsonb_typeof(item->'lng') is distinct from 'number' then raise exception 'bad_item'; end if;
      lat := (item->>'lat')::double precision;
      lng := (item->>'lng')::double precision;
      if p_kind = 'waypost' then
        if jsonb_typeof(item->'name_zh') is distinct from 'string'
          or jsonb_typeof(item->'name_en') is distinct from 'string'
          or nullif(btrim(item->>'name_en'), '') is null then raise exception 'bad_name'; end if;
        post := private.create_map_waypost(p_region, lat, lng,
          item->>'name_zh', item->>'name_en', item->>'scene', null, null, p_status);
        saved := to_jsonb(post);
        label := coalesce(label, post.name_en);
      else
        spot := private.create_map_spot(p_region, lat, lng, item->>'habitat', p_status);
        saved := to_jsonb(spot);
        label := coalesce(label, spot.city);
      end if;
      ids := array_append(ids, saved->>'id');
      snapshots := snapshots || jsonb_build_object(saved->>'id', saved);
      added := added || jsonb_build_array(saved);
    exception
      when numeric_value_out_of_range then
        skipped := skipped || jsonb_build_array(jsonb_build_object('index', idx, 'reason', 'bad_item'));
      when raise_exception then
        get stacked diagnostics reason = message_text;
        if reason not in ('bad_item', 'bad_name', 'bad_scene', 'bad_habitat', 'outside_border', 'cell_taken')
        then raise; end if;
        skipped := skipped || jsonb_build_array(jsonb_build_object('index', idx, 'reason', reason));
    end;
  end loop;

  if cardinality(ids) > 0 then
    if cardinality(ids) > 1 then label := label || ' +' || (cardinality(ids) - 1); end if;
    insert into private.admin_actions (actor, actor_snapshot, action, target_type, target_id, target_label,
      before, after, note)
    values (auth.uid(), private.admin_person(auth.uid()), p_kind || '.add_batch', p_kind || '_batch',
      array_to_string(ids, ','), label, null,
      jsonb_build_object('count', cardinality(ids), 'rows', snapshots, 'batch', p_batch), p_note)
    returning id into action_id;
  end if;
  return jsonb_build_object('added', added, 'skipped', skipped, 'action_id', action_id);
end;
$$;

create function public.admin_waypost_add_batch(p_region text, p_items jsonb, p_note text default null,
  p_status text default 'draft', p_batch uuid default null) returns jsonb language sql security definer set search_path = '' as $$
  select private.add_map_places_batch('waypost', p_region, p_items, p_note, p_status, p_batch);
$$;

create function public.admin_spot_add_batch(p_region text, p_items jsonb, p_note text default null,
  p_status text default 'draft', p_batch uuid default null) returns jsonb language sql security definer set search_path = '' as $$
  select private.add_map_places_batch('spot', p_region, p_items, p_note, p_status, p_batch);
$$;

create function public.admin_city_drafts(p_region text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  city_name text;
begin
  perform private.require_game_editor();
  select r.city into city_name from private.game_regions r where r.id = p_region;
  if not found then raise exception 'not_found'; end if;

  return (
    with drafts as materialized (
      select 'waypost' as kind, w.id
      from public.public_capsule_spots w where w.city_en = city_name and w.status = 'draft'
      union all
      select 'spot', s.id from public.corrupted_spots s where s.city = city_name and s.status = 'draft'
    ), creators as (
      select distinct on (d.kind, d.id) d.kind, d.id, a.id as action_id, a.at, a.actor, a.actor_snapshot,
        case when a.action in ('waypost.add_batch', 'spot.add_batch')
          then coalesce(a.after->>'batch', a.id::text) end as batch
      from private.admin_actions a
      cross join lateral unnest(string_to_array(a.target_id, ',')) as targets(id)
      join drafts d on d.id::text = targets.id and d.kind = split_part(a.action, '.', 1)
      where a.action in ('waypost.add', 'spot.add', 'waypost.add_batch', 'spot.add_batch')
      order by d.kind, d.id, a.id
    ), grouped as (
      select c.batch, max(c.at) as at,
        (array_agg(c.actor_snapshot order by c.at desc nulls last, c.action_id desc nulls last))[1] as actor,
        coalesce(jsonb_agg(d.id order by d.id) filter (where d.kind = 'waypost'), '[]') as wayposts,
        coalesce(jsonb_agg(d.id order by d.id) filter (where d.kind = 'spot'), '[]') as spots
      from drafts d left join creators c using (kind, id)
      group by c.batch, case when c.batch is null then c.actor end
    )
    select coalesce(jsonb_agg(to_jsonb(g) order by g.at desc nulls last, g.batch, g.actor->>'id'), '[]')
    from grouped g
  );
end;
$$;

revoke all on function
  private.add_map_places_batch(text,text,jsonb,text,text,uuid),
  public.admin_waypost_add_batch(text,jsonb,text,text,uuid),
  public.admin_spot_add_batch(text,jsonb,text,text,uuid),
  public.admin_city_drafts(text)
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_waypost_add_batch(text,jsonb,text,text,uuid),
  public.admin_spot_add_batch(text,jsonb,text,text,uuid),
  public.admin_city_drafts(text)
to authenticated;

notify pgrst, 'reload schema';

commit;
