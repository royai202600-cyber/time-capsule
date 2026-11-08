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
  speed_window_seconds integer not null check (speed_window_seconds>0),
  speed_ignore_m integer not null check (speed_ignore_m>=0),
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
   100,500,20,300,2000,100,20,1,365,array[1,3,6,10,15],500,30,40,1800,300,
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
  ('大炮台公園','Mount Fortress Park','澳門','Macau',22.197031,113.541867,true,'osm:way/488185729');
  -- Religious-site vicinity excluded from the new game seed.


-- Landmark actions are on public outdoor spots, linked to the existing places.
insert into public.sea_shores
  (name_zh,name_en,city_zh,city_en,lat,lng,kind,place,game_enabled,source_ref) values
  ('台北101廣場','Taipei 101 Plaza','台北','Taipei',25.033263,121.564887,
   'landmark','taipei101',true,'osm:node/6936432822'),
  ('魚尾獅公園','Merlion Park','新加坡','Singapore',1.286798,103.854301,
   'landmark','merlion',true,'osm:node/6283080658'),
  ('議事亭前地','Senado Square','澳門','Macau',22.193830,113.539990,
   'landmark','senado',true,'osm:way/192573684');

create table public.corrupted_spots (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  timezone text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  habitat text not null check (habitat in ('park','water','square')),
  source_ref text not null unique
);
alter table public.corrupted_spots enable row level security;
revoke all on public.corrupted_spots from public, anon, authenticated;
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
insert into public.corrupted_spots(city,timezone,lat,lng,habitat,source_ref)
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

-- Dense public park-path seed. OSM API extracts, 2026-11-09; ODbL.
-- Reproduce with scripts/seed-game-public-paths.py; source_ref records path, offset and park.
-- extract tc-osm-taipei.xml SHA256 0e655b3b234e70adec2c38c9e65a00288a057072d3c146214e79fe1a8adad024
-- extract tc-osm-taipei-west.xml SHA256 acb4f8138634c8972ddc705ea7b7cc25bcb872438eaaae57fef08da73f330124
-- extract tc-osm-taipei-east.xml SHA256 8d8553805577ae3406c3f8b002733ed3f81b53f883fd41e1deefa9b5ae768696
-- extract tc-osm-daan.xml SHA256 0ae22c900d7b80dce1ba06a9b2657316bffc505a605d195ba0dc1b4288ca578c
-- extract tc-osm-taipei-peace.xml SHA256 ef8c8c1afaef9620b39b79442e86e75ddc1a864099c4056cef80d7fb1cb314d6
-- extract tc-osm-taipei-riverside.xml SHA256 1299a0065b9da61f465b47e63c8c8c2e4c3242deab82650fa73e83c95c0a1554
-- extract tc-osm-singapore.xml SHA256 8371ccd0c55cd7ccd60e847aa1f93500c66d5eef3a2395d88f4caf7264949bee
-- extract tc-osm-singapore-gardens.xml SHA256 92be245f38770b750e69f9fef1d0ff506b42e2461656244a4fa370bb78d5fb70
-- extract tc-osm-singapore-fort.xml SHA256 f6a4f9e10a67fcac7579f9311c53c3809b74e2e08ed8f5bd8c9a485bc05925d4
-- extract tc-osm-singapore-botanic.xml SHA256 bb4c15d65ebc5a900ecf44b858fa02364c60cedcad079c485b581ba1dd962873
-- extract tc-osm-singapore-kallang.xml SHA256 af067d9b5920042b8a4f0e967a6b208dfb9700c14d1a1984bb4d13a705c56114
-- extract tc-osm-macau.xml SHA256 5f60d1b5b736886abea051422ace5a6995e6d04c8d980c12c3463c0cc891ea7e
-- extract tc-osm-macau-north.xml SHA256 32603eb45002142ce40b6ff2ed7943272ae20d7000c4ccfe2896b59ee879ea63
-- extract tc-osm-macau-taipa.xml SHA256 52a33f2462e40c41194226d9b31f60194bafd16c976120f41d08855aabbe58c3
insert into public.sea_shores(name_zh,name_en,city_zh,city_en,lat,lng,game_enabled,source_ref) values
('Zhongshan Park','Zhongshan Park','台北','Taipei',25.0380703,121.557978,true,'osm:way/49153748@25m;park/relation/4727715'),
('Zhongshan Park','Zhongshan Park','台北','Taipei',25.037903,121.5606899,true,'osm:way/49153748@300m;park/relation/4727715'),
('Da-an Forest Park','Da-an Forest Park','台北','Taipei',25.0312408,121.536494,true,'osm:way/49195976@100m;park/way/1227733215'),
('Da-an Forest Park','Da-an Forest Park','台北','Taipei',25.0266856,121.5363286,true,'osm:way/49195990@75m;park/way/1227733215'),
('Da-an Forest Park','Da-an Forest Park','台北','Taipei',25.0290651,121.5352519,true,'osm:way/49695623@0m;park/way/1227733215'),
('台北世貿廣場','台北世貿廣場','台北','Taipei',25.0347109,121.5619098,true,'osm:way/136814868@125m;park/way/555117276'),
('Da-an Forest Park','Da-an Forest Park','台北','Taipei',25.0326152,121.5342165,true,'osm:way/192030076@50m;park/way/1227733215'),
('Sōngshòu Square Park','Sōngshòu Square Park','台北','Taipei',25.0374756,121.5663993,true,'osm:way/280707092@25m;park/way/233666147'),
('Xiangshan Park','Xiangshan Park','台北','Taipei',25.0301894,121.5702748,true,'osm:way/319526552@300m;park/way/27244215'),
('Dajia Park','Dajia Park','台北','Taipei',25.0757169,121.5331829,true,'osm:way/354318668@25m;park/relation/11791159'),
('Dajia Park','Dajia Park','台北','Taipei',25.0740859,121.5393132,true,'osm:way/356780466@25m;park/relation/11791159'),
('Dajia Park','Dajia Park','台北','Taipei',25.0740293,121.5428258,true,'osm:way/356780468@75m;park/relation/11791159'),
('Meiti Riverside Park','Meiti Riverside Park','台北','Taipei',25.0768656,121.5513732,true,'osm:way/360057684@0m;park/way/385941046'),
('Xinyi Square','Xinyi Square','台北','Taipei',25.0336519,121.5658998,true,'osm:way/462045632@0m;park/way/261647304'),
('Dajia Park','Dajia Park','台北','Taipei',25.0748067,121.5369262,true,'osm:way/484308801@75m;park/relation/11791159'),
('Dajia Park','Dajia Park','台北','Taipei',25.0752298,121.5305865,true,'osm:way/484323776@0m;park/relation/11791159'),
('Zhongzheng Memorial Park','Zhongzheng Memorial Park','台北','Taipei',25.0336684,121.5217503,true,'osm:way/590069828@50m;park/relation/1506269'),
('228 Peace Park','228 Peace Park','台北','Taipei',25.0430687,121.5141308,true,'osm:way/784696787@25m;park/relation/4638980'),
('圓山河濱公園','圓山河濱公園','台北','Taipei',25.0742386,121.5257318,true,'osm:way/860377072@0m;park/way/596361020'),
('Democracy Boulevard','Democracy Boulevard','台北','Taipei',25.0357073,121.5206551,true,'osm:way/1053359171@75m;park/way/1053396976'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.0753848,121.5478678,true,'osm:way/1068999026@0m;park/way/385941045'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.0754008,121.5448351,true,'osm:way/1068999084@0m;park/way/385941045'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.0749677,121.5528895,true,'osm:way/1068999086@375m;park/way/385941045'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.0744153,121.5555413,true,'osm:way/1068999086@650m;park/way/385941045'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.0734384,121.5580391,true,'osm:way/1068999086@925m;park/way/385941045'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.0721587,121.5603675,true,'osm:way/1068999086@1200m;park/way/385941045'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.0717836,121.562998,true,'osm:way/1068999086@1475m;park/way/385941045'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.0728734,121.5654144,true,'osm:way/1068999086@1750m;park/way/385941045'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.0743015,121.5676391,true,'osm:way/1068999086@2025m;park/way/385941045'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.0744998,121.5701717,true,'osm:way/1068999086@2325m;park/way/385941045'),
('Yingfeng Riverside Park','Yingfeng Riverside Park','台北','Taipei',25.072198,121.5711178,true,'osm:way/1068999086@2600m;park/way/385941045'),
('Zhongshan Park','Zhongshan Park','台北','Taipei',25.0407946,121.5612369,true,'osm:way/1334831345@25m;park/relation/4727715'),
('Taipei Civic Square','Taipei Civic Square','台北','Taipei',25.0371958,121.5631259,true,'osm:way/1336506663@0m;park/way/309157011'),
('信義351號綠地','信義351號綠地','台北','Taipei',25.0393308,121.5679972,true,'osm:way/1339865616@25m;park/relation/18386549'),
('Yongchunggang Park','Yongchunggang Park','台北','Taipei',25.0312531,121.5768601,true,'osm:way/1341564303@0m;park/way/218489810'),
('Singapore Botanic Gardens','Singapore Botanic Gardens','新加坡','Singapore',1.3167101,103.8164878,true,'osm:way/47257415@0m;park/way/47257476'),
('Singapore Botanic Gardens','Singapore Botanic Gardens','新加坡','Singapore',1.3196874,103.8157658,true,'osm:way/47257473@0m;park/way/47257476'),
('Public park','Public park','新加坡','Singapore',1.2866377,103.8515502,true,'osm:way/106086895@0m;park/way/106086903'),
('Singapore Botanic Gardens','Singapore Botanic Gardens','新加坡','Singapore',1.3068301,103.8168019,true,'osm:way/142598070@0m;park/way/47257476'),
('Singapore Botanic Gardens','Singapore Botanic Gardens','新加坡','Singapore',1.3093257,103.814978,true,'osm:way/142709443@0m;park/way/47257476'),
('Merlion Park','Merlion Park','新加坡','Singapore',1.2867843,103.8541549,true,'osm:way/164881350@0m;park/way/687917300'),
('Esplanade Park','Esplanade Park','新加坡','Singapore',1.2893564,103.8539374,true,'osm:way/166554014@0m;park/relation/9976848'),
('Public park','Public park','新加坡','Singapore',1.3052969,103.8658985,true,'osm:way/170967529@25m;park/way/1387617423'),
('Gardens by the Bay','Gardens by the Bay','新加坡','Singapore',1.2825557,103.8620098,true,'osm:way/171142596@0m;park/relation/10231144'),
('Raffles Place Park','Raffles Place Park','新加坡','Singapore',1.2832423,103.851456,true,'osm:way/172263096@0m;park/way/106193383'),
('Gardens by the Bay','Gardens by the Bay','新加坡','Singapore',1.2824228,103.8643581,true,'osm:way/172297168@25m;park/relation/10231144'),
('Gardens by the Bay','Gardens by the Bay','新加坡','Singapore',1.2791079,103.8621966,true,'osm:way/172297177@0m;park/relation/10231144'),
('Gardens by the Bay','Gardens by the Bay','新加坡','Singapore',1.2826278,103.8669942,true,'osm:way/172297193@0m;park/relation/10231144'),
('Gardens by the Bay','Gardens by the Bay','新加坡','Singapore',1.2855268,103.8630601,true,'osm:way/172297202@0m;park/relation/10231144'),
('Fort Canning Park','Fort Canning Park','新加坡','Singapore',1.2955151,103.8471314,true,'osm:way/172409565@75m;park/way/16892550'),
('Singapore Botanic Gardens','Singapore Botanic Gardens','新加坡','Singapore',1.3220701,103.8157775,true,'osm:way/173623386@0m;park/way/47257476'),
('Fort Canning Park','Fort Canning Park','新加坡','Singapore',1.2923223,103.8462215,true,'osm:way/252086126@0m;park/way/16892550'),
('Youth Olympic Park','Youth Olympic Park','新加坡','Singapore',1.2889288,103.8603163,true,'osm:way/395120469@0m;park/way/395120471'),
('The Lawn@Marina Bay','The Lawn@Marina Bay','新加坡','Singapore',1.2796985,103.8529318,true,'osm:way/462914029@50m;park/way/116905791'),
('Temasek Shophouse Garden','Temasek Shophouse Garden','新加坡','Singapore',1.2992051,103.8471415,true,'osm:way/474323150@50m;park/way/475183080'),
('Public park','Public park','新加坡','Singapore',1.3039529,103.86369,true,'osm:way/481965624@25m;park/way/481965622'),
('Singapore Botanic Gardens','Singapore Botanic Gardens','新加坡','Singapore',1.3139193,103.8165682,true,'osm:way/528905435@25m;park/way/47257476'),
('Public park','Public park','新加坡','Singapore',1.3035585,103.8681142,true,'osm:way/532056050@25m;park/way/1387617423'),
('Kallang Riverside Park North','Kallang Riverside Park North','新加坡','Singapore',1.3065711,103.8677728,true,'osm:way/534638599@0m;park/way/329862529'),
('Kallang Riverside Park East','Kallang Riverside Park East','新加坡','Singapore',1.3080121,103.8709863,true,'osm:way/546225150@0m;park/way/329863911'),
('Fort Canning Park','Fort Canning Park','新加坡','Singapore',1.2941551,103.8446453,true,'osm:way/702901686@50m;park/way/16892550'),
('Singapore Botanic Gardens Gallop Extension','Singapore Botanic Gardens Gallop Extension','新加坡','Singapore',1.3124743,103.8114012,true,'osm:way/742058829@150m;park/way/736934929'),
('Gardens by the Bay','Gardens by the Bay','新加坡','Singapore',1.2800513,103.8698409,true,'osm:way/884590174@25m;park/relation/10231144'),
('Public park','Public park','澳門','Macau',22.1839853,113.5468405,true,'osm:way/240933853@25m;park/way/960068373'),
('Public park','Public park','澳門','Macau',22.1862725,113.5458321,true,'osm:way/240933853@300m;park/way/960068373'),
('Public park','Public park','澳門','Macau',22.154021,113.5599958,true,'osm:way/240933889@25m;park/way/1279798979'),
('綠楊花園休憩區 Zona de Lazer do Edf. Lok Yeong Fa Yuen','綠楊花園休憩區 Zona de Lazer do Edf. Lok Yeong Fa Yuen','澳門','Macau',22.2066553,113.5414214,true,'osm:way/257493768@100m;park/way/639869043'),
('Dr. Carlos D''Assumpcao Park','Dr. Carlos D''Assumpcao Park','澳門','Macau',22.1871564,113.5516223,true,'osm:way/297728677@25m;park/relation/11551012'),
('Commander Ho Yin Park;Ho Yin Park','Commander Ho Yin Park;Ho Yin Park','澳門','Macau',22.1919562,113.54943,true,'osm:way/297728809@25m;park/relation/11551068'),
('海景花園休憩區 Zona de Lazer da Praceta de Miramar','海景花園休憩區 Zona de Lazer da Praceta de Miramar','澳門','Macau',22.1925511,113.5523378,true,'osm:way/307047222@150m;park/way/640169193'),
('回歸公園 Jardim da Rua de Malaca','回歸公園 Jardim da Rua de Malaca','澳門','Macau',22.1957905,113.5535612,true,'osm:way/330914462@0m;park/way/305387668'),
('Taipa Central Park','Taipa Central Park','澳門','Macau',22.1599268,113.553758,true,'osm:way/389337670@175m;park/way/240650346'),
('華士古達嘉馬花園 Jardim Vasco da Gama','華士古達嘉馬花園 Jardim Vasco da Gama','澳門','Macau',22.1961562,113.5467043,true,'osm:way/405411416@0m;park/way/183840226'),
('Dr. Carlos D''Assumpcao Park','Dr. Carlos D''Assumpcao Park','澳門','Macau',22.1892972,113.5505538,true,'osm:way/405596065@25m;park/relation/11551012'),
('Luis de Camoes Park','Luis de Camoes Park','澳門','Macau',22.2007222,113.5392103,true,'osm:way/406123269@0m;park/relation/9905638'),
('區華利前地 Lazer de Praça de Jorge Álvares','區華利前地 Lazer de Praça de Jorge Álvares','澳門','Macau',22.1914296,113.5399593,true,'osm:way/422643353@100m;park/way/346900281'),
('Public park','Public park','澳門','Macau',22.2060405,113.5377584,true,'osm:way/679384115@100m;park/way/1313399517'),
('大炮台公園 Parque da Fortaleza do Monte','大炮台公園 Parque da Fortaleza do Monte','澳門','Macau',22.1973906,113.5423988,true,'osm:way/710432483@0m;park/way/488185729'),
('Lou Lim Ioc Park','Lou Lim Ioc Park','澳門','Macau',22.2000596,113.5477651,true,'osm:way/764201171@0m;park/way/265433531'),
('觀音像海濱休憩區 Zona de Lazer da Marginal da Estátua de Kun Iam','觀音像海濱休憩區 Zona de Lazer da Marginal da Estátua de Kun Iam','澳門','Macau',22.1876407,113.5554204,true,'osm:way/770557470@25m;park/way/192180025'),
('Leisure Area of Edif. Wang Hoi & Wang Kin','Leisure Area of Edif. Wang Hoi & Wang Kin','澳門','Macau',22.2084336,113.5429669,true,'osm:way/781185958@50m;park/way/445896931'),
('船廠街休憩區 Zona de Lazer da Rua dos Estaleiros','船廠街休憩區 Zona de Lazer da Rua dos Estaleiros','澳門','Macau',22.2060392,113.5445607,true,'osm:way/984829433@25m;park/way/639880756')
on conflict (source_ref) where source_ref is not null do nothing;
insert into public.corrupted_spots(city,timezone,lat,lng,habitat,source_ref) values
('Taipei','Asia/Taipei',25.0380703,121.557978,'park','osm:way/49153748@25m;park/relation/4727715'),
('Taipei','Asia/Taipei',25.0379312,121.5596988,'park','osm:way/49153748@200m;park/relation/4727715'),
('Taipei','Asia/Taipei',25.0312408,121.536494,'park','osm:way/49195976@100m;park/way/1227733215'),
('Taipei','Asia/Taipei',25.0309129,121.5348526,'park','osm:way/49195976@275m;park/way/1227733215'),
('Taipei','Asia/Taipei',25.0266856,121.5363286,'park','osm:way/49195990@75m;park/way/1227733215'),
('Taipei','Asia/Taipei',25.0282319,121.5360565,'park','osm:way/49195990@250m;park/way/1227733215'),
('Taipei','Asia/Taipei',25.0297612,121.5359421,'park','osm:way/49195990@425m;park/way/1227733215'),
('Taipei','Asia/Taipei',25.0324282,121.5350311,'park','osm:way/49195990@750m;park/way/1227733215'),
('Taipei','Asia/Taipei',25.0347109,121.5619098,'park','osm:way/136814868@125m;park/way/555117276'),
('Taipei','Asia/Taipei',25.0374756,121.5663993,'park','osm:way/280707092@25m;park/way/233666147'),
('Taipei','Asia/Taipei',25.0301894,121.5702748,'park','osm:way/319526552@300m;park/way/27244215'),
('Taipei','Asia/Taipei',25.0286971,121.5700382,'park','osm:way/319526552@475m;park/way/27244215'),
('Taipei','Asia/Taipei',25.0757169,121.5331829,'park','osm:way/354318668@25m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.0740859,121.5393132,'park','osm:way/356780466@25m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.0740293,121.5428258,'park','osm:way/356780468@75m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.0768656,121.5513732,'park','osm:way/360057684@0m;park/way/385941046'),
('Taipei','Asia/Taipei',25.038764,121.5658097,'park','osm:way/373793930@25m;park/relation/18367478'),
('Taipei','Asia/Taipei',25.0360696,121.5657502,'park','osm:way/373793930@325m;park/relation/18367478'),
('Taipei','Asia/Taipei',25.0393398,121.5674604,'park','osm:way/379324246@25m;park/relation/18386549'),
('Taipei','Asia/Taipei',25.0336519,121.5658998,'park','osm:way/462045632@0m;park/way/261647304'),
('Taipei','Asia/Taipei',25.0743931,121.540912,'park','osm:way/484308118@150m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.0756587,121.5417363,'park','osm:way/484308192@0m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.0749876,121.5380885,'park','osm:way/484308672@0m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.075248,121.5317061,'park','osm:way/484323774@25m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.0753989,121.5346843,'park','osm:way/484565828@125m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.0756281,121.5396113,'park','osm:way/484640959@0m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.0336684,121.5217503,'park','osm:way/590069828@50m;park/relation/1506269'),
('Taipei','Asia/Taipei',25.0341813,121.5202405,'park','osm:way/590103577@25m;park/relation/1506269'),
('Taipei','Asia/Taipei',25.0430687,121.5141308,'park','osm:way/784696787@25m;park/relation/4638980'),
('Taipei','Asia/Taipei',25.0742386,121.5257318,'park','osm:way/860377072@0m;park/way/596361020'),
('Taipei','Asia/Taipei',25.0747826,121.5300847,'park','osm:way/863482723@75m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.0758396,121.536354,'park','osm:way/863533477@0m;park/relation/11791159'),
('Taipei','Asia/Taipei',25.0353875,121.5213096,'park','osm:way/1053359171@0m;park/relation/1506269'),
('Taipei','Asia/Taipei',25.0349749,121.522906,'park','osm:way/1053359189@225m;park/relation/1506269'),
('Taipei','Asia/Taipei',25.0753848,121.5478678,'park','osm:way/1068999026@0m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0753454,121.5497746,'park','osm:way/1068999040@0m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0754008,121.5448351,'park','osm:way/1068999084@0m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0751463,121.5514154,'park','osm:way/1068999086@225m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0749379,121.5531352,'park','osm:way/1068999086@400m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0746113,121.55483,'park','osm:way/1068999086@575m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0741107,121.5564706,'park','osm:way/1068999086@750m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0734384,121.5580391,'park','osm:way/1068999086@925m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0726158,121.559517,'park','osm:way/1068999086@1100m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0718795,121.5610442,'park','osm:way/1068999086@1275m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0717572,121.5627518,'park','osm:way/1068999086@1450m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0722559,121.5643795,'park','osm:way/1068999086@1625m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0731283,121.5658226,'park','osm:way/1068999086@1800m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0740416,121.5672349,'park','osm:way/1068999086@1975m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0749199,121.5686733,'park','osm:way/1068999086@2150m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0744998,121.5701717,'park','osm:way/1068999086@2325m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0730695,121.5708803,'park','osm:way/1068999086@2500m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0715298,121.5712026,'park','osm:way/1068999086@2675m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0755905,121.5463524,'park','osm:way/1069183305@150m;park/way/385941045'),
('Taipei','Asia/Taipei',25.0397273,121.5612081,'park','osm:way/1334831344@25m;park/relation/4727715'),
('Taipei','Asia/Taipei',25.0381723,121.561294,'park','osm:way/1334831345@325m;park/relation/4727715'),
('Taipei','Asia/Taipei',25.0409807,121.560142,'park','osm:way/1334973953@25m;park/relation/4727715'),
('Taipei','Asia/Taipei',25.0371958,121.5631259,'park','osm:way/1336506663@0m;park/way/309157011'),
('Taipei','Asia/Taipei',25.0348369,121.5645854,'park','osm:way/1339499092@0m;park/way/1341042550'),
('Taipei','Asia/Taipei',25.0312531,121.5768601,'park','osm:way/1341564303@0m;park/way/218489810'),
('Singapore','Asia/Singapore',1.3167101,103.8164878,'park','osm:way/47257415@0m;park/way/47257476'),
('Singapore','Asia/Singapore',1.3196874,103.8157658,'park','osm:way/47257473@0m;park/way/47257476'),
('Singapore','Asia/Singapore',1.2866377,103.8515502,'park','osm:way/106086895@0m;park/way/106086903'),
('Singapore','Asia/Singapore',1.3068301,103.8168019,'park','osm:way/142598070@0m;park/way/47257476'),
('Singapore','Asia/Singapore',1.3093257,103.814978,'park','osm:way/142709443@0m;park/way/47257476'),
('Singapore','Asia/Singapore',1.3210463,103.8150451,'park','osm:way/164777846@150m;park/way/47257476'),
('Singapore','Asia/Singapore',1.2867843,103.8541549,'park','osm:way/164881350@0m;park/way/687917300'),
('Singapore','Asia/Singapore',1.2893564,103.8539374,'park','osm:way/166554014@0m;park/relation/9976848'),
('Singapore','Asia/Singapore',1.3052969,103.8658985,'park','osm:way/170967529@25m;park/way/1387617423'),
('Singapore','Asia/Singapore',1.2825557,103.8620098,'park','osm:way/171142596@0m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.2832423,103.851456,'park','osm:way/172263096@0m;park/way/106193383'),
('Singapore','Asia/Singapore',1.284751,103.8515133,'park','osm:way/172263107@50m;park/way/106193383'),
('Singapore','Asia/Singapore',1.2843883,103.862677,'park','osm:way/172288967@25m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.2825281,103.8638693,'park','osm:way/172297165@0m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.280946,103.8627437,'park','osm:way/172297166@0m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.2791079,103.8621966,'park','osm:way/172297177@0m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.2826278,103.8669942,'park','osm:way/172297193@0m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.2839906,103.8640006,'park','osm:way/172297202@250m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.2808381,103.8670827,'park','osm:way/172297295@0m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.2955151,103.8471314,'park','osm:way/172409565@75m;park/way/16892550'),
('Singapore','Asia/Singapore',1.3221978,103.8160807,'park','osm:way/173623399@575m;park/way/47257476'),
('Singapore','Asia/Singapore',1.2849875,103.8538662,'park','osm:way/184297026@0m;park/way/687917300'),
('Singapore','Asia/Singapore',1.2923223,103.8462215,'park','osm:way/252086126@0m;park/way/16892550'),
('Singapore','Asia/Singapore',1.2935943,103.8453661,'park','osm:way/252086126@175m;park/way/16892550'),
('Singapore','Asia/Singapore',1.2910725,103.8542497,'park','osm:way/256153662@0m;park/relation/9976848'),
('Singapore','Asia/Singapore',1.2911361,103.8477035,'park','osm:way/302447783@100m;park/way/16892550'),
('Singapore','Asia/Singapore',1.2932083,103.8479152,'park','osm:way/314515951@150m;park/way/16892550'),
('Singapore','Asia/Singapore',1.2948821,103.8458977,'park','osm:way/314515952@25m;park/way/16892550'),
('Singapore','Asia/Singapore',1.2889288,103.8603163,'park','osm:way/395120469@0m;park/way/395120471'),
('Singapore','Asia/Singapore',1.2796985,103.8529318,'park','osm:way/462914029@50m;park/way/116905791'),
('Singapore','Asia/Singapore',1.2992051,103.8471415,'park','osm:way/474323150@50m;park/way/475183080'),
('Singapore','Asia/Singapore',1.3039529,103.86369,'park','osm:way/481965624@25m;park/way/481965622'),
('Singapore','Asia/Singapore',1.3079428,103.8146198,'park','osm:way/485669231@50m;park/way/47257476'),
('Singapore','Asia/Singapore',1.2797038,103.8608978,'park','osm:way/527984607@0m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.3139193,103.8165682,'park','osm:way/528905435@25m;park/way/47257476'),
('Singapore','Asia/Singapore',1.3035585,103.8681142,'park','osm:way/532056050@25m;park/way/1387617423'),
('Singapore','Asia/Singapore',1.3065711,103.8677728,'park','osm:way/534638599@0m;park/way/329862529'),
('Singapore','Asia/Singapore',1.3080121,103.8709863,'park','osm:way/546225150@0m;park/way/329863911'),
('Singapore','Asia/Singapore',1.3163005,103.8179539,'park','osm:way/664184140@50m;park/way/47257476'),
('Singapore','Asia/Singapore',1.3124743,103.8114012,'park','osm:way/742058829@150m;park/way/736934929'),
('Singapore','Asia/Singapore',1.2800513,103.8698409,'park','osm:way/884590174@25m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.2812029,103.8612578,'park','osm:way/922501081@0m;park/relation/10231144'),
('Singapore','Asia/Singapore',1.3097584,103.8704491,'park','osm:way/1215501267@0m;park/way/329863911'),
('Singapore','Asia/Singapore',1.3053958,103.8688201,'park','osm:way/1229250918@0m;park/way/329863911'),
('Singapore','Asia/Singapore',1.3086226,103.8696978,'park','osm:way/1535166328@50m;park/way/329862529'),
('Macau','Asia/Macau',22.1839853,113.5468405,'park','osm:way/240933853@25m;park/way/960068373'),
('Macau','Asia/Macau',22.1854408,113.5461988,'park','osm:way/240933853@200m;park/way/960068373'),
('Macau','Asia/Macau',22.1868962,113.5455571,'park','osm:way/240933853@375m;park/way/960068373'),
('Macau','Asia/Macau',22.154021,113.5599958,'park','osm:way/240933889@25m;park/way/1279798979'),
('Macau','Asia/Macau',22.2066553,113.5414214,'park','osm:way/257493768@100m;park/way/639869043'),
('Macau','Asia/Macau',22.1871564,113.5516223,'park','osm:way/297728677@25m;park/relation/11551012'),
('Macau','Asia/Macau',22.1919562,113.54943,'park','osm:way/297728809@25m;park/relation/11551068'),
('Macau','Asia/Macau',22.1925511,113.5523378,'park','osm:way/307047222@150m;park/way/640169193'),
('Macau','Asia/Macau',22.1957905,113.5535612,'park','osm:way/330914462@0m;park/way/305387668'),
('Macau','Asia/Macau',22.1599268,113.553758,'park','osm:way/389337670@175m;park/way/240650346'),
('Macau','Asia/Macau',22.1590569,113.5549579,'park','osm:way/389337670@375m;park/way/240650346'),
('Macau','Asia/Macau',22.1961562,113.5467043,'park','osm:way/405411416@0m;park/way/183840226'),
('Macau','Asia/Macau',22.1890411,113.5507121,'park','osm:way/405596060@0m;park/relation/11551012'),
('Macau','Asia/Macau',22.2007222,113.5392103,'park','osm:way/406123269@0m;park/relation/9905638'),
('Macau','Asia/Macau',22.1914296,113.5399593,'park','osm:way/422643353@100m;park/way/346900281'),
('Macau','Asia/Macau',22.2060405,113.5377584,'park','osm:way/679384115@100m;park/way/1313399517'),
('Macau','Asia/Macau',22.1973906,113.5423988,'park','osm:way/710432483@0m;park/way/488185729'),
('Macau','Asia/Macau',22.2000596,113.5477651,'park','osm:way/764201171@0m;park/way/265433531'),
('Macau','Asia/Macau',22.1876407,113.5554204,'park','osm:way/770557470@25m;park/way/192180025'),
('Macau','Asia/Macau',22.186986,113.553669,'park','osm:way/770557470@225m;park/way/192180025'),
('Macau','Asia/Macau',22.2084336,113.5429669,'park','osm:way/781185958@50m;park/way/445896931'),
('Macau','Asia/Macau',22.1943147,113.5534442,'park','osm:way/942508485@75m;park/way/192179907'),
('Macau','Asia/Macau',22.2060392,113.5445607,'park','osm:way/984829433@25m;park/way/639880756')
on conflict(source_ref) do nothing;

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
create table public.corrupted_catches (
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
alter table public.corrupted_catches enable row level security;
alter table public.waypost_spins enable row level security;
alter table public.landmark_attempts enable row level security;
alter table public.xp_events enable row level security;
alter table public.passport_stamps enable row level security;
revoke all on public.player_game,public.corrupted_catches,public.waypost_spins,
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
    and pg.last_position_at > clock_timestamp()-make_interval(secs=>cfg.speed_window_seconds)
    and public.distance_m(pg.last_lat,pg.last_lng,p_lat,p_lng)>=cfg.speed_ignore_m
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
declare spot public.corrupted_spots; cfg private.game_config; wave_at timestamptz;
  local_hour integer; local_md text; chosen_rarity text; picked text;
  rarity_roll double precision; total_weight integer; visible_minutes integer;
begin
  select * into spot from public.corrupted_spots where id=p_spot;
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

create function public.corrupted_nearby(
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
  from public.corrupted_spots p
  cross join lateral generate_series(wave-1,wave) w(n)
  cross join lateral private.resolve_spawn(p.id,w.n) s
  left join public.corrupted_catches c on c.user_id=auth.uid() and c.spawn_id=s.spawn_id
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

create function public.corrupted_throw(
  p_spawn text,p_lat double precision,p_lng double precision,p_accuracy double precision,
  p_ball text,p_ring double precision,p_hit boolean
) returns table(result text,vessel text,copies integer,stars integer,is_new boolean,
  xp_gained integer,wax_balls integer,gold_balls integer,attempts_left integer)
language plpgsql security definer set search_path = '' as $$
declare pg public.player_game; cfg private.game_config; spot public.corrupted_spots;
  released record; caught public.corrupted_catches; wave bigint; current_wave bigint;
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
  select * into spot from public.corrupted_spots where id=split_part(p_spawn,':',1)::uuid;
  if spot.id is null then raise exception 'expired'; end if;
  select * into released from private.resolve_spawn(spot.id,wave);
  if released.spawn_id is null or released.spawn_id<>p_spawn or released.expires_at<=now()
    then raise exception 'expired'; end if;
  if public.distance_m(p_lat,p_lng,spot.lat,spot.lng)>cfg.action_radius_m
    then raise exception 'too_far'; end if;
  select * into caught from public.corrupted_catches
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
    insert into public.corrupted_catches(user_id,spawn_id,attempts,result,vessel)
      values(auth.uid(),p_spawn,1,'pending',vessel)
      on conflict (user_id,spawn_id) do update
      set attempts=public.corrupted_catches.attempts+1
      returning * into caught;
    attempts_left := greatest(0,cfg.max_attempts-caught.attempts);
    chance := case released.rarity when 'common' then cfg.restore_common
      when 'uncommon' then cfg.restore_uncommon else cfg.restore_rare end;
    chance := least(1.0,chance+cfg.restore_ring_bonus*least(1.0,greatest(0.0,p_ring))
      +case when p_ball='gold' then cfg.restore_gold_bonus else 0 end);
    did_catch := random()<chance;
    if did_catch then
      update public.corrupted_catches set result='caught',caught_at=now()
        where user_id=auth.uid() and spawn_id=p_spawn;
      is_new := not exists (select 1 from public.owned_vessels
        where user_id=auth.uid() and public.owned_vessels.vessel=corrupted_throw.vessel);
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
      update public.corrupted_catches set result=case when attempts>=cfg.max_attempts
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
    end if;
    begin
      if c.place is not null then
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
    exception when others then
      raise warning 'Time Capsule game rewards failed for capsule %: %',c.id,sqlerrm;
    end;
  end if;
  return query select cc.message, cc.drawing, cc.photo, c.opened_at, c.gift_code, cc.voice_path, cc.voice_ms, cc.prediction, c.verdict
    from public.capsule_contents cc where cc.capsule_id = p_id;
end $function$;

revoke all on function public.game_state(),
  public.corrupted_nearby(double precision,double precision,double precision),
  public.corrupted_throw(text,double precision,double precision,double precision,text,double precision,boolean),
  public.waypost_spin(uuid,double precision,double precision,double precision),
  public.landmark_start(uuid,double precision,double precision,double precision),
  public.landmark_hit(uuid,double precision,double precision,double precision,text,double precision),
  public.my_collection(),public.my_passport(),
  public.open_capsule(uuid,double precision,double precision,double precision)
  from public,anon,authenticated;
grant execute on function public.game_state(),
  public.corrupted_nearby(double precision,double precision,double precision),
  public.corrupted_throw(text,double precision,double precision,double precision,text,double precision,boolean),
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
