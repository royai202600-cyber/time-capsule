-- Bring the app in line with the prototype:
-- photos in capsules, city + reminder settings on profiles, a "why" line per place,
-- the (fictional) Maison Aurèle boutique as a brand-only place, and a gift pickup code
-- created when a brand capsule is opened there.

-- ---------- Photo, sealed with the letter ----------
alter table public.capsule_contents
  add column photo text,
  add constraint capsule_contents_photo_check check (photo is null or (photo like 'data:image/jpeg;base64,%' and length(photo) <= 1500000));

-- ---------- Profile: city, reminder preferences (reminders themselves come later) ----------
alter table public.profiles
  add column city text check (city is null or char_length(city) <= 40),
  add column remind_open boolean not null default true,
  add column remind_nearby boolean not null default true;

-- ---------- Places: a short note, and brand-only places ----------
alter table public.places
  add column why_zh text not null default '',
  add column why_en text not null default '',
  add column brand_vessel text references public.vessels;

update public.places p set why_zh = v.zh, why_en = v.en from (values
  ('senado',    '澳門的中心，波浪石仔路和噴水池',       'The heart of Macau: wave-pattern cobbles and the fountain'),
  ('tst-clock', '維港海旁，對着港島的天際線',           'On the harbour, facing the Hong Kong Island skyline'),
  ('taipei101', '曾經是世界最高的大樓',                 'Once the tallest building in the world'),
  ('sensoji',   '東京最古老的寺廟',                     'Tokyo’s oldest temple'),
  ('fushimi',   '千本鳥居的起點',                       'Where the thousand torii gates begin'),
  ('gyeongbok', '朝鮮王朝的正宮',                       'The main palace of the Joseon dynasty'),
  ('merlion',   '濱海灣旁的魚尾獅',                     'The Merlion on Marina Bay'),
  ('grandpal',  '暹羅王室的宮殿',                       'Home of the Siamese royal court'),
  ('wumen',     '紫禁城的正門',                         'The main gate of the Forbidden City'),
  ('petronas',  '雙子塔的空中走廊下',                   'Under the twin towers’ sky bridge')
) as v(id, zh, en) where p.id = v.id;

-- Maison Aurèle is a fictional demo brand; the boutique is marked as a demo.
insert into public.places (id, name_zh, name_en, city_zh, city_en, lat, lng, sort, why_zh, why_en, brand_vessel) values
  ('aurele-cotai', 'Maison Aurèle 路氹精品店（示範）', 'Maison Aurèle Cotai boutique (demo)', '澳門', 'Macau',
   22.14770, 113.56090, 0, '品牌容器專用，禮物會在店內等對方', 'Brand vessels only. The gift waits in store', 'maison');

-- ---------- Gift pickup code for brand capsules ----------
alter table public.capsules add column gift_code text;

-- ---------- send_capsule: + photo; brand-only places need that brand's vessel ----------
drop function public.send_capsule(uuid, text, text, text, timestamptz, text, text);
create function public.send_capsule(
  p_recipient uuid, p_vessel text, p_message text, p_hint text, p_open_at timestamptz,
  p_place text default null, p_drawing text default null, p_photo text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v public.vessels; v_ed integer; pl public.places;
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
  if p_place is not null then
    select * into pl from public.places where id = p_place;
    if pl.id is null then raise exception 'unknown place'; end if;
    if pl.brand_vessel is not null and pl.brand_vessel <> p_vessel then raise exception 'place needs brand vessel' using hint = 'brand_place'; end if;
  end if;
  insert into public.capsules (sender, recipient, vessel, hint, open_at, place, handwritten, edition_no)
    values (auth.uid(), p_recipient, p_vessel, coalesce(trim(p_hint), ''), p_open_at, p_place, p_drawing is not null, v_ed)
    returning id into v_id;
  insert into public.capsule_contents (capsule_id, message, drawing, photo)
    values (v_id, nullif(trim(coalesce(p_message, '')), ''), p_drawing, p_photo);
  return v_id;
end $$;

-- ---------- open_capsule: + photo and gift code ----------
drop function public.open_capsule(uuid, double precision, double precision, double precision);
create function public.open_capsule(
  p_id uuid, p_lat double precision default null, p_lng double precision default null, p_accuracy double precision default null
)
returns table (message text, drawing text, photo text, opened_at timestamptz, gift_code text)
language plpgsql security definer set search_path = '' as $$
declare c public.capsules; pl public.places; d double precision; g text;
begin
  select * into c from public.capsules where id = p_id;
  if c.id is null or c.recipient <> auth.uid() then raise exception 'capsule not found'; end if;
  if c.opened_at is null then
    if c.open_at > now() then raise exception 'not yet' using hint = 'locked'; end if;
    if c.place is not null then
      select * into pl from public.places where id = c.place;
      if p_lat is null or p_lng is null then raise exception 'location needed' using hint = 'no_location'; end if;
      if p_accuracy is null or p_accuracy > 200 then raise exception 'location not accurate enough' using hint = 'inaccurate'; end if;
      d := public.distance_m(p_lat, p_lng, pl.lat, pl.lng);
      if d > pl.radius_m then raise exception 'too far: % m', round(d) using hint = 'far'; end if;
      -- Opened at the brand's boutique: issue a pickup code for the gift.
      if pl.brand_vessel is not null and pl.brand_vessel = c.vessel then
        g := 'AUR-' || lpad(coalesce(c.edition_no, 0)::text, 3, '0') || '-' || upper(substr(md5(random()::text || c.id::text), 1, 4));
      end if;
    end if;
    update public.capsules
      set opened_at = now(), seen_at = coalesce(seen_at, now()),
          opened_lat = p_lat, opened_lng = p_lng, opened_distance_m = case when d is null then null else round(d) end,
          gift_code = g
      where id = p_id
      returning * into c;
  end if;
  return query select cc.message, cc.drawing, cc.photo, c.opened_at, c.gift_code from public.capsule_contents cc where cc.capsule_id = p_id;
end $$;

revoke execute on function public.send_capsule(uuid, text, text, text, timestamptz, text, text, text) from public, anon;
revoke execute on function public.open_capsule(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.send_capsule(uuid, text, text, text, timestamptz, text, text, text) to authenticated;
grant execute on function public.open_capsule(uuid, double precision, double precision, double precision) to authenticated;
