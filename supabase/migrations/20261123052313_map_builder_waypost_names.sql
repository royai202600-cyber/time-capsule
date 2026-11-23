-- Waypost names reviewed against the hosted inventory. Match seed source refs
-- so the same patch works where the seed data has different generated UUIDs.
begin;

select private.lock_game_edits();
lock table public.public_capsule_spots in share row exclusive mode;

create temp table waypost_name_plan (
  city_en text, source_ref text, old_zh text, old_en text, new_zh text, new_en text,
  primary key (city_en, source_ref)
) on commit drop;

insert into pg_temp.waypost_name_plan values
  ('Hong Kong', 'osm:way/1354785439@150m;park/relation/12719231', '柴灣公園', 'Chai Wan Park', '柴灣公園（2）', 'Chai Wan Park (2)'),
  ('Hong Kong', 'osm:way/1047369147@450m;waterfront/way/734745074', '中環碼頭海濱長廊', 'Central Pier Waterfront', '中環碼頭海濱長廊（2）', 'Central Pier Waterfront (2)'),
  ('Hong Kong', 'osm:way/102642100@50m;park/relation/12919867', '尖沙咀海濱花園', 'Tsim Sha Tsui Promenade', '尖沙咀海濱花園（2）', 'Tsim Sha Tsui Promenade (2)'),
  ('Hong Kong', 'osm:way/184475460@25m;park/relation/12919867', '尖沙咀海濱花園', 'Tsim Sha Tsui Promenade', '尖沙咀海濱花園（3）', 'Tsim Sha Tsui Promenade (3)'),
  ('Hong Kong', 'osm:way/102642100@375m;waterfront/relation/12919867', '尖沙咀海濱花園', 'Tsim Sha Tsui Promenade', '尖沙咀海濱花園（4）', 'Tsim Sha Tsui Promenade (4)'),
  ('Hong Kong', 'osm:way/102225781@0m;waterfront/relation/12921008', '鰂魚涌公園', 'Quarry Bay Park', '鰂魚涌公園（2）', 'Quarry Bay Park (2)'),
  ('Hong Kong', 'osm:way/605236403@0m;park/way/605236404', '公園', 'Public park', '公園（2）', 'Public park (2)'),
  ('Hong Kong', 'osm:way/417590439@25m;park/way/675493141', '公園', 'Park', '公園（3）', 'Park (3)'),
  ('Hong Kong', 'osm:way/133164724@200m;park/way/675496677', '公園', 'Park', '公園（4）', 'Park (4)'),
  ('Hong Kong', 'osm:way/830380982@25m;park/way/775969233', '公園', 'Park', '公園（5）', 'Park (5)'),
  ('Hong Kong', 'osm:way/1117814985@250m;waterfront/way/1086874057', '海濱步道', 'Waterfront', '海濱步道（2）', 'Waterfront (2)'),
  ('Hong Kong', 'osm:way/1313794177@25m;waterfront/way/1122405295', '海濱步道', 'Waterfront', '海濱步道（3）', 'Waterfront (3)'),
  ('Hong Kong', 'osm:way/1391725362@125m;waterfront/way/1391725364', '海濱步道', 'Waterfront', '海濱步道（4）', 'Waterfront (4)'),
  ('Hong Kong', 'osm:way/808453789@175m;waterfront/way/1234351380', '海濱步道', 'Waterfront', '海濱步道（5）', 'Waterfront (5)'),
  ('Hong Kong', 'osm:way/190033893@0m;park/way/97788544', '香港抗戰及海防博物館', 'Hong Kong Museum of the War of Resistance and Coastal Defence', '香港抗戰及海防博物館（2）', 'Hong Kong Museum of the War of Resistance and Coastal Defence (2)'),
  ('Hong Kong', 'osm:way/184761787@100m;waterfront/relation/12910298', '灣仔臨時海濱花園', 'Wan Chai Temporary Promenade', '灣仔臨時海濱花園（2）', 'Wan Chai Temporary Promenade (2)'),
  ('Hong Kong', 'osm:way/962163330@0m;park/relation/14893771', '牛池灣公園', 'Ngau Chi Wan Park', '牛池灣公園（2）', 'Ngau Chi Wan Park (2)'),
  ('Hong Kong', 'osm:way/765942655@250m;waterfront/way/675488827', '將軍澳南海濱長廊', 'Tseung Kwan O South Waterfront Promenade', '將軍澳南海濱長廊（2）', 'Tseung Kwan O South Waterfront Promenade (2)'),
  ('Hong Kong', 'osm:way/765942655@525m;waterfront/way/675488827', '將軍澳南海濱長廊', 'Tseung Kwan O South Waterfront Promenade', '將軍澳南海濱長廊（3）', 'Tseung Kwan O South Waterfront Promenade (3)'),
  ('Hong Kong', 'osm:way/96376731@225m;park/way/948193845', '山頂公園', 'Victoria Peak Garden', '山頂公園（2）', 'Victoria Peak Garden (2)'),
  ('Hong Kong', 'osm:way/1365729408@grid-1925_1925m;square', '廣場', 'Square', '廣場（2）', 'Square (2)'),
  ('Hong Kong', 'osm:way/1371000423@grid5300_2150m;square', '廣場', 'Square', '廣場（3）', 'Square (3)'),
  ('Hong Kong', 'osm:way/312192947@25m;square/way/312192960', '廣場', 'Square', '廣場（4）', 'Square (4)'),
  ('Hong Kong', 'osm:way/914287397@50m;square/way/914287397', '廣場', 'Square', '廣場（5）', 'Square (5)'),
  ('Hong Kong', 'osm:way/28379385@125m;park/way/4977404', '九龍公園', 'Kowloon Park', '九龍公園（2）', 'Kowloon Park (2)'),
  ('Hong Kong', 'osm:way/1343926517@200m;park/relation/12076859', '啟德體育園', 'Kai Tak Sports Park', '啟德體育園（2）', 'Kai Tak Sports Park (2)'),
  ('Hong Kong', 'osm:way/152653225@25m;waterfront/way/961605650', '小西灣海濱花園', 'Siu Sai Wan Promenade', '小西灣海濱花園（2）', 'Siu Sai Wan Promenade (2)'),
  ('Hong Kong', 'osm:way/151705980@0m;park/way/25609090', '荔枝角公園', 'Lai Chi Kok Park', '荔枝角公園（2）', 'Lai Chi Kok Park (2)'),
  ('Hong Kong', 'osm:way/158664642@100m;park/way/25609090', '荔枝角公園', 'Lai Chi Kok Park', '荔枝角公園（3）', 'Lai Chi Kok Park (3)'),
  ('Hong Kong', 'osm:way/234899728@0m;park/way/25609090', '荔枝角公園', 'Lai Chi Kok Park', '荔枝角公園（4）', 'Lai Chi Kok Park (4)'),
  ('Macau', 'osm:way/422643353@100m;park/way/346900281', '區華利前地', '區華利前地 Lazer de Praça de Jorge Álvares', '區華利前地（2）', '區華利前地 Lazer de Praça de Jorge Álvares (2)'),
  ('Macau', 'osm:way/710432483@0m;park/way/488185729', '大炮台公園', '大炮台公園 Parque da Fortaleza do Monte', '大炮台公園（2）', '大炮台公園 Parque da Fortaleza do Monte (2)'),
  ('Macau', 'osm:way/240933853@300m;park/way/960068373', '公園', 'Public park', '公園（2）', 'Public park (2)'),
  ('Macau', 'osm:way/240933889@25m;park/way/1279798979', '公園', 'Public park', '公園（3）', 'Public park (3)'),
  ('Macau', 'osm:way/679384115@100m;park/way/1313399517', '公園', 'Public park', '公園（4）', 'Public park (4)'),
  ('Macau', 'osm:way/770557470@25m;park/way/192180025', '觀音像海濱休憩區', '觀音像海濱休憩區 Zona de Lazer da Marginal da Estátua de Kun Iam', '觀音像海濱休憩區（2）', '觀音像海濱休憩區 Zona de Lazer da Marginal da Estátua de Kun Iam (2)'),
  ('Macau', 'osm:way/330914462@0m;park/way/305387668', '回歸公園', '回歸公園 Jardim da Rua de Malaca', '回歸公園（2）', '回歸公園 Jardim da Rua de Malaca (2)'),
  ('Macau', 'osm:way/769926706@825m;waterfront/way/405826614', '氹仔海濱休憩區', 'Zona de Lazer da Marginal da Taipa', '氹仔海濱休憩區（2）', 'Zona de Lazer da Marginal da Taipa (2)'),
  ('Macau', 'osm:way/944736302@25m;waterfront/way/405826614', '氹仔海濱休憩區', 'Zona de Lazer da Marginal da Taipa', '氹仔海濱休憩區（3）', 'Zona de Lazer da Marginal da Taipa (3)'),
  ('Macau', 'osm:way/405596065@25m;park/relation/11551012', '宋玉生公園', 'Dr. Carlos D''Assumpcao Park', '宋玉生公園（2）', 'Dr. Carlos D''Assumpcao Park (2)'),
  ('Macau', 'osm:way/778862867@125m;waterfront/relation/10266786', '水塘公園', 'Reservoir Park', '水塘公園（2）', 'Reservoir Park (2)'),
  ('Singapore', 'osm:way/687917300', '魚尾獅公園', 'Merlion Park', '魚尾獅公園（2）', 'Merlion Park (2)'),
  ('Singapore', 'osm:way/164881350@0m;park/way/687917300', '魚尾獅公園', 'Merlion Park', '魚尾獅公園（3）', 'Merlion Park (3)'),
  ('Singapore', 'osm:way/1155359166@25m;square/way/1155359166', '廣場', 'Square', '廣場（2）', 'Square (2)'),
  ('Singapore', 'osm:way/116818163@100m;square/way/116818163', '廣場', 'Square', '廣場（3）', 'Square (3)'),
  ('Singapore', 'osm:way/1557262991@25m;square/way/1557262991', '廣場', 'Square', '廣場（4）', 'Square (4)'),
  ('Singapore', 'osm:way/1561978139@100m;square/way/1561978139', '廣場', 'Square', '廣場（5）', 'Square (5)'),
  ('Singapore', 'osm:way/162525974@275m;square/way/172015629', '廣場', 'Event Plaza', '廣場（6）', 'Event Plaza (6)'),
  ('Singapore', 'osm:way/216223896@75m;square/way/218268266', '廣場', 'Square', '廣場（7）', 'Square (7)'),
  ('Singapore', 'osm:way/266998785@grid-4450_-2925m;square', '廣場', 'Square', '廣場（8）', 'Square (8)'),
  ('Singapore', 'osm:way/41659829@25m;square/way/474288906', '廣場', 'Square', '廣場（9）', 'Square (9)'),
  ('Singapore', 'osm:way/474763401@grid-1150_50m;square', '廣場', 'Square', '廣場（10）', 'Square (10)'),
  ('Singapore', 'osm:way/480175918@25m;square/way/480632927', '廣場', 'Square', '廣場（11）', 'Square (11)'),
  ('Singapore', 'osm:way/616972594@grid-3000_-2375m;square', '廣場', 'Square', '廣場（12）', 'Square (12)'),
  ('Singapore', 'osm:way/739513984@grid-850_-625m;square', '廣場', 'Square', '廣場（13）', 'Square (13)'),
  ('Singapore', 'osm:way/47257473@0m;park/way/47257476', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園（2）', 'Singapore Botanic Gardens (2)'),
  ('Singapore', 'osm:way/142598070@0m;park/way/47257476', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園（3）', 'Singapore Botanic Gardens (3)'),
  ('Singapore', 'osm:way/142709443@0m;park/way/47257476', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園（4）', 'Singapore Botanic Gardens (4)'),
  ('Singapore', 'osm:way/173623386@0m;park/way/47257476', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園（5）', 'Singapore Botanic Gardens (5)'),
  ('Singapore', 'osm:way/528905435@25m;park/way/47257476', '新加坡植物園', 'Singapore Botanic Gardens', '新加坡植物園（6）', 'Singapore Botanic Gardens (6)'),
  ('Singapore', 'osm:way/170967529@25m;park/way/1387617423', '公園', 'Public park', '公園（2）', 'Public park (2)'),
  ('Singapore', 'osm:way/481965624@25m;park/way/481965622', '公園', 'Public park', '公園（3）', 'Public park (3)'),
  ('Singapore', 'osm:way/532056050@25m;park/way/1387617423', '公園', 'Public park', '公園（4）', 'Public park (4)'),
  ('Singapore', 'osm:way/1321546690@25m;waterfront/way/439331643', '海濱步道', 'Whampoa Park', '海濱步道（5）', 'Whampoa Park (5)'),
  ('Singapore', 'osm:way/1462539158@100m;waterfront/way/567248094', '海濱步道', 'Greenville Garden Park', '海濱步道（6）', 'Greenville Garden Park (6)'),
  ('Singapore', 'osm:way/1462539158@375m;waterfront/way/567248094', '海濱步道', 'Greenville Garden Park', '海濱步道（7）', 'Greenville Garden Park (7)'),
  ('Singapore', 'osm:way/1487214819@50m;waterfront/way/681191987', '海濱步道', 'Waterfront', '海濱步道（8）', 'Waterfront (8)'),
  ('Singapore', 'osm:way/1516352605@0m;waterfront/way/174721786', '海濱步道', 'East Coast Park (Zone B)', '海濱步道（9）', 'East Coast Park (Zone B) (9)'),
  ('Singapore', 'osm:way/1562172955@50m;waterfront/way/1562172958', '海濱步道', 'Waterfront', '海濱步道（10）', 'Waterfront (10)'),
  ('Singapore', 'osm:way/229630825@75m;waterfront/way/174721786', '海濱步道', 'East Coast Park (Zone B)', '海濱步道（11）', 'East Coast Park (Zone B) (11)'),
  ('Singapore', 'osm:way/395801750@25m;waterfront/way/552973480', '海濱步道', 'Waterfront', '海濱步道（12）', 'Waterfront (12)'),
  ('Singapore', 'osm:way/455246456@0m;waterfront/way/174721786', '海濱步道', 'East Coast Park (Zone B)', '海濱步道（13）', 'East Coast Park (Zone B) (13)'),
  ('Singapore', 'osm:way/455246818@350m;waterfront/way/174721786', '海濱步道', 'East Coast Park (Zone B)', '海濱步道（14）', 'East Coast Park (Zone B) (14)'),
  ('Singapore', 'osm:way/845223323@375m;waterfront/way/41662337', '海濱步道', 'Domain of the Istana', '海濱步道（15）', 'Domain of the Istana (15)'),
  ('Singapore', 'osm:way/910675266@0m;waterfront/way/904611455', '海濱步道', 'East Coast Park (Zone A)', '海濱步道（16）', 'East Coast Park (Zone A) (16)'),
  ('Singapore', 'osm:way/1182941686@0m;park/way/1153434547', '公園', 'Park', '公園（17）', 'Park (17)'),
  ('Singapore', 'osm:way/1217599789@25m;park/way/306458376', '公園', 'Toa Payoh Sensory Park', '公園（18）', 'Toa Payoh Sensory Park (18)'),
  ('Singapore', 'osm:way/1352481434@0m;park/way/1232950362', '公園', 'Pek Kio Park', '公園（19）', 'Pek Kio Park (19)'),
  ('Singapore', 'osm:way/1436377747@0m;park/way/683635206', '公園', 'Park', '公園（20）', 'Park (20)'),
  ('Singapore', 'osm:way/150829211@0m;park/way/904611455', '公園', 'East Coast Park (Zone A)', '公園（21）', 'East Coast Park (Zone A) (21)'),
  ('Singapore', 'osm:way/314523100@25m;park/way/863261570', '公園', 'Park', '公園（22）', 'Park (22)'),
  ('Singapore', 'osm:way/455246818@1300m;park/way/174721786', '公園', 'East Coast Park (Zone B)', '公園（23）', 'East Coast Park (Zone B) (23)'),
  ('Singapore', 'osm:way/455246818@2050m;park/way/23161989', '公園', 'East Coast Park (Zone C)', '公園（24）', 'East Coast Park (Zone C) (24)'),
  ('Singapore', 'osm:way/496173180@75m;park/way/52235098', '公園', 'Penang Road Open Space', '公園（25）', 'Penang Road Open Space (25)'),
  ('Singapore', 'osm:way/546702695@0m;park/way/358462339', '公園', 'Arena Park', '公園（26）', 'Arena Park (26)'),
  ('Singapore', 'osm:way/918147746@525m;park/way/736934929', '新加坡植物園加洛普延伸區', 'Singapore Botanic Gardens Gallop Extension', '新加坡植物園加洛普延伸區（2）', 'Singapore Botanic Gardens Gallop Extension (2)'),
  ('Singapore', 'osm:way/310894901@175m;park/relation/15394784', '直落布蘭雅山公園', 'Telok Blangah Hill Park', '直落布蘭雅山公園（2）', 'Telok Blangah Hill Park (2)'),
  ('Singapore', 'osm:way/616747718@100m;park/relation/15394784', '直落布蘭雅山公園', 'Telok Blangah Hill Park', '直落布蘭雅山公園（3）', 'Telok Blangah Hill Park (3)'),
  ('Singapore', 'osm:way/462914029@50m;park/way/116905791', '濱海灣草坪', 'The Lawn@Marina Bay', '濱海灣草坪（2）', 'The Lawn@Marina Bay (2)'),
  ('Singapore', 'osm:way/172297168@25m;park/relation/10231144', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（2）', 'Gardens by the Bay (2)'),
  ('Singapore', 'osm:way/172297177@0m;park/relation/10231144', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（3）', 'Gardens by the Bay (3)'),
  ('Singapore', 'osm:way/172297193@0m;park/relation/10231144', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（4）', 'Gardens by the Bay (4)'),
  ('Singapore', 'osm:way/172297202@0m;park/relation/10231144', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（5）', 'Gardens by the Bay (5)'),
  ('Singapore', 'osm:way/884590174@25m;park/relation/10231144', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（6）', 'Gardens by the Bay (6)'),
  ('Singapore', 'osm:way/849812573@150m;waterfront/relation/10231144', '濱海灣花園', 'Gardens by the Bay', '濱海灣花園（7）', 'Gardens by the Bay (7)'),
  ('Singapore', 'osm:node/10554386876;publicArt', '公共藝術', 'Public art', '公共藝術（2）', 'Public art (2)'),
  ('Singapore', 'osm:node/6461554413;publicArt', '公共藝術', 'Red Memory-Smile', '公共藝術（3）', 'Red Memory-Smile (3)'),
  ('Singapore', 'osm:way/1168861565@25m;park/way/343746558', '花柏山公園', 'Mount Faber Park', '花柏山公園（2）', 'Mount Faber Park (2)'),
  ('Singapore', 'osm:way/1408952013@75m;park/way/343746558', '花柏山公園', 'Mount Faber Park', '花柏山公園（3）', 'Mount Faber Park (3)'),
  ('Singapore', 'osm:way/46521277@325m;square/way/474288886', '烏節寶龍坊', 'Orchard Promenade', '烏節寶龍坊（2）', 'Orchard Promenade (2)'),
  ('Singapore', 'osm:way/474288886@grid-1475_1350m;square', '烏節寶龍坊', 'Orchard Promenade', '烏節寶龍坊（3）', 'Orchard Promenade (3)'),
  ('Singapore', 'osm:way/1160524558@50m;park/relation/15693200', '比達達利綠道', 'Bidadari Greenway', '比達達利綠道（2）', 'Bidadari Greenway (2)'),
  ('Singapore', 'osm:way/1507448916@0m;garden/way/1507448913', '花園', 'Garden', '花園（2）', 'Garden (2)'),
  ('Singapore', 'osm:way/252086126@0m;park/way/16892550', '福康寧公園', 'Fort Canning Park', '福康寧公園（2）', 'Fort Canning Park (2)'),
  ('Singapore', 'osm:way/702901686@50m;park/way/16892550', '福康寧公園', 'Fort Canning Park', '福康寧公園（3）', 'Fort Canning Park (3)'),
  ('Singapore', 'osm:way/172263096@0m;park/way/106193383', '萊佛士坊公園', 'Raffles Place Park', '萊佛士坊公園（2）', 'Raffles Place Park (2)'),
  ('Taipei', 'osm:way/1001730484@25m;waterfront/way/764011467', '海濱步道', 'Waterfront', '海濱步道（2）', 'Waterfront (2)'),
  ('Taipei', 'osm:way/1074753352@0m;waterfront/way/43565999', '南湖右岸河濱公園', 'Waterfront', '南湖右岸河濱公園（3）', 'Waterfront (3)'),
  ('Taipei', 'osm:way/1382836313@0m;waterfront/way/301927905', '古亭河濱公園', 'Waterfront', '古亭河濱公園（4）', 'Waterfront (4)'),
  ('Taipei', 'osm:way/1487603285@0m;waterfront/way/43565999', '南湖右岸河濱公園', 'Waterfront', '南湖右岸河濱公園（5）', 'Waterfront (5)'),
  ('Taipei', 'osm:way/1576485955@0m;waterfront/way/349570046', '中正河濱公園', 'Waterfront', '中正河濱公園（6）', 'Waterfront (6)'),
  ('Taipei', 'osm:way/305394501@75m;waterfront/way/504669513', '管材藝術區', 'Waterfront', '管材藝術區（7）', 'Waterfront (7)'),
  ('Taipei', 'osm:way/718263433@0m;waterfront/way/302249040', '公館水岸廣場', 'Waterfront', '公館水岸廣場（8）', 'Waterfront (8)'),
  ('Taipei', 'osm:way/826112870@0m;waterfront/way/212404916', '蔣渭水先生紀念廣場', 'Waterfront', '蔣渭水先生紀念廣場（9）', 'Waterfront (9)'),
  ('Taipei', 'osm:way/1042354472@0m;park/way/72380602', '華固綠大地', 'Park', '華固綠大地（10）', 'Park (10)'),
  ('Taipei', 'osm:way/1074753380@0m;park/way/43565999', '南湖右岸河濱公園', 'Park', '南湖右岸河濱公園（11）', 'Park (11)'),
  ('Taipei', 'osm:way/1168979631@0m;park/relation/14636498', '文德三號公園', 'Park', '文德三號公園（12）', 'Park (12)'),
  ('Taipei', 'osm:way/1229613906@125m;park/way/189781448', '上灣公園', 'Park', '上灣公園（13）', 'Park (13)'),
  ('Taipei', 'osm:way/1229613908@150m;park/way/189781448', '上灣公園', 'Park', '上灣公園（14）', 'Park (14)'),
  ('Taipei', 'osm:way/1277957498@100m;park/way/317031161', '美麗獅子公圜', 'Park', '美麗獅子公圜（15）', 'Park (15)'),
  ('Taipei', 'osm:way/1469141296@0m;park/way/718041352', '博嘉公園', 'Park', '博嘉公園（16）', 'Park (16)'),
  ('Taipei', 'osm:way/1564134462@25m;park/relation/7832374', '塔城公園', 'Park', '塔城公園（17）', 'Park (17)'),
  ('Taipei', 'osm:way/352005283@150m;park/way/596404742', '內湖復育園區', 'Park', '內湖復育園區（18）', 'Park (18)'),
  ('Taipei', 'osm:way/352005283@425m;park/way/596404742', '內湖復育園區', 'Park', '內湖復育園區（19）', 'Park (19)'),
  ('Taipei', 'osm:way/443216019@25m;park/way/583425394', '公園', 'Park', '公園（20）', 'Park (20)'),
  ('Taipei', 'osm:way/556419965@50m;park/way/556419964', '綠地', 'Park', '綠地（21）', 'Park (21)'),
  ('Taipei', 'osm:way/600025469@250m;park/way/183864398', '上塔悠公園', 'Park', '上塔悠公園（22）', 'Park (22)'),
  ('Taipei', 'osm:way/695599094@25m;park/way/695599093', '公園', 'Park', '公園（23）', 'Park (23)'),
  ('Taipei', 'osm:way/858961978@0m;park/way/538617831', '八二三砲戰紀念公園', 'Park', '八二三砲戰紀念公園（24）', 'Park (24)'),
  ('Taipei', 'osm:way/915818027@0m;park/way/301927905', '古亭河濱公園', 'Park', '古亭河濱公園（25）', 'Park (25)'),
  ('Taipei', 'osm:way/136814868@125m;park/way/555117276', '台北世貿廣場', '台北世貿廣場', '台北世貿廣場（2）', '台北世貿廣場 (2)'),
  ('Taipei', 'osm:way/1093147368@25m;square/way/1093147368', '微風平台', 'Square', '微風平台（2）', 'Square (2)'),
  ('Taipei', 'osm:way/1166080095@grid-2800_2825m;square', '廣場', 'Square', '廣場（3）', 'Square (3)'),
  ('Taipei', 'osm:way/1469168923@grid-1000_1100m;square', '廣場', 'Square', '廣場（4）', 'Square (4)'),
  ('Taipei', 'osm:way/261737312@25m;square/way/261737312', '黃蟬園', 'Square', '黃蟬園（5）', 'Square (5)'),
  ('Taipei', 'osm:way/298601634@50m;square/way/298601634', '圓形空地', 'Square', '圓形空地（6）', 'Square (6)'),
  ('Taipei', 'osm:way/374876309@grid-4800_-1800m;square', '廣場', 'Square', '廣場（7）', 'Square (7)'),
  ('Taipei', 'osm:way/376248649@25m;square/way/376248649', '景觀台', 'Square', '景觀台（8）', 'Square (8)'),
  ('Taipei', 'osm:way/397020472@grid-650_-5250m;square', '廣場', 'Square', '廣場（9）', 'Square (9)'),
  ('Taipei', 'osm:way/420571813@100m;square/way/420571813', '廣場', 'Square', '廣場（10）', 'Square (10)'),
  ('Taipei', 'osm:way/549779381@grid-5000_950m;square', '廣場', 'Square', '廣場（11）', 'Square (11)'),
  ('Taipei', 'osm:way/452639053@300m;waterfront/way/314211284', '碧湖公園', 'Bihu Park', '碧湖公園（2）', 'Bihu Park (2)'),
  ('Taipei', 'osm:way/344637982@100m;waterfront/way/588628968', '成美右岸河濱公園', 'Chengmei Riverside Park North', '成美右岸河濱公園（2）', 'Chengmei Riverside Park North (2)'),
  ('Taipei', 'osm:way/344637982@375m;waterfront/way/588628968', '成美右岸河濱公園', 'Chengmei Riverside Park North', '成美右岸河濱公園（3）', 'Chengmei Riverside Park North (3)'),
  ('Taipei', 'osm:way/345206627@400m;waterfront/way/588628968', '成美右岸河濱公園', 'Chengmei Riverside Park North', '成美右岸河濱公園（4）', 'Chengmei Riverside Park North (4)'),
  ('Taipei', 'osm:node/13316223672;publicArt', '公共藝術', 'Race Against Time', '公共藝術（2）', 'Race Against Time (2)'),
  ('Taipei', 'osm:node/5751124159;publicArt', '網球之光', 'Public art', '網球之光（3）', 'Public art (3)'),
  ('Taipei', 'osm:node/7996740405;publicArt', '公共藝術', 'Public art', '公共藝術（4）', 'Public art (4)'),
  ('Taipei', 'osm:way/356780466@25m;park/relation/11791159', '大佳河濱公園', 'Dajia Park', '大佳河濱公園（2）', 'Dajia Park (2)'),
  ('Taipei', 'osm:way/356780468@75m;park/relation/11791159', '大佳河濱公園', 'Dajia Park', '大佳河濱公園（3）', 'Dajia Park (3)'),
  ('Taipei', 'osm:way/484308801@75m;park/relation/11791159', '大佳河濱公園', 'Dajia Park', '大佳河濱公園（4）', 'Dajia Park (4)'),
  ('Taipei', 'osm:way/484323776@0m;park/relation/11791159', '大佳河濱公園', 'Dajia Park', '大佳河濱公園（5）', 'Dajia Park (5)'),
  ('Taipei', 'osm:way/1068999086@3125m;waterfront/way/468371626', '觀山河濱公園', 'Guanshan Riverside Park', '觀山河濱公園（2）', 'Guanshan Riverside Park (2)'),
  ('Taipei', 'osm:way/1068999086@3400m;waterfront/way/468371626', '觀山河濱公園', 'Guanshan Riverside Park', '觀山河濱公園（3）', 'Guanshan Riverside Park (3)'),
  ('Taipei', 'osm:way/1071282041@500m;waterfront/way/468371626', '觀山河濱公園', 'Guanshan Riverside Park', '觀山河濱公園（4）', 'Guanshan Riverside Park (4)'),
  ('Taipei', 'osm:way/49195990@75m;park/way/1227733215', '大安森林公園', 'Da-an Forest Park', '大安森林公園（2）', 'Da-an Forest Park (2)'),
  ('Taipei', 'osm:way/49695623@0m;park/way/1227733215', '大安森林公園', 'Da-an Forest Park', '大安森林公園（3）', 'Da-an Forest Park (3)'),
  ('Taipei', 'osm:way/192030076@50m;park/way/1227733215', '大安森林公園', 'Da-an Forest Park', '大安森林公園（4）', 'Da-an Forest Park (4)'),
  ('Taipei', 'osm:way/515490697@175m;waterfront/way/156439492', '福德坑環保復育公園', 'Fudekeng Eco-park', '福德坑環保復育公園（2）', 'Fudekeng Eco-park (2)'),
  ('Taipei', 'osm:way/1470381561@100m;park/way/156439492', '福德坑環保復育公園', 'Fudekeng Eco-park', '福德坑環保復育公園（3）', 'Fudekeng Eco-park (3)'),
  ('Taipei', 'osm:way/517696753@100m;park/way/156439492', '福德坑環保復育公園', 'Fudekeng Eco-park', '福德坑環保復育公園（4）', 'Fudekeng Eco-park (4)'),
  ('Taipei', 'osm:way/1454427462@25m;park/way/106335624', '中央藝文公園', 'Central Art Park', '中央藝文公園（2）', 'Central Art Park (2)'),
  ('Taipei', 'osm:way/1068999084@0m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（2）', 'Yingfeng Riverside Park (2)'),
  ('Taipei', 'osm:way/1068999086@375m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（3）', 'Yingfeng Riverside Park (3)'),
  ('Taipei', 'osm:way/1068999086@650m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（4）', 'Yingfeng Riverside Park (4)'),
  ('Taipei', 'osm:way/1068999086@925m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（5）', 'Yingfeng Riverside Park (5)'),
  ('Taipei', 'osm:way/1068999086@1200m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（6）', 'Yingfeng Riverside Park (6)'),
  ('Taipei', 'osm:way/1068999086@1475m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（7）', 'Yingfeng Riverside Park (7)'),
  ('Taipei', 'osm:way/1068999086@1750m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（8）', 'Yingfeng Riverside Park (8)'),
  ('Taipei', 'osm:way/1068999086@2025m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（9）', 'Yingfeng Riverside Park (9)'),
  ('Taipei', 'osm:way/1068999086@2325m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（10）', 'Yingfeng Riverside Park (10)'),
  ('Taipei', 'osm:way/1068999086@2600m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（11）', 'Yingfeng Riverside Park (11)'),
  ('Taipei', 'osm:way/354428519@25m;park/way/385941045', '迎風河濱公園', 'Yingfeng Riverside Park', '迎風河濱公園（12）', 'Yingfeng Riverside Park (12)'),
  ('Taipei', 'osm:way/420466831@0m;waterfront/way/189784276', '大湖公園', 'Dahu Park', '大湖公園（2）', 'Dahu Park (2)'),
  ('Taipei', 'osm:way/49153748@25m;park/relation/4727715', '中山公園', 'Zhongshan Park', '中山公園（2）', 'Zhongshan Park (2)'),
  ('Taipei', 'osm:way/49153748@300m;park/relation/4727715', '中山公園', 'Zhongshan Park', '中山公園（3）', 'Zhongshan Park (3)'),
  ('Taipei', 'osm:way/1334831345@25m;park/relation/4727715', '中山公園', 'Zhongshan Park', '中山公園（4）', 'Zhongshan Park (4)'),
  ('Taipei', 'osm:way/1070592915@0m;waterfront/way/588528707', '彩虹河濱公園', 'Rainbow Riverside Park', '彩虹河濱公園（2）', 'Rainbow Riverside Park (2)'),
  ('Taipei', 'osm:way/1070592932@0m;waterfront/way/588528707', '彩虹河濱公園', 'Rainbow Riverside Park', '彩虹河濱公園（3）', 'Rainbow Riverside Park (3)'),
  ('Taipei', 'osm:way/372126968@0m;waterfront/way/588528707', '彩虹河濱公園', 'Rainbow Riverside Park', '彩虹河濱公園（4）', 'Rainbow Riverside Park (4)'),
  ('Taipei', 'osm:way/1056884091@0m;waterfront/way/385941046', '美堤河濱公園', 'Meiti Riverside Park', '美堤河濱公園（2）', 'Meiti Riverside Park (2)'),
  ('Taipei', 'osm:way/360057679@25m;waterfront/way/385941046', '美堤河濱公園', 'Meiti Riverside Park', '美堤河濱公園（3）', 'Meiti Riverside Park (3)'),
  ('Taipei', 'osm:way/202941691@300m;waterfront/relation/5117861', '南港公園', 'Nangang Park', '南港公園（2）', 'Nangang Park (2)'),
  ('Taipei', 'osm:way/1552133043@400m;waterfront/way/301926728', '溪洲河濱公園', 'Xizhou Riverside Park', '溪洲河濱公園（2）', 'Xizhou Riverside Park (2)'),
  ('Taipei', 'osm:way/1552133043@675m;waterfront/way/301926728', '溪洲河濱公園', 'Xizhou Riverside Park', '溪洲河濱公園（3）', 'Xizhou Riverside Park (3)'),
  ('Taipei', 'osm:way/319526552@300m;park/way/27244215', '象山公園', 'Xiangshan Park', '象山公園（2）', 'Xiangshan Park (2)'),
  ('Taipei', 'osm:way/1073045426@0m;waterfront/way/596306247', '成美左岸河濱公園', 'Chengmei Riverside Park South', '成美左岸河濱公園（2）', 'Chengmei Riverside Park South (2)'),
  ('Taipei', 'osm:way/1336506663@0m;park/way/309157011', '台北市民廣場', 'Taipei Civic Square', '台北市民廣場（2）', 'Taipei Civic Square (2)'),
  ('Taipei', 'osm:way/1280795099@0m;park/relation/4820141', '福州山公園', 'Fujhoushan Park', '福州山公園（2）', 'Fujhoushan Park (2)'),
  ('Taipei', 'osm:way/280707092@25m;park/way/233666147', '松壽廣場', 'Sōngshòu Square Park', '松壽廣場（2）', 'Sōngshòu Square Park (2)');

do $$
begin
  -- Keep the reviewed patch from overwriting names that changed while it was held.
  if exists (
    select 1 from pg_temp.waypost_name_plan n
    join public.public_capsule_spots w using (city_en, source_ref)
    where w.status <> 'deleted'
      and (w.kind <> 'common' or (
        (w.name_zh, w.name_en) is distinct from (n.old_zh, n.old_en)
        and (w.name_zh, w.name_en) is distinct from (n.new_zh, n.new_en)))
  ) then raise exception 'waypost_name_plan_stale'; end if;

  -- A newly occupied reviewed name also needs a refreshed plan.
  if exists (
    select 1
    from pg_temp.waypost_name_plan n
    join public.public_capsule_spots w using (city_en, source_ref)
    join public.public_capsule_spots other on other.city_en = n.city_en
      and other.id <> w.id and other.status <> 'deleted'
    left join pg_temp.waypost_name_plan other_plan
      on other_plan.city_en = other.city_en and other_plan.source_ref = other.source_ref
    where w.status <> 'deleted'
      and ((w.name_zh, w.name_en) = (n.old_zh, n.old_en))
      and ((n.new_zh <> '' and coalesce(other_plan.new_zh, other.name_zh) = n.new_zh)
        or (n.new_en <> '' and coalesce(other_plan.new_en, other.name_en) = n.new_en))
  ) then raise exception 'waypost_name_plan_collision'; end if;
end;
$$;

with pending as materialized (
  select w.id, to_jsonb(w) as before, n.new_zh, n.new_en
  from pg_temp.waypost_name_plan n
  join public.public_capsule_spots w using (city_en, source_ref)
  where w.status <> 'deleted'
    and (w.name_zh, w.name_en) = (n.old_zh, n.old_en)
), saved as (
  update public.public_capsule_spots w
  set name_zh = p.new_zh, name_en = p.new_en
  from pending p where w.id = p.id
  returning w.id, w.name_en, p.before, to_jsonb(w) as after
)
insert into private.admin_actions (actor, actor_snapshot, action, target_type, target_id,
  target_label, before, after, note)
select '00000000-0000-0000-0000-000000000000',
  '{"id":"00000000-0000-0000-0000-000000000000","name":"Map Builder migration","avatar":null}',
  'waypost.edit', 'waypost', id::text, name_en, before, after,
  'Normalize the matching bracketed Waypost names.'
from saved order by id;

drop table pg_temp.waypost_name_plan;

commit;
