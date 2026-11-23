-- Run after loading the held migration, inside a transaction that is rolled back.
do $$
declare
  editor uuid;
  batch uuid := gen_random_uuid();
  live_batch uuid := gen_random_uuid();
  points jsonb;
  point_a jsonb;
  point_b jsonb;
  post_item jsonb;
  spot_item jsonb;
  response jsonb;
  live_post jsonb;
  live_spot jsonb;
  draft_post jsonb;
  draft_spot jsonb;
  legacy_post jsonb;
  single_post jsonb;
  single_spot jsonb;
  bare_spot public.corrupted_spots;
  groups jsonb;
  mixed jsonb;
  newest timestamptz;
  undone jsonb;
  saved jsonb;
  action_ids bigint[] := '{}';
  id bigint;
begin
  select m.user_id into strict editor from private.admin_members m
    join public.profiles p on p.id = m.user_id where m.role in ('owner', 'admin')
    order by (m.role = 'owner') desc, m.user_id limit 1;
  perform set_config('request.jwt.claim.sub', editor::text, true);

  with candidates as (
    select 25.062 + i*0.0006 lat, 121.552 + j*0.0006 lng
    from generate_series(-7,7) i cross join generate_series(-7,7) j
  ), free as (
    select distinct on (cell) c.lat, c.lng, cell
    from candidates c cross join lateral private.s2_cell17(c.lat,c.lng) cell
    where private.admin_inside_border('taipei',c.lat,c.lng)
      and not exists (select from public.public_capsule_spots p where p.status <> 'deleted' and p.s2_cell17 = cell)
    order by cell,c.lat,c.lng limit 4
  )
  select jsonb_agg(jsonb_build_object('lat',lat,'lng',lng)) into points from free;
  if jsonb_array_length(points) is distinct from 4 then raise exception 'not enough free fixture cells'; end if;
  point_a := points->0; point_b := points->1;
  post_item := jsonb_build_object('name_zh','測試廣場','name_en','Fill publish rollback','scene','square');
  spot_item := jsonb_build_object('habitat','park');

  live_post := public.admin_waypost_add_batch('taipei',jsonb_build_array(post_item || point_a),null,'live',live_batch);
  live_spot := public.admin_spot_add_batch('taipei',jsonb_build_array(spot_item || point_b),null,'live',live_batch);
  if live_post->'added'->0->>'status' is distinct from 'live'
    or live_post->'added'->0->>'game_enabled' is distinct from 'true'
    or live_post->'added'->0->>'hidden_at' is not null
    or live_spot->'added'->0->>'status' is distinct from 'live'
    or live_spot->'added'->0->>'first_spawn_wave' is null
    or live_spot->'added'->0->>'hidden_at' is not null
  then raise exception 'live defaults did not match publishing'; end if;

  draft_post := public.admin_waypost_add_batch('taipei',jsonb_build_array(post_item || point_b),null,'draft',batch);
  draft_spot := public.admin_spot_add_batch('taipei',jsonb_build_array(spot_item || point_a),null,'draft',batch);
  if draft_post->'added'->0->>'game_enabled' is distinct from 'false'
    or draft_spot->'added'->0->>'status' is distinct from 'draft'
  then raise exception 'batch did not save as draft'; end if;
  select array_agg((a->>'action_id')::bigint) into action_ids
    from jsonb_array_elements(jsonb_build_array(live_post, live_spot, draft_post, draft_spot)) a;
  if array_position(action_ids,null::bigint) is not null or
    (select count(*) from private.admin_actions a where a.id = any(action_ids)
      and a.after->>'batch' in (batch::text,live_batch::text)) <> 4
  then raise exception 'activity metadata did not match results'; end if;
  response := public.admin_waypost_add_batch('taipei',jsonb_build_array(post_item || point_a));
  if response->'action_id' is distinct from 'null'::jsonb or response->'skipped'->0->>'reason' is distinct from 'cell_taken'
  then raise exception 'skipped rows changed the response'; end if;

  legacy_post := public.admin_waypost_add_batch('taipei',jsonb_build_array(post_item || (points->2)));
  single_post := public.admin_waypost_add('taipei',(points->3->>'lat')::double precision,
    (points->3->>'lng')::double precision,'測試廣場','Single draft','square',p_status => 'draft');
  single_spot := public.admin_spot_add('taipei',(point_a->>'lat')::double precision,
    (point_a->>'lng')::double precision,'square',p_status => 'draft');
  bare_spot := private.create_map_spot('taipei',(point_b->>'lat')::double precision,
    (point_b->>'lng')::double precision,'square','draft');

  groups := public.admin_city_drafts('taipei');
  select g into strict mixed from jsonb_array_elements(groups) g where g->>'batch' = batch::text;
  select max(a.at) into newest from private.admin_actions a
    where a.id in ((draft_post->>'action_id')::bigint, (draft_spot->>'action_id')::bigint);
  if mixed->'wayposts' is distinct from jsonb_build_array(draft_post->'added'->0->'id')
    or mixed->'spots' is distinct from jsonb_build_array(draft_spot->'added'->0->'id')
    or mixed->'actor'->>'id' is distinct from editor::text
    or (mixed->>'at')::timestamptz is distinct from newest
    or not exists(select from jsonb_array_elements(groups) g
      where g->>'batch' = legacy_post->>'action_id' and (g->'wayposts') ? (legacy_post->'added'->0->>'id'))
    or not exists(select from jsonb_array_elements(groups) g where g->>'batch' is null
      and g->'actor'->>'id' = editor::text and (g->'wayposts') ? (single_post->>'id') and (g->'spots') ? (single_spot->>'id'))
    or not exists(select from jsonb_array_elements(groups) g where g->'actor' = 'null'::jsonb
      and g->'at' = 'null'::jsonb and g->'batch' = 'null'::jsonb and (g->'spots') ? bare_spot.id::text)
    or exists(select from jsonb_array_elements(groups) g where g->>'batch' = live_batch::text)
    or exists(select from jsonb_array_elements(public.admin_city_drafts('hong-kong')) g where g->>'batch' = batch::text)
    or exists(select from jsonb_array_elements(groups) with ordinality a(g,i)
      join jsonb_array_elements(groups) with ordinality b(g,i) on b.i = a.i + 1
      where a.g->>'at' is null and b.g->>'at' is not null
        or (a.g->>'at')::timestamptz < (b.g->>'at')::timestamptz)
  then raise exception 'draft groups incorrect'; end if;

  foreach id in array action_ids || (legacy_post->>'action_id')::bigint loop
    undone := public.admin_undo(id);
    for saved in select value from jsonb_each(undone) loop
      if saved->>'status' is distinct from 'deleted' then raise exception 'batch undo failed'; end if;
    end loop;
  end loop;
  if exists(select from jsonb_array_elements(public.admin_city_drafts('taipei')) g where g->>'batch' = batch::text)
  then raise exception 'undone batch still in Drafts'; end if;

  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin
    perform public.admin_city_drafts('taipei');
    raise exception 'non-editor read Drafts';
  exception when raise_exception then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
end;
$$;
