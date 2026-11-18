-- CE1 retains an immutable compatibility catalog for its dated rotation, existing
-- plays and wager responses. Import its 80 questions into the editable pool.
create table private.question_pool (
  id uuid primary key default gen_random_uuid(),
  city text not null check (city in ('taipei','hongkong','macau','singapore')),
  type text not null check (type in ('question','price')),
  place_zh text not null check (btrim(place_zh) <> ''),
  place_en text not null check (btrim(place_en) <> ''),
  location_lat double precision,
  location_lng double precision,
  prompt_zh text not null check (btrim(prompt_zh) <> ''),
  prompt_en text not null check (btrim(prompt_en) <> ''),
  kind text,
  choices jsonb,
  currency text,
  rate numeric,
  source_url text check (source_url ~ '^https://[^[:space:]]+$'),
  checked_on date,
  photo text,
  photo_credit text,
  photo_license text,
  photo_link text,
  vessel text references public.vessels(id),
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  legacy_price_id bigint unique references public.city_puzzle_questions(id),
  check (num_nonnulls(location_lat, location_lng) = 0 or
    (num_nonnulls(location_lat, location_lng) = 2 and location_lat between -90 and 90 and location_lng between -180 and 180)),
  check (num_nonnulls(photo, photo_credit, photo_license) in (0, 3)),
  check (type <> 'price' or (nullif(btrim(currency), '') is not null and rate is not null and rate > 0 and rate < 'Infinity'::numeric)),
  check (type <> 'question' or (kind is not null and kind in ('choice','text') and
    case when kind = 'choice' then jsonb_typeof(choices) is not distinct from 'array' else choices is null end)),
  check (status <> 'published' or (source_url is not null and checked_on is not null))
);
create index question_pool_city_page on private.question_pool(city, id);
create index question_pool_vessel on private.question_pool(vessel) where vessel is not null;

create table private.question_pool_secrets (
  id uuid primary key references private.question_pool(id) on delete cascade,
  answer jsonb,
  typed_aliases text[],
  usd numeric check (usd > 0 and usd < 'Infinity'::numeric),
  local_amount numeric check (local_amount > 0 and local_amount < 'Infinity'::numeric)
);
-- Audit Activity can display metadata; only the undo path can read these snapshots.
create table private.question_pool_audit_secrets (
  action_id bigint primary key references private.admin_actions(id),
  before jsonb
);
alter table private.question_pool enable row level security;
alter table private.question_pool_secrets enable row level security;
alter table private.question_pool_audit_secrets enable row level security;
revoke all on private.question_pool, private.question_pool_secrets, private.question_pool_audit_secrets
  from public, anon, authenticated, service_role;

insert into private.question_pool (city,type,place_zh,place_en,prompt_zh,prompt_en,currency,rate,
  source_url,checked_on,photo,photo_credit,photo_license,photo_link,vessel,status,legacy_price_id)
select city,'price',venue_zh,venue_en,question_zh,question_en,currency,usd_rate,source,checked_on,
  case when photo_path is not null then 'city-puzzle/' || photo_path end, photo_credit,photo_license,photo_link,vessel,
  case when published then 'published' else 'draft' end,id
from public.city_puzzle_questions;

insert into private.question_pool_secrets(id,usd,local_amount)
select p.id,round(q.local_price/q.usd_rate,2),q.local_price
from private.question_pool p join public.city_puzzle_questions q on q.id = p.legacy_price_id;

create function private.question_pool_uses(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('context','city_puzzle','id',legacy_price_id)), '[]')
  from private.question_pool where id = p_id and legacy_price_id is not null
$$;

create function public.admin_question_pool_list(city text, filter text default null, cursor uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  if filter is not null and filter not in ('all','draft','published','hidden','needs_recheck')
  then raise exception 'bad_filter'; end if;
  return (
    with page as (
      select p.*, coalesce(p.checked_on < (current_date - interval '6 months')::date,false) as needs_recheck
      from private.question_pool p
      where (admin_question_pool_list.city is null or p.city = admin_question_pool_list.city)
        and (cursor is null or p.id > cursor)
        and (filter is null or filter = 'all' or p.status = filter
          or (filter = 'needs_recheck' and p.checked_on < (current_date - interval '6 months')::date))
      order by p.id limit 51
    ), numbered as (select *, row_number() over (order by id) as n from page)
    select jsonb_build_object('items',coalesce(jsonb_agg(
      (to_jsonb(numbered) - 'n') || jsonb_build_object('uses',private.question_pool_uses(id))
      order by id) filter (where n <= 50),'[]'),
      'next_cursor',case when count(*) = 51 then (array_agg(id order by n))[50] end)
    from numbered
  );
end $$;

create function private.log_question_pool(
  p_action text, p_id uuid, p_label text, p_before jsonb, p_after jsonb, p_secret jsonb, p_note text default null
) returns void language plpgsql set search_path = '' as $$
declare action_id bigint;
begin
  insert into private.admin_actions(actor,actor_snapshot,action,target_type,target_id,target_label,before,after,note)
  values (auth.uid(),private.admin_person(auth.uid()),p_action,'question_pool',p_id::text,p_label,p_before,p_after,p_note)
  returning id into action_id;
  insert into private.question_pool_audit_secrets values(action_id,p_secret);
end $$;

create function public.admin_question_pool_save(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prior private.question_pool;
  saved private.question_pool;
  prior_secret private.question_pool_secrets;
  secret private.question_pool_secrets;
  target uuid := (payload->>'id')::uuid;
  choice numeric;
begin
  perform private.require_game_editor();
  if jsonb_typeof(payload) is distinct from 'object' then raise exception 'bad_rule'; end if;
  if target is not null then
    select * into prior from private.question_pool where id = target for update;
    if not found then raise exception 'not_found'; end if;
    select * into strict prior_secret from private.question_pool_secrets where id = target;
  end if;
  saved := jsonb_populate_record(prior,payload);
  saved.id := coalesce(target,gen_random_uuid());
  saved.status := coalesce(prior.status,'draft');
  saved.legacy_price_id := prior.legacy_price_id;
  secret := jsonb_populate_record(prior_secret,payload);
  secret.id := saved.id;
  if saved.type = 'price' then
    saved.kind := null;
    saved.choices := null;
    secret.answer := null;
    secret.typed_aliases := null;
    if saved.rate is null or saved.rate <= 0 or secret.local_amount is null then raise exception 'bad_rule'; end if;
    secret.usd := round(secret.local_amount / saved.rate,2);
  elsif saved.type = 'question' then
    saved.currency := null;
    saved.rate := null;
    secret.usd := null;
    secret.local_amount := null;
    if saved.kind = 'choice' then
      secret.typed_aliases := null;
      if jsonb_typeof(saved.choices) is distinct from 'array' or jsonb_typeof(secret.answer) is distinct from 'number'
      then raise exception 'bad_rule'; end if;
      choice := (secret.answer #>> '{}')::numeric;
      if choice <> trunc(choice) or choice < 0 or choice >= jsonb_array_length(saved.choices)
        or jsonb_array_length(saved.choices) not between 2 and 6
        or exists (select 1 from jsonb_array_elements(saved.choices) c
          where jsonb_typeof(c->'zh') is distinct from 'string' or jsonb_typeof(c->'en') is distinct from 'string'
            or length(btrim(c->>'zh')) not between 1 and 120 or length(btrim(c->>'en')) not between 1 and 120)
      then raise exception 'bad_rule'; end if;
      -- Rebuild choices so unknown client fields cannot enter a player payload.
      select jsonb_agg(jsonb_build_object('zh',c->>'zh','en',c->>'en') order by ord)
      into saved.choices from jsonb_array_elements(saved.choices) with ordinality as a(c,ord);
    elsif saved.kind = 'text' then
      saved.choices := null;
      if jsonb_typeof(secret.answer) is distinct from 'string'
        or length(btrim(secret.answer #>> '{}')) not between 1 and 120
        or cardinality(secret.typed_aliases) > 20
        or exists (select 1 from unnest(secret.typed_aliases) a where a is null or length(btrim(a)) not between 1 and 120)
      then raise exception 'bad_rule'; end if;
    else raise exception 'bad_rule';
    end if;
  else raise exception 'bad_rule';
  end if;
  begin
    insert into private.question_pool select saved.*
    on conflict (id) do update set
      (city,type,place_zh,place_en,location_lat,location_lng,prompt_zh,prompt_en,kind,choices,currency,rate,
       source_url,checked_on,photo,photo_credit,photo_license,photo_link,vessel) =
      (saved.city,saved.type,saved.place_zh,saved.place_en,saved.location_lat,saved.location_lng,
       saved.prompt_zh,saved.prompt_en,saved.kind,saved.choices,saved.currency,saved.rate,saved.source_url,
       saved.checked_on,saved.photo,saved.photo_credit,saved.photo_license,saved.photo_link,saved.vessel);
    insert into private.question_pool_secrets select secret.*
    on conflict (id) do update set (answer,typed_aliases,usd,local_amount) =
      (secret.answer,secret.typed_aliases,secret.usd,secret.local_amount);
  exception when check_violation or not_null_violation then raise exception 'bad_rule';
  end;
  perform private.log_question_pool(case when target is null then 'question_pool.add' else 'question_pool.edit' end,
    saved.id,saved.prompt_en,case when target is not null then to_jsonb(prior) end,to_jsonb(saved),
    case when target is not null then to_jsonb(prior_secret) end);
  return to_jsonb(saved);
end $$;

create function public.admin_question_pool_set_status(id uuid, status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prior private.question_pool;
declare saved private.question_pool;
begin
  perform private.require_game_editor();
  select * into prior from private.question_pool q where q.id = admin_question_pool_set_status.id for update;
  if not found then raise exception 'not_found'; end if;
  if status is null or status not in ('draft','published','hidden') or
    (status = 'published' and (prior.source_url is null or prior.checked_on is null))
  then raise exception 'bad_rule'; end if;
  update private.question_pool q set status = admin_question_pool_set_status.status
    where q.id = prior.id returning * into saved;
  perform private.log_question_pool('question_pool.status',saved.id,saved.prompt_en,to_jsonb(prior),to_jsonb(saved),
    (select to_jsonb(s) from private.question_pool_secrets s where s.id = saved.id));
  return to_jsonb(saved);
end $$;

alter function public.admin_undo(bigint,text) rename to admin_undo_before_question_pool;
alter function public.admin_undo_before_question_pool(bigint,text) set schema private;
revoke all on function private.admin_undo_before_question_pool(bigint,text) from public, anon, authenticated, service_role;

create function public.admin_undo(p_action_id bigint, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare event private.admin_actions;
declare prior private.question_pool;
declare restored private.question_pool;
declare secret private.question_pool_secrets;
begin
  perform private.require_game_editor();
  select * into event from private.admin_actions where id = p_action_id;
  if not found then raise exception 'not_found'; end if;
  if event.target_type <> 'question_pool' then
    return private.admin_undo_before_question_pool(p_action_id,p_note);
  end if;
  if event.action not in ('question_pool.add','question_pool.edit','question_pool.status')
  then raise exception 'not_undoable'; end if;

  select * into prior from private.question_pool where id = event.target_id::uuid for update;
  if not found or to_jsonb(prior) is distinct from event.after or exists (
    select 1 from private.admin_actions a where a.target_type = event.target_type
      and a.target_id = event.target_id and a.id > event.id
  ) then raise exception 'stale'; end if;

  if event.before is null then
    update private.question_pool set status = 'hidden' where id = prior.id returning * into restored;
  else
    restored := jsonb_populate_record(null::private.question_pool,event.before);
    select (jsonb_populate_record(null::private.question_pool_secrets,before)).*
    into secret from private.question_pool_audit_secrets where action_id = event.id;
    update private.question_pool set
      (city,type,place_zh,place_en,location_lat,location_lng,prompt_zh,prompt_en,kind,choices,currency,rate,
       source_url,checked_on,photo,photo_credit,photo_license,photo_link,vessel,status) =
      (restored.city,restored.type,restored.place_zh,restored.place_en,restored.location_lat,restored.location_lng,
       restored.prompt_zh,restored.prompt_en,restored.kind,restored.choices,restored.currency,restored.rate,
       restored.source_url,restored.checked_on,restored.photo,restored.photo_credit,restored.photo_license,
       restored.photo_link,restored.vessel,restored.status)
    where id = prior.id;
    update private.question_pool_secrets set (answer,typed_aliases,usd,local_amount) =
      (secret.answer,secret.typed_aliases,secret.usd,secret.local_amount) where id = prior.id;
  end if;
  perform private.log_question_pool('undo',prior.id,prior.prompt_en,to_jsonb(prior),
    to_jsonb(restored) || jsonb_build_object('undo_of',event.id),null,p_note);
  return to_jsonb(restored);
end $$;

revoke all on function private.question_pool_uses(uuid),
  private.log_question_pool(text,uuid,text,jsonb,jsonb,jsonb,text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_question_pool_list(text,text,uuid), public.admin_question_pool_save(jsonb),
  public.admin_question_pool_set_status(uuid,text), public.admin_undo(bigint,text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_question_pool_list(text,text,uuid), public.admin_question_pool_save(jsonb),
  public.admin_question_pool_set_status(uuid,text), public.admin_undo(bigint,text) to authenticated;
