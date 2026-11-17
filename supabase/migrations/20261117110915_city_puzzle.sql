-- Daily City Explorer puzzles. The catalog and plays are readable only through the RPCs.
create table public.city_puzzle_questions (
  id bigint generated always as identity primary key,
  city text not null,
  seq integer not null check (seq > 0),
  question_zh text not null,
  question_en text not null,
  venue_zh text,
  venue_en text,
  vessel text references public.vessels(id),
  photo_path text,
  photo_credit text,
  photo_license text,
  photo_link text,
  currency text not null,
  local_price numeric,
  usd_rate numeric,
  fact_zh text,
  fact_en text,
  source text,
  checked_on date,
  published boolean not null default false,
  unique (city, seq),
  unique (city, id),
  check (case city
    when 'taipei' then currency = 'NT$'
    when 'hongkong' then currency = 'HK$'
    when 'macau' then currency = 'MOP'
    when 'singapore' then currency = 'S$'
    else false end),
  check (local_price > 0 and local_price < 'Infinity'::numeric),
  check (usd_rate > 0 and usd_rate < 'Infinity'::numeric),
  check (
    num_nonnulls(photo_path, photo_credit, photo_license, photo_link) = 0
    or (
      num_nonnulls(photo_path, photo_credit, photo_license, photo_link) = 4
      and photo_path ~ '^[a-z0-9]+(-[a-z0-9]+)*[.]jpg$'
      and btrim(photo_credit) <> '' and btrim(photo_license) <> ''
      and photo_link like 'https://%'
    )
  ),
  check (not published or (
    venue_zh is not null and btrim(venue_zh) <> ''
    and venue_en is not null and btrim(venue_en) <> ''
    and (vessel is not null or photo_path is not null)
    and local_price is not null and usd_rate is not null and round(local_price / usd_rate, 2) > 0
    and fact_zh is not null and btrim(fact_zh) <> ''
    and fact_en is not null and btrim(fact_en) <> ''
    and source is not null and btrim(source) <> '' and checked_on is not null
  ))
);

create index city_puzzle_questions_vessel_idx on public.city_puzzle_questions (vessel);

create table public.city_puzzle_plays (
  user_id uuid not null references public.profiles(id) on delete cascade,
  city text not null,
  play_date date not null,
  question_id bigint not null,
  guesses jsonb not null default '[]',
  done boolean not null default false,
  won boolean not null default false,
  reward integer,
  primary key (user_id, city, play_date),
  foreign key (city, question_id) references public.city_puzzle_questions (city, id),
  check (jsonb_typeof(guesses) = 'array' and jsonb_array_length(guesses) <= 6),
  check (done = (won or jsonb_array_length(guesses) = 6)),
  check (done = (reward is not null) and reward >= 0)
);
create index city_puzzle_plays_streak_idx on public.city_puzzle_plays (user_id, play_date) where done;
create index city_puzzle_plays_question_idx on public.city_puzzle_plays (city, question_id);

alter table public.city_puzzle_questions enable row level security;
alter table public.city_puzzle_plays enable row level security;
revoke all on public.city_puzzle_questions, public.city_puzzle_plays from public, anon, authenticated;

-- Public URLs only. No client policies grant writes to this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('city-puzzle', 'city-puzzle', true, 300000, array['image/jpeg']);

create function private.city_puzzle_date(p_at timestamptz)
returns date language sql stable set search_path = '' as $$
  select (p_at at time zone 'Asia/Taipei')::date;
$$;

create function private.city_puzzle_no(p_date date)
returns integer language sql immutable set search_path = '' as $$
  select greatest(1, p_date - date '2026-11-17' + 1);
$$;

create function private.city_puzzle_question(p_city text, p_date date)
returns public.city_puzzle_questions language sql stable set search_path = '' as $$
  select q.*
  from public.city_puzzle_questions q
  where q.city = p_city and q.published
  order by q.seq
  offset (private.city_puzzle_no(p_date) - 1) % greatest(1, (
    select count(*) from public.city_puzzle_questions pool where pool.city = p_city and pool.published
  ))
  limit 1;
$$;

-- Yesterday's streak remains active until the player misses all of today.
create function private.city_puzzle_streak(p_user uuid, p_date date)
returns integer language sql stable set search_path = '' as $$
  with recursive days(day) as (
    select max(play_date) from public.city_puzzle_plays
    where user_id = p_user and done and play_date between p_date - 1 and p_date
    union all
    select day - 1 from days
    where exists (
      select 1 from public.city_puzzle_plays
      where user_id = p_user and done and play_date = days.day - 1
    )
  )
  select count(day)::integer from days;
$$;

create function private.city_puzzle_object(
  p_question public.city_puzzle_questions, p_play public.city_puzzle_plays, p_date date
)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'city', p_question.city,
    'no', private.city_puzzle_no(p_date),
    'question_zh', p_question.question_zh,
    'question_en', p_question.question_en,
    'venue_zh', p_question.venue_zh,
    'venue_en', p_question.venue_en,
    'vessel', p_question.vessel,
    'photo', case when p_question.photo_path is not null then jsonb_build_object(
      -- Local stacks can point this at their own Storage API.
      'url', rtrim(coalesce(nullif(current_setting('app.settings.city_puzzle_storage_origin', true), ''),
        'https://uzimuygyxwraybsipeij.supabase.co'), '/')
        || '/storage/v1/object/public/city-puzzle/' || p_question.photo_path,
      'credit', p_question.photo_credit,
      'license', p_question.photo_license,
      'link', p_question.photo_link
    ) end,
    'currency', p_question.currency,
    'rate', p_question.usd_rate,
    'guesses', coalesce(p_play.guesses, '[]'::jsonb),
    'done', coalesce(p_play.done, false),
    'won', coalesce(p_play.won, false),
    'answer', case when p_play.done then jsonb_build_object(
      'usd', round(p_question.local_price / p_question.usd_rate, 2),
      'local', p_question.local_price,
      'fact_zh', p_question.fact_zh,
      'fact_en', p_question.fact_en,
      'source', p_question.source,
      'checked_on', p_question.checked_on
    ) end,
    'reward', case when p_play.done then p_play.reward end
  );
$$;

create function private.city_puzzle_today()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_date date := private.city_puzzle_date(statement_timestamp());
  v_puzzles jsonb;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  select jsonb_agg(private.city_puzzle_object(q, p, v_date) order by c.ord) into v_puzzles
  from unnest(array['taipei', 'hongkong', 'macau', 'singapore']) with ordinality as c(city, ord)
  left join public.city_puzzle_plays p on p.user_id = v_user and p.city = c.city and p.play_date = v_date
  join public.city_puzzle_questions q on q.id = coalesce(
    p.question_id, (private.city_puzzle_question(c.city, v_date)).id
  );

  return jsonb_build_object(
    'puzzles', coalesce(v_puzzles, '[]'::jsonb),
    'streak', private.city_puzzle_streak(v_user, v_date)
  );
end $$;

create function private.city_puzzle_guess(p_city text, p_usd numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_date date := private.city_puzzle_date(statement_timestamp());
  v_question public.city_puzzle_questions;
  v_play public.city_puzzle_plays;
  v_off double precision;
  v_gap double precision;
  v_hint text;
  v_state jsonb;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  if p_usd is null or p_usd <= 0 or p_usd > 1000000 or scale(p_usd) > 2
    or p_city is null or p_city not in ('taipei', 'hongkong', 'macau', 'singapore') then
    raise exception 'bad_guess';
  end if;

  insert into public.city_puzzle_plays (user_id, city, play_date, question_id)
  select v_user, p_city, v_date, q.id
  from private.city_puzzle_question(p_city, v_date) q
  where q.id is not null
  on conflict (user_id, city, play_date) do nothing;

  select * into v_play from public.city_puzzle_plays
  where user_id = v_user and city = p_city and play_date = v_date
  for update;
  if not found then raise exception 'bad_guess'; end if;
  if v_play.done then raise exception 'already_done'; end if;

  select * into strict v_question from public.city_puzzle_questions where id = v_play.question_id;
  -- Use the client judge() operation order, including its floating-point slack.
  v_off := p_usd::double precision / round(v_question.local_price / v_question.usd_rate, 2)::double precision - 1;
  v_gap := abs(v_off) - 1e-9;
  v_play.won := v_gap <= 0.10;
  v_hint := case when v_play.won then 'solved' when v_off < 0 then 'higher' else 'lower' end;
  v_play.guesses := v_play.guesses || jsonb_build_array(jsonb_build_object(
    'usd', p_usd, 'hint', v_hint, 'close', v_gap <= 0.25
  ));
  v_play.done := v_play.won or jsonb_array_length(v_play.guesses) = 6;

  if v_play.done then
    v_play.reward := case when v_play.won then 3 else 1 end;
    perform private.ensure_player(v_user);
    update public.player_game set wax_balls = wax_balls + v_play.reward where user_id = v_user;
    select to_jsonb(s) - 'first_catch_bonus_available' into v_state from public.game_state() s;
  end if;

  update public.city_puzzle_plays
  set guesses = v_play.guesses, done = v_play.done, won = v_play.won, reward = v_play.reward
  where user_id = v_user and city = p_city and play_date = v_date;

  return jsonb_build_object(
    'puzzle', private.city_puzzle_object(v_question, v_play, v_date),
    'streak', private.city_puzzle_streak(v_user, v_date),
    'state', v_state
  );
end $$;

create function public.city_puzzle_today()
returns jsonb language sql stable set search_path = '' as $$
  select private.city_puzzle_today();
$$;

create function public.city_puzzle_guess(p_city text, p_usd numeric)
returns jsonb language sql set search_path = '' as $$
  select private.city_puzzle_guess(p_city, p_usd);
$$;

revoke all on function private.city_puzzle_date(timestamptz),
  private.city_puzzle_no(date), private.city_puzzle_question(text, date),
  private.city_puzzle_streak(uuid, date),
  private.city_puzzle_object(public.city_puzzle_questions, public.city_puzzle_plays, date)
  from public, anon, authenticated, service_role;
revoke all on function private.city_puzzle_today(), private.city_puzzle_guess(text, numeric),
  public.city_puzzle_today(), public.city_puzzle_guess(text, numeric)
  from public, anon, authenticated, service_role;
grant execute on function private.city_puzzle_today(), private.city_puzzle_guess(text, numeric),
  public.city_puzzle_today(), public.city_puzzle_guess(text, numeric) to authenticated;

-- Verified seed questions. See docs/review/city-puzzle-questions.md for price, FX and photo sources.
insert into public.city_puzzle_questions (
  city, seq, question_zh, question_en, venue_zh, venue_en, vessel, currency,
  local_price, usd_rate, fact_zh, fact_en, source, checked_on,
  photo_path, photo_credit, photo_license, photo_link, published
)
values
  ('taipei', 1, '一杯中杯冰珍珠奶茶的餐牌原價要多少錢？', 'What is the price of a medium iced pearl milk tea at menu price?', '春水堂南西店，中山區，台北', 'Chun Shui Tang SKM Nanxi, Zhongshan, Taipei', 'bubble-tea', 'NT$', 200, 32.98, '珍珠是在奶茶裡加的粉圓。', 'The pearls in the milk tea are chewy tapioca balls.', 'https://www.chunshuitang.com.tw/menu-detail/skm_nanxi_store/', '2026-11-17', 'taipei-pearl-milk-tea.jpg', 'takuma mori', 'CC BY 2.0', 'https://commons.wikimedia.org/wiki/File:2009-12-30_cups_of_bubble_tea_at_a_Chunshuitang_in_Taipei.jpg', true),
  ('taipei', 2, '微熱山丘十入鳳梨酥要多少錢？', 'What is the price of a ten-piece box of SunnyHills pineapple cakes?', '微熱山丘民生公園店，松山區，台北', 'SunnyHills Minsheng Park, Songshan, Taipei', 'pineapple-cake', 'NT$', 550, 32.98, '這個禮盒裝了十個鳳梨酥。', 'This gift box contains ten pineapple cakes.', 'https://beccadaily.com/sunny-hills/', '2026-11-17', null, null, null, null, true),
  ('taipei', 3, '一份十顆鮮肉小籠包的外送餐牌價要多少錢？', 'What is the price of a ten-piece order of pork xiaolongbao at the delivery menu price?', '鼎泰豐台北101店，信義區，台北', 'Din Tai Fung Taipei 101, Xinyi, Taipei', 'dim-sum-steamer', 'NT$', 290, 32.98, '小籠包的薄皮包住豬肉和湯汁。', 'A thin wrapper holds pork and broth inside a xiaolongbao.', 'https://www.ubereats.com/tw/store/din-tai-fung%E9%BC%8E%E6%B3%B0%E8%B1%90-101%E5%BA%97/AdPwg1XZTwOrtO90s3mFSA', '2026-11-17', 'taipei-xiaolongbao.jpg', 'Banzai Hiroaki', 'CC BY 2.0', 'https://commons.wikimedia.org/wiki/File:Steamed_xiaolongbao_served_in_a_traditional_Chinese_steaming_basket_at_a_Din_Tai_Fung_restaurant_in_Taipei_20090321.jpg', true),
  ('taipei', 4, '臺北市立動物園一張一般全票要多少錢？', 'What is the price of a regular Taipei Zoo admission ticket?', '臺北市立動物園售票處，文山區，台北', 'Taipei Zoo ticket office, Wenshan, Taipei', null, 'NT$', 100, 32.98, '動物園位在文山區。', 'The zoo is in Wenshan District.', 'https://english.zoo.gov.taipei/cp.aspx?n=8ED5B9F3BA1D301D&s=0FDA15FCD803C117', '2026-11-17', 'taipei-zoo.jpg', 'Yu tptw', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Taipei_Zoo_Entrance.jpg', true),
  ('taipei', 5, '貓空纜車一張普通單程票要多少錢？', 'What is the price of one regular single-journey ticket on the Maokong Gondola?', '貓空纜車動物園站售票處，文山區，台北', 'Maokong Gondola Taipei Zoo Station, Wenshan, Taipei', null, 'NT$', 180, 32.98, '纜車把動物園一帶和貓空連起來。', 'The gondola links the zoo area with Maokong.', 'https://english.gondola.taipei/cp.aspx?n=19884A72DB5E7A1D', '2026-11-17', 'taipei-maokong.jpg', 'Smiley.toerist', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Maokong_Gondola_2014_6.jpg', true),
  ('taipei', 6, '臺北天文館展示場一張全票要多少錢？', 'What is the price of an adult ticket to Taipei Astronomical Museum’s exhibition hall?', '臺北天文館售票處，士林區，台北', 'Taipei Astronomical Museum ticket office, Shilin, Taipei', null, 'NT$', 40, 32.98, '天文館的展示場和劇場分開售票。', 'The museum sells exhibition and theatre tickets separately.', 'https://en.tam.gov.taipei/News_Content.aspx?n=32FD082B7F3FA5E5&s=D3869EA9A2AC6C8A', '2026-11-17', 'taipei-astronomy.jpg', 'Wutthichai Charoenburi', 'CC BY 2.0', 'https://commons.wikimedia.org/wiki/File:Taipei_Astronomical_Museum_Entrance_20230324.jpg', true),
  ('taipei', 7, '臺北捷運一張一般一日票要多少錢？', 'What is the price of a standard Taipei Metro one-day pass?', '臺北捷運台北車站詢問處，中正區，台北', 'Taipei Metro information counter, Taipei Main Station, Zhongzheng', 'tram', 'NT$', 150, 32.98, '一日票啟用後可搭到當天營運結束。', 'Once activated, the pass lasts until the day’s service ends.', 'https://m.metro.taipei/en/ticketinfo.asp', '2026-11-17', null, null, null, null, true),
  ('taipei', 8, '臺北兒童新樂園搭一次摩天輪的設施票要多少錢？', 'What is the price of one Ferris wheel ride at Taipei Children’s Amusement Park?', '臺北兒童新樂園摩天輪，士林區，台北', 'Taipei Children’s Amusement Park Ferris wheel, Shilin, Taipei', null, 'NT$', 30, 32.98, '摩天輪的設施票和入園門票分開。', 'The Ferris wheel ride is priced separately from admission.', 'https://english.tcap.taipei/cp.aspx?n=0EE6B89A9CF30056', '2026-11-17', 'taipei-ferris-wheel.jpg', 'Matt Chang', 'CC BY 2.0', 'https://commons.wikimedia.org/wiki/File:Taipei_Children%27s_Amusement_Park_20150221.jpg', true),
  ('taipei', 9, '台北101觀景台 89 樓一張成人全票要多少錢？', 'What is the price of a full-price adult ticket to Taipei 101’s 89th-floor observatory?', '台北101觀景台售票處，信義區，台北', 'Taipei 101 Observatory ticket office, Xinyi, Taipei', 'bamboo-tower', 'NT$', 600, 32.98, '室內觀景台在大樓第 89 層。', 'The indoor observatory is on the tower’s 89th floor.', 'https://101ob.welcometw.com/tour/Lyrg?lang=zh_TW', '2026-11-17', 'taipei-101.jpg', 'AngMoKio', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Taipei_101_2009_amk.jpg', true),
  ('taipei', 10, '臺北故宮北院一張外籍成人一般票要多少錢？', 'What is the price of a standard ticket for a non-Taiwanese adult at the National Palace Museum’s Northern Branch?', '國立故宮博物院北院第一展覽館，士林區，台北', 'National Palace Museum Northern Branch, Exhibition Hall I, Shilin, Taipei', null, 'NT$', 350, 32.98, '臺北故宮的收藏有青銅器、玉器和書畫。', 'The Taipei collection includes bronzes, jades, paintings and calligraphy.', 'https://www.npm.gov.tw/Articles.aspx?l=2&sno=02007004', '2026-11-17', 'taipei-palace-museum.jpg', 'Jason Zhang', 'CC0', 'https://commons.wikimedia.org/wiki/File:National_Palace_Museum,_Taipei.jpg', true),
  ('taipei', 11, '台北當代藝術館一張一般門票要多少錢？', 'What is the price of a general admission ticket to the Museum of Contemporary Art Taipei?', '台北當代藝術館售票處，大同區，台北', 'MOCA Taipei ticket office, Datong, Taipei', null, 'NT$', 100, 32.98, '當代館每週一休館。', 'MOCA Taipei closes on Mondays.', 'https://www.moca.taipei/en/Visit/Hours%20%26%20Admissions', '2026-11-17', 'taipei-moca.jpg', 'Tbatb', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Before_Museum_of_Contemporary_Art,_Taipei_01.jpg', true),
  ('taipei', 12, '台灣高鐵從台北到桃園一張標準車廂對號全票要多少錢？', 'What is the price of one full-fare reserved standard-class high-speed rail ticket from Taipei to Taoyuan?', '台灣高鐵台北車站售票處，中正區，台北', 'THSR ticket office, Taipei Main Station, Zhongzheng', 'tram', 'NT$', 160, 32.98, '往桃園方向的列車在台北之後還會經過板橋。', 'A train heading from Taipei towards Taoyuan passes through Banqiao.', 'https://en.thsrc.com.tw/ArticleContent/4c3efc1d-e6df-4bfd-97b4-52e89f79ee5c', '2026-11-17', 'taipei-thsr.jpg', '4300streetcar', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Taiwan_High_Speed_Rail_train_628_at_Taipei_Main_Station_May_2025.jpg', true),
  ('taipei', 13, '一碗御品牛肉麵的餐牌原價要多少錢？', 'What is the price of a bowl of signature braised beef noodle soup at menu price?', '春水堂南西店，中山區，台北', 'Chun Shui Tang SKM Nanxi, Zhongshan, Taipei', 'ramen', 'NT$', 315, 32.98, '除了茶飲，春水堂的菜單上也有牛肉麵。', 'Chun Shui Tang serves beef noodles alongside its tea drinks.', 'https://www.chunshuitang.com.tw/menu-detail/skm_nanxi_store/', '2026-11-17', null, null, null, null, true),
  ('taipei', 14, '臺北戲棚一般晚場演出的一張全票要多少錢？', 'What is the price of a full-price ticket for a regular evening show at TaipeiEYE?', '臺北戲棚售票處，中山區，台北', 'TaipeiEYE box office, Zhongshan, Taipei', null, 'NT$', 800, 32.98, '臺北戲棚演出包括傳統戲曲。', 'TaipeiEYE stages traditional opera.', 'https://www.taipeieye.com/en/Order/2026/11?programId=38&scheduleId=10377', '2026-11-17', 'taipei-eye.jpg', 'David Monniaux', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Taipei_Eye_p1090619.jpg', true),
  ('taipei', 15, '一份蝦仁蛋炒飯的外送餐牌價要多少錢？', 'What is the price of one shrimp and egg fried rice at the delivery menu price?', '鼎泰豐台北101店，信義區，台北', 'Din Tai Fung Taipei 101, Xinyi, Taipei', 'bento', 'NT$', 320, 32.98, '這款炒飯把蝦仁和雞蛋一起炒香。', 'This fried rice pairs shrimp with egg.', 'https://www.ubereats.com/tw/store/din-tai-fung%E9%BC%8E%E6%B3%B0%E8%B1%90-101%E5%BA%97/AdPwg1XZTwOrtO90s3mFSA', '2026-11-17', null, null, null, null, true),
  ('taipei', 16, '臺北市立動物園遊客列車一張票要多少錢？', 'What is the price of a ticket for the Taipei Zoo shuttle train?', '臺北市立動物園遊客列車總站，文山區，台北', 'Taipei Zoo shuttle train main stop, Wenshan, Taipei', 'tram', 'NT$', 5, 32.98, '園內的遊客列車另外收費。', 'The zoo charges separately for its shuttle train.', 'https://english.zoo.gov.taipei/cp.aspx?n=8ED5B9F3BA1D301D&s=0FDA15FCD803C117', '2026-11-17', null, null, null, null, true),
  ('taipei', 17, '一份蝦肉紅油抄手的外送餐牌價要多少錢？', 'What is the price of one spicy shrimp and pork wontons order at the delivery menu price?', '鼎泰豐台北101店，信義區，台北', 'Din Tai Fung Taipei 101, Xinyi, Taipei', 'dim-sum-steamer', 'NT$', 240, 32.98, '這道抄手用蝦和豬肉做餡，拌上辣油。', 'These wontons combine shrimp and pork with chilli oil.', 'https://www.ubereats.com/tw/store/din-tai-fung%E9%BC%8E%E6%B3%B0%E8%B1%90-101%E5%BA%97/AdPwg1XZTwOrtO90s3mFSA', '2026-11-17', null, null, null, null, true),
  ('taipei', 18, '一壺高山焙火烏龍的餐牌原價要多少錢？', 'What is the price of a pot of roasted oolong tea at menu price?', '春水堂南西店，中山區，台北', 'Chun Shui Tang SKM Nanxi, Zhongshan, Taipei', 'teapot', 'NT$', 290, 32.98, '這份壺茶附兩個杯子，可以回沖。', 'The pot comes with two cups and can be refilled.', 'https://www.chunshuitang.com.tw/menu-detail/skm_nanxi_store/', '2026-11-17', null, null, null, null, true),
  ('taipei', 19, '一份蒸蘿蔔糕的餐牌原價要多少錢？', 'What is the price of a serving of steamed turnip cake at menu price?', '春水堂南西店，中山區，台北', 'Chun Shui Tang SKM Nanxi, Zhongshan, Taipei', 'dim-sum-steamer', 'NT$', 130, 32.98, '這款蘿蔔糕是蒸的。', 'This turnip cake is steamed.', 'https://www.chunshuitang.com.tw/menu-detail/skm_nanxi_store/', '2026-11-17', null, null, null, null, true),
  ('taipei', 20, '一碗功夫麵的餐牌原價要多少錢？', 'What is the price of a bowl of Kung-Fu Noodles at menu price?', '春水堂南西店，中山區，台北', 'Chun Shui Tang SKM Nanxi, Zhongshan, Taipei', 'ramen', 'NT$', 135, 32.98, '店家的功夫麵是乾拌麵。', 'The café serves its Kung-Fu Noodles without broth.', 'https://www.chunshuitang.com.tw/menu-detail/skm_nanxi_store/', '2026-11-17', null, null, null, null, true),
  ('hongkong', 1, '香港海景嘉福洲際酒店 Café on M 一個菠蘿油的餐牌價要多少錢？', 'What is the price of one buttered pineapple bun at Café on M at the InterContinental Grand Stanford Hong Kong, at menu price?', '海景嘉福洲際酒店 Café on M，尖沙咀東，香港', 'Café on M, InterContinental Grand Stanford, Tsim Sha Tsui East, Hong Kong', 'bolo-bun', 'HK$', 38, 7.846, '菠蘿油是把牛油夾進菠蘿包裡。', 'A buttered pineapple bun has a slice of butter inside.', 'https://www.hongkong.intercontinental.com/wp-content/uploads/sites/33/2025/09/cha_chaan_teng_menu.pdf', '2026-11-17', 'hongkong-pineapple-bun.jpg', 'Dennis Wong', 'CC BY 2.0', 'https://commons.wikimedia.org/wiki/File:Pineapple_Bun_with_Butter_inside.jpg', true),
  ('hongkong', 2, '香港電車（叮叮）一程成人車資要多少錢？', 'What is the price of an adult ride on Hong Kong’s Ding Ding tram?', '香港電車西港城總站，上環，香港', 'Hong Kong Tramways Western Market Terminus, Sheung Wan, Hong Kong', 'tram', 'HK$', 3.30, 7.846, '叮叮是香港電車的暱稱。', 'Ding Ding is the nickname of Hong Kong’s trams.', 'https://www.hktramways.com/en/schedules-fares', '2026-11-17', 'hongkong-tram.jpg', 'Tim Adams', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:Ding_Ding_tram_on_Hennessy_Road_in_Hong_Kong.jpg', true),
  ('hongkong', 3, '平日搭天星小輪由灣仔往尖沙咀一張成人船票（公眾假期除外）要多少錢？', 'What is the price of one adult Star Ferry crossing from Wan Chai to Tsim Sha Tsui on a weekday outside public holidays?', '天星小輪灣仔碼頭，灣仔，香港', 'Star Ferry, Wan Chai Pier, Hong Kong', null, 'HK$', 5, 7.846, '灣仔航線把港島和九龍連起來。', 'The Wan Chai route links Hong Kong Island and Kowloon.', 'https://www.starferry.com.hk/en/service', '2026-11-17', 'hongkong-star-ferry.jpg', 'LN9267', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Night_Star_Star_Ferry_Wan_Chai_to_Tsim_Sha_Tsui_06-02-2022.jpg', true),
  ('hongkong', 4, '用八達通搭機場快綫從香港站到機場的成人單程車資要多少錢？', 'What is the price of an adult Airport Express ride from Hong Kong Station to the airport using Octopus?', '機場快綫香港站，中環，香港', 'Airport Express Hong Kong Station, Central, Hong Kong', 'tram', 'HK$', 120, 7.846, '香港站是機場快綫在港島的車站。', 'Hong Kong Station is the Airport Express stop on Hong Kong Island.', 'https://www.mtr.com.hk/digitalleaflet/en/detail.html?article=airport-express-service-guide', '2026-11-17', 'hongkong-airport-express.jpg', 'LN9267', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:MTR_Airport_Express_train_12-03-2025.jpg', true),
  ('hongkong', 5, '昂坪360標準車廂一張成人來回票要多少錢？', 'What is the price of an adult round trip in an Ngong Ping 360 standard cabin?', '昂坪360東涌纜車站售票處，東涌，香港', 'Ngong Ping 360 Tung Chung Terminal ticket office, Tung Chung, Hong Kong', null, 'HK$', 295, 7.846, '纜車來往東涌和昂坪。', 'The cable car links Tung Chung and Ngong Ping.', 'https://www.np360.com.hk/en/tickets-promotions/tickets-tours/cable-car-tickets', '2026-11-17', 'hongkong-ngong-ping.jpg', 'HK Arun', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Ngong_Ping_360_Cabins.JPG', true),
  ('hongkong', 6, '香港故宮文化博物館一張成人定時段標準門票要多少錢？', 'What is the price of a timed adult general-admission ticket to the Hong Kong Palace Museum?', '香港故宮文化博物館售票處，西九文化區，香港', 'Hong Kong Palace Museum ticket office, West Kowloon Cultural District', null, 'HK$', 70, 7.846, '一般門票涵蓋第 1 至第 7 展廳。', 'General admission covers galleries 1 to 7.', 'https://www.hkpm.org.hk/en/visit/ticket', '2026-11-17', 'hongkong-palace-museum.jpg', 'P．汶', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:HK_Palace_Museum_in_28-01-2023.jpg', true),
  ('hongkong', 7, 'M+ 博物館一張正價門票要多少錢？', 'What is the price of a standard admission ticket to the M+ museum?', 'M+博物館售票處，西九文化區，香港', 'M+ ticket office, West Kowloon Cultural District', null, 'HK$', 190, 7.846, 'M+ 位於西九文化區。', 'M+ is in the West Kowloon Cultural District.', 'https://www.mplus.org.hk/en/admission-tickets/', '2026-11-17', 'hongkong-m-plus.jpg', 'WikiTL65', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:M%2B_Museum_Hong_Kong.jpg', true),
  ('hongkong', 8, '灣仔金輝點心一籠蝦餃要多少錢？', 'What is the price of a basket of har gow at Kam Fai Dim Sum in Wan Chai?', '金輝點心，灣仔，香港', 'Kam Fai Dim Sum, Wan Chai, Hong Kong', 'dim-sum-steamer', 'HK$', 30, 7.846, '蝦餃以薄薄的半透明外皮包住鮮蝦。', 'Har gow wrap shrimp in thin, translucent skins.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', null, null, null, null, true),
  ('hongkong', 9, '香港海景嘉福洲際酒店 Café on M 兩件港式酥皮蛋撻的餐牌價要多少錢？', 'What is the price of two Hong Kong-style egg tarts at Café on M at the InterContinental Grand Stanford Hong Kong, at menu price?', '海景嘉福洲際酒店 Café on M，尖沙咀東，香港', 'Café on M, InterContinental Grand Stanford, Tsim Sha Tsui East, Hong Kong', null, 'HK$', 28, 7.846, '店家用酥皮包住蛋奶餡。', 'The café’s tarts have puff pastry shells filled with egg custard.', 'https://www.hongkong.intercontinental.com/wp-content/uploads/sites/33/2025/09/cha_chaan_teng_menu.pdf', '2026-11-17', 'hongkong-egg-tarts.jpg', 'See-ming Lee', 'CC BY 2.0', 'https://commons.wikimedia.org/wiki/File:Egg_Tarts_with_Puff_Pastry.jpg', true),
  ('hongkong', 10, '在一般收費日參觀香港科學館常設展的一張標準票要多少錢？', 'What is the price of a standard ticket to the Hong Kong Science Museum’s permanent exhibitions on a regular paid day?', '香港科學館售票處，尖沙咀東，香港', 'Hong Kong Science Museum ticket office, Tsim Sha Tsui East, Hong Kong', null, 'HK$', 20, 7.846, '科學館常設展星期三免費。', 'The permanent exhibitions are free on Wednesdays.', 'https://hk.science.museum/tc/web/scm/visit.html', '2026-11-17', 'hongkong-science-museum.jpg', 'wanghongliu', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:%E9%A6%99%E6%B8%AF%E7%A7%91%E5%AD%A6%E9%A6%86_HONG_KONG_SCIENCE_MUSEUM_-_panoramio.jpg', true),
  ('hongkong', 11, '香港太空館天象廳一張成人後座門票要多少錢？', 'What is the price of one adult stalls ticket to a show at the Hong Kong Space Museum’s Space Theatre?', '香港太空館天象廳售票處，尖沙咀，香港', 'Hong Kong Space Museum Space Theatre box office, Tsim Sha Tsui', null, 'HK$', 40, 7.846, '天象廳會放映立體球幕電影。', 'The Space Theatre screens 3D dome shows.', 'https://hk.space.museum/en/web/spm/shows.html', '2026-11-17', 'hongkong-space-museum.jpg', 'Ahmed', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Hong_Kong_Space_Museum_20191222_04.jpg', true),
  ('hongkong', 12, '灣仔金輝點心一籠燒賣要多少錢？', 'What is the price of a basket of siu mai at Kam Fai Dim Sum in Wan Chai?', '金輝點心，灣仔，香港', 'Kam Fai Dim Sum, Wan Chai, Hong Kong', 'dim-sum-steamer', 'HK$', 25, 7.846, '港式燒賣的頂部不封口。', 'Cantonese siu mai are steamed with the top left open.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', null, null, null, null, true),
  ('hongkong', 13, '香港海景嘉福洲際酒店 Café on M 一杯熱港式奶茶的餐牌價要多少錢？', 'What is the price of one hot Hong Kong-style milk tea at Café on M at the InterContinental Grand Stanford Hong Kong, at menu price?', '海景嘉福洲際酒店 Café on M，尖沙咀東，香港', 'Café on M, InterContinental Grand Stanford, Tsim Sha Tsui East, Hong Kong', null, 'HK$', 38, 7.846, '這家店的茶餐廳餐牌把奶茶分為冷熱。', 'The cha chaan teng menu offers milk tea hot or iced.', 'https://www.hongkong.intercontinental.com/wp-content/uploads/sites/33/2025/09/cha_chaan_teng_menu.pdf', '2026-11-17', 'hongkong-milk-tea.jpg', 'Peachyeung316', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Hong_Kong_style_milk_tea_and_Pineapple_bun_with_butter.jpg', true),
  ('hongkong', 14, '灣仔金輝點心一份香菇滑雞煲仔飯要多少錢？', 'What is the price of a chicken and mushroom claypot rice at Kam Fai Dim Sum in Wan Chai?', '金輝點心，灣仔，香港', 'Kam Fai Dim Sum, Wan Chai, Hong Kong', 'bento', 'HK$', 37, 7.846, '雞肉和香菇在瓦煲裡跟飯一起上桌。', 'The chicken, mushrooms and rice are served together in the clay pot.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', null, null, null, null, true),
  ('hongkong', 15, '香港海景嘉福洲際酒店 Café on M 一份港式西多士的餐牌價要多少錢？', 'What is the price of one Hong Kong-style French toast at Café on M at the InterContinental Grand Stanford Hong Kong, at menu price?', '海景嘉福洲際酒店 Café on M，尖沙咀東，香港', 'Café on M, InterContinental Grand Stanford, Tsim Sha Tsui East, Hong Kong', null, 'HK$', 48, 7.846, '店家的西多士用花生醬夾心，配糖漿和牛油。', 'This French toast has a peanut-butter filling and comes with syrup and butter.', 'https://www.hongkong.intercontinental.com/wp-content/uploads/sites/33/2025/09/cha_chaan_teng_menu.pdf', '2026-11-17', 'hongkong-french-toast.jpg', 'Andy Li', 'CC0', 'https://commons.wikimedia.org/wiki/File:Hong_Kong_style_French_Toast_with_Peanut_Butter_-_CK_Bistro_2023-07-25.jpg', true),
  ('hongkong', 16, '灣仔金輝點心一份馬拉糕要多少錢？', 'What is the price of a serving of steamed ma lai go at Kam Fai Dim Sum in Wan Chai?', '金輝點心，灣仔，香港', 'Kam Fai Dim Sum, Wan Chai, Hong Kong', 'cake-box', 'HK$', 23, 7.846, '馬拉糕蒸好後，剖面有細小氣孔。', 'Steamed ma lai go has small air pockets throughout its crumb.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', null, null, null, null, true),
  ('hongkong', 17, '灣仔金輝點心一份鮮蝦腸粉要多少錢？', 'What is the price of one order of whole-shrimp rice rolls at Kam Fai Dim Sum in Wan Chai?', '金輝點心，灣仔，香港', 'Kam Fai Dim Sum, Wan Chai, Hong Kong', 'dim-sum-steamer', 'HK$', 31, 7.846, '鮮蝦腸粉用米漿蒸成薄皮裹蝦。', 'Thin sheets made from steamed rice batter are wrapped around shrimp.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', null, null, null, null, true),
  ('hongkong', 18, '灣仔金輝點心一份牛肉丸要多少錢？', 'What is the price of one order of beef balls at Kam Fai Dim Sum in Wan Chai?', '金輝點心，灣仔，香港', 'Kam Fai Dim Sum, Wan Chai, Hong Kong', 'dim-sum-steamer', 'HK$', 22, 7.846, '店家的牛肉丸帶有陳皮香。', 'The shop’s beef balls are scented with dried tangerine peel.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', null, null, null, null, true),
  ('hongkong', 19, '灣仔金輝點心一份黑芝麻蓉包要多少錢？', 'What is the price of one order of black sesame buns at Kam Fai Dim Sum in Wan Chai?', '金輝點心，灣仔，香港', 'Kam Fai Dim Sum, Wan Chai, Hong Kong', 'dim-sum-steamer', 'HK$', 21, 7.846, '包子蒸好後，內餡有濃郁的黑芝麻香氣。', 'The steamed buns have a fragrant black sesame filling.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', null, null, null, null, true),
  ('hongkong', 20, '從中環搭山頂纜車上山的一張成人單程票要多少錢？', 'What is the price of one adult Peak Tram single ticket uphill from Central?', '山頂纜車中環花園道總站售票處，中環，香港', 'Peak Tram Lower Terminus ticket office, Garden Road, Central', 'tram', 'HK$', 82, 7.846, '山頂纜車使用纜索帶動車廂上下山。', 'The Peak Tram is a funicular railway.', 'https://www.landsd.gov.hk/doc/en/mapping/ehkg/individual_PDF/Notes_on_HongKong_2026.pdf', '2026-11-17', 'hongkong-peak-tram.jpg', 'LN9267', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Peak_tram_in_Central_Terminus_03-03-2023.jpg', true),
  ('macau', 1, '路環安德魯咖啡店一個葡式蛋撻（未計服務費）要多少錢？', 'What is the price of one Portuguese egg tart at Lord Stow’s Café in Coloane, before service charge?', '安德魯咖啡店，路環，澳門', 'Lord Stow’s Café, Coloane, Macau', 'egg-tart', 'MOP', 11, 8.08138, '安德魯的葡撻會烤到表面帶焦糖色。', 'Lord Stow’s egg tarts have a caramelised top.', 'https://www.lordstow.com/wp-content/uploads/2015/09/lord-stows-cafe-menu-8thJan2024.pdf', '2026-11-17', 'macau-egg-tart.jpg', 'Pauloleong2002', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Portuguese_egg_tart_in_Macau.jpg', true),
  ('macau', 2, '路環安德魯咖啡店一份原味芝士餅（未計服務費）要多少錢？', 'What is the price of a plain chilled cheesecake at Lord Stow’s Café in Coloane, before service charge?', '安德魯咖啡店，路環，澳門', 'Lord Stow’s Café, Coloane, Macau', 'cake-box', 'MOP', 32, 8.08138, '店家的原味芝士餅是冷藏甜點。', 'The café serves its plain cheesecake chilled.', 'https://www.lordstow.com/wp-content/uploads/2015/09/lord-stows-cafe-menu-8thJan2024.pdf', '2026-11-17', null, null, null, null, true),
  ('macau', 3, '澳門大賽車博物館一張成人正價票要多少錢？', 'What is the price of a full-price adult ticket to the Macao Grand Prix Museum?', '澳門大賽車博物館售票處，新口岸，澳門', 'Macao Grand Prix Museum ticket office, NAPE, Macau', null, 'MOP', 80, 8.08138, '大賽車博物館以澳門的賽車活動為主題。', 'The museum is devoted to Macao’s motor-racing event.', 'https://mgpm.macaotourism.gov.mo/en/about/ticketing', '2026-11-17', 'macau-grand-prix-museum.jpg', 'LN9267', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Macao_Grand_Prix_Museum_20-07-2023.jpg', true),
  ('macau', 4, '從媽閣站出發，搭澳門輕軌三站或以下的一張成人單程票要多少錢？', 'What is the price of an adult Macao LRT single ticket from Barra for three stops or fewer?', '澳門輕軌媽閣站售票機，媽閣，澳門', 'Macao LRT Barra Station ticket machines, Barra, Macau', 'tram', 'MOP', 6, 8.08138, '輕軌單程票是一枚代幣。', 'A single-journey LRT ticket takes the form of a token.', 'https://www.mlm.com.mo/en/general_ticket.html', '2026-11-17', 'macau-lrt.jpg', 'Doraemon.tvb', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Macau_LRT_Train.jpg', true),
  ('macau', 5, '澳門松山纜車一張普通來回票要多少錢？', 'What is the price of a standard return ticket on Macao’s Guia cable car?', '松山纜車二龍喉公園售票處，望德堂區，澳門', 'Guia Cable Car ticket office, Flora Garden, São Lázaro, Macau', null, 'MOP', 3, 8.08138, '纜車入口位於二龍喉公園。', 'The cable car starts at Flora Garden.', 'https://www.macaotourism.gov.mo/en/shows-and-entertainment/family-fun/cable-car', '2026-11-17', 'macau-guia-cable-car.jpg', 'LN9267', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Guia_Cable_Car_No.2_22-02-2023.jpg', true),
  ('macau', 6, '澳門旅遊塔一張包含手扇的成人標準觀光票要多少錢？', 'What is the price of an adult Macau Tower observation ticket that includes a hand fan?', '澳門旅遊塔觀光層售票處，南灣，澳門', 'Macau Tower observation deck ticket office, Nam Van, Macau', null, 'MOP', 208, 8.08138, '旅遊塔的觀光票可進入觀光層。', 'The tower ticket includes admission to its observation decks.', 'https://www.macautower.com.mo/en/entertainment/observation-deck/', '2026-11-17', 'macau-tower.jpg', 'WiNG', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Macau_Tower_Observation_Deck_2008.jpg', true),
  ('macau', 7, '澳門君悅酒店大堂酒廊一個可麗露（未計政府稅）要多少錢？', 'What is the price of one canelé at the Grand Hyatt Macau Lobby Lounge, before tax?', '澳門君悅酒店大堂酒廊，路氹，澳門', 'Grand Hyatt Macau Lobby Lounge, Cotai, Macau', 'cake-box', 'MOP', 25, 8.08138, '可麗露是用模具烤出凹凸外形的小糕點。', 'A canelé gets its fluted shape from a mould.', 'https://www.hyatt.com/content/dam/hotel/propertysites/assets/grand/macgh/documents/en_US/dining/lobby-lounge/Lobby-Lounge-Cake-Menu.pdf', '2026-11-17', null, null, null, null, true),
  ('macau', 8, '澳門銀河氹仔漁村一份漁村富貴蝦餃皇（未計服務費）要多少錢？', 'What is the price of one serving of steamed mantis-shrimp dumplings at Tam Chai Yu Chun, Galaxy Macau, before service charge?', '銀河氹仔漁村，路氹，澳門', 'Tam Chai Yu Chun, Galaxy Macau, Cotai', 'dim-sum-steamer', 'MOP', 88, 8.08138, '這款蝦餃用瀨尿蝦做餡。', 'These dumplings are made with mantis shrimp.', 'https://img.galaxymacau.com/2026-02/TCYC-%20Interactive%20Menu-%20ALC_Dimsum_Seasonal_0206.pdf', '2026-11-17', null, null, null, null, true),
  ('macau', 9, '路環安德魯咖啡店一份伯爵茶卷（未計服務費）要多少錢？', 'What is the price of an Earl Grey roll at Lord Stow’s Café in Coloane, before service charge?', '安德魯咖啡店，路環，澳門', 'Lord Stow’s Café, Coloane, Macau', 'cake-box', 'MOP', 24, 8.08138, '伯爵茶也可以用來做蛋糕卷。', 'Earl Grey is used as a flavour in this cake roll.', 'https://www.lordstow.com/wp-content/uploads/2015/09/lord-stows-cafe-menu-8thJan2024.pdf', '2026-11-17', null, null, null, null, true),
  ('macau', 10, '非澳門居民在一般收費日參觀澳門博物館的一張成人票要多少錢？', 'What is the price of a non-resident adult ticket to the Macao Museum on a regular paid day?', '澳門博物館售票處，大炮台，澳門', 'Macao Museum ticket office, Mount Fortress, Macau', null, 'MOP', 15, 8.08138, '澳門博物館位於大炮台。', 'The Macao Museum is at Mount Fortress.', 'https://www.macaumuseum.gov.mo/doc/upload/1614832333784.pdf?AspxAutoDetectCookieSupport=1', '2026-11-17', 'macau-museum.jpg', 'LN9267', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Macau_Museum_entry_09-02-2023.jpg', true),
  ('macau', 11, '澳門君悅酒店大堂酒廊一磅陳皮里斯本朱古力蛋糕（未計政府稅）要多少錢？', 'What is the price of a one-pound Lisbon chocolate torte at the Grand Hyatt Macau Lobby Lounge, before tax?', '澳門君悅酒店大堂酒廊，路氹，澳門', 'Grand Hyatt Macau Lobby Lounge, Cotai, Macau', 'cake-box', 'MOP', 228, 8.08138, '這款朱古力蛋糕加了陳皮。', 'Dried tangerine peel flavours this chocolate torte.', 'https://www.hyatt.com/content/dam/hotel/propertysites/assets/grand/macgh/documents/en_US/dining/lobby-lounge/Lobby-Lounge-Cake-Menu.pdf', '2026-11-17', null, null, null, null, true),
  ('macau', 12, '澳門銀河氹仔漁村一份豬潤燒賣（未計服務費）要多少錢？', 'What is the price of one serving of pork-liver siu mai at Tam Chai Yu Chun, Galaxy Macau, before service charge?', '銀河氹仔漁村，路氹，澳門', 'Tam Chai Yu Chun, Galaxy Macau, Cotai', 'dim-sum-steamer', 'MOP', 58, 8.08138, '這款燒賣在肉餡上放豬肝。', 'These siu mai are topped with pork liver.', 'https://img.galaxymacau.com/2026-02/TCYC-%20Interactive%20Menu-%20ALC_Dimsum_Seasonal_0206.pdf', '2026-11-17', null, null, null, null, true),
  ('macau', 13, '澳門林則徐紀念館一張成人正價票要多少錢？', 'What is the price of a full-price adult ticket to the Lin Zexu Memorial Museum of Macao?', '林則徐紀念館售票處，蓮峰廟，澳門', 'Lin Zexu Memorial Museum ticket office, Lin Fung Temple, Macau', null, 'MOP', 5, 8.08138, '紀念館就在蓮峰廟旁。', 'The museum is near Lin Fung Temple.', 'https://www.museums.gov.mo/eng/museums.html', '2026-11-17', 'macau-lin-zexu-museum.jpg', 'LN9267', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Lin_Zexu_Memorial_Museum_of_Macao_entry_26-08-2023.jpg', true),
  ('macau', 14, '澳門銀河氹仔漁村一份脆皮白糖糕（未計服務費）要多少錢？', 'What is the price of one serving of pan-fried sweet rice cake at Tam Chai Yu Chun, Galaxy Macau, before service charge?', '銀河氹仔漁村，路氹，澳門', 'Tam Chai Yu Chun, Galaxy Macau, Cotai', 'dim-sum-steamer', 'MOP', 58, 8.08138, '這個做法把甜米糕煎出脆皮。', 'Pan-frying gives this sweet rice cake a crisp edge.', 'https://img.galaxymacau.com/2026-02/TCYC-%20Interactive%20Menu-%20ALC_Dimsum_Seasonal_0206.pdf', '2026-11-17', null, null, null, null, true),
  ('macau', 15, '澳門仁慈堂博物館一張成人正價門票要多少錢？', 'What is the price of a standard adult ticket to Macao’s Museum of the Holy House of Mercy?', '仁慈堂博物館售票處，議事亭前地，澳門', 'Holy House of Mercy Museum ticket office, Senado Square, Macau', null, 'MOP', 5, 8.08138, '博物館入口在仁慈堂右巷二號。', 'The entrance is at 2 Travessa da Misericórdia.', 'https://www.museums.gov.mo/eng/museums.html', '2026-11-17', 'macau-holy-house-of-mercy.jpg', 'Paolobon140', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:La_Santa_Casa_da_Misericordia,_in_Largo_do_Senado,_Macao.jpg', true),
  ('macau', 16, '澳門銀河氹仔漁村一位楊枝甘露（未計服務費）要多少錢？', 'What is the price of one portion of chilled mango sago at Tam Chai Yu Chun, Galaxy Macau, before service charge?', '銀河氹仔漁村，路氹，澳門', 'Tam Chai Yu Chun, Galaxy Macau, Cotai', null, 'MOP', 58, 8.08138, '這款甜品以芒果、西米和柚子搭配。', 'This chilled dessert combines mango, sago and pomelo.', 'https://img.galaxymacau.com/2026-02/TCYC-%20Interactive%20Menu-%20ALC_Dimsum_Seasonal_0206.pdf', '2026-11-17', 'macau-mango-sago.jpg', 'Thomas.Lu', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:MangoPomeloSago_1.jpg', true),
  ('macau', 17, '搭一次影滙之星摩天輪的標準票要多少錢？', 'What is the price of a standard ticket for a ride on the Golden Reel?', '新濠影滙影滙之星售票處，路氹，澳門', 'Studio City Golden Reel ticket office, Cotai, Macau', null, 'MOP', 100, 8.08138, '摩天輪的軌道是「8」字形。', 'The wheel follows a figure-eight track.', 'https://studiocity-macau.com/en/attractions/golden-reel', '2026-11-17', 'macau-golden-reel.jpg', 'LN9267', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Studio_City_Macau_14-05-2019.jpg', true),
  ('macau', 18, '一份摩哆雞腿飯的餐牌價（未計服務費）要多少錢？', 'What is the price of a Macanese baked spiced chicken drumstick with rice, before service charge?', '新濠影滙香滿樓，路氹，澳門', 'Spice Road, Studio City, Cotai, Macau', 'bento', 'MOP', 128, 8.08138, '這道飯把香料烤雞腿配上白飯。', 'This dish pairs a spiced baked chicken drumstick with rice.', 'https://www.studiocity-macau.com/assets/public/2026-04/SC_Spice_Road_%20ALCMenu_2026Q2V2.pdf', '2026-11-17', null, null, null, null, true),
  ('macau', 19, '一份澳門乾免治牛肉飯的餐牌價（未計服務費）要多少錢？', 'What is the price of a serving of Macanese minced beef with a fried egg and rice, before service charge?', '新濠影滙香滿樓，路氹，澳門', 'Spice Road, Studio City, Cotai, Macau', 'bento', 'MOP', 128, 8.08138, '免治是澳門菜常見的肉末料理。', 'Minchi is a Macanese dish made with minced meat.', 'https://www.studiocity-macau.com/assets/public/2026-04/SC_Spice_Road_%20ALCMenu_2026Q2V2.pdf', '2026-11-17', 'macau-minchi.jpg', 'Adriao', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:Minchi.jpg', true),
  ('macau', 20, '一份鮮鮑燒賣的餐牌價（未計服務費）要多少錢？', 'What is the price of a serving of steamed pork dumplings with abalone, before service charge?', '銀河氹仔漁村，路氹，澳門', 'Tam Chai Yu Chun, Galaxy Macau, Cotai', 'dim-sum-steamer', 'MOP', 88, 8.08138, '這款燒賣把鮑魚放在豬肉餡上。', 'These siu mai pair pork with abalone.', 'https://img.galaxymacau.com/2026-02/TCYC-%20Interactive%20Menu-%20ALC_Dimsum_Seasonal_0206.pdf', '2026-11-17', null, null, null, null, true),
  ('singapore', 1, '聖淘沙馬來西亞美食街一份咖椰牛油吐司早餐套餐要多少錢？', 'What is the price of one kaya-butter toast breakfast set at Malaysian Food Street, Sentosa?', '馬來西亞美食街，聖淘沙名勝世界，新加坡', 'Malaysian Food Street, Resorts World Sentosa, Singapore', null, 'S$', 7, 1.289, '這份早餐搭配半熟蛋和一杯熱飲。', 'The set pairs the toast with soft-boiled eggs and a hot drink.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', 'singapore-kaya-toast.jpg', 'Jacklee', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Kaya_toast_from_Ya_Kun_Kaya_Toast,_Singapore_-_20160813.jpg', true),
  ('singapore', 2, '聖淘沙馬來西亞美食街兩片印度煎餅配扁豆咖哩要多少錢？', 'What is the price of two roti canai with dhal curry at Malaysian Food Street, Sentosa?', '馬來西亞美食街，聖淘沙名勝世界，新加坡', 'Malaysian Food Street, Resorts World Sentosa, Singapore', null, 'S$', 5, 1.289, '這份煎餅可以沾扁豆咖哩吃。', 'The flatbread is served with dhal for dipping.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', 'singapore-roti.jpg', 'ProjectManhattan', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Roti_prata.jpg', true),
  ('singapore', 3, '新加坡國家胡姬花園一張非居民成人標準票要多少錢？', 'What is the price of a standard non-resident adult ticket to Singapore’s National Orchid Garden?', '國家胡姬花園售票處，東陵，新加坡', 'National Orchid Garden ticket counter, Tanglin, Singapore', 'orchid', 'S$', 15, 1.289, '花園的四個區域以四季為設計主題。', 'The garden’s four sections are themed around the seasons.', 'https://sbg.nparks.gov.sg/attractions/national-orchid-garden/', '2026-11-17', 'singapore-orchid-garden.jpg', 'Timothy A. Gonsalves', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Entrance_National_Orchid_Garden_Singapore_Feb23_D72_25450.jpg', true),
  ('singapore', 4, '遊客在一般日到新加坡動物園的一張成人門票要多少錢？', 'What is the price of an adult tourist ticket to Singapore Zoo on a regular day?', '新加坡動物園售票處，萬態，新加坡', 'Singapore Zoo ticket office, Mandai, Singapore', null, 'S$', 49, 1.289, '動物園是萬態野生動物保護區的一部分。', 'The zoo is part of Mandai Wildlife Reserve.', 'https://www.mandai.com/en/tickets-and-passes/single-attractions.html', '2026-11-17', 'singapore-zoo.jpg', 'Dan arndt', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Entrance_-_Singapore_Zoo_(02).jpg', true),
  ('singapore', 5, '新加坡國家博物館一張外籍成人一般票要多少錢？', 'What is the price of one general admission ticket for a foreign adult at the National Museum of Singapore?', '新加坡國家博物館售票處，史丹福路，新加坡', 'National Museum of Singapore ticket office, Stamford Road, Singapore', null, 'S$', 20, 1.289, '博物館的常設展由新加坡國家博物館策劃。', 'The National Museum hosts permanent galleries about Singapore.', 'https://www.nhb.gov.sg/nationalmuseum/plan-your-visit/visitor-information/admissions', '2026-11-17', 'singapore-national-museum.jpg', 'Lucius Winslow', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:National_Museum_of_Singapore_-_1_December_2019_1500.jpg', true),
  ('singapore', 6, '新加坡土生文化館孔雀特展期間一張外籍成人全館票要多少錢？', 'What is the price of an all-access adult tourist ticket to Singapore’s Peranakan Museum during Peacock Power?', '土生文化館售票處，亞美尼亞街，新加坡', 'Peranakan Museum ticket office, Armenian Street, Singapore', 'kamcheng', 'S$', 18, 1.289, '土生文化館位在亞美尼亞街。', 'The museum is on Armenian Street.', 'https://www.nhb.gov.sg/peranakanmuseum/visit/plan-your-visit', '2026-11-17', 'singapore-peranakan-museum.jpg', 'Diego Delso', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Museo_Peranakan,_Singapur,_2023-08-18,_DD_07.jpg', true),
  ('singapore', 7, '新加坡一張一日遊客通行卡 Singapore Tourist Pass要多少錢？', 'What is the price of a one-day Singapore Tourist Pass?', '樟宜機場地鐵站第二航廈票務服務中心，樟宜，新加坡', 'SimplyGo ticket office, Changi Airport MRT Terminal 2, Changi', 'tram', 'S$', 17, 1.289, '遊客通行卡可用於指定公共交通。', 'The Tourist Pass covers eligible public transport.', 'https://thesingaporetouristpass.com.sg/faq/singapore-tourist-pass/', '2026-11-17', null, null, null, null, true),
  ('singapore', 8, '新加坡纜車 SkyPass 一張成人來回票的未折扣原價要多少錢？', 'What is the price of an adult return Singapore Cable Car SkyPass at regular price?', '新加坡纜車花柏山站售票處，花柏山，新加坡', 'Singapore Cable Car Mount Faber ticket office, Mount Faber', null, 'S$', 35, 1.289, 'SkyPass 涵蓋花柏山線和聖淘沙線。', 'The SkyPass covers both the Mount Faber and Sentosa lines.', 'https://mountfaberleisure.com/attraction/singapore-cable-car/', '2026-11-17', 'singapore-cable-car.jpg', 'kallerna', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Singapore_cable_car_Mount_Faber_1.jpg', true),
  ('singapore', 9, '新加坡摩天觀景輪一張標準成人票要多少錢？', 'What is the price of a standard adult ticket for the Singapore Flyer?', '新加坡摩天觀景輪售票處，濱海中心，新加坡', 'Singapore Flyer ticket office, Marina Centre, Singapore', null, 'S$', 46, 1.289, '觀景輪俯瞰濱海灣。', 'The observation wheel overlooks Marina Bay.', 'https://www.singaporeflyer.com/en', '2026-11-17', 'singapore-flyer.jpg', 'Deepak-nsk', 'CC0', 'https://commons.wikimedia.org/wiki/File:Singapore_Flyer_2024.jpg', true),
  ('singapore', 10, '新加坡國家美術館一張非新加坡籍成人一般票要多少錢？', 'What is the price of one standard general-admission ticket for a foreign adult at National Gallery Singapore?', '新加坡國家美術館售票處，市政區，新加坡', 'National Gallery Singapore ticket counter, Civic District', null, 'S$', 20, 1.289, '一般票可看美術館指定的展覽。', 'General admission covers selected exhibitions.', 'https://www.nationalgallery.sg/sg/en/visit/visitor-information.html', '2026-11-17', 'singapore-national-gallery.jpg', 'Basile Morin', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Interior_of_the_National_Gallery_Singapore.jpg', true),
  ('singapore', 11, '聖淘沙時光之翼煙火秀標準座位的一張未折扣原價票要多少錢？', 'What is the price of one standard-seat ticket to Sentosa’s Wings of Time fireworks show at its undiscounted price?', '時光之翼售票處，西樂索海灘，聖淘沙', 'Wings of Time ticket office, Siloso Beach, Sentosa, Singapore', null, 'S$', 22, 1.289, '標準座位區採用共用長椅。', 'The standard seating areas use shared benches.', 'https://mountfaberleisure.com/attraction/wings-of-time-fireworks-symphony', '2026-11-17', 'singapore-wings-of-time.jpg', 'ScribblingGeek', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Wings_of_Time_Fireworks_Symphony.jpg', true),
  ('singapore', 12, '聖淘沙馬來西亞美食街兩片斑蘭戚風蛋糕要多少錢？', 'What is the price of two slices of pandan chiffon cake at Malaysian Food Street, Sentosa?', '馬來西亞美食街，聖淘沙名勝世界，新加坡', 'Malaysian Food Street, Resorts World Sentosa, Singapore', 'cake-box', 'S$', 4, 1.289, '斑蘭是這款戚風蛋糕的風味來源。', 'Pandan gives this chiffon cake its flavour.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', 'singapore-pandan-chiffon.jpg', 'ProjectManhattan', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Pandan_Chiffon_Cake.jpg', true),
  ('singapore', 13, '遊客在一般日到新加坡河川生態園的一張成人門票要多少錢？', 'What is the price of an adult tourist ticket to River Wonders on a regular day?', '河川生態園售票處，萬態，新加坡', 'River Wonders ticket office, Mandai, Singapore', null, 'S$', 45, 1.289, '河川生態園以河流與淡水生物為主題。', 'River Wonders focuses on rivers and freshwater wildlife.', 'https://www.mandai.com/en/tickets-and-passes/single-attractions.html', '2026-11-17', 'singapore-river-wonders.jpg', 'Actuall7', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Giant_panda_Kai_Kai.jpg', true),
  ('singapore', 14, '新加坡摩天觀景輪一張成人新加坡司令體驗票要多少錢？', 'What is the price of one adult Singapore Sling Experience ticket for the Singapore Flyer?', '新加坡摩天觀景輪售票處，濱海中心，新加坡', 'Singapore Flyer ticket office, Marina Centre, Singapore', null, 'S$', 79, 1.289, '這個體驗把一杯新加坡司令和觀景輪行程配在一起。', 'The experience pairs a Singapore Sling with a ride on the wheel.', 'https://www.singaporeflyer.com/en', '2026-11-17', 'singapore-flyer.jpg', 'Deepak-nsk', 'CC0', 'https://commons.wikimedia.org/wiki/File:Singapore_Flyer_2024.jpg', true),
  ('singapore', 15, '聖淘沙馬來西亞美食街一杯熱拉茶要多少錢？', 'What is the price of a hot teh tarik at Malaysian Food Street, Sentosa?', '馬來西亞美食街，聖淘沙名勝世界，新加坡', 'Malaysian Food Street, Resorts World Sentosa, Singapore', null, 'S$', 3, 1.289, '拉茶靠在容器之間來回倒茶產生泡沫。', 'Teh tarik is poured between vessels to create froth.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', 'singapore-teh-tarik.jpg', 'Em from Emo City, Singapore', 'CC BY 2.0', 'https://commons.wikimedia.org/wiki/File:Teh_tarik.jpg', true),
  ('singapore', 16, '聖淘沙馬來西亞美食街一杯加冰的西瓜汁要多少錢？', 'What is the price of a watermelon juice with ice at Malaysian Food Street, Sentosa?', '馬來西亞美食街，聖淘沙名勝世界，新加坡', 'Malaysian Food Street, Resorts World Sentosa, Singapore', 'bottle', 'S$', 6, 1.289, '菜單把西瓜汁列在鮮榨果汁一欄。', 'The menu lists watermelon juice among the fresh juices.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', null, null, null, null, true),
  ('singapore', 17, '遊客在一般日到新加坡夜間野生動物園的一張成人門票要多少錢？', 'What is the price of an adult tourist ticket to Night Safari on a regular day?', '夜間野生動物園售票處，萬態，新加坡', 'Night Safari ticket office, Mandai, Singapore', null, 'S$', 58, 1.289, '夜間野生動物園在晚上迎接訪客。', 'Night Safari welcomes visitors after dark.', 'https://www.mandai.com/en/tickets-and-passes/single-attractions.html', '2026-11-17', 'singapore-night-safari.jpg', 'Orderinchaos', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Night_Safari_entrance_2016.jpg', true),
  ('singapore', 18, '聖淘沙馬來西亞美食街一杯荔枝爆爆珠冰飲要多少錢？', 'What is the price of a lychee popping-boba drink at Malaysian Food Street, Sentosa?', '馬來西亞美食街，聖淘沙名勝世界，新加坡', 'Malaysian Food Street, Resorts World Sentosa, Singapore', 'bubble-tea', 'S$', 6, 1.289, '這款冰飲加入會在嘴裡爆開的爆爆珠。', 'The drink contains popping boba that burst in your mouth.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', null, null, null, null, true),
  ('singapore', 19, '一杯美祿恐龍要多少錢？', 'What is the price of one Milo Dinosaur?', '馬來西亞美食街，聖淘沙名勝世界，新加坡', 'Malaysian Food Street, Resorts World Sentosa, Singapore', null, 'S$', 6, 1.289, '美祿恐龍是加上一層美祿粉的冰美祿。', 'A Milo Dinosaur is iced Milo topped with extra Milo powder.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', 'singapore-milo.jpg', 'Ominae', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:MD_take_out_in_Marina_Bay_Sands.jpg', true),
  ('singapore', 20, '一公斤貓山王榴槤的店家網上牌價要多少錢？', 'What is the price of a kilo of Mao Shan Wang durian at the shop’s listed online price?', 'Durian 36，芽籠路，新加坡', 'Durian 36, Geylang Road, Singapore', null, 'S$', 30, 1.289, 'Mao Shan Wang 是貓山王榴槤的另一種常用拼寫。', 'Mao Shan Wang is also known as Musang King.', 'https://www.durian36delivery.com.sg/', '2026-11-17', 'singapore-durian.jpg', 'Kyle Lam', 'CC BY-SA 2.0', 'https://commons.wikimedia.org/wiki/File:4SeasonsDurians22102009-02_(4034657521).jpg', true);
