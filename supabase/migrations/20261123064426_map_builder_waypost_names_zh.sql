-- Match the reviewed Chinese-name groups by stable seed reference. The two
-- original Hong Kong places without source refs match by their seed location.
begin;

select private.lock_game_edits();
lock table public.public_capsule_spots in share row exclusive mode;

create temp table waypost_name_plan (
  city_en text, source_ref text, lat double precision, lng double precision,
  kind text, status text, old_zh text, old_en text, new_zh text, new_en text
) on commit drop;

insert into pg_temp.waypost_name_plan values
  ('Hong Kong', 'osm:way/28379385@125m;park/way/4977404', null, null, 'common', 'live', '九龍公園', 'Kowloon Park', '九龍公園', 'Kowloon Park'),
  ('Hong Kong', null, 22.300533, 114.170115, 'common', 'hidden', '九龍公園', 'Kowloon Park', '九龍公園（2）', 'Kowloon Park (2)'),
  ('Hong Kong', 'osm:way/102642100@50m;park/relation/12919867', null, null, 'common', 'live', '尖沙咀海濱花園', 'Tsim Sha Tsui Promenade', '尖沙咀海濱花園', 'Tsim Sha Tsui Promenade'),
  ('Hong Kong', 'osm:way/184475460@25m;park/relation/12919867', null, null, 'common', 'live', '尖沙咀海濱花園', 'Tsim Sha Tsui Promenade', '尖沙咀海濱花園（2）', 'Tsim Sha Tsui Promenade (2)'),
  ('Hong Kong', 'osm:way/102642100@375m;waterfront/relation/12919867', null, null, 'common', 'live', '尖沙咀海濱花園', 'Tsim Sha Tsui Promenade', '尖沙咀海濱花園（3）', 'Tsim Sha Tsui Promenade (3)'),
  ('Hong Kong', null, 22.299419, 114.185649, 'common', 'hidden', '尖沙咀海濱花園', 'Tsim Sha Tsui Promenade', '尖沙咀海濱花園（4）', 'Tsim Sha Tsui Promenade (4)'),
  ('Hong Kong', 'osm:way/184762372@0m;park/way/605420849', null, null, 'common', 'live', '公園', 'Public park', '公園', 'Public park'),
  ('Hong Kong', 'osm:way/605236403@0m;park/way/605236404', null, null, 'common', 'live', '公園', 'Public park', '公園（2）', 'Public park (2)'),
  ('Hong Kong', 'osm:way/417590439@25m;park/way/675493141', null, null, 'common', 'live', '公園', 'Park', '公園（3）', 'Park (3)'),
  ('Hong Kong', 'osm:way/133164724@200m;park/way/675496677', null, null, 'common', 'live', '公園', 'Park', '公園（4）', 'Park (4)'),
  ('Hong Kong', 'osm:way/830380982@25m;park/way/775969233', null, null, 'common', 'live', '公園', 'Park', '公園（5）', 'Park (5)'),
  ('Hong Kong', 'osm:way/101220534@25m;waterfront/relation/12719231', null, null, 'common', 'live', '柴灣公園', 'Chai Wan Park', '柴灣公園', 'Chai Wan Park'),
  ('Hong Kong', 'osm:way/1354785439@150m;park/relation/12719231', null, null, 'common', 'live', '柴灣公園', 'Chai Wan Park', '柴灣公園（2）', 'Chai Wan Park (2)'),
  ('Hong Kong', 'osm:way/1021161261@0m;waterfront/way/775969233', null, null, 'common', 'live', '海濱步道', 'Waterfront', '海濱步道', 'Waterfront'),
  ('Hong Kong', 'osm:way/1117814985@250m;waterfront/way/1086874057', null, null, 'common', 'live', '海濱步道', 'Waterfront', '海濱步道（2）', 'Waterfront (2)'),
  ('Hong Kong', 'osm:way/1313794177@25m;waterfront/way/1122405295', null, null, 'common', 'live', '海濱步道', 'Waterfront', '海濱步道（3）', 'Waterfront (3)'),
  ('Hong Kong', 'osm:way/1391725362@125m;waterfront/way/1391725364', null, null, 'common', 'live', '海濱步道', 'Waterfront', '海濱步道（4）', 'Waterfront (4)'),
  ('Hong Kong', 'osm:way/808453789@175m;waterfront/way/1234351380', null, null, 'common', 'live', '海濱步道', 'Waterfront', '海濱步道（5）', 'Waterfront (5)'),
  ('Hong Kong', 'osm:way/102225743@0m;waterfront/relation/12921008', null, null, 'common', 'live', '鰂魚涌公園', 'Quarry Bay Park', '鰂魚涌公園', 'Quarry Bay Park'),
  ('Hong Kong', 'osm:way/102225781@0m;waterfront/relation/12921008', null, null, 'common', 'live', '鰂魚涌公園', 'Quarry Bay Park', '鰂魚涌公園（2）', 'Quarry Bay Park (2)'),
  ('Hong Kong', 'osm:way/1047369129@0m;waterfront/way/734745074', null, null, 'common', 'live', '中環碼頭海濱長廊', 'Central Pier Waterfront', '中環碼頭海濱長廊', 'Central Pier Waterfront'),
  ('Hong Kong', 'osm:way/1047369147@450m;waterfront/way/734745074', null, null, 'common', 'live', '中環碼頭海濱長廊', 'Central Pier Waterfront', '中環碼頭海濱長廊（2）', 'Central Pier Waterfront (2)'),
  ('Hong Kong', 'osm:way/1093897810@0m;waterfront/relation/12910298', null, null, 'common', 'live', '灣仔臨時海濱花園', 'Wan Chai Temporary Promenade', '灣仔臨時海濱花園', 'Wan Chai Temporary Promenade'),
  ('Hong Kong', 'osm:way/184761787@100m;waterfront/relation/12910298', null, null, 'common', 'live', '灣仔臨時海濱花園', 'Wan Chai Temporary Promenade', '灣仔臨時海濱花園（2）', 'Wan Chai Temporary Promenade (2)'),
  ('Hong Kong', 'osm:way/1110198766@0m;waterfront/way/675488827', null, null, 'common', 'live', '將軍澳南海濱長廊', 'Tseung Kwan O South Waterfront Promenade', '將軍澳南海濱長廊', 'Tseung Kwan O South Waterfront Promenade'),
  ('Hong Kong', 'osm:way/765942655@250m;waterfront/way/675488827', null, null, 'common', 'live', '將軍澳南海濱長廊', 'Tseung Kwan O South Waterfront Promenade', '將軍澳南海濱長廊（2）', 'Tseung Kwan O South Waterfront Promenade (2)'),
  ('Hong Kong', 'osm:way/765942655@525m;waterfront/way/675488827', null, null, 'common', 'live', '將軍澳南海濱長廊', 'Tseung Kwan O South Waterfront Promenade', '將軍澳南海濱長廊（3）', 'Tseung Kwan O South Waterfront Promenade (3)'),
  ('Hong Kong', 'osm:way/1373610951@25m;waterfront/relation/12076859', null, null, 'common', 'live', '啟德體育園', 'Kai Tak Sports Park', '啟德體育園', 'Kai Tak Sports Park'),
  ('Hong Kong', 'osm:way/1343926517@200m;park/relation/12076859', null, null, 'common', 'live', '啟德體育園', 'Kai Tak Sports Park', '啟德體育園（2）', 'Kai Tak Sports Park (2)'),
  ('Hong Kong', 'osm:way/1449940116@25m;waterfront/way/961605650', null, null, 'common', 'live', '小西灣海濱花園', 'Siu Sai Wan Promenade', '小西灣海濱花園', 'Siu Sai Wan Promenade'),
  ('Hong Kong', 'osm:way/152653225@25m;waterfront/way/961605650', null, null, 'common', 'live', '小西灣海濱花園', 'Siu Sai Wan Promenade', '小西灣海濱花園（2）', 'Siu Sai Wan Promenade (2)'),
  ('Hong Kong', 'osm:way/158664659@0m;waterfront/way/25609090', null, null, 'common', 'live', '荔枝角公園', 'Lai Chi Kok Park', '荔枝角公園', 'Lai Chi Kok Park'),
  ('Hong Kong', 'osm:way/151705980@0m;park/way/25609090', null, null, 'common', 'live', '荔枝角公園', 'Lai Chi Kok Park', '荔枝角公園（2）', 'Lai Chi Kok Park (2)'),
  ('Hong Kong', 'osm:way/158664642@100m;park/way/25609090', null, null, 'common', 'live', '荔枝角公園', 'Lai Chi Kok Park', '荔枝角公園（3）', 'Lai Chi Kok Park (3)'),
  ('Hong Kong', 'osm:way/234899728@0m;park/way/25609090', null, null, 'common', 'live', '荔枝角公園', 'Lai Chi Kok Park', '荔枝角公園（4）', 'Lai Chi Kok Park (4)'),
  ('Hong Kong', 'osm:way/190033891@0m;waterfront/way/97788544', null, null, 'common', 'live', '香港抗戰及海防博物館', 'Hong Kong Museum of the War of Resistance and Coastal Defence', '香港抗戰及海防博物館', 'Hong Kong Museum of the War of Resistance and Coastal Defence'),
  ('Hong Kong', 'osm:way/190033893@0m;park/way/97788544', null, null, 'common', 'live', '香港抗戰及海防博物館', 'Hong Kong Museum of the War of Resistance and Coastal Defence', '香港抗戰及海防博物館（2）', 'Hong Kong Museum of the War of Resistance and Coastal Defence (2)'),
  ('Hong Kong', 'osm:way/1046752669@0m;square/way/266102541', null, null, 'common', 'live', '廣場', 'Square', '廣場', 'Square'),
  ('Hong Kong', 'osm:way/1365729408@grid-1925_1925m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（2）', 'Square (2)'),
  ('Hong Kong', 'osm:way/1371000423@grid5300_2150m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（3）', 'Square (3)'),
  ('Hong Kong', 'osm:way/312192947@25m;square/way/312192960', null, null, 'common', 'live', '廣場', 'Square', '廣場（4）', 'Square (4)'),
  ('Hong Kong', 'osm:way/914287397@50m;square/way/914287397', null, null, 'common', 'live', '廣場', 'Square', '廣場（5）', 'Square (5)'),
  ('Hong Kong', 'osm:way/198024528@100m;park/relation/14893771', null, null, 'common', 'live', '牛池灣公園', 'Ngau Chi Wan Park', '牛池灣公園', 'Ngau Chi Wan Park'),
  ('Hong Kong', 'osm:way/962163330@0m;park/relation/14893771', null, null, 'common', 'live', '牛池灣公園', 'Ngau Chi Wan Park', '牛池灣公園（2）', 'Ngau Chi Wan Park (2)'),
  ('Hong Kong', 'osm:way/246751699@0m;park/way/948193845', null, null, 'common', 'live', '山頂公園', 'Victoria Peak Garden', '山頂公園', 'Victoria Peak Garden'),
  ('Hong Kong', 'osm:way/96376731@225m;park/way/948193845', null, null, 'common', 'live', '山頂公園', 'Victoria Peak Garden', '山頂公園（2）', 'Victoria Peak Garden (2)'),
  ('Macau', 'osm:relation/11551012', null, null, 'common', 'live', '宋玉生公園', 'Dr. Carlos d’Assumpção Park', '宋玉生公園', 'Dr. Carlos d’Assumpção Park'),
  ('Macau', 'osm:way/405596065@25m;park/relation/11551012', null, null, 'common', 'live', '宋玉生公園', 'Dr. Carlos D''Assumpcao Park', '宋玉生公園（2）', 'Dr. Carlos D''Assumpcao Park (2)'),
  ('Macau', 'osm:way/192180025', null, null, 'common', 'live', '觀音像海濱休憩區', 'Kun Iam Waterfront Leisure Area', '觀音像海濱休憩區', 'Kun Iam Waterfront Leisure Area'),
  ('Macau', 'osm:way/770557470@25m;park/way/192180025', null, null, 'common', 'live', '觀音像海濱休憩區', '觀音像海濱休憩區 Zona de Lazer da Marginal da Estátua de Kun Iam', '觀音像海濱休憩區（2）', '觀音像海濱休憩區 Zona de Lazer da Marginal da Estátua de Kun Iam (2)'),
  ('Macau', 'osm:way/305387668', null, null, 'common', 'live', '回歸公園', 'Return Park', '回歸公園', 'Return Park'),
  ('Macau', 'osm:way/330914462@0m;park/way/305387668', null, null, 'common', 'live', '回歸公園', '回歸公園 Jardim da Rua de Malaca', '回歸公園（2）', '回歸公園 Jardim da Rua de Malaca (2)'),
  ('Macau', 'osm:way/346900281', null, null, 'common', 'live', '區華利前地', 'Jorge Álvares Square', '區華利前地', 'Jorge Álvares Square'),
  ('Macau', 'osm:way/422643353@100m;park/way/346900281', null, null, 'common', 'live', '區華利前地', '區華利前地 Lazer de Praça de Jorge Álvares', '區華利前地（2）', '區華利前地 Lazer de Praça de Jorge Álvares (2)'),
  ('Macau', 'osm:way/488185729', null, null, 'common', 'live', '大炮台公園', 'Mount Fortress Park', '大炮台公園', 'Mount Fortress Park'),
  ('Macau', 'osm:way/710432483@0m;park/way/488185729', null, null, 'common', 'live', '大炮台公園', '大炮台公園 Parque da Fortaleza do Monte', '大炮台公園（2）', '大炮台公園 Parque da Fortaleza do Monte (2)'),
  ('Macau', 'osm:way/240933853@25m;park/way/960068373', null, null, 'common', 'live', '公園', 'Public park', '公園', 'Public park'),
  ('Macau', 'osm:way/240933853@300m;park/way/960068373', null, null, 'common', 'live', '公園', 'Public park', '公園（2）', 'Public park (2)'),
  ('Macau', 'osm:way/240933889@25m;park/way/1279798979', null, null, 'common', 'live', '公園', 'Public park', '公園（3）', 'Public park (3)'),
  ('Macau', 'osm:way/679384115@100m;park/way/1313399517', null, null, 'common', 'live', '公園', 'Public park', '公園（4）', 'Public park (4)'),
  ('Macau', 'osm:way/383300092@0m;waterfront/relation/10266786', null, null, 'common', 'live', '水塘公園', 'Reservoir Park', '水塘公園', 'Reservoir Park'),
  ('Macau', 'osm:way/778862867@125m;waterfront/relation/10266786', null, null, 'common', 'live', '水塘公園', 'Reservoir Park', '水塘公園（2）', 'Reservoir Park (2)'),
  ('Macau', 'osm:way/769926706@1100m;waterfront/way/405826614', null, null, 'common', 'live', '氹仔海濱休憩區', 'Zona de Lazer da Marginal da Taipa', '氹仔海濱休憩區', 'Zona de Lazer da Marginal da Taipa'),
  ('Macau', 'osm:way/769926706@825m;waterfront/way/405826614', null, null, 'common', 'live', '氹仔海濱休憩區', 'Zona de Lazer da Marginal da Taipa', '氹仔海濱休憩區（2）', 'Zona de Lazer da Marginal da Taipa (2)'),
  ('Macau', 'osm:way/944736302@25m;waterfront/way/405826614', null, null, 'common', 'live', '氹仔海濱休憩區', 'Zona de Lazer da Marginal da Taipa', '氹仔海濱休憩區（3）', 'Zona de Lazer da Marginal da Taipa (3)'),
  ('Singapore', 'osm:node/6283080658', null, null, 'landmark', 'live', '魚尾獅公園', 'Merlion Park', '魚尾獅公園', 'Merlion Park'),
  ('Singapore', 'osm:way/687917300', null, null, 'common', 'live', '魚尾獅公園', 'Merlion Park', '魚尾獅公園（2）', 'Merlion Park (2)'),
  ('Singapore', 'osm:way/164881350@0m;park/way/687917300', null, null, 'common', 'live', '魚尾獅公園', 'Merlion Park', '魚尾獅公園（3）', 'Merlion Park (3)'),
  ('Singapore', 'osm:way/106193383', null, null, 'common', 'live', '萊佛士坊公園', 'Raffles Place Park', '萊佛士坊公園', 'Raffles Place Park'),
  ('Singapore', 'osm:way/172263096@0m;park/way/106193383', null, null, 'common', 'live', '萊佛士坊公園', 'Raffles Place Park', '萊佛士坊公園（2）', 'Raffles Place Park (2)'),
  ('Singapore', 'osm:way/116905791', null, null, 'common', 'live', '濱海灣草坪', 'The Lawn @ Marina Bay', '濱海灣草坪', 'The Lawn @ Marina Bay'),
  ('Singapore', 'osm:way/462914029@50m;park/way/116905791', null, null, 'common', 'live', '濱海灣草坪', 'The Lawn@Marina Bay', '濱海灣草坪（2）', 'The Lawn@Marina Bay (2)'),
  ('Singapore', 'osm:way/47257415@0m;park/way/47257476', null, null, 'common', 'live', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園', 'Singapore Botanic Gardens'),
  ('Singapore', 'osm:way/47257473@0m;park/way/47257476', null, null, 'common', 'live', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園（2）', 'Singapore Botanic Gardens (2)'),
  ('Singapore', 'osm:way/142598070@0m;park/way/47257476', null, null, 'common', 'live', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園（3）', 'Singapore Botanic Gardens (3)'),
  ('Singapore', 'osm:way/142709443@0m;park/way/47257476', null, null, 'common', 'live', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園（4）', 'Singapore Botanic Gardens (4)'),
  ('Singapore', 'osm:way/173623386@0m;park/way/47257476', null, null, 'common', 'live', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園（5）', 'Singapore Botanic Gardens (5)'),
  ('Singapore', 'osm:way/528905435@25m;park/way/47257476', null, null, 'common', 'live', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園（6）', 'Singapore Botanic Gardens (6)'),
  ('Singapore', 'osm:way/106086895@0m;park/way/106086903', null, null, 'common', 'live', '公園', 'Public park', '公園', 'Public park'),
  ('Singapore', 'osm:way/170967529@25m;park/way/1387617423', null, null, 'common', 'live', '公園', 'Public park', '公園（2）', 'Public park (2)'),
  ('Singapore', 'osm:way/481965624@25m;park/way/481965622', null, null, 'common', 'live', '公園', 'Public park', '公園（3）', 'Public park (3)'),
  ('Singapore', 'osm:way/532056050@25m;park/way/1387617423', null, null, 'common', 'live', '公園', 'Public park', '公園（4）', 'Public park (4)'),
  ('Singapore', 'osm:way/1182941686@0m;park/way/1153434547', null, null, 'common', 'live', '公園', 'Park', '公園（5）', 'Park (5)'),
  ('Singapore', 'osm:way/1217599789@25m;park/way/306458376', null, null, 'common', 'live', '公園', 'Toa Payoh Sensory Park', '公園（6）', 'Toa Payoh Sensory Park (6)'),
  ('Singapore', 'osm:way/1352481434@0m;park/way/1232950362', null, null, 'common', 'live', '公園', 'Pek Kio Park', '公園（7）', 'Pek Kio Park (7)'),
  ('Singapore', 'osm:way/1436377747@0m;park/way/683635206', null, null, 'common', 'live', '公園', 'Park', '公園（8）', 'Park (8)'),
  ('Singapore', 'osm:way/150829211@0m;park/way/904611455', null, null, 'common', 'live', '公園', 'East Coast Park (Zone A)', '公園（9）', 'East Coast Park (Zone A) (9)'),
  ('Singapore', 'osm:way/314523100@25m;park/way/863261570', null, null, 'common', 'live', '公園', 'Park', '公園（10）', 'Park (10)'),
  ('Singapore', 'osm:way/455246818@1300m;park/way/174721786', null, null, 'common', 'live', '公園', 'East Coast Park (Zone B)', '公園（11）', 'East Coast Park (Zone B) (11)'),
  ('Singapore', 'osm:way/455246818@2050m;park/way/23161989', null, null, 'common', 'live', '公園', 'East Coast Park (Zone C)', '公園（12）', 'East Coast Park (Zone C) (12)'),
  ('Singapore', 'osm:way/496173180@75m;park/way/52235098', null, null, 'common', 'live', '公園', 'Penang Road Open Space', '公園（13）', 'Penang Road Open Space (13)'),
  ('Singapore', 'osm:way/546702695@0m;park/way/358462339', null, null, 'common', 'live', '公園', 'Arena Park', '公園（14）', 'Arena Park (14)'),
  ('Singapore', 'osm:way/171142596@0m;park/relation/10231144', null, null, 'common', 'live', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園', 'Gardens by the Bay'),
  ('Singapore', 'osm:way/172297168@25m;park/relation/10231144', null, null, 'common', 'live', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（2）', 'Gardens by the Bay (2)'),
  ('Singapore', 'osm:way/172297177@0m;park/relation/10231144', null, null, 'common', 'live', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（3）', 'Gardens by the Bay (3)'),
  ('Singapore', 'osm:way/172297193@0m;park/relation/10231144', null, null, 'common', 'live', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（4）', 'Gardens by the Bay (4)'),
  ('Singapore', 'osm:way/172297202@0m;park/relation/10231144', null, null, 'common', 'live', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（5）', 'Gardens by the Bay (5)'),
  ('Singapore', 'osm:way/884590174@25m;park/relation/10231144', null, null, 'common', 'live', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（6）', 'Gardens by the Bay (6)'),
  ('Singapore', 'osm:way/849812573@150m;waterfront/relation/10231144', null, null, 'common', 'live', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（7）', 'Gardens by the Bay (7)'),
  ('Singapore', 'osm:way/172409565@75m;park/way/16892550', null, null, 'common', 'live', '福康寧公園', 'Fort Canning Park', '福康寧公園', 'Fort Canning Park'),
  ('Singapore', 'osm:way/252086126@0m;park/way/16892550', null, null, 'common', 'live', '福康寧公園', 'Fort Canning Park', '福康寧公園（2）', 'Fort Canning Park (2)'),
  ('Singapore', 'osm:way/702901686@50m;park/way/16892550', null, null, 'common', 'live', '福康寧公園', 'Fort Canning Park', '福康寧公園（3）', 'Fort Canning Park (3)'),
  ('Singapore', 'osm:way/742058829@150m;park/way/736934929', null, null, 'common', 'live', '新加坡植物園加洛普延伸區', 'Singapore Botanic Gardens Gallop Extension', '新加坡植物園加洛普延伸區', 'Singapore Botanic Gardens Gallop Extension'),
  ('Singapore', 'osm:way/918147746@525m;park/way/736934929', null, null, 'common', 'live', '新加坡植物園加洛普延伸區', 'Singapore Botanic Gardens Gallop Extension', '新加坡植物園加洛普延伸區（2）', 'Singapore Botanic Gardens Gallop Extension (2)'),
  ('Singapore', 'osm:way/474288886@grid-2025_1625m;square', null, null, 'common', 'live', '烏節寶龍坊', 'Orchard Promenade', '烏節寶龍坊', 'Orchard Promenade'),
  ('Singapore', 'osm:way/46521277@325m;square/way/474288886', null, null, 'common', 'live', '烏節寶龍坊', 'Orchard Promenade', '烏節寶龍坊（2）', 'Orchard Promenade (2)'),
  ('Singapore', 'osm:way/474288886@grid-1475_1350m;square', null, null, 'common', 'live', '烏節寶龍坊', 'Orchard Promenade', '烏節寶龍坊（3）', 'Orchard Promenade (3)'),
  ('Singapore', 'osm:way/685178661@100m;square/way/931655370', null, null, 'common', 'live', '廣場', 'Square', '廣場', 'Square'),
  ('Singapore', 'osm:way/1155359166@25m;square/way/1155359166', null, null, 'common', 'live', '廣場', 'Square', '廣場（2）', 'Square (2)'),
  ('Singapore', 'osm:way/116818163@100m;square/way/116818163', null, null, 'common', 'live', '廣場', 'Square', '廣場（3）', 'Square (3)'),
  ('Singapore', 'osm:way/1557262991@25m;square/way/1557262991', null, null, 'common', 'live', '廣場', 'Square', '廣場（4）', 'Square (4)'),
  ('Singapore', 'osm:way/1561978139@100m;square/way/1561978139', null, null, 'common', 'live', '廣場', 'Square', '廣場（5）', 'Square (5)'),
  ('Singapore', 'osm:way/162525974@275m;square/way/172015629', null, null, 'common', 'live', '廣場', 'Event Plaza', '廣場（6）', 'Event Plaza (6)'),
  ('Singapore', 'osm:way/216223896@75m;square/way/218268266', null, null, 'common', 'live', '廣場', 'Square', '廣場（7）', 'Square (7)'),
  ('Singapore', 'osm:way/266998785@grid-4450_-2925m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（8）', 'Square (8)'),
  ('Singapore', 'osm:way/41659829@25m;square/way/474288906', null, null, 'common', 'live', '廣場', 'Square', '廣場（9）', 'Square (9)'),
  ('Singapore', 'osm:way/474763401@grid-1150_50m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（10）', 'Square (10)'),
  ('Singapore', 'osm:way/480175918@25m;square/way/480632927', null, null, 'common', 'live', '廣場', 'Square', '廣場（11）', 'Square (11)'),
  ('Singapore', 'osm:way/616972594@grid-3000_-2375m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（12）', 'Square (12)'),
  ('Singapore', 'osm:way/739513984@grid-850_-625m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（13）', 'Square (13)'),
  ('Singapore', 'osm:node/10048423476;publicArt', null, null, 'common', 'live', '公共藝術', 'Here is SG', '公共藝術', 'Here is SG'),
  ('Singapore', 'osm:node/10554386876;publicArt', null, null, 'common', 'live', '公共藝術', 'Public art', '公共藝術（2）', 'Public art (2)'),
  ('Singapore', 'osm:node/6461554413;publicArt', null, null, 'common', 'live', '公共藝術', 'Red Memory-Smile', '公共藝術（3）', 'Red Memory-Smile (3)'),
  ('Singapore', 'osm:way/1167350219@0m;waterfront/relation/15394784', null, null, 'common', 'live', '直落布蘭雅山公園', 'Telok Blangah Hill Park', '直落布蘭雅山公園', 'Telok Blangah Hill Park'),
  ('Singapore', 'osm:way/310894901@175m;park/relation/15394784', null, null, 'common', 'live', '直落布蘭雅山公園', 'Telok Blangah Hill Park', '直落布蘭雅山公園（2）', 'Telok Blangah Hill Park (2)'),
  ('Singapore', 'osm:way/616747718@100m;park/relation/15394784', null, null, 'common', 'live', '直落布蘭雅山公園', 'Telok Blangah Hill Park', '直落布蘭雅山公園（3）', 'Telok Blangah Hill Park (3)'),
  ('Singapore', 'osm:way/1321546690@25m;waterfront/way/439331643', null, null, 'common', 'live', '海濱步道', 'Whampoa Park', '海濱步道', 'Whampoa Park'),
  ('Singapore', 'osm:way/1462539158@100m;waterfront/way/567248094', null, null, 'common', 'live', '海濱步道', 'Greenville Garden Park', '海濱步道（2）', 'Greenville Garden Park (2)'),
  ('Singapore', 'osm:way/1462539158@375m;waterfront/way/567248094', null, null, 'common', 'live', '海濱步道', 'Greenville Garden Park', '海濱步道（3）', 'Greenville Garden Park (3)'),
  ('Singapore', 'osm:way/1487214819@50m;waterfront/way/681191987', null, null, 'common', 'live', '海濱步道', 'Waterfront', '海濱步道（4）', 'Waterfront (4)'),
  ('Singapore', 'osm:way/1516352605@0m;waterfront/way/174721786', null, null, 'common', 'live', '海濱步道', 'East Coast Park (Zone B)', '海濱步道（5）', 'East Coast Park (Zone B) (5)'),
  ('Singapore', 'osm:way/1562172955@50m;waterfront/way/1562172958', null, null, 'common', 'live', '海濱步道', 'Waterfront', '海濱步道（6）', 'Waterfront (6)'),
  ('Singapore', 'osm:way/229630825@75m;waterfront/way/174721786', null, null, 'common', 'live', '海濱步道', 'East Coast Park (Zone B)', '海濱步道（7）', 'East Coast Park (Zone B) (7)'),
  ('Singapore', 'osm:way/395801750@25m;waterfront/way/552973480', null, null, 'common', 'live', '海濱步道', 'Waterfront', '海濱步道（8）', 'Waterfront (8)'),
  ('Singapore', 'osm:way/455246456@0m;waterfront/way/174721786', null, null, 'common', 'live', '海濱步道', 'East Coast Park (Zone B)', '海濱步道（9）', 'East Coast Park (Zone B) (9)'),
  ('Singapore', 'osm:way/455246818@350m;waterfront/way/174721786', null, null, 'common', 'live', '海濱步道', 'East Coast Park (Zone B)', '海濱步道（10）', 'East Coast Park (Zone B) (10)'),
  ('Singapore', 'osm:way/845223323@375m;waterfront/way/41662337', null, null, 'common', 'live', '海濱步道', 'Domain of the Istana', '海濱步道（11）', 'Domain of the Istana (11)'),
  ('Singapore', 'osm:way/910675266@0m;waterfront/way/904611455', null, null, 'common', 'live', '海濱步道', 'East Coast Park (Zone A)', '海濱步道（12）', 'East Coast Park (Zone A) (12)'),
  ('Singapore', 'osm:way/1094051080@100m;garden/way/980089262', null, null, 'common', 'live', '花園', 'Garden', '花園', 'Garden'),
  ('Singapore', 'osm:way/1507448916@0m;garden/way/1507448913', null, null, 'common', 'live', '花園', 'Garden', '花園（2）', 'Garden (2)'),
  ('Singapore', 'osm:way/1056794643@0m;park/way/343746558', null, null, 'common', 'live', '花柏山公園', 'Mount Faber Park', '花柏山公園', 'Mount Faber Park'),
  ('Singapore', 'osm:way/1168861565@25m;park/way/343746558', null, null, 'common', 'live', '花柏山公園', 'Mount Faber Park', '花柏山公園（2）', 'Mount Faber Park (2)'),
  ('Singapore', 'osm:way/1408952013@75m;park/way/343746558', null, null, 'common', 'live', '花柏山公園', 'Mount Faber Park', '花柏山公園（3）', 'Mount Faber Park (3)'),
  ('Singapore', 'osm:way/1160327872@25m;park/relation/15693200', null, null, 'common', 'live', '比達達利綠道', 'Bidadari Greenway', '比達達利綠道', 'Bidadari Greenway'),
  ('Singapore', 'osm:way/1160524558@50m;park/relation/15693200', null, null, 'common', 'live', '比達達利綠道', 'Bidadari Greenway', '比達達利綠道（2）', 'Bidadari Greenway (2)'),
  ('Taipei', 'osm:way/309157011', null, null, 'common', 'live', '台北市民廣場', 'Taipei Civic Square', '台北市民廣場', 'Taipei Civic Square'),
  ('Taipei', 'osm:way/1336506663@0m;park/way/309157011', null, null, 'common', 'live', '台北市民廣場', 'Taipei Civic Square', '台北市民廣場（2）', 'Taipei Civic Square (2)'),
  ('Taipei', 'osm:way/233666147', null, null, 'common', 'live', '松壽廣場', 'Songshou Square', '松壽廣場', 'Songshou Square'),
  ('Taipei', 'osm:way/280707092@25m;park/way/233666147', null, null, 'common', 'live', '松壽廣場', 'Sōngshòu Square Park', '松壽廣場（2）', 'Sōngshòu Square Park (2)'),
  ('Taipei', 'osm:relation/4727715', null, null, 'common', 'live', '中山公園', 'Zhongshan Park', '中山公園', 'Zhongshan Park'),
  ('Taipei', 'osm:way/49153748@25m;park/relation/4727715', null, null, 'common', 'live', '中山公園', 'Zhongshan Park', '中山公園（2）', 'Zhongshan Park (2)'),
  ('Taipei', 'osm:way/49153748@300m;park/relation/4727715', null, null, 'common', 'live', '中山公園', 'Zhongshan Park', '中山公園（3）', 'Zhongshan Park (3)'),
  ('Taipei', 'osm:way/1334831345@25m;park/relation/4727715', null, null, 'common', 'live', '中山公園', 'Zhongshan Park', '中山公園（4）', 'Zhongshan Park (4)'),
  ('Taipei', 'osm:way/555117276', null, null, 'common', 'live', '台北世貿廣場', 'Taipei World Trade Center Plaza', '台北世貿廣場', 'Taipei World Trade Center Plaza'),
  ('Taipei', 'osm:way/136814868@125m;park/way/555117276', null, null, 'common', 'live', '台北世貿廣場', '台北世貿廣場', '台北世貿廣場（2）', '台北世貿廣場 (2)'),
  ('Taipei', 'osm:way/27244215', null, null, 'common', 'live', '象山公園', 'Xiangshan Park', '象山公園', 'Xiangshan Park'),
  ('Taipei', 'osm:way/319526552@300m;park/way/27244215', null, null, 'common', 'live', '象山公園', 'Xiangshan Park', '象山公園（2）', 'Xiangshan Park (2)'),
  ('Taipei', 'osm:way/49195976@100m;park/way/1227733215', null, null, 'common', 'live', '大安森林公園', 'Da-an Forest Park', '大安森林公園', 'Da-an Forest Park'),
  ('Taipei', 'osm:way/49195990@75m;park/way/1227733215', null, null, 'common', 'live', '大安森林公園', 'Da-an Forest Park', '大安森林公園（2）', 'Da-an Forest Park (2)'),
  ('Taipei', 'osm:way/49695623@0m;park/way/1227733215', null, null, 'common', 'live', '大安森林公園', 'Da-an Forest Park', '大安森林公園（3）', 'Da-an Forest Park (3)'),
  ('Taipei', 'osm:way/192030076@50m;park/way/1227733215', null, null, 'common', 'live', '大安森林公園', 'Da-an Forest Park', '大安森林公園（4）', 'Da-an Forest Park (4)'),
  ('Taipei', 'osm:way/354318668@25m;park/relation/11791159', null, null, 'common', 'live', '大佳河濱公園', 'Dajia Park', '大佳河濱公園', 'Dajia Park'),
  ('Taipei', 'osm:way/356780466@25m;park/relation/11791159', null, null, 'common', 'live', '大佳河濱公園', 'Dajia Park', '大佳河濱公園（2）', 'Dajia Park (2)'),
  ('Taipei', 'osm:way/356780468@75m;park/relation/11791159', null, null, 'common', 'live', '大佳河濱公園', 'Dajia Park', '大佳河濱公園（3）', 'Dajia Park (3)'),
  ('Taipei', 'osm:way/484308801@75m;park/relation/11791159', null, null, 'common', 'live', '大佳河濱公園', 'Dajia Park', '大佳河濱公園（4）', 'Dajia Park (4)'),
  ('Taipei', 'osm:way/484323776@0m;park/relation/11791159', null, null, 'common', 'live', '大佳河濱公園', 'Dajia Park', '大佳河濱公園（5）', 'Dajia Park (5)'),
  ('Taipei', 'osm:way/360057684@0m;park/way/385941046', null, null, 'common', 'live', '美堤河濱公園', 'Meiti Riverside Park', '美堤河濱公園', 'Meiti Riverside Park'),
  ('Taipei', 'osm:way/1056884091@0m;waterfront/way/385941046', null, null, 'common', 'live', '美堤河濱公園', 'Meiti Riverside Park', '美堤河濱公園（2）', 'Meiti Riverside Park (2)'),
  ('Taipei', 'osm:way/360057679@25m;waterfront/way/385941046', null, null, 'common', 'live', '美堤河濱公園', 'Meiti Riverside Park', '美堤河濱公園（3）', 'Meiti Riverside Park (3)'),
  ('Taipei', 'osm:way/1068999026@0m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園', 'Yingfeng Riverside Park'),
  ('Taipei', 'osm:way/1068999084@0m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（2）', 'Yingfeng Riverside Park (2)'),
  ('Taipei', 'osm:way/1068999086@375m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（3）', 'Yingfeng Riverside Park (3)'),
  ('Taipei', 'osm:way/1068999086@650m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（4）', 'Yingfeng Riverside Park (4)'),
  ('Taipei', 'osm:way/1068999086@925m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（5）', 'Yingfeng Riverside Park (5)'),
  ('Taipei', 'osm:way/1068999086@1200m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（6）', 'Yingfeng Riverside Park (6)'),
  ('Taipei', 'osm:way/1068999086@1475m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（7）', 'Yingfeng Riverside Park (7)'),
  ('Taipei', 'osm:way/1068999086@1750m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（8）', 'Yingfeng Riverside Park (8)'),
  ('Taipei', 'osm:way/1068999086@2025m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（9）', 'Yingfeng Riverside Park (9)'),
  ('Taipei', 'osm:way/1068999086@2325m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（10）', 'Yingfeng Riverside Park (10)'),
  ('Taipei', 'osm:way/1068999086@2600m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（11）', 'Yingfeng Riverside Park (11)'),
  ('Taipei', 'osm:way/354428519@25m;park/way/385941045', null, null, 'common', 'live', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（12）', 'Yingfeng Riverside Park (12)'),
  ('Taipei', 'osm:way/251212756@75m;square/way/251212756', null, null, 'common', 'live', '廣場', 'Square', '廣場', 'Square'),
  ('Taipei', 'osm:way/1166080095@grid-2800_2825m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（2）', 'Square (2)'),
  ('Taipei', 'osm:way/1469168923@grid-1000_1100m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（3）', 'Square (3)'),
  ('Taipei', 'osm:way/374876309@grid-4800_-1800m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（4）', 'Square (4)'),
  ('Taipei', 'osm:way/397020472@grid-650_-5250m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（5）', 'Square (5)'),
  ('Taipei', 'osm:way/420571813@100m;square/way/420571813', null, null, 'common', 'live', '廣場', 'Square', '廣場（6）', 'Square (6)'),
  ('Taipei', 'osm:way/549779381@grid-5000_950m;square', null, null, 'common', 'live', '廣場', 'Square', '廣場（7）', 'Square (7)'),
  ('Taipei', 'osm:node/11491802703;publicArt', null, null, 'common', 'live', '公共藝術', 'Public art', '公共藝術', 'Public art'),
  ('Taipei', 'osm:node/13316223672;publicArt', null, null, 'common', 'live', '公共藝術', 'Race Against Time', '公共藝術（2）', 'Race Against Time (2)'),
  ('Taipei', 'osm:node/7996740405;publicArt', null, null, 'common', 'live', '公共藝術', 'Public art', '公共藝術（3）', 'Public art (3)'),
  ('Taipei', 'osm:way/1068999086@2850m;waterfront/way/468371626', null, null, 'common', 'live', '觀山河濱公園', 'Guanshan Riverside Park', '觀山河濱公園', 'Guanshan Riverside Park'),
  ('Taipei', 'osm:way/1068999086@3125m;waterfront/way/468371626', null, null, 'common', 'live', '觀山河濱公園', 'Guanshan Riverside Park', '觀山河濱公園（2）', 'Guanshan Riverside Park (2)'),
  ('Taipei', 'osm:way/1068999086@3400m;waterfront/way/468371626', null, null, 'common', 'live', '觀山河濱公園', 'Guanshan Riverside Park', '觀山河濱公園（3）', 'Guanshan Riverside Park (3)'),
  ('Taipei', 'osm:way/1071282041@500m;waterfront/way/468371626', null, null, 'common', 'live', '觀山河濱公園', 'Guanshan Riverside Park', '觀山河濱公園（4）', 'Guanshan Riverside Park (4)'),
  ('Taipei', 'osm:way/1070592896@0m;waterfront/way/588528707', null, null, 'common', 'live', '彩虹河濱公園', 'Rainbow Riverside Park', '彩虹河濱公園', 'Rainbow Riverside Park'),
  ('Taipei', 'osm:way/1070592915@0m;waterfront/way/588528707', null, null, 'common', 'live', '彩虹河濱公園', 'Rainbow Riverside Park', '彩虹河濱公園（2）', 'Rainbow Riverside Park (2)'),
  ('Taipei', 'osm:way/1070592932@0m;waterfront/way/588528707', null, null, 'common', 'live', '彩虹河濱公園', 'Rainbow Riverside Park', '彩虹河濱公園（3）', 'Rainbow Riverside Park (3)'),
  ('Taipei', 'osm:way/372126968@0m;waterfront/way/588528707', null, null, 'common', 'live', '彩虹河濱公園', 'Rainbow Riverside Park', '彩虹河濱公園（4）', 'Rainbow Riverside Park (4)'),
  ('Taipei', 'osm:way/1073045362@50m;waterfront/way/588628968', null, null, 'common', 'live', '成美右岸河濱公園', 'Chengmei Riverside Park North', '成美右岸河濱公園', 'Chengmei Riverside Park North'),
  ('Taipei', 'osm:way/344637982@100m;waterfront/way/588628968', null, null, 'common', 'live', '成美右岸河濱公園', 'Chengmei Riverside Park North', '成美右岸河濱公園（2）', 'Chengmei Riverside Park North (2)'),
  ('Taipei', 'osm:way/344637982@375m;waterfront/way/588628968', null, null, 'common', 'live', '成美右岸河濱公園', 'Chengmei Riverside Park North', '成美右岸河濱公園（3）', 'Chengmei Riverside Park North (3)'),
  ('Taipei', 'osm:way/345206627@400m;waterfront/way/588628968', null, null, 'common', 'live', '成美右岸河濱公園', 'Chengmei Riverside Park North', '成美右岸河濱公園（4）', 'Chengmei Riverside Park North (4)'),
  ('Taipei', 'osm:way/1073045399@200m;waterfront/way/596306247', null, null, 'common', 'live', '成美左岸河濱公園', 'Chengmei Riverside Park South', '成美左岸河濱公園', 'Chengmei Riverside Park South'),
  ('Taipei', 'osm:way/1073045426@0m;waterfront/way/596306247', null, null, 'common', 'live', '成美左岸河濱公園', 'Chengmei Riverside Park South', '成美左岸河濱公園（2）', 'Chengmei Riverside Park South (2)'),
  ('Taipei', 'osm:way/1074753352@0m;waterfront/way/43565999', null, null, 'common', 'live', '南湖右岸河濱公園', 'Waterfront', '南湖右岸河濱公園', 'Waterfront'),
  ('Taipei', 'osm:way/1487603285@0m;waterfront/way/43565999', null, null, 'common', 'live', '南湖右岸河濱公園', 'Waterfront', '南湖右岸河濱公園（2）', 'Waterfront (2)'),
  ('Taipei', 'osm:way/1074753380@0m;park/way/43565999', null, null, 'common', 'live', '南湖右岸河濱公園', 'Park', '南湖右岸河濱公園（3）', 'Park (3)'),
  ('Taipei', 'osm:way/1348674308@0m;waterfront/way/156439492', null, null, 'common', 'live', '福德坑環保復育公園', 'Fudekeng Eco-park', '福德坑環保復育公園', 'Fudekeng Eco-park'),
  ('Taipei', 'osm:way/515490697@175m;waterfront/way/156439492', null, null, 'common', 'live', '福德坑環保復育公園', 'Fudekeng Eco-park', '福德坑環保復育公園（2）', 'Fudekeng Eco-park (2)'),
  ('Taipei', 'osm:way/1470381561@100m;park/way/156439492', null, null, 'common', 'live', '福德坑環保復育公園', 'Fudekeng Eco-park', '福德坑環保復育公園（3）', 'Fudekeng Eco-park (3)'),
  ('Taipei', 'osm:way/517696753@100m;park/way/156439492', null, null, 'common', 'live', '福德坑環保復育公園', 'Fudekeng Eco-park', '福德坑環保復育公園（4）', 'Fudekeng Eco-park (4)'),
  ('Taipei', 'osm:way/1382836313@0m;waterfront/way/301927905', null, null, 'common', 'live', '古亭河濱公園', 'Waterfront', '古亭河濱公園', 'Waterfront'),
  ('Taipei', 'osm:way/915818027@0m;park/way/301927905', null, null, 'common', 'live', '古亭河濱公園', 'Park', '古亭河濱公園（2）', 'Park (2)'),
  ('Taipei', 'osm:way/1552133043@125m;waterfront/way/301926728', null, null, 'common', 'live', '溪洲河濱公園', 'Xizhou Riverside Park', '溪洲河濱公園', 'Xizhou Riverside Park'),
  ('Taipei', 'osm:way/1552133043@400m;waterfront/way/301926728', null, null, 'common', 'live', '溪洲河濱公園', 'Xizhou Riverside Park', '溪洲河濱公園（2）', 'Xizhou Riverside Park (2)'),
  ('Taipei', 'osm:way/1552133043@675m;waterfront/way/301926728', null, null, 'common', 'live', '溪洲河濱公園', 'Xizhou Riverside Park', '溪洲河濱公園（3）', 'Xizhou Riverside Park (3)'),
  ('Taipei', 'osm:way/173003788@0m;waterfront/way/314211284', null, null, 'common', 'live', '碧湖公園', 'Bihu Park', '碧湖公園', 'Bihu Park'),
  ('Taipei', 'osm:way/452639053@300m;waterfront/way/314211284', null, null, 'common', 'live', '碧湖公園', 'Bihu Park', '碧湖公園（2）', 'Bihu Park (2)'),
  ('Taipei', 'osm:way/190573757@0m;waterfront/way/189784276', null, null, 'common', 'live', '大湖公園', 'Dahu Park', '大湖公園', 'Dahu Park'),
  ('Taipei', 'osm:way/420466831@0m;waterfront/way/189784276', null, null, 'common', 'live', '大湖公園', 'Dahu Park', '大湖公園（2）', 'Dahu Park (2)'),
  ('Taipei', 'osm:way/198342341@100m;waterfront/way/106335624', null, null, 'common', 'live', '中央藝文公園', 'Central Art Park', '中央藝文公園', 'Central Art Park'),
  ('Taipei', 'osm:way/1454427462@25m;park/way/106335624', null, null, 'common', 'live', '中央藝文公園', 'Central Art Park', '中央藝文公園（2）', 'Central Art Park (2)'),
  ('Taipei', 'osm:way/202681803@0m;waterfront/relation/5117861', null, null, 'common', 'live', '南港公園', 'Nangang Park', '南港公園', 'Nangang Park'),
  ('Taipei', 'osm:way/202941691@300m;waterfront/relation/5117861', null, null, 'common', 'live', '南港公園', 'Nangang Park', '南港公園（2）', 'Nangang Park (2)'),
  ('Taipei', 'osm:way/1160980145@100m;park/relation/4820141', null, null, 'common', 'live', '福州山公園', 'Fujhoushan Park', '福州山公園', 'Fujhoushan Park'),
  ('Taipei', 'osm:way/1280795099@0m;park/relation/4820141', null, null, 'common', 'live', '福州山公園', 'Fujhoushan Park', '福州山公園（2）', 'Fujhoushan Park (2)'),
  ('Taipei', 'osm:way/1229613906@125m;park/way/189781448', null, null, 'common', 'live', '上灣公園', 'Park', '上灣公園', 'Park'),
  ('Taipei', 'osm:way/1229613908@150m;park/way/189781448', null, null, 'common', 'live', '上灣公園', 'Park', '上灣公園（4）', 'Park (4)'),
  ('Taipei', 'osm:way/352005283@150m;park/way/596404742', null, null, 'common', 'live', '內湖復育園區', 'Park', '內湖復育園區', 'Park'),
  ('Taipei', 'osm:way/352005283@425m;park/way/596404742', null, null, 'common', 'live', '內湖復育園區', 'Park', '內湖復育園區（5）', 'Park (5)'),
  ('Taipei', 'osm:way/443216019@25m;park/way/583425394', null, null, 'common', 'live', '公園', 'Park', '公園', 'Park'),
  ('Taipei', 'osm:way/695599094@25m;park/way/695599093', null, null, 'common', 'live', '公園', 'Park', '公園（6）', 'Park (6)'),
  ('Taipei', 'admin:6ffc548d-6055-477b-b6be-eb1d08daf08d', null, null, 'common', 'live', '技藝天熊貓夢露', 'Panda Sarasvati-Monroe II', '技藝天熊貓夢露', 'Panda Sarasvati-Monroe II'),
  ('Taipei', 'admin:9a21dbfe-35ac-42c6-a242-a33b52d8fe3a', null, null, 'common', 'live', '技藝天熊貓夢露（2）', 'Panda Sarasvati-Monroe II (2)', '技藝天熊貓夢露（2）', 'Panda Sarasvati-Monroe II (2)'),
  ('Taipei', 'admin:ab071d9f-1b56-4d74-acd0-0e19d19fd478', null, null, 'common', 'live', '蝦皮店到店（2）', 'Shopee Xpress (2)', '蝦皮店到店', 'Shopee Xpress'),
  ('Taipei', 'admin:be103273-f42e-422a-9ef0-cfd1cf21a597', null, null, 'common', 'live', '蝦皮店到店', 'Shopee Xpress', '蝦皮店到店（2）', 'Shopee Xpress (2)');

create temp table waypost_name_targets on commit drop as
select p.id, to_jsonb(p) as before, p.status as current_status, p.kind as current_kind,
  p.name_zh as current_zh, p.name_en as current_en, n.*
from pg_temp.waypost_name_plan n
join public.public_capsule_spots p on p.city_en = n.city_en
  and p.source_ref is not distinct from n.source_ref
  and (n.source_ref is not null or (p.lat, p.lng) = (n.lat, n.lng))
where p.status <> 'deleted';

do $$
begin
  -- A changed name, kind or status can change which place should keep the plain name.
  if exists (
    select from pg_temp.waypost_name_targets n
    where n.current_kind <> n.kind or n.current_status <> n.status
      or ((n.current_zh, n.current_en) is distinct from (n.old_zh, n.old_en)
        and (n.current_zh, n.current_en) is distinct from (n.new_zh, n.new_en))
  ) then raise exception 'waypost_name_plan_stale'; end if;

  -- Check the reviewed numbers against any later additions before making edits.
  if exists (
    select from pg_temp.waypost_name_targets n
    join public.public_capsule_spots p on p.city_en = n.city_en
      and p.id <> n.id and p.status <> 'deleted'
    left join pg_temp.waypost_name_targets target on target.id = p.id
    where (n.current_zh, n.current_en) is distinct from (n.new_zh, n.new_en)
      and (coalesce(target.new_zh, p.name_zh) = n.new_zh
        or (n.new_en ~ '[[:space:]][(][0-9]+[)]$'
          and coalesce(target.new_en, p.name_en) = n.new_en))
  ) then raise exception 'waypost_name_plan_collision'; end if;
end;
$$;

with saved as (
  update public.public_capsule_spots w
  set name_zh = n.new_zh, name_en = n.new_en
  from pg_temp.waypost_name_targets n
  where w.id = n.id
    and (n.current_zh, n.current_en) is distinct from (n.new_zh, n.new_en)
  returning w.id, w.name_en, n.before, to_jsonb(w) as after
)
insert into private.admin_actions (actor, actor_snapshot, action, target_type, target_id,
  target_label, before, after, note)
select '00000000-0000-0000-0000-000000000000',
  '{"id":"00000000-0000-0000-0000-000000000000","name":"Map Builder migration","avatar":null}',
  'waypost.edit', 'waypost', id::text, name_en, before, after,
  'Normalize the matching bracketed Waypost names.'
from saved order by id;

drop table pg_temp.waypost_name_targets;
drop table pg_temp.waypost_name_plan;

commit;
