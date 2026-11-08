-- Public Sea. Additive migration; existing capsule RPCs and sealed-content access stay intact.
-- Shore coordinates are OSM feature centres retrieved from Nominatim on 2026-11-08
-- (https://nominatim.openstreetmap.org/, © OpenStreetMap contributors, ODbL).
-- The OSM object reference for each row is recorded beside it below. These are
-- public parks, waterfronts or squares, never the sender's GPS position.
begin;

create table public.sea_shores (
  id uuid primary key default gen_random_uuid(),
  name_zh text not null,
  name_en text not null,
  city_zh text not null,
  city_en text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180)
);
create index sea_shores_city on public.sea_shores (city_en);
alter table public.sea_shores enable row level security;
create policy "sea shores: signed in read" on public.sea_shores for select to authenticated using (true);
grant select on public.sea_shores to authenticated;
revoke insert, update, delete on public.sea_shores from anon, authenticated;

insert into public.sea_shores (name_zh,name_en,city_zh,city_en,lat,lng) values
  -- Macau: OSM relation/11551012, way/192180025, way/192182416,
  -- way/307049831, way/244524327, way/192179907
  ('宋玉生公園','Dr. Carlos d’Assumpção Park','澳門','Macau',22.187088,113.551596),
  ('觀音像海濱休憩區','Kun Iam Waterfront Leisure Area','澳門','Macau',22.187279,113.554000),
  ('藝園','Arts Garden','澳門','Macau',22.189243,113.545586),
  ('文化中心廣場','Cultural Centre Square','澳門','Macau',22.190158,113.554748),
  ('亞馬喇前地','Ferreira do Amaral Square','澳門','Macau',22.188424,113.543506),
  ('金蓮花廣場','Golden Lotus Square','澳門','Macau',22.194391,113.553484),
  -- Hong Kong: OSM way/4977404,way/33613654,relation/12919867,way/567801791,way/605224929,way/693487472
  ('九龍公園','Kowloon Park','香港','Hong Kong',22.300533,114.170115),
  ('尖沙咀東海濱平台花園','Tsim Sha Tsui East Waterfront Podium Garden','香港','Hong Kong',22.296384,114.175918),
  ('尖沙咀海濱花園','Tsim Sha Tsui Promenade','香港','Hong Kong',22.299419,114.185649),
  ('藝術公園','Art Park','香港','Hong Kong',22.301195,114.154556),
  ('海防道兒童遊樂場','Haiphong Road Playground','香港','Hong Kong',22.298781,114.169165),
  ('北京道休憩處','Peking Road Sitting-out Area','香港','Hong Kong',22.295837,114.170577),
  -- Taipei: OSM way/309157011,relation/18367478,way/233666147,relation/4727715,way/261647304,way/555117276
  ('台北市民廣場','Taipei Civic Square','台北','Taipei',25.037546,121.562754),
  ('松智公園','Songzhi Park','台北','Taipei',25.036483,121.565674),
  ('松壽廣場','Songshou Square','台北','Taipei',25.037462,121.566139),
  ('中山公園','Zhongshan Park','台北','Taipei',25.039480,121.559610),
  ('信義廣場','Xinyi Square','台北','Taipei',25.033493,121.566130),
  ('台北世貿廣場','Taipei World Trade Center Plaza','台北','Taipei',25.035137,121.561506),
  -- Tokyo: OSM relation/14235095,way/131664926,way/587787098,way/494378879,way/1043662947,way/1043647218
  ('隅田公園','Sumida Park','東京','Tokyo',35.715507,139.803143),
  ('富士公園','Fuji Park','東京','Tokyo',35.718630,139.797706),
  ('金竜公園','Kinryu Park','東京','Tokyo',35.716825,139.789932),
  ('千束公園','Senzoku Park','東京','Tokyo',35.718669,139.793963),
  ('弁天山児童公園','Bentenyama Children’s Park','東京','Tokyo',35.713216,139.797426),
  ('駒形橋ポケットパーク','Komagatabashi Pocket Park','東京','Tokyo',35.708861,139.796845),
  -- Kyoto: OSM way/544920540,way/544920926,way/223276813,way/264074610,way/619973159,way/1284782450
  ('勧進橋公園','Kanjinbashi Park','京都','Kyoto',34.969883,135.760889),
  ('桜島公園','Sakurajima Park','京都','Kyoto',34.966695,135.761227),
  ('稲荷公園','Inari Park','京都','Kyoto',34.967928,135.769861),
  ('勧進橋東公園','Kanjinbashi East Park','京都','Kyoto',34.969353,135.762364),
  ('高松橋ひろば','Takamatsubashi Square','京都','Kyoto',34.972886,135.769429),
  ('相深公園','Aifuka Park','京都','Kyoto',34.972866,135.767988),
  -- Seoul: OSM way/370019676,relation/19175488,way/634122055,way/358297323,way/223157536,way/424080008
  ('首爾廣場','Seoul Plaza','首爾','Seoul',37.565641,126.977994),
  ('清溪川公園','Cheonggyecheon Park','首爾','Seoul',37.568950,126.981786),
  ('清進公園','Cheongjin Park','首爾','Seoul',37.571405,126.979816),
  ('清溪川韓光廣場','Cheonggyecheon Hanbit Plaza','首爾','Seoul',37.568055,126.985223),
  ('世宗路公園','Sejong-ro Park','首爾','Seoul',37.573530,126.975934),
  ('開放松峴綠地廣場','Open Songhyeon Square','首爾','Seoul',37.576780,126.981451),
  -- Singapore: OSM way/687917300,relation/9976848,way/395120471,way/106193383,way/460428718,way/116905791
  ('魚尾獅公園','Merlion Park','新加坡','Singapore',1.285685,103.854159),
  ('濱海藝術中心公園','Esplanade Park','新加坡','Singapore',1.289458,103.853735),
  ('青年奧林匹克公園','Youth Olympic Park','新加坡','Singapore',1.288975,103.860513),
  ('萊佛士坊公園','Raffles Place Park','新加坡','Singapore',1.284235,103.851485),
  ('戰爭紀念公園','War Memorial Park','新加坡','Singapore',1.292778,103.854818),
  ('濱海灣草坪','The Lawn @ Marina Bay','新加坡','Singapore',1.280271,103.853340),
  -- Bangkok: OSM way/23630232,way/23486019,way/1552957093,relation/10904051,way/198399091,way/820534940
  ('皇家田廣場','Sanam Luang','曼谷','Bangkok',13.755126,100.493055),
  ('薩蘭隆公園','Saranrom Park','曼谷','Bangkok',13.748351,100.495270),
  ('納卡拉披隆公園','Nagaraphirom Park','曼谷','Bangkok',13.746792,100.489919),
  ('羅瑪尼納公園','Rommaninat Park','曼谷','Bangkok',13.748977,100.502546),
  ('聖堤猜帕堪公園','Santichaiprakarn Park','曼谷','Bangkok',13.764074,100.495527),
  ('湄南河空中公園','Chao Phraya Sky Park','曼谷','Bangkok',13.738973,100.498497),
  -- Beijing: OSM way/366464114,way/29201967,relation/9054321,relation/9509823,way/859951315,way/30843688
  ('北海公園','Beihai Park','北京','Beijing',39.926402,116.382463),
  ('景山公園','Jingshan Park','北京','Beijing',39.924459,116.390397),
  ('中山公園','Zhongshan Park','北京','Beijing',39.909120,116.386907),
  ('菖蒲河公園','Changpu River Park','北京','Beijing',39.907193,116.398780),
  ('三里河公園','Sanlihe Park','北京','Beijing',39.893787,116.396311),
  ('皇城根遺址公園','Huangchenggen Ruins Park','北京','Beijing',39.927534,116.400072),
  -- Kuala Lumpur: OSM way/10590000,way/487114579,way/1137841255,way/472093460,way/487311917,way/1137841269
  ('吉隆坡城中城公園','KLCC Park','吉隆坡','Kuala Lumpur',3.155580,101.714780),
  ('蒂蒂旺沙湖濱公園','Titiwangsa Lake Gardens','吉隆坡','Kuala Lumpur',3.177825,101.706920),
  ('默迪卡118大道','Merdeka Boulevard at 118','吉隆坡','Kuala Lumpur',3.140159,101.700137),
  ('阿拉伯街廣場','Ain Arabia','吉隆坡','Kuala Lumpur',3.147445,101.710153),
  ('渣打廣場','Laman Standard Chartered','吉隆坡','Kuala Lumpur',3.156383,101.710454),
  ('蘇丹依斯邁廣場','Laman Sultan Ismail','吉隆坡','Kuala Lumpur',3.159957,101.697192);

alter table public.capsules
  add column sea boolean not null default false,
  add column shore uuid references public.sea_shores(id),
  add column sea_returns integer not null default 0 check (sea_returns >= 0);
alter table public.capsules alter column recipient drop not null;
alter table public.capsules add constraint capsules_sea_recipient_check check (sea or recipient is not null);
alter table public.capsules add constraint capsules_sea_shore_check check ((sea and shore is not null and place is null) or (not sea and shore is null));
create index capsules_sea_ashore on public.capsules (shore, open_at) where sea and recipient is null;

-- A durable pickup log enforces the UTC-day limit and excludes prior finders after a return.
create table public.sea_pickups (
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  finder uuid not null references public.profiles(id) on delete cascade,
  picked_at timestamptz not null default now(),
  primary key (capsule_id, finder)
);
create index sea_pickups_daily on public.sea_pickups (finder, picked_at);
alter table public.sea_pickups enable row level security;
create policy "sea pickups: finder or sender reads" on public.sea_pickups for select to authenticated using (
  finder = auth.uid() or exists (select 1 from public.capsules c where c.id = capsule_id and c.sender = auth.uid())
);
grant select on public.sea_pickups to authenticated;
revoke insert, update, delete on public.sea_pickups from anon, authenticated;

create table public.sea_reports (
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  reporter uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('unkind','personal','spam','other')),
  reported_at timestamptz not null default now(),
  primary key (capsule_id, reporter)
);
alter table public.sea_reports enable row level security;
create policy "sea reports: reporter reads own" on public.sea_reports for select to authenticated using (reporter = auth.uid());
grant select on public.sea_reports to authenticated;
revoke insert, update, delete on public.sea_reports from anon, authenticated;

-- Existing profile-partner policy covers the current recipient; this adds
-- historical sea finders after a return without making other profiles public.
create policy "profiles: sea sender and finder" on public.profiles for select to authenticated using (
  exists (
    select 1 from public.sea_pickups sp join public.capsules c on c.id = sp.capsule_id
    where c.sea and ((c.sender = profiles.id and sp.finder = auth.uid())
      or (c.sender = auth.uid() and sp.finder = profiles.id))
  )
);

-- Public metadata only. The letter remains in capsule_contents and is never
-- selected here. Location accuracy follows open_capsule's 0 < accuracy <= 200 m.
create function public.sea_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision)
returns table (
  id uuid, hint text, vessel text, lat double precision, lng double precision,
  shore_zh text, shore_en text, sealed_at timestamptz, washed_up_at timestamptz,
  "returns" integer, sender jsonb
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.hint, c.vessel, s.lat, s.lng, s.name_zh, s.name_en,
    c.sealed_at, c.open_at, c.sea_returns,
    jsonb_build_object('id', p.id, 'name', p.name, 'avatar', p.avatar, 'city', p.city)
  from public.capsules c
  join public.sea_shores s on s.id = c.shore
  join public.profiles p on p.id = c.sender
  where auth.uid() is not null
    and p_lat between -90 and 90 and p_lng between -180 and 180
    and p_accuracy > 0 and p_accuracy <= 200
    and c.sea and c.recipient is null and c.open_at <= now()
    and c.sender <> auth.uid()
    and public.distance_m(p_lat, p_lng, s.lat, s.lng) <= 5000
    and not exists (select 1 from public.sea_pickups x where x.capsule_id = c.id and x.finder = auth.uid())
    and not exists (select 1 from public.sea_reports r where r.capsule_id = c.id and r.reporter = auth.uid())
    and (select count(*) from public.sea_reports r where r.capsule_id = c.id) < 2
  order by public.distance_m(p_lat, p_lng, s.lat, s.lng), c.open_at
  limit 100;
$$;

-- The day boundary is UTC for every city, so concurrency and travel cannot
-- change which three pickups count toward one day's limit.
create function public.sea_pickups_left()
returns integer
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then 0 else greatest(0, 3 - count(*)::integer) end
  from public.sea_pickups
  where finder = auth.uid()
    and picked_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC');
$$;

create function public.sea_pick_up(p_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns void
language plpgsql security definer set search_path = '' as $$
declare c public.capsules; s public.sea_shores; v_count integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  -- Serialize this user's pickups across different bottles before checking the limit.
  perform pg_advisory_xact_lock(hashtext('sea-pickups:' || auth.uid()::text));
  select * into c from public.capsules where id = p_id for update;
  if c.id is null or not c.sea then raise exception 'taken'; end if;
  if c.sender = auth.uid() then raise exception 'own_bottle'; end if;
  if c.recipient is not null or c.open_at > now()
    or exists (select 1 from public.sea_pickups x where x.capsule_id = p_id and x.finder = auth.uid())
    or exists (select 1 from public.sea_reports r where r.capsule_id = p_id and r.reporter = auth.uid())
    or (select count(*) from public.sea_reports r where r.capsule_id = p_id) >= 2
  then raise exception 'taken'; end if;
  select count(*) into v_count from public.sea_pickups
    where finder = auth.uid() and picked_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC');
  if v_count >= 3 then raise exception 'daily_limit'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180
    or p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200
  then raise exception 'too_far'; end if;
  select * into s from public.sea_shores where id = c.shore;
  if s.id is null or public.distance_m(p_lat, p_lng, s.lat, s.lng) > 100 then
    raise exception 'too_far';
  end if;
  insert into public.sea_pickups (capsule_id, finder) values (p_id, auth.uid());
  update public.capsules set recipient = auth.uid() where id = p_id;
end $$;

create function public.sea_throw(
  p_message text, p_hint text, p_vessel text, p_drift_days integer,
  p_lat double precision, p_lng double precision, p_accuracy double precision
)
returns table (id uuid, shore_zh text, shore_en text, washes_up_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v public.vessels; v_ed integer; s public.sea_shores; v_id uuid;
  v_message text; v_hint text; v_scan text; v_open_at timestamptz; w text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  v_message := btrim(coalesce(p_message, ''));
  v_hint := btrim(coalesce(p_hint, ''));
  if char_length(v_message) not between 1 and 280 or char_length(v_hint) > 40
    or p_drift_days is null or p_drift_days not in (1,7,30,365) then
    raise exception 'rejected';
  end if;
  -- First-pass safety gate, deliberately small and reviewable. A future
  -- moderation service can replace it after Roy chooses one. Check the hint too.
  v_scan := lower(v_message || ' ' || v_hint);
  if v_scan ~* '[[:alnum:]._%+\-]+@[[:alnum:].\-]+\.[[:alpha:]]{2,}'
    or v_scan ~* '(https?://|www\.|[[:alnum:]\-]+\.(com|net|org|io|cn|hk|tw|sg|my|jp|kr)(/|\b))'
    or v_scan ~ '(\+?[0-9][0-9 ()+.-]{6,}[0-9])'
  then raise exception 'rejected'; end if;
  foreach w in array array['kill yourself','go die','fuck you','bitch','nigger','去死','滾開','傻逼','操你','冚家剷'] loop
    if position(w in v_scan) > 0 then raise exception 'rejected'; end if;
  end loop;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180
    or p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200 then
    raise exception 'no_shore';
  end if;
  select * into s from public.sea_shores x
    where public.distance_m(p_lat, p_lng, x.lat, x.lng) <= 3000
    order by public.distance_m(p_lat, p_lng, x.lat, x.lng), x.id limit 1;
  if s.id is null then raise exception 'no_shore'; end if;
  -- Exactly the current send_capsule vessel rule: free catalogue items are
  -- available; priced and place-earned vessels must already be owned.
  select * into v from public.vessels where public.vessels.id = p_vessel;
  if v.id is null then raise exception 'unknown vessel'; end if;
  if v.price_mop > 0 or v.earned_place is not null then
    select edition_no into v_ed from public.owned_vessels where user_id = auth.uid() and vessel = p_vessel;
    if not found then raise exception 'vessel not owned' using hint = 'not_owned'; end if;
  end if;
  v_open_at := now() + make_interval(days => p_drift_days);
  insert into public.capsules (sender, recipient, vessel, hint, open_at, edition_no, sea, shore)
    values (auth.uid(), null, p_vessel, v_hint, v_open_at, v_ed, true, s.id)
    returning public.capsules.id into v_id;
  insert into public.capsule_contents (capsule_id, message) values (v_id, v_message);
  return query select v_id, s.name_zh, s.name_en, v_open_at;
end $$;

create function public.sea_return(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare c public.capsules; old_shore public.sea_shores; next_shore public.sea_shores;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from public.capsules where id = p_id for update;
  if c.id is null or not c.sea or c.recipient is distinct from auth.uid() or c.opened_at is null then
    raise exception 'taken';
  end if;
  select * into old_shore from public.sea_shores where id = c.shore;
  select * into next_shore from public.sea_shores s
    where s.id <> old_shore.id
      and public.distance_m(s.lat, s.lng, old_shore.lat, old_shore.lng) >= 1000
    order by case when s.city_en = old_shore.city_en then 0 else 1 end, random() limit 1;
  if next_shore.id is null then raise exception 'no_shore'; end if;
  update public.capsules set recipient = null, shore = next_shore.id,
    open_at = now() + interval '1 day', sea_returns = sea_returns + 1,
    opened_at = null, seen_at = null, opened_lat = null, opened_lng = null,
    opened_distance_m = null, gift_code = null
    where id = p_id;
end $$;

create function public.sea_report(p_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare c public.capsules;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_reason is null or p_reason not in ('unkind','personal','spam','other') then raise exception 'rejected'; end if;
  select * into c from public.capsules where id = p_id for update;
  if c.id is null or not c.sea or not exists (
    select 1 from public.sea_pickups x where x.capsule_id = p_id and x.finder = auth.uid()
  ) then raise exception 'taken'; end if;
  insert into public.sea_reports (capsule_id, reporter, reason)
    values (p_id, auth.uid(), p_reason) on conflict (capsule_id, reporter) do nothing;
  -- Reporting an opened bottle removes it from this finder's Inbox at once.
  -- One report leaves it ashore for others; two reports hide it globally.
  if c.recipient = auth.uid() then
    update public.capsules set recipient = null, opened_at = null, seen_at = null,
      opened_lat = null, opened_lng = null, opened_distance_m = null,
      open_at = now()
      where id = p_id;
  end if;
end $$;

revoke all on function public.sea_nearby(double precision,double precision,double precision),
  public.sea_pick_up(uuid,double precision,double precision,double precision),
  public.sea_return(uuid), public.sea_throw(text,text,text,integer,double precision,double precision,double precision),
  public.sea_report(uuid,text), public.sea_pickups_left() from public, anon, authenticated;
grant execute on function public.sea_nearby(double precision,double precision,double precision),
  public.sea_pick_up(uuid,double precision,double precision,double precision),
  public.sea_return(uuid), public.sea_throw(text,text,text,integer,double precision,double precision,double precision),
  public.sea_report(uuid,text), public.sea_pickups_left() to authenticated;

notify pgrst, 'reload schema';
commit;
