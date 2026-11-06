-- 時光膠囊 / Time Capsule: milestone 1 schema.
-- The time lock lives here: capsule content sits in capsule_contents, which no
-- client can read directly. Only open_capsule() returns it, and only to the
-- recipient once open_at has passed by the database clock.

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  avatar jsonb not null default '{}'::jsonb,   -- illustrated portrait settings (see src/art.js)
  created_at timestamptz not null default now()
);

-- ---------- Friends ----------
create table public.friendships (
  user_id uuid not null references public.profiles on delete cascade,
  friend_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table public.invites (
  code text primary key default encode(extensions.gen_random_bytes(8), 'hex'),
  inviter uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- Capsules ----------
create table public.capsules (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles on delete cascade,
  recipient uuid not null references public.profiles on delete cascade,
  vessel text not null,
  hint text not null default '' check (char_length(hint) <= 40),
  sealed_at timestamptz not null default now(),
  open_at timestamptz not null,
  seen_at timestamptz,
  opened_at timestamptz
);
create index capsules_recipient on public.capsules (recipient);
create index capsules_sender on public.capsules (sender);

-- Sealed content. RLS is on with no policies, so the API can never read it.
create table public.capsule_contents (
  capsule_id uuid primary key references public.capsules on delete cascade,
  message text not null check (char_length(message) between 1 and 500)
);

-- ---------- Row-level security ----------
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.invites enable row level security;
alter table public.capsules enable row level security;
alter table public.capsule_contents enable row level security;

-- Profiles are visible to yourself, your friends, and anyone you share a capsule with.
create policy "profiles: visible to me, friends, capsule partners" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = profiles.id)
    or exists (select 1 from public.capsules c
               where (c.sender = auth.uid() and c.recipient = profiles.id)
                  or (c.recipient = auth.uid() and c.sender = profiles.id))
  );
create policy "profiles: create my own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles: update my own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "friendships: see my own" on public.friendships
  for select to authenticated using (user_id = auth.uid());

create policy "invites: see my own" on public.invites
  for select to authenticated using (inviter = auth.uid());
create policy "invites: create my own" on public.invites
  for insert to authenticated with check (inviter = auth.uid());

-- Sender and recipient can see the sealed capsule (vessel, hint, times), never its content.
create policy "capsules: sender and recipient" on public.capsules
  for select to authenticated using (sender = auth.uid() or recipient = auth.uid());

-- ---------- Functions (the only way to write capsules or read content) ----------

-- Who sent this invite? Lets the invite page show a name and portrait before accepting.
create function public.invite_info(p_code text)
returns table (name text, avatar jsonb)
language sql security definer set search_path = '' stable as $$
  select p.name, p.avatar from public.invites i join public.profiles p on p.id = i.inviter
  where i.code = p_code;
$$;

-- Accept an invite: you and the inviter become friends (both directions).
create function public.accept_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_inviter uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select inviter into v_inviter from public.invites where code = p_code;
  if v_inviter is null then raise exception 'invite not found'; end if;
  if v_inviter = auth.uid() then return v_inviter; end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), v_inviter), (v_inviter, auth.uid())
    on conflict do nothing;
  return v_inviter;
end $$;

-- Seal and send. The recipient must be yourself or a friend, and the open time must be in the future.
create function public.send_capsule(p_recipient uuid, p_vessel text, p_message text, p_hint text, p_open_at timestamptz)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_recipient <> auth.uid() and not exists (
    select 1 from public.friendships where user_id = auth.uid() and friend_id = p_recipient
  ) then raise exception 'recipient is not a friend'; end if;
  if p_vessel not in ('dome', 'bottle', 'envelope', 'tin') then raise exception 'vessel not available'; end if;
  if p_open_at <= now() then raise exception 'open time must be in the future'; end if;
  insert into public.capsules (sender, recipient, vessel, hint, open_at)
    values (auth.uid(), p_recipient, p_vessel, coalesce(trim(p_hint), ''), p_open_at)
    returning id into v_id;
  insert into public.capsule_contents (capsule_id, message) values (v_id, p_message);
  return v_id;
end $$;

-- Recipient has looked at the capsule (clears the NEW tag).
create function public.mark_seen(p_id uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.capsules set seen_at = now()
  where id = p_id and recipient = auth.uid() and seen_at is null;
$$;

-- Open a capsule. Only the recipient, only once open_at has passed (database clock).
-- The first call records opened_at; later calls return the same content.
create function public.open_capsule(p_id uuid)
returns table (message text, opened_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare c public.capsules;
begin
  select * into c from public.capsules where id = p_id;
  if c.id is null or c.recipient <> auth.uid() then raise exception 'capsule not found'; end if;
  if c.open_at > now() then raise exception 'not yet' using errcode = 'P0001', hint = 'locked'; end if;
  if c.opened_at is null then
    update public.capsules set opened_at = now(), seen_at = coalesce(seen_at, now()) where id = p_id
      returning * into c;
  end if;
  return query select cc.message, c.opened_at from public.capsule_contents cc where cc.capsule_id = p_id;
end $$;

-- Functions are for signed-in users only.
revoke execute on function public.accept_invite, public.send_capsule,
  public.mark_seen, public.open_capsule from public, anon;
grant execute on function public.accept_invite, public.send_capsule,
  public.mark_seen, public.open_capsule to authenticated;

-- The invite page shows who invited you before you sign in.
grant execute on function public.invite_info to anon, authenticated;

-- Clients can only read the sealed tables through the policies above; writes go through functions.
revoke insert, update, delete on public.capsules, public.capsule_contents, public.friendships from anon, authenticated;
revoke all on public.capsule_contents from anon, authenticated;
