-- Place lock and handwriting.
-- A capsule can be locked to one of a fixed list of places. open_capsule() then also needs a
-- GPS fix within the place's radius, checked here on the server, and records where it was opened.
-- A handwritten (親筆) letter is stored as a PNG data URL alongside the typed message,
-- so it stays sealed in capsule_contents like everything else.

-- ---------- Places ----------
create table public.places (
  id text primary key,
  name_zh text not null,
  name_en text not null,
  city_zh text not null,
  city_en text not null,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 100,
  sort integer not null default 0
);
alter table public.places enable row level security;
create policy "places: anyone signed in can read" on public.places for select to authenticated using (true);
revoke insert, update, delete on public.places from anon, authenticated;

-- Points are a specific spot at each landmark (checked against OpenStreetMap), since the 100 m check needs one point.
insert into public.places (id, name_zh, name_en, city_zh, city_en, lat, lng, sort) values
  ('senado',    '議事亭前地噴水池',     'Senado Square fountain',          '澳門',   'Macau',        22.19383, 113.53999, 1),
  ('tst-clock', '尖沙咀鐘樓',           'Tsim Sha Tsui Clock Tower',       '香港',   'Hong Kong',    22.29359, 114.16954, 2),
  ('taipei101', '台北 101',             'Taipei 101',                      '台北',   'Taipei',       25.03384, 121.56450, 3),
  ('sensoji',   '淺草寺本堂',           'Sensō-ji main hall',              '東京',   'Tokyo',        35.71480, 139.79660, 4),
  ('fushimi',   '伏見稻荷大社樓門',     'Fushimi Inari Taisha gate',       '京都',   'Kyoto',        34.96708, 135.77254, 5),
  ('gyeongbok', '景福宮勤政殿',         'Gyeongbokgung Geunjeongjeon',     '首爾',   'Seoul',        37.57854, 126.97699, 6),
  ('merlion',   '魚尾獅公園',           'Merlion Park',                    '新加坡', 'Singapore',     1.28678, 103.85450, 7),
  ('grandpal',  '大皇宮',               'The Grand Palace',                '曼谷',   'Bangkok',      13.74935, 100.49186, 8),
  ('wumen',     '故宮午門',             'Meridian Gate, Forbidden City',   '北京',   'Beijing',      39.91212, 116.39159, 9),
  ('petronas',  '雙子塔',               'Petronas Twin Towers',            '吉隆坡', 'Kuala Lumpur',  3.15785, 101.71165, 10);

-- Great-circle distance in metres.
create function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ---------- Capsules: place, handwriting mark, where it was opened ----------
alter table public.capsules
  add column place text references public.places,
  add column handwritten boolean not null default false,
  add column opened_lat double precision,
  add column opened_lng double precision,
  add column opened_distance_m integer;

alter table public.capsule_contents drop constraint capsule_contents_message_check;
alter table public.capsule_contents alter column message drop not null;
alter table public.capsule_contents
  add column drawing text,
  add constraint capsule_contents_message_check check (message is null or char_length(message) between 1 and 500),
  add constraint capsule_contents_drawing_check check (drawing is null or (drawing like 'data:image/png;base64,%' and length(drawing) <= 800000)),
  add constraint capsule_contents_has_content check (message is not null or drawing is not null);

-- ---------- send_capsule: now with place and handwriting ----------
drop function public.send_capsule(uuid, text, text, text, timestamptz);
create function public.send_capsule(
  p_recipient uuid, p_vessel text, p_message text, p_hint text, p_open_at timestamptz,
  p_place text default null, p_drawing text default null
)
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
  if p_place is not null and not exists (select 1 from public.places where id = p_place) then raise exception 'unknown place'; end if;
  insert into public.capsules (sender, recipient, vessel, hint, open_at, place, handwritten)
    values (auth.uid(), p_recipient, p_vessel, coalesce(trim(p_hint), ''), p_open_at, p_place, p_drawing is not null)
    returning id into v_id;
  insert into public.capsule_contents (capsule_id, message, drawing)
    values (v_id, nullif(trim(coalesce(p_message, '')), ''), p_drawing);
  return v_id;
end $$;

-- ---------- open_capsule: time, and place if set ----------
-- Errors carry a hint the app turns into a message: 'locked' (too early), 'no_location', 'inaccurate', 'far'.
drop function public.open_capsule(uuid);
create function public.open_capsule(
  p_id uuid, p_lat double precision default null, p_lng double precision default null, p_accuracy double precision default null
)
returns table (message text, drawing text, opened_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare c public.capsules; pl public.places; d double precision;
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
    end if;
    update public.capsules
      set opened_at = now(), seen_at = coalesce(seen_at, now()),
          opened_lat = p_lat, opened_lng = p_lng, opened_distance_m = case when d is null then null else round(d) end
      where id = p_id
      returning * into c;
  end if;
  return query select cc.message, cc.drawing, c.opened_at from public.capsule_contents cc where cc.capsule_id = p_id;
end $$;

revoke execute on function public.send_capsule(uuid, text, text, text, timestamptz, text, text) from public, anon;
revoke execute on function public.open_capsule(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.send_capsule(uuid, text, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.open_capsule(uuid, double precision, double precision, double precision) to authenticated;
