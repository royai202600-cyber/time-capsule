-- In a rollback transaction, capture pg_temp.landmark_named_before (full
-- Waypost rows for the three seeded Landmarks) and pg_temp.landmark_named_audit
-- (count of earlier migration Activity rows) before loading the migration twice.
do $$
declare
  original public.public_capsule_spots;
  current_post public.public_capsule_spots;
  editor uuid := gen_random_uuid();
  event_id bigint;
  expected_monument jsonb;
  bad_model jsonb;
  prior_audits integer;
  edited public.public_capsule_spots;
begin
  select count into strict prior_audits from pg_temp.landmark_named_audit;
  assert (select count(*) from pg_temp.landmark_named_before) = 3;
  assert (select count(*) from private.admin_actions
    where note='Convert the three seeded custom Landmark shapes to named models.') = prior_audits + 1,
    'Reapplying created a second migration Activity row';
  select id into strict event_id from private.admin_actions
    where note='Convert the three seeded custom Landmark shapes to named models.'
    order by id desc limit 1;

  insert into auth.users(id,email) values(editor,'landmark-named-models-'||editor||'@example.invalid');
  insert into public.profiles(id,name) values(editor,'Named Landmark rollback') on conflict do nothing;
  insert into private.admin_members(user_id,role) values(editor,'admin');
  perform set_config('request.jwt.claim.sub',editor::text,true);

  for original in select * from pg_temp.landmark_named_before order by place loop
    select * into strict current_post from public.public_capsule_spots w where id=original.id;
    expected_monument := (original.monument - 'custom') || jsonb_build_object('model',jsonb_build_object(
      'kind',original.place,'size','m','rotate',0,'color',original.monument#>>'{custom,color}'
    ));
    assert current_post.monument is not distinct from expected_monument;
    assert current_post.monument->'buildings' is not distinct from original.monument->'buildings';
    assert to_jsonb(current_post)-'monument' = to_jsonb(original)-'monument', 'Conversion changed other fields';

    -- Exercise the authenticated write path without making the migration Undo stale.
    begin
      perform public.admin_landmark_set(current_post.id,private.landmark_fields(current_post));
      raise exception 'rollback_named_save';
    exception when raise_exception then
      if sqlerrm <> 'rollback_named_save' then raise; end if;
    end;
    bad_model := jsonb_set(private.landmark_fields(current_post),'{monument,model,kind}','"unknown-test-model"');
    begin
      perform public.admin_landmark_set(current_post.id,bad_model);
      raise exception 'unknown_model_accepted';
    exception when raise_exception then
      if sqlerrm <> 'bad_monument' then raise; end if;
    end;
  end loop;

  perform public.admin_undo(event_id);
  assert not exists (
    select from pg_temp.landmark_named_before b join public.public_capsule_spots w using (id)
    where to_jsonb(b) is distinct from to_jsonb(w)
  ), 'Activity Undo failed to restore all three exact rows';

  -- Check that existing clients can still save the original custom shape.
  select * into strict edited from public.public_capsule_spots where kind='landmark' and place='hkust';
  perform public.admin_landmark_set(edited.id,private.landmark_fields(edited));
end;
$$;

select 'PASS named-model saves, unknown refusal, exact buildings and Waypost fields, one idempotent Activity row, Undo and legacy custom saves' as result;
