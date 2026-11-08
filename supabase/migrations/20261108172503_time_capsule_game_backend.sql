-- Time Capsule collecting game. Additive: existing Shop, sending, and stranger-capsule RPCs stay intact.
-- Waypost and spot coordinates below come from OpenStreetMap API 0.6 map extracts
-- (https://api.openstreetmap.org/api/0.6/map, © OpenStreetMap contributors, ODbL)
-- inspected on 2026-11-09. Each new source_ref is the actual OSM object.
begin;

create schema if not exists private;
-- Preserve private schema USAGE and the existing voice policy helper grants.

-- One private row contains all tunable gameplay numbers. Changing it needs no migration.
create table private.game_config (
  singleton boolean primary key default true check (singleton),
  nearby_radius_m integer not null,
  action_radius_m integer not null,
  max_accuracy_m integer not null,
  wave_minutes integer not null,
  spawn_chance double precision not null,
  visible_min_minutes integer not null,
  visible_max_minutes integer not null,
  max_attempts integer not null,
  start_wax integer not null,
  start_gold integer not null,
  spin_wax_min integer not null,
  spin_wax_max integer not null,
  spin_gold_chance double precision not null,
  spin_gold_award integer not null,
  spin_cooldown_seconds integer not null,
  landmark_cracks integer not null,
  landmark_seconds integer not null,
  landmark_strong_ring double precision not null,
  landmark_normal_damage integer not null,
  landmark_strong_damage integer not null,
  xp_catch integer not null,
  xp_new_vessel integer not null,
  xp_spin integer not null,
  xp_first_daily_catch integer not null,
  xp_landmark integer not null,
  xp_open_base integer not null,
  xp_open_per_day integer not null,
  xp_open_min_days integer not null,
  xp_open_day_cap integer not null,
  star_thresholds integer[] not null,
  xp_level_factor integer not null,
  max_level integer not null,
  max_speed_mps double precision not null,
  rarity_common_weight integer not null,
  rarity_uncommon_weight integer not null,
  rarity_rare_weight integer not null,
  restore_common double precision not null,
  restore_uncommon double precision not null,
  restore_rare double precision not null,
  restore_ring_bonus double precision not null,
  restore_gold_bonus double precision not null,
  check (nearby_radius_m>0 and action_radius_m>0 and action_radius_m<=nearby_radius_m
    and max_accuracy_m>0),
  check (wave_minutes>0 and visible_min_minutes>0
    and visible_max_minutes>=visible_min_minutes and visible_max_minutes<=wave_minutes),
  check (spawn_chance between 0 and 1 and spin_gold_chance between 0 and 1),
  check (max_attempts>0 and start_wax>=0 and start_gold>=0),
  check (spin_wax_min>=0 and spin_wax_max>=spin_wax_min and spin_gold_award>=0
    and spin_cooldown_seconds>0),
  check (landmark_cracks>0 and landmark_seconds>0 and landmark_strong_ring between 0 and 1
    and landmark_normal_damage>0 and landmark_strong_damage>=landmark_normal_damage),
  check (xp_catch>0 and xp_new_vessel>0 and xp_spin>0
    and xp_first_daily_catch>0 and xp_landmark>0 and xp_open_base>0
    and xp_open_per_day>0 and xp_open_min_days>0
    and xp_open_day_cap>=xp_open_min_days),
  check (array_length(star_thresholds,1)=5 and xp_level_factor>0
    and max_level>1 and max_speed_mps>0),
  check (rarity_common_weight>=0 and rarity_uncommon_weight>=0
    and rarity_rare_weight>=0 and
    rarity_common_weight+rarity_uncommon_weight+rarity_rare_weight>0),
  check (restore_common between 0 and 1 and restore_uncommon between 0 and 1
    and restore_rare between 0 and 1 and restore_ring_bonus between 0 and 1
    and restore_gold_bonus between 0 and 1)
);
insert into private.game_config values
  (true,500,100,200,60,0.35,30,60,3,30,2,3,5,0.05,1,300,12,180,0.8,1,2,
   100,500,20,300,2000,100,20,1,365,array[1,3,6,10,15],500,30,40,
   60,30,10,0.50,0.30,0.12,0.25,0.25);
create table private.game_secret (
  singleton boolean primary key default true check (singleton),
  secret bytea not null
);
insert into private.game_secret values (true, extensions.gen_random_bytes(32));
create table private.game_speed_allowlist (
  user_id uuid primary key references auth.users(id) on delete cascade
);
-- Existing dedicated QA account and the current stranger-capsule test account.
insert into private.game_speed_allowlist(user_id)
  select id from auth.users where email in
    ('expo-test-a138d8@timecapsule.test','sea-s1-demo-3844bd@timecapsule.test');
revoke all on private.game_config,private.game_secret,private.game_speed_allowlist
  from public, anon, authenticated;

alter table public.sea_shores
  add column kind text not null default 'common' check (kind in ('common','landmark')),
  add column place text references public.places(id),
  add column game_enabled boolean not null default false,
  add column source_ref text,
  add constraint sea_shores_landmark_place check
    ((kind = 'landmark' and place is not null) or (kind = 'common' and place is null));
create unique index sea_shores_source_ref on public.sea_shores(source_ref) where source_ref is not null;
update public.sea_shores set game_enabled = true
  where city_en in ('Taipei','Singapore','Macau');

-- More public parks, squares, outdoor art and libraries in the launch areas.
-- OSM way centres were inspected against their feature type and access tags.
insert into public.sea_shores(name_zh,name_en,city_zh,city_en,lat,lng,game_enabled,source_ref) values
  ('香緹大道廣場','Xiangti Avenue Square','台北','Taipei',25.037475,121.567017,true,'osm:node/12396028030'),
  ('信義21號廣場','Xinyi 21 Plaza','台北','Taipei',25.034697,121.564359,true,'osm:way/1341042550'),
  ('景聯廣場','Jinglian Plaza','台北','Taipei',25.032348,121.560171,true,'osm:way/232744980'),
  ('敦安公園','Dunan Park','台北','Taipei',25.034523,121.553720,true,'osm:way/303853362'),
  ('延吉公園','Yanji Park','台北','Taipei',25.042677,121.555908,true,'osm:way/310321226'),
  ('通化公園','Tonghua Park','台北','Taipei',25.032235,121.554478,true,'osm:way/363250649'),
  ('中興公園','Zhongxing Park','台北','Taipei',25.034283,121.559213,true,'osm:way/382774204'),
  ('正和公園','Zhenghe Park','台北','Taipei',25.036029,121.559266,true,'osm:way/430627693'),
  ('象山公園','Xiangshan Park','台北','Taipei',25.030870,121.570342,true,'osm:way/27244215'),
  ('中信廣場','Zhongxin Plaza','台北','Taipei',25.040680,121.568056,true,'osm:way/298063022'),
  ('維也納藝術廣場','Vienna Art Plaza','台北','Taipei',25.038570,121.571503,true,'osm:way/324949341'),
  ('松仁綠地','Songren Green','台北','Taipei',25.032549,121.567570,true,'osm:way/555866062'),
  ('克利福廣場','Clifford Square','新加坡','Singapore',1.284618,103.853515,true,'osm:way/1229857586'),
  ('河邊商人雕塑','The River Merchants','新加坡','Singapore',1.286090,103.852409,true,'osm:node/6412395559'),
  ('第一代雕塑','The First Generation','新加坡','Singapore',1.286411,103.852587,true,'osm:node/5290885221'),
  ('雲九雕塑','Cloud Nine: Raining','新加坡','Singapore',1.288786,103.853955,true,'osm:node/6905403985'),
  ('海天之間雕塑','Between Sea and Sky','新加坡','Singapore',1.292241,103.857065,true,'osm:node/5018207222'),
  ('天空之鏡','Sky Mirror','新加坡','Singapore',1.286313,103.859801,true,'osm:node/6446571460'),
  ('世界團結雕塑','A World United','新加坡','Singapore',1.280082,103.855803,true,'osm:node/7046277685'),
  ('華士古達嘉馬花園','Vasco da Gama Garden','澳門','Macau',22.196198,113.546333,true,'osm:way/183840226'),
  ('回歸公園','Return Park','澳門','Macau',22.196222,113.553205,true,'osm:way/305387668'),
  ('蒙地卡羅前地','Monte Carlo Square','澳門','Macau',22.193149,113.554371,true,'osm:way/307049970'),
  ('區華利前地','Jorge Álvares Square','澳門','Macau',22.191303,113.539935,true,'osm:way/346900281'),
  ('何賢公園圖書館','Ho Yin Garden Library','澳門','Macau',22.192512,113.548978,true,'osm:way/402151732'),
  ('昆明街休憩區','Kunming Street Garden','澳門','Macau',22.193240,113.549930,true,'osm:way/640169194'),
  ('大炮台公園','Mount Fortress Park','澳門','Macau',22.197031,113.541867,true,'osm:way/488185729'),
  ('崗頂前地','St Augustine Square','澳門','Macau',22.192246,113.538109,true,'osm:way/823303474');

-- Landmark actions are on public outdoor spots, linked to the existing places.
insert into public.sea_shores
  (name_zh,name_en,city_zh,city_en,lat,lng,kind,place,game_enabled,source_ref) values
  ('台北101廣場','Taipei 101 Plaza','台北','Taipei',25.033263,121.564887,
   'landmark','taipei101',true,'osm:node/6936432822'),
  ('魚尾獅公園','Merlion Park','新加坡','Singapore',1.286798,103.854301,
   'landmark','merlion',true,'osm:node/6283080658'),
  ('議事亭前地','Senado Square','澳門','Macau',22.193830,113.539990,
   'landmark','senado',true,'osm:way/192573684');

create table public.lost_spots (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  timezone text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  habitat text not null check (habitat in ('park','water','square')),
  source_ref text not null unique
);
alter table public.lost_spots enable row level security;
revoke all on public.lost_spots from public, anon, authenticated;
-- OSM source refs for the original safe shores, in the same order as their 2026-11-08 seed.
with refs(city_en, name_en, source_ref) as (values
  ('Taipei','Taipei Civic Square','osm:way/309157011'),
  ('Taipei','Songzhi Park','osm:relation/18367478'),
  ('Taipei','Songshou Square','osm:way/233666147'),
  ('Taipei','Zhongshan Park','osm:relation/4727715'),
  ('Taipei','Xinyi Square','osm:way/261647304'),
  ('Taipei','Taipei World Trade Center Plaza','osm:way/555117276'),
  ('Singapore','Merlion Park','osm:way/687917300'),
  ('Singapore','Esplanade Park','osm:relation/9976848'),
  ('Singapore','Youth Olympic Park','osm:way/395120471'),
  ('Singapore','Raffles Place Park','osm:way/106193383'),
  ('Singapore','War Memorial Park','osm:way/460428718'),
  ('Singapore','The Lawn @ Marina Bay','osm:way/116905791'),
  ('Macau','Dr. Carlos d’Assumpção Park','osm:relation/11551012'),
  ('Macau','Kun Iam Waterfront Leisure Area','osm:way/192180025'),
  ('Macau','Arts Garden','osm:way/192182416'),
  ('Macau','Cultural Centre Square','osm:way/307049831'),
  ('Macau','Ferreira do Amaral Square','osm:way/244524327'),
  ('Macau','Golden Lotus Square','osm:way/192179907')
)
update public.sea_shores s set source_ref = r.source_ref
from refs r where s.kind='common' and s.city_en = r.city_en and s.name_en = r.name_en;
insert into public.lost_spots(city,timezone,lat,lng,habitat,source_ref)
  select city_en,
    case city_en when 'Taipei' then 'Asia/Taipei' when 'Singapore' then 'Asia/Singapore' else 'Asia/Macau' end,
    lat,lng,
    case when name_en ilike '%waterfront%' or name_en ilike '%Merlion%' or name_en ilike '%Marina%'
      or name_en ilike '%River%' or name_en ilike '%Olympic%' then 'water'
      when name_en ilike '%square%' or name_en ilike '%plaza%' or name_en ilike '%art%'
      or name_en ilike '%sculpture%' then 'square' else 'park' end,
    source_ref
  from public.sea_shores
  where city_en in ('Taipei','Singapore','Macau') and kind = 'common'
    and game_enabled and source_ref is not null;

create table private.vessel_spawn_rules (
  vessel text primary key references public.vessels(id),
  rarity text not null check (rarity in ('common','uncommon','rare')),
  habitat text check (habitat in ('park','water','square')),
  local_start_hour integer check (local_start_hour between 0 and 23),
  local_end_hour integer check (local_end_hour between 0 and 23),
  month_day_start text check (month_day_start ~ '^[0-1][0-9]-[0-3][0-9]$'),
  month_day_end text check (month_day_end ~ '^[0-1][0-9]-[0-3][0-9]$'),
  check ((local_start_hour is null) = (local_end_hour is null)),
  check ((month_day_start is null) = (month_day_end is null))
);
-- Free vessels are common; priced ordinary vessels split into price-ordered thirds.
with ranked as (
  select id, price_mop,
    ntile(3) over (order by price_mop, sort, id) as price_third
  from public.vessels
  where brand is null and edition_total is null and earned_place is null
    and price_mop > 0
)
insert into private.vessel_spawn_rules(vessel,rarity)
  select v.id, case when v.price_mop = 0 then 'common'
    when r.price_third = 1 then 'common'
    when r.price_third = 2 then 'uncommon' else 'rare' end
  from public.vessels v left join ranked r on r.id = v.id
  where v.brand is null and v.edition_total is null and v.earned_place is null;
update private.vessel_spawn_rules set habitat = 'water' where vessel = 'bottle';
update private.vessel_spawn_rules set local_start_hour = 18, local_end_hour = 5
  where vessel = 'firefly-jar';
-- Two-week 2026 festival windows. Lunar dates are data and must be retuned each year.
update private.vessel_spawn_rules set month_day_start = '09-18', month_day_end = '10-01'
  where vessel in ('lantern','mooncake-tin');
update private.vessel_spawn_rules set month_day_start = '12-18', month_day_end = '12-31'
  where vessel = 'stocking';
update private.vessel_spawn_rules set month_day_start = '02-10', month_day_end = '02-23'
  where vessel = 'red-packet';
update private.vessel_spawn_rules set month_day_start = '02-07', month_day_end = '02-20'
  where vessel = 'chocolate-heart';
update private.vessel_spawn_rules set month_day_start = '10-24', month_day_end = '11-06'
  where vessel = 'pumpkin';
update private.vessel_spawn_rules set month_day_start = '06-12', month_day_end = '06-25'
  where vessel = 'rice-dumpling';
update private.vessel_spawn_rules set month_day_start = '08-12', month_day_end = '08-25'
  where vessel in ('wish-tag','river-lantern');
revoke all on private.vessel_spawn_rules from public, anon, authenticated;
alter table private.game_config enable row level security;
alter table private.game_secret enable row level security;
alter table private.game_speed_allowlist enable row level security;
alter table private.vessel_spawn_rules enable row level security;

create table public.player_game (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  wax_balls integer not null check (wax_balls >= 0),
  gold_balls integer not null check (gold_balls >= 0),
  last_lat double precision,
  last_lng double precision,
  last_position_at timestamptz
);
create table public.lost_catches (
  user_id uuid not null references public.profiles(id) on delete cascade,
  spawn_id text not null,
  attempts integer not null default 0 check (attempts >= 0),
  result text not null default 'pending' check (result in ('pending','caught','failed')),
  vessel text not null references public.vessels(id),
  caught_at timestamptz,
  primary key (user_id,spawn_id)
);
create table public.waypost_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  waypost_id uuid not null references public.sea_shores(id),
  spun_at timestamptz not null default now(),
  wax_awarded integer not null,
  gold_awarded integer not null
);
create index waypost_spins_latest on public.waypost_spins(user_id,waypost_id,spun_at desc);
create table public.landmark_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  waypost_id uuid not null references public.sea_shores(id),
  cracks_left integer not null check (cracks_left >= 0),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  won_at timestamptz
);
create index landmark_attempts_active on public.landmark_attempts(user_id,expires_at desc);
create table public.xp_events (
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  reference text not null,
  amount integer not null check (amount > 0),
  awarded_at timestamptz not null default now(),
  primary key (user_id,source,reference)
);
create table public.passport_stamps (
  user_id uuid not null references public.profiles(id) on delete cascade,
  place text not null references public.places(id),
  first_at timestamptz not null,
  how_earned text not null check (how_earned in ('landmark','capsule')),
  primary key (user_id,place)
);
alter table public.owned_vessels add column copies integer not null default 1 check (copies >= 1);
alter table public.player_game enable row level security;
alter table public.lost_catches enable row level security;
alter table public.waypost_spins enable row level security;
alter table public.landmark_attempts enable row level security;
alter table public.xp_events enable row level security;
alter table public.passport_stamps enable row level security;
revoke all on public.player_game,public.lost_catches,public.waypost_spins,
  public.landmark_attempts,public.xp_events,public.passport_stamps
  from public, anon, authenticated;

-- Internal helpers are unreachable through the exposed Data API.
create function private.ensure_player(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare cfg private.game_config;
begin
  if p_user is null or p_user <> auth.uid() then raise exception 'not signed in'; end if;
  select * into cfg from private.game_config where singleton;
  insert into public.player_game(user_id,wax_balls,gold_balls)
    values(p_user,cfg.start_wax,cfg.start_gold) on conflict (user_id) do nothing;
end $$;

create function private.track_position(
  p_lat double precision,p_lng double precision,p_accuracy double precision
)
returns public.player_game language plpgsql security definer set search_path = '' as $$
declare pg public.player_game; cfg private.game_config; elapsed double precision;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into cfg from private.game_config where singleton;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90
    or p_lng < -180 or p_lng > 180 or p_accuracy is null
    or p_accuracy <= 0 or p_accuracy > cfg.max_accuracy_m
    then raise exception 'too_far'; end if;
  perform private.ensure_player(auth.uid());
  select * into pg from public.player_game where user_id = auth.uid() for update;
  if pg.last_position_at is not null
    and not exists (select 1 from private.game_speed_allowlist where user_id = auth.uid()) then
    elapsed := greatest(extract(epoch from clock_timestamp() - pg.last_position_at),0.001);
    if public.distance_m(pg.last_lat,pg.last_lng,p_lat,p_lng) / elapsed > cfg.max_speed_mps
      then raise exception 'too_fast'; end if;
  end if;
  update public.player_game set last_lat=p_lat,last_lng=p_lng,
    last_position_at=clock_timestamp() where user_id=auth.uid() returning * into pg;
  return pg;
end $$;

create function private.game_roll(p_key text)
returns double precision language plpgsql stable security definer set search_path = '' as $$
declare h bytea;
begin
  select extensions.hmac(pg_catalog.convert_to(p_key,'UTF8'),secret,'sha256')
    into h from private.game_secret where singleton;
  return (get_byte(h,0)*16777216.0 + get_byte(h,1)*65536.0
    + get_byte(h,2)*256.0 + get_byte(h,3)) / 4294967296.0;
end $$;

create function private.award_xp(p_user uuid,p_source text,p_reference text,p_amount integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare paid integer;
begin
  if p_user is null or p_user <> auth.uid() or p_amount <= 0 then
    raise exception 'rejected'; end if;
  insert into public.xp_events(user_id,source,reference,amount)
    values(p_user,p_source,p_reference,p_amount)
    on conflict (user_id,source,reference) do nothing returning amount into paid;
  if paid is not null then
    update public.player_game set xp=xp+paid where user_id=p_user;
  end if;
  return coalesce(paid,0);
end $$;

-- Only the server can derive a spot's release, chosen vessel, and expiration.
create function private.resolve_spawn(p_spot uuid,p_wave bigint)
returns table(spawn_id text,vessel text,rarity text,expires_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare spot public.lost_spots; cfg private.game_config; wave_at timestamptz;
  local_hour integer; local_md text; chosen_rarity text; picked text;
  rarity_roll double precision; total_weight integer; visible_minutes integer;
begin
  select * into spot from public.lost_spots where id=p_spot;
  if spot.id is null then return; end if;
  select * into cfg from private.game_config where singleton;
  wave_at := to_timestamp(p_wave * cfg.wave_minutes * 60);
  if private.game_roll(p_spot::text||':'||p_wave||':show') >= cfg.spawn_chance
    then return; end if;
  local_hour := extract(hour from wave_at at time zone spot.timezone)::integer;
  local_md := to_char(wave_at at time zone spot.timezone,'MM-DD');
  rarity_roll := private.game_roll(p_spot::text||':'||p_wave||':rarity');
  total_weight := cfg.rarity_common_weight+cfg.rarity_uncommon_weight+cfg.rarity_rare_weight;
  chosen_rarity := case
    when rarity_roll < cfg.rarity_common_weight::double precision/total_weight then 'common'
    when rarity_roll < (cfg.rarity_common_weight+cfg.rarity_uncommon_weight)::double precision/total_weight
      then 'uncommon' else 'rare' end;
  select r.vessel into picked from private.vessel_spawn_rules r
    where r.rarity = chosen_rarity
      and (r.habitat is null or r.habitat=spot.habitat)
      and (r.local_start_hour is null
        or (r.local_start_hour < r.local_end_hour and local_hour >= r.local_start_hour and local_hour < r.local_end_hour)
        or (r.local_start_hour > r.local_end_hour and (local_hour >= r.local_start_hour or local_hour < r.local_end_hour)))
      and (r.month_day_start is null
        or (r.month_day_start <= r.month_day_end and local_md between r.month_day_start and r.month_day_end)
        or (r.month_day_start > r.month_day_end and (local_md >= r.month_day_start or local_md <= r.month_day_end)))
    order by private.game_roll(p_spot::text||':'||p_wave||':vessel:'||r.vessel)
    limit 1;
  if picked is null then return; end if;
  visible_minutes := cfg.visible_min_minutes + floor(
    private.game_roll(p_spot::text||':'||p_wave||':duration') *
    (cfg.visible_max_minutes-cfg.visible_min_minutes+1))::integer;
  spawn_id := p_spot::text||':'||p_wave::text;
  vessel := picked; rarity := chosen_rarity;
  expires_at := wave_at + make_interval(mins=>visible_minutes);
  return next;
end $$;
revoke all on function private.ensure_player(uuid),
  private.track_position(double precision,double precision,double precision),
  private.game_roll(text),private.award_xp(uuid,text,text,integer),
  private.resolve_spawn(uuid,bigint)
  from public,anon,authenticated;

create function public.game_state()
returns table(xp bigint,level integer,xp_to_next bigint,wax_balls integer,
  gold_balls integer,first_catch_bonus_available boolean)
language plpgsql security definer set search_path = '' as $$
declare pg public.player_game; cfg private.game_config;
begin
  perform private.ensure_player(auth.uid());
  select * into pg from public.player_game where user_id=auth.uid();
  select * into cfg from private.game_config where singleton;
  xp := pg.xp;
  level := least(cfg.max_level,1+floor(sqrt(pg.xp::numeric/cfg.xp_level_factor))::integer);
  xp_to_next := case when level=cfg.max_level then 0
    else cfg.xp_level_factor::bigint*level*level-pg.xp end;
  wax_balls := pg.wax_balls; gold_balls := pg.gold_balls;
  first_catch_bonus_available := not exists (
    select 1 from public.xp_events e where e.user_id=auth.uid()
      and e.source='first_catch_day'
      and e.reference=(now() at time zone 'UTC')::date::text);
  return next;
end $$;

create function public.lost_nearby(
  p_lat double precision,p_lng double precision,p_accuracy double precision
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cfg private.game_config; result_spawns jsonb; result_wayposts jsonb; wave bigint;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  wave := floor(extract(epoch from now())/(cfg.wave_minutes*60))::bigint;
  select coalesce(jsonb_agg(jsonb_build_object(
    'spawn_id',s.spawn_id,'vessel',s.vessel,'rarity',s.rarity,
    'lat',p.lat,'lng',p.lng,'expires_at',s.expires_at,
    'attempts_left',greatest(0,cfg.max_attempts-coalesce(c.attempts,0)),
    'already_caught',coalesce(c.result='caught',false))
    order by s.expires_at), '[]'::jsonb) into result_spawns
  from public.lost_spots p
  cross join lateral generate_series(wave-1,wave) w(n)
  cross join lateral private.resolve_spawn(p.id,w.n) s
  left join public.lost_catches c on c.user_id=auth.uid() and c.spawn_id=s.spawn_id
  where public.distance_m(p_lat,p_lng,p.lat,p.lng)<=cfg.nearby_radius_m
    and s.expires_at>now()
    and to_timestamp(w.n*cfg.wave_minutes*60)<=now();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'kind',s.kind,'name_zh',s.name_zh,'name_en',s.name_en,
    'city_zh',s.city_zh,'city_en',s.city_en,'place',s.place,
    'lat',s.lat,'lng',s.lng,
    'cooldown_end',case when s.kind='common'
      then (select max(spun_at)+make_interval(secs=>cfg.spin_cooldown_seconds)
        from public.waypost_spins x where x.user_id=auth.uid() and x.waypost_id=s.id)
      else null end)
    order by s.kind,s.name_en),'[]'::jsonb) into result_wayposts
  from public.sea_shores s
  where s.game_enabled and public.distance_m(p_lat,p_lng,s.lat,s.lng)<=cfg.nearby_radius_m;
  return jsonb_build_object('spawns',result_spawns,'wayposts',result_wayposts);
end $$;

create function public.lost_throw(
  p_spawn text,p_lat double precision,p_lng double precision,p_accuracy double precision,
  p_ball text,p_ring double precision,p_hit boolean
) returns table(result text,vessel text,copies integer,stars integer,is_new boolean,
  xp_gained integer,wax_balls integer,gold_balls integer,attempts_left integer)
language plpgsql security definer set search_path = '' as $$
declare pg public.player_game; cfg private.game_config; spot public.lost_spots;
  released record; caught public.lost_catches; wave bigint; current_wave bigint;
  chance double precision; did_catch boolean;
begin
  if p_spawn is null or p_spawn !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9]{1,18}$'
    then raise exception 'expired'; end if;
  if p_ball is null or p_ball not in ('wax','gold') or p_ring is null or p_hit is null
    or p_ring::text in ('NaN','Infinity','-Infinity') then raise exception 'rejected'; end if;
  pg := private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  wave := split_part(p_spawn,':',2)::bigint;
  current_wave := floor(extract(epoch from now())/(cfg.wave_minutes*60))::bigint;
  if wave not between current_wave-1 and current_wave then raise exception 'expired'; end if;
  select * into spot from public.lost_spots where id=split_part(p_spawn,':',1)::uuid;
  if spot.id is null then raise exception 'expired'; end if;
  select * into released from private.resolve_spawn(spot.id,wave);
  if released.spawn_id is null or released.spawn_id<>p_spawn or released.expires_at<=now()
    then raise exception 'expired'; end if;
  if public.distance_m(p_lat,p_lng,spot.lat,spot.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  select * into caught from public.lost_catches
    where user_id=auth.uid() and spawn_id=p_spawn for update;
  if caught.result='caught' then raise exception 'already_caught'; end if;
  if coalesce(caught.attempts,0)>=cfg.max_attempts then raise exception 'no_attempts'; end if;
  if (p_ball='wax' and pg.wax_balls<1) or (p_ball='gold' and pg.gold_balls<1)
    then raise exception 'no_balls'; end if;
  update public.player_game set
    wax_balls=public.player_game.wax_balls-case when p_ball='wax' then 1 else 0 end,
    gold_balls=public.player_game.gold_balls-case when p_ball='gold' then 1 else 0 end
    where user_id=auth.uid() returning * into pg;
  vessel := released.vessel; result := 'miss'; copies := null; stars := null;
  is_new := false; xp_gained := 0;
  attempts_left := cfg.max_attempts-coalesce(caught.attempts,0);
  if p_hit then
    insert into public.lost_catches(user_id,spawn_id,attempts,result,vessel)
      values(auth.uid(),p_spawn,1,'pending',vessel)
      on conflict (user_id,spawn_id) do update
      set attempts=public.lost_catches.attempts+1
      returning * into caught;
    attempts_left := greatest(0,cfg.max_attempts-caught.attempts);
    chance := case released.rarity when 'common' then cfg.restore_common
      when 'uncommon' then cfg.restore_uncommon else cfg.restore_rare end;
    chance := least(1.0,chance+cfg.restore_ring_bonus*least(1.0,greatest(0.0,p_ring))
      +case when p_ball='gold' then cfg.restore_gold_bonus else 0 end);
    did_catch := random()<chance;
    if did_catch then
      update public.lost_catches set result='caught',caught_at=now()
        where user_id=auth.uid() and spawn_id=p_spawn;
      is_new := not exists (select 1 from public.owned_vessels
        where user_id=auth.uid() and public.owned_vessels.vessel=lost_throw.vessel);
      insert into public.owned_vessels(user_id,vessel,copies)
        values(auth.uid(),vessel,1)
        on conflict on constraint owned_vessels_pkey do update
          set copies=public.owned_vessels.copies+1
        returning public.owned_vessels.copies into copies;
      select count(*)::integer into stars from unnest(cfg.star_thresholds) threshold
        where threshold<=copies;
      xp_gained := private.award_xp(auth.uid(),'catch',p_spawn,cfg.xp_catch);
      if is_new then xp_gained := xp_gained+
        private.award_xp(auth.uid(),'new_vessel',vessel,cfg.xp_new_vessel); end if;
      xp_gained := xp_gained+private.award_xp(auth.uid(),'first_catch_day',
        (now() at time zone 'UTC')::date::text,cfg.xp_first_daily_catch);
      result := 'restored';
    else
      update public.lost_catches set result=case when attempts>=cfg.max_attempts
        then 'failed' else 'pending' end
        where user_id=auth.uid() and spawn_id=p_spawn;
      result := 'not_restored';
    end if;
  end if;
  wax_balls:=pg.wax_balls; gold_balls:=pg.gold_balls;
  return next;
end $$;

create function public.waypost_spin(
  p_id uuid,p_lat double precision,p_lng double precision,p_accuracy double precision
) returns table(wax_awarded integer,gold_awarded integer,xp_gained integer,
  wax_balls integer,gold_balls integer,cooldown_end timestamptz)
language plpgsql security definer set search_path = '' as $$
declare pg public.player_game; cfg private.game_config; post public.sea_shores;
  last_spin timestamptz; spin_id uuid;
begin
  pg:=private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  select * into post from public.sea_shores where id=p_id and game_enabled and kind='common';
  if post.id is null then raise exception 'too_far'; end if;
  if public.distance_m(p_lat,p_lng,post.lat,post.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  select max(spun_at) into last_spin from public.waypost_spins
    where user_id=auth.uid() and waypost_id=p_id;
  if last_spin+make_interval(secs=>cfg.spin_cooldown_seconds)>now()
    then raise exception 'cooldown'; end if;
  wax_awarded:=cfg.spin_wax_min+floor(random()*
    (cfg.spin_wax_max-cfg.spin_wax_min+1))::integer;
  gold_awarded:=case when random()<cfg.spin_gold_chance then cfg.spin_gold_award else 0 end;
  insert into public.waypost_spins(user_id,waypost_id,wax_awarded,gold_awarded)
    values(auth.uid(),p_id,wax_awarded,gold_awarded) returning id,spun_at
      into spin_id,cooldown_end;
  cooldown_end:=cooldown_end+make_interval(secs=>cfg.spin_cooldown_seconds);
  update public.player_game set wax_balls=public.player_game.wax_balls+wax_awarded,
    gold_balls=public.player_game.gold_balls+gold_awarded
    where user_id=auth.uid() returning * into pg;
  xp_gained:=private.award_xp(auth.uid(),'spin',spin_id::text,cfg.xp_spin);
  wax_balls:=pg.wax_balls; gold_balls:=pg.gold_balls;
  return next;
end $$;

create function public.landmark_start(
  p_waypost uuid,p_lat double precision,p_lng double precision,p_accuracy double precision
) returns table(attempt_id uuid,cracks integer,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare cfg private.game_config; post public.sea_shores; active public.landmark_attempts;
begin
  perform private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  select * into post from public.sea_shores
    where id=p_waypost and game_enabled and kind='landmark';
  if post.id is null or public.distance_m(p_lat,p_lng,post.lat,post.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  select * into active from public.landmark_attempts a
    where a.user_id=auth.uid() and a.won_at is null and a.expires_at>now()
    order by a.expires_at desc limit 1 for update;
  if active.id is not null then
    if active.waypost_id<>p_waypost then raise exception 'active_attempt'; end if;
    attempt_id:=active.id; cracks:=active.cracks_left; expires_at:=active.expires_at;
  else
    insert into public.landmark_attempts(user_id,waypost_id,cracks_left,expires_at)
      values(auth.uid(),p_waypost,cfg.landmark_cracks,
        now()+make_interval(secs=>cfg.landmark_seconds))
      returning id,cracks_left,public.landmark_attempts.expires_at
      into attempt_id,cracks,expires_at;
  end if;
  return next;
end $$;

create function public.landmark_hit(
  p_attempt uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,
  p_ball text,p_ring double precision
) returns table(result text,cracks integer,expires_at timestamptz,vessel text,
  copies integer,stars integer,is_new boolean,xp_gained integer,
  wax_balls integer,gold_balls integer)
language plpgsql security definer set search_path = '' as $$
declare pg public.player_game; cfg private.game_config; active public.landmark_attempts;
  post public.sea_shores; damage integer; reward text;
begin
  if p_ball is null or p_ball not in ('wax','gold') or p_ring is null
    or p_ring::text in ('NaN','Infinity','-Infinity')
    then raise exception 'rejected'; end if;
  pg:=private.track_position(p_lat,p_lng,p_accuracy);
  select * into cfg from private.game_config where singleton;
  select * into active from public.landmark_attempts
    where id=p_attempt and user_id=auth.uid() for update;
  if active.id is null or active.expires_at<=now() or active.won_at is not null
    then raise exception 'expired'; end if;
  select * into post from public.sea_shores
    where id=active.waypost_id and game_enabled and kind='landmark';
  if post.id is null or public.distance_m(p_lat,p_lng,post.lat,post.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  if (p_ball='wax' and pg.wax_balls<1) or (p_ball='gold' and pg.gold_balls<1)
    then raise exception 'no_balls'; end if;
  update public.player_game set
    wax_balls=public.player_game.wax_balls-case when p_ball='wax' then 1 else 0 end,
    gold_balls=public.player_game.gold_balls-case when p_ball='gold' then 1 else 0 end
    where user_id=auth.uid() returning * into pg;
  damage:=case when p_ball='gold' or
    least(1.0,greatest(0.0,p_ring))>=cfg.landmark_strong_ring
    then cfg.landmark_strong_damage else cfg.landmark_normal_damage end;
  update public.landmark_attempts
    set cracks_left=greatest(0,cracks_left-damage),
      won_at=case when cracks_left<=damage then now() else null end
    where id=p_attempt returning cracks_left,public.landmark_attempts.expires_at
      into cracks,expires_at;
  result:='hit'; vessel:=null; copies:=null; stars:=null; is_new:=false; xp_gained:=0;
  if cracks=0 then
    select id into reward from public.vessels where earned_place=post.place;
    if reward is null then raise exception 'missing landmark vessel'; end if;
    vessel:=reward;
    is_new:=not exists (select 1 from public.owned_vessels o
      where o.user_id=auth.uid() and o.vessel=reward);
    insert into public.owned_vessels(user_id,vessel,copies)
      values(auth.uid(),reward,1)
      on conflict on constraint owned_vessels_pkey do update set copies=public.owned_vessels.copies+1
      returning public.owned_vessels.copies into copies;
    select count(*)::integer into stars from unnest(cfg.star_thresholds) threshold
      where threshold<=copies;
    insert into public.passport_stamps(user_id,place,first_at,how_earned)
      values(auth.uid(),post.place,now(),'landmark')
      on conflict (user_id,place) do nothing;
    -- The first win at a place pays XP; repeat wins still grant a copy.
    xp_gained:=private.award_xp(auth.uid(),'landmark_win',post.place,cfg.xp_landmark);
    result:='won';
  end if;
  wax_balls:=pg.wax_balls; gold_balls:=pg.gold_balls;
  return next;
end $$;

create function public.my_collection()
returns table(vessel text,copies integer,stars integer,edition_no integer,acquired_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare cfg private.game_config;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into cfg from private.game_config where singleton;
  return query select o.vessel,o.copies,
    (select count(*)::integer from unnest(cfg.star_thresholds) threshold
      where threshold<=o.copies),o.edition_no,o.acquired_at
    from public.owned_vessels o where o.user_id=auth.uid()
    order by (select sort from public.vessels v where v.id=o.vessel),o.vessel;
end $$;

-- Historical opened place capsules are included in Passport once, at their first opening.
insert into public.passport_stamps(user_id,place,first_at,how_earned)
  select recipient,place,min(opened_at),'capsule'
  from public.capsules
  where recipient is not null and place is not null and opened_at is not null
  group by recipient,place;

create function public.my_passport()
returns table(place text,name_zh text,name_en text,city_zh text,city_en text,
  first_at timestamptz,how_earned text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return query select p.id,p.name_zh,p.name_en,p.city_zh,p.city_en,s.first_at,s.how_earned
    from public.passport_stamps s join public.places p on p.id=s.place
    where s.user_id=auth.uid() order by s.first_at,p.sort;
end $$;

-- This is the latest open_capsule definition from the landmark reward migration,
-- with only first-open Passport and waited-time XP writes added below its guards.
create or replace function public.open_capsule(p_id uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_accuracy double precision DEFAULT NULL::double precision)
 returns table(message text, drawing text, photo text, opened_at timestamptz, gift_code text, voice_path text, voice_ms integer, prediction text, verdict boolean)
 language plpgsql security definer set search_path = '' as $function$
declare c public.capsules; pl public.places; d double precision; g text;
  cfg private.game_config; waited_days integer;
begin
  select * into c from public.capsules
    where id = p_id and recipient = auth.uid() for update;
  if c.id is null then raise exception 'capsule not found'; end if;
  if c.opened_at is null then
    if c.open_at > now() then raise exception 'not yet' using hint = 'locked'; end if;
    if c.place is not null then
      select * into pl from public.places where id = c.place;
      if p_lat is null or p_lng is null then raise exception 'location needed' using hint = 'no_location'; end if;
      if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
        raise exception 'invalid location' using hint = 'no_location';
      end if;
      if p_accuracy is null or p_accuracy <= 0 or p_accuracy > 200 then
        raise exception 'location not accurate enough' using hint = 'inaccurate';
      end if;
      d := public.distance_m(p_lat, p_lng, pl.lat, pl.lng);
      if d > pl.radius_m then raise exception 'too far: % m', round(d) using hint = 'far'; end if;
      if pl.brand_vessel is not null and pl.brand_vessel = c.vessel then
        g := 'AUR-' || lpad(coalesce(c.edition_no, 0)::text, 3, '0') || '-' || upper(substr(md5(random()::text || c.id::text), 1, 4));
      end if;
    end if;
    update public.capsules
      set opened_at = now(), seen_at = coalesce(seen_at, now()),
          opened_lat = p_lat, opened_lng = p_lng,
          opened_distance_m = case when d is null then null else round(d) end,
          gift_code = g
      where id = p_id
      returning * into c;
    if c.place is not null then
      insert into public.owned_vessels (user_id, vessel)
        select c.recipient, v.id from public.vessels v where v.earned_place = c.place
        on conflict (user_id, vessel) do nothing;
      insert into public.passport_stamps(user_id,place,first_at,how_earned)
        values(c.recipient,c.place,c.opened_at,'capsule')
        on conflict (user_id,place) do nothing;
    end if;
    select * into cfg from private.game_config where singleton;
    waited_days:=least(cfg.xp_open_day_cap,
      floor(extract(epoch from c.opened_at-c.sealed_at)/86400)::integer);
    if waited_days>=cfg.xp_open_min_days then
      perform private.ensure_player(c.recipient);
      perform private.award_xp(c.recipient,'capsule_open',c.id::text,
        cfg.xp_open_base+cfg.xp_open_per_day*waited_days);
    end if;
  end if;
  return query select cc.message, cc.drawing, cc.photo, c.opened_at, c.gift_code, cc.voice_path, cc.voice_ms, cc.prediction, c.verdict
    from public.capsule_contents cc where cc.capsule_id = p_id;
end $function$;

revoke all on function public.game_state(),
  public.lost_nearby(double precision,double precision,double precision),
  public.lost_throw(text,double precision,double precision,double precision,text,double precision,boolean),
  public.waypost_spin(uuid,double precision,double precision,double precision),
  public.landmark_start(uuid,double precision,double precision,double precision),
  public.landmark_hit(uuid,double precision,double precision,double precision,text,double precision),
  public.my_collection(),public.my_passport(),
  public.open_capsule(uuid,double precision,double precision,double precision)
  from public,anon,authenticated;
grant execute on function public.game_state(),
  public.lost_nearby(double precision,double precision,double precision),
  public.lost_throw(text,double precision,double precision,double precision,text,double precision,boolean),
  public.waypost_spin(uuid,double precision,double precision,double precision),
  public.landmark_start(uuid,double precision,double precision,double precision),
  public.landmark_hit(uuid,double precision,double precision,double precision,text,double precision),
  public.my_collection(),public.my_passport(),
  public.open_capsule(uuid,double precision,double precision,double precision)
  to authenticated;
grant execute on function public.open_capsule(uuid,double precision,double precision,double precision)
  to service_role;
notify pgrst, 'reload schema';
commit;
