-- Vessel shop (容器商店).
-- Vessels have a price (MOP) and optionally a limited, numbered edition. There is no payment yet:
-- acquire_vessel() gives the vessel for free while testing, and numbers limited editions in order.
-- send_capsule() now only accepts free vessels or ones you own, and stamps the edition number.

create table public.vessels (
  id text primary key,
  price_mop integer not null default 0,
  edition_total integer,          -- null = unlimited
  brand text,                     -- brand collaboration name, if any
  sort integer not null default 0
);
alter table public.vessels enable row level security;
create policy "vessels: anyone signed in can read" on public.vessels for select to authenticated using (true);
revoke insert, update, delete on public.vessels from anon, authenticated;

-- Names and descriptions live in the app's translation file (src/i18n.js), keyed by id.
insert into public.vessels (id, price_mop, edition_total, brand, sort) values
  ('dome', 0, null, null, 1),
  ('bottle', 0, null, null, 2),
  ('envelope', 0, null, null, 3),
  ('tin', 0, null, null, 4),
  ('lantern', 12, null, null, 5),
  ('musicbox', 18, null, null, 6),
  ('maison', 1880, 300, 'Maison Aurèle', 7);   -- fictional demo brand

create table public.owned_vessels (
  user_id uuid not null references public.profiles on delete cascade,
  vessel text not null references public.vessels,
  edition_no integer,
  acquired_at timestamptz not null default now(),
  primary key (user_id, vessel),
  unique (vessel, edition_no)
);
alter table public.owned_vessels enable row level security;
create policy "owned_vessels: see my own" on public.owned_vessels for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.owned_vessels from anon, authenticated;

-- How many of each limited edition are left (counts everyone's, which the row policy would hide).
create function public.vessel_stock()
returns table (vessel text, remaining integer)
language sql security definer set search_path = '' stable as $$
  select v.id, v.edition_total - (select count(*)::int from public.owned_vessels o where o.vessel = v.id)
  from public.vessels v where v.edition_total is not null;
$$;

-- Get a vessel from the shop (free while testing). Returns the edition number for limited ones.
create function public.acquire_vessel(p_vessel text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v public.vessels; n integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v from public.vessels where id = p_vessel;
  if v.id is null then raise exception 'unknown vessel'; end if;
  if v.price_mop = 0 then return null; end if;
  if exists (select 1 from public.owned_vessels where user_id = auth.uid() and vessel = p_vessel) then
    raise exception 'already owned' using hint = 'owned';
  end if;
  if v.edition_total is not null then
    perform pg_advisory_xact_lock(hashtext('vessel:' || p_vessel));   -- number editions one at a time
    select coalesce(max(edition_no), 0) + 1 into n from public.owned_vessels where vessel = p_vessel;
    if n > v.edition_total then raise exception 'sold out' using hint = 'sold_out'; end if;
  end if;
  insert into public.owned_vessels (user_id, vessel, edition_no) values (auth.uid(), p_vessel, n);
  return n;
end $$;

alter table public.capsules add column edition_no integer;

-- send_capsule: same as before, but the vessel must be free or owned, and limited ones carry their number.
create or replace function public.send_capsule(
  p_recipient uuid, p_vessel text, p_message text, p_hint text, p_open_at timestamptz,
  p_place text default null, p_drawing text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v public.vessels; v_ed integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_recipient <> auth.uid() and not exists (
    select 1 from public.friendships where user_id = auth.uid() and friend_id = p_recipient
  ) then raise exception 'recipient is not a friend'; end if;
  select * into v from public.vessels where id = p_vessel;
  if v.id is null then raise exception 'unknown vessel'; end if;
  if v.price_mop > 0 then
    select edition_no into v_ed from public.owned_vessels where user_id = auth.uid() and vessel = p_vessel;
    if not found then raise exception 'vessel not owned' using hint = 'not_owned'; end if;
  end if;
  if p_open_at <= now() then raise exception 'open time must be in the future'; end if;
  if p_place is not null and not exists (select 1 from public.places where id = p_place) then raise exception 'unknown place'; end if;
  insert into public.capsules (sender, recipient, vessel, hint, open_at, place, handwritten, edition_no)
    values (auth.uid(), p_recipient, p_vessel, coalesce(trim(p_hint), ''), p_open_at, p_place, p_drawing is not null, v_ed)
    returning id into v_id;
  insert into public.capsule_contents (capsule_id, message, drawing)
    values (v_id, nullif(trim(coalesce(p_message, '')), ''), p_drawing);
  return v_id;
end $$;

revoke execute on function public.acquire_vessel(text), public.vessel_stock() from public, anon;
grant execute on function public.acquire_vessel(text), public.vessel_stock() to authenticated;
