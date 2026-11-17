-- Daily City Explorer puzzles. The catalog and plays are readable only through the RPCs.
create table public.city_puzzle_questions (
  id bigint generated always as identity primary key,
  city text not null,
  seq integer not null check (seq > 0),
  question_zh text not null,
  question_en text not null,
  vessel text not null references public.vessels(id),
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
  check (not published or (
    local_price is not null and usd_rate is not null and round(local_price / usd_rate, 2) > 0
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

-- Wave snapshots store the game_config row type. Preserve the snapshot values while
-- extending that type, then restore the typed column used by the spawn functions.
alter table private.game_spawn_revisions
  alter column config type jsonb using to_jsonb(config);

alter table private.game_config
  add column city_puzzle_win_wax integer not null default 3 check (city_puzzle_win_wax >= 0),
  add column city_puzzle_miss_wax integer not null default 1 check (city_puzzle_miss_wax >= 0);

alter table private.game_spawn_revisions
  alter column config type private.game_config using jsonb_populate_record(
    null::private.game_config,
    config || '{"city_puzzle_win_wax": 3, "city_puzzle_miss_wax": 1}'::jsonb
  );

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
    'vessel', p_question.vessel,
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
    select case when v_play.won then city_puzzle_win_wax else city_puzzle_miss_wax end
    into strict v_play.reward from private.game_config where singleton;
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

-- Verified seed questions. See docs/review/city-puzzle-questions.md for price and FX sources.
insert into public.city_puzzle_questions (
  city, seq, question_zh, question_en, vessel, currency, local_price, usd_rate,
  fact_zh, fact_en, source, checked_on, published
)
values
  ('taipei', 1, '在台北春水堂點一杯中杯珍珠奶茶要多少錢？', 'What is the price of one medium pearl milk tea at Chun Shui Tang in Taipei?', 'bubble-tea', 'NT$', 200, 32.98, '珍珠是在奶茶裡加的粉圓。', 'The pearls in the milk tea are chewy tapioca balls.', 'https://weknow.com.tw/2026/11/chun-shui-tang-price-increase-2026/', '2026-11-17', true),
  ('taipei', 2, '微熱山丘十入鳳梨酥要多少錢？', 'What is the price of a ten-piece box of SunnyHills pineapple cakes?', 'pineapple-cake', 'NT$', 550, 32.98, '這個禮盒裝了十個鳳梨酥。', 'This gift box contains ten pineapple cakes.', 'https://shop.sunnyhills.com.tw/index', '2026-11-17', true),
  ('taipei', 3, '鼎泰豐一顆招牌鮮肉小籠包（按單顆計價）要多少錢？', 'What is the price of one signature pork xiaolongbao at Din Tai Fung, at the per-piece price?', 'dim-sum-steamer', 'NT$', 29, 32.98, '小籠包的薄皮包住豬肉和湯汁。', 'A thin wrapper holds pork and broth inside a xiaolongbao.', 'https://focustaiwan.tw/business/202606180017', '2026-11-17', true),
  ('taipei', 4, '臺北市立動物園一張一般全票要多少錢？', 'What is the price of a regular Taipei Zoo admission ticket?', 'tin', 'NT$', 100, 32.98, '動物園位在文山區。', 'The zoo is in Wenshan District.', 'https://english.zoo.gov.taipei/cp.aspx?n=8ED5B9F3BA1D301D&s=0FDA15FCD803C117', '2026-11-17', true),
  ('taipei', 5, '貓空纜車一張普通單程票要多少錢？', 'What is the price of one regular single-journey ticket on the Maokong Gondola?', 'teapot', 'NT$', 180, 32.98, '纜車把動物園一帶和貓空連起來。', 'The gondola links the zoo area with Maokong.', 'https://english.gondola.taipei/cp.aspx?n=19884A72DB5E7A1D', '2026-11-17', true),
  ('taipei', 6, '臺北天文館展示場一張全票要多少錢？', 'What is the price of an adult ticket to Taipei Astronomical Museum’s exhibition hall?', 'rocket-tin', 'NT$', 40, 32.98, '天文館的展示場和劇場分開售票。', 'The museum sells exhibition and theatre tickets separately.', 'https://en.tam.gov.taipei/News_Content.aspx?n=32FD082B7F3FA5E5&s=D3869EA9A2AC6C8A', '2026-11-17', true),
  ('taipei', 7, '臺北捷運一張一般一日票要多少錢？', 'What is the price of a standard Taipei Metro one-day pass?', 'tram', 'NT$', 150, 32.98, '一日票啟用後可搭到當天營運結束。', 'Once activated, the pass lasts until the day’s service ends.', 'https://m.metro.taipei/en/ticketinfo.asp', '2026-11-17', true),
  ('taipei', 8, '臺北兒童新樂園搭一次摩天輪的設施票要多少錢？', 'What is the price of one Ferris wheel ride at Taipei Children’s Amusement Park?', 'hot-air-balloon', 'NT$', 30, 32.98, '摩天輪的設施票和入園門票分開。', 'The Ferris wheel ride is priced separately from admission.', 'https://english.tcap.taipei/cp.aspx?n=0EE6B89A9CF30056', '2026-11-17', true),
  ('taipei', 9, '台北101觀景台 89 樓一張成人全票要多少錢？', 'What is the price of a full-price adult ticket to Taipei 101’s 89th-floor observatory?', 'bamboo-tower', 'NT$', 600, 32.98, '室內觀景台在大樓第 89 層。', 'The indoor observatory is on the tower’s 89th floor.', 'https://101ob.welcometw.com/tour/Lyrg?lang=zh_TW', '2026-11-17', true),
  ('taipei', 10, '臺北故宮北院一張外籍成人一般票要多少錢？', 'What is the price of a standard ticket for a non-Taiwanese adult at the National Palace Museum’s Northern Branch?', 'palace-pavilion', 'NT$', 350, 32.98, '臺北故宮的收藏有青銅器、玉器和書畫。', 'The Taipei collection includes bronzes, jades, paintings and calligraphy.', 'https://south.npm.gov.tw/Uploads/files/A%20True%20Taiwanese%20Welcome%20E-guidebook.pdf', '2026-11-17', true),
  ('taipei', 11, '台北當代藝術館一張一般門票要多少錢？', 'What is the price of a general admission ticket to the Museum of Contemporary Art Taipei?', 'instant-camera', 'NT$', 100, 32.98, '當代館每週一休館。', 'MOCA Taipei closes on Mondays.', 'https://www.moca.taipei/en/Visit/Hours%20%26%20Admissions', '2026-11-17', true),
  ('taipei', 12, '在臺北租 YouBike 2.0E 電輔車前半小時要多少錢？', 'What is the price of the first half-hour on a Taipei YouBike 2.0E electric-assist bike?', 'pedicab', 'NT$', 20, 32.98, '電輔車的前兩小時按半小時收費。', 'For the first two hours, the e-bike is charged in half-hour blocks.', 'https://en.youbike.com.tw/region/taipei/rate/', '2026-11-17', true),
  ('taipei', 13, '台灣高鐵從台北到桃園一張標準車廂對號全票要多少錢？', 'What is the price of one full-fare reserved standard-class high-speed rail ticket from Taipei to Taoyuan?', 'tram', 'NT$', 160, 32.98, '往桃園方向的列車在台北之後還會經過板橋。', 'A train heading from Taipei towards Taoyuan passes through Banqiao.', 'https://en.thsrc.com.tw/ArticleContent/4c3efc1d-e6df-4bfd-97b4-52e89f79ee5c', '2026-11-17', true),
  ('taipei', 14, '在台北春水堂點一碗御品牛肉麵要多少錢？', 'What is the price of one bowl of Chun Shui Tang’s signature beef noodles in Taipei?', 'ramen', 'NT$', 315, 32.98, '除了茶飲，春水堂的菜單上也有牛肉麵。', 'Chun Shui Tang serves beef noodles alongside its tea drinks.', 'https://weknow.com.tw/2026/11/chun-shui-tang-price-increase-2026/', '2026-11-17', true),
  ('taipei', 15, '從台北寄一封不超過 20 公克的國內普通信件的郵資要多少錢？', 'What is the price of postage to send a regular domestic letter of up to 20 grams from Taipei?', 'envelope', 'NT$', 8, 32.98, '普通信件的第一個重量級距是 20 公克。', 'The first weight band for an ordinary letter is up to 20 grams.', 'https://www.post.gov.tw/post/internet/U_english2/index.jsp?ID=35140401', '2026-11-17', true),
  ('taipei', 16, '臺北戲棚一般晚場演出的一張全票要多少錢？', 'What is the price of a full-price ticket for a regular evening show at TaipeiEYE?', 'musicbox', 'NT$', 800, 32.98, '臺北戲棚的演出採自由入座。', 'TaipeiEYE’s shows use open seating.', 'https://www.taipeieye.com/en/Order?month=9&programId=39&scheduleId=10355&year=2026', '2026-11-17', true),
  ('taipei', 17, '微熱山丘六瓶裝鳳梨汁要多少錢？', 'What is the price of a six-bottle pack of SunnyHills pineapple juice?', 'bottle', 'NT$', 300, 32.98, '鳳梨也被做成瓶裝果汁。', 'Pineapple is also sold as bottled juice.', 'https://shop.sunnyhills.com.tw/index', '2026-11-17', true),
  ('taipei', 18, '鼎泰豐一份蝦仁蛋炒飯要多少錢？', 'What is the price of a serving of Din Tai Fung shrimp and egg fried rice?', 'bento', 'NT$', 320, 32.98, '這款炒飯把蝦仁和雞蛋一起炒香。', 'This fried rice pairs shrimp with egg.', 'https://focustaiwan.tw/business/202606180017', '2026-11-17', true),
  ('taipei', 19, '臺北市立動物園遊客列車一張票要多少錢？', 'What is the price of a ticket for the Taipei Zoo shuttle train?', 'tram', 'NT$', 5, 32.98, '園內的遊客列車另外收費。', 'The zoo charges separately for its shuttle train.', 'https://english.zoo.gov.taipei/cp.aspx?n=8ED5B9F3BA1D301D&s=0FDA15FCD803C117', '2026-11-17', true),
  ('taipei', 20, '貓空纜車一張一般一日票要多少錢？', 'What is the price of one regular Maokong Gondola one-day pass?', 'hot-air-balloon', 'NT$', 300, 32.98, '一日票當天可不限次數搭乘纜車。', 'The day pass covers unlimited gondola rides that day.', 'https://english.gondola.taipei/cp.aspx?n=19884A72DB5E7A1D', '2026-11-17', true),
  ('taipei', 21, '臺北天文館宇宙探險一張全票要多少錢？', 'What is the price of a regular Cosmic Adventure ticket at Taipei Astronomical Museum?', 'escape-pod', 'NT$', 70, 32.98, '宇宙探險是天文館裡的獨立設施。', 'Cosmic Adventure is a separate attraction inside the museum.', 'https://en.tam.gov.taipei/News_Content.aspx?n=32FD082B7F3FA5E5&s=D3869EA9A2AC6C8A', '2026-11-17', true),
  ('taipei', 22, '臺北捷運一張 48 小時票要多少錢？', 'What is the price of a 48-hour Taipei Metro pass?', 'clock-tower', 'NT$', 280, 32.98, '48 小時從刷卡進站啟用時開始算。', 'The 48 hours start when the pass is activated at a fare gate.', 'https://m.metro.taipei/en/ticketinfo.asp', '2026-11-17', true),
  ('taipei', 23, '臺北兒童新樂園玩一次K3 水世界的設施票要多少錢？', 'What is the price of one ride on K3 Aqua Planet at Taipei Children’s Amusement Park?', 'snow-globe', 'NT$', 50, 32.98, '園方把這項設施編為 K3。', 'The park lists this attraction under ride number K3.', 'https://english.tcap.taipei/cp.aspx?n=0EE6B89A9CF30056', '2026-11-17', true),
  ('taipei', 24, '從台北寄一封不超過 20 公克的國內普通掛號信的郵資要多少錢？', 'What is the price of postage to send a domestic registered letter of up to 20 grams from Taipei?', 'postbox', 'NT$', 28, 32.98, '中華郵政在同一張資費表上列普通和掛號信件。', 'Chunghwa Post lists regular and registered mail on the same rate table.', 'https://www.post.gov.tw/post/internet/U_english2/index.jsp?ID=35140401', '2026-11-17', true),
  ('taipei', 25, '微熱山丘六入蘋果酥要多少錢？', 'What is the price of a six-piece box of SunnyHills apple cakes?', 'cake-box', 'NT$', 405, 32.98, '微熱山丘的水果酥也有蘋果口味。', 'SunnyHills also makes a fruit pastry with apple filling.', 'https://shop.sunnyhills.com.tw/index', '2026-11-17', true),
  ('taipei', 26, '鼎泰豐一份蝦肉紅油抄手要多少錢？', 'What is the price of a serving of Din Tai Fung spicy shrimp and pork wontons?', 'dim-sum-steamer', 'NT$', 240, 32.98, '這道抄手用蝦和豬肉做餡，拌上辣油。', 'These wontons combine shrimp and pork with chilli oil.', 'https://focustaiwan.tw/business/202606180017', '2026-11-17', true),
  ('taipei', 27, '臺北市立動物園教育中心一張門票要多少錢？', 'What is the price of admission to Taipei Zoo’s Education Center?', 'spellbook', 'NT$', 20, 32.98, '教育中心是園內的一處室內場館。', 'The Education Center is an indoor venue inside the zoo.', 'https://english.zoo.gov.taipei/cp.aspx?n=8ED5B9F3BA1D301D&s=0FDA15FCD803C117', '2026-11-17', true),
  ('taipei', 28, '含台北101與故宮門票的經典版台北旅遊卡要多少錢？', 'What is the price of a classic Taipei joint ticket with Taipei 101 and Palace Museum admissions?', 'bamboo-tower', 'NT$', 950, 32.98, '這張票組合了台北101觀景台和故宮北院。', 'The ticket brings together Taipei 101 Observatory and the Palace Museum’s Northern Branch.', 'https://m.metro.taipei/en/ticketinfo.asp', '2026-11-17', true),
  ('hongkong', 1, '香港海景嘉福洲際酒店 Café on M 一個菠蘿油的餐牌價要多少錢？', 'What is the price of one buttered pineapple bun at Café on M at the InterContinental Grand Stanford Hong Kong, at menu price?', 'bolo-bun', 'HK$', 38, 7.846, '菠蘿油是把牛油夾進菠蘿包裡。', 'A buttered pineapple bun has a slice of butter inside.', 'https://www.hongkong.intercontinental.com/wp-content/uploads/sites/33/2025/09/cha_chaan_teng_menu.pdf', '2026-11-17', true),
  ('hongkong', 2, '香港電車（叮叮）一程成人車資要多少錢？', 'What is the price of an adult ride on Hong Kong’s Ding Ding tram?', 'tram', 'HK$', 3.30, 7.846, '叮叮是香港電車的暱稱。', 'Ding Ding is the nickname of Hong Kong’s trams.', 'https://www.hktramways.com/en/schedules-fares', '2026-11-17', true),
  ('hongkong', 3, '平日搭天星小輪由灣仔往尖沙咀一張成人船票（公眾假期除外）要多少錢？', 'What is the price of one adult Star Ferry crossing from Wan Chai to Tsim Sha Tsui on a weekday outside public holidays?', 'bottle', 'HK$', 5, 7.846, '灣仔航線把港島和九龍連起來。', 'The Wan Chai route links Hong Kong Island and Kowloon.', 'https://www.starferry.com.hk/en/service', '2026-11-17', true),
  ('hongkong', 4, '用八達通搭機場快綫從香港站到機場的成人單程車資要多少錢？', 'What is the price of an adult Airport Express ride from Hong Kong Station to the airport using Octopus?', 'suitcase', 'HK$', 120, 7.846, '香港站是機場快綫在港島的車站。', 'Hong Kong Station is the Airport Express stop on Hong Kong Island.', 'https://www.mtr.com.hk/digitalleaflet/en/detail.html?article=airport-express-service-guide', '2026-11-17', true),
  ('hongkong', 5, '昂坪360標準車廂一張成人來回票要多少錢？', 'What is the price of an adult round trip in an Ngong Ping 360 standard cabin?', 'hot-air-balloon', 'HK$', 295, 7.846, '纜車來往東涌和昂坪。', 'The cable car links Tung Chung and Ngong Ping.', 'https://www.np360.com.hk/en/tickets-promotions/tickets-tours/cable-car-tickets', '2026-11-17', true),
  ('hongkong', 6, '昂坪360標準車廂一張成人單程票要多少錢？', 'What is the price of one adult single trip in an Ngong Ping 360 standard cabin?', 'hot-air-balloon', 'HK$', 205, 7.846, '單程票可從東涌或昂坪出發。', 'A single trip can start at either Tung Chung or Ngong Ping.', 'https://www.np360.com.hk/media/s3wo0t3n/immediate-release-ngong-ping-360-announces-new-ticket-prices.pdf', '2026-11-17', true),
  ('hongkong', 7, '香港故宮文化博物館一張成人定時段標準門票要多少錢？', 'What is the price of a timed adult general-admission ticket to the Hong Kong Palace Museum?', 'palace-pavilion', 'HK$', 70, 7.846, '一般門票涵蓋第 1 至第 7 展廳。', 'General admission covers galleries 1 to 7.', 'https://www.hkpm.org.hk/en/visit/ticket', '2026-11-17', true),
  ('hongkong', 8, 'M+ 博物館一張正價門票要多少錢？', 'What is the price of a standard admission ticket to the M+ museum?', 'instant-camera', 'HK$', 190, 7.846, 'M+ 位於西九文化區。', 'M+ is in the West Kowloon Cultural District.', 'https://www.mplus.org.hk/en/admission-tickets/', '2026-11-17', true),
  ('hongkong', 9, '灣仔金輝點心一籠蝦餃要多少錢？', 'What is the price of a basket of har gow at Kam Fai Dim Sum in Wan Chai?', 'dim-sum-steamer', 'HK$', 30, 7.846, '蝦餃以薄薄的半透明外皮包住鮮蝦。', 'Har gow wrap shrimp in thin, translucent skins.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', true),
  ('hongkong', 10, '香港海景嘉福洲際酒店 Café on M 兩件港式酥皮蛋撻的餐牌價要多少錢？', 'What is the price of two Hong Kong-style egg tarts at Café on M at the InterContinental Grand Stanford Hong Kong, at menu price?', 'egg-tart', 'HK$', 28, 7.846, '店家用酥皮包住蛋奶餡。', 'The café makes these custard tarts with puff pastry.', 'https://www.hongkong.intercontinental.com/wp-content/uploads/sites/33/2025/09/cha_chaan_teng_menu.pdf', '2026-11-17', true),
  ('hongkong', 11, '在香港寄一封不超過 30 克的本地小型信件的郵資要多少錢？', 'What is the price of postage for one local small letter up to 30 grams in Hong Kong?', 'envelope', 'HK$', 2.4, 7.846, '香港郵政稱小型信件為 P 類。', 'Hongkong Post labels small letters as format P.', 'https://gia.info.gov.hk/general/202603/23/P2026032300246_536830_1_1774236463607.pdf', '2026-11-17', true),
  ('hongkong', 12, '在一般收費日參觀香港科學館常設展的一張標準票要多少錢？', 'What is the price of a standard ticket to the Hong Kong Science Museum’s permanent exhibitions on a regular paid day?', 'rocket-tin', 'HK$', 20, 7.846, '科學館常設展星期三免費。', 'The permanent exhibitions are free on Wednesdays.', 'https://hk.science.museum/tc/web/scm/visit.html', '2026-11-17', true),
  ('hongkong', 13, '香港太空館天象廳一張成人後座門票要多少錢？', 'What is the price of one adult stalls ticket to a show at the Hong Kong Space Museum’s Space Theatre?', 'dome', 'HK$', 40, 7.846, '天象廳會放映立體球幕電影。', 'The Space Theatre screens 3D dome shows.', 'https://hk.space.museum/en/web/spm/shows.html', '2026-11-17', true),
  ('hongkong', 14, '香港電車一張月票要多少錢？', 'What is the price of a Hong Kong Tramways monthly ticket?', 'clock-tower', 'HK$', 260, 7.846, '常搭叮叮的乘客可以買月票。', 'Frequent tram riders can buy a monthly ticket.', 'https://www.hktramways.com/en/schedules-fares', '2026-11-17', true),
  ('hongkong', 15, '天星小輪一張四天旅遊票要多少錢？', 'What is the price of a Star Ferry four-day tourist pass?', 'bottle', 'HK$', 50, 7.846, '四天旅遊票涵蓋中環和灣仔兩條航線。', 'The four-day pass covers both the Central and Wan Chai routes.', 'https://www.starferry.com.hk/en/service', '2026-11-17', true),
  ('hongkong', 16, '從九龍站搭機場快綫到機場一張成人單程實體票要多少錢？', 'What is the price of one adult single-journey Airport Express Smart Ticket from Kowloon to the airport?', 'paper-plane', 'HK$', 115, 7.846, '機場快綫提供單程實體票。', 'The Airport Express sells physical single-journey Smart Tickets.', 'https://www.mtr.com.hk/digitalleaflet/en/detail.html?article=airport-express-service-guide', '2026-11-17', true),
  ('hongkong', 17, '昂坪360全景纜車 Crystal+ 一張成人來回票要多少錢？', 'What is the price of one adult Ngong Ping 360 Crystal+ round trip?', 'crystal-ball', 'HK$', 545, 7.846, '昂坪纜車單程約 25 分鐘。', 'An Ngong Ping cable car ride takes about 25 minutes each way.', 'https://www.np360.com.hk/en/tickets-promotions/tickets-tours/cable-car-tickets', '2026-11-17', true),
  ('hongkong', 18, '香港故宮文化博物館一張成人一般彈性門票要多少錢？', 'What is the price of an adult general-admission flex ticket to the Hong Kong Palace Museum?', 'spellbook', 'HK$', 90, 7.846, '彈性票可在指定月份內入場一次。', 'A flex ticket is good for one entry in the specified month.', 'https://www.hkpm.org.hk/en/visit/ticket', '2026-11-17', true),
  ('hongkong', 19, '灣仔金輝點心一籠燒賣要多少錢？', 'What is the price of a basket of siu mai at Kam Fai Dim Sum in Wan Chai?', 'dim-sum-steamer', 'HK$', 25, 7.846, '港式燒賣的頂部不封口。', 'Cantonese siu mai are steamed with the top left open.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', true),
  ('hongkong', 20, '香港海景嘉福洲際酒店 Café on M 一杯熱港式奶茶的餐牌價要多少錢？', 'What is the price of one hot Hong Kong-style milk tea at Café on M at the InterContinental Grand Stanford Hong Kong, at menu price?', 'bubble-tea', 'HK$', 38, 7.846, '這家店的茶餐廳餐牌把奶茶分為冷熱。', 'The cha chaan teng menu offers milk tea hot or iced.', 'https://www.hongkong.intercontinental.com/wp-content/uploads/sites/33/2025/09/cha_chaan_teng_menu.pdf', '2026-11-17', true),
  ('hongkong', 21, '在香港寄一封不超過 50 克的本地大型信件的郵資要多少錢？', 'What is the price of postage for one local large letter up to 50 grams in Hong Kong?', 'postbox', 'HK$', 4.3, 7.846, '大型信件的起始重量級距是 50 克。', 'The first weight band for large letters goes up to 50 grams.', 'https://gia.info.gov.hk/general/202603/23/P2026032300246_536830_1_1774236463607.pdf', '2026-11-17', true),
  ('hongkong', 22, '用八達通搭機場快綫從機場到博覽館站的成人單程車資要多少錢？', 'What is the price of an adult Octopus fare from Airport to AsiaWorld-Expo on the Airport Express?', 'tram', 'HK$', 6.5, 7.846, '博覽館站在機場站的下一站。', 'AsiaWorld-Expo is the next stop beyond Airport Station.', 'https://www.mtr.com.hk/digitalleaflet/en/detail.html?article=airport-express-service-guide', '2026-11-17', true),
  ('hongkong', 23, '灣仔金輝點心一份香菇滑雞煲仔飯要多少錢？', 'What is the price of a chicken and mushroom claypot rice at Kam Fai Dim Sum in Wan Chai?', 'bento', 'HK$', 37, 7.846, '雞肉和香菇在瓦煲裡跟飯一起上桌。', 'The chicken, mushrooms and rice are served together in the clay pot.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', true),
  ('hongkong', 24, '香港海景嘉福洲際酒店 Café on M 一份港式西多士的餐牌價要多少錢？', 'What is the price of one Hong Kong-style French toast at Café on M at the InterContinental Grand Stanford Hong Kong, at menu price?', 'cake-box', 'HK$', 48, 7.846, '店家的西多士用花生醬夾心，配糖漿和牛油。', 'This French toast has a peanut-butter filling and comes with syrup and butter.', 'https://www.hongkong.intercontinental.com/wp-content/uploads/sites/33/2025/09/cha_chaan_teng_menu.pdf', '2026-11-17', true),
  ('hongkong', 25, '灣仔金輝點心一份馬拉糕要多少錢？', 'What is the price of a serving of steamed ma lai go at Kam Fai Dim Sum in Wan Chai?', 'cake-box', 'HK$', 23, 7.846, '馬拉糕蒸好後，剖面有細小氣孔。', 'Steamed ma lai go has small air pockets throughout its crumb.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', true),
  ('hongkong', 26, '灣仔金輝點心一份鮮蝦腸粉要多少錢？', 'What is the price of one order of whole-shrimp rice rolls at Kam Fai Dim Sum in Wan Chai?', 'dim-sum-steamer', 'HK$', 31, 7.846, '鮮蝦腸粉用米漿蒸成薄皮裹蝦。', 'Thin sheets made from steamed rice batter are wrapped around shrimp.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', true),
  ('hongkong', 27, '灣仔金輝點心一份牛肉丸要多少錢？', 'What is the price of one order of beef balls at Kam Fai Dim Sum in Wan Chai?', 'dim-sum-steamer', 'HK$', 22, 7.846, '店家的牛肉丸帶有陳皮香。', 'The shop’s beef balls are scented with dried tangerine peel.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', true),
  ('hongkong', 28, '灣仔金輝點心一份黑芝麻蓉包要多少錢？', 'What is the price of one order of black sesame buns at Kam Fai Dim Sum in Wan Chai?', 'dim-sum-steamer', 'HK$', 21, 7.846, '包子蒸好後，內餡有濃郁的黑芝麻香氣。', 'The steamed buns have a fragrant black sesame filling.', 'https://kamfaidimsum.com/en/menu.html', '2026-11-17', true),
  ('macau', 1, '路環安德魯咖啡店一個葡式蛋撻（未計服務費）要多少錢？', 'What is the price of one Portuguese egg tart at Lord Stow’s Café in Coloane, before service charge?', 'egg-tart', 'MOP', 11, 8.08138, '安德魯的葡撻會烤到表面帶焦糖色。', 'Lord Stow’s egg tarts have a caramelised top.', 'https://www.lordstow.com/wp-content/uploads/2015/09/lord-stows-cafe-menu-8thJan2024.pdf', '2026-11-17', true),
  ('macau', 2, '路環安德魯咖啡店一份原味芝士餅（未計服務費）要多少錢？', 'What is the price of a plain chilled cheesecake at Lord Stow’s Café in Coloane, before service charge?', 'cake-box', 'MOP', 32, 8.08138, '店家的原味芝士餅是冷藏甜點。', 'The café serves its plain cheesecake chilled.', 'https://www.lordstow.com/wp-content/uploads/2015/09/lord-stows-cafe-menu-8thJan2024.pdf', '2026-11-17', true),
  ('macau', 3, '澳門大賽車博物館一張成人正價票要多少錢？', 'What is the price of a full-price adult ticket to the Macao Grand Prix Museum?', 'arcade', 'MOP', 80, 8.08138, '大賽車博物館以澳門的賽車活動為主題。', 'The museum is devoted to Macao’s motor-racing event.', 'https://www.museums.gov.mo/eng/museums.html', '2026-11-17', true),
  ('macau', 4, '澳門輕軌三站或以下一張成人單程票要多少錢？', 'What is the price of one adult single-journey Macao LRT ticket for three stops or fewer?', 'tram', 'MOP', 6, 8.08138, '輕軌單程票是一枚代幣。', 'A single-journey LRT ticket takes the form of a token.', 'https://www.mlm.com.mo/en/general_ticket.html', '2026-11-17', true),
  ('macau', 5, '澳門松山纜車一張普通來回票要多少錢？', 'What is the price of a standard return ticket on Macao’s Guia cable car?', 'hot-air-balloon', 'MOP', 3, 8.08138, '纜車入口位於二龍喉公園。', 'The cable car starts at Flora Garden.', 'https://www.macaotourism.gov.mo/en/shows-and-entertainment/family-fun/cable-car', '2026-11-17', true),
  ('macau', 6, '在澳門搭一般巴士一程的現金車資要多少錢？', 'What is the price of the cash fare for one ride on a normal Macao bus route?', 'pedicab', 'MOP', 6, 8.08138, '用儲值卡搭一般巴士有車資優惠。', 'Stored-value cards receive a lower normal-route bus fare.', 'https://www.cdqq.gov.mo/en/home-coming/living/transportation/', '2026-11-17', true),
  ('macau', 7, '一張包含初始儲值額的一般銷售版澳門通要多少錢？', 'What is the price of a standard retail Macau Pass with its initial stored balance?', 'rwb-bag', 'MOP', 130, 8.08138, '澳門通可用來搭巴士和在部分商戶付款。', 'Macau Pass works on buses and at participating shops.', 'https://macaupass.com/cardfaqs', '2026-11-17', true),
  ('macau', 8, '澳門旅遊塔一張包含手扇的成人標準觀光票要多少錢？', 'What is the price of an adult Macau Tower observation ticket that includes a hand fan?', 'golden-roof', 'MOP', 208, 8.08138, '旅遊塔的觀光票可進入觀光層。', 'The tower ticket includes admission to its observation decks.', 'https://www.macautower.com.mo/en/entertainment/observation-deck/', '2026-11-17', true),
  ('macau', 9, '澳門 teamLab 超自然空間一張 13 歲或以上標準門票要多少錢？', 'What is the price of standard admission to teamLab SuperNature Macao for someone aged 13 or over?', 'potion', 'MOP', 288, 8.08138, '展場以互動式數碼藝術為主。', 'The exhibition features interactive digital art.', 'https://www.macaotourism.gov.mo/en/sightseeing/museums-and-galleries/teamlab-supernature-macao', '2026-11-17', true),
  ('macau', 10, '澳門君悅酒店大堂酒廊一個可麗露（未計政府稅）要多少錢？', 'What is the price of one canelé at the Grand Hyatt Macau Lobby Lounge, before tax?', 'cake-box', 'MOP', 25, 8.08138, '可麗露是用模具烤出凹凸外形的小糕點。', 'A canelé gets its fluted shape from a mould.', 'https://www.hyatt.com/content/dam/hotel/propertysites/assets/grand/macgh/documents/en_US/dining/lobby-lounge/Lobby-Lounge-Cake-Menu.pdf', '2026-11-17', true),
  ('macau', 11, '澳門銀河氹仔漁村一份漁村富貴蝦餃皇（未計服務費）要多少錢？', 'What is the price of one serving of steamed mantis-shrimp dumplings at The Cantonese restaurant, Galaxy Macau, before service charge?', 'dim-sum-steamer', 'MOP', 88, 8.08138, '這款蝦餃用瀨尿蝦做餡。', 'These dumplings are made with mantis shrimp.', 'https://img.galaxymacau.com/2026-02/TCYC-%20Interactive%20Menu-%20ALC_Dimsum_Seasonal_0206.pdf', '2026-11-17', true),
  ('macau', 12, '在澳門寄一封不超過 20 克的本地普通信件的郵資要多少錢？', 'What is the price of postage for a local letter of up to 20 grams in Macao?', 'envelope', 'MOP', 2.5, 8.08138, '澳門郵政按重量為本地普通信件計費。', 'Macao Post charges for local letters by weight.', 'https://www.ctt.gov.mo/macaupost/Contents/CorresPostage.aspx?lang=en-us', '2026-11-17', true),
  ('macau', 13, '路環安德魯咖啡店一份伯爵茶卷（未計服務費）要多少錢？', 'What is the price of an Earl Grey roll at Lord Stow’s Café in Coloane, before service charge?', 'teapot', 'MOP', 24, 8.08138, '伯爵茶也可以用來做蛋糕卷。', 'Earl Grey is used as a flavour in this cake roll.', 'https://www.lordstow.com/wp-content/uploads/2015/09/lord-stows-cafe-menu-8thJan2024.pdf', '2026-11-17', true),
  ('macau', 14, '非澳門居民在一般收費日參觀澳門博物館的一張成人票要多少錢？', 'What is the price of a non-resident adult ticket to the Macao Museum on a regular paid day?', 'senado-fountain', 'MOP', 15, 8.08138, '澳門博物館位於大炮台。', 'The Macao Museum is at Mount Fortress.', 'https://www.museums.gov.mo/eng/museums.html', '2026-11-17', true),
  ('macau', 15, '澳門輕軌七至九站一張成人單程票要多少錢？', 'What is the price of one adult single-journey Macao LRT ticket for seven to nine fare-counted stops?', 'tram', 'MOP', 10, 8.08138, '媽閣到海洋的跨海路段計作兩站。', 'The Barra–Ocean sea crossing counts as two stops for fares.', 'https://www.mlm.com.mo/en/general_ticket.html', '2026-11-17', true),
  ('macau', 16, '在澳門搭松山纜車的一張普通單程票要多少錢？', 'What is the price of a standard one-way ticket on Macao’s Guia cable car?', 'hot-air-balloon', 'MOP', 2, 8.08138, '從纜車上可以俯瞰松山一帶。', 'The cable car gives riders a view over Guia Hill.', 'https://www.macaotourism.gov.mo/en/shows-and-entertainment/family-fun/cable-car', '2026-11-17', true),
  ('macau', 17, '用一般儲值卡搭澳門快速巴士一程的車資要多少錢？', 'What is the price of one express-bus ride in Macao with a standard stored-value card?', 'tram', 'MOP', 4, 8.08138, '快速巴士與普通路線有不同的儲值卡票價。', 'Express buses and normal routes have different stored-value card fares.', 'https://www.cdqq.gov.mo/en/home-coming/living/transportation/', '2026-11-17', true),
  ('macau', 18, '一張包含初始儲值額的世遺景點版澳門通要多少錢？', 'What is the price of a World Heritage edition Macau Pass with its initial balance?', 'senado-fountain', 'MOP', 80, 8.08138, '世遺版澳門通可在指定售卡機購買。', 'The World Heritage edition is available from selected card vending machines.', 'https://macaupass.com/cardfaqs', '2026-11-17', true),
  ('macau', 19, '澳門君悅酒店大堂酒廊一磅陳皮里斯本朱古力蛋糕（未計政府稅）要多少錢？', 'What is the price of a one-pound Lisbon chocolate torte at the Grand Hyatt Macau Lobby Lounge, before tax?', 'chocolate-heart', 'MOP', 228, 8.08138, '這款朱古力蛋糕加了陳皮。', 'Dried tangerine peel flavours this chocolate torte.', 'https://www.hyatt.com/content/dam/hotel/propertysites/assets/grand/macgh/documents/en_US/dining/lobby-lounge/Lobby-Lounge-Cake-Menu.pdf', '2026-11-17', true),
  ('macau', 20, '澳門銀河氹仔漁村一份豬潤燒賣（未計服務費）要多少錢？', 'What is the price of one serving of pork-liver siu mai at The Cantonese restaurant, Galaxy Macau, before service charge?', 'dim-sum-steamer', 'MOP', 58, 8.08138, '這款燒賣在肉餡上放豬肝。', 'These siu mai are topped with pork liver.', 'https://img.galaxymacau.com/2026-02/TCYC-%20Interactive%20Menu-%20ALC_Dimsum_Seasonal_0206.pdf', '2026-11-17', true),
  ('macau', 21, '從澳門寄一封不超過 20 克的水陸路信件到香港的郵資要多少錢？', 'What is the price of surface postage from Macao to Hong Kong for a letter of up to 20 grams?', 'postbox', 'MOP', 4, 8.08138, '澳門郵政把香港列在同一水陸路郵件級距。', 'Hong Kong is listed in the regional surface-mail rate table.', 'https://www.ctt.gov.mo/macaupost/Contents/CorresPostage.aspx?lang=en-us', '2026-11-17', true),
  ('macau', 22, '澳門林則徐紀念館一張成人正價票要多少錢？', 'What is the price of a full-price adult ticket to the Lin Zexu Memorial Museum of Macao?', 'spellbook', 'MOP', 5, 8.08138, '紀念館就在蓮峰廟旁。', 'The museum is near Lin Fung Temple.', 'https://www.museums.gov.mo/eng/museums.html', '2026-11-17', true),
  ('macau', 23, '澳門輕軌四至六站一張成人單程票要多少錢？', 'What is the price of one adult single-journey Macao LRT ticket for four to six fare-counted stops?', 'tram', 'MOP', 8, 8.08138, '乘客可在輕軌站的售票機買單程票。', 'Single tickets are sold at machines in LRT stations.', 'https://www.mlm.com.mo/en/general_ticket.html', '2026-11-17', true),
  ('macau', 24, '澳門通「遊澳通通行」雙卡套裝一套要多少錢？', 'What is the price of one Macau Pass tourist two-card bundle?', 'suitcase', 'MOP', 185, 8.08138, '雙卡套裝包含交通儲值卡和電訊預付卡。', 'The bundle includes a stored-value transit card and a prepaid telecom card.', 'https://macaupass.com/cardfaqs', '2026-11-17', true),
  ('macau', 25, '澳門銀河氹仔漁村一份脆皮白糖糕（未計服務費）要多少錢？', 'What is the price of one serving of pan-fried sweet rice cake at The Cantonese restaurant, Galaxy Macau, before service charge?', 'rice-dumpling', 'MOP', 58, 8.08138, '這個做法把甜米糕煎出脆皮。', 'Pan-frying gives this sweet rice cake a crisp edge.', 'https://img.galaxymacau.com/2026-02/TCYC-%20Interactive%20Menu-%20ALC_Dimsum_Seasonal_0206.pdf', '2026-11-17', true),
  ('macau', 26, '澳門仁慈堂博物館一張成人正價門票要多少錢？', 'What is the price of a standard adult ticket to Macao’s Museum of the Holy House of Mercy?', 'senado-fountain', 'MOP', 5, 8.08138, '博物館入口在仁慈堂右巷二號。', 'The entrance is at 2 Travessa da Misericórdia.', 'https://www.museums.gov.mo/eng/museums.html', '2026-11-17', true),
  ('macau', 27, '澳門銀河氹仔漁村一份椰香芝麻布丁（未計服務費）要多少錢？', 'What is the price of one serving of black sesame and coconut pudding at The Cantonese restaurant, Galaxy Macau, before service charge?', 'potion', 'MOP', 38, 8.08138, '黑芝麻和椰子是這款布丁的兩種風味。', 'Black sesame and coconut give the pudding its two flavours.', 'https://img.galaxymacau.com/2026-02/TCYC-%20Interactive%20Menu-%20ALC_Dimsum_Seasonal_0206.pdf', '2026-11-17', true),
  ('macau', 28, '澳門銀河氹仔漁村一位楊枝甘露（未計服務費）要多少錢？', 'What is the price of one portion of chilled mango sago at The Cantonese restaurant, Galaxy Macau, before service charge?', 'potion', 'MOP', 58, 8.08138, '這款甜品以芒果、西米和柚子搭配。', 'This chilled dessert combines mango, sago and pomelo.', 'https://img.galaxymacau.com/2026-02/TCYC-%20Interactive%20Menu-%20ALC_Dimsum_Seasonal_0206.pdf', '2026-11-17', true),
  ('singapore', 1, '聖淘沙馬來西亞美食街一份咖椰牛油吐司早餐套餐要多少錢？', 'What is the price of one kaya-butter toast breakfast set at Malaysian Food Street, Sentosa?', 'bolo-bun', 'S$', 7, 1.289, '這份早餐搭配半熟蛋和一杯熱飲。', 'The set pairs the toast with soft-boiled eggs and a hot drink.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', true),
  ('singapore', 2, '聖淘沙馬來西亞美食街兩片印度煎餅配扁豆咖哩要多少錢？', 'What is the price of two roti canai with dhal curry at Malaysian Food Street, Sentosa?', 'bento', 'S$', 5, 1.289, '這份煎餅可以沾扁豆咖哩吃。', 'The flatbread is served with dhal for dipping.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', true),
  ('singapore', 3, '新加坡國家胡姬花園一張非居民成人標準票要多少錢？', 'What is the price of a standard non-resident adult ticket to Singapore’s National Orchid Garden?', 'orchid', 'S$', 15, 1.289, '花園的四個區域以四季為設計主題。', 'The garden’s four sections are themed around the seasons.', 'https://sbg.nparks.gov.sg/attractions/national-orchid-garden/', '2026-11-17', true),
  ('singapore', 4, '遊客在一般日到新加坡動物園的一張成人門票要多少錢？', 'What is the price of an adult tourist ticket to Singapore Zoo on a regular day?', 'dome', 'S$', 49, 1.289, '動物園是萬態野生動物保護區的一部分。', 'The zoo is part of Mandai Wildlife Reserve.', 'https://www.mandai.com/en/tickets-and-passes/single-attractions.html', '2026-11-17', true),
  ('singapore', 5, '新加坡國家博物館一張外籍成人一般票要多少錢？', 'What is the price of one general admission ticket for a foreign adult at the National Museum of Singapore?', 'spellbook', 'S$', 20, 1.289, '博物館的常設展由新加坡國家博物館策劃。', 'The National Museum hosts permanent galleries about Singapore.', 'https://www.nhb.gov.sg/nationalmuseum/plan-your-visit/visitor-information/admissions', '2026-11-17', true),
  ('singapore', 6, '新加坡土生文化館孔雀特展期間一張外籍成人全館票要多少錢？', 'What is the price of an all-access adult tourist ticket to Singapore’s Peranakan Museum during Peacock Power?', 'kamcheng', 'S$', 18, 1.289, '土生文化館位在亞美尼亞街。', 'The museum is on Armenian Street.', 'https://www.nhb.gov.sg/peranakanmuseum/visit/plan-your-visit', '2026-11-17', true),
  ('singapore', 7, '新加坡一張一日遊客通行卡 Singapore Tourist Pass要多少錢？', 'What is the price of a one-day Singapore Tourist Pass?', 'tram', 'S$', 17, 1.289, '遊客通行卡可用於指定公共交通。', 'The Tourist Pass covers eligible public transport.', 'https://thesingaporetouristpass.com.sg/faq/singapore-tourist-pass/', '2026-11-17', true),
  ('singapore', 8, '新加坡纜車 SkyPass 一張成人來回票的未折扣原價要多少錢？', 'What is the price of an adult round-trip Singapore Cable Car SkyPass at its undiscounted price?', 'hot-air-balloon', 'S$', 35, 1.289, 'SkyPass 涵蓋花柏山線和聖淘沙線。', 'The SkyPass covers both the Mount Faber and Sentosa lines.', 'https://mountfaberleisure.com/attraction/singapore-cable-car/', '2026-11-17', true),
  ('singapore', 9, '新加坡摩天觀景輪一張標準成人票要多少錢？', 'What is the price of a standard adult ticket for the Singapore Flyer?', 'hot-air-balloon', 'S$', 46, 1.289, '觀景輪俯瞰濱海灣。', 'The observation wheel overlooks Marina Bay.', 'https://www.singaporeflyer.com/en', '2026-11-17', true),
  ('singapore', 10, '在新加坡寄一封國內普通尺寸標準信件的郵資要多少錢？', 'What is the price of postage for one Standard Regular domestic letter in Singapore?', 'envelope', 'S$', 0.62, 1.289, '普通尺寸信件的厚度上限是六毫米。', 'Standard Regular mail can be up to six millimetres thick.', 'https://www.singpost.com/ratechange2026', '2026-11-17', true),
  ('singapore', 11, '新加坡國家美術館一張非新加坡籍成人一般票要多少錢？', 'What is the price of one standard general-admission ticket for a foreign adult at National Gallery Singapore?', 'instant-camera', 'S$', 20, 1.289, '一般票可看美術館指定的展覽。', 'General admission covers selected exhibitions.', 'https://www.nationalgallery.sg/sg/en/visit/visitor-information.html', '2026-11-17', true),
  ('singapore', 12, '聖淘沙時光之翼煙火秀標準座位的一張未折扣原價票要多少錢？', 'What is the price of one standard-seat ticket to Sentosa’s Wings of Time fireworks show at its undiscounted price?', 'firefly-jar', 'S$', 22, 1.289, '標準座位區採用共用長椅。', 'The standard seating areas use shared benches.', 'https://mountfaberleisure.com/attraction/wings-of-time-fireworks-symphony', '2026-11-17', true),
  ('singapore', 13, '聖淘沙馬來西亞美食街兩片斑蘭戚風蛋糕要多少錢？', 'What is the price of two slices of pandan chiffon cake at Malaysian Food Street, Sentosa?', 'cake-box', 'S$', 4, 1.289, '斑蘭是這款戚風蛋糕的風味來源。', 'Pandan gives this chiffon cake its flavour.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', true),
  ('singapore', 14, '遊客在一般日到新加坡河川生態園的一張成人門票要多少錢？', 'What is the price of an adult tourist ticket to River Wonders on a regular day?', 'river-lantern', 'S$', 45, 1.289, '河川生態園以河流與淡水生物為主題。', 'River Wonders focuses on rivers and freshwater wildlife.', 'https://www.mandai.com/en/tickets-and-passes/single-attractions.html', '2026-11-17', true),
  ('singapore', 15, '新加坡一張三日遊客通行卡 Singapore Tourist Pass要多少錢？', 'What is the price of a three-day Singapore Tourist Pass?', 'clock-tower', 'S$', 29, 1.289, '通行期結束後，卡片可當一般 EZ-Link 卡使用。', 'After the pass expires, the card can be used as an EZ-Link card.', 'https://thesingaporetouristpass.com.sg/faq/singapore-tourist-pass/', '2026-11-17', true),
  ('singapore', 16, '新加坡 SkyOrb 纜車成人來回票的未折扣原價要多少錢？', 'What is the price of an adult round trip in Singapore’s SkyOrb cable car at its undiscounted price?', 'crystal-ball', 'S$', 48, 1.289, 'SkyOrb 是新加坡纜車的特色車廂。', 'SkyOrb is one of the Singapore Cable Car’s cabin options.', 'https://mountfaberleisure.com/attraction/singapore-cable-car/', '2026-11-17', true),
  ('singapore', 17, '新加坡摩天觀景輪一張成人新加坡司令體驗票要多少錢？', 'What is the price of one adult Singapore Sling Experience ticket for the Singapore Flyer?', 'bottle', 'S$', 79, 1.289, '這個體驗把一杯新加坡司令和觀景輪行程配在一起。', 'The experience pairs a Singapore Sling with a ride on the wheel.', 'https://www.singaporeflyer.com/en', '2026-11-17', true),
  ('singapore', 18, '在新加坡寄一封國內大尺寸標準信件的郵資要多少錢？', 'What is the price of postage for one Standard Large domestic letter in Singapore?', 'postbox', 'S$', 0.90, 1.289, '大尺寸標準郵件可容納 A4 文件。', 'Standard Large mail can accommodate A4 documents.', 'https://www.singpost.com/ratechange2026', '2026-11-17', true),
  ('singapore', 19, '聖淘沙馬來西亞美食街一杯熱拉茶要多少錢？', 'What is the price of a hot teh tarik at Malaysian Food Street, Sentosa?', 'teapot', 'S$', 3, 1.289, '拉茶靠在容器之間來回倒茶產生泡沫。', 'Teh tarik is poured between vessels to create froth.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', true),
  ('singapore', 20, '遊客在一般日到新加坡飛禽公園的一張成人門票要多少錢？', 'What is the price of an adult tourist ticket to Bird Paradise on a regular day?', 'red-bird', 'S$', 49, 1.289, '飛禽公園是萬態保護區的鳥類園區。', 'Bird Paradise is the bird park at Mandai.', 'https://www.mandai.com/en/tickets-and-passes/single-attractions.html', '2026-11-17', true),
  ('singapore', 21, '新加坡纜車聖淘沙線一張網售成人來回票要多少錢？', 'What is the price of an adult round-trip ticket for the Sentosa cable car line when bought online?', 'hot-air-balloon', 'S$', 17, 1.289, '這張票在聖淘沙線使用。', 'This ticket is for the Sentosa line.', 'https://mountfaberleisure.com/attraction/singapore-cable-car/', '2026-11-17', true),
  ('singapore', 22, '新加坡摩天觀景輪一張成人 165 Sky Dining 空中用餐票要多少錢？', 'What is the price of one adult 165 Sky Dining ticket on the Singapore Flyer?', 'bento', 'S$', 260, 1.289, '餐點在觀景輪的車廂內享用。', 'Dinner is served in a capsule on the wheel.', 'https://www.singaporeflyer.com/en', '2026-11-17', true),
  ('singapore', 23, '聖淘沙馬來西亞美食街一杯加冰的西瓜汁要多少錢？', 'What is the price of a watermelon juice with ice at Malaysian Food Street, Sentosa?', 'bottle', 'S$', 6, 1.289, '菜單把西瓜汁列在鮮榨果汁一欄。', 'The menu lists watermelon juice among the fresh juices.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', true),
  ('singapore', 24, '遊客在一般日到新加坡夜間野生動物園的一張成人門票要多少錢？', 'What is the price of an adult tourist ticket to Night Safari on a regular day?', 'camp-lantern', 'S$', 58, 1.289, '夜間野生動物園在晚上迎接訪客。', 'Night Safari welcomes visitors after dark.', 'https://www.mandai.com/en/tickets-and-passes/single-attractions.html', '2026-11-17', true),
  ('singapore', 25, '聖淘沙馬來西亞美食街一杯荔枝爆爆珠冰飲要多少錢？', 'What is the price of a lychee popping-boba drink at Malaysian Food Street, Sentosa?', 'bubble-tea', 'S$', 6, 1.289, '這款冰飲加入會在嘴裡爆開的爆爆珠。', 'The drink contains popping boba that burst in your mouth.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', true),
  ('singapore', 26, '遊客在一般日到新加坡雨林探險園 Rainforest Wild Adventure 的一張成人門票要多少錢？', 'What is the price of an adult tourist ticket to Rainforest Wild Adventure on a regular day?', 'firefly-jar', 'S$', 55, 1.289, '這個園區把雨林動物觀察和探險活動結合。', 'The park combines rainforest wildlife viewing with adventure activities.', 'https://www.mandai.com/en/tickets-and-passes/single-attractions.html', '2026-11-17', true),
  ('singapore', 27, '聖淘沙馬來西亞美食街一杯美祿恐龍要多少錢？', 'What is the price of a Milo Dinosaur at Malaysian Food Street, Sentosa?', 'potion', 'S$', 6, 1.289, '美祿恐龍是加上一層美祿粉的冰美祿。', 'A Milo Dinosaur is iced Milo topped with extra Milo powder.', 'https://www.rwsentosa.com/-/jssmedia/project/non-gaming/rwsentosa/dining/malaysian-food-street/menus/breakfast-menu.pdf?rev=e813c8172af84f6386775893052cdb0e&sc_lang=en', '2026-11-17', true),
  ('singapore', 28, '遊客在一般日到新加坡 Exploria 的一張成人門票要多少錢？', 'What is the price of an adult tourist ticket to Exploria on a regular day?', 'potion', 'S$', 38, 1.289, 'Exploria 用多媒體講述自然世界的故事。', 'Exploria uses multimedia to tell stories about the natural world.', 'https://www.mandai.com/en/tickets-and-passes/single-attractions.html', '2026-11-17', true);
