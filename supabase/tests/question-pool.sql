-- Run after the pool migration, before rolling back.
select pg_temp.pool_eq(public.city_puzzle_today(),current_setting('test.ce1_before')::jsonb,'CE1 today');
select pg_temp.pool_eq(public.city_puzzle_guess('taipei',0.01),
  current_setting('test.ce1_guess_before')::jsonb,'CE1 guess');

do $$
begin
  assert (select count(*) = 80 and count(location_lat) = 0 from private.question_pool);
  assert not has_table_privilege('authenticated','private.question_pool_secrets','SELECT');
  assert not has_function_privilege('anon','public.admin_question_pool_list(text,text,uuid)','EXECUTE');
end $$;

set local role authenticated;
do $$
declare q jsonb;
declare q_id uuid;
declare action_id bigint;
begin
  for n in 1..4 loop
    perform pg_temp.pool_user(n);
    q := public.admin_question_pool_list('taipei','published',null);
    assert jsonb_array_length(q->'items') = 20;
    assert q->'items'->0->'uses'->0->>'context' = 'city_puzzle';
    assert not ((q->'items'->0) ?| array['answer','local_amount','typed_aliases','usd']);
  end loop;
  for n in 3..5 loop
    perform pg_temp.pool_user(n);
    perform pg_temp.pool_expect('select public.admin_question_pool_save(null)','forbidden');
    perform pg_temp.pool_expect('select public.admin_question_pool_set_status(null,null)','forbidden');
  end loop;
  perform pg_temp.pool_expect('select public.admin_question_pool_list(null)','forbidden');

  perform pg_temp.pool_user(2);
  q := public.admin_question_pool_save(
    '{"city":"taipei","type":"question","place_zh":"廣場","place_en":"Square","prompt_zh":"問題","prompt_en":"Prompt",
      "kind":"text","answer":"answer-fixture","typed_aliases":["alias-fixture"],"checked_on":"2024-01-01",
      "source_url":"https://example.invalid","location_lat":25,"location_lng":121}');
  assert not (q ?| array['answer','typed_aliases']);
  q_id := (q->>'id')::uuid;
  q := public.admin_question_pool_set_status(q_id,'published');
  assert q->>'status' = 'published';
  q := public.admin_question_pool_list('taipei','needs_recheck',null);
  assert (q->'items') @> jsonb_build_array(jsonb_build_object('id',q_id,'needs_recheck',true));
  q := public.admin_question_pool_save(jsonb_build_object('id',q_id,'answer','new-answer','prompt_en','Updated prompt'));
  perform set_config('test.pool_id',q_id::text,true);
end $$;
reset role;

do $$
declare q_id uuid := current_setting('test.pool_id')::uuid;
declare event private.admin_actions;
begin
  select * into strict event from private.admin_actions
    where target_id=q_id::text and action='question_pool.edit';
  assert event.before->>'prompt_en' = 'Prompt' and event.after->>'prompt_en' = 'Updated prompt';
  assert not (event.after ? 'answer') and not (event.before ? 'answer');
  perform pg_temp.pool_user(1);
  perform public.admin_undo(event.id);
  assert (select answer = '"answer-fixture"'::jsonb from private.question_pool_secrets where id=q_id);
  assert (select prompt_en = 'Prompt' from private.question_pool where id=q_id);
  perform pg_temp.pool_expect(format('select public.admin_undo(%s)',event.id),'stale');
end $$;
select 'PASS: question pool, admin roles and audit, CE1 output' as result;
