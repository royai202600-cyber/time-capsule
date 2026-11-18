begin;

create table private.blocked_words (
  word text primary key check (word <> '' and word = lower(btrim(word)))
);
alter table private.blocked_words enable row level security;
revoke all on private.blocked_words from public, anon, authenticated, service_role;

insert into private.blocked_words (word) values
  ('kill yourself'), ('go die'), ('fuck you'), ('bitch'), ('nigger'),
  ('去死'), ('滾開'), ('傻逼'), ('操你'), ('冚家剷');

create function private.text_allowed(input text) returns boolean
language sql stable set search_path = '' as $$
  select not exists (
    select 1 from private.blocked_words where strpos(lower(coalesce(input, '')), word) > 0
  );
$$;
revoke all on function private.text_allowed(text) from public, anon, authenticated, service_role;

alter table public.capsules
  add column lock_question text,
  add column rack_removed_at timestamptz;
alter table public.capsule_contents add column lock_answer text;

create index capsules_waypost_rack_idx on public.capsules (public_capsule_spot, sealed_at desc, id desc)
  where is_public and recipient is null and opened_at is null and rack_removed_at is null;

create or replace function private.public_capsule_is_hidden(p_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(a.action = 'queue.remove', false) or exists (
    select 1 from public.public_capsule_reports r
    where r.capsule_id = p_id and r.reported_at > coalesce(a.at, '-infinity'::timestamptz)
  )
  from private.admin_latest_review('public_capsule', p_id::text) a;
$$;

create function private.rack_distance(
  post public.public_capsule_spots, lat double precision, lng double precision, accuracy double precision
) returns double precision
language sql stable set search_path = '' as $$
  select case when post.game_enabled and post.hidden_at is null and post.kind = 'common'
    and lat between -90 and 90 and lng between -180 and 180 and accuracy > 0 and accuracy <= 200
  then public.distance_m(lat, lng, post.lat, post.lng) end;
$$;

create function private.rack_normalize_answer(input text) returns text
language sql immutable set search_path = '' as $$
  select nullif(lower(regexp_replace(input, '[[:space:]　]+', '', 'g')), '');
$$;

-- Cursor is the last returned immutable (sealed_at, id) pair. It remains
-- usable after someone claims or removes that capsule.
create function public.waypost_rack(waypost_id uuid, filter text default 'all', cursor jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  page_size constant integer := 24;
begin
  if actor is null then raise exception 'not signed in'; end if;
  if filter is null or filter not in ('all', 'ready', 'waiting', 'has_question', 'friends', 'mine') then
    raise exception 'bad_filter';
  end if;
  return (
    with visible as (
      select c.id, c.sealed_at, c.sender, c.hint, c.open_at, c.lock_question,
        c.open_at <= statement_timestamp() as ready, c.sender = actor as is_mine,
        f.friend_id is not null as is_friend
      from public.capsules c
      join public.public_capsule_spots w on w.id = c.public_capsule_spot
      left join public.friendships f on f.user_id = actor and f.friend_id = c.sender
      where w.id = waypost_id and w.kind = 'common' and w.game_enabled and w.hidden_at is null
        and c.is_public and c.recipient is null and c.opened_at is null and c.rack_removed_at is null
        and not private.public_capsule_is_hidden(c.id)
    ), filtered as materialized (
      select * from visible where case filter
        when 'ready' then ready when 'waiting' then not ready
        when 'has_question' then lock_question is not null
        when 'friends' then is_friend when 'mine' then is_mine else true end
    ), page as materialized (
      select * from filtered
      where cursor is null or (sealed_at, id) < ((cursor->>'sealed_at')::timestamptz, (cursor->>'id')::uuid)
      order by sealed_at desc, id desc limit page_size + 1
    ), items as (
      select * from page order by sealed_at desc, id desc limit page_size
    )
    select jsonb_build_object(
      'count', (select count(*) from filtered),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
        'capsule_id', i.id, 'sender', jsonb_build_object('portrait', p.avatar, 'name', p.name),
        'hint', i.hint, 'opens_at', i.open_at, 'ready', i.ready, 'has_question', i.lock_question is not null,
        'lock_question', i.lock_question, 'is_friend', i.is_friend, 'is_mine', i.is_mine
      ) order by i.sealed_at desc, i.id desc) from items i join public.profiles p on p.id = i.sender), '[]'::jsonb),
      'next_cursor', case when (select count(*) from page) > page_size then
        (select jsonb_build_object('sealed_at', i.sealed_at, 'id', i.id)
         from items i order by i.sealed_at, i.id limit 1) end
    )
  );
end;
$$;

create function public.rack_leave(
  waypost_id uuid, lat double precision, lng double precision, accuracy double precision,
  body text, hint text, wait_days integer, lock_question text default null, lock_answer text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  post public.public_capsule_spots;
  distance double precision;
  capsule uuid;
  opens timestamptz;
  letter text := btrim(coalesce(body, ''));
  public_hint text := btrim(coalesce(hint, ''));
  question text := nullif(btrim(lock_question), '');
  secret text := private.rack_normalize_answer(lock_answer);
begin
  if actor is null then raise exception 'not signed in'; end if;
  select w.* into post from public.public_capsule_spots w where w.id = waypost_id for share;
  distance := private.rack_distance(post, lat, lng, accuracy);
  if distance is null or distance > 100 then raise exception 'too_far'; end if;
  if wait_days is null or wait_days not in (1, 7, 30, 365) then raise exception 'bad_wait'; end if;
  if not (private.text_allowed(letter) and private.text_allowed(public_hint) and private.text_allowed(question)) then
    raise exception 'blocked_words';
  end if;
  if question is not null and secret is null then raise exception 'no_answer'; end if;
  if char_length(letter) not between 1 and 280 or char_length(public_hint) > 40
    or char_length(question) > 280 or char_length(lock_answer) > 280
    or (question is null and secret is not null)
  then raise exception 'rejected'; end if;

  opens := statement_timestamp() + wait_days * interval '24 hours';
  insert into public.capsules (sender, vessel, hint, open_at, is_public, public_capsule_spot, lock_question)
  values (actor, 'bottle', public_hint, opens, true, waypost_id, question)
  returning id into capsule;
  insert into public.capsule_contents (capsule_id, message, lock_answer) values (capsule, letter, secret);
  return jsonb_build_object('capsule_id', capsule, 'opens_at', opens);
end;
$$;

create function public.rack_open(
  capsule_id uuid, lat double precision, lng double precision, accuracy double precision, answer text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  capsule public.capsules;
  post public.public_capsule_spots;
  distance double precision;
  opened jsonb;
begin
  if actor is null then raise exception 'not signed in'; end if;
  select c.* into capsule from public.capsules c where c.id = capsule_id and c.is_public for update;
  if not found or capsule.recipient is not null or capsule.opened_at is not null or capsule.sender = actor
    or capsule.rack_removed_at is not null or private.public_capsule_is_hidden(capsule.id)
  then raise exception 'taken'; end if;
  select w.* into post from public.public_capsule_spots w where w.id = capsule.public_capsule_spot for share;
  distance := private.rack_distance(post, lat, lng, accuracy);
  if distance is null or distance > 100 then raise exception 'too_far'; end if;
  if capsule.open_at > now() then raise exception 'too_early'; end if;
  if capsule.lock_question is not null and not exists (
    select 1 from public.capsule_contents cc where cc.capsule_id = capsule.id
      and cc.lock_answer = private.rack_normalize_answer(answer)
  ) then raise exception 'wrong_answer'; end if;

  update public.capsules set recipient = actor where id = capsule.id;
  insert into public.public_capsule_pickups (capsule_id, finder) values (capsule.id, actor)
    on conflict do nothing;
  select to_jsonb(c) into strict opened from public.open_capsule(capsule.id, lat, lng, accuracy) c;
  update public.capsules set opened_distance_m = round(distance) where id = capsule.id;
  return opened;
end;
$$;

create or replace function public.public_capsule_report(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare capsule public.capsules;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_reason is null or p_reason not in ('unkind', 'personal', 'spam', 'other') then raise exception 'rejected'; end if;
  select c.* into capsule from public.capsules c where c.id = p_id and c.is_public for update;
  if not found or capsule.sender = auth.uid() or capsule.rack_removed_at is not null
    or (capsule.recipient is distinct from auth.uid()
      and (capsule.recipient is not null or capsule.opened_at is not null
        or not exists (select 1 from public.public_capsule_spots w where w.id = capsule.public_capsule_spot
          and w.kind = 'common' and w.game_enabled and w.hidden_at is null)))
  then raise exception 'taken'; end if;
  insert into public.public_capsule_reports (capsule_id, reporter, reason)
  values (p_id, auth.uid(), p_reason) on conflict do nothing;
end;
$$;

revoke all on function private.rack_distance(public.public_capsule_spots, double precision, double precision, double precision),
  private.rack_normalize_answer(text) from public, anon, authenticated, service_role;
revoke all on function public.waypost_rack(uuid, text, jsonb),
  public.rack_leave(uuid, double precision, double precision, double precision, text, text, integer, text, text),
  public.rack_open(uuid, double precision, double precision, double precision, text) from public, anon, authenticated, service_role;
grant execute on function public.waypost_rack(uuid, text, jsonb),
  public.rack_leave(uuid, double precision, double precision, double precision, text, text, integer, text, text),
  public.rack_open(uuid, double precision, double precision, double precision, text) to authenticated;

create or replace function public.admin_queue(p_status text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  can_read_preview boolean;
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  if p_status is null or p_status not in ('open', 'done') then raise exception 'not_found'; end if;
  can_read_preview := private.admin_can('letters');

  return (
    with reported as (
      select 'hunt_report' as kind, 'hunt' as target_type, h.id, h.name_en as title,
        case when can_read_preview then h.description end as preview,
        h.owner, h.hidden_at is not null as hidden, count(*) as reports,
        '[]'::jsonb as reasons,
        jsonb_agg(private.admin_person(r.reporter) order by r.reported_at, r.reporter) as reporters,
        min(r.reported_at) as first_at, max(r.reported_at) as latest_at
      from private.private_hunt_reports r join public.hunts h on h.id = r.hunt_id and h.kind = 'private'
      group by h.id
      union all
      select 'public_capsule_report', 'public_capsule', c.id::text, coalesce(c.lock_question, c.hint),
        case when can_read_preview then (select x.message from public.capsule_contents x where x.capsule_id = c.id) end,
        c.sender, private.public_capsule_is_hidden(c.id), count(*), jsonb_agg(distinct r.reason order by r.reason),
        jsonb_agg(private.admin_person(r.reporter) order by r.reported_at, r.reporter),
        min(r.reported_at), max(r.reported_at)
      from public.public_capsule_reports r join public.capsules c on c.id = r.capsule_id and c.is_public
      group by c.id
    ), review as (
      select r.*, a.action, a.actor_snapshot, a.at, a.note,
        case when a.action = 'queue.remove' or a.at >= r.latest_at then 'done' else 'open' end as status
      from reported r cross join lateral private.admin_latest_review(r.target_type, r.id) a
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind', r.kind, 'id', r.id, 'title', r.title, 'preview', r.preview,
      'owner', private.admin_person(r.owner), 'reports', r.reports, 'reasons', r.reasons,
      'reporters', r.reporters, 'hidden', r.hidden, 'first_at', r.first_at, 'status', r.status
    ) || case when r.status = 'done' then jsonb_build_object(
      'decision', split_part(r.action, '.', 2), 'decided_by', r.actor_snapshot,
      'decided_at', r.at, 'note', r.note) else '{}'::jsonb end
    order by case when r.status = 'done' then r.at else r.latest_at end desc, r.kind, r.id), '[]'::jsonb)
    from review r where r.status = p_status
  );
end;
$$;

create or replace function public.admin_queue_resolve(p_kind text, p_id text, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_type text;
  title text;
  was_hidden boolean;
  latest_report timestamptz;
  prior private.admin_actions;
  target_capsule uuid;
begin
  if not private.admin_can('queue') then raise exception 'forbidden'; end if;
  if p_decision is null or p_decision not in ('restore', 'remove') then raise exception 'not_found'; end if;

  -- Reporting and pickup use the same target row lock, so the decision and its
  -- audit row see the same report set and take effect together.
  case p_kind
    when 'hunt_report' then
      target_type := 'hunt';
      select h.name_en, h.hidden_at is not null into title, was_hidden
      from public.hunts h where h.id = p_id and h.kind = 'private' for update;
      if not found then raise exception 'not_found'; end if;
      select max(reported_at) into latest_report from private.private_hunt_reports where hunt_id = p_id;
    when 'public_capsule_report' then
      target_type := 'public_capsule';
      if p_id is null or p_id !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
        raise exception 'not_found';
      end if;
      target_capsule := p_id::uuid;
      p_id := target_capsule::text;
      select coalesce(c.lock_question, c.hint) into title from public.capsules c where c.id = target_capsule and c.is_public for update;
      if not found then raise exception 'not_found'; end if;
      was_hidden := private.public_capsule_is_hidden(target_capsule);
      select max(r.reported_at) into latest_report from public.public_capsule_reports r where r.capsule_id = target_capsule;
    else raise exception 'not_found';
  end case;

  if not private.admin_can('queue') then raise exception 'forbidden'; end if;
  prior := private.admin_latest_review(target_type, p_id);
  if latest_report is null or prior.action = 'queue.remove' or prior.at >= latest_report then
    raise exception 'not_found';
  end if;
  if target_type = 'hunt' then
    update public.hunts set hidden_at = case when p_decision = 'remove' then coalesce(hidden_at, clock_timestamp()) end
    where id = p_id;
  elsif p_decision = 'remove' then
    update public.capsules set recipient = null, seen_at = null
    where id = target_capsule and recipient is not null;
  end if;
  perform private.admin_log('queue.' || p_decision, target_type, p_id, title,
    jsonb_build_object('hidden', was_hidden), jsonb_build_object('hidden', p_decision = 'remove'), p_note);
end;
$$;

create function public.admin_waypost_rack(waypost_id uuid, cursor jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  post public.public_capsule_spots;
  result jsonb;
  page_size constant integer := 24;
begin
  if not private.admin_can('read') then raise exception 'forbidden'; end if;
  select w.* into post from public.public_capsule_spots w where w.id = waypost_id and w.kind = 'common';
  if not found then raise exception 'not_found'; end if;
  with rack as materialized (
    select c.id, c.sender, c.hint, c.open_at, c.sealed_at, c.opened_at, c.lock_question, c.rack_removed_at
    from public.capsules c where c.is_public and c.public_capsule_spot = post.id
  ), page as materialized (
    select * from rack
    where cursor is null or (sealed_at, id) < ((cursor->>'sealed_at')::timestamptz, (cursor->>'id')::uuid)
    order by sealed_at desc, id desc limit page_size + 1
  ), items as (
    select * from page order by sealed_at desc, id desc limit page_size
  )
  select jsonb_build_object(
    'count', (select count(*) from rack),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'capsule_id', i.id, 'sender', jsonb_build_object('portrait', p.avatar, 'name', p.name),
      'hint', i.hint, 'opens_at', i.open_at, 'lock_question', i.lock_question,
      'status', case when i.rack_removed_at is not null or review.action = 'queue.remove' then 'removed'
        when private.public_capsule_is_hidden(i.id) then 'reported'
        when i.opened_at is not null then 'opened'
        when i.open_at <= statement_timestamp() then 'ready' else 'waiting' end,
      'report_count', reports.total,
      'body', case when reports.total > 0 and private.admin_can('letters') then cc.message end
    ) order by i.sealed_at desc, i.id desc)
    from items i join public.profiles p on p.id = i.sender
    cross join lateral (select count(*) as total from public.public_capsule_reports r where r.capsule_id = i.id) reports
    cross join lateral private.admin_latest_review('public_capsule', i.id::text) review
    left join public.capsule_contents cc on cc.capsule_id = i.id
      and reports.total > 0 and private.admin_can('letters')), '[]'::jsonb),
    'next_cursor', case when (select count(*) from page) > page_size then
      (select jsonb_build_object('sealed_at', i.sealed_at, 'id', i.id)
       from items i order by i.sealed_at, i.id limit 1) end
  ) into result;
  perform private.admin_log('rack.list', 'waypost_rack', post.id::text, post.name_en, null,
    jsonb_build_object('cursor', cursor, 'shown', jsonb_array_length(result->'items')));
  return result;
end;
$$;

create function public.admin_rack_remove(capsule_id uuid, reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  capsule public.capsules;
  removal_at timestamptz := clock_timestamp();
  action_id bigint;
begin
  if not private.admin_can('queue') then raise exception 'forbidden'; end if;
  if nullif(btrim(reason), '') is null then raise exception 'reason_required'; end if;
  select c.* into capsule from public.capsules c where c.id = capsule_id and c.is_public
    and c.public_capsule_spot is not null and c.rack_removed_at is null for update;
  if not found then raise exception 'not_found'; end if;

  update public.capsules set rack_removed_at = removal_at, recipient = null, seen_at = null
  where id = capsule.id;
  perform private.admin_log('rack.remove', 'public_capsule', capsule.id::text, capsule.hint,
    jsonb_build_object('waypost_id', capsule.public_capsule_spot, 'opened_at', capsule.opened_at),
    jsonb_build_object('removed_at', removal_at), btrim(reason));
  select max(a.id) into action_id from private.admin_actions a
    where a.action = 'rack.remove' and a.target_type = 'public_capsule' and a.target_id = capsule.id::text;
  return jsonb_build_object('action_id', action_id, 'capsule_id', capsule.id);
end;
$$;

-- Keep existing game edit undo behavior behind its own role check.
alter function public.admin_undo(bigint, text) set schema private;
revoke all on function private.admin_undo(bigint, text) from public, anon, authenticated, service_role;

create function public.admin_undo(p_action_id bigint, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event private.admin_actions;
  capsule public.capsules;
  restored jsonb;
begin
  if not private.admin_can('queue') then raise exception 'forbidden'; end if;
  select a.* into event from private.admin_actions a where a.id = p_action_id;
  if event.action is distinct from 'rack.remove' then
    return private.admin_undo(p_action_id, p_note);
  end if;
  select c.* into capsule from public.capsules c where c.id = event.target_id::uuid for update;
  if not found or capsule.opened_at is not null then raise exception 'not_undoable'; end if;
  if capsule.rack_removed_at is distinct from (event.after->>'removed_at')::timestamptz
    or exists (select 1 from private.admin_actions a where a.target_type = event.target_type
      and a.target_id = event.target_id and a.id > event.id)
  then raise exception 'stale'; end if;

  update public.capsules set rack_removed_at = null where id = capsule.id;
  restored := jsonb_build_object('capsule_id', capsule.id, 'undo_of', event.id);
  perform private.admin_log('undo', event.target_type, event.target_id, event.target_label,
    event.after, restored, p_note);
  return restored;
end;
$$;

revoke all on function public.admin_waypost_rack(uuid, jsonb), public.admin_rack_remove(uuid, text),
  public.admin_undo(bigint, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_waypost_rack(uuid, jsonb), public.admin_rack_remove(uuid, text),
  public.admin_undo(bigint, text) to authenticated;

notify pgrst, 'reload schema';
commit;
