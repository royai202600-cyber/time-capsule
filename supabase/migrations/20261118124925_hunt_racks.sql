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

commit;
